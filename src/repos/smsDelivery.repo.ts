import { all, get, run } from "../db/query.js";
import { nowIso } from "../utils/time.js";

export interface SMSDeliveryRow {
  id: string;
  user_id: string | null;
  to_phone: string;
  template: string;
  provider: string;
  provider_message_id: string | null;
  status: "queued" | "sent" | "failed";
  last_error: string | null;
  cost_amount: number;
  currency: string;
  dedupe_key: string | null;
  created_at: string;
  sent_at: string | null;
}

export const smsDeliveryRepo = {
  async create(input: {
    id: string;
    userId?: string | null;
    to: string;
    template: string;
    provider: string;
    cost: number;
    currency: string;
    dedupeKey?: string | null;
  }): Promise<boolean> {
    const { changes } = await run(
      `INSERT INTO sms_deliveries
        (id, user_id, to_phone, template, provider, status, cost_amount, currency, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)
       ON CONFLICT(dedupe_key) DO NOTHING`,
      [input.id, input.userId ?? null, input.to, input.template, input.provider, input.cost, input.currency, input.dedupeKey ?? null, nowIso()],
    );
    return changes > 0;
  },

  async markSent(id: string, providerMessageId: string | null): Promise<void> {
    await run(`UPDATE sms_deliveries SET status = 'sent', provider_message_id = ?, sent_at = ?, last_error = NULL WHERE id = ?`, [providerMessageId, nowIso(), id]);
  },

  async markFailed(id: string, code: string): Promise<void> {
    // Stable category only: raw provider responses can contain recipient content.
    await run(`UPDATE sms_deliveries SET status = 'failed', last_error = ? WHERE id = ?`, [code.slice(0, 100), id]);
  },

  async summary(): Promise<{ sent: number; failed: number; queued: number; estimated_cost: number; currency: string }> {
    const row = await get<{ sent: number; failed: number; queued: number; estimated_cost: number; currency: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS sent,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
        COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0) AS queued,
        COALESCE(SUM(CASE WHEN status = 'sent' THEN cost_amount ELSE 0 END), 0) AS estimated_cost,
        MAX(currency) AS currency
       FROM sms_deliveries`,
    );
    return { sent: row?.sent ?? 0, failed: row?.failed ?? 0, queued: row?.queued ?? 0, estimated_cost: row?.estimated_cost ?? 0, currency: row?.currency ?? "BDT" };
  },

  async recent(limit = 50): Promise<SMSDeliveryRow[]> {
    return all<SMSDeliveryRow>(`SELECT * FROM sms_deliveries ORDER BY created_at DESC, rowid DESC LIMIT ?`, [Math.min(100, Math.max(1, limit))]);
  },

  async prune(keep = 5000): Promise<number> {
    const { changes } = await run(`DELETE FROM sms_deliveries WHERE rowid NOT IN (SELECT rowid FROM sms_deliveries ORDER BY rowid DESC LIMIT ?)`, [keep]);
    return changes;
  },
};
