import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createClient } from "@libsql/client";

const databasePath = `/tmp/bloodora-unified-${process.pid}.db`;
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.JWT_SECRET = "unit-test-only-signing-secret-32-characters";
process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
process.env.TURSO_AUTH_TOKEN = "";
process.env.SMS_PROVIDER = "disabled";
process.env.RESEND_API_KEY = "";
process.env.SMTP_ENABLED = "false";

const { default: createApp } = await import("../../src/application.ts");
const { emailDeliveryService } = await import("../../src/services/emailDelivery.service.ts");
const { emailService } = await import("../../src/services/email.service.ts");
const { withTimeout } = await import("../../src/db/timeout.ts");
const { runWithDeadline } = await import("../../src/utils/deadline.ts");
const app = createApp();
let server;
let base;
let cookie = "";
const email = `unified.${process.pid}@example.test`;
const password = "StrongPass!234";

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const suffix of ["", "-wal", "-shm"]) rmSync(databasePath + suffix, { force: true });
});

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
  const set = response.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map((value) => value.split(";")[0]).join("; ");
  return response;
}

function form(fields) {
  return new URLSearchParams(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function csrf(html) {
  return html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] || "";
}

test("register rotates the session, injects CSRF, renders security, and logs out without crashing", async () => {
  const first = await request("/register");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("referrer-policy"), "same-origin");
  const nullOrigin = await fetch(`${base}/login`, {
    method: "POST",
    headers: { origin: "null", "content-type": "application/x-www-form-urlencoded" },
    body: "email=user%40example.test",
  });
  assert.equal(nullOrigin.status, 403, "opaque origins must remain forbidden");
  const html = await first.text();
  const token = csrf(html);
  assert.ok(token);
  assert.ok(html.includes('name="_csrf"'));
  const anonymousSession = cookie;

  const rejected = await request("/register", {
    method: "POST",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: form({ name: "No Token", email: "no-token@example.test", phone: "01712345678", password }),
  });
  assert.equal(rejected.status, 403);
  assert.equal(cookie, anonymousSession);

  const registered = await request("/register", {
    method: "POST",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: form({ _csrf: token, name: "Unified Test", email, phone: "01712345678", password, blood_group: "O+", role: "Donor", district: "Rajshahi", date_of_birth: "1995-01-01" }),
  });
  assert.equal(registered.status, 302);
  assert.notEqual(cookie, anonymousSession, "authentication must rotate the session identifier");

  const security = await request("/dashboard/security");
  assert.equal(security.status, 200);
  const securityHtml = await security.text();
  assert.ok(securityHtml.includes("Unified Test"));
  assert.ok(securityHtml.includes("Phone verification"));
  const securityToken = csrf(securityHtml);

  const preferences = await request("/dashboard/security/preferences", {
    method: "POST",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded", "x-csrf-token": securityToken },
    body: "notify_inapp=1&notify_email=1",
  });
  assert.equal(preferences.status, 302);

  const edit = await request("/profile/edit");
  const editToken = csrf(await edit.text());
  const invalidPhone = await request("/profile/edit", {
    method: "POST",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded", "x-csrf-token": editToken },
    body: form({ name: "Unified Test", phone: "invalid", holding: "", birth_certificate: "", date_of_birth: "1995-01-01" }),
  });
  assert.equal(invalidPhone.status, 400);
  assert.match(await invalidPhone.text(), /Invalid phone number/);
  const unchanged = await request("/profile/edit");
  assert.match(await unchanged.text(), /value="01712345678"/);

  const logout = await request("/logout", {
    method: "POST",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded", "x-csrf-token": securityToken },
    body: "",
  });
  assert.equal(logout.status, 302);
});

test("disabled SMS fails explicitly without exposing an OTP; admin status remains permission guarded", async () => {
  const loginPage = await request("/login");
  const token = csrf(await loginPage.text());
  const login = await request("/login", {
    method: "POST",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded", "x-csrf-token": token },
    body: form({ email, password }),
  });
  assert.equal(login.status, 302);
  const security = await request("/dashboard/security");
  const securityToken = csrf(await security.text());
  const phone = await request("/api/auth/phone/request", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json", "x-csrf-token": securityToken },
    body: "{}",
  });
  assert.equal(phone.status, 503);
  const body = await phone.json();
  assert.equal(body.error?.code || body.code, "SMS_NOT_CONFIGURED");
  assert.ok(!/\b\d{6}\b/.test(JSON.stringify(body)), "an OTP must never be returned to the browser");

  const anonymous = await fetch(`${base}/api/admin/integrations`);
  assert.equal(anonymous.status, 401);
  const apiLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  const bearer = (await apiLogin.json()).token;
  assert.ok(bearer);
  const status = await fetch(`${base}/api/admin/integrations`, { headers: { authorization: `Bearer ${bearer}` } });
  assert.equal(status.status, 200);
  const integration = await status.json();
  assert.equal(integration.integrations?.sms?.configured, false);
  assert.ok(!JSON.stringify(integration).includes("unit-test-only-signing-secret"));
});

test("password recovery keeps a generic response and does not leak tokens when email is unconfigured", async () => {
  const response = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
  });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!/token|secret/i.test(text));
  const missing = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "missing@example.test" }),
  });
  assert.equal(missing.status, 200);
  assert.equal(await missing.text(), text);
});

test("outbox deduplicates and persists provider IDs with a mocked unit-test provider", async () => {
  const originalStatus = emailDeliveryService.status;
  const originalSend = emailDeliveryService.send;
  try {
    emailDeliveryService.status = async () => ({ configured: true, provider: "resend", from: "unit@example.test" });
    emailDeliveryService.send = async () => ({ provider: "resend", providerId: "provider-unit-123" });
    const first = await emailService.send({ to: email, subject: "Unit outbox", html: "<p>Unit</p>", dedupeKey: `unit-outbox-${process.pid}` });
    const duplicate = await emailService.send({ to: email, subject: "Unit outbox", html: "<p>Unit</p>", dedupeKey: `unit-outbox-${process.pid}` });
    assert.deepEqual(first, { queued: true, sent: true });
    assert.equal(duplicate.reason, "DUPLICATE_SUPPRESSED");
    const db = createClient({ url: `file:${databasePath}` });
    const rows = await db.execute({ sql: "SELECT provider_id, status FROM email_outbox WHERE dedupe_key = ?", args: [`unit-outbox-${process.pid}`] });
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].provider_id, "provider-unit-123");
    assert.equal(rows.rows[0].status, "sent");
    db.close();
  } finally {
    emailDeliveryService.status = originalStatus;
    emailDeliveryService.send = originalSend;
  }
});

test("exhausted nested deadlines consume abandoned promise rejections", async () => {
  const unhandled = [];
  const listener = (error) => unhandled.push(error);
  process.on("unhandledRejection", listener);
  try {
    await runWithDeadline({ startedAt: Date.now() - 10, deadlineAt: Date.now() - 1, path: "/unit-deadline" }, async () => {
      const innerOperation = Promise.reject(new Error("inner database failure"));
      const inner = withTimeout(innerOperation, 1000, "inner database");
      const outer = withTimeout(inner, 1000, "session touch");
      await assert.rejects(outer, /no time budget left/);
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, [], "abandoned inner promises must not crash the process after response end");
  } finally {
    process.off("unhandledRejection", listener);
  }
});

test("unknown API paths remain JSON and liveness does not require bootstrap", async () => {
  const missing = await request("/api/definitely-not-a-route");
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type"), /application\/json/);
  const live = await request("/health");
  assert.equal(live.status, 200);
  assert.equal((await live.json()).status, "ok");
});
