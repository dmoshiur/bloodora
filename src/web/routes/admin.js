// ==================== Frontend Routes - Admin Panel (API-backed) ====================
import express from "express";
import multer from "multer";
import { apiGet, apiPost, apiPut, apiDel, apiPostForm, buildFormData } from "../api.js";
import { requireAdmin, invalidateUserCache } from "../middleware/auth.js";
import { invalidateBranding } from "../middleware/site.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

const router = express.Router();
router.get("/dashboard", requireAdmin, (req, res) => res.redirect("/admin"));

function flashFrom(req, d, fallback) {
  req.session.flash = { type: d.type || "success", message: d.message || fallback };
}

// GET /api/admin/dashboard is the source of truth; the extra panels are each
// fetched independently (allSettled) so one slow/broken endpoint degrades its
// own card instead of blanking the dashboard. Nothing shown is fabricated.
router.get("/", requireAdmin, async (req, res) => {
  const token = req.session.token;
  try {
    const [d, ordersR, activityR, supportR, messagesR] = await Promise.all([
      apiGet("/api/admin/dashboard", token).catch((e) => ({ __err: e })),
      apiGet("/api/admin/orders", token).catch((e) => ({ __err: e })),
      apiGet("/api/admin/activity", token).catch((e) => ({ __err: e })),
      apiGet("/api/support/admin/sessions", token).catch((e) => ({ __err: e })),
      apiGet("/api/messages/admin/list", token).catch((e) => ({ __err: e })),
    ]);
    const allUsers = d.all_users || [];
    const overviewOk = !d.__err && !!d.stats;
    res.render("admin/dashboard", {
      title: `${req.t("adm_dashboard")} - ${res.locals.siteName}`,
      all_users: allUsers, stats: d.stats || {}, overviewOk,
      current_notice: d.current_notice || "", settings: d.settings || res.locals.branding, now: new Date(),
      recent_registrations: d.recent_registrations || allUsers,
      // real aggregates for the side panels:
      recent_orders: ordersR.__err ? { ok: false, list: [] } : { ok: true, list: (ordersR.orders || []).slice(0, 5), revenue: (ordersR.orders || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0), paid: (ordersR.orders || []).filter((o) => String(o.payment_status || "").toLowerCase() === "confirmed").length },
      activity: activityR.__err ? { ok: false, list: [] } : { ok: true, list: (activityR.events || []).slice(0, 8) },
      support: supportR.__err ? { ok: false, sessions: [], unread: 0 } : { ok: true, sessions: (supportR.sessions || []).slice(0, 5), unread: supportR.unread_total || 0 },
      admin_messages: messagesR.__err ? { ok: false, unread: 0 } : { ok: true, unread: messagesR.unread || 0 },
      // recent registrations come from the API (already sliced); the full list is only used by /admin/users
    });
  } catch (e) {
    console.error(e.message);
    res.status(502).render("admin/unavailable", { title: req.t("adm_dashboard") });
  }
});

// ============================================================================
//  User management  (/admin/users)  — dedicated page: search, filters,
//  pagination (client-side over the real all_users payload from the API),
//  role-aware actions. Backend remains the security authority: edit/promote/
//  demote/delete/impersonate are super-admin-only endpoints, and the UI only
//  exposes them to super admins.
// ============================================================================
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const d = await apiGet("/api/admin/dashboard", req.session.token);
    res.render("admin/users", {
      title: `${req.t("adm_users")} - ${res.locals.siteName}`,
      all_users: d.all_users || [], stats: d.stats,
    });
  } catch (e) {
    res.status(502).render("admin/unavailable", { title: req.t("adm_users") });
  }
});

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const d = await apiGet("/api/admin/settings", req.session.token);
    res.render("admin/settings", { title: "Site Settings - Admin", settings: d.settings });
  } catch (e) {
    res.locals.loadError = true;
    res.render("admin/settings", { title: req.t("adm_settings"), settings: {} });
  }
});

