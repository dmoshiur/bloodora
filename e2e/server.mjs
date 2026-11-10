import { rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import https from "node:https";

const db = `/tmp/bloodora-browser-${process.pid}.db`;
for (const suffix of ["", "-wal", "-shm"]) rmSync(db + suffix, { force: true });
Object.assign(process.env, {
  NODE_ENV: "production",
  PORT: "4599",
  LOG_LEVEL: "error",
  JWT_SECRET: "browser-test-only-secret-not-for-production",
  TURSO_DATABASE_URL: `file:${db}`,
  // Production config requires a token; file-backed libSQL does not use it.
  TURSO_AUTH_TOKEN: "browser-test-only-unused-token",
  FRONTEND_URL: "https://localhost:4599",
  COOKIE_SECURE: "1",
  SMS_PROVIDER: "disabled",
  RESEND_API_KEY: "",
  SMTP_ENABLED: "0",
});

const [{ default: createApp }, { bootstrapDatabase }, { authService }, { userRepo }] = await Promise.all([
  import("../src/app.ts"),
  import("../src/db/init.ts"),
  import("../src/services/auth.service.ts"),
  import("../src/repos/user.repo.ts"),
]);
await bootstrapDatabase();
for (const [email, name] of [["superadmin@example.test", "Browser superadmin"], ["admin@example.test", "Browser admin"], ["user@example.test", "Browser user"]]) {
  await authService.register({ email, name, password: "test-only-password", phone: "01700000000", age: 30, bloodGroup: "O+", donationRole: "Both" });
}
const admin = await userRepo.findByEmail("admin@example.test");
await userRepo.setRole(admin.id, "admin", true);
const app = createApp();
const keyPath = `/tmp/bloodora-browser-${process.pid}.key`;
const certPath = `/tmp/bloodora-browser-${process.pid}.crt`;
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-keyout", keyPath, "-out", certPath], { stdio: "ignore" });
const server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, app);
server.listen(4599, "0.0.0.0", () => console.log("Unified HTTPS browser-test server listening on 4599"));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(db + suffix, { force: true });
  rmSync(keyPath, { force: true });
  rmSync(certPath, { force: true });
  process.exit(0);
}));
