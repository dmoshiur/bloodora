import { all, get, transaction, type TxExecutor } from "../db/query.js";
import { ApiError, randomId } from "../utils/errors.js";
export type OrganizationKind = "organization" | "hospital";
export type OrganizationStatus = "pending" | "approved" | "rejected" | "suspended";
export interface OrganizationFields {
  name: string;
  description: string;
  district: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  publish_contact: boolean;
}
export interface OrganizationRow extends Omit<OrganizationFields, "publish_contact"> {
  id: string;
  kind: OrganizationKind;
  publish_contact: number;
  status: OrganizationStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string;
  request_key: string;
  request_fingerprint: string;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface MembershipRow {
  organization_id: string;
  user_id: string;
  role: "owner" | "manager" | "volunteer";
  active: number;
}
const fields = [
  "name",
  "description",
  "district",
  "address",
  "contact_email",
  "contact_phone",
  "publish_contact",
] as const;
async function event(
  tx: TxExecutor,
  actorId: string,
  id: string,
  action: string,
  recipient: string,
  message: string,
  version: number,
) {
  const now = new Date().toISOString();
  await tx.run(
    "INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,summary,created_at) VALUES (?,?,?,?,?,?,?)",
    [randomId(), actorId, action, "organization", id, message, now],
  );
  await tx.run(
    `INSERT INTO notifications (id,user_id,audience,type,title,body,entity_type,entity_id,dedupe_key,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,dedupe_key) DO NOTHING`,
    [
      randomId(),
      recipient,
      recipient === "admins" ? "admin" : "user",
      "organization",
      "Institution update",
      message,
      "organization",
      id,
      `${action}:${id}:${version}:${recipient}`,
      now,
    ],
  );
}
async function locked(tx: TxExecutor, id: string, kind: OrganizationKind, version: number) {
  const row = await tx.get<OrganizationRow>("SELECT * FROM organizations WHERE id = ? AND kind = ?", [id, kind]);
  if (!row) throw ApiError.notFound("Institution not found");
  if (row.version !== version)
    throw ApiError.conflict("Institution changed. Reload before updating.", "VERSION_CONFLICT");
  return row;
}
async function membership(tx: TxExecutor, id: string, userId: string) {
  return tx.get<MembershipRow>(
    "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ? AND active = 1",
    [id, userId],
  );
}
export const organizationRepo = {
  async requests(id: string, limit: number, offset: number) {
    return all(
      "SELECT id,blood_group,units,status,urgent,needed_by,created_at FROM blood_requests WHERE institution_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
      [id, limit, offset],
    );
  },
  async find(id: string, kind: OrganizationKind) {
    return get<OrganizationRow>("SELECT * FROM organizations WHERE id = ? AND kind = ?", [id, kind]);
  },
  async member(id: string, userId: string) {
    return get<MembershipRow>(
      "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ? AND active = 1",
      [id, userId],
    );
  },
  async list(
    kind: OrganizationKind,
    opts: {
      status?: string;
      district?: string;
      q?: string;
      limit: number;
      offset: number;
      sort: "name" | "newest";
      userId?: string;
    },
  ) {
    const where = ["o.kind = ?"];
    const args: unknown[] = [kind];
    if (opts.status) {
      where.push("o.status = ?");
      args.push(opts.status);
    }
    if (opts.district) {
      where.push("o.district = ?");
      args.push(opts.district);
    }
    if (opts.q) {
      where.push("o.name LIKE ?");
      args.push(`%${opts.q}%`);
    }
    if (opts.userId) {
      where.push(
        "EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.user_id=? AND m.active=1)",
      );
      args.push(opts.userId);
    }
    const clause = where.join(" AND ");
    const [rows, total] = await Promise.all([
      all<OrganizationRow>(
        `SELECT o.* FROM organizations o WHERE ${clause} ORDER BY ${opts.sort === "name" ? "o.name ASC" : "o.created_at DESC"}, o.id ASC LIMIT ? OFFSET ?`,
        [...args, opts.limit, opts.offset],
      ),
      get<{ n: number }>(`SELECT COUNT(*) AS n FROM organizations o WHERE ${clause}`, args),
    ]);
    return { rows, total: Number(total?.n ?? 0) };
  },
  async create(actorId: string, kind: OrganizationKind, input: OrganizationFields, key: string, fingerprint: string) {
    return transaction(async (tx) => {
      const existing = await tx.get<OrganizationRow>(
        "SELECT * FROM organizations WHERE created_by=? AND request_key=?",
        [actorId, key],
      );
      if (existing) {
        if (existing.kind !== kind || existing.request_fingerprint !== fingerprint)
          throw ApiError.conflict("Submission key was used for different data", "IDEMPOTENCY_CONFLICT");
        return { row: existing, created: false };
      }
      const id = randomId(),
        now = new Date().toISOString();
      await tx.run(
        `INSERT INTO organizations (id,kind,${fields.join(",")},created_by,request_key,request_fingerprint,created_at,updated_at) VALUES (${Array(14).fill("?").join(",")})`,
        [
          id,
          kind,
          ...fields.map((k) => (k === "publish_contact" ? (input[k] ? 1 : 0) : input[k])),
          actorId,
          key,
          fingerprint,
          now,
          now,
        ],
      );
      await tx.run("INSERT INTO organization_members VALUES (?,?,'owner',1,?,?)", [id, actorId, now, now]);
      await event(tx, actorId, id, "institution.apply", "admins", "An institution application requires review.", 1);
      return { row: (await tx.get<OrganizationRow>("SELECT * FROM organizations WHERE id=?", [id]))!, created: true };
    });
  },
  async update(
    actorId: string,
    id: string,
    kind: OrganizationKind,
    version: number,
    input: Partial<OrganizationFields>,
    admin: boolean,
  ) {
    return transaction(async (tx) => {
      const row = await locked(tx, id, kind, version),
        member = await membership(tx, id, actorId);
      if (!admin && (!member || !["owner", "manager"].includes(member.role))) throw ApiError.forbidden();
      if (!admin && row.status === "suspended")
        throw ApiError.conflict("Suspended institutions require administrator review");
      const keys = fields.filter((k) => input[k] !== undefined);
      const reReview = ["name", "district", "address"].some(
        (k) =>
          input[k as keyof OrganizationFields] !== undefined &&
          input[k as keyof OrganizationFields] !== row[k as keyof OrganizationRow],
      );
      const status = row.status === "rejected" || (reReview && row.status === "approved") ? "pending" : row.status;
      const now = new Date().toISOString();
      await tx.run(
        `UPDATE organizations SET ${keys.map((k) => `${k}=?`).join(",")},status=?,version=version+1,updated_at=? WHERE id=? AND version=?`,
        [...keys.map((k) => (k === "publish_contact" ? (input[k] ? 1 : 0) : input[k])), status, now, id, version],
      );
      await event(
        tx,
        actorId,
        id,
        "institution.update",
        status === "pending" ? "admins" : row.created_by,
        "Institution details updated.",
        version + 1,
      );
      return (await tx.get<OrganizationRow>("SELECT * FROM organizations WHERE id=?", [id]))!;
    });
  },
  async review(
    actorId: string,
    id: string,
    kind: OrganizationKind,
    version: number,
    status: OrganizationStatus,
    note: string,
  ) {
    return transaction(async (tx) => {
      const row = await locked(tx, id, kind, version);
      if (row.created_by === actorId || (await membership(tx, id, actorId)))
        throw ApiError.forbidden("A reviewer cannot review their own institution");
      const allowed: Record<OrganizationStatus, OrganizationStatus[]> = {
        pending: ["approved", "rejected"],
        approved: ["suspended"],
        rejected: [],
        suspended: ["approved", "rejected"],
      };
      if (!allowed[row.status].includes(status))
        throw ApiError.conflict("Invalid institution status transition", "INVALID_TRANSITION");
      const now = new Date().toISOString();
      await tx.run(
        "UPDATE organizations SET status=?,review_note=?,reviewed_by=?,reviewed_at=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        [status, note, actorId, now, now, id, version],
      );
      await event(
        tx,
        actorId,
        id,
        "institution.review",
        row.created_by,
        `Your institution application is ${status}.`,
        version + 1,
      );
      return (await tx.get<OrganizationRow>("SELECT * FROM organizations WHERE id=?", [id]))!;
    });
  },
  async members(id: string, limit: number, offset: number) {
    return all<MembershipRow & { name: string }>(
      `SELECT m.organization_id,m.user_id,m.role,m.active,u.name FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY m.created_at,m.user_id LIMIT ? OFFSET ?`,
      [id, limit, offset],
    );
  },
  async setMember(
    actorId: string,
    id: string,
    kind: OrganizationKind,
    version: number,
    userId: string,
    role: MembershipRow["role"],
    active: boolean,
    admin: boolean,
  ) {
    return transaction(async (tx) => {
      const row = await locked(tx, id, kind, version),
        own = await membership(tx, id, actorId);
      if (!admin && own?.role !== "owner")
        throw ApiError.forbidden("Only the institutional owner can manage memberships");
      if (row.status !== "approved") throw ApiError.conflict("Membership changes require an approved institution");
      if (!(await tx.get("SELECT id FROM users WHERE id=?", [userId]))) throw ApiError.notFound("User not found");
      const target = await membership(tx, id, userId);
      if (!admin && (role === "owner" || target?.role === "owner"))
        throw ApiError.forbidden("Only an administrator can change institution ownership");
      if (target?.role === "owner" && (!active || role !== "owner")) {
        const owners = await tx.get<{ n: number }>(
          "SELECT COUNT(*) AS n FROM organization_members WHERE organization_id=? AND role='owner' AND active=1",
          [id],
        );
        if (Number(owners?.n ?? 0) <= 1)
          throw ApiError.conflict("Cannot remove the last institutional owner", "LAST_OWNER");
      }
      const now = new Date().toISOString();
      await tx.run(
        `INSERT INTO organization_members VALUES (?,?,?,?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active,updated_at=excluded.updated_at`,
        [id, userId, role, active ? 1 : 0, now, now],
      );
      await tx.run("UPDATE organizations SET version=version+1,updated_at=? WHERE id=? AND version=?", [
        now,
        id,
        version,
      ]);
      await event(
        tx,
        actorId,
        id,
        "institution.membership",
        userId,
        active ? `Your institution role is ${role}.` : "Your institution access has been revoked.",
        version + 1,
      );
      return { organization_id: id, user_id: userId, role, active, version: version + 1 };
    });
  },
};
