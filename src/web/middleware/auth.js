// ==================== Frontend Auth Middleware (API-backed) ====================
// The frontend keeps NO database. The login state is a JWT issued by the
// separated backend API; it is stored in the frontend session and sent as a
// Bearer token on every API call.
import { apiGet, ApiError } from "../api.js";

// Only server-issued account flags grant admin access; donor role is unrelated.
const flag = (v) => v === true || v === 1 || v === "1";
export const isAdmin = (user) => !!user && (flag(user.is_admin) || flag(user.is_super_admin));
export const accountHome = (user) => isAdmin(user) ? "/admin" : "/dashboard";
export function normalizeUser(user) {
  if (!user || user.id == null || typeof user.name !== "string") {
    throw new ApiError("Invalid account response", 502);
  }
  return { ...user, is_admin: isAdmin(user), is_super_admin: flag(user.is_super_admin),
    is_verified: flag(user.is_verified), can_donate: flag(user.can_donate) };
}

export async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.isAuthenticated = false;
  if (req.session && req.session.token) {
    try {
      // Revalidate the token and role on every request, including direct URLs,
      // refresh and history navigation. Cached role flags must not grant access.
      const data = await apiGet("/api/auth/me", req.session.token);
      req.user = normalizeUser(data?.user);
      req.session.userCache = { user: req.user, at: Date.now() };
      res.locals.currentUser = req.user;
      res.locals.isAuthenticated = true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Token invalid/expired/revoked — clear local login state
        delete req.session.token;
        delete req.session.userCache;
        delete req.session.userId;
      } else {
        console.error("loadUser error:", e.message);
        req.authError = e;
      }
    }
  }
  next();
}

export function invalidateUserCache(req) {
  if (req.session) delete req.session.userCache;
}

export function requireLogin(req, res, next) {
  if (req.authError) {
    // A temporary API failure is not a logout; preserve the token and show retry.
    return next(Object.assign(new Error(req.t("auth_unavailable")), { status: 503 }));
  }
  if (!req.user) {
    req.session.flash = { type: "warning", message: req.t("auth_login_required") };
    return res.redirect("/login");
  }
  next();
}

export function requireAdmin(req, res, next) {
  requireLogin(req, res, (err) => {
    if (err) return next(err);
    if (!isAdmin(req.user)) return res.status(403).render("403", {
      title: req.t("err_403_title"), requestPath: req.originalUrl,
    });
    next();
  });
}

export function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, (err) => {
    if (err) return next(err);
    if (!flag(req.user.is_super_admin)) return res.status(403).render("403", {
      title: req.t("err_403_title"), requestPath: req.originalUrl,
    });
    next();
  });
}
