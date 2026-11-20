// Production boot without a required variable must be LOUD: liveness goes red
// and names the missing variable (never its value). Own process & env.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "bloodferry-degraded-"));
Object.assign(process.env, {
  NODE_ENV: "production",
  LOG_LEVEL: "error",
  JWT_SECRET: "degraded-test-secret-32-characters-xxx",
  TURSO_DATABASE_URL: `file:${dir}/prod.db`,
  TURSO_AUTH_TOKEN: "test-auth-token",
  FRONTEND_URL: "", // deliberately missing
  SMS_PROVIDER: "disabled",
  SMTP_ENABLED: "0",
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

test("missing FRONTEND_URL degrades /health to 503 and names the variable only", async () => {
  const res = await fetch(base + "/health");
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.status, "degraded");
  assert.deepEqual(body.missing, ["FRONTEND_URL"]);
  assert.ok(
    !JSON.stringify(body).includes("degraded-test-secret"),
    "no secret material in probe",
  );
});
