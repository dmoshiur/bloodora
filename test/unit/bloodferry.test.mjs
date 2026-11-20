import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir = mkdtempSync(path.join(tmpdir(), 'bloodferry-regression-'));
Object.assign(process.env, { NODE_ENV: 'test', LOG_LEVEL: 'error', JWT_SECRET: 'isolated-test-signing-secret-never-deploy', TURSO_DATABASE_URL: `file:${dir}/test.db`, TURSO_AUTH_TOKEN: '', SMS_PROVIDER: 'disabled', SMTP_ENABLED: '0', RESEND_API_KEY: '', AI_API_KEY: '', GROQ_API_KEY: '' });
const { default: createApp } = await import('../../src/application.ts');
const { run, get } = await import('../../src/db/query.ts');
const { closeClient } = await import('../../src/db/client.ts');
const { aiService } = await import('../../src/services/ai.service.ts');
const { aiConversationRepo } = await import('../../src/repos/aiConversation.repo.ts');
const { aiMessageRepo } = await import('../../src/repos/aiMessage.repo.ts');
const { applySchema } = await import('../../src/db/schema.ts');
let server, base, admin, alice, bob;
async function api(method, url, body, token) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {}) }, ...(body ? {body: JSON.stringify(body)} : {}) });
  return {status: res.status, data: await res.json()};
}
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const name of ['Admin', 'Alice', 'Bobby']) {
    const r = await api('POST', '/api/auth/register', { name, email: `${name}@example.test`, password: 'TestPassword123!', phone: '01712345678', blood_group: 'O+', age: '30' });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.is_verified, false, 'self-reported age is not donor verification');
    if (name === 'Admin') admin = r.data;
    else if (name === 'Alice') alice = r.data;
    else bob = r.data;
  }
});
after(async () => { await new Promise(resolve => server.close(resolve)); closeClient(); rmSync(dir, {recursive:true, force:true}); });