router.post("/settings", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/settings", req.body, req.session.token);
    flashFrom(req, d, "✅ Site settings updated successfully!");
    res.redirect("/admin/settings");
  } catch (e) {
    req.session.flash = { type: "danger", message: "❌ Failed to update." };
    res.redirect("/admin/settings");
  }
});

router.post("/verify-donor/:id", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost(`/api/admin/verify-donor/${req.params.id}`, {}, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: e.type || "warning", message: e.message || "⚠️ Could not verify user." };
  }
  res.redirect(req.get("Referer") || "/admin/users");
});

router.post("/promote/:id", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost(`/api/admin/promote/${req.params.id}`, {}, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: e.status === 403 ? "warning" : "danger", message: e.message || "⚠️ Only Super Admin can promote." };
  }
  res.redirect(req.get("Referer") || "/admin/users");
});

router.post("/demote/:id", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost(`/api/admin/demote/${req.params.id}`, {}, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Unauthorized." };
  }
  res.redirect(req.get("Referer") || "/admin/users");
});

router.post("/delete/:id", requireAdmin, async (req, res) => {
  try {
    const d = await apiDel(`/api/admin/user/${req.params.id}`, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: e.type || "danger", message: e.message || "❌ Unauthorized." };
  }
  res.redirect(req.get("Referer") || "/admin/users");
});

router.post("/notice", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/notice", { notice_content: req.body.notice_content }, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: e.type || "warning", message: e.message || "⚠️ Notice cannot be empty." };
  }
  res.redirect("/admin");
});

router.post("/notice/clear", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/notice/clear", {}, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: "danger", message: "❌ Failed to clear notice." };
  }
  res.redirect("/admin");
});

// Legacy GET mutation URLs are deliberately inert. They remain recognizable,
// but only the POST forms above may change account or site state.
for (const path of ["/promote/:id", "/demote/:id", "/delete/:id", "/notice/clear"]) {
  router.get(path, requireAdmin, (req, res) => {
    req.session.flash = { type: "warning", message: "This action now requires the confirmation button (POST). No change was made." };
    res.redirect(req.get("Referer") || "/admin/users");
  });
}

// Super admin user management
router.post("/user/update/:id", requireAdmin, async (req, res) => {
  const wantsJson = req.headers["x-requested-with"] === "XMLHttpRequest";
  // The backend enforces super-admin for user updates; mirror it in the UI so
  // admins get a clear message instead of a silent 403 (frontend UX only —
  // the API remains the security authority).
  if (!req.user?.is_super_admin) {
    const msg = "⚠️ " + (req.t ? req.t("adm_super_only") : "Super Admin only.");
    if (wantsJson) return res.status(403).json({ success: false, error: msg });
    req.session.flash = { type: "warning", message: msg };
    return res.redirect("/admin/users");
  }
  try {
    const d = await apiPost(`/api/admin/user/update/${req.params.id}`, req.body, req.session.token);
    if (wantsJson) return res.json({ success: true });
    flashFrom(req, d);
    res.redirect("/admin/users");
  } catch (e) {
    if (wantsJson) return res.status(e.status || 400).json({ success: false, error: e.message });
    req.session.flash = { type: e.type || "danger", message: e.message || "❌ Failed to update." };
    res.redirect("/admin/users");
  }
});

router.get("/user/details/:id", requireAdmin, async (req, res) => {
  if (!req.user?.is_super_admin) {
    return res.status(403).json({ error: req.t ? req.t("adm_super_only") : "Super Admin only." });
  }
  try {
    const d = await apiGet(`/api/admin/user/details/${req.params.id}`, req.session.token);
    res.json(d.user);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Error" });
  }
});

