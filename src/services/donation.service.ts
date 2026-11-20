import { z } from "zod";
import { donationRepo } from "../repos/donation.repo.js";
import { rbacService } from "./rbac.service.js";
import { ApiError } from "../utils/errors.js";
import { BLOOD_GROUPS } from "../data/constants.js";
import type { SafeUser } from "../types.js";
const schema = z
  .object({
    donor_id: z.string().min(1).max(128),
    request_id: z.string().min(1).max(128).nullable().optional(),
    donated_at: z.string().min(1).max(40),
    blood_group: z.string().refine((v) => BLOOD_GROUPS.includes(v)),
    units: z.number().int().min(1).max(10),
    note: z.string().max(1000).nullable().optional(),
    request_idempotency_key: z.string().regex(/^[a-zA-Z0-9_-]{8,128}$/),
  })
  .strict();
export const donationService = {
  async adminList(actor: SafeUser, query: unknown) {
    await rbacService.require(actor, ["requests.view"]);
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(25),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
        donor_id: z.string().min(1).max(128).optional(),
        request_id: z.string().min(1).max(128).optional(),
      })
      .strict()
      .safeParse(query);
    if (!parsed.success) throw ApiError.badRequest("Invalid donation filters");
    const q = parsed.data;
    return donationRepo.adminList({ limit: q.limit, offset: q.offset, donorId: q.donor_id, requestId: q.request_id });
  },
  async record(actor: SafeUser, body: unknown) {
    await rbacService.require(actor, ["requests.moderate"]);
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest("Invalid donation record");
    const b = parsed.data,
      date = new Date(b.donated_at);
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now())
      throw ApiError.badRequest("Donation date must be in the past");
    return donationRepo.record(actor.id, {
      donorId: b.donor_id,
      requestId: b.request_id ?? null,
      donatedAt: date.toISOString(),
      bloodGroup: b.blood_group,
      units: b.units,
      note: b.note ?? null,
      key: b.request_idempotency_key,
    });
  },
  async history(user: SafeUser, limit: unknown, offset: unknown) {
    const n = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : fallback);
    return donationRepo.list(user.id, Math.max(1, Math.min(100, n(limit, 25))), Math.max(0, n(offset, 0)));
  },
};
