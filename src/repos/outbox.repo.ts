import { all, get, run } from "../db/query.js";
import { nowIso } from "../utils/time.js";
import { randomId } from "../utils/errors.js";

/**
 * Durable mail outbox.
 *
 * A serverless function can be frozen the moment it responds, so "fire and
 * forget" email is unreliable: the send may never run. Every message is
 * therefore written to the outbox FIRST and then attempted inline; the row is
 * marked `sent` on success and left `pending`/`failed` otherwise, so the next
 * request (or the maintenance cron) can deliver it.
 *
 * That also gives the admin panel a truthful delivery queue instead of a log
 * that only records what happened to succeed.
 */

export interface OutboxRow {
  id: string;
  profile_id: string | null;
  to_email: string;
  subject: string;
  html: string;
  text: string | null;
  attempts: number;
  claim_token: string | null;
  lease_until: string | null;
  next_attempt_at: string | null;
  status: "pending" | "sent" | "failed";
  last_error: string | null;
  dedupe_key: string | null;
  provider_id: string | null;
  created_at: string;
  sent_at: string | null;
}

export const MAX_ATTEMPTS = 5;
// Longer than a normal invocation; recovery is at-least-once, not exactly-once.
export const LEASE_MS = 10 * 60_000;

export const outboxRepo = {
  async enqueue(input: { to: string; subject: string; html: string; text?: string | null; dedupeKey?: string; profileId?:string|null }): Promise<string | null> {
    const id = randomId();
    const dedupeKey = input.dedupeKey?.trim().slice(0, 190) || null;
    const { changes } = await run(
      `INSERT INTO email_outbox (id, to_email, subject, html, text, attempts, status, dedupe_key, created_at, profile_id)
       VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)
       ON CONFLICT(dedupe_key) DO NOTHING`,
      [id, input.to, input.subject.slice(0, 300), input.html, input.text ?? null, dedupeKey, nowIso(), input.profileId ?? null],
    );
    return changes > 0 ? id : null;
  },

  /** Atomic reservation shared by inline sends and concurrent cron instances.
   * Attempts count reservations, including workers that die before acknowledgement.
   */
  async claimNext(limit = 1, id?: string): Promise<OutboxRow[]> {
    const now = nowIso();
    await run(`UPDATE email_outbox SET status='failed', claim_token=NULL, lease_until=NULL,
      last_error='DELIVERY_UNCONFIRMED: final worker lease expired'
      WHERE status='pending' AND attempts>=? AND lease_until<=?`, [MAX_ATTEMPTS, now]);
    return all<OutboxRow>(`UPDATE email_outbox
      SET claim_token=?, lease_until=?, attempts=attempts+1
      WHERE id IN (SELECT id FROM email_outbox
        WHERE status='pending' AND attempts<?
        AND (next_attempt_at IS NULL OR next_attempt_at<=?)
        AND (lease_until IS NULL OR lease_until<=?)
        ${id ? 'AND id=?' : ''}
        ORDER BY created_at,id LIMIT ?)
      RETURNING *`, [randomId(), new Date(Date.now()+LEASE_MS).toISOString(), MAX_ATTEMPTS,
        now, now, ...(id ? [id] : []), Math.min(50, Math.max(1, Math.trunc(limit)))]);
  },

  async markSent(id: string, claimToken: string, providerId?: string | null): Promise<boolean> {
    const { changes } = await run(`UPDATE email_outbox SET status='sent', sent_at=?,
      last_error=NULL, provider_id=COALESCE(?,provider_id), claim_token=NULL,lease_until=NULL,next_attempt_at=NULL
      WHERE id=? AND claim_token=? AND status='pending'`, [nowIso(),providerId??null,id,claimToken]);
    return changes === 1;
  },

  async markFailed(row: OutboxRow, error: string): Promise<boolean> {
    // Store a stable category, not provider text that might contain credentials or reset links.
    const code = /^[A-Z][A-Z0-9_]{1,63}$/.test(error) ? error : 'EMAIL_DELIVERY_FAILED';
    const next = new Date(Date.now()+Math.min(60*60_000,60_000*2**Math.max(0,row.attempts-1))).toISOString();
    const { changes } = await run(`UPDATE email_outbox SET last_error=?,
      status=CASE WHEN attempts>=? THEN 'failed' ELSE 'pending' END,
      next_attempt_at=?,claim_token=NULL,lease_until=NULL
      WHERE id=? AND claim_token=? AND status='pending'`,[code,MAX_ATTEMPTS,next,row.id,row.claim_token]);
    return changes === 1;
  },

  /**
   * Most recent outbox rows for the admin mail view.
   *
   * Queue views expose metadata only. Bodies may contain reset/verification links;
   * permission to operate mail is not permission to take over recipients' accounts.
   */
  async recent(limit = 25, status?: string | null): Promise<OutboxRow[]> {
    const n = Math.min(100, Math.max(1, limit));
    if (status) {
      return all<OutboxRow>(
        `SELECT id, to_email, subject, '' AS html, NULL AS text, attempts, status, last_error, dedupe_key, provider_id, created_at, sent_at
         FROM email_outbox WHERE status = ? ORDER BY rowid DESC LIMIT ?`,
        [status, n],
      );
    }
    return all<OutboxRow>(
      `SELECT id, to_email, subject, '' AS html, NULL AS text, attempts, status, last_error, dedupe_key, provider_id, created_at, sent_at
       FROM email_outbox ORDER BY rowid DESC LIMIT ?`,
      [n],
    );
  },

  async counts(): Promise<{ pending: number; sent: number; failed: number }> {
    const row = await get<{ pending: number; sent: number; failed: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS sent,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
       FROM email_outbox`,
    );
    return { pending: row?.pending ?? 0, sent: row?.sent ?? 0, failed: row?.failed ?? 0 };
  },

  /** Retention: drop delivered rows beyond the newest `keep`. */
  async prune(keep = 2000): Promise<number> {
    const { changes } = await run(
      `DELETE FROM email_outbox WHERE status = 'sent'
         AND rowid NOT IN (SELECT rowid FROM email_outbox WHERE status = 'sent' ORDER BY rowid DESC LIMIT ?)`,
      [keep],
    );
    return changes;
  },
};
