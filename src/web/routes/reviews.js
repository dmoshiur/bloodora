// ==================== Frontend Routes - Reviews & Testimonials ====================
import express from "express";
import { apiGet, apiPost, apiDel } from "../api.js";
import { requireLogin, requireAdmin } from "../middleware/auth.js";
import { localizeFromSource } from "../utils/localize.js";

// Same rule as the shop: honour { en, bn, ar } fields from the CMS and repair
// pre-escaped text; leave single-language user content exactly as written.
const localizeRow = (row, lang) => (row ? localizeFromSource(row, null, lang) : row);

const router = express.Router();

function flashFrom(req, d, fallback) {
  req.session.flash = { type: (d && d.type) || "success", message: (d && d.message) || fallback };
}

// GET /reviews — the public review page
router.get("/", async (req, res) => {
  const q = { kind: req.query.kind, rating: req.query.rating, product_id: req.query.product_id };
  let reviews = [], summary = { count: 0, average: 0, breakdown: {} }, products = [];
  try {
    const d = await apiGet("/api/meta/reviews", null, q);
    reviews = d.reviews || [];
    summary = d.summary || summary;
  } catch (e) { /* render the empty state, the form still works */ }
  try {
    const p = await apiGet("/api/shop/products");
    products = (p.products || []).map((x) => ({ id: x.id, name: x.name, price: x.price }));
  } catch (e) { /* optional */ }
  res.render("reviews", {
    title: `${req.t("rev_title")} - ${res.locals.siteName}`,
    reviews: reviews.map((r) => localizeRow(r, res.locals.lang)),
    summary,
    products: products.map((p) => localizeRow(p, res.locals.lang)),
    query: req.query,
  });
});

// POST /reviews — submit
router.post("/", requireLogin, async (req, res) => {
  try {
    const d = await apiPost("/api/reviews", {
      title: req.body.title,
      body: req.body.body,
      rating: req.body.rating,
      product_id: req.body.product_id || null,
    }, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: e.status === 400 ? "warning" : "danger", message: e.message || "❌ Could not submit the review." };
  }
  res.redirect("/reviews");
});

// GET /reviews/mine — the signed-in user's own reviews
router.get("/mine", requireLogin, async (req, res) => {
  let reviews = [];
  try { reviews = (await apiGet("/api/reviews/mine", req.session.token)).reviews || []; } catch (e) { res.locals.loadError = true; }
  const label = { pending: req.t("rev_pending"), approved: req.t("rev_approved"), rejected: req.t("rev_rejected") };
  res.render("my_reviews", { title: `${req.t("rev_write")} - ${res.locals.siteName}`, reviews, label });
});

export default router;
