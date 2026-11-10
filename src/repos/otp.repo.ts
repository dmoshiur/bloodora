import { get, run } from "../db/query.js";

export interface OTPRow {
  phone: string;
  purpose: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  max_attempts: number;
  last_sent_at: number;
  created_at: number;
  consumed_at: number | null;
}

export const otpRepo = {
  find: (phone: string, purpose: string) => get<OTPRow>(`SELECT * FROM phone_otps WHERE phone = ? AND purpose = ?`, [phone, purpose]),

  async replace(row: Omit<OTPRow, "attempts" | "consumed_at">): Promise<void> {
    await run(
      `INSERT INTO phone_otps (phone, purpose, code_hash, expires_at, attempts, max_attempts, last_sent_at, created_at, consumed_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)
       ON CONFLICT(phone, purpose) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         max_attempts = excluded.max_attempts,
         last_sent_at = excluded.last_sent_at,
         created_at = excluded.created_at,
         consumed_at = NULL`,
      [row.phone, row.purpose, row.code_hash, row.expires_at, row.max_attempts, row.last_sent_at, row.created_at],
    );
  },

  async consumeAttempt(phone: string, purpose: string): Promise<boolean> {
    const { changes } = await run(
      `UPDATE phone_otps SET attempts = attempts + 1
       WHERE phone = ? AND purpose = ? AND consumed_at IS NULL AND attempts < max_attempts AND expires_at >= ?`,
      [phone, purpose, Date.now()],
    );
    return changes > 0;
  },

  async consume(phone: string, purpose: string): Promise<boolean> {
    const { changes } = await run(`UPDATE phone_otps SET consumed_at = ? WHERE phone = ? AND purpose = ? AND consumed_at IS NULL`, [Date.now(), phone, purpose]);
    return changes > 0;
  },

  async purge(): Promise<number> {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const { changes } = await run(`DELETE FROM phone_otps WHERE expires_at < ? OR consumed_at IS NOT NULL`, [cutoff]);
    return changes;
  },
};
