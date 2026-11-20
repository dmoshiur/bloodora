/**
 * Acceptance coverage for the admin isolation, multi-admin RBAC, immutable
 * audit trail, centralized image storage (Cloudinary primary + WebP DB
 * fallback) and the real-DB dashboard statistics.
 *
 * Everything here runs against a temporary file-backed database and the real
 * unified application — no mocked repositories. The Cloudinary HTTP API is
 * stubbed by a local server so both the success path and the failure →
 * database-fallback path are exercised for real (bytes are actually stored
 * and actually served back).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import http from "node:http";
import { createClient } from "@libsql/client";
import sharp from "sharp";

const databasePath = `/tmp/bloodora-admin-scope-${process.pid}.db`;
const cloudinaryCalls = [];
let cloudinaryMode = "ok";

// Cloudinary stub — must be listening BEFORE the app builds its config.
const stub = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    cloudinaryCalls.push({ url: req.url, body: body.slice(0, 400) });
    if (cloudinaryMode === "ok" && req.url.includes("/image/upload")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        secure_url: "https://res.cloudinary.com/stub/image/upload/bloodferry/test.webp",
        public_id: "bloodferry/test",
        bytes: 1234, width: 640, height: 480,
      }));
      return;
    }
    if (cloudinaryMode === "ok" && req.url.includes("/image/destroy")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ result: "ok" }));
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "stubbed provider failure" } }));
  });
});
await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
process.env.CLOUDINARY_API_BASE = `http://127.0.0.1:${stub.address().port}`;
process.env.CLOUDINARY_CLOUD_NAME = "stub-cloud";
process.env.CLOUDINARY_API_KEY = "stub-key";
process.env.CLOUDINARY_API_SECRET = "stub-secret";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.JWT_SECRET = "admin-scope-test-signing-secret-32chars";
process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
process.env.TURSO_AUTH_TOKEN = "";
process.env.SMS_PROVIDER = "disabled";
process.env.RESEND_API_KEY = "";
process.env.SMTP_ENABLED = "false";

const { default: createApp } = await import("../../src/application.ts");
const app = createApp();
let server;
let base;

function makeClient() {
  let jar = "";
  let csrfToken = "";
  return {
    async request(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (jar) headers.set("cookie", jar);
      const method = String(options.method || "GET").toUpperCase();
      if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken && !headers.has("x-csrf-token")) {
        headers.set("x-csrf-token", csrfToken);
      }
      const res = await fetch(base + path, { redirect: "manual", ...options, headers });
      const set = res.headers.getSetCookie?.() || [];
      if (set.length) jar = set.map((v) => v.split(";")[0]).join("; ");
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        const text = await res.text();
        const m = text.match(/<meta name="csrf-token" content="([^"]+)"/);
        if (m) csrfToken = m[1];
        // Keep the response readable for callers (status, headers, body).
        return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
      }
      return res;
    },
    csrf(html) {
      return html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] || "";
    },
  };
}

const superAdmin = makeClient(); // first registered account -> super admin
const adminTwo = makeClient();
const regular = makeClient();
const adminEmail = `admin.two.${process.pid}@example.test`;
const adminPassword = "AdminTwo!234";

async function login(client, email, password) {
  const page = await client.request("/login");
  const token = client.csrf(await page.text());
  const res = await client.request("/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: new URLSearchParams({ _csrf: token, email, password }).toString(),
  });
  // The web layer redirects failures back to /login; success goes elsewhere.
  const location = res.headers.get("location") || "";
  const succeeded = res.status === 302 && !location.startsWith("/login");
  if (succeeded) await client.request("/"); // session rotated — re-sync CSRF token
  res.loginSucceeded = succeeded;
  return res;
}

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => stub.close(resolve));
  for (const suffix of ["", "-wal", "-shm"]) rmSync(databasePath + suffix, { force: true });
});

test("first registered account becomes the super admin and public chrome works", async () => {
  const page = await superAdmin.request("/register");
  const token = superAdmin.csrf(await page.text());
  const res = await superAdmin.request("/register", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: new URLSearchParams({
      _csrf: token, name: "Root Admin", email: `root.${process.pid}@example.test`,
      phone: "01712345670", password: "RootAdmin!234", blood_group: "O+", role: "Donor",
      district: "Rajshahi", date_of_birth: "1990-05-05",
    }).toString(),
  });
  assert.equal(res.status, 302, "registration redirects on success");
  await superAdmin.request("/"); // session rotated — re-sync CSRF token
  const me = await superAdmin.request("/api/auth/me");
  const body = await me.json();
  assert.equal(me.status, 200);
  assert.equal(body.user.is_super_admin, true);
  assert.equal(body.user.is_active, true);
});

test("admin invitation: created by an authorized admin, accepted once, activates the account", async () => {
  const invite = await superAdmin.request("/api/admin/admins/invite", {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ name: "Second Admin", email: adminEmail, role: "admin", phone: "01712345671" }),
  });
  assert.equal(invite.status, 200);
  const inviteBody = await invite.json();
  assert.equal(inviteBody.success, true);
  assert.equal(inviteBody.invite_email_sent, false, "no mail provider is configured in tests");
  assert.match(inviteBody.invite_url, /^\/accept-invite\?token=/);
  const token = new URLSearchParams(inviteBody.invite_url.split("?")[1]).get("token");

  // Pending invite cannot sign in.
  const blocked = await login(adminTwo, adminEmail, adminPassword);
  assert.equal(blocked.loginSucceeded, false, "a pending invitation must not be able to sign in");

  // Token validates, then is consumed exactly once.
  const validate = await regular.request(`/api/auth/accept-invite/validate?token=${encodeURIComponent(token)}`);
  assert.equal(validate.status, 200);
  assert.equal((await validate.json()).email, adminEmail);
  const accept = await regular.request("/api/auth/accept-invite", {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ token, name: "Second Admin", password: adminPassword }),
  });
  assert.equal(accept.status, 200);
  const reuse = await regular.request("/api/auth/accept-invite", {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ token, name: "Second Admin", password: adminPassword }),
  });
  assert.equal(reuse.status, 400, "a consumed invitation cannot be replayed");

  const signedIn = await login(adminTwo, adminEmail, adminPassword);
  assert.equal(signedIn.loginSucceeded, true);
});

test("RBAC is enforced server-side and denials are audited", async () => {
  // The plain `admin` role may not create roles (roles.manage is super-admin only).
  const denied = await adminTwo.request("/api/admin/roles", {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ key: "nope_role", name: "Nope", permissions: ["users.view"] }),
  });
  assert.equal(denied.status, 403);

  // … but may view the users list.
  const users = await adminTwo.request("/api/admin/dashboard");
  assert.equal(users.status, 200);

  // Denials land in the audit log.
  const audit = await superAdmin.request("/api/admin/audit?action=permission.denied&limit=10");
  assert.equal(audit.status, 200);
  const entries = (await audit.json()).entries;
  assert.ok(entries.some((e) => /roles.manage/.test(e.summary || "")), "expected a roles.manage denial in the audit log");
});

test("super admin creates a custom role, assigns it, and the target's sessions rotate", async () => {
  const created = await superAdmin.request("/api/admin/roles", {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ key: "observer_role", name: "Observer", description: "Read only", level: 2, permissions: ["users.view"] }),
  });
  assert.equal(created.status, 200);

  // Register a plain user to assign the role to.
  const reg = await regular.request("/register");
  const token = regular.csrf(await reg.text());
  const email = `regular.${process.pid}@example.test`;
  const registered = await regular.request("/register", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: new URLSearchParams({
      _csrf: token, name: "Plain User", email, phone: "01712345672", password: "PlainUser!234",
      blood_group: "A+", role: "Recipient", district: "Dhaka", date_of_birth: "1998-01-01",
    }).toString(),
  });
  assert.equal(registered.status, 302);
  await regular.request("/"); // session rotated — re-sync CSRF token
  const before = await regular.request("/api/auth/me");
  const userId = (await before.json()).user.id;

  const assign = await superAdmin.request(`/api/admin/users/${userId}/role`, {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ role: "observer_role" }),
  });
  assert.equal(assign.status, 200);
  // The target's previous token was rotated by the role change.
  const rotated = await regular.request("/api/auth/me");
  assert.equal(rotated.status, 401, "a role change must invalidate the target's existing tokens");
});

test("the last active super admin cannot be demoted or deactivated", async () => {
  const me = await superAdmin.request("/api/auth/me");
  const id = (await me.json()).user.id;
  const demote = await superAdmin.request(`/api/admin/users/${id}/role`, {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(demote.status, 400);

  const deactivateSelf = await superAdmin.request(`/api/admin/admins/${id}/deactivate`, {
    method: "POST", headers: { "content-type": "application/json", origin: base }, body: "{}",
  });
  assert.equal(deactivateSelf.status, 400);

  // A plain admin cannot demote the root super admin either.
  const rootId = (await (await superAdmin.request("/api/auth/me")).json()).user.id;
  const adminAttempt = await adminTwo.request(`/api/admin/users/${rootId}/role`, {
    method: "POST", headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.notEqual(adminAttempt.status, 200, "a non-super-admin cannot demote the super admin");
  const stillRoot = await superAdmin.request("/api/auth/me");
  assert.equal((await stillRoot.json()).user.is_super_admin, true);
});

test("deactivation revokes sessions immediately; reactivation restores access", async () => {
  // Find the second admin's id.
  const list = await superAdmin.request("/api/admin/admins");
  const { admins } = await list.json();
  const target = admins.find((a) => a.email === adminEmail);
  assert.ok(target, "second admin present in the admin list");

  const before = await adminTwo.request("/api/auth/me");
  assert.equal(before.status, 200);

  const deactivated = await superAdmin.request(`/api/admin/admins/${target.id}/deactivate`, {
    method: "POST", headers: { "content-type": "application/json", origin: base }, body: "{}",
  });
  assert.equal(deactivated.status, 200);

  const revoked = await adminTwo.request("/api/auth/me");
  assert.equal(revoked.status, 401, "a deactivated account's token dies immediately");

  const loginBlocked = await login(adminTwo, adminEmail, adminPassword);
  assert.equal(loginBlocked.loginSucceeded, false);

  const reactivated = await superAdmin.request(`/api/admin/admins/${target.id}/activate`, {
    method: "POST", headers: { "content-type": "application/json", origin: base }, body: "{}",
  });
  assert.equal(reactivated.status, 200);
  const loginOk = await login(adminTwo, adminEmail, adminPassword);
  assert.equal(loginOk.loginSucceeded, true);
});

test("Cloudinary success path stores a remote reference; failure path stores a decodable WebP in the database", async () => {
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 30, b: 40 } } }).png().toBuffer();

  // 1) stub says OK → provider = cloudinary, no DB blob.
  cloudinaryMode = "ok";
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "test.png");
  const up = await superAdmin.request("/api/uploads", { method: "POST", body: fd, headers: { origin: base } });
  assert.equal(up.status, 201);
  const upBody = await up.json();
  assert.equal(upBody.storage, "cloudinary");
  const db = createClient({ url: `file:${databasePath}` });
  const rowA = await db.execute({ sql: "SELECT provider, data, external_url FROM media_assets WHERE filename = ?", args: [upBody.filename] });
  assert.equal(rowA.rows[0].provider, "cloudinary");
  assert.equal(rowA.rows[0].data, null, "cloudinary rows hold no bytes");
  assert.equal(rowA.rows[0].external_url, "https://res.cloudinary.com/stub/image/upload/bloodferry/test.webp");

  // 2) stub fails → fallback stores a REAL WebP blob, retrievable over HTTP.
  cloudinaryMode = "fail";
  const fd2 = new FormData();
  fd2.append("file", new Blob([png], { type: "image/png" }), "fallback.png");
  const up2 = await superAdmin.request("/api/uploads", { method: "POST", body: fd2, headers: { origin: base } });
  assert.equal(up2.status, 201);
  const up2Body = await up2.json();
  assert.equal(up2Body.storage, "database");
  const rowB = await db.execute({ sql: "SELECT provider, data, mime, bytes, width, height, checksum FROM media_assets WHERE filename = ?", args: [up2Body.filename] });
  assert.equal(rowB.rows[0].provider, "database");
  assert.equal(rowB.rows[0].mime, "image/webp");
  assert.ok(rowB.rows[0].bytes > 0);
  assert.ok(rowB.rows[0].checksum.length === 64, "sha256 checksum recorded");

  const served = await regular.request(`/uploads/${up2Body.filename}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/webp");
  const bytes = Buffer.from(await served.arrayBuffer());
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");

  // 3) deletion removes the local row (and attempts the remote destroy).
  cloudinaryCalls.length = 0;
  const before = cloudinaryCalls.length;
  const { imageStorageService } = await import("../../src/services/imageStorage.service.ts");
  await imageStorageService.remove(upBody.filename);
  const rowGone = await db.execute({ sql: "SELECT id FROM media_assets WHERE filename = ?", args: [upBody.filename] });
  assert.equal(rowGone.rows.length, 0);
  assert.ok(cloudinaryCalls.some((c) => c.url.includes("/image/destroy")), "deleting a cloudinary asset destroys the remote object");
  await imageStorageService.remove(up2Body.filename);
  const rowGone2 = await db.execute({ sql: "SELECT id FROM media_assets WHERE filename = ?", args: [up2Body.filename] });
  assert.equal(rowGone2.rows.length, 0);
});

test("user profile updates persist through the real backend", async () => {
  // The role assignment earlier rotated this user's tokens — sign in again.
  const profileEmail = `regular.${process.pid}@example.test`;
  const signedIn = await login(regular, profileEmail, "PlainUser!234");
  assert.equal(signedIn.loginSucceeded, true);
  const getMe = async () => (await (await regular.request("/api/auth/me")).json()).user;
  const beforeUser = await getMe();
  const res = await regular.request(`/api/users/me`, {
    method: "PUT",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: new URLSearchParams({ name: "Plain User Updated", phone: "01712345999", holding: "House 9", date_of_birth: "1998-01-01" }).toString(),
  });
  assert.equal(res.status, 200);
  const afterUser = await getMe();
  assert.equal(afterUser.name, "Plain User Updated");
  assert.equal(afterUser.phone, "+8801712345999", "phones are stored normalized to +880…");
  assert.ok(beforeUser.id === afterUser.id);
});

test("dashboard statistics come from the database and are internally consistent", async () => {
  const res = await superAdmin.request("/api/admin/dashboard");
  assert.equal(res.status, 200);
  const payload = await res.json();
  const { stats } = payload;
  const db = createClient({ url: `file:${databasePath}` });
  const total = Number((await db.execute("SELECT COUNT(*) AS n FROM users")).rows[0].n);
  const active = Number((await db.execute("SELECT COUNT(*) AS n FROM users WHERE is_active = 1")).rows[0].n);
  assert.equal(stats.total_users, total);
  assert.equal(stats.active_users, active);
  assert.equal(typeof stats.available_donors, "number");
  assert.equal(typeof stats.total_requests, "number");
  assert.equal(typeof stats.revenue_verified, "number");
  assert.equal(stats.revenue_verified, 0, "no payment was confirmed — revenue must be exactly 0, not a guess");
  assert.ok(Array.isArray(payload.recent_registrations));
});

test("admin pages render the dedicated shell — zero public navbar/footer — and the public site is intact", async () => {
  const admin = await superAdmin.request("/admin");
  assert.equal(admin.status, 200);
  const adminHtml = await admin.text();
  assert.ok(!adminHtml.includes('class="navbar'), "admin page must not render the public navbar");
  assert.ok(!adminHtml.includes("bo-ai-input"), "admin page must not render the public AI widget");
  assert.ok(!adminHtml.includes("site-footer"), "admin page must not render the public footer");
  assert.ok(adminHtml.includes("admin-topbar"), "dedicated admin chrome present");
  assert.ok(adminHtml.includes("Admin Team"), "admin sidebar exposes the admin team page");

  for (const path of ["/admin/admins", "/admin/roles", "/admin/audit-logs", "/admin/system", "/admin/profile", "/admin/notifications", "/admin/users", "/admin/settings", "/admin/integrations"]) {
    const page = await superAdmin.request(path);
    assert.equal(page.status, 200, `${path} renders`);
    const html = await page.text();
    assert.ok(!html.includes('class="navbar'), `${path} has no public navbar`);
    assert.ok(!html.includes("bo-ai-input"), `${path} has no public AI widget`);
  }

  const home = await superAdmin.request("/");
  const homeHtml = await home.text();
  assert.equal(home.status, 200);
  assert.ok(homeHtml.includes('class="navbar'), "public site keeps its navbar");
});

test("web admin route blocks public postback when signed out", async () => {
  const guest = makeClient();
  const res = await guest.request("/admin/admins");
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location") || "", /\/login/);
});
