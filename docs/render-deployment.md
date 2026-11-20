# Render / hosted production deployment (incident: global CSRF_TOKEN_INVALID)

## Incident summary

Every form submission on the deployed site was rejected with

```
CSRF_TOKEN_INVALID
"The form expired or its security token is invalid. Reload and try again."
```

appearing on `/login` and across unrelated pages. This document records the root causes found, the code repairs, the required hosted configuration, and the evidence that was and was not obtainable from this environment.

## Root causes (compounding)

### 1. Schema bootstrap ran *after* the session store (code defect — fixed)

`express-session` with the Turso-backed store reads `sessions` on every non-probe request. The database schema (`CREATE TABLE IF NOT EXISTS sessions …`) is only applied by the lazily-invoked `ensureDbReady()`, and on web page requests nothing ran it *before* the session middleware. On a fresh deployment / fresh database / expired `/tmp` file, the store read failed (`no such table`), the store **fails open** ("no session"), so the request proceeded as a brand-new session whose CSRF token exists only for that response. The following POST then arrived with a cookie pointing at a session that did not (yet) exist → CSRF layer 403 → exactly the reported symptom, on every form, for every user — and self-perpetuating until some `/api/*` request happened to bootstrap the schema at exactly the right time.

**Fix:** non-probe requests now await the shared, memoized `ensureDbReady()` *before* the session middleware (`src/application.ts`). Warm invocations pay one resolved promise; a failed bootstrap still renders pages (their branding/data paths have fallbacks) and the API boundary keeps its honest 503 behavior. Probes (`/health`) remain fully detached from the database.

### 2. A missing/unloadable session was indistinguishable from a tampered token (code defect — fixed)

The CSRF layer returned `CSRF_TOKEN_INVALID` for both "token presented but wrong" and "session cookie presented but no session could be loaded" (store failure, expired/destroyed session, signing-secret mismatch). Operators could not tell "Turso down / wrong env" apart from "attack".

**Fix (`src/middleware/csrf.ts`):** a mutating request whose `connect.sid` cookie cannot be loaded now receives `CSRF_SESSION_MISSING` (403) — "Your session could not be validated. Reload the page and try again." A presented-but-wrong token remains `CSRF_TOKEN_INVALID`. Both are 403, both are logged with their code, and **CSRF protection remains fully enabled**; nothing is bypassed. The web error middleware renders its normal 403 page (or JSON for API clients) — no raw stack, no success masking.

### 3. Production boot without `JWT_SECRET` (configuration — now fail-visible)

The code previously kept the process alive with an ephemeral per-instance secret when `JWT_SECRET` was unset (deliberate Vercel trade-off). On any multi-instance host — or a single instance across a restart — cookie signatures from one instance are unverifiable on another, so **no session ever survives**, and every mutating POST fails CSRF. Vercel environment metadata (read-only, names/targets only — no values) confirms this exact shape on the deployed project: all configured variables target `preview` only (including `JWT_SECRET` set to an empty string and a preview-scoped `TURSO_DATABASE_URL=file:/tmp/…` ephemeral file database); **no production-target variables are configured at all**, so the production deployment signs sessions with an ephemeral secret per cold start.

**Fix:** `config.productionConfigMissing` tracks the two absences nothing can compensate for — `JWT_SECRET` (session signing) and `FRONTEND_URL` (origin validation) — and `GET /health` now answers `503 {"status":"degraded","missing":[…]}` (names only, never values) instead of the previous always-`ok` lie, so a misconfigured deployment lights up red in Render/Vercel health checks instead of serving a zombie that rejects every form. Database misconfiguration is deliberately **not** on that list: it already surfaces as the documented 503 `DB_NOT_CONFIGURED` / `DB_AUTH_FAILED` envelopes at the API boundary and as `degraded` from `/api/health`, and the liveness probe must stay database-free (restarting a healthy process during a database outage helps no one). Both are logged loudly at boot with exact variable names.

## What was verified where

