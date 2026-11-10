import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountHome, isAdmin, normalizeUser, requireAdmin } from "../../src/web/middleware/auth.js";
import { apiGet, ApiError, proxyEventStream } from "../../src/web/api.js";
import { makeT } from "../../src/web/i18n.js";

test("only explicit server-issued admin flags grant admin access", () => {
  for (const value of [true, 1, "1"]) assert.equal(isAdmin({ is_admin: value }), true);
  for (const value of [false, 0, "0", "false", null, undefined, "admin"]) assert.equal(isAdmin({ is_admin: value }), false);
  assert.equal(accountHome({ is_admin: 0, is_super_admin: 1 }), "/admin");
  assert.equal(accountHome({ is_admin: "0", is_super_admin: "0", role: "Donor" }), "/dashboard");
  assert.equal(isAdmin({ role: "superadmin" }), false);
});

test("malformed account payloads never establish authenticated state", () => {
  for (const value of [null, {}, { id: 1 }]) assert.throws(() => normalizeUser(value), ApiError);
  const user = normalizeUser({ id: "abc", name: "Normal", is_admin: "0", is_super_admin: "0", can_donate: "0" });
  assert.equal(user.is_admin, false);
  assert.equal(user.can_donate, false);
});

test("role guard renders 403 for normal users and login for anonymous visitors", () => {
  const t = makeT("bn");
  let status, view, redirect, called = false;
  const res = { status(s) { status = s; return this; }, render(v) { view = v; }, redirect(v) { redirect = v; } };
  requireAdmin({ t, session: {}, user: { is_admin: 0 }, originalUrl: "/admin" }, res, () => { called = true; });
  assert.equal(status, 403); assert.equal(view, "403"); assert.equal(called, false);
  requireAdmin({ t, session: {}, originalUrl: "/admin" }, res, () => { called = true; });
  assert.equal(redirect, "/login"); assert.equal(called, false);
});

test("in-process API calls require their request-local context, never a BACKEND_URL", async () => {
  await assert.rejects(apiGet("/api/users/me", "test-only-token"), /context is missing/);
  const source = readFileSync(new URL("../../src/web/api.js", import.meta.url), "utf8");
  assert.ok(source.includes("AsyncLocalStorage"));
  assert.ok(!source.includes("global.fetch"));
  assert.ok(!source.includes("BACKEND_URL ="));
});

test("SSE compatibility stays same-origin and preserves the endpoint query", async () => {
  let location;
  const res = { redirect(status, value) { assert.equal(status, 307); location = value; } };
  await proxyEventStream({ session: {} }, res, "/api/support/admin/stream?after=12");
  assert.equal(location, "/api/support/admin/stream?after=12");
});

test("canonical web routers are mounted inside the one unified application", () => {
  const app = readFileSync(new URL("../../src/app.ts", import.meta.url), "utf8");
  assert.match(app, /createWebRouter/);
  assert.match(app, /app\.use\("\/api"/);
  assert.match(app, /trust proxy/);
});
