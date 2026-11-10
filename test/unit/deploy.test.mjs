import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.env.PORT = "4599";
process.env.JWT_SECRET ||= "unit-test-secret-not-for-production";

test("api/index.ts default-exports the one Vercel request handler", async () => {
  const mod = await import("../../api/index.ts");
  assert.equal(typeof mod.default, "function");
  assert.ok(mod.default.length >= 2);
});

test("importing the serverless handler does not open a listening port", async () => {
  const net = await import("node:net");
  await import("../../api/index.ts");
  const opened = await new Promise((resolve) => {
    const socket = net.connect(Number(process.env.PORT), "127.0.0.1");
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error", () => resolve(false));
    setTimeout(() => resolve(false), 300);
  });
  assert.equal(opened, false);
});

test("Vercel routes every page and API call to the single function and bundles runtime files", () => {
  const config = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.ok(config.functions?.["api/index.ts"]);
  assert.ok(config.rewrites.some((rule) => rule.destination === "/api"));
  const included = JSON.stringify(config.functions["api/index.ts"].includeFiles || "");
  for (const required of ["views", "public"]) assert.ok(included.includes(required), `${required} must be bundled`);
  assert.equal(existsSync(path.join(root, "server.js")), false, "legacy split frontend entry must stay unmounted");
});

test("sessions use the bounded Turso store, not MemoryStore or a client-side credential cookie", async () => {
  const { TursoSessionStore } = await import("../../src/sessions/tursoStore.ts");
  const session = (await import("express-session")).default;
  const store = new TursoSessionStore();
  assert.ok(!(store instanceof session.MemoryStore));
  const source = readFileSync(path.join(root, "src/app.ts"), "utf8");
  assert.ok(source.includes("store: new TursoSessionStore()"));
  assert.ok(!source.includes("new CookieSessionStore"));
});

test("SSR has no same-application HTTP backend hop", () => {
  const source = readFileSync(path.join(root, "src/web/api.js"), "utf8");
  assert.ok(source.includes("apiRouter(request, response, next)"));
  assert.ok(!source.includes("global.fetch"));
  assert.equal(existsSync(path.join(root, "backend")), false);
});

test("built-in trilingual reference content remains available", async () => {
  const content = await import("../../src/web/utils/content.js");
  assert.ok(Object.keys(content.antidReference).length > 0);
  assert.ok(Object.keys(content.compatibilityReference).length > 0);
  assert.ok(content.resourcesReference.length > 0);
  assert.ok(content.siteRoutes.length > 0);
});
