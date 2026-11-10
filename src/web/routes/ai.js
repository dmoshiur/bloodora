// ==================== Frontend Routes - Live AI Help proxy ====================
// Same-origin proxy for the widget plus the admin configuration routes.
import express from "express";
import { createRequire } from "module";
import { apiGet, apiPost } from "../api.js";
import { requireAdmin } from "../middleware/auth.js";
import { invalidateBranding } from "../middleware/site.js";

const router = express.Router();

// Single source of truth for reasoning removal: the same UMD module the
// browser loads (/js/chat-utils.js). Stripping here means internal reasoning
// never even leaves this server — the client-side strip is defence-in-depth.
const require = createRequire(import.meta.url);
const { stripThink } = require("../../../public/js/chat-utils.js");

// GET /ai-help/config — safe public configuration for the widget (no model names / API details exposed)
router.get("/config", async (req, res) => {
  try {
    const raw = await apiGet("/api/ai/config");
    // Sanitize: hide model name, provider, tokens, etc.
    res.json({
      success: true,
      enabled: raw?.enabled !== false,
      prompts: Array.isArray(raw?.prompts) ? raw.prompts : [],
    });
  } catch (e) {
    res.json({ success: false, enabled: false, prompts: [] });
  }
});

// POST /ai-help/chat — the main endpoint used by the Live AI Help popup
router.post("/chat", async (req, res) => {
  const lang = req.body?.language || res.locals.lang || req.session?.lang || "en";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const conversation_id = req.body?.conversation_id || null;
  const user_id = req.user?.id || null;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: typeof req.t === "function" ? req.t("errors_generic") : "Invalid message",
    });
  }

  const payload = {
    message,
    conversation_id,
    language: lang,
    user_id,
  };

  let lastError = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1200ms
        await new Promise((r) => setTimeout(r, attempt * 600));
      }

      const d = await apiPost("/api/ai/chat", payload, req.session?.token || null);

      // SECURITY: never forward model reasoning (<think>…</think>) to the browser
      let cleanReply = "";
      if (d && typeof d.reply === "string") {
        cleanReply = stripThink(d.reply);
      }

      // Return sanitized response — no model name, provider, token counts or debug internals
      return res.json({
        success: true,
        reply: cleanReply,
        conversation_id: d?.conversation_id || conversation_id,
      });
    } catch (e) {
      lastError = e;
      const status = e.status || 0;
      if (status === 429 && attempt < maxRetries) {
        continue;
      }
      break;
    }
  }

  const status = lastError?.status || 502;
  const t = typeof req.t === "function" ? req.t : (k) => k;
  let clientMessage = t("errors_ai_unavailable");

  if (status === 429) {
    clientMessage = t("errors_ai_rate_limit");
  } else if (status === 408 || status === 504) {
    clientMessage = t("errors_ai_timeout");
  }

  return res.status(status >= 400 && status < 600 ? status : 502).json({
    success: false,
    status,
    message: clientMessage,
  });
});

// ---------------------------------------------------------------- admin side

router.get("/admin/config", requireAdmin, async (req, res) => {
  try { res.json(await apiGet("/api/ai/admin/config", req.session.token)); }
  catch (e) { res.status(502).json({ success: false, settings: {}, models: [], message: e.message }); }
});

router.post("/admin/config", requireAdmin, async (req, res) => {
  try {
    const d = await apiPost("/api/ai/admin/config", req.body, req.session.token);
    invalidateBranding();
    res.json(d);
  } catch (e) { res.status(502).json({ success: false, message: e.message }); }
});

router.post("/admin/test", requireAdmin, async (req, res) => {
  try { res.json(await apiPost("/api/ai/admin/test", req.body, req.session.token)); }
  catch (e) { res.status(502).json({ success: false, ok: false, message: e.message }); }
});

router.get("/admin/models", requireAdmin, async (req, res) => {
  try { res.json(await apiGet("/api/ai/admin/models", req.session.token)); }
  catch (e) { res.json({ success: false, models: [], message: e.message }); }
});

router.get("/admin/conversations", requireAdmin, async (req, res) => {
  try { res.json(await apiGet("/api/ai/admin/conversations", req.session.token)); }
  catch (e) { res.json({ success: false, conversations: [], message: e.message }); }
});

router.get("/admin/knowledge", requireAdmin, async (req, res) => {
  try { res.json(await apiGet("/api/ai/admin/knowledge", req.session.token)); }
  catch (e) { res.status(502).json({ success: false, message: e.message }); }
});

export default router;
