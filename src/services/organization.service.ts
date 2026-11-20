import { bloodRequestService } from "./bloodRequest.service.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { organizationRepo, type OrganizationKind, type OrganizationRow } from "../repos/organization.repo.js";
import { rbacService } from "./rbac.service.js";
import { normalizeBangladeshPhone } from "../integrations/sms/phone.js";
import { ApiError } from "../utils/errors.js";
import type { SafeUser } from "../types.js";
const phone = z
  .string()
  .transform((v) => normalizeBangladeshPhone(v))
  .refine((v): v is string => Boolean(v), "Invalid Bangladesh phone");
const fields = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000),
  district: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(500),
  contact_email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((v) => v.toLowerCase()),
  contact_phone: phone,
  publish_contact: z.boolean(),
});
const createSchema = fields.extend({ request_key: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/) }).strict();
const updateSchema = fields.partial().extend({ version: z.number().int().positive() }).strict();
const reviewSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["approved", "rejected", "suspended"]),
    note: z.string().trim().min(3).max(1000),
  })
  .strict();
const memberSchema = z
  .object({
    version: z.number().int().positive(),
    user_id: z.string().min(1).max(128),
    role: z.enum(["owner", "manager", "volunteer"]),
    active: z.boolean(),
  })
  .strict();
const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    district: z.string().trim().max(80).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(["name", "newest"]).default("name"),
    status: z.enum(["pending", "approved", "rejected", "suspended"]).optional(),
  })
  .strict();
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw ApiError.badRequest("Invalid institution request", "VALIDATION_ERROR");
  return r.data;
}
function view(row: OrganizationRow, privileged = false) {
  const base = {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    district: row.district,
    address: row.address,
    status: row.status,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(row.publish_contact || privileged
      ? { contact_email: row.contact_email, contact_phone: row.contact_phone }
      : {}),
    publish_contact: Boolean(row.publish_contact),
  };
  return privileged
    ? { ...base, created_by: row.created_by, review_note: row.review_note, reviewed_at: row.reviewed_at }
    : base;
}
async function internal(actor: SafeUser, id: string, kind: OrganizationKind, requireManager = false) {
  const row = await organizationRepo.find(id, kind);
  if (!row) throw ApiError.notFound("Institution not found");
  const admin = await rbacService.can(actor, "partners.view");
  const member = await organizationRepo.member(id, actor.id);
  if (!admin && (!member || (requireManager && !["owner", "manager"].includes(member.role))))
    throw ApiError.notFound("Institution not found");
  return { row, admin, member };
}
export const organizationService = {
  async requests(actor: SafeUser, id: string, kind: OrganizationKind, query: unknown) {
    await internal(actor, id, kind, true);
    const opts = parse(querySchema, query);
    return organizationRepo.requests(id, opts.limit, opts.offset);
  },
  async submitRequest(actor: SafeUser, id: string, kind: OrganizationKind, body: Record<string, unknown>) {
    await internal(actor, id, kind, true);
    return bloodRequestService.create(actor, { ...body, institution_id: id });
  },
  async create(actor: SafeUser, kind: OrganizationKind, body: unknown) {
    const { request_key, ...input } = parse(createSchema, body);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ kind, ...input }))
      .digest("hex");
    const result = await organizationRepo.create(actor.id, kind, input, request_key, fingerprint);
    return { institution: view(result.row, true), created: result.created };
  },
  async list(kind: OrganizationKind, query: unknown, actor?: SafeUser, scope: "public" | "mine" | "admin" = "public") {
    const opts = parse(querySchema, query);
    if (scope === "admin") {
      if (!actor) throw ApiError.unauthorized();
      await rbacService.require(actor, ["partners.view"]);
    }
    if (scope === "mine" && !actor) throw ApiError.unauthorized();
    const result = await organizationRepo.list(kind, {
      ...opts,
      status: scope === "public" ? "approved" : opts.status,
      userId: scope === "mine" ? actor!.id : undefined,
    });
    return {
      institutions: result.rows.map((row) => view(row, scope !== "public")),
      pagination: { limit: opts.limit, offset: opts.offset, total: result.total },
    };
  },
  async get(id: string, kind: OrganizationKind, actor?: SafeUser) {
    const row = await organizationRepo.find(id, kind);
    if (!row) throw ApiError.notFound("Institution not found");
    const privileged = actor
      ? Boolean(await organizationRepo.member(id, actor.id)) || (await rbacService.can(actor, "partners.view"))
      : false;
    if (row.status !== "approved" && !privileged) throw ApiError.notFound("Institution not found");
    return view(row, privileged);
  },
  async update(actor: SafeUser, id: string, kind: OrganizationKind, body: unknown) {
    const { version, ...fields } = parse(updateSchema, body);
    if (!Object.keys(fields).length) throw ApiError.badRequest("No changes submitted");
    const admin = await rbacService.can(actor, "partners.manage");
    const row = await organizationRepo.update(actor.id, id, kind, version, fields, admin);
    return view(row, true);
  },
  async review(actor: SafeUser, id: string, kind: OrganizationKind, body: unknown) {
    await rbacService.require(actor, ["partners.manage"]);
    const b = parse(reviewSchema, body);
    return view(await organizationRepo.review(actor.id, id, kind, b.version, b.status, b.note), true);
  },
  async members(actor: SafeUser, id: string, kind: OrganizationKind, query: unknown) {
    await internal(actor, id, kind, true);
    const opts = parse(querySchema, query);
    return organizationRepo.members(id, opts.limit, opts.offset);
  },
  async setMember(actor: SafeUser, id: string, kind: OrganizationKind, body: unknown) {
    const b = parse(memberSchema, body);
    const admin = await rbacService.can(actor, "partners.manage");
    return organizationRepo.setMember(actor.id, id, kind, b.version, b.user_id, b.role, b.active, admin);
  },
};