// Impersonation: keep the admin's own token in the session so we can switch back.
router.post("/impersonate/:id", requireAdmin, async (req, res) => {
  if (!req.user?.is_super_admin) {
    req.session.flash = { type: "warning", message: "⚠️ " + req.t("adm_super_only") };
    return res.redirect("/admin/users");
  }
  try {
    const d = await apiPost(`/api/admin/impersonate/${req.params.id}`, {}, req.session.token);
    req.session.original_admin_id = req.user.id;
    req.session.impersonating = true;
    req.session.impersonatorToken = req.session.token;
    req.session.impersonatedUserId = d.user.id;
    req.session.token = d.token; // now acting as the target user
    invalidateUserCache(req);
    req.session.flash = { type: "info", message: d.message };
    res.redirect("/");
  } catch (e) {
    req.session.flash = { type: e.type || "danger", message: e.message || "❌ Unauthorized." };
    res.redirect("/admin");
  }
});

async function switchBack(req, res) {
  if (req.session.impersonating && req.session.impersonatorToken) {
    try {
      await apiPost(
        "/api/admin/switch-back",
        { impersonated_user_id: req.session.impersonatedUserId || null },
        req.session.impersonatorToken
      );
    } catch (e) { /* best effort */ }
    req.session.token = req.session.impersonatorToken;
    delete req.session.impersonating;
    delete req.session.original_admin_id;
    delete req.session.impersonatorToken;
    delete req.session.impersonatedUserId;
    invalidateUserCache(req);
    req.session.flash = { type: "success", message: "🔙 Switched back to admin account." };
    return res.redirect("/admin");
  }
  req.session.flash = { type: "danger", message: "❌ Cannot switch back." };
  res.redirect("/");
}

router.get("/switch-back", requireAdmin, (req, res) => switchBack(req, res));
router.get("/profile/switch-back", (req, res) => switchBack(req, res));

router.post("/create-admin", requireAdmin, async (req, res) => {
  if (!req.user?.is_super_admin) {
    req.session.flash = { type: "warning", message: "⚠️ " + req.t("adm_super_only") };
    return res.redirect("/admin/users");
  }
  try {
    const d = await apiPost("/api/admin/create-admin", req.body, req.session.token);
    flashFrom(req, d);
  } catch (e) {
    req.session.flash = { type: e.type || "danger", message: e.message || "❌ Unauthorized." };
  }
  res.redirect("/admin/users");
});

router.get("/backup-database", requireAdmin, async (req, res) => {
  try {
    const d = await apiGet("/api/admin/backup", req.session.token);
    req.session.flash = { type: "info", message: d.message };
  } catch (e) {
    req.session.flash = { type: "danger", message: "❌ Backup failed." };
  }
  res.redirect("/admin");
});

// ============================================================================
//  Branding & Identity  (/admin/branding)
// ============================================================================
router.get("/branding", requireAdmin, async (req, res) => {
  let settings = res.locals.branding;
  try { settings = (await apiGet("/api/admin/branding", req.session.token)).settings; } catch (e) { res.locals.loadError = true; }
  res.render("admin/branding", { title: "Branding & Identity - Admin", settings });
});

router.post("/branding", requireAdmin, upload.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), async (req, res) => {
  try {
    const b = req.body || {};
    const fd = new FormData();
    for (const k of ["site_name", "site_tagline", "site_description", "brand_primary", "brand_accent", "brand_font_style"]) {
      if (b[k] !== undefined) fd.append(k, String(b[k]));
    }
    for (const [field, label] of [["logo", "logo"], ["favicon", "favicon"]]) {
      const f = req.files?.[field]?.[0];
      if (f) fd.append(label, new Blob([f.buffer], { type: f.mimetype }), f.originalname);
    }
    const d = await apiPostForm("/api/admin/branding", fd, req.session.token);
    invalidateBranding();
    flashFrom(req, d, "\u2705 Branding saved.");
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "\u274c Failed to save branding." };
  }
  res.redirect("/admin/branding");
});

