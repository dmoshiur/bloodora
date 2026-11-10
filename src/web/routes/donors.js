// ==================== Frontend Routes - Donors / Profiles (API-backed) ====================
import express from "express";
import { apiGet, apiPost } from "../api.js";
import { requireLogin, invalidateUserCache } from "../middleware/auth.js";

const router = express.Router();

// List donors
router.get("/", async (req, res) => {
  try {
    const d = await apiGet("/api/donors", null, {
      bg: req.query.bg, dist: req.query.dist, upa: req.query.upa, age_min: req.query.age_min,
    });
    res.render("donors", { title: `${req.t("don_title")} - ${res.locals.siteName}`, users: d.users, query: req.query });
  } catch (e) {
    console.error(e.message);
    res.render("donors", { title: `${req.t("don_title")} - ${res.locals.siteName}`, users: [], query: {} });
  }
});

// View profile
router.get("/profile/view/:id", async (req, res) => {
  try {
    const d = await apiGet(`/api/users/${req.params.id}`);
    res.render("profile_view", { title: d.user.name + " - Profile", user: d.user });
  } catch (e) {
    return res.status(404).render("404", { title: `${req.t("page_not_found")} - ${res.locals.siteName}` });
  }
});

// Legacy links remain valid; use the canonical profile controller for all saves.
router.get("/profile/my", requireLogin, (req, res) => res.redirect("/profile"));
router.get("/profile/edit", requireLogin, (req, res) => res.redirect("/profile/edit"));
router.post("/profile/edit", requireLogin, (req, res) => res.redirect(307, "/profile/edit"));

// Toggle donation status
router.post("/toggle_status", requireLogin, async (req, res) => {
  try {
    const d = await apiPost("/api/users/me/toggle-status", {}, req.session.token);
    invalidateUserCache(req);
    req.session.flash = { type: "success", message: d.message };
  } catch (e) {
    req.session.flash = { type: "danger", message: "❌ Status update failed." };
  }
  res.redirect(req.get("Referer") || "/donors/profile/my");
});

router.post("/apply-for-verification", requireLogin, async (req, res) => {
  try {
    const d = await apiPost("/api/users/me/apply-verification", {}, req.session.token);
    req.session.flash = { type: d.type || "info", message: d.message };
    return res.redirect("/profile");
  } catch (e) {
    req.session.flash = { type: e.type || "warning", message: e.message || "⚠️ You must be 18+ to apply." };
    return res.redirect("/profile/edit");
  }
});

export default router;
