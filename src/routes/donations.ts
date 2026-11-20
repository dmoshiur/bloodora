import { Router } from "express";
import { ah } from "../utils/async.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { history, record, adminList } from "../controllers/donation.controller.js";
const router = Router();
router.use(requireAuth);
router.get("/mine", ah(history));
router.post("/", requirePermission("requests.moderate"), ah(record));
export default router;

export const donationAdminRouter = Router();
donationAdminRouter.get("/donations", requireAuth, requirePermission("requests.view"), ah(adminList));
donationAdminRouter.post("/donations", requireAuth, requirePermission("requests.moderate"), ah(record));