router.post('/delivery-profiles', requireAdmin, async(req,res)=>{
  try {
    const body={...req.body};delete body._csrf;
    for(const k of ['sender_email','sender_name','sender_id']) if(!body[k]) delete body[k];
    await apiPost('/api/admin/delivery-profiles',body,req.session.token);
    req.session.flash={type:'success',message:'Profile saved. Activate it explicitly after confirming provider setup.'};
  } catch(e){req.session.flash={type:'danger',message:e.message};}
  res.redirect('/admin/integrations');
});
router.post('/delivery-profiles/:id/activate', requireAdmin, async(req,res)=>{
  try {await apiPost(`/api/admin/delivery-profiles/${encodeURIComponent(req.params.id)}/activate`,{},req.session.token);req.session.flash={type:'success',message:'Default delivery profile changed.'};}
  catch(e){req.session.flash={type:'danger',message:e.message};}res.redirect('/admin/integrations');
});
router.post('/sms/send',requireAdmin,async(req,res)=>{
  try {const d=await apiPost('/api/admin/sms/send',{to:req.body.to,body:req.body.body,request_key:req.body.request_key},req.session.token);req.session.flash={type:'success',message:d.message};}
  catch(e){req.session.flash={type:'danger',message:e.message};}res.redirect('/admin/integrations');
});
// ---------------------------------------------------- Integration health / SMS
router.get("/integrations", requireAdmin, async (req, res) => {
  let integrations = null, sms = null, profiles = [];
  try { profiles = (await apiGet("/api/admin/delivery-profiles", req.session.token)).profiles || []; } catch {}
  try { integrations = (await apiGet("/api/admin/integrations", req.session.token)).integrations; }
  catch (e) { res.locals.loadError = true; }
  try { sms = await apiGet("/api/admin/sms", req.session.token); }
  catch (e) { res.locals.loadError = true; }
  res.render("admin/integrations", { title: `Integrations & SMS - ${res.locals.siteName}`, integrations, sms, profiles, active: "integrations" });
});

router.post("/sms/test", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/sms/test", { to: req.body.to }, req.session.token);
    req.session.flash = { type: "success", message: d.message };
  } catch (e) {
    req.session.flash = { type: "warning", message: e.message || "SMS test failed; other application features remain available." };
  }
  res.redirect("/admin/integrations");
});

// ============================================================================
//  SMTP & Email  (/admin/smtp)
// ============================================================================
router.get("/smtp", requireAdmin, async (req, res) => {
  let settings = {}, logs = [];
  try { settings = (await apiGet("/api/admin/smtp", req.session.token)).settings; } catch (e) { res.locals.loadError = true; }
  try { logs = (await apiGet("/api/admin/smtp/log", req.session.token)).logs || []; } catch (e) { res.locals.loadError = true; }
  res.render("admin/smtp", { title: "SMTP & Email - Admin", settings, logs });
});

router.post("/smtp", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/smtp", req.body, req.session.token);
    flashFrom(req, d, "\u2705 SMTP settings saved.");
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "\u274c Failed to save SMTP settings." };
  }
  res.redirect("/admin/smtp");
});

router.post("/smtp/test", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/smtp/test", { to: req.body.to }, req.session.token);
    req.session.flash = { type: d.sent ? "success" : "danger", message: d.message };
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "\u274c Test failed." };
  }
  res.redirect("/admin/smtp");
});

// ============================================================================
//  AI Assistant  (/admin/ai)  — configuration is saved via /ai-help/admin/config
// ============================================================================
router.get("/ai", requireAdmin, async (req, res) => {
  let settings = {}, models = [], conversations = [], knowledge = null, defaultModel = "qwen/qwen3.6-27b";
  try {
    const d = await apiGet("/api/ai/admin/config", req.session.token);
    settings = d.settings || {}; models = d.models || []; defaultModel = d.default_model || defaultModel;
  } catch (e) { res.locals.loadError = true; }
  try { conversations = (await apiGet("/api/ai/admin/conversations", req.session.token)).conversations || []; } catch (e) { res.locals.loadError = true; }
  try { knowledge = await apiGet("/api/ai/admin/knowledge", req.session.token); } catch (e) { res.locals.loadError = true; }
  res.render("admin/ai", { title: "AI Assistant - Admin", settings, models, conversations, knowledge, defaultModel });
});

