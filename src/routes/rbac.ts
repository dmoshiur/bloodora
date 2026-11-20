import { Router } from "express";
import { ah } from "../utils/async.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import * as c from "../controllers/rbac.controller.js";

/**
 * Roles, permissions and the audit trail.
 *
 * Reads need `users.view` (any admin operating the panel). Catalogue writes
 * (create/edit/delete roles) need `roles.manage`; assigning a role to an
 * account needs `users.role.assign` — both are held only by the seeded
 * super_admin role. Every guard re-reads the caller's role from the database,
 * so revoking a permission takes effect on the next request without forcing
 * anyone to sign out.
 */

/** Mounted at /api/rbac — the caller's own capabilities. */
export const meRouter = Router();
meRouter.get("/me", requireAuth, ah(c.me));

/** Mounted at /api/admin. */
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get("/roles", requirePermission("users.view"), ah(c.listRoles));
adminRouter.post("/roles", requirePermission("roles.manage"), ah(c.createRole));
adminRouter.get("/roles/:key", requirePermission("users.view"), ah(c.getRole));
adminRouter.put("/roles/:key", requirePermission("roles.manage"), ah(c.updateRole));
adminRouter.patch("/roles/:key", requirePermission("roles.manage"), ah(c.updateRole));
adminRouter.delete("/roles/:key", requirePermission("roles.manage"), ah(c.deleteRole));

adminRouter.get("/permissions", requirePermission("users.view"), ah(c.listPermissions));

// Role assignment lives under /users/:id/role: the existing admin router owns
// /user/:id, /promote/:id and /demote/:id, so this path does not shadow them.
adminRouter.post("/users/:id/role", requirePermission("users.role.assign"), ah(c.assignRole));

adminRouter.get("/audit", requireAnyPermission("system.audit.view", "audit_logs.view"), ah(c.audit));
