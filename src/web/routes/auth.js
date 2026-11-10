// ==================== Frontend Routes - Auth (API-backed) ====================
// Forms POST here; the server forwards to the backend API and keeps the
// returned JWT in the session.
import express from "express";
import multer from "multer";
import { apiGet, apiPost, apiPostForm, buildFormData } from "../api.js";
import { invalidateUserCache, normalizeUser, accountHome } from "../middleware/auth.js";
import { bangladeshData as localBangladeshData } from "../utils/locations.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

async function rotateSession(req) {
  if (!req.session) return;
  const language = req.session.lang;
  const cart = req.session.cart;
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  if (language) req.session.lang = language;
  if (cart) req.session.cart = cart;
}

function setAuthSession(req, token, user) {
  if (typeof token !== "string" || !token) throw new Error(req.t("auth_unavailable"));
  user = normalizeUser(user);
  req.session.token = token;
  req.session.userId = user.id;
  req.session.userCache = { user, at: Date.now() };
}

// GET Register
router.get("/register", async (req, res) => {
  if (req.user) return res.redirect(accountHome(req.user));
  let bangladeshData = localBangladeshData;
  try {
    const d = await apiGet("/api/meta/locations");
    if (d && d.bangladeshData && Object.keys(d.bangladeshData).length) bangladeshData = d.bangladeshData;
  } catch (e) { /* fallback to bundled static data */ }
  res.render("register", { title: `${req.t("nav_register")} - ${res.locals.siteName}`, error: null, bangladeshData });
});

// POST Register (multipart → forwarded to backend)
router.post("/register", upload.single("profile_pic"), async (req, res) => {
  try {
    await rotateSession(req);
    const b = req.body;
    const fd = buildFormData(
      {
        name: b.name, email: b.email, phone: b.phone, password: b.password,
        blood_group: b.blood_group, role: b.role, division: b.division,
        district: b.district, upazila: b.upazila, union: b.union, holding: b.holding,
        birth_certificate: b.birth_certificate, date_of_birth: b.date_of_birth, age: b.age,
      },
      req.file,
      "profile_pic"
    );
    const d = await apiPostForm("/api/auth/register", fd);
    setAuthSession(req, d.token, d.user);
    req.session.flash = { type: "success", message: d.message };
    return res.redirect(accountHome(req.session.userCache.user));
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Registration failed." };
    return res.redirect("/register");
  }
});

// GET Login
router.get("/login", (req, res) => {
  if (req.user) return res.redirect(accountHome(req.user));
  res.render("login", { title: `${req.t("nav_login")} - ${res.locals.siteName}` });
});

// POST Login
router.post("/login", async (req, res) => {
  try {
    await rotateSession(req);
    const { email, password } = req.body;
    const d = await apiPost("/api/auth/login", { email, password });
    setAuthSession(req, d.token, d.user);
    // Canonical, registered destinations only. Do not accept arbitrary `next`
    // URLs (including missing pages, logout or a different role's area).
    const next = accountHome(req.session.userCache.user);
    req.session.flash = { type: "success", message: req.t("dash_welcome", { name: d.user.name }) };
    return res.redirect(next);
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Login error." };
    return res.redirect("/login");
  }
});

// ------------------------------------------------------ Email / password recovery
router.get("/forgot-password", (req, res) => {
  if (req.user) return res.redirect(accountHome(req.user));
  res.render("forgot_password", { title: `Forgot password - ${res.locals.siteName}` });
});

router.post("/forgot-password", async (req, res) => {
  try { await apiPost("/api/auth/forgot-password", { email: req.body.email }); }
  catch (e) { req.session.flash = { type: "danger", message: e.message }; return res.redirect("/forgot-password"); }
  req.session.flash = { type: "success", message: "If that account exists, a password reset link has been queued. Check your email." };
  res.redirect("/forgot-password");
});

router.get("/reset-password", async (req, res) => {
  const token = String(req.query.token || req.query.t || "");
  if (!token) { req.session.flash = { type: "warning", message: "The reset link is missing its token." }; return res.redirect("/forgot-password"); }
  try { await apiGet("/api/auth/reset-password/validate", null, { token }); }
  catch (e) { req.session.flash = { type: "danger", message: e.message }; return res.redirect("/forgot-password"); }
  res.render("reset_password", { title: `Reset password - ${res.locals.siteName}`, token });
});

router.post("/reset-password", async (req, res) => {
  if (String(req.body.password || "") !== String(req.body.confirm || "")) {
    req.session.flash = { type: "warning", message: "Passwords do not match." };
    return res.redirect(`/reset-password?token=${encodeURIComponent(req.body.token || "")}`);
  }
  try {
    const d = await apiPost("/api/auth/reset-password", { token: req.body.token, password: req.body.password });
    req.session.flash = { type: "success", message: d.message || "Password updated. Sign in with the new password." };
    return res.redirect("/login");
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message };
    return res.redirect(`/reset-password?token=${encodeURIComponent(req.body.token || "")}`);
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const d = await apiGet("/api/auth/verify-email", null, { token: req.query.token });
    req.session.flash = { type: "success", message: d.message || "Email verified." };
  } catch (e) { req.session.flash = { type: "danger", message: e.message }; }
  res.redirect(req.user ? "/dashboard/security" : "/login");
});

// Logout
router.route("/logout").get(logout).post(logout);
async function logout(req, res) {
  try {
    if (req.session.token) await apiPost("/api/auth/logout", {}, req.session.token);
  } catch (e) { /* best effort */ }
  invalidateUserCache(req);
  const finish = () => {
    res.clearCookie("connect.sid", { path: "/" });
    res.clearCookie("bloodora.session", { path: "/" }); // legacy split-session cleanup
    res.redirect("/");
  };
  // The unified API logout destroys the shared session itself. The old split
  // frontend needed to destroy it a second time; doing so now would dereference
  // an intentionally cleared req.session.
  if (req.session) req.session.destroy(finish);
  else finish();
}

export default router;