// ============================================================================
//  Content Manager  (/admin/content)  — Anti-D entries + educational resources
// ============================================================================
router.get("/content", requireAdmin, async (req, res) => {
  let antid = [], resources = [], reference = null;
  try { const d = await apiGet("/api/admin/content/antid", req.session.token); antid = d.entries || []; reference = d.reference; } catch (e) { res.locals.loadError = true; }
  try { resources = (await apiGet("/api/admin/content/resources", req.session.token)).resources || []; } catch (e) { res.locals.loadError = true; }
  res.render("admin/content", { title: "Content Manager - Admin", antid, resources, reference });
});

router.post("/content/antid", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/content/antid", req.body, req.session.token);
    flashFrom(req, d);
  } catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/content");
});

router.post("/content/antid/:id/delete", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiDel(`/api/admin/content/antid/${req.params.id}`, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/content");
});

router.post("/content/resources", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/content/resources", req.body, req.session.token);
    flashFrom(req, d);
  } catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/content");
});

router.post("/content/resources/:id/delete", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiDel(`/api/admin/content/resources/${req.params.id}`, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/content");
});

// ============================================================================
//  Review Moderation  (/admin/reviews)
// ============================================================================
router.get("/reviews", requireAdmin, async (req, res) => {
  let reviews = [], counts = { pending: 0, approved: 0, rejected: 0 };
  try {
    const d = await apiGet("/api/reviews/admin", req.session.token, { status: req.query.status });
    reviews = d.reviews || []; counts = d.counts || counts;
  } catch (e) { res.locals.loadError = true; }
  res.render("admin/reviews", { title: "Review Moderation - Admin", reviews, counts, filter: req.query.status });
});

router.post("/reviews/:id/status", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/reviews/admin/${req.params.id}/status`, { status: req.body.status }, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/reviews");
});

router.post("/reviews/:id/feature", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/reviews/admin/${req.params.id}/feature`, {}, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/reviews");
});

router.post("/reviews/:id/reply", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/reviews/admin/${req.params.id}/reply`, { admin_reply: req.body.admin_reply }, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/reviews");
});

router.post("/reviews/:id/delete", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiDel(`/api/reviews/admin/${req.params.id}`, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/reviews");
});

// ============================================================================
//  Live Chat Inbox  (/admin/live-chat)
// ============================================================================
router.get("/live-chat", requireAdmin, async (req, res) => {
  let sessions = [], unread = 0;
  try {
    const d = await apiGet("/api/support/admin/sessions", req.session.token);
    sessions = d.sessions || []; unread = d.unread_total || 0;
  } catch (e) { res.locals.loadError = true; }
  res.render("admin/live_chat", { title: "Live Chat Inbox - Admin", sessions, unread });
});

// Live Activity feed admin view + announcement
router.get("/activity", requireAdmin, async (req, res) => {
  let events = [];
  try { events = (await apiGet("/api/admin/activity", req.session.token)).events || []; } catch (e) { res.locals.loadError = true; }
  res.render("admin/activity", { title: "Live Activity - Admin", events });
});

router.post("/activity/announce", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost("/api/admin/activity/announce", req.body, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "\u274c Failed." }; }
  res.redirect("/admin/activity");
});


// ============================================================================
//  Admin Team  (/admin/admins) — invite, activate/deactivate, revoke sessions
// ============================================================================
router.get("/admins", requireAdmin, async (req, res) => {
  const token = req.session.token;
  let admins = [], activeSuperAdmins = 0, roles = [], permissions = [];
  try {
    const d = await apiGet("/api/admin/admins", token);
    admins = d.admins || []; activeSuperAdmins = d.active_super_admins || 0;
  } catch (e) { res.locals.loadError = true; }
  try { roles = (await apiGet("/api/admin/roles", token)).roles || []; } catch (e) { res.locals.loadError = true; }
  try { permissions = (await apiGet("/api/rbac/me", token)).permissions || []; } catch {}
  const canManage = permissions.includes("admins.manage");
  const assignableRoles = roles.filter((r) => Number(r.level) >= 5).sort((a, b) => Number(b.level) - Number(a.level));
  const allRoles = [...roles].sort((a, b) => Number(b.level) - Number(a.level));
  res.render("admin/admins", {
    title: `Admin Team - ${res.locals.siteName}`,
    admins, activeSuperAdmins, assignableRoles: allRoles.length ? allRoles : assignableRoles,
    canManage, active: "admins",
  });
});

router.post("/admins/invite", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/admin/admins/invite", { name: req.body.name, email: req.body.email, phone: req.body.phone, role: req.body.role }, req.session.token);
    flashFrom(req, d, "✅ Invitation created.");
    if (d.invite_url && !d.invite_email_sent) {
      // The raw link appears exactly once, in this flash; it is never stored or logged.
      req.session.flash = { type: "warning", message: `Email not configured — share this single-use link securely: ${d.invite_url}` };
    }
  } catch (e) {
    req.session.flash = { type: "danger", message: e.message || "❌ Could not create the invitation." };
  }
  res.redirect("/admin/admins");
});

router.post("/admins/:id/activate", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/admin/admins/${encodeURIComponent(req.params.id)}/activate`, {}, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Could not activate." }; }
  res.redirect("/admin/admins");
});

