import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'bloodferry-outbox-'));
Object.assign(process.env,{NODE_ENV:'test',LOG_LEVEL:'error',JWT_SECRET:'isolated-outbox-secret',TURSO_DATABASE_URL:`file:${dir}/test.db`,TURSO_AUTH_TOKEN:'',SMTP_ENABLED:'0',RESEND_API_KEY:''});
const {applySchema}=await import('../../src/db/schema.ts');
const {run,get}=await import('../../src/db/query.ts');
const {closeClient}=await import('../../src/db/client.ts');
const {outboxRepo,MAX_ATTEMPTS}=await import('../../src/repos/outbox.repo.ts');
const {emailService}=await import('../../src/services/email.service.ts');
const {emailDeliveryService}=await import('../../src/services/emailDelivery.service.ts');
const {resendEmailProvider}=await import('../../src/integrations/email/resend.ts');
const {smtpService}=await import('../../src/services/smtp.service.ts');
const {config}=await import('../../src/config/env.ts');
before(async()=>{await applySchema();await applySchema();});
after(async()=>{await closeClient();rmSync(dir,{recursive:true,force:true});});
const enqueue=()=>outboxRepo.enqueue({to:'recipient@example.test',subject:'Fixture',html:'private token=secret'});

test('atomic claims reserve each row once across overlapping workers',async()=>{
  const id=await enqueue();
  const claims=await Promise.all(Array.from({length:8},()=>outboxRepo.claimNext(1,id)));
  assert.equal(claims.flat().length,1);
  const row=claims.flat()[0];assert.equal(row.attempts,1);assert.ok(row.claim_token);
  assert.equal(await outboxRepo.markSent(id,'forged-token'),false);
  assert.equal(await outboxRepo.markSent(id,row.claim_token,'provider-fixture'),true);
  assert.equal((await outboxRepo.claimNext(1,id)).length,0);
});
test('expired leases recover with fencing against stale worker acknowledgements',async()=>{
  const id=await enqueue();const [old]=await outboxRepo.claimNext(1,id);
  await run("UPDATE email_outbox SET lease_until='2000-01-01' WHERE id=?",[id]);
  const [fresh]=await outboxRepo.claimNext(1,id);
  assert.notEqual(fresh.claim_token,old.claim_token);assert.equal(fresh.attempts,2);
  assert.equal(await outboxRepo.markSent(id,old.claim_token),false);
  assert.equal(await outboxRepo.markFailed(old,'STALE_WORKER'),false);
  assert.equal(await outboxRepo.markSent(id,fresh.claim_token),true);
});
test('failed delivery backs off, sanitizes errors and stops after bounded attempts',async()=>{
  const id=await enqueue();
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
    const [row]=await outboxRepo.claimNext(1,id);assert.equal(row.attempts,attempt);
    assert.equal(await outboxRepo.markFailed(row,'https://provider.test?token=secret'),true);
    const stored=await get('SELECT * FROM email_outbox WHERE id=?',[id]);
    assert.equal(stored.last_error,'EMAIL_DELIVERY_FAILED');assert.ok(Date.parse(stored.next_attempt_at)>Date.now());
    assert.equal((await outboxRepo.claimNext(1,id)).length,0);
    await run("UPDATE email_outbox SET next_attempt_at='2000-01-01' WHERE id=?",[id]);
  }
  assert.equal((await get('SELECT status FROM email_outbox WHERE id=?',[id])).status,'failed');
  assert.equal((await outboxRepo.claimNext(1,id)).length,0);
});
test('crashed final worker is retained as unconfirmed failure, not retried forever',async()=>{
  const id=await enqueue();await run('UPDATE email_outbox SET attempts=? WHERE id=?',[MAX_ATTEMPTS-1,id]);
  await outboxRepo.claimNext(1,id);await run("UPDATE email_outbox SET lease_until='2000-01-01' WHERE id=?",[id]);
  assert.equal((await outboxRepo.claimNext(1,id)).length,0);
  const row=await get('SELECT * FROM email_outbox WHERE id=?',[id]);assert.equal(row.status,'failed');assert.match(row.last_error,/UNCONFIRMED/);
});
test('inline and overlapping flushes share reservations (controlled provider, no live mail)',async()=>{
  const originalStatus=emailDeliveryService.status,originalSend=emailDeliveryService.send;
  let sends=0,release,entered;
  const started=new Promise(resolve=>entered=resolve),blocked=new Promise(resolve=>release=resolve);
  emailDeliveryService.status=async()=>({configured:true,provider:'resend',from:'fixture@example.test'});
  emailDeliveryService.send=async message=>{sends++;assert.ok(message.idempotencyKey);entered();await blocked;return {provider:'resend',providerId:'fixture-id'};};
  try{
    const inline=emailService.send({to:'recipient@example.test',subject:'Concurrent fixture',html:'Fixture',dedupeKey:'concurrent-fixture'});
    await started;
    const flushes=await Promise.all([emailService.flush(),emailService.flush()]);
    assert.equal(flushes.reduce((n,f)=>n+f.attempted,0),0);
    release();assert.equal((await inline).sent,true);assert.equal(sends,1);
    assert.equal((await emailService.send({to:'recipient@example.test',subject:'Concurrent fixture',html:'Fixture',dedupeKey:'concurrent-fixture'})).reason,'DUPLICATE_SUPPRESSED');
    assert.equal(sends,1);
  }finally{release?.();emailDeliveryService.status=originalStatus;emailDeliveryService.send=originalSend;}
});
test('Resend uncertainty never triggers a second send through SMTP',async()=>{
  const configured=resendEmailProvider.configured,send=resendEmailProvider.send,smtpSend=smtpService.sendMail;
  const smtp={...config.smtp};let smtpCalls=0;
  resendEmailProvider.configured=()=>true;
  resendEmailProvider.send=async()=>{throw Object.assign(new Error('uncertain provider acceptance'),{code:'RESEND_TIMEOUT'});};
  smtpService.sendMail=async()=>{smtpCalls++;};Object.assign(config.smtp,{enabled:true,host:'fixture.invalid'});
  try{await assert.rejects(emailDeliveryService.send({to:'recipient@example.test',subject:'Fixture',html:'Fixture'}),/uncertain/);assert.equal(smtpCalls,0);}
  finally{resendEmailProvider.configured=configured;resendEmailProvider.send=send;smtpService.sendMail=smtpSend;Object.assign(config.smtp,smtp);}
});
