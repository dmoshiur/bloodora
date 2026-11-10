// ==================== BloodOra Frontend - Content localization ====================
// This module turns *content* (the reference material in utils/content.js and,
// when it is reachable, the same material served by the backend/CMS) into a
// single-language document for the active locale.
//
// It exists because UI strings (src/i18n.js) are only half the problem: the
// Anti-D / Compatibility / Resources pages are driven by long clinical text,
// and that text used to be English-only, so a Bengali visitor got a Bengali
// navbar on top of an English article.
//
// Contract
// --------
//   • Bundled content stores every human-readable string as { en, bn, ar }.
//   • `localizeContent(incoming, bundled, lang)` walks the payload:
//       – a localized object  -> the requested locale (en fallback)
//       – a plain string that matches a known English source -> its translation
//       – a plain string the frontend has never seen -> left as-is + dev warning
//         (this is CMS content added after the frontend shipped; the frontend
//          cannot invent a translation for it, but it never crashes either)
//   • Everything returned is entity-decoded plain text. Views print it with
//     EJS `<%= %>`, which escapes once — no double escaping, no raw HTML.
//
// Nothing here ever emits markup, so there is no dangerouslySetInnerHTML /
// `<%- %>` anywhere in the content pipeline.

export const LOCALES = ["en", "bn", "ar"];
export const DEFAULT_LOCALE = "en";

// --------------------------------------------------------------- dev warnings
// Collected so tests (and developers) can see what is still untranslated.
// Production stays silent; a missing translation must never spam a log.
const warned = new Set();
const missing = new Set();

export function resetLocalizationWarnings() {
  warned.clear();
  missing.clear();
}

/** Strings the active locale had to fall back on, or had no translation for. */
export function missingTranslations() {
  return [...missing];
}

function warn(kind, detail) {
  if (process.env.NODE_ENV === "production") return;
  if (warned.has(detail)) return;
  warned.add(detail);
  missing.add(detail);
  console.warn(`⚠️  i18n: ${kind} — ${detail}`);
}

export function warnMissingKey(key, lang) {
  warn(`missing ${lang} translation for content key "${key}"`, key);
}

// ------------------------------------------------------------- entity decoding
// API/CMS text sometimes arrives pre-escaped (mother&#39;s, A &amp; B). Those
// entities are data, not markup, so they are decoded to their real characters
// here and then escaped exactly once by EJS on output.
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(value) {
  if (value == null) return "";
  if (typeof value !== "string") return String(value);
  if (!value.includes("&")) return value;

  let out = value.replace(
    /&#x([0-9a-fA-F]{1,6});|&#([0-9]{1,7});|&(amp|lt|gt|quot|apos|nbsp);/g,
    (match, hex, dec, name) => {
      const code = hex ? parseInt(hex, 16) : dec ? Number(dec) : null;
      if (code !== null) {
        if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return match;
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[name];
    }
  );
  // &amp; is decoded last so "&amp;#39;" correctly stays the literal "&#39;".
  return out.replace(/&amp;/g, "&");
}

// ------------------------------------------------------------- locale picking
/** True when the value is a { en: …, bn: …, ar: … } translation record. */
export function isLocalized(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    LOCALES.some((code) => typeof value[code] === "string")
  );
}

/**
 * Resolve one translation record to a string.
 * Falls back English -> first available locale, never returns a raw key.
 */
export function pickLocale(value, lang = DEFAULT_LOCALE, label = "") {
  if (value == null) return "";
  if (typeof value === "string") return decodeEntities(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isLocalized(value)) return value; // untouched machine data

  if (typeof value[lang] === "string" && value[lang] !== "") return decodeEntities(value[lang]);
  if (lang !== DEFAULT_LOCALE) warn(`no ${lang} text for "${label || value.en || ""}"`, `${label || "content"}:${lang}`);
  if (typeof value.en === "string" && value.en !== "") return decodeEntities(value.en);
  for (const code of LOCALES) {
    if (typeof value[code] === "string" && value[code] !== "") return decodeEntities(value[code]);
  }
  return "";
}

