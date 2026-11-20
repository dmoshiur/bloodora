import { Router } from "express";
import { organizationController } from "../controllers/organization.controller.js";
import type { OrganizationKind } from "../repos/organization.repo.js";
import { ah } from "../utils/async.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { rateLimit } from "../middleware/rateLimit.js";
export function organizationRouter(kind: OrganizationKind) {
  const router = Router(),
    c = organizationController(kind);
  router.get("/", ah(c.list));
  router.get("/mine", requireAuth, ah(c.mine));
  router.post(
    "/",
    requireAuth,
    rateLimit({ scope: "institution-apply", max: 10, windowMs: 3600000, shared: true, keyBy: (req) => req.user?.id }),
    ah(c.create),
  );
  router.get("/:id", optionalAuth, ah(c.get));
  router.patch("/:id", requireAuth, ah(c.update));
  router.get("/:id/requests", requireAuth, ah(c.requests));
  router.post(
    "/:id/requests",
    requireAuth,
    rateLimit({ scope: "blood-create", max: 10, windowMs: 15 * 60 * 1000, shared: true, keyBy: (req) => req.user?.id }),
    ah(c.submitRequest),
  );
  router.get("/:id/members", requireAuth, ah(c.members));
  router.put("/:id/members", requireAuth, ah(c.setMember));
  router.post("/:id/review", requirePermission("partners.manage"), ah(c.review));
  return router;
}
export const institutionAdminRouter = Router();
for (const [path, kind] of [
  ["organizations", "organization"],
  ["hospitals", "hospital"],
] as const) {
  const c = organizationController(kind);
  institutionAdminRouter.get(`/${path}`, requirePermission("partners.view"), ah(c.adminList));
  institutionAdminRouter.post(`/${path}/:id/review`, requirePermission("partners.manage"), ah(c.review));
}