router.post("/admins/:id/deactivate", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/admin/admins/${encodeURIComponent(req.params.id)}/deactivate`, {}, req.session.token)); }
  catch (e) { req.session.flash = { type: "warning", message: e.message || "❌ Could not deactivate." }; }
  res.redirect("/admin/admins");
});

router.post("/admins/:id/revoke-sessions", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/admin/admins/${encodeURIComponent(req.params.id)}/revoke-sessions`, {}, req.session.token)); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Could not revoke sessions." }; }
  res.redirect("/admin/admins");
});

router.post("/admins/:id/role", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost(`/api/admin/users/${encodeURIComponent(req.params.id)}/role`, { role: req.body.role }, req.session.token), "✅ Role updated."); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Could not assign the role." }; }
  res.redirect("/admin/admins");
});

// ============================================================================
//  Roles & Permissions  (/admin/roles)
// ============================================================================
router.get("/roles", requireAdmin, async (req, res) => {
  const token = req.session.token;
  let roles = [], permissions = [];
  try { roles = (await apiGet("/api/admin/roles", token)).roles || []; } catch (e) { res.locals.loadError = true; }
  try { permissions = (await apiGet("/api/admin/permissions", token)).permissions || []; } catch (e) { res.locals.loadError = true; }
  res.render("admin/roles", {
    title: `Roles & Permissions - ${res.locals.siteName}`,
    roles, permissions, active: "roles",
  });
});

router.post("/roles", requireAdmin, async (req, res) => {
  const permissions = [].concat(req.body.permissions || []).filter(Boolean);
  try {
    flashFrom(req, await apiPost("/api/admin/roles", { key: req.body.key, name: req.body.name, description: req.body.description, level: req.body.level, permissions }, req.session.token), "✅ Role created.");
  } catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Could not create the role." }; }
  res.redirect("/admin/roles");
});

router.post("/roles/:key/update", requireAdmin, async (req, res) => {
  const permissions = [].concat(req.body.permissions || []).filter(Boolean);
  try {
    flashFrom(req, await apiPut(`/api/admin/roles/${encodeURIComponent(req.params.key)}`, { permissions }, req.session.token), "✅ Permissions updated.");
  } catch (e) { req.session.flash = { type: "warning", message: e.message || "❌ Could not update permissions." }; }
  res.redirect("/admin/roles");
});

router.post("/roles/:key/delete", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiDel(`/api/admin/roles/${encodeURIComponent(req.params.key)}`, req.session.token), "✅ Role deleted."); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Could not delete the role." }; }
  res.redirect("/admin/roles");
});

