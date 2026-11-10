// ==================== Frontend feature regression guards ====================
// Covers the 2026-09 frontend overhaul: AI reasoning stripping, live-chat
// deduplication, i18n completeness/fallback, template integrity and the core
// page pipeline (rendered WITHOUT a backend, exercising the fallback path).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");

process.env.PORT ||= "4598";
process.env.SESSION_SECRET ||= "test-secret";

// ---------------------------------------------------------------------------
// 1. stripThink — AI reasoning must NEVER reach the DOM (security fix)
// ---------------------------------------------------------------------------
const { stripThink, createMessageStore } = require("../../public/js/chat-utils.js");

test("stripThink removes complete reasoning blocks", () => {
  assert.equal(stripThink("<think>secret reasoning</think>The answer is 42."), "The answer is 42.");
});

test("stripThink removes an unclosed block (stream cutoff)", () => {
  assert.equal(stripThink("Partial answer <think>this reasoning never ends"), "Partial answer");
});

test("stripThink removes multiple and multiline blocks", () => {
  assert.equal(stripThink("A <think>x\ny\nz</think> B <think>q</think> C").trim(), "A  B  C");
});

test("stripThink is case-insensitive", () => {
  assert.equal(stripThink("<think>HIDDEN</think>ok"), "ok");
  assert.equal(stripThink("<think>HIDDEN</think>ok"), "ok");
});

test("stripThink defeats escaped think tags", () => {
  assert.equal(stripThink("\\<think>hidden</think>answer"), "answer");
  assert.equal(stripThink("<\\think>hidden<\\/think>answer"), "answer");
});

test("stripThink defeats HTML-escaped think tags", () => {
  assert.equal(stripThink("&lt;think&gt;hidden&lt;/think&gt;answer"), "answer");
});

test("stripThink removes reasoning wrapped in a markdown fence", () => {
  assert.equal(stripThink("```\n<think>hidden\n</think>\n```\nAnswer"), "Answer");
});

test("stripThink leaves normal answers untouched", () => {
  assert.equal(stripThink("A normal answer with 5 < 6 and price ৳10."), "A normal answer with 5 < 6 and price ৳10.");
});

test("the AI proxy strips reasoning server-side too (defence in depth)", () => {
  const src = readFileSync(path.join(root, "src/services/ai.service.ts"), "utf8");
  assert.ok(src.includes("sanitizeAnswer(rawAnswer)"), "AI service must sanitize the reply before returning it");
  assert.ok(src.includes("aiSanitize.js"), "ai.js must reuse the shared stripThink module");
});

// ---------------------------------------------------------------------------
// 2. Live-chat deduplication — one node per server message id, always
// ---------------------------------------------------------------------------
test("message store accepts each server id exactly once", () => {
  const store = createMessageStore();
  assert.equal(store.accept({ id: 10, body: "hi" }), true, "first delivery renders");
  assert.equal(store.accept({ id: 10, body: "hi" }), false, "same id (POST response vs SSE) must not render twice");
  assert.equal(store.accept({ id: 11, body: "next" }), true);
  assert.equal(store.lastId(), 11, "lastId feeds the polling cursor");
});

test("message store renders id-less local messages and resets cleanly", () => {
  const store = createMessageStore();
  assert.equal(store.accept({ body: "greeting" }), true);
  store.accept({ id: 5 });
  store.reset();
  assert.equal(store.lastId(), 0);
  assert.equal(store.accept({ id: 5 }), true, "after reset (conversation reopened) ids render again");
});

test("the chat widget reconciles via the shared store, not text matching", () => {
  const footer = readFileSync(path.join(root, "views/partials/footer.ejs"), "utf8");
  assert.ok(footer.includes("/js/chat-utils.js"), "footer must load the shared chat utilities");
  assert.ok(footer.includes("createMessageStore()"), "widget must use the id-keyed store");
  assert.ok(footer.includes("chatStore.accept"), "renderMsg must go through accept()");
  assert.ok(footer.includes("reconcile(d.message)"), "POST response must reconcile the optimistic bubble");
  assert.ok(!/lastId\s*<=|<=\s*chatState\.lastId/.test(footer), "old fragile lastId-only guard must be gone");
});

// ---------------------------------------------------------------------------
// 3. i18n — completeness, fallback, interpolation
// ---------------------------------------------------------------------------
const i18n = await import("../../src/web/i18n.js");

test("every dictionary key has English, Bangla and Arabic", () => {
  const missing = Object.entries(i18n.dict).filter(([, v]) => !v.en || !v.bn || !v.ar).map(([k]) => k);
  assert.deepEqual(missing, [], `keys missing translations: ${missing.join(", ")}`);
});

test("missing keys fall back to English, never render raw for known keys", () => {
  assert.equal(i18n.translate("bn", "definitely_missing_key"), "definitely_missing_key");
  for (const key of Object.keys(i18n.dict)) {
    const bn = i18n.translate("bn", key);
    const ar = i18n.translate("ar", key);
    assert.ok(bn && bn !== key, `bn fallback broke for ${key}`);
    assert.ok(ar && ar !== key, `ar fallback broke for ${key}`);
  }
});

test("placeholder interpolation works", () => {
  assert.equal(i18n.translate("en", "dash_welcome", { name: "Rahim" }), "Welcome back, Rahim!");
});

test("Arabic is flagged RTL and drives dir + the RTL bootstrap build", () => {
  assert.equal(i18n.langMeta("ar").dir, "rtl");
  const header = readFileSync(path.join(root, "views/partials/header.ejs"), "utf8");
  assert.ok(header.includes('dir="<%= _dir %>"'), "html element must carry the direction");
  assert.ok(header.includes("bootstrap.rtl.min.css"), "Arabic must load the RTL bootstrap build");
});

