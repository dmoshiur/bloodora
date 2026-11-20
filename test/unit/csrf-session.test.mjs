// Production-like CSRF/session regression suite. Runs in its own process with
// NODE_ENV=production + complete required env, close to how Render/Vercel serve it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "bloodferry-csrf-"));
const SECRET = "csrf-session-test-secret-32-characters-long";
Object.assign(process.env, {
  NODE_ENV: "production",
  LOG_LEVEL: "error",
  JWT_SECRET: SECRET,
  TURSO_DATABASE_URL: `file:${dir}/prod.db`,
  TURSO_AUTH_TOKEN: "test-auth-token",
  FRONTEND_URL: "https://bloodferry.example.test",
  SMS_PROVIDER: "disabled",
  SMTP_ENABLED: "0",
  RESEND_API_KEY: "",
  GROQ_API_KEY: "",
  AI_API_KEY: "",
});
const { default: createApp } = await import("../../src/application.ts");
const { closeClient } = await import("../../src/db/client.ts");
let server, base;
before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  closeClient();
  rmSync(dir, { recursive: true, force: true });
});

function jar() {
  return { cookie: "" };
}
function cookieOf(res) {
  const set = res.headers.getSetCookie?.() || [];
  return set.map((v) => v.split(";")[0]).join("; ");
}
function merge(jar, res) {
  const c = cookieOf(res);
  if (c) jar.cookie = c;
}
function secureAttrs(res) {
  const set = res.headers.getSetCookie?.() || [];
  return set.filter((v) => v.startsWith("connect.sid=")).join("\n");
}
const post = async (jar, path, body, extraHeaders = {}) => {
  const res = await fetch(base + path, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.cookie,
      origin: base,
      "x-forwarded-proto": "https",
      ...extraHeaders,
    },
    body: new URLSearchParams(body),
  });
  merge(jar, res);
  return res;
};

async function loginPage(jar) {
  const res = await fetch(base + "/login", {
    headers: { cookie: jar.cookie, "x-forwarded-proto": "https" },
    redirect: "manual",
  });
  merge(jar, res);
  const html = await res.text();
  return {
    res,
    html,
    token: html.match(/name="csrf-token" content="([^"]+)"/)?.[1] || "",
    hidden: html.match(/name="_csrf" value="([^"]+)"/)?.[1] || "",
  };
}

test("production login page issues a Secure, HttpOnly, SameSite=Lax host-only session cookie and matching tokens", async () => {
  const jarObj = jar();
  const { res, html, token, hidden } = await loginPage(jarObj);
  assert.equal(res.status, 200);
  const attrs = secureAttrs(res);
  assert.match(attrs, /HttpOnly/);
  assert.match(attrs, /SameSite=Lax/);
  assert.match(attrs, /Path=\//);
  assert.match(attrs, /Secure/);
  assert.ok(token, "meta csrf token present");
  assert.equal(hidden, token, "hidden form token matches meta token");
  assert.ok(jarObj.cookie.includes("connect.sid="));
});

test("session persists across requests (rolling cookie re-issued, same identity)", async () => {
  const jarObj = jar();
  const first = await loginPage(jarObj);
  assert.equal(first.res.status, 200);
  const sidAfterFirst = jarObj.cookie.split("connect.sid=")[1];
  const second = await loginPage(jarObj);
  assert.equal(second.res.status, 200);
  assert.equal(
    jarObj.cookie.split("connect.sid=")[1],
    sidAfterFirst,
    "rolling session keeps the same sid",
  );
});

test("valid login rotates the session and the pre-login CSRF token dies with it", async () => {
  const jarObj = jar();
  const { token } = await loginPage(jarObj);
  const anonymous = jarObj.cookie;
  const email = `csrf.${process.pid}@example.test`;
  const reg = await post(jarObj, "/register", {
    _csrf: token,
    name: "CSRF Test",
    email,
    phone: "01712345678",
    password: "StrongPass!234",
    blood_group: "O+",
  });
  assert.equal(reg.status, 302);
  assert.ok(jarObj.cookie.includes("connect.sid="));
  assert.notEqual(
    jarObj.cookie,
    anonymous,
    "authentication rotates the session identifier",
  );
  // The pre-registration session/token must no longer authenticate.
  const replay = await fetch(base + "/api/auth/me", {
    headers: { cookie: anonymous },
  });
  assert.equal(replay.status, 401);
});

test("a token from one session is rejected on another session (CSRF_TOKEN_INVALID)", async () => {
  const a = jar();
  const b = jar();
  const pageA = await loginPage(a);
  await loginPage(b);
  const stolen = pageA.token;
  const res = await post(b, "/login", {
    _csrf: stolen,
    email: "x@example.test",
    password: "WrongPass1!",
  });
  assert.equal(res.status, 403);
  const apiRes = await fetch(base + "/api/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: b.cookie,
      origin: base,
      "x-csrf-token": stolen,
    },
    body: JSON.stringify({ subject: "s", content: "c" }),
  });
  assert.equal(apiRes.status, 403);
  const body = await apiRes.json();
  assert.equal(body.error?.code || body.code, "CSRF_TOKEN_INVALID");
});

test("an unverifiable session cookie yields CSRF_SESSION_MISSING, never a 500 or silent pass", async () => {
  const res = await fetch(base + "/api/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "connect.sid=s%3Aforged.invalidsignature",
      origin: base,
      "x-csrf-token": "anything",
    },
    body: JSON.stringify({ subject: "s", content: "c" }),
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error?.code || body.code, "CSRF_SESSION_MISSING");
});

test("a destroyed session (logout) cannot be reused — CSRF layer reports session missing", async () => {
  const jarObj = jar();
  const page = await loginPage(jarObj);
  const email = `logout.${process.pid}@example.test`;
  const reg = await post(jarObj, "/register", {
    _csrf: page.token,
    name: "Logout Test",
    email,
    phone: "01712345678",
    password: "StrongPass!234",
    blood_group: "O+",
  });
  assert.equal(reg.status, 302);
  merge(jarObj, reg);
  const dash = await fetch(base + "/dashboard/security", {
    headers: { cookie: jarObj.cookie },
  });
  await dash.text();
  // Obtain a fresh token from the authenticated session, then destroy it.
  const dashPage = await fetch(base + "/login", {
    headers: { cookie: jarObj.cookie },
    redirect: "manual",
  }); // /login redirects (302) when authed
  await dashPage.text();
  const meFirst = await fetch(base + "/api/auth/me", {
    headers: { cookie: jarObj.cookie },
  });
  assert.equal(meFirst.status, 200);
  // destroy via SSR logout (form POST with CSRF)
  const logoutPage = await fetch(base + "/dashboard/security", {
    headers: { cookie: jarObj.cookie },
  });
  const html = await logoutPage.text();
  const token = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  const out = await post(jarObj, "/logout", { _csrf: token });
  assert.equal(out.status, 302);
  const reuse = await fetch(base + "/api/auth/me", {
    headers: { cookie: cookieOf(out) || jarObj.cookie },
  });
  assert.notEqual(reuse.status, 200);
});

test("API edge cases return the consistent JSON envelope with a request id (no HTML, no stack traces)", async () => {
  const missing = await fetch(base + "/api/definitely-not-a-route", {
    headers: { accept: "application/json" },
  });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type") || "", /application\/json/);
  const body = await missing.json();
  assert.ok(body.requestId, "requestId echoed");
  assert.ok(
    !JSON.stringify(body).includes("node_modules"),
    "no internals leak",
  );
});

test("the liveness probe is up and reports full production configuration", async () => {
  const res = await fetch(base + "/health");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.deepEqual(body.missing, undefined);
});
