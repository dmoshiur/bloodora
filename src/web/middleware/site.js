// ==================== Frontend Middleware - Language + Branding ====================
// Two jobs, both needed on every single request:
//   1. Resolve the visitor's language (cookie → session → admin default) and
//      expose `t()`, `lang` and `dir` to every view.
//   2. Load the site identity (name, tagline, logo, favicon, brand colours,
//      feature flags) from the backend so the Admin Panel controls the whole
//      look of the site. Cached in memory with a short TTL and a stale-on-error
//      fallback, so a slow backend never blanks the branding.
import { apiGet } from "../api.js";
import { LANGUAGES, SUPPORTED, langMeta, makeT, DEFAULT_LANG } from "../i18n.js";
// Views print text with EJS `<%= %>`, which escapes exactly once. Any text that
// arrives pre-escaped (mother&#39;s, A &amp; B) is decoded once in the content
// pipeline (src/utils/localize.js) before it reaches a template — the old
// `<%= _esc(value) %>` pattern escaped twice and leaked a literal "&#39;".
import { isLocalized, pickLocale } from "../utils/localize.js";

// ------------------------------- cookies --------------------------------
export function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return part.slice(i + 1).trim(); }
    }
  }
  return null;
}

export function writeCookie(res, name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  res.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
}

export function resolveLanguage(req) {
  const fromCookie = readCookie(req, "lang");
  const fromQuery = typeof req.query?.lang === "string" ? req.query.lang : null;
  const fromSession = req.session?.lang;
  for (const c of [fromQuery, fromCookie, fromSession]) {
    if (c && SUPPORTED.includes(c)) return c;
  }
  const accept = (req.headers["accept-language"] || "").toLowerCase();
  if (accept.startsWith("bn")) return "bn";
  if (accept.startsWith("ar")) return "ar";
  return null; // resolved against the admin default by the caller
}

// ------------------------------ branding --------------------------------
const DEFAULT_BRANDING = {
  site_name: "BloodOra",
  // Localized records: `pickLocale` resolves them per visitor locale, and a
  // real backend value (plain string or { en, bn, ar }) overrides them.
  site_tagline: {
    en: "Donate blood. Save lives.",
    bn: "রক্ত দিন। জীবন বাঁচান।",
    ar: "تبرّع بالدم. أنقذ حياة.",
  },
  site_description: {
    en: "Connecting blood donors to save lives across Bangladesh.",
    bn: "বাংলাদেশজুড়ে জীবন বাঁচাতে রক্তদাতাদের সংযুক্ত করা।",
    ar: "نربط متبرّعي الدم لإنقاذ الأرواح في أنحاء بنغلاديش.",
  },
  logo_file: "/images/logo.png",
  favicon_file: "/images/logo.png",
  brand_primary: "#e31b23",
  brand_accent: "#ff3340",
  brand_font_style: "calligraphic",
  default_language: "en",
  ai_enabled: true,
  ai_model: "qwen/qwen3.6-27b",
  live_chat_enabled: true,
  live_activity_enabled: true,
};

let cache = { at: 0, data: null };
const TTL_MS = 15_000;

export async function fetchBranding(force = false) {
  const fresh = cache.data && Date.now() - cache.at < TTL_MS;
  if (fresh && !force) return cache.data;
  try {
    const d = await apiGet("/api/meta/settings");
    const settings = d?.settings || null;
    const merged = { ...DEFAULT_BRANDING, ...(settings || {}) };
    // normalise booleans that arrive as 0/1 from SQLite
    merged.ai_enabled = !!merged.ai_enabled;
    merged.live_chat_enabled = !!merged.live_chat_enabled;
    merged.live_activity_enabled = !!merged.live_activity_enabled;
    merged.logo_file = merged.logo_file || DEFAULT_BRANDING.logo_file;
    merged.favicon_file = merged.favicon_file || DEFAULT_BRANDING.favicon_file;
    cache = { at: Date.now(), data: merged };
    return merged;
  } catch (e) {
    if (cache.data) return cache.data;            // stale is better than blank
    cache = { at: Date.now(), data: DEFAULT_BRANDING };
    return DEFAULT_BRANDING;
  }
}

export function invalidateBranding() { cache = { at: 0, data: null }; }

// ------------------------------ middleware ------------------------------
export async function siteContext(req, res, next) {
  const branding = await fetchBranding();

  let lang = resolveLanguage(req);
  if (!lang) lang = SUPPORTED.includes(branding.default_language) ? branding.default_language : DEFAULT_LANG;
  if (req.session) req.session.lang = lang;

  const meta = langMeta(lang);
  const t = makeT(lang);
  req.t = t;                                   // available in route handlers
  res.locals.lang = lang;
  res.locals.dir = meta.dir;
  res.locals.languages = LANGUAGES;
  res.locals.currentLanguage = meta;
  res.locals.t = t;
  res.locals.currentPath = req.path || "/";
  // `branding`/`settings` are the plain-text view of the record: a localized
  // value collapses to its English text, so admin forms can never be prefilled
  // with "[object Object]" when the backend is unreachable.
  const plain = (v) => (isLocalized(v) ? (v.en ?? pickLocale(v, DEFAULT_LANG)) : v);
  const rawBranding = Object.fromEntries(Object.entries(branding).map(([k, v]) => [k, plain(v)]));
  res.locals.branding = rawBranding;
  res.locals.settings = rawBranding;        // views already reference `settings`

  // `siteBranding` is the same record with its human-readable text resolved to
  // the active locale — so a tagline/description stored as { en, bn, ar } by the
  // admin follows the visitor's language. Plain strings pass through unchanged.
  const siteBranding = {
    ...branding,
    site_name: pickLocale(branding.site_name, lang) || branding.site_name,
    site_tagline: pickLocale(branding.site_tagline, lang),
    site_description: pickLocale(branding.site_description, lang),
  };
  res.locals.siteBranding = siteBranding;
  res.locals.siteName = siteBranding.site_name;
  res.locals.fontStyle = branding.brand_font_style || "calligraphic";
  next();
}
