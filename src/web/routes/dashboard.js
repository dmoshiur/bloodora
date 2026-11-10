// ==================== Frontend Routes - User Dashboard (API-backed) =========
// The authenticated user's hub: account overview, orders & payments, blood
// requests, security. Every number on these pages comes from the backend API
// (Promise.allSettled per section) — a section that fails renders its own
// error/empty state instead of breaking the page. Nothing is fabricated.
import express from "express";
import { apiGet, apiPost, apiPatch, ApiError } from "../api.js";
import { requireLogin, invalidateUserCache } from "../middleware/auth.js";

const router = express.Router();

/** Fetch helpers that never throw — each returns { ok, value|error }. */
async function tryGet(path, token, query = null) {
  try {
    const value = await apiGet(path, token, query);
    const field = { "/api/shop/orders/mine": "orders", "/api/blood-requests/mine": "requests",
      "/api/messages": "received", "/api/reviews/mine": "reviews" }[path];
    if (!value || (field && !Array.isArray(value[field]))) throw new ApiError("Invalid activity response", 502);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e };
  }
}

const orderStatus = (o) => String(o.status || "").toLowerCase();
const paymentConfirmed = (o) => String(o.payment_status || "").toLowerCase() === "confirmed";

function summarizeOrders(orders) {
  const total = orders.length;
  const pending = orders.filter((o) => orderStatus(o) === "pending").length;
  const completed = orders.filter((o) => orderStatus(o) === "completed").length;
  const cancelled = orders.filter((o) => orderStatus(o) === "cancelled").length;
  return { total, pending, completed, cancelled };
}

// ------------------------------------------------------------------ overview
router.get("/", requireLogin, async (req, res) => {
  const token = req.session.token;
  const [ordersR, requestsR, messagesR, reviewsR] = await Promise.all([
    tryGet("/api/shop/orders/mine", token),
    tryGet("/api/blood-requests/mine", token),
    tryGet("/api/messages", token),
    tryGet("/api/reviews/mine", token),
  ]);

  const orders = ordersR.ok ? ordersR.value.orders || [] : [];
  const requests = requestsR.ok ? requestsR.value.requests || [] : [];
  const received = messagesR.ok ? messagesR.value.received || [] : [];
  const unread = messagesR.ok ? messagesR.value.unread_count || 0 : 0;
  const reviews = reviewsR.ok ? reviewsR.value.reviews || [] : [];

  res.render("dashboard/home", {
    title: `${req.t("dash_title")} - ${res.locals.siteName}`,
    user: req.user,
    orders: { ok: ordersR.ok, list: orders.slice(0, 5), stats: summarizeOrders(orders) },
    requests: {
      ok: requestsR.ok,
      list: requests.slice(0, 5),
      active: requests.filter((r) => !r.is_fulfilled && !r.is_cancelled).length,
    },
    messages: { ok: messagesR.ok, unread, recent: received.slice(0, 3) },
    reviews: { ok: reviewsR.ok, count: reviews.length },
    active: "overview",
  });
});

// -------------------------------------------------------------------- orders
router.get("/orders", requireLogin, async (req, res) => {
  const r = await tryGet("/api/shop/orders/mine", req.session.token);
  res.render("dashboard/orders", {
    title: `${req.t("dash_orders")} - ${res.locals.siteName}`,
    orders: { ok: r.ok, list: r.ok ? r.value.orders || [] : [], stats: summarizeOrders(r.ok ? r.value.orders || [] : []) },
    filter: req.query.status || "",
    active: "orders",
  });
});

// POST /dashboard/orders/:id/cancel — real backend endpoint (owner-only).
router.post("/orders/:id/cancel", requireLogin, async (req, res) => {
  try {
    const d = await apiPost(`/api/shop/orders/${req.params.id}/cancel`, {}, req.session.token);
    req.session.flash = { type: d.type || "success", message: d.message || req.t("st_cancelled") };
  } catch (e) {
    req.session.flash = {
      type: e.status === 400 ? "warning" : "danger",
      message: e.status === 429 ? "⏳ Too many attempts — please wait a moment." : e.message || "❌",
    };
  }
  res.redirect(req.get("Referer") || "/dashboard/orders");
});

// ------------------------------------------------------------------ requests
router.get("/requests", requireLogin, async (req, res) => {
  const r = await tryGet("/api/blood-requests/mine", req.session.token);
  const requests = r.ok ? r.value.requests || [] : [];
  res.render("dashboard/requests", {
    title: `${req.t("dash_requests")} - ${res.locals.siteName}`,
    requests: { ok: r.ok, list: requests, active: requests.filter((x) => !x.is_fulfilled && !x.is_cancelled).length },
    active: "requests",
  });
});

// ------------------------------------------------------------------ security
router.get("/security", requireLogin, (req, res) => {
  res.render("dashboard/security", {
    title: `${req.t("sec_title")} - ${res.locals.siteName}`,
    user: req.user,
    active: "security",
  });
});

router.post("/security/email/request", requireLogin, async (req, res) => {
  try { const d = await apiPost("/api/auth/verify-email/request", {}, req.session.token); req.session.flash = { type: "success", message: d.message || "Verification email queued." }; }
  catch (e) { req.session.flash = { type: "warning", message: e.message }; }
  res.redirect("/dashboard/security");
});

router.post("/security/phone/request", requireLogin, async (req, res) => {
  try { const d = await apiPost("/api/auth/phone/request", {}, req.session.token); req.session.flash = { type: "success", message: d.message || "Verification code sent." }; }
  catch (e) { req.session.flash = { type: "warning", message: e.message }; }
  res.redirect("/dashboard/security");
});

router.post("/security/phone/verify", requireLogin, async (req, res) => {
  try {
    const d = await apiPost("/api/auth/phone/verify", { code: req.body.code }, req.session.token);
    invalidateUserCache(req);
    req.session.flash = { type: "success", message: d.message || "Phone verified." };
  } catch (e) { req.session.flash = { type: "warning", message: e.message }; }
  res.redirect("/dashboard/security");
});

router.post("/security/preferences", requireLogin, async (req, res) => {
  try {
    const d = await apiPatch("/api/users/me/preferences", {
      notify_email: req.body.notify_email === "1",
      notify_inapp: req.body.notify_inapp === "1",
      notify_sms: req.body.notify_sms === "1",
    }, req.session.token);
    req.session.flash = { type: "success", message: d.message || "Notification preferences saved." };
  } catch (e) { req.session.flash = { type: "warning", message: e.message }; }
  res.redirect("/dashboard/security");
});

// POST /dashboard/security — change password via the real backend endpoint.
router.post("/security", requireLogin, async (req, res) => {
  const current = String(req.body.current || "");
  const next = String(req.body.next || "");
  const confirm = String(req.body.confirm || "");
  if (!current || !next) {
    req.session.flash = { type: "warning", message: req.t("sec_min8") };
    return res.redirect("/dashboard/security");
  }
  if (next !== confirm) {
    req.session.flash = { type: "warning", message: req.t("sec_mismatch") };
    return res.redirect("/dashboard/security");
  }
  try {
    const d = await apiPost("/api/auth/password", { current, next }, req.session.token);
    req.session.flash = { type: "success", message: d.message || "✅" };
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌" };
  }
  res.redirect("/dashboard/security");
});

export default router;
