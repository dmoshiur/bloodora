import { Router, type Request } from "express";
import { ah } from "../utils/async.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { adminAccountsService } from "../services/adminAccounts.service.js";
import { systemHealthService } from "../services/systemHealth.service.js";
import { str } from "../utils/validate.js";
import { ApiError } from "../utils/errors.js";
import type { SafeUser } from "../types.js";

function actor(req: Request): SafeUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

function ctx(req: Request): { ip: string | null; userAgent: string | null } {
  const xff = req.headers["x-forwarded-for"];
  const ip = typeof xff === "string" && xff.trim() ? xff.split(",")[0].trim() : req.ip || null;
  return { ip, userAgent: str(req.headers["user-agent"]) ?? null };
}

/**
 * Admin account lifecycle + admin-only observability. Mounted at /api/admin.
 * Authorization is enforced inside the service (which re-reads the role from
 * the database) AND at the route; never trust a client-supplied role.
 */
export const adminAccountsRouter = Router();
adminAccountsRouter.use(requireAuth);

adminAccountsRouter.get("/admins", requirePermission("users.view"), ah(async (_req, res) => {
  res.json({ success: true, ...(await adminAccountsService.list()) });
}));

adminAccountsRouter.post(
  "/admins/invite",
  requirePermission("admins.manage"),
  rateLimit({ scope: "admin-invite", windowMs: 15 * 60 * 1000, max: 10, shared: true }),
  ah(async (req, res) => {
    res.json(await adminAccountsService.invite(actor(req), req.body as Record<string, unknown>, ctx(req)));
  }),
);

adminAccountsRouter.post("/admins/:id/deactivate", ah(async (req, res) => {
  res.json(await adminAccountsService.setActive(actor(req), req.params.id, false, ctx(req)));
}));
adminAccountsRouter.post("/admins/:id/activate", ah(async (req, res) => {
  res.json(await adminAccountsService.setActive(actor(req), req.params.id, true, ctx(req)));
}));
adminAccountsRouter.post("/admins/:id/revoke-sessions", ah(async (req, res) => {
  res.json(await adminAccountsService.revokeSessions(actor(req), req.params.id, ctx(req)));
}));

/** Admin-only live system health: DB, breaker, storage, mail, SMS, AI, process. */
adminAccountsRouter.get("/system/health", requirePermission("settings.view"), ah(async (_req, res) => {
  res.json(await systemHealthService.report());
}));

/** Admin-only storage inventory (metadata, never blobs). */
adminAccountsRouter.get("/system/media", requirePermission("settings.view"), ah(async (req, res) => {
  const { imageStorageService } = await import("../services/imageStorage.service.js");
  const limit = Math.min(Math.max(Number(str(req.query.limit)) || 50, 1), 200);
  const offset = Math.max(Number(str(req.query.offset)) || 0, 0);
  res.json({ success: true, media: await imageStorageService.list(limit, offset), limit, offset });
}));
