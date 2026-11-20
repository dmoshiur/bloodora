import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { all, get, transaction } from "../db/query.js";
import { config } from "../config/env.js";
import { ApiError, randomId } from "../utils/errors.js";
const schema = z
  .object({
    kind: z.enum(["email", "sms"]),
    label: z.string().trim().min(2).max(80),
    provider: z.enum(["resend", "greenweb", "sslwireless"]),
    api_key: z.string().trim().min(8).max(512),
    sender_email: z.email().max(160).optional(),
    sender_name: z
      .string()
      .trim()
      .max(80)
      .regex(/^[^<>\r\n]*$/)
      .optional(),
    sender_id: z.string().trim().max(80).optional(),
  })
  .strict();
interface Profile {
  id: string;
  kind: string;
  label: string;
  provider: string;
  sender_email: string | null;
  sender_name: string | null;
  sender_id: string | null;
  secret: string;
  is_default: number;
}
function key() {
  if (config.jwtSecret.length < 24)
    throw ApiError.internal("A stable strong JWT_SECRET is required to protect provider credentials");
  return createHash("sha256")
    .update("bloodferry-delivery-profiles-v1:" + config.jwtSecret)
    .digest();
}
function seal(value: string, id: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(id));
  const data = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
export const deliveryProfileService = {
  async list() {
    return all<Omit<Profile, "secret">>(
      "SELECT id,kind,label,provider,sender_email,sender_name,sender_id,is_default,created_at FROM delivery_profiles ORDER BY created_at,id",
    );
  },
  async resolve(kind: string, id?: string | null) {
    const row = await get<Profile>(`SELECT * FROM delivery_profiles WHERE kind=? AND ${id ? "id=?" : "is_default=1"}`, [
      kind,
      ...(id ? [id] : []),
    ]);
    if (id && !row) throw ApiError.badRequest("Delivery profile unavailable");
    if (!row) return null;
    const [iv, tag, data] = row.secret.split(".").map((v) => Buffer.from(v, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAAD(Buffer.from(row.id));
    d.setAuthTag(tag);
    return { ...row, apiKey: Buffer.concat([d.update(data), d.final()]).toString("utf8") };
  },
  async create(actor: string, body: unknown) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest("Invalid provider profile");
    const v = parsed.data;
    if (
      (v.kind === "email" && (v.provider !== "resend" || !v.sender_email)) ||
      (v.kind === "sms" && (v.provider === "resend" || (v.provider === "sslwireless" && !v.sender_id)))
    )
      throw ApiError.badRequest("Provider and sender fields do not match profile type");
    const id = randomId(),
      secret = seal(v.api_key, id);
    await transaction(async (tx) => {
      await tx.run(
        "INSERT INTO delivery_profiles (id,kind,label,provider,sender_email,sender_name,sender_id,secret,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          id,
          v.kind,
          v.label,
          v.provider,
          v.sender_email ?? null,
          v.sender_name ?? null,
          v.sender_id ?? null,
          secret,
          new Date().toISOString(),
        ],
      );
      await tx.run(
        "INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,summary,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomId(),
          actor,
          "delivery.create",
          "delivery_profile",
          id,
          "Provider profile added; credential omitted",
          new Date().toISOString(),
        ],
      );
    });
    return id;
  },
  async activate(actor: string, id: string) {
    await transaction(async (tx) => {
      const row = await tx.get<Profile>("SELECT * FROM delivery_profiles WHERE id=?", [id]);
      if (!row) throw ApiError.notFound("Profile not found");
      await tx.run("UPDATE delivery_profiles SET is_default=0 WHERE kind=?", [row.kind]);
      await tx.run("UPDATE delivery_profiles SET is_default=1 WHERE id=?", [id]);
      await tx.run(
        "INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,summary,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomId(),
          actor,
          "delivery.activate",
          "delivery_profile",
          id,
          "Default provider profile changed",
          new Date().toISOString(),
        ],
      );
    });
  },
};