// ------------------------------------------------------------- source index
// Maps every known English string of a bundled reference to its translation
// record, so content that arrives from the CMS in English (or reordered) is
// still resolved to the right locale instead of leaking English into the page.
function normalize(text) {
  return String(text).replace(/\s+/g, " ").replace(/[’ʼ]/g, "'").trim().toLowerCase();
}

export function buildSourceIndex(bundled, index = new Map()) {
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (isLocalized(node)) {
      if (typeof node.en === "string" && node.en.trim()) {
        const key = normalize(node.en);
        if (!index.has(key)) index.set(key, node);
      }
      return;
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(bundled);
  return index;
}

// ------------------------------------------------------------- the localizer
/**
 * Produce a single-language copy of `incoming`, using `bundled` as the
 * translation source for the same fields.
 *
 * @param {*} incoming  payload to localize (API/CMS data, or the bundled reference)
 * @param {*} bundled   the matching bundled reference (fully trilingual)
 * @param {string} lang active locale
 * @param {Map} [index] prebuilt English-source index (built once per reference)
 * @param {string} [path] current field path, used for readable warnings
 */
export function localizeContent(incoming, bundled, lang = DEFAULT_LOCALE, index = null, path = "") {
  const activeLang = LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;

  // Nothing from the source: render the bundled reference in the right locale.
  if (incoming == null || incoming === undefined) return localizeContent(bundled, null, activeLang, index, path);

  if (Array.isArray(incoming)) {
    const fallback = Array.isArray(bundled) ? bundled : [];
    return incoming.map((item, i) =>
      localizeContent(item, fallback[i], activeLang, index, path ? `${path}[${i}]` : `[${i}]`)
    );
  }

  if (isLocalized(incoming)) return pickLocale(incoming, activeLang, path);

  if (typeof incoming === "string") {
    const text = decodeEntities(incoming);

    // 1. The bundled reference owns this exact field -> use its translation,
    //    but only when the incoming text is the same content (or empty).
    if (isLocalized(bundled) && normalize(text) === normalize(bundled.en || "")) {
      return pickLocale(bundled, activeLang, path);
    }

    // 2. The same English source appears elsewhere in the reference.
    if (index) {
      const hit = index.get(normalize(text));
      if (hit) return pickLocale(hit, activeLang, path);
    }

    // 3. English source we have never seen (new CMS entry): keep it, warn in dev.
    // 4+ letters: short tokens (IU, mcg, RhD, HPLC, O−) are units/abbreviations
    // that are intentionally left untouched.
    if (activeLang !== DEFAULT_LOCALE && /[A-Za-z]{4,}/.test(text)) {
      warn(`untranslated "${text.slice(0, 60)}…"`, `${path || "content"}:${activeLang}`);
    }
    return text;
  }

  if (typeof incoming === "number" || typeof incoming === "boolean") return incoming;

  if (typeof incoming === "object") {
    const bundledObj =
      bundled && typeof bundled === "object" && !Array.isArray(bundled) && !isLocalized(bundled) ? bundled : {};
    const out = {};
    for (const key of Object.keys(incoming)) {
      out[key] = localizeContent(incoming[key], bundledObj[key], activeLang, index, path ? `${path}.${key}` : key);
    }
    return out;
  }

  return incoming;
}

/**
 * Localize a whole reference document against its bundled trilingual source.
 * The returned object has the *same shape* the views already expect, with every
 * human-readable string resolved to `lang`.
 */
export function localizeReference(incoming, bundled, lang = DEFAULT_LOCALE) {
  const source = incoming && typeof incoming === "object" ? incoming : bundled;
  if (!source) return null;
  const index = buildSourceIndex(bundled);
  return localizeContent(source, bundled, lang, index, "");
}

/**
 * Localize one value (an array of them, or a single record) using only the
 * English-source index of `bundled` — used for CMS/API rows that have no
 * 1:1 counterpart in the bundled reference (admin-managed entries, articles).
 */
export function localizeFromSource(value, bundled, lang = DEFAULT_LOCALE) {
  if (value == null) return value;
  return localizeContent(value, null, lang, buildSourceIndex(bundled), "");
}
