import { all, get, transaction } from "../db/query.js";
import { ApiError, randomId } from "../utils/errors.js";
export interface DonationInput {
  donorId: string;
  requestId: string | null;
  donatedAt: string;
  bloodGroup: string;
  units: number;
  note: string | null;
  key: string;
}
export const donationRepo = {
  async summary(userId?: string) {
    const row = await get<{ total: number; units: number; last_donation: string | null }>(
      `SELECT COUNT(*) AS total,COALESCE(SUM(units),0) AS units,MAX(donated_at) AS last_donation FROM donations ${userId ? "WHERE donor_id=?" : ""}`,
      userId ? [userId] : [],
    );
    return {
      total: Number(row?.total ?? 0),
      units: Number(row?.units ?? 0),
      last_donation: row?.last_donation ?? null,
    };
  },
  async adminList(opts: { limit: number; offset: number; donorId?: string; requestId?: string }) {
    const where: string[] = [],
      args: unknown[] = [];
    if (opts.donorId) {
      where.push("d.donor_id=?");
      args.push(opts.donorId);
    }
    if (opts.requestId) {
      where.push("d.request_id=?");
      args.push(opts.requestId);
    }
    const filter = where.length ? "WHERE " + where.join(" AND ") : "";
    const [rows, total] = await Promise.all([
      all(
        `SELECT d.id,d.donor_id,u.name AS donor_name,d.request_id,d.donated_at,d.blood_group,d.units,d.note,d.recorded_by,d.created_at FROM donations d JOIN users u ON u.id=d.donor_id ${filter} ORDER BY d.donated_at DESC,d.id DESC LIMIT ? OFFSET ?`,
        [...args, opts.limit, opts.offset],
      ),
      get<{ n: number }>(`SELECT COUNT(*) AS n FROM donations d ${filter}`, args),
    ]);
    return { donations: rows, pagination: { limit: opts.limit, offset: opts.offset, total: Number(total?.n ?? 0) } };
  },
  async list(userId: string, limit: number, offset: number) {
    return all(
      "SELECT id, request_id, donated_at, blood_group, units, note, created_at FROM donations WHERE donor_id = ? ORDER BY donated_at DESC, id DESC LIMIT ? OFFSET ?",
      [userId, limit, offset],
    );
  },
  async count() {
    return Number((await get<{ n: number }>("SELECT COUNT(*) AS n FROM donations"))?.n ?? 0);
  },
  async record(actorId: string, input: DonationInput) {
    return transaction(async (tx) => {
      const previous = await tx.get<Record<string, unknown>>("SELECT * FROM donations WHERE idempotency_key = ?", [
        input.key,
      ]);
      if (previous) {
        if (
          previous.donor_id !== input.donorId ||
          previous.request_id !== input.requestId ||
          previous.donated_at !== input.donatedAt ||
          previous.units !== input.units ||
          previous.blood_group !== input.bloodGroup ||
          previous.note !== input.note
        )
          throw ApiError.conflict("Idempotency key already used");
        return previous;
      }
      if (!(await tx.get("SELECT id FROM users WHERE id = ?", [input.donorId])))
        throw ApiError.notFound("Donor not found");
      if (input.requestId && !(await tx.get("SELECT id FROM blood_requests WHERE id = ?", [input.requestId])))
        throw ApiError.notFound("Blood request not found");
      const id = randomId(),
        now = new Date().toISOString();
      await tx.run("INSERT INTO donations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        id,
        input.donorId,
        input.requestId,
        actorId,
        input.donatedAt,
        input.bloodGroup,
        input.units,
        input.note,
        input.key,
        now,
      ]);
      await tx.run(
        "UPDATE users SET last_donation = CASE WHEN last_donation IS NULL OR julianday(last_donation) < julianday(?) THEN ? ELSE last_donation END, can_donate = 0 WHERE id = ?",
        [input.donatedAt, input.donatedAt, input.donorId],
      );
      await tx.run(
        `INSERT INTO notifications (id,user_id,type,title,body,entity_type,entity_id,dedupe_key,created_at) VALUES (?,?,'donation','Donation recorded','Your donation history has been updated. Availability requires reassessment.','donation',?,?,?)`,
        [randomId(), input.donorId, id, `donation:${id}`, now],
      );
      await tx.run(
        "INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,summary,created_at) VALUES (?,?,?,?,?,?,?)",
        [randomId(), actorId, "donation.record", "donation", id, "Donation record added", now],
      );
      return tx.get<Record<string, unknown>>("SELECT * FROM donations WHERE id = ?", [id]);
    });
  },
};
