// ==================== Frontend Routes - Live Messaging proxy ====================
// The browser only ever talks to this origin. These routes forward to the
// backend's /api/support endpoints, attaching the JWT when the visitor is
// logged in so the admin sees a real name instead of "Guest".
import express from "express";
import { apiGet, apiPost, proxyEventStream } from "../api.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// POST /support/session — start or resume a conversation
router.post("/session", async (req, res) => {
  try {
    const d = await apiPost("/api/support/session", {
      session_key: req.body?.session_key || null,
      name: req.user?.name || req.body?.name || "Guest",
    }, req.session.token || null);
    res.json(d);
  } catch (e) {
    res.status(502).json({ success: false, message: e.message || "Support is unavailable." });
  }
});

// GET /support/messages?session=&after=
router.get("/messages", async (req, res) => {
  try {
    const d = await apiGet("/api/support/messages", null, { session: req.query.session, after: req.query.after });
    res.json(d);
  } catch (e) {
    res.status(502).json({ success: false, messages: [], message: e.message });
  }
});

// POST /support/messages — visitor sends a message
router.post("/messages", async (req, res) => {
  try {
    const d = await apiPost("/api/support/messages", {
      session_key: req.body?.session_key || null,
      body: req.body?.body || req.body?.message || "",
      name: req.user?.name || "Guest",
    }, req.session.token || null);
    res.json(d);
  } catch (e) {
    res.status(502).json({ success: false, message: e.message || "Message failed." });
  }
});

// GET /support/stream?session= — Server-Sent Events for the visitor
router.get("/stream", (req, res) => {
  if (!req.query.session) return res.status(400).end();
  proxyEventStream(req, res, `/api/support/stream?session=${encodeURIComponent(req.query.session)}`);
});

// ---------------------------------------------------------------- admin side

// GET /support/admin/sessions
router.get("/admin/sessions", requireAdmin, async (req, res) => {
  try { res.json(await apiGet("/api/support/admin/sessions", req.session.token)); }
  catch (e) { res.status(502).json({ success: false, sessions: [], message: e.message }); }
});

// GET /support/admin/sessions/:key/messages
router.get("/admin/sessions/:key/messages", requireAdmin, async (req, res) => {
  try { res.json(await apiGet(`/api/support/admin/sessions/${encodeURIComponent(req.params.key)}/messages`, req.session.token)); }
  catch (e) { res.status(502).json({ success: false, messages: [], message: e.message }); }
});

// POST /support/admin/sessions/:key/reply
router.post("/admin/sessions/:key/reply", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost(`/api/support/admin/sessions/${encodeURIComponent(req.params.key)}/reply`, { body: req.body?.body || "" }, req.session.token);
    res.json(d);
  } catch (e) { res.status(502).json({ success: false, message: e.message }); }
});

// POST /support/admin/sessions/:key/close
router.post("/admin/sessions/:key/close", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost(`/api/support/admin/sessions/${encodeURIComponent(req.params.key)}/close`, {}, req.session.token);
    res.json(d);
  } catch (e) { res.status(502).json({ success: false, message: e.message }); }
});

// GET /support/admin/stream — admin's real-time channel
router.get("/admin/stream", requireAdmin, (req, res) => proxyEventStream(req, res, "/api/support/admin/stream"));

export default router;
