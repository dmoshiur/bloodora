import type { Request, Response } from "express";
import { z } from "zod";
import { emailDeliveryService } from "../services/emailDelivery.service.js";
import { emailService } from "../services/email.service.js";
import { smsService } from "../services/sms.service.js";
import { config } from "../config/env.js";
import { parse } from "../utils/validate.js";
import { activityRepo } from "../repos/activity.repo.js";
import { uploadService } from "../services/upload.service.js";

const testSchema = z.object({ to: z.string().trim().min(6).max(24) }).strict();

export async function integrationStatus(_req: Request, res: Response): Promise<void> {
  const [email, emailStats, smsStats] = await Promise.all([emailDeliveryService.status(), emailService.stats(), smsService.stats()]);
  const sms = smsService.status();
  res.json({
    success: true,
    integrations: {
      database: { configured: Boolean(config.tursoDatabaseUrl), mode: config.tursoDatabaseUrl ? "turso" : "development-file", health: "/api/health" },
      email: { configured: email.configured, provider: email.provider, from_configured: Boolean(email.from), stats: emailStats },
      sms: { configured: sms.configured, provider: sms.provider, reason: sms.reason, estimated_cost_tracking: true, stats: smsStats },
      ai: { configured: Boolean(config.groqApiKey), provider: config.aiProvider },
      storage: uploadService.status(),
    },
  });
}

export async function smsDashboard(_req: Request, res: Response): Promise<void> {
  const [stats, recent] = await Promise.all([smsService.stats(), smsService.recent(50)]);
  res.json({ success: true, configuration: smsService.status(), stats, recent });
}

/** Sends a real, potentially billable SMS; never a simulated success. */
export async function testSms(req: Request, res: Response): Promise<void> {
  const { to } = parse(testSchema, req.body);
  const result = await smsService.sendTemplate({
    to,
    template: "admin",
    params: { detail: `Configuration test triggered by ${req.user?.email ?? "an administrator"}.` },
    userId: req.user?.id,
    language: req.lang,
    dedupeKey: `sms-test:${req.user?.id}:${Date.now()}`,
  });
  await activityRepo.create("sms", req.user?.id ?? "system", `SMS provider test: ${result.status}`, { provider: result.provider, code: result.code });
  res.status(result.success ? 200 : 503).json(result);
}
