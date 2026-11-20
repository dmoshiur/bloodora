import { ApiError, randomId } from "../utils/errors.js";
import { get, all, run, transaction } from "../db/query.js";
import type { BloodRequestRow } from "../types.js";

export const bloodRequestRepo = {
  async findById(id: string): Promise<BloodRequestRow | null> {
    return get<BloodRequestRow>(
      `SELECT br.*, u.name AS requester_name
       FROM blood_requests br LEFT JOIN users u ON br.user_id = u.id
       WHERE br.id = ?`,
      [id],
    );
  },

  async create(row: Omit<BloodRequestRow, "created_at">): Promise<void> {
    await transaction(async tx => {
    if (row.institution_id) {
      const institution = await tx.get<{status:string;name:string;kind:string}>("SELECT status,name,kind FROM organizations WHERE id=?",[row.institution_id]);
      const member = row.user_id ? await tx.get<{role:string}>("SELECT role FROM organization_members WHERE organization_id=? AND user_id=? AND active=1",[row.institution_id,row.user_id]) : null;
      if (!institution || !member || !['owner','manager'].includes(member.role)) throw ApiError.forbidden('Institution request access denied');
      if (institution.status !== 'approved') throw ApiError.conflict('Institution must be approved before submitting requests');
      if (institution.kind === 'hospital') row.hospital_name = row.hospital = institution.name;
    }
    await tx.run(
      `INSERT INTO blood_requests
        (id, user_id, name, phone, hospital, patient_name, patient_relation, hospital_name,
         hospital_address, contact_person, contact_phone, contact_email, urgent_reason,
         needed_by, additional_info, blood_group, units, quantity, division, district, upazila,
         location_division, location_district, location_upazila, urgent, status, is_fulfilled,
         fulfilled_at, fulfilled_by, note, updated_at, institution_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)`,
      [
        row.id, row.user_id, row.name, row.phone, row.hospital, row.patient_name, row.patient_relation,
        row.hospital_name, row.hospital_address, row.contact_person, row.contact_phone, row.contact_email,
        row.urgent_reason, row.needed_by, row.additional_info, row.blood_group, row.units, row.quantity,
        row.division, row.district, row.upazila, row.location_division, row.location_district,
        row.location_upazila, row.urgent, row.status, row.note, row.updated_at, row.institution_id ?? null,
      ],
    );
    const now = new Date().toISOString();
    await tx.run(`INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, link, dedupe_key, created_at)
      SELECT lower(hex(randomblob(18))), id, 'blood_request', 'Blood request near you', ?, 'blood_request', ?, ?, ?, ?
      FROM users WHERE blood_group = ? AND district = ? AND can_donate = 1 AND is_verified = 1 AND notify_inapp = 1
      ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
      [`${row.blood_group} requested at ${row.hospital_name}. Availability and clinical suitability must be confirmed.`, row.id, `/blood-request/${row.id}`, `blood-match:${row.id}`, now, row.blood_group, row.district]);
    await tx.run(`INSERT INTO notifications (id, user_id, audience, type, title, entity_type, entity_id, link, dedupe_key, created_at)
      VALUES (?, 'admins', 'admin', 'blood_request', 'New blood request', 'blood_request', ?, ?, ?, ?)`,
      [randomId(), row.id, `/blood-request/${row.id}`, `blood-created:${row.id}`, now]);
    });
  },

  /** Public list: open (not fulfilled) and not past needed_by. */
  async listPublic(opts: { group?: string; division?: string; dist?: string; urgent?: boolean; limit?: number } = {}): Promise<BloodRequestRow[]> {
    const where: string[] = ["is_fulfilled = 0", "status != 'cancelled'", "(needed_by IS NULL OR datetime(needed_by) >= datetime('now'))"];
    const args: unknown[] = [];
    if (opts.group) {
      where.push("blood_group = ?");
      args.push(opts.group);
    }
    if (opts.division) {
      where.push("location_division LIKE ?");
      args.push(`%${opts.division}%`);
    }
    if (opts.dist) {
      where.push("location_district LIKE ?");
      args.push(`%${opts.dist}%`);
    }
    if (opts.urgent) {
      where.push("urgent = 1");
    }
    const limit = Math.min(200, opts.limit ?? 100);
    return all<BloodRequestRow>(
      `SELECT br.*, u.name AS requester_name
       FROM blood_requests br LEFT JOIN users u ON br.user_id = u.id
       WHERE ${where.join(" AND ")}
       ORDER BY urgent DESC, datetime(needed_by) ASC LIMIT ?`,
      [...args, limit],
    );
  },

  async listUrgent(limit = 100): Promise<BloodRequestRow[]> {
    return all<BloodRequestRow>(
      `SELECT br.*, u.name AS requester_name
       FROM blood_requests br LEFT JOIN users u ON br.user_id = u.id
       WHERE urgent = 1 AND is_fulfilled = 0 AND status != 'cancelled'
       ORDER BY datetime(needed_by) ASC LIMIT ?`,
      [limit],
    );
  },

  /** Admin/moderation list (all, incl. fulfilled & cancelled). */
  async listAll(opts: { status?: string; group?: string; limit?: number; offset?: number } = {}): Promise<BloodRequestRow[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (opts.status) {
      where.push("status = ?");
      args.push(opts.status);
    }
    if (opts.group) {
      where.push("blood_group = ?");
      args.push(opts.group);
    }
    const limit = Math.min(200, opts.limit ?? 100);
    const offset = Math.max(0, opts.offset ?? 0);
    return all<BloodRequestRow>(
      `SELECT br.*, u.name AS requester_name
       FROM blood_requests br LEFT JOIN users u ON br.user_id = u.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY br.created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset],
    );
  },

  /** The caller's own requests, newest first (personal dashboard). */
  async listByUser(userId: string, limit = 20): Promise<BloodRequestRow[]> {
    return all<BloodRequestRow>(
      `SELECT * FROM blood_requests WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      [userId, Math.min(100, Math.max(1, limit))],
    );
  },

  /**
   * Open vs fulfilled vs cancelled counts for one account.
   * Both completion signals are honoured: older rows carry `is_fulfilled = 1`
   * while newer ones set `status = 'fulfilled'`.
   */
  async countByUser(userId: string): Promise<{ total: number; open: number; fulfilled: number; cancelled: number }> {
    const row = await get<{ total: number; fulfilled: number; cancelled: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status != 'cancelled' AND (status = 'fulfilled' OR is_fulfilled = 1) THEN 1 ELSE 0 END) AS fulfilled,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM blood_requests WHERE user_id = ?`,
      [userId],
    );
    const total = Number(row?.total ?? 0);
    const fulfilled = Number(row?.fulfilled ?? 0);
    const cancelled = Number(row?.cancelled ?? 0);
    return { total, fulfilled, cancelled, open: Math.max(0, total - fulfilled - cancelled) };
  },

  async transition(id: string, status: string, actorId: string, expected: string): Promise<void> {
    await transaction(async tx => {
      const allowed: Record<string, string[]> = { open: ["confirmed", "fulfilled", "cancelled"], confirmed: ["fulfilled", "cancelled"], fulfilled: [], cancelled: [] };
      if (status === expected) return;
      if (!allowed[expected]?.includes(status)) throw new ApiError(409, "INVALID_TRANSITION", "This blood request cannot move to that status");
      const now = new Date().toISOString();
      const result = await tx.run(`UPDATE blood_requests SET status = ?, is_fulfilled = ?, fulfilled_at = ?, fulfilled_by = ?, updated_at = ? WHERE id = ? AND status = ?`,
        [status, status === "fulfilled" ? 1 : 0, status === "fulfilled" ? now : null, status === "fulfilled" ? actorId : null, now, id, expected]);
      if (!result.changes) throw new ApiError(409, "REQUEST_CHANGED", "Request changed; reload before retrying");
      const row = await tx.get<{ user_id: string | null }>("SELECT user_id FROM blood_requests WHERE id = ?", [id]);
      if (row?.user_id) await tx.run(`INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, link, dedupe_key, created_at)
        VALUES (?, ?, 'blood_request', ?, ?, 'blood_request', ?, ?, ?, ?) ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        [randomId(), row.user_id, "Blood request updated", `Your request is now ${status}.`, id, `/blood-request/${id}`, `blood:${id}:${status}`, now]);
    });
  },

  async countByStatus(status: string): Promise<number> {
    const row = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM blood_requests WHERE status = ?`, [status]);
    return row?.n ?? 0;
  },

  async countUrgent(): Promise<number> {
    const row = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM blood_requests WHERE urgent = 1 AND is_fulfilled = 0 AND status != 'cancelled'`);
    return row?.n ?? 0;
  },

  async countAll(): Promise<number> {
    const row = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM blood_requests`);
    return row?.n ?? 0;
  },

  async countCreatedAfter(since: string): Promise<number> {
    const row = await get<{ n: number }>(`SELECT COUNT(*) AS n FROM blood_requests WHERE created_at >= ?`, [since]);
    return row?.n ?? 0;
  },

  async delete(id: string): Promise<void> {
    await run(`DELETE FROM blood_requests WHERE id = ?`, [id]);
  },
};