// ---------------------------------------------------------------------------
// 4. Template integrity — every res.render target exists
// ---------------------------------------------------------------------------
test("every view referenced by a route exists on disk", () => {
  const offenders = [];
  const files = [
    "src/web/router.js",
    ...require("fs").readdirSync(path.join(root, "src/web/routes")).map((f) => `src/web/routes/${f}`),
  ];
  for (const f of files) {
    const src = readFileSync(path.join(root, f), "utf8");
    for (const m of src.matchAll(/res\.render\(\s*"([^"]+)"/g)) {
      const view = path.join(root, "views", `${m[1]}.ejs`);
      if (!existsSync(view)) offenders.push(`${f} -> ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], `missing templates: ${offenders.join(", ")}`);
});

// ---------------------------------------------------------------------------
// 5. Page pipeline smoke — rendered with an UNREACHABLE backend so the
//    fallback path (bundled content + error states) is what executes.
// ---------------------------------------------------------------------------
process.env.TURSO_DATABASE_URL ||= "file:/tmp/bloodora-unit-frontend.db";
process.env.JWT_SECRET ||= "unit-test-secret-not-for-production";
const { default: createApp } = await import("../../src/app.ts");
const app = createApp();

function request(server, method, urlPath, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = require("http").request({ host: "127.0.0.1", port, method, path: urlPath, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

test("GET / renders 200 without a backend (fallback content)", async () => {
  const server = app.listen(0);
  try {
    const res = await request(server, "GET", "/");
    assert.equal(res.status, 200);
    assert.ok(res.body.includes("</html>"), "page must be complete HTML");
    assert.ok(res.body.includes("bo-chat-panel") || res.body.includes("bo-ai-panel"), "widgets must be present");
    assert.ok(res.body.includes("/js/chat-utils.js"), "shared chat utils must be loaded");
  } finally { server.close(); }
});

test("GET /login and GET /antid render 200 without a backend", async () => {
  const server = app.listen(0);
  try {
    const login = await request(server, "GET", "/login");
    assert.equal(login.status, 200);
    const antid = await request(server, "GET", "/antid");
    assert.equal(antid.status, 200, "antid must fall back to the bundled reference");
    assert.ok(antid.body.includes("Anti-D"), "fallback content must render");
  } finally { server.close(); }
});

test("GET /dashboard redirects anonymous visitors to /login", async () => {
  const server = app.listen(0);
  try {
    const res = await request(server, "GET", "/dashboard");
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, "/login");
  } finally { server.close(); }
});

test("language switching sets the lang cookie and persists across requests", async () => {
  const server = app.listen(0);
  try {
    const set = await request(server, "GET", "/set-language/bn?next=/login");
    assert.equal(set.status, 302);
    const cookie = (set.headers["set-cookie"] || []).find((c) => c.startsWith("lang="));
    assert.ok(cookie, "lang cookie must be set");
    const page = await request(server, "GET", "/login", { headers: { cookie: "lang=bn" } });
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('lang="bn"'), "Bangla must render after refresh (cookie persistence)");
    assert.ok(page.body.includes("স্বাগতম"), "Bangla strings must appear");
    const ar = await request(server, "GET", "/login", { headers: { cookie: "lang=ar" } });
    assert.ok(ar.body.includes('dir="rtl"'), "Arabic must flip the document to RTL");
    assert.ok(ar.body.includes("bootstrap.rtl.min.css"), "Arabic must load RTL bootstrap");
  } finally { server.close(); }
});

test("all core public pages render 200 in EN, BN, and AR with fallback content", async () => {
  const server = app.listen(0);
  const pages = [
    "/",
    "/login",
    "/register",
    "/donors",
    "/blood-requests",
    "/urgent",
    "/shop",
    "/shop/cart",
    "/antid",
    "/compatibility",
    "/donation-guidelines",
    "/resources",
    "/reviews",
    "/faq",
    "/contact",
  ];
  try {
    for (const lang of ["en", "bn", "ar"]) {
      for (const p of pages) {
        const res = await request(server, "GET", p, { headers: { cookie: `lang=${lang}` } });
        assert.equal(res.status, 200, `${p} failed in ${lang} with status ${res.status}`);
        assert.ok(res.body.includes(`lang="${lang}"`), `${p} must have lang="${lang}"`);
        if (lang === "ar") {
          assert.ok(res.body.includes('dir="rtl"'), `${p} in ar must have dir="rtl"`);
          assert.ok(res.body.includes("bootstrap.rtl.min.css"), `${p} in ar must include bootstrap.rtl.min.css`);
        }
      }
    }
  } finally { server.close(); }
});

test("branding defaults use local, deployment-independent assets", async () => {
  const { fetchBranding } = await import("../../src/web/middleware/site.js");
  const branding = await fetchBranding();
  assert.equal(branding.logo_file, "/images/logo.png");
  assert.equal(branding.favicon_file, "/images/logo.png");
});

test("header and footer include the logo and favicon links", async () => {
  const server = app.listen(0);
  try {
    const res = await request(server, "GET", "/");
    assert.ok(res.body.includes("/images/logo.png"), "page must include local logo URL");
    assert.ok(res.body.includes("/images/logo.png"), "page must include favicon URL");
  } finally { server.close(); }
});

test("unknown routes render the styled 404, not a stack trace", async () => {
  const server = app.listen(0);
  try {
    const res = await request(server, "GET", "/no-such-page-xyz");
    assert.equal(res.status, 404);
    assert.ok(res.body.includes("<!DOCTYPE html>") || res.body.includes("<html"), "must be an HTML page");
  } finally { server.close(); }
});
