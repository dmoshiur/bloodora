import { activityRepo } from "../repos/activity.repo.js";
import { deliveryProfileService } from "../services/deliveryProfile.service.js";
import { smsService } from "../services/sms.service.js";
import { z } from "zod";
import { ApiError } from "../utils/errors.js";
import { Router } from "express";
import { requirePermission } from "../middleware/rbac.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { ah } from "../utils/async.js";
import { integrationStatus, smsDashboard, testSms } from "../controllers/integration.controller.js";

const router = Router();
router.get("/integrations", requirePermission("settings.view"), ah(integrationStatus));
router.get("/sms", requirePermission("settings.view"), ah(smsDashboard));
router.post(
  "/sms/test",
  requirePermission("settings.manage"),
  rateLimit({ scope: "sms-test", windowMs: 15 * 60 * 1000, max: 3, shared: true }),
  ah(testSms),
);
export default router;

// Provider secrets are write-only; list responses contain metadata only.
router.get(
  "/delivery-profiles",
  requirePermission("settings.smtp", "settings.manage"),
  ah(async (_req, res) => {
    res.json({ success: true, profiles: await deliveryProfileService.list() });
  }),
);
router.post(
  "/delivery-profiles",
  requirePermission("settings.smtp", "settings.manage"),
  ah(async (req, res) => {
    res.status(201).json({ success: true, id: await deliveryProfileService.create(req.user!.id, req.body) });
  }),
);
router.post(
  "/delivery-profiles/:id/activate",
  requirePermission("settings.smtp", "settings.manage"),
  ah(async (req, res) => {
    await deliveryProfileService.activate(req.user!.id, req.params.id);
    res.json({ success: true });
  }),
);
router.post(
  "/sms/send",
  requirePermission("settings.manage"),
  rateLimit({ scope: "sms-manual", windowMs: 60 * 60 * 1000, max: 10, shared: true }),
  ah(async (req, res) => {
    const body = z
      .object({
        to: z.string().max(24),
        body: z.string().trim().min(1).max(480),
        request_key: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
      })
      .strict()
      .safeParse(req.body);
    if (!body.success) throw ApiError.badRequest("Recipient, message and unique request key are required");
    const result = await smsService.send({
      to: body.data.to,
      body: body.data.body,
      template: "admin",
      userId: req.user!.id,
      dedupeKey: `manual:${req.user!.id}:${body.data.request_key}`,
    });
    await activityRepo.create("sms", req.user!.id, `Manual SMS: ${result.status}`, {
      delivery_id: result.id,
      provider: result.provider,
      code: result.code,
    });
    res.status(result.success ? 200 : 503).json(result);
  }),
);