test('public metadata never discloses configured provider secrets', async () => {
  await run("INSERT OR REPLACE INTO settings VALUES ('ai_api_key', 'TEST_SECRET_NOT_REAL')");
  await run("INSERT OR REPLACE INTO settings VALUES ('smtp_pass', 'TEST_SMTP_NOT_REAL')");
  for (const url of ['/api/meta/settings','/api/meta/home','/api/meta']) {
    const r = await api('GET', url); assert.equal(r.status,200);
    assert.ok(!JSON.stringify(r.data).includes('TEST_SECRET_NOT_REAL'));
    assert.ok(!JSON.stringify(r.data).includes('TEST_SMTP_NOT_REAL'));
  }
});
test('public activity excludes private message subjects and administrative activity', async () => {
  const {activityRepo} = await import('../../src/repos/activity.repo.ts');
  await activityRepo.create('message',alice.user.id,'PRIVATE_SUBJECT_DO_NOT_PUBLISH');
  const r = await api('GET','/api/meta/activity');
  assert.ok(!JSON.stringify(r.data).includes('PRIVATE_SUBJECT_DO_NOT_PUBLISH'));
});
test('private messages reject unrelated read, original and reply requests', async () => {
  const sent = await api('POST','/api/messages',{subject:'Private',content:'Confidential',recipient_email:'Bobby@example.test'},alice.token);
  assert.equal(sent.status,200);
  for (const suffix of ['', '/original']) assert.equal((await api('GET',`/api/messages/${sent.data.id}${suffix}`,null,admin.token)).status,404);
  assert.equal((await api('POST',`/api/messages/${sent.data.id}/reply`,{content:'Intrusion'},admin.token)).status,404);
  assert.equal((await api('GET',`/api/messages/${sent.data.id}`,null,bob.token)).status,200);
});
test('public donor profile omits identity, contact and financial data', async () => {
  await run('UPDATE users SET birth_certificate_number = ?, bkash_number = ? WHERE id = ?', ['private-id','01799999999', alice.user.id]);
  const r = await api('GET',`/api/users/${alice.user.id}`);
  assert.equal(r.status,200); const text = JSON.stringify(r.data);
  for (const secret of ['private-id','01799999999','Alice@example.test']) assert.ok(!text.includes(secret));
  assert.equal(r.data.user.phone,'');
});
test('anonymous urgent contact is persisted in the real admin inbox', async () => {
  assert.equal((await api('POST','/api/blood-requests/urgent-contact',{message:'Regression urgent contact',email:'guest@example.test'})).status,200);
  assert.ok(await get("SELECT id FROM messages WHERE recipient_id = 'admin' AND body LIKE '%Regression urgent contact%'"));
});
test('request approval, ownership, terminal transitions and notifications are durable', async () => {
  const body = {patient_name:'Patient', blood_group:'O+', hospital_name:'Hospital', contact_person:'Alice', contact_phone:'01712345678', needed_by:'2030-01-01', division:'Rajshahi',district:'Rajshahi',upazila:'Shibganj'};
  assert.equal((await api('POST','/api/blood-requests',{...body,needed_by:'invalid'},alice.token)).status,400);
  assert.equal((await api('POST','/api/blood-requests',body,alice.token)).status,200);
  const mine = await api('GET','/api/blood-requests/mine',null,alice.token);
  const id = mine.data.requests[0].id;
  assert.equal((await api('PATCH',`/api/admin/blood-requests/${id}/status`,{status:'confirmed'},bob.token)).status,403);
  assert.equal((await api('PATCH',`/api/admin/blood-requests/${id}/status`,{status:'confirmed'},admin.token)).status,200);
  assert.equal((await api('POST',`/api/blood-requests/${id}/fulfill`,{},bob.token)).status,403);
  assert.equal((await api('POST',`/api/blood-requests/${id}/cancel`,{},alice.token)).status,200);
  const row = await get('SELECT * FROM blood_requests WHERE id = ?', [id]);
  assert.equal(row.status,'cancelled'); assert.equal(row.is_fulfilled,0);
  assert.equal((await api('PATCH',`/api/admin/blood-requests/${id}/status`,{status:'fulfilled'},admin.token)).status,409);
  assert.ok(await get("SELECT id FROM notifications WHERE user_id = ? AND dedupe_key = ?", [alice.user.id, `blood:${id}:cancelled`]));
});
test('AI provider contract, durable history, idempotency and ownership (mock provider, NOT live verification)', async () => {
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      calls++; assert.ok(options.headers.Authorization);
      return new Response(JSON.stringify({model:'fixture', choices:[{message:{content:'<think>private reasoning</think>Use the blood request page.'}}],usage:{total_tokens:20}}),{status:200});
    }
    return originalFetch(url,options);
  };
  try {
    const body = {message:'How do I request blood?',conversation_id:'regression-chat',request_id:'turn-1',user_id:bob.user.id};
    const r = await api('POST','/api/ai/chat',body,alice.token);
    assert.equal(r.status,200,JSON.stringify(r.data)); assert.ok(!r.data.reply.includes('reasoning'));
    assert.equal((await api('POST','/api/ai/chat',body,alice.token)).data.reply,r.data.reply);
    assert.equal(calls,1);
    assert.equal((await api('POST','/api/ai/chat',{...body,message:'different'},alice.token)).status,409);
    assert.equal((await api('POST','/api/ai/chat',{...body,request_id:'evil'},bob.token)).status,404);
    assert.equal((await api('GET','/api/ai/conversations/regression-chat/messages',null,bob.token)).status,404);
    const history = await api('GET','/api/ai/conversations/regression-chat/messages',null,alice.token);
    assert.equal(history.status,200); assert.equal(history.data.messages.length,2);
    assert.ok(history.data.messages.every(m=>m.user_id===alice.user.id));
    assert.equal((await api('GET','/api/ai/conversations',null,alice.token)).data.conversations.length,1);
    await api('POST','/api/ai/chat',{...body,conversation_id:'second-chat',request_id:'second'},alice.token);
    assert.equal((await api('GET','/api/ai/conversations',null,alice.token)).data.conversations.length,2);
  } finally { globalThis.fetch = originalFetch; }
});
test('AI history returns newest turns in chronological order and refuses legacy transcript takeover', async () => {
  for(let i=0;i<15;i++) await aiMessageRepo.add('legacy',alice.user.id,'user',String(i),null);
  assert.deepEqual((await aiMessageRepo.history('legacy',3)).map(m=>m.content),['12','13','14']);
  await assert.rejects(aiConversationRepo.ensure('legacy',`user:${alice.user.id}`,alice.user.id),{status:404});
});
test('AI disabled setting is enforced by legacy ask endpoint', async () => {
  await run("UPDATE settings SET value='0' WHERE key='ai_enabled'");
  assert.equal((await api('POST','/api/ai/ask',{question:'hello'},alice.token)).status,503);
  await run("UPDATE settings SET value='1' WHERE key='ai_enabled'");
});
test('migrations are idempotent and preserve account and conversation records', async () => {
  const before = await get('SELECT COUNT(*) AS n FROM users');
  await applySchema(); await applySchema();
  assert.deepEqual(await get('SELECT COUNT(*) AS n FROM users'),before);
  assert.equal((await aiMessageRepo.history('regression-chat')).length,2);
});
test('donation recording is authorized, transactional, idempotent and scoped', async () => {
  const body = {donor_id:alice.user.id, donated_at:'2026-01-01', blood_group:'O+',units:1,request_idempotency_key:'donation-fixture-1'};
  assert.equal((await api('POST','/api/donations',body,bob.token)).status,403);
  const r = await api('POST','/api/donations',body,admin.token); assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal((await api('POST','/api/donations',body,admin.token)).data.donation.id,r.data.donation.id);
  assert.equal((await api('POST','/api/donations',{...body,units:2},admin.token)).status,409);
  assert.equal((await api('GET','/api/donations/mine',null,alice.token)).data.donations.length,1);
  assert.equal((await api('GET','/api/donations/mine',null,bob.token)).data.donations.length,0);
  assert.equal((await get('SELECT can_donate FROM users WHERE id = ?', [alice.user.id])).can_donate,0);
  assert.ok(await get("SELECT id FROM audit_logs WHERE entity_type='donation' AND entity_id=?",[r.data.donation.id]));
});
test('revoking every built-in role grant does not silently restore defaults', async () => {
  const {rbacService,invalidatePermissionCache} = await import('../../src/services/rbac.service.ts');
  await run("DELETE FROM role_permissions WHERE role_key='user'"); invalidatePermissionCache();
  assert.deepEqual(await rbacService.permissionsForRole('user'),[]);
});
test('logout revokes bearer access' , async () => {
  assert.equal((await api('POST','/api/auth/logout',{},alice.token)).status,200);
  assert.equal((await api('GET','/api/auth/me',null,alice.token)).status,401);
});
