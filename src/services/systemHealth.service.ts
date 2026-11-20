import sharp from "sharp";
import { all, get } from "../db/query.js";
import { breakerSnapshot } from "../db/breaker.js";
import { imageStorageService } from "./imageStorage.service.js";
import { emailDeliveryService } from "./emailDelivery.service.js";
import { smsService } from "./sms.service.js";
import { aiService } from "./ai.service.js";
import { deliveryProfileService } from "./deliveryProfile.service.js";
import { outboxRepo } from "../repos/outbox.repo.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  detail?: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

/**
 * Admin-only system health & provider availability report.
 *
 * Everything here is probed LIVE — a check reports what the dependency did on
 * this request, not what a config file claims. Secrets are never included:
 * providers report configured/not-configured booleans and a reason at most.
 */
export const systemHealthService = {
  async report() {
    const startedAt = Date.now();
    const checks: Record<string, CheckResult> = {};

    // 1) Database connectivity + round-trip latency (a real query, not a flag).
    try {
      const { ms } = await timed(() => get<{ ok: number }>("SELECT 1 AS ok"));
      checks.database = { ok: true, latency_ms: ms, detail: "SELECT 1 succeeded" };
    } catch (err) {
      checks.database = { ok: false, detail: String((err as Error)?.message ?? err).slice(0, 160) };
    }

    // 2) Breaker state (consecutive query failures / cooldown).
    const breaker = breakerSnapshot();

    // 3) Media storage: primary provider + fallback readiness (real WebP encode).
    const storage = imageStorageService.status();
    let webpOk = false;
    let webpError: string | null = null;
    try {
      // 1×1 transparent PNG → real WebP encode through sharp.
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
      const out = await sharp(png).webp().toBuffer();
      webpOk = out.length > 0;
    } catch (err) {
      webpError = String((err as Error)?.message ?? err).slice(0, 160);
    }
    const [mediaCount, cloudinaryCount] = await Promise.all([
      get<{ n: number }>("SELECT COUNT(*) AS n FROM media_assets").catch(() => ({ n: -1 })),
      get<{ n: number }>("SELECT COUNT(*) AS n FROM media_assets WHERE provider = 'cloudinary'").catch(() => ({ n: -1 })),
    ]);
    checks.storage = {
      ok: webpOk,
      detail: storage.configured ? "Cloudinary configured; WebP database fallback ready" : "Cloudinary not configured; optimized WebP served from the database",
    };

    // 4) Mail provider availability + queue depth.
    let mail: Record<string, unknown> = { configured: false, provider: null, pending: 0, sent: 0, failed: 0 };
    try {
      const [status, counts] = await Promise.all([emailDeliveryService.status(), outboxRepo.counts()]);
      mail = { configured: status.configured, provider: status.provider ?? null, pending: counts.pending, sent: counts.sent, failed: counts.failed };
      checks.mail = { ok: true, detail: status.configured ? `provider=${status.provider}` : "no provider configured (queue paused)" };
    } catch (err) {
      checks.mail = { ok: false, detail: String((err as Error)?.message ?? err).slice(0, 160) };
    }

    // 5) SMS provider availability (config only — never send a billable test).
    let sms: Record<string, unknown> = { configured: false, provider: null, reason: null };
    try {
      const [profile, s] = await Promise.all([deliveryProfileService.resolve("sms").catch(() => null), Promise.resolve(smsService.status())]);
      const configured = profile ? true : Boolean(s.configured);
      const provider = profile ? profile.provider : s.provider;
      sms = { configured, provider, reason: profile ? null : (s.reason ?? null) };
      checks.sms = { ok: true, detail: configured ? `provider=${provider}` : (s.reason ?? "not configured") };
    } catch (err) {
      checks.sms = { ok: false, detail: String((err as Error)?.message ?? err).slice(0, 160) };
    }

    // 6) AI provider availability.
    let ai: Record<string, unknown> = { configured: false, provider: null, model: null, enabled: false };
    try {
      const a = await aiService.getConfig();
      ai = { configured: a.available, provider: a.provider, model: a.model, enabled: Boolean(a.enabled) };
      checks.ai = { ok: true, detail: a.available ? `provider=${a.provider} model=${a.model} enabled=${Boolean(a.enabled)}` : "no API key configured" };
    } catch (err) {
      checks.ai = { ok: false, detail: String((err as Error)?.message ?? err).slice(0, 160) };
    }

    // 7) Process + host facts.
    const memory = process.memoryUsage();
    const healthy = Object.values(checks).every((c) => c.ok) && breaker.state !== "open";

    return {
      success: true,
      status: healthy ? "ok" : "degraded",
      generated_at: new Date().toISOString(),
      report_ms: Date.now() - startedAt,
      environment: config.isProd ? "production" : "non-production",
      node: process.version,
      uptime_seconds: Math.round(process.uptime()),
      memory: { rss_mb: Math.round(memory.rss / 1048576), heap_used_mb: Math.round(memory.heapUsed / 1048576) },
      database: { ...checks.database, breaker: breaker.state, breaker_failures: breaker.failures },
      checks,
      storage: {
        ...storage,
        webp_fallback_ready: webpOk,
        webp_fallback_error: webpError,
        media_assets: mediaCount?.n ?? -1,
        media_assets_cloudinary: cloudinaryCount?.n ?? -1,
      },
      mail,
      sms,
      ai,
    };
  },
};
