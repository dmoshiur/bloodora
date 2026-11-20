# Mail outbox reliability and rollout

## Implemented guarantees

Inline mail sends and maintenance/admin flushes reserve work using one atomic database `UPDATE … RETURNING`. This is shared database state, not an in-memory lock. A row receives a random claim token, a ten-minute lease and an incremented attempt count before calling a provider. Concurrent workers cannot reserve the same unexpired row.

Successful/failed acknowledgements require the current claim token and pending state. An old worker cannot overwrite the result of a replacement worker. Flush claims one message at a time, only after checking the invocation budget; it does not reserve an entire batch it cannot finish.

Failures schedule exponential retry delays (one, two, four, eight minutes before the fifth/final attempt). Reservations count toward the five-attempt limit, including crashes. A worker killed mid-send leaves a recoverable lease. A subsequent flush detects expired final-attempt leases and marks them failed with `DELIVERY_UNCONFIRMED`, instead of retrying forever. Failed rows are retained for operator inspection.

The additive migration adds nullable `claim_token`, `lease_until`, and `next_attempt_at` columns and a queue index. Existing pending rows remain eligible; sent rows are never requeued. Existing terminal failed rows are retained.

Queue metadata omits mail bodies. Newly recorded queue failures contain stable error categories rather than arbitrary provider responses that might contain credentials or private links. This does not retroactively scrub old error records; review existing retention/access policies.

## Provider selection and delivery semantics

Resend is selected when configured; otherwise configured SMTP is used. **A Resend failure does not trigger SMTP fallback.** A lost provider response is ambiguous: the message may already have been accepted. Resend retries use the stable outbox ID as their provider idempotency key.

`sent` means provider acceptance, not inbox receipt. Check provider dashboards/bounce events to determine actual delivery. No delivery webhook processing was added in this pass.

This is **at-least-once recovery, not exactly-once email**:

- SMTP does not offer the same provider idempotency guarantee. A process crash after SMTP acceptance but before database acknowledgement can result in duplicate delivery after lease expiry.
- Resend's idempotency retention is finite. A delayed retry outside that window may deliver again.
- A lease is not cancellation of an already-running external operation. A very late provider operation can overlap recovery after expiry.
- Changing providers while a queue contains uncertain sends may deliver duplicates. Inspect and reconcile those rows before changing provider configuration.
- Database failures after provider acceptance leave uncertain state, not proof of failure to deliver.

## Safe rollout and rollback

1. Use a separate staging database and test recipients. Back up the database using the documented CLI and validate recovery procedures before production migration.
2. Rehearse additive migrations and the test suite against staging. Local automated tests use real isolated SQLite/libSQL persistence but controlled provider fixtures, not live mail.
3. Schedule a coordinated cutover. Pause scheduled flushes and drain old application invocations/instances. Old application code does not honor claims; do not run old and new mail workers concurrently against the same queue. Inline sending also counts as a worker.
4. Apply the existing migration mechanism, deploy all instances with the new code, then resume the maintenance schedule. No new environment variables are needed.
5. Send to an operator-controlled inbox, inspect provider acceptance, actual receipt, queue status and retry behavior. Exercise overlapping authorized flushes on staging, not by generating bulk production messages.
6. Monitor pending age, failed rows, unconfirmed lease failures and provider bounce/rejection reports. Backoff means a flush reporting zero attempts may simply have no currently eligible messages.
7. For terminal failures, reconcile provider logs first. There is intentionally no automatic reset of exhausted attempts. A manual recovery procedure must distinguish confirmed rejection from uncertain acceptance before deciding whether to resend.
8. To roll back code, stop new workers and drain invocations first. Keep additive columns/data intact; do not drop tables or delete queue records. The previous worker does not enforce leases/backoff, so rollback temporarily removes these protections and requires operator coordination.

No production cron, environment, credentials or deployment was changed by this implementation.

## Verification

`test/unit/outbox.test.mjs` covers competing database reservations, expired lease recovery, stale-worker fencing, retry delays, sanitized errors, exhausted/crashed workers, inline-vs-flush overlap, idempotent enqueue and no SMTP fallback on ambiguous Resend failure.

Full sequential verification for this pass: TypeScript/build passed, **787 Node checks passed**, and **12 Chromium tests passed**. These results do not prove live Resend/SMTP credentials, inbox delivery, remote production database behavior or deployment readiness.