| Surface | Status |
| --- | --- |
| Isolated production-mode application (`NODE_ENV=production`, HTTPS via `X-Forwarded-Proto`, real session round-trip, cookie attrs, rotation, cross-session rejection, destroyed sessions, degraded boot) | **Verified** — new `test/unit/csrf-session.test.mjs` and `test/unit/prod-degraded.test.mjs`, plus the existing unified-http suite |
| Vercel project configuration metadata (variable names & targets; no values read) | **Inspected** — confirms preview-only configuration, empty preview `JWT_SECRET`, ephemeral preview file DB |
| Render dashboard, environment variables, instance plan/count, logs | **NOT accessible from this environment** — no Render integration is connected; `curl` to the Render host is blocked by the sandbox network. Treat Render as unverified until the checklist below is applied |
| Live login/register POST against `https://bloodora-khun.onrender.com` | **Not executable from this sandbox** (GET probes only via the page tool). Do not claim production fixed until a human or Render CI performs the acceptance flow |

## Required configuration (Render)

A ready-to-use Blueprint is committed at `render.yaml` (web service, `npm ci && npm run build`, `npm start`, health check on `/health`, `JWT_SECRET` auto-generated, datastore variables `sync: false`). Required environment variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `JWT_SECRET` | yes | ≥32 chars random; sign sessions/JWTs; rotation invalidates all sessions |
| `TURSO_DATABASE_URL` | yes | Remote `libsql://`/`https://` URL; a `file:` database is **never** acceptable for a serverless/ephemeral host |
| `TURSO_AUTH_TOKEN` | yes | Database token |
| `FRONTEND_URL` | yes | Deployed origin, e.g. `https://bloodora-khun.onrender.com` (no trailing path); comma-separate multiple origins |
| `COOKIE_DOMAIN` | leave unset | Host-only cookie; a wrong parent domain makes the browser refuse the session cookie — same global symptom |
| `COOKIE_SECURE` | leave unset | Forced `1` in production; the site is served over HTTPS |
| `SMS_PROVIDER` / provider keys | optional | `disabled` or real provider; delivery profiles can also be managed in Admin → Integrations & SMS |
| `RESEND_API_KEY` / `RESEND_FROM_*` | optional | Transactional mail; unconfigured mail is reported honestly |
| `GROQ_API_KEY` / `AI_*` | optional | AI assistant; unconfigured AI returns a disabled notice, not fake answers |

Proxy/cookie behavior is already correct in code: `trust proxy` is set to `1` (Render terminates TLS and sets `X-Forwarded-Proto`), production forces `Secure` session cookies, `HttpOnly`, `SameSite=Lax`, `Path=/`, and the cookie carries **no Domain attribute** by default. Do **not** set `COOKIE_DOMAIN=.onrender.com` or a parent domain.

## Vercel note (same defect class, other host)

The Vercel project (`bloodora-unified`) had every variable scoped to `preview` — `JWT_SECRET` empty, database an ephemeral `file:/tmp` SQLite preview DB, and no production variables at all. To make either target workable:

1. Create a real production Turso database; set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for the target in Project Settings → Environment Variables.
2. Set a fresh random `JWT_SECRET` for that target (preview's empty string is equally broken).
3. Set `FRONTEND_URL` to the target's origin.
4. Redeploy; `GET /health` must answer `{"status":"ok"}`. If it answers `degraded`, it names exactly which variable is still missing.
5. Never point serverless production at a `file:` database — simultaneous cold starts each get their own empty file.

**No values were changed by this work; the dashboards above must be edited by an authorized operator.**

## Verification checklist (run after the host's env is fixed)

```
curl -i https://<host>/health                 → 200 {"status":"ok"} (never "degraded")
Open /login in a browser                       → form renders, DevTools shows connect.sid (Secure, HttpOnly, SameSite=Lax)
View-source <meta name="csrf-token">           → non-empty, matches hidden _csrf in the form
Register a disposable account, log out, log in → session rotates; no CSRF_TOKEN_INVALID
POST /login with a stale tab (token from before logout) → 403 CSRF_* (expected, no 500, no raw JSON page)
```

Then run the low-volume live checks for mail/SMS/AI exactly once with real credentials; none of those were exercised here.

## Operations

- **Reading fog:** any `403` with code `CSRF_SESSION_MISSING` in logs ⇒ session/store/env problem (check Turso reachability, instance count, `JWT_SECRET` stability). `CSRF_TOKEN_INVALID` ⇒ wrong/tampered/stale token (expected for stale tabs).
- **Rollback:** redeploy the previous hosted build; the additive schema changes are backward compatible.
- **Do not** disable CSRF, raise `saveUninitialized`, or add wildcard CORS to silence these errors — that trades an honest outage for a silent security hole.
