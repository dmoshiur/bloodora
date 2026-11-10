import { Router } from "express";
import { requirePermission } from "../middleware/rbac.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { ah } from "../utils/async.js";
import { integrationStatus, smsDashboard, testSms } from "../controllers/integration.controller.js";

const router = Router();
router.get("/integrations", requirePermission("settings.view"), ah(integrationStatus));
router.get("/sms", requirePermission("settings.view"), ah(smsDashboard));
router.post("/sms/test", requirePermission("settings.manage"), rateLimit({ scope: "sms-test", windowMs: 15 * 60 * 1000, max: 3, shared: true }), ah(testSms));
export default router;
