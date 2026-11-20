import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "bloodferry-institutions-"));
Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "error",
  JWT_SECRET: "isolated-institution-test-secret-not-production",
  TURSO_DATABASE_URL: `file:${dir}/test.db`,
  TURSO_AUTH_TOKEN: "",
  SMS_PROVIDER: "disabled",
  SMTP_ENABLED: "0",
  RESEND_API_KEY: "",
  AI_API_KEY: "",
  GROQ_API_KEY: "",
});
const { default: createApp } = await import("../../src/application.ts");
const { get, run } = await import("../../src/db/query.ts");
const { closeClient } = await import("../../src/db/client.ts");
const { applySchema } = await import("../../src/db/schema.ts");
let server, base, admin, owner, manager, outsider, institution, hospital;
async function api(method, url, body, token) {
  const r = await fetch(base + url, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const input = {
  name: "Test Blood Volunteers",
  description: "Isolated test institution",
  district: "Rajshahi",
  address: "Test address in Rajshahi",
  contact_email: "private-office@example.test",
  contact_phone: "01712345678",
  publish_contact: false,
  request_key: "organization-create-1",
};
const blood = {
  patient_name: "Patient",
  blood_group: "O+",
  hospital_name: "Untrusted hospital label",
  contact_person: "Test contact",
  contact_phone: "01712345678",
  needed_by: "2030-01-01",
  division: "Rajshahi",
  district: "Rajshahi",
  upazila: "Shibganj",
};
before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const users = [];
  for (const name of ["Administrator", "Institution owner", "Manager", "Outsider"]) {
    const r = await api("POST", "/api/auth/register", {
      name,
      email: name.replaceAll(" ", "") + "@example.test",
      password: "TestPassword123!",
      phone: "01712345678",
      age: "30",
      blood_group: "O+",
    });
    assert.equal(r.status, 201);
    users.push(r.data);
  }
  [admin, owner, manager, outsider] = users;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeClient();
  rmSync(dir, { recursive: true, force: true });
});
test("institution application requires authentication and rejects overposting", async () => {
  assert.equal((await api("POST", "/api/organizations", input)).status, 401);
  assert.equal((await api("POST", "/api/organizations", { ...input, status: "approved" }, owner.token)).status, 400);
  assert.equal(
    (await api("POST", "/api/organizations", { ...input, contact_phone: "invalid" }, owner.token)).status,
    400,
  );
});
test("application creates one pending entity and owner membership atomically", async () => {
  const r = await api("POST", "/api/organizations", input, owner.token);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  institution = r.data.institution;
  assert.equal(institution.status, "pending");
  assert.equal(institution.version, 1);
  assert.equal(institution.request_fingerprint, undefined);
  assert.equal(
    (
      await get("SELECT role FROM organization_members WHERE organization_id=? AND user_id=?", [
        institution.id,
        owner.user.id,
      ])
    ).role,
    "owner",
  );
  assert.equal((await api("POST", "/api/organizations", input, owner.token)).data.institution.id, institution.id);
  assert.equal((await api("POST", "/api/organizations", { ...input, name: "Conflicting" }, owner.token)).status, 409);
  assert.equal((await get("SELECT COUNT(*) AS n FROM organizations")).n, 1);
});
test("pending directory entries and contacts are not public; ownership is server-enforced", async () => {
  assert.equal((await api("GET", "/api/organizations")).data.pagination.total, 0);
  assert.equal((await api("GET", `/api/organizations/${institution.id}`)).status, 404);
  assert.equal((await api("GET", "/api/organizations/mine", null, owner.token)).data.institutions.length, 1);
  assert.equal((await api("GET", "/api/organizations/mine", null, outsider.token)).data.institutions.length, 0);
  assert.equal(
    (await api("PATCH", `/api/organizations/${institution.id}`, { version: 1, name: "Hijacked" }, outsider.token))
      .status,
    403,
  );
  assert.equal((await api("GET", "/api/admin/organizations", null, owner.token)).status, 403);
  const adminList = await api("GET", "/api/admin/organizations?status=pending", null, admin.token);
  assert.equal(adminList.status, 200);
  assert.equal(adminList.data.pagination.total, 1);
});
test("only independent authorized reviewers can approve institutions", async () => {
  const review = { version: 1, status: "approved", note: "Test documents reviewed" };
  assert.equal((await api("POST", `/api/organizations/${institution.id}/review`, review, owner.token)).status, 403);
  const r = await api("POST", `/api/admin/organizations/${institution.id}/review`, review, admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  institution = r.data.institution;
  assert.equal(institution.status, "approved");
  assert.equal(institution.version, 2);
  const publicRow = (await api("GET", `/api/organizations/${institution.id}`)).data.institution;
  assert.equal(publicRow.contact_email, undefined);
  assert.equal(publicRow.contact_phone, undefined);
  assert.equal(publicRow.review_note, undefined);
  assert.equal((await api("GET", "/api/organizations?district=Rajshahi&limit=1&sort=newest")).data.pagination.total, 1);
  assert.equal((await api("GET", "/api/organizations?limit=1000")).status, 400);
  assert.equal((await api("GET", "/api/organizations?sort=name%3BDROP%20TABLE%20users")).status, 400);
  const ownApp = await api(
    "POST",
    "/api/hospitals",
    { ...input, name: "Review conflict hospital", request_key: "admin-owned-hospital" },
    admin.token,
  );
  assert.equal(
    (await api("POST", `/api/hospitals/${ownApp.data.institution.id}/review`, review, admin.token)).status,
    403,
  );
});
test("scoped manager membership never grants global admin access and stale versions are rejected", async () => {
  const r = await api(
    "PUT",
    `/api/organizations/${institution.id}/members`,
    { version: 2, user_id: manager.user.id, role: "manager", active: true },
    owner.token,
  );
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await api("GET", "/api/auth/me", null, manager.token)).data.user.is_admin, false);
  assert.equal((await api("GET", "/api/admin/dashboard", null, manager.token)).status, 403);
  assert.equal(
    (
      await api(
        "PUT",
        `/api/organizations/${institution.id}/members`,
        { version: 3, user_id: outsider.user.id, role: "owner", active: true },
        manager.token,
      )
    ).status,
    403,
  );
  assert.equal(
    (await api("PATCH", `/api/organizations/${institution.id}`, { version: 2, description: "Stale" }, owner.token))
      .status,
    409,
  );
  const edit = await api(
    "PATCH",
    `/api/organizations/${institution.id}`,
    { version: 3, description: "Manager edit" },
    manager.token,
  );
  assert.equal(edit.status, 200);
  institution = edit.data.institution;
  assert.equal(institution.status, "approved");
  const members = await api("GET", `/api/organizations/${institution.id}/members`, null, manager.token);
  assert.equal(members.status, 200);
  assert.equal(members.data.members.length, 2);
  assert.ok(members.data.members.every((m) => m.email === undefined && m.phone === undefined));
});
test("last owner protected; revoked membership immediately loses institutional write access", async () => {
  assert.equal(
    (
      await api(
        "PUT",
        `/api/organizations/${institution.id}/members`,
        { version: institution.version, user_id: owner.user.id, role: "owner", active: false },
        admin.token,
      )
    ).status,
    409,
  );
  const r = await api(
    "PUT",
    `/api/organizations/${institution.id}/members`,
    { version: institution.version, user_id: manager.user.id, role: "manager", active: false },
    owner.token,
  );
  assert.equal(r.status, 200);
  institution.version = r.data.membership.version;
  assert.equal(
    (
      await api(
        "PATCH",
        `/api/organizations/${institution.id}`,
        { version: institution.version, description: "After revocation" },
        manager.token,
      )
    ).status,
    403,
  );
  assert.equal((await api("GET", "/api/organizations/mine", null, manager.token)).data.institutions.length, 0);
});
test("identity edits require renewed review; suspended institutions cannot submit requests", async () => {
  let r = await api(
    "PATCH",
    `/api/organizations/${institution.id}`,
    { version: institution.version, name: "Changed legal name" },
    owner.token,
  );
  assert.equal(r.status, 200);
  institution = r.data.institution;
  assert.equal(institution.status, "pending");
  assert.equal((await api("POST", `/api/organizations/${institution.id}/requests`, blood, owner.token)).status, 409);
  r = await api(
    "POST",
    `/api/organizations/${institution.id}/review`,
    { version: institution.version, status: "approved", note: "Rechecked" },
    admin.token,
  );
  assert.equal(r.status, 200);
  institution = r.data.institution;
  r = await api(
    "POST",
    `/api/organizations/${institution.id}/review`,
    { version: institution.version, status: "suspended", note: "Test suspension" },
    admin.token,
  );
  assert.equal(r.status, 200);
  institution = r.data.institution;
  assert.equal((await api("GET", `/api/organizations/${institution.id}`)).status, 404);
  assert.equal(
    (await api("POST", "/api/blood-requests", { ...blood, institution_id: institution.id }, owner.token)).status,
    409,
  );
});
test("hospital requests are linked to the registry and cannot be forged through generic routes", async () => {
  let r = await api(
    "POST",
    "/api/hospitals",
    { ...input, name: "Verified Test Hospital", request_key: "hospital-create-1", publish_contact: true },
    owner.token,
  );
  assert.equal(r.status, 201);
  hospital = r.data.institution;
  assert.equal((await api("GET", `/api/organizations/${hospital.id}`, null, owner.token)).status, 404);
  r = await api(
    "POST",
    `/api/hospitals/${hospital.id}/review`,
    { version: 1, status: "approved", note: "Hospital reviewed" },
    admin.token,
  );
  assert.equal(r.status, 200);
  hospital = r.data.institution;
  assert.equal(
    (await api("POST", "/api/blood-requests", { ...blood, institution_id: hospital.id }, outsider.token)).status,
    403,
  );
  r = await api("POST", `/api/hospitals/${hospital.id}/requests`, blood, owner.token);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const stored = await get("SELECT * FROM blood_requests WHERE id=?", [r.data.id]);
  assert.equal(stored.institution_id, hospital.id);
  assert.equal(stored.hospital_name, "Verified Test Hospital");
  assert.equal((await api("GET", `/api/hospitals/${hospital.id}/requests`, null, owner.token)).data.requests.length, 1);
  assert.equal((await api("GET", `/api/hospitals/${hospital.id}/requests`, null, outsider.token)).status, 404);
  const publicRow = (await api("GET", `/api/hospitals/${hospital.id}`)).data.institution;
  assert.equal(publicRow.contact_email, input.contact_email);
});
test("volunteers have entity-scoped read access only, without member roster or mutations", async () => {
  const r = await api(
    "PUT",
    `/api/hospitals/${hospital.id}/members`,
    { version: hospital.version, user_id: manager.user.id, role: "volunteer", active: true },
    owner.token,
  );
  assert.equal(r.status, 200);
  hospital.version = r.data.membership.version;
  assert.equal((await api("GET", "/api/hospitals/mine", null, manager.token)).data.institutions.length, 1);
  assert.equal((await api("GET", `/api/hospitals/${hospital.id}/members`, null, manager.token)).status, 404);
  assert.equal((await api("POST", `/api/hospitals/${hospital.id}/requests`, blood, manager.token)).status, 404);
  assert.equal(
    (
      await api(
        "PATCH",
        `/api/hospitals/${hospital.id}`,
        { version: hospital.version, description: "Unauthorized" },
        manager.token,
      )
    ).status,
    403,
  );
});
test("migration replay preserves entities, memberships and audit/notification evidence", async () => {
  const count = await get("SELECT COUNT(*) AS n FROM organizations");
  await applySchema();
  await applySchema();
  assert.deepEqual(await get("SELECT COUNT(*) AS n FROM organizations"), count);
  assert.ok(await get("SELECT id FROM audit_logs WHERE action='institution.review' AND entity_id=?", [hospital.id]));
  assert.ok(await get("SELECT id FROM notifications WHERE user_id=? AND entity_id=?", [owner.user.id, hospital.id]));
  await assert.rejects(
    run("INSERT INTO organization_members VALUES (?, ?, ?, 1, ?, ?)", [
      hospital.id,
      "missing-user",
      "volunteer",
      new Date().toISOString(),
      new Date().toISOString(),
    ]),
  );
});
test("availability toggles never fabricate a completed donation date", async () => {
  const before = await get("SELECT last_donation FROM users WHERE id=?", [owner.user.id]);
  assert.equal((await api("POST", "/api/users/me/toggle-status", {}, owner.token)).status, 200);
  assert.equal((await api("POST", "/api/users/me/toggle-status", {}, owner.token)).status, 200);
  assert.deepEqual(await get("SELECT last_donation FROM users WHERE id=?", [owner.user.id]), before);
});
test("domain account roles do not grant administrator flags or institutional membership", async () => {
  for (const role of ["donor", "recipient", "volunteer", "organization", "hospital"]) {
    const r = await api("POST", `/api/admin/users/${outsider.user.id}/role`, { role }, admin.token);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.user.is_admin, false);
    const login = await api("POST", "/api/auth/login", {
      email: "Outsider@example.test",
      password: "TestPassword123!",
    });
    assert.equal(login.status, 200);
    outsider = login.data;
    assert.equal((await api("GET", "/api/admin/dashboard", null, outsider.token)).status, 403);
    assert.equal((await api("GET", "/api/hospitals/mine", null, outsider.token)).data.institutions.length, 0);
    assert.equal(
      (await api("POST", "/api/blood-requests", { ...blood, institution_id: hospital.id }, outsider.token)).status,
      403,
    );
  }
});
test("mail operators cannot read reset tokens from queue APIs; delivery body remains stored", async () => {
  const { outboxRepo } = await import("../../src/repos/outbox.repo.ts");
  const id = await outboxRepo.enqueue({
    to: "fixture@example.test",
    subject: "Password reset",
    html: '<a href="https://example.test/?token=PRIVATE_RESET_FIXTURE">Reset</a>',
    text: "token=PRIVATE_RESET_FIXTURE",
    dedupeKey: "secret-mail-fixture",
  });
  const r = await api("GET", "/api/admin/mail/outbox", null, admin.token);
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(r.data).includes("PRIVATE_RESET_FIXTURE"));
  assert.ok((await get("SELECT text FROM email_outbox WHERE id=?", [id])).text.includes("PRIVATE_RESET_FIXTURE"));
});
test("SMS deduplication never reports failed or unconfirmed sends as successful (no live provider)", async () => {
  const { config } = await import("../../src/config/env.ts");
  const { smsService } = await import("../../src/services/sms.service.ts");
  const { smsDeliveryRepo } = await import("../../src/repos/smsDelivery.repo.ts");
  const { getSMSProvider } = await import("../../src/integrations/sms/index.ts");
  const saved = { ...config.sms };
  Object.assign(config.sms, { provider: "greenweb", apiKey: "test-only-key" });
  const provider = getSMSProvider(),
    send = provider.send;
  let calls = 0;
  provider.send = async () => {
    calls++;
    throw new Error("Unexpected network send");
  };
  try {
    await smsDeliveryRepo.create({
      id: "existing-sms-fixture",
      to: "+8801712345678",
      template: "security",
      provider: "greenweb",
      cost: 0,
      currency: "BDT",
      dedupeKey: "sms-fixture",
    });
    const input = { to: "01712345678", body: "Fixture", template: "security", dedupeKey: "sms-fixture" };
    let r = await smsService.send(input);
    assert.equal(r.success, false);
    assert.equal(r.code, "SMS_DELIVERY_UNCONFIRMED");
    await smsDeliveryRepo.markFailed("existing-sms-fixture", "SMS_REJECTED");
    r = await smsService.send(input);
    assert.equal(r.success, false);
    assert.equal(r.code, "SMS_PREVIOUS_FAILED");
    await smsDeliveryRepo.markSent("existing-sms-fixture", "provider-fixture-id");
    r = await smsService.send(input);
    assert.equal(r.success, true);
    assert.equal(r.id, "existing-sms-fixture");
    assert.equal(r.providerMessageId, "provider-fixture-id");
    assert.equal(calls, 0);
  } finally {
    provider.send = send;
    Object.assign(config.sms, saved);
  }
});
test("admin user updates reject privilege escalation and invalid passwords before writing", async () => {
  let r = await api(
    "POST",
    "/api/admin/roles",
    { key: "profile_editor", name: "Profile editor", permissions: ["users.manage"] },
    admin.token,
  );
  assert.equal(r.status, 200);
  r = await api("POST", `/api/admin/users/${manager.user.id}/role`, { role: "profile_editor" }, admin.token);
  assert.equal(r.status, 200);
  const login = await api("POST", "/api/auth/login", { email: "Manager@example.test", password: "TestPassword123!" });
  assert.equal(login.status, 200);
  manager = login.data;
  const before = await get("SELECT name,is_admin,password_hash FROM users WHERE id=?", [owner.user.id]);
  assert.equal(
    (await api("POST", `/api/admin/user/update/${owner.user.id}`, { name: "Escalated", is_admin: true }, manager.token))
      .status,
    403,
  );
  assert.equal(
    (
      await api(
        "POST",
        `/api/admin/user/update/${owner.user.id}`,
        { name: "Should not persist", new_password: "short" },
        admin.token,
      )
    ).status,
    400,
  );
  assert.deepEqual(await get("SELECT name,is_admin,password_hash FROM users WHERE id=?", [owner.user.id]), before);
  assert.equal(
    (
      await api(
        "POST",
        `/api/admin/user/update/${owner.user.id}`,
        { name: "Updated owner", is_admin: "0", is_verified: "false" },
        manager.token,
      )
    ).status,
    200,
  );
  const updated = await get("SELECT name,is_admin,is_verified FROM users WHERE id=?", [owner.user.id]);
  assert.equal(updated.is_admin, 0);
  assert.equal(updated.is_verified, 0);
  assert.equal(updated.name, "Updated owner");
});
test("donation administration uses real filtered pagination and personal dashboard aggregates", async () => {
  const body = {
    donor_id: owner.user.id,
    donated_at: "2026-01-01",
    blood_group: "O+",
    units: 1,
    request_idempotency_key: "institution-donation-fixture",
  };
  assert.equal((await api("POST", "/api/admin/donations", body, outsider.token)).status, 403);
  assert.equal((await api("POST", "/api/admin/donations", body, admin.token)).status, 200);
  const rows = await api("GET", `/api/admin/donations?donor_id=${owner.user.id}&limit=1`, null, admin.token);
  assert.equal(rows.status, 200);
  assert.equal(rows.data.pagination.total, 1);
  assert.equal(rows.data.donations.length, 1);
  assert.equal((await api("GET", "/api/admin/donations", null, outsider.token)).status, 403);
  assert.equal((await api("GET", "/api/admin/donations?limit=-1", null, admin.token)).status, 400);
  const home = await api("GET", "/api/user/dashboard", null, owner.token);
  assert.equal(home.status, 200);
  assert.equal(home.data.donation.records.total, 1);
  assert.equal(home.data.donation.history.length, 1);
});
test('delivery profile admin APIs enforce permissions, encrypt credentials and maintain one default',async()=>{
  const {deliveryProfileService}=await import('../../src/services/deliveryProfile.service.ts');
  const fixture={kind:'email',label:'Fixture sender',provider:'resend',api_key:'re_private_fixture_key_never_live',sender_email:'sender@example.test',sender_name:'Fixture'};
  assert.equal((await api('POST','/api/admin/delivery-profiles',fixture,outsider.token)).status,403);
  assert.equal((await api('POST','/api/admin/delivery-profiles',{...fixture,provider:'greenweb'},admin.token)).status,400);
  const a=await api('POST','/api/admin/delivery-profiles',fixture,admin.token);assert.equal(a.status,201);
  const b=await api('POST','/api/admin/delivery-profiles',{...fixture,label:'Second sender',sender_email:'second@example.test'},admin.token);assert.equal(b.status,201);
  const stored=await get('SELECT * FROM delivery_profiles WHERE id=?',[a.data.id]);assert.ok(!JSON.stringify(stored).includes(fixture.api_key));
  assert.equal((await deliveryProfileService.resolve('email',a.data.id)).apiKey,fixture.api_key);
  assert.equal((await api('POST',`/api/admin/delivery-profiles/${a.data.id}/activate`,{},admin.token)).status,200);
  assert.equal((await api('POST',`/api/admin/delivery-profiles/${b.data.id}/activate`,{},admin.token)).status,200);
  const list=await api('GET','/api/admin/delivery-profiles',null,admin.token);assert.equal(list.status,200);
  assert.equal(list.data.profiles.filter(p=>p.kind==='email'&&p.is_default).length,1);
  assert.ok(!JSON.stringify(list.data).includes('secret'));assert.ok(!JSON.stringify(list.data).includes(fixture.api_key));
  const {outboxRepo}=await import('../../src/repos/outbox.repo.ts');
  const id=await outboxRepo.enqueue({to:'recipient@example.test',subject:'Pinned',html:'Fixture',profileId:a.data.id});
  const [row]=await outboxRepo.claimNext(1,id);assert.equal(row.profile_id,a.data.id);
  await outboxRepo.markSent(id,row.claim_token);
  assert.equal((await api('POST','/api/admin/sms/send',{to:'01712345678',body:'Fixture',request_key:'manual-test-ref'},outsider.token)).status,403);
  assert.equal((await api('POST','/api/admin/sms/send',{to:'01712345678',body:'Fixture'},admin.token)).status,400);
  await run('UPDATE delivery_profiles SET is_default=0');
});
test('Groq configuration preserves zero temperature and treats string zero as disabled',async()=>{
  const {aiService}=await import('../../src/services/ai.service.ts');
  // Existing authorized configuration route; no provider request or real key.
  const r=await api('POST','/api/admin/ai/config',{ai_enabled:'0',ai_provider:'groq',ai_base_url:'https://api.groq.com/openai/v1',ai_model:'llama-3.3-70b-versatile',ai_temperature:0},admin.token);
  assert.equal(r.status,200);const cfg=await aiService.getConfig();assert.equal(cfg.enabled,0);assert.equal(cfg.temperature,0);assert.equal(cfg.provider,'groq');
});