// ============================================================================
//  Audit Logs  (/admin/audit-logs)
// ============================================================================
router.get("/audit-logs", requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);
  const filterAction = String(req.query.action || "").trim();
  const filterEntity = String(req.query.entity_type || "").trim();
  let auditEntries = [], total = 0, actions = [];
  try {
    const d = await apiGet("/api/admin/audit", req.session.token, {
      limit, offset,
      ...(filterAction ? { action: filterAction } : {}),
      ...(filterEntity ? { entity_type: filterEntity } : {}),
    });
    auditEntries = d.entries || []; total = d.total || 0; actions = d.actions || [];
  } catch (e) {
    res.locals.loadError = true;
  }
  res.render("admin/audit_logs", {
    title: `Audit Logs - ${res.locals.siteName}`,
    auditEntries, total, limit, offset, filterAction, filterEntity, actions, active: "audit",
  });
});

// ============================================================================
//  System Health  (/admin/system) — live probes, admin-only
// ============================================================================
router.get("/system", requireAdmin, async (req, res) => {
  let report = null;
  try { report = await apiGet("/api/admin/system/health", req.session.token); }
  catch (e) { res.locals.loadError = true; }
  res.render("admin/system", { title: `System Health - ${res.locals.siteName}`, report, active: "system" });
});

// ============================================================================
//  Notifications  (/admin/notifications) — own in-app feed
// ============================================================================
router.get("/notifications", requireAdmin, async (req, res) => {
  let notifications = [], unread = 0;
  try {
    const d = await apiGet("/api/notifications", req.session.token, { limit: 50 });
    notifications = d.notifications || []; unread = d.unread || 0;
  } catch (e) { res.locals.loadError = true; }
  res.render("admin/notifications", {
    title: `Notifications - ${res.locals.siteName}`,
    notifications, unread, active: "notifications",
  });
});

router.post("/notifications/read-all", requireAdmin, async (req, res) => {
  try { flashFrom(req, await apiPost("/api/notifications/read-all", {}, req.session.token), "✅ All notifications marked as read."); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Failed." }; }
  res.redirect("/admin/notifications");
});

router.post("/notifications/:id/read", requireAdmin, async (req, res) => {
  try { await apiPost(`/api/notifications/${encodeURIComponent(req.params.id)}/read`, {}, req.session.token); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Failed." }; }
  res.redirect("/admin/notifications");
});

router.post("/notifications/:id/delete", requireAdmin, async (req, res) => {
  try { await apiDel(`/api/notifications/${encodeURIComponent(req.params.id)}`, req.session.token); }
  catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Failed." }; }
  res.redirect("/admin/notifications");
});

// ============================================================================
//  My Admin Profile  (/admin/profile)
// ============================================================================
router.get("/profile", requireAdmin, async (req, res) => {
  let loginHistory = [], historyUnavailable = false;
  try {
    const d = await apiGet("/api/admin/audit", req.session.token, { actor_id: req.user.id, limit: 15 });
    loginHistory = d.entries || [];
  } catch (e) {
    historyUnavailable = true; // missing audit permission — the rest of the page still works
  }
  res.render("admin/profile", {
    title: `My Profile - ${res.locals.siteName}`,
    loginHistory, historyUnavailable, active: "profile",
  });
});

router.post("/profile/password", requireAdmin, async (req, res) => {
  const current = String(req.body.current || "");
  const next = String(req.body.next || "");
  const confirm = String(req.body.confirm || "");
  if (next !== confirm) {
    req.session.flash = { type: "warning", message: "Passwords do not match." };
    return res.redirect("/admin/profile");
  }
  try {
    const d = await apiPost("/api/auth/password", { current, next }, req.session.token);
    flashFrom(req, d, "✅ Password updated.");
  } catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Failed to change password." }; }
  res.redirect("/admin/profile");
});

router.post("/profile/revoke-sessions", requireAdmin, async (req, res) => {
  try {
    await apiPost(`/api/admin/admins/${encodeURIComponent(req.user.id)}/revoke-sessions`, {}, req.session.token);
    req.session.flash = { type: "info", message: "All sessions were revoked. Sign in again to continue." };
  } catch (e) { req.session.flash = { type: "danger", message: e.message || "❌ Could not revoke sessions." }; }
  delete req.session.token;
  delete req.session.userCache;
  delete req.session.userId;
  res.redirect("/login");
});

export default router;
