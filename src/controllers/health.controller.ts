import type { Request, Response } from "express";
import { probeQuery } from "../db/query.js";
import { dbBreaker, breakerSnapshot } from "../db/breaker.js";
import { publicReason } from "../db/errors.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { isTimeoutError } from "../db/timeout.js";
import { requestIdOf } from "../middleware/requestId.js";

/**
 * Baked in at build time rather than read from package.json at runtime: on
 * Vercel only the compiled `dist/` tree is guaranteed to be present, so a
 * runtime `readFileSync("../package.json")` would be the one thing that can make
 * the health probe itself fail.
 */
const APP_VERSION = "4.0.0";

/**
 * GET /health/live — process liveness.
 *
 * The only dependency this reports on is the event loop itself. It answers 200
 * even when the database, the session store or a required env var is broken,
 * because a platform must distinguish "the instance is up" from "the instance
 * is gone" — a liveness probe that turns red on a dependency outage causes
 * restart loops that fix nothing and hide the real failure.
 */
export function liveness(_req: Request, res: Response): void {
  res.json({
    ok: true,
    status: "ok",
    service: "bloodora-backend",
    version: APP_VERSION,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
}

/**
 * The tables (and migrated columns) every request path depends on. Read-only
 * presence checks — deliberately stricter than "the tables exist": the
 * production outage was exactly a column (users.is_active) missing on a legacy
 * database whose tables were all present, so table presence alone called this
 * instance healthy while every query on the column failed.
 */
const REQUIRED_TABLES = ["users", "settings", "products"] as const;
const REQUIRED_SHAPE_SQL = `SELECT
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map((t) => `'${t}'`).join(", ")})) AS tables,
  (SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = 'is_active') AS users_is_active,
  (SELECT COUNT(*) FROM pragma_table_info('products') WHERE name = 'is_active') AS products_is_active`;

interface ReadinessCheck {
  ok: boolean;
  ms?: number;
  /** Leak-free failure category; never a host, token, SQL statement or stack. */
  reason?: string;
}

/**
 * GET /health/ready — dependency readiness.
 *
 * Reports ready ONLY when the database operations the site actually needs
 * succeed *right now*. Readiness deliberately does NOT call the bootstrap:
 * running `applySchema()` here would migrate (or create tables inside)
 * whatever database this instance happens to reach, and a check that mutates
 * its own subject is not a check — it would report ready for a database the
 * app had never seen before, and would silently repair an empty replacement
 * database in place of the missing production one. Instead it performs three
 * read-only operations, each bounded by `HEALTH_DB_TIMEOUT_MS`:
 *
 *   1. connectivity — `SELECT 1` through the breaker-bypassing health path;
 *   2. schema      — the required tables (users, settings, products) exist AND
 *                     carry the migrated columns the site queries (users.is_active,
 *                     products.is_active);
 *   3. data read   — a real `SELECT COUNT(*)` against `users` answers.
 *
 * Any failure yields 503 with the coarse per-check category. Nothing here
 * contains a credential, a host or a query — those stay in the server log.
 */
export async function readiness(req: Request, res: Response): Promise<void> {
  const requestId = requestIdOf(req);
  const started = Date.now();
  const checks: Record<"connectivity" | "schema" | "dataRead", ReadinessCheck> = {
    connectivity: { ok: false },
    schema: { ok: false },
    dataRead: { ok: false },
  };

  const fail = (status: "not_configured" | "not_ready", reason: string, missing?: string[]) => {
    logger.warn("readiness: dependencies not ready", { reason, missing, requestId });
    res.status(503).json({
      ok: false,
      ready: false,
      status,
      database: "unavailable",
      reason,
      service: "bloodora-backend",
      version: APP_VERSION,
      checks,
      ...(missing ? { missing } : {}),
      requestId,
      time: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    });
  };

  // A misconfigured instance must not even touch the network: answer from
  // configuration alone. Variable NAMES are safe to expose; values never are.
  const missing = [...config.productionConfigMissing];
  if (config.isProd && !config.tursoDatabaseUrl && !missing.includes("TURSO_DATABASE_URL")) {
    missing.push("TURSO_DATABASE_URL");
  }
  if (missing.length > 0) {
    checks.connectivity = { ok: false, reason: "not_configured" };
    checks.schema = { ok: false, reason: "not_configured" };
    checks.dataRead = { ok: false, reason: "not_configured" };
    fail("not_configured", "not_configured", missing);
    return;
  }

  const checkOne = async (
    key: keyof typeof checks,
    sql: string,
    ok: (row: Record<string, unknown> | null) => boolean,
    badReason: string,
  ): Promise<boolean> => {
    const t0 = Date.now();
    try {
      const row = await probeQuery<Record<string, unknown>>(sql, [], config.healthDbTimeoutMs);
      const ms = Date.now() - t0;
      if (ok(row)) {
        checks[key] = { ok: true, ms };
        return true;
      }
      checks[key] = { ok: false, ms, reason: badReason };
      return false;
    } catch (err) {
      checks[key] = {
        ok: false,
        ms: Date.now() - t0,
        reason: isTimeoutError(err) ? "timeout" : publicReason(err),
      };
      return false;
    }
  };

  // 1. Connectivity — prerequisite for the checks below.
  const connected = await checkOne(
    "connectivity",
    "SELECT 1 AS ok",
    (row) => Number(row?.ok) === 1,
    "unknown",
  );

  // 2. Schema — required tables AND the migrated columns that production rows
  // depend on exist (no DDL is issued by this probe).
  if (connected) {
    await checkOne(
      "schema",
      REQUIRED_SHAPE_SQL,
      (row) =>
        Number(row?.tables ?? 0) === REQUIRED_TABLES.length &&
        Number(row?.users_is_active ?? 0) === 1 &&
        Number(row?.products_is_active ?? 0) === 1,
      "schema_missing",
    );
  } else {
    checks.schema = { ok: false, reason: checks.connectivity.reason ?? "unreachable" };
  }

  // 3. Data read — a real query against a required read path.
  if (checks.schema.ok) {
    await checkOne(
      "dataRead",
      "SELECT COUNT(*) AS n FROM users",
      (row) => row?.n !== undefined,
      "unknown",
    );
  } else {
    checks.dataRead = { ok: false, reason: checks.schema.reason ?? "unreachable" };
  }

  const ready = Object.values(checks).every((c) => c.ok);
  if (!ready) {
    dbBreaker.noteFailure(
      Object.assign(new Error("readiness probe failed"), { dependency: true }),
      "readiness probe",
    );
    fail("not_ready", checks.connectivity.reason ?? checks.schema.reason ?? checks.dataRead.reason ?? "unknown");
    return;
  }
  // A green readiness probe is a half-open trial for the breaker, same as the
  // /api/health success path: this instance may serve data traffic again.
  dbBreaker.noteSuccess("readiness probe");
  res.json({
    ok: true,
    ready: true,
    status: "ready",
    database: "connected",
    service: "bloodora-backend",
    version: APP_VERSION,
    checks,
    requestId,
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    readinessMs: Date.now() - started,
  });
}

/**
 * GET /api/health — deployment health probe.
 *
 * HARD REQUIREMENTS, all of them load-bearing:
 *
 *   1. **It must never hang.** It is the only way to tell "the function is dead"
 *      from "the function is up but its database is not", and a probe that stalls
 *      answers neither question. The `SELECT 1` is bounded by
 *      `HEALTH_DB_TIMEOUT_MS` (default 1.5 s) *on top of* the transport deadline
 *      injected into the libSQL client — before those existed, a Turso host that
 *      accepted the connection and never replied left this probe pending forever
 *      (reproduced as `curl -m 15 /api/health → status=000`).
 *   2. **It must not depend on anything it is reporting on.** `app.ts` exempts it
 *      from the session middleware, the DB bootstrap middleware and the language
 *      middleware; here it uses `probeQuery()`, which bypasses the fast-fail
 *      breaker. A probe that reads our own pessimism instead of the database
 *      would report "unavailable" forever after one blip.
 *   3. **It must be cheap enough to call constantly** — one `SELECT 1`, no schema
 *      work, no seeding, no AI, no SMTP, no external API.
 *   4. **It must be readable by a machine AND by a human at 3am.** `ok` is the
 *      boolean a client branches on, `status` the word an uptime monitor shows,
 *      `database` the dependency named explicitly, and `reason` the leak-free
 *      category when it is down. The host, driver message and SQL stay in the
 *      server log, never in this body.
 *
 * Status codes: 200 when the API can serve traffic, 503 when it cannot. The 503
 * is deliberate — a monitor that only sees 200s would keep a broken deployment in
 * rotation.
 */
export async function health(req: Request, res: Response): Promise<void> {
  const requestId = requestIdOf(req);
  const started = Date.now();
  let database: "connected" | "unavailable" = "connected";
  let dbMs: number | null = null;
  let reason: string | null = null;

  try {
    await probeQuery<{ ok: number }>(`SELECT 1 AS ok`, [], config.healthDbTimeoutMs);
    dbMs = Date.now() - started;
    // A successful probe is the breaker's half-open trial: it reopens the data
    // path on this instance without a redeploy.
    dbBreaker.noteSuccess("health probe");
  } catch (err) {
    database = "unavailable";
    dbMs = Date.now() - started;
    // Coarse category only. `publicReason()` never returns a host, a token, a
    // SQL statement or a driver stack — those go to the log line below.
    reason = isTimeoutError(err) ? "timeout" : publicReason(err);
    dbBreaker.noteFailure(err, "health probe");
    logger.warn("health: database check failed", {
      reason,
      dbMs,
      requestId,
      detail: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
    });
  }

  const ok = database === "connected";
  const breaker = breakerSnapshot();
  res.status(ok ? 200 : 503).json({
    // `ok` is the field a client should branch on; `success`/`status` keep the
    // envelope every other endpoint in this API uses (and the contract suites
    // assert), while `database` names the dependency explicitly.
    ok,
    success: ok,
    status: ok ? "ok" : "degraded",
    service: "bloodora-backend",
    label: "BloodFerry API",
    version: APP_VERSION,
    database,
    // Legacy alias — the existing contract tests and the frontend's /health proxy
    // read `db`. Kept in lockstep with `database`.
    db: ok ? "ok" : "error",
    dbMs,
    // Leak-free failure category (`timeout` | `unreachable` | `server_error` |
    // `rate_limited` | `auth_rejected` | `not_configured` | `closed`).
    ...(reason ? { reason } : {}),
    // Whether this instance is currently failing database work fast. Useful to
    // tell "the database is down" from "one slow query".
    breaker: breaker.state,
    env: config.nodeEnv,
    // The platform budget this instance is running under, so a slow-response
    // report can be correlated with the clamps logged at boot.
    budgetMs: config.budgetMs,
    answerByMs: config.answerByMs,
    requestId,
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
}
