// ==================== Frontend Routes - Blood Requests (API-backed) ====================
import express from "express";
import { apiGet, apiPost } from "../api.js";
import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

// GET request-blood form
router.get("/request-blood", (req, res) => {
  res.render("request_blood", { title: `${req.t("nav_request")} - ${res.locals.siteName}` });
});

// POST request-blood
router.post("/request-blood", async (req, res) => {
  try {
    const d = await apiPost("/api/blood-requests", req.body, req.session.token || null);
    req.session.flash = { type: d.type || "success", message: d.message };
    return res.redirect("/blood-requests");
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Failed to submit request. Please try again." };
    return res.redirect("/request-blood");
  }
});

// GET blood-requests list
router.get("/blood-requests", async (req, res) => {
  try {
    const d = await apiGet("/api/blood-requests", null, {
      bg: req.query.bg, dist: req.query.dist, division: req.query.division, urgent: req.query.urgent,
    });
    res.render("blood_requests", { title: `${req.t("req_title")} - ${res.locals.siteName}`, requests: d.requests, query: req.query });
  } catch (e) {
    res.render("blood_requests", { title: `${req.t("req_title")} - ${res.locals.siteName}`, requests: [], query: {} });
  }
});

// Urgent page
router.get("/urgent", async (req, res) => {
  try {
    const d = await apiGet("/api/blood-requests/urgent");
    res.render("urgent", { title: `${req.t("page_urgent")} - ${res.locals.siteName}`, urgent_requests: d.requests });
  } catch (e) {
    res.render("urgent", { title: `${req.t("page_urgent")} - ${res.locals.siteName}`, urgent_requests: [] });
  }
});

router.post("/urgent-contact", async (req, res) => {
  try {
    const d = await apiPost("/api/blood-requests/urgent-contact", req.body, req.session.token || null);
    req.session.flash = { type: "success", message: d.message };
  } catch (e) {
    req.session.flash = { type: "info", message: "✅ Message noted. We'll reach out shortly!" };
  }
  res.redirect("/urgent");
});

// View single request
router.get("/blood-request/:id", async (req, res) => {
  try {
    const d = await apiGet(`/api/blood-requests/${req.params.id}`);
    res.render("view_blood_request", { title: `${req.t("page_req_detail")} - ${res.locals.siteName}`, request: d.request });
  } catch (e) {
    return res.status(404).render("404", { title: `${req.t("page_not_found")} - ${res.locals.siteName}` });
  }
});

// Fulfill
router.post("/blood-request/:id/fulfill", requireLogin, async (req, res) => {
  try {
    const d = await apiPost(`/api/blood-requests/${req.params.id}/fulfill`, {}, req.session.token);
    req.session.flash = { type: d.type || "success", message: d.message };
    res.redirect("/blood-requests");
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Failed to update request." };
    res.redirect(`/blood-request/${req.params.id}`);
  }
});

// Cancel
router.post("/blood-request/:id/cancel", async (req, res) => {
  if (!req.user) {
    req.session.flash = { type: "warning", message: "⚠️ Please login to manage requests." };
    return res.redirect("/blood-requests");
  }
  try {
    const d = await apiPost(`/api/blood-requests/${req.params.id}/cancel`, {}, req.session.token);
    req.session.flash = { type: d.type || "info", message: d.message };
    res.redirect("/blood-requests");
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Failed to cancel." };
    res.redirect("/blood-requests");
  }
});

export default router;
