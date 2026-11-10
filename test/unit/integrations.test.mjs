import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBangladeshPhone, bangladeshPhoneDigits, bangladeshPhoneLocal } from "../../src/integrations/sms/phone.ts";
import { smsTemplateService } from "../../src/services/smsTemplate.service.ts";
import { layout } from "../../src/services/email.service.ts";
import { csrfProtection } from "../../src/middleware/csrf.ts";

for (const [input, expected] of [
  ["01712345678", "+8801712345678"],
  ["+880 1712-345678", "+8801712345678"],
  ["008801712345678", "+8801712345678"],
  ["1712345678", "+8801712345678"],
]) test(`Bangladesh phone normalization: ${input}`, () => {
  assert.equal(normalizeBangladeshPhone(input), expected);
  assert.equal(bangladeshPhoneDigits(input), expected.slice(1));
  assert.equal(bangladeshPhoneLocal(input), `0${expected.slice(4)}`);
});

for (const input of ["+14155550123", "01123456789", "017123", "0171234567a", null, undefined]) {
  test(`invalid/non-Bangladesh phone is rejected: ${String(input)}`, () => assert.equal(normalizeBangladeshPhone(input), null));
}

test("SMS templates localize, remove placeholders/newlines, and bound paid message length", () => {
  assert.match(smsTemplateService.render("otp", { code: "123456", minutes: 10 }, "en"), /123456/);
  assert.match(smsTemplateService.render("otp", { code: "123456", minutes: 10 }, "bn"), /যাচাইকরণ/);
  assert.match(smsTemplateService.render("otp", { code: "123456", minutes: 10 }, "ar"), /رمز/);
  const rendered = smsTemplateService.render("security", { detail: `hello\r\nBcc: victim${"x".repeat(600)}` }, "en");
  assert.ok(!/[\r\n]/.test(rendered));
  assert.ok(!rendered.includes("{detail}"));
  assert.ok(rendered.length <= 480);
});

test("email layout escapes dynamic content and emits RTL Arabic", () => {
  const html = layout({
    lang: "ar",
    title: "<script>alert(1)</script>",
    paragraphs: ["safe"],
    table: [{ label: "Name", value: "<img src=x onerror=alert(1)>" }],
    cta: { href: "https://example.test/?a=1&b=2", label: "Open" },
  });
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("a=1&amp;b=2"));
});

function checkCSRF({ url = "/profile", method = "POST", cookie, authorization, origin, token = "session-token", supplied, contentType = "application/json" }) {
  const req = {
    originalUrl: url, method, body: {}, query: {},
    headers: { host: "bloodora.test", origin, cookie, authorization, "x-csrf-token": supplied, "content-type": contentType },
    session: { csrfToken: token },
    get(name) { return this.headers[name.toLowerCase()]; },
  };
  const res = { locals: {}, getHeader() { return "application/json"; }, send() {} };
  let error = "not-called";
  csrfProtection(req, res, (value) => { error = value || null; });
  return error;
}

test("CSRF rejects missing/invalid tokens and cross-origin cookie requests", () => {
  assert.equal(checkCSRF({ cookie: "connect.sid=abc", origin: "https://bloodora.test", supplied: "wrong" })?.code, "CSRF_TOKEN_INVALID");
  assert.equal(checkCSRF({ cookie: "connect.sid=abc", origin: "https://evil.test", supplied: "session-token" })?.code, "CSRF_ORIGIN_REJECTED");
  assert.equal(checkCSRF({ url: "/api/auth/phone/request", cookie: "connect.sid=abc", origin: "https://bloodora.test" })?.code, "CSRF_TOKEN_INVALID");
});

test("CSRF accepts same-origin tokens and does not burden stateless/bearer API clients", () => {
  assert.equal(checkCSRF({ origin: "https://bloodora.test", supplied: "session-token" }), null);
  assert.equal(checkCSRF({ url: "/api/meta/home", method: "GET", cookie: "connect.sid=abc" }), null);
  assert.equal(checkCSRF({ url: "/api/auth/login" }), null);
  assert.equal(checkCSRF({ url: "/api/auth/logout", authorization: "Bearer explicit-token" }), null);
});

test("multipart forms require same-origin proof even before Multer parses their token", () => {
  assert.equal(checkCSRF({ cookie: "connect.sid=abc", origin: "https://bloodora.test", contentType: "multipart/form-data; boundary=x" }), null);
  assert.equal(checkCSRF({ cookie: "connect.sid=abc", origin: "https://evil.test", contentType: "multipart/form-data; boundary=x" })?.code, "CSRF_ORIGIN_REJECTED");
});
