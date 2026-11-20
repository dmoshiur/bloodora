import bcrypt from "bcryptjs";
import { z } from "zod";
import { all, run } from "../db/query.js";
import { userRepo } from "../repos/user.repo.js";
import { roleRepo } from "../repos/role.repo.js";
import { tokenRepo } from "../repos/token.repo.js";
import { auditRepo } from "../repos/audit.repo.js";
import { activityRepo } from "../repos/activity.repo.js";
import { rbacService } from "./rbac.service.js";
import { emailService } from "./email.service.js";
import { config } from "../config/env.js";
import { ApiError, randomId } from "../utils/errors.js";
import { str } from "../utils/validate.js";
import { normalizeBangladeshPhone } from "../integrations/sms/phone.js";
import { assertPasswordPolicy } from "./auth.service.js";
import type { SafeUser, UserRow } from "../types.js";

export interface AdminCtx {
  ip?: string | null;
  userAgent?: string | null;
}

const BCRYPT_ROUNDS = 10;

function actorRoleLevel(roleKey: string | null | undefined, isSuper: boolean): number {
  // Fallbacks mirror the seeded catalogue: super_admin=9, admin=5, others=1.
  if (roleKey === "super_admin" || isSuper) return 9;
  if (roleKey === "admin") return 5;
  // Custom roles carry a level in the database; unknown keys are least-privilege.
  return 1;
}

async function levelOf(roleKey: string): Promise<number> {
  const role = await roleRepo.getRole(roleKey).catch(() => null);
  if (role) return role.level;
  return actorRoleLevel(roleKey, false);
}

async function audit(actor: SafeUser, action: string, entityId: string | null, summary: string, meta: Record<string, unknown> | null, ctx: AdminCtx): Promise<void> {
  await auditRepo
    .create({ actorId: actor.id, actorRole: actor.role || null, action, entityType: "user", entityId, summary, meta, ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null })
    .catch(() => {});
}

function publicAdminRow(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    is_admin: Boolean(row.is_admin),
    is_super_admin: Boolean(row.is_super_admin),
    is_active: row.is_active === undefined ? true : Boolean(row.is_active),
    is_pending_invite: row.is_active === 0,
    email_verified: Boolean(row.email_verified),
    image_file: row.image_file ?? null,
    last_login_at: row.last_login_at ?? null,
    created_at: row.created_at,
  };
}

export const adminAccountsService = {
  /** List admin-capable accounts (active and pending invites). Requires users.view. */
  async list(): Promise<{ admins: ReturnType<typeof publicAdminRow>[]; active_super_admins: number }> {
    const rows = await all<UserRow>(
      `SELECT * FROM users WHERE is_admin = 1 OR is_super_admin = 1 ORDER BY created_at ASC`,
    );
    const activeSuperAdmins = await userRepo.countActiveSuperAdmins();
    return { admins: rows.map(publicAdminRow), active_super_admins: activeSuperAdmins };
  },

  /**
   * Invite a new admin. Only accounts holding `admins.manage` may call this.
   * The invited account is created INACTIVE with an unguessable password; a
   * single-use `admin_invite` token (7 days) is issued and the RAW token is
   * returned ONCE — it is never stored (only its hash) and never logged.
   */
  async invite(actor: SafeUser, body: Record<string, unknown>, ctx: AdminCtx = {}) {
    await rbacService.require(actor, ["admins.manage"], ctx);
    const name = (str(body.name) || "").trim();
    const email = (str(body.email) || "").trim().toLowerCase();
    const role = (str(body.role) || "admin").trim().toLowerCase();
    const phone = body.phone === undefined || body.phone === "" ? "" : normalizeBangladeshPhone(body.phone);
    if (name.length < 2 || name.length > 80) throw ApiError.badRequest("Name must be 2–80 characters.", "INVALID_NAME");
    if (!z.string().email().max(160).safeParse(email).success) throw ApiError.badRequest("A valid email address is required.", "INVALID_EMAIL");
    if (await userRepo.findByEmail(email)) throw ApiError.conflict("An account with this email already exists.", "EMAIL_TAKEN");

    const targetRole = await roleRepo.getRole(role);
    if (!targetRole) throw ApiError.badRequest("Unknown role.", "ROLE_NOT_FOUND");
    const targetLevel = targetRole.level;
    if (targetLevel < 5) throw ApiError.badRequest("Invites must grant an administrative role (level ≥ 5).", "NOT_AN_ADMIN_ROLE");
    const actorLevel = Math.max(await levelOf(actor.role || "user"), actorRoleLevel(actor.role, Boolean(actor.is_super_admin)));
    if (targetLevel > actorLevel) {
      throw ApiError.forbidden("You cannot invite a role more powerful than your own.", "PRIVILEGE_ESCALATION");
    }
    // An invite never grants more authority than the inviter's own effective
    // permissions beyond the role catalogue itself — custom roles are resolved
    // from the DB, so a trimmed custom role invites with exactly its grants.
    const isSuper = role === "super_admin";
    const randomSecret = randomId(24) + randomId(24);
    const userId = randomId();
    await userRepo.create({
      id: userId,
      name,
      email,
      phone: phone || "",
      password_hash: await bcrypt.hash(randomSecret, BCRYPT_ROUNDS),
      is_admin: 1,
      is_super_admin: isSuper ? 1 : 0,
      role,
      donation_role: "Both",
      blood_group: null,
      city: null,
      address_holding: null,
      division: null,
      district: null,
      upazila: null,
      union_area: null,
      can_donate: 0,
      age: null,
      date_of_birth: null,
      birth_certificate_number: null,
      bkash_number: null,
      nagad_number: null,
      upay_number: null,
      rocket_number: null,
      pathao_number: null,
      card_last_four: null,
      card_type: null,
      is_verified: 1,
      last_donation: null,
      image_file: null,
      session_token: randomId(24),
      is_active: 0,
    });
    const { token, expiresAt } = await tokenRepo.issue(userId, "admin_invite", ctx.ip ?? null);
    const invitePath = `/accept-invite?token=${encodeURIComponent(token)}`;
    const base = config.frontendUrl || "";
    const inviteUrl = base ? `${base}${invitePath}` : invitePath;
    const emailResult = await emailService
      .send({
        to: email,
        subject: "You have been invited to the BloodFerry admin panel",
        html: `<p>Hello ${escapeHtml(name)},</p><p>${escapeHtml(actor.name)} invited you to the BloodFerry admin panel with the role <strong>${escapeHtml(targetRole.name)}</strong>.</p><p><a href="${inviteUrl}">Accept the invitation and set your password</a></p><p>The link is single-use and expires in 7 days. If you were not expecting this, ignore this message.</p>`,
        text: `Hello ${name},\n\n${actor.name} invited you to the BloodFerry admin panel with the role ${targetRole.name}.\nAccept: ${inviteUrl}\n\nThe link is single-use and expires in 7 days.`,
        dedupeKey: `admin-invite:${userId}:${token.slice(0, 8)}`,
      })
      .catch(() => ({ queued: false, sent: false, reason: "EMAIL_FAILED" }));
    await audit(actor, "admin.invite", userId, `Invited ${email} as ${role}`, { role, email_sent: emailResult.sent, email_reason: emailResult.reason ?? null }, ctx);
    await activityRepo.create("admin_invite", actor.id, `${actor.name} invited ${name} as ${role}`, { user: userId }).catch(() => {});
    return {
      success: true,
      message: emailResult.sent
        ? `✅ Invitation emailed to ${email}. The link is single-use and expires in 7 days.`
        : `✅ Invitation created. Email delivery is not configured (${emailResult.reason ?? "unknown"}) — share this single-use link with ${email} securely: ${invitePath}`,
      invite_url: invitePath,
      invite_email_sent: emailResult.sent,
      invite_email_reason: emailResult.reason ?? null,
      expires_at: expiresAt,
      user: { id: userId, name, email, role, is_active: false },
    };
  },

  /** Validate an invite token for the accept page. Never leaks whether the account exists beyond the token's own validity. */
  async inviteInfo(token: string): Promise<{ valid: boolean; name?: string; email?: string; role?: string }> {
    const trimmed = String(token || "").trim();
    if (!trimmed) return { valid: false };
    const row = await tokenRepo.findValid(trimmed, "admin_invite");
    if (!row) return { valid: false };
    const user = await userRepo.findById(row.user_id);
    if (!user) return { valid: false };
    return { valid: true, name: user.name, email: user.email, role: user.role };
  },

  /** Accept an invitation: set name + password, activate the account, consume the token. */
  async acceptInvite(token: string, body: Record<string, unknown>, ctx: AdminCtx = {}) {
    const trimmed = String(token || "").trim();
    const row = trimmed ? await tokenRepo.findValid(trimmed, "admin_invite") : null;
    if (!row) throw ApiError.badRequest("This invitation link is invalid or has expired.", "INVITE_INVALID");
    const user = await userRepo.findById(row.user_id);
    if (!user) throw ApiError.badRequest("This invitation link is invalid or has expired.", "INVITE_INVALID");
    const consumed = await tokenRepo.consume(row.id);
    if (!consumed) throw ApiError.badRequest("This invitation link has already been used.", "INVITE_USED");
    const name = (str(body.name) || user.name).trim().slice(0, 80) || user.name;
    const password = str(body.password) || "";
    assertPasswordPolicy(password);
    await run(`UPDATE users SET name = ?, password_hash = ?, is_active = 1, session_token = ? WHERE id = ?`, [
      name,
      await bcrypt.hash(password, BCRYPT_ROUNDS),
      randomId(24),
      user.id,
    ]);
    await auditRepo
      .create({ actorId: user.id, actorRole: user.role, action: "admin.invite.accepted", entityType: "user", entityId: user.id, summary: `Admin invitation accepted for ${user.email}`, ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null })
      .catch(() => {});
    return { success: true, message: "✅ Your admin account is ready. Sign in with your new password." };
  },

  /**
   * Activate / deactivate any account. Regular accounts need `users.suspend`;
   * admin-capable accounts need `admins.manage`. The last ACTIVE super admin can
   * never be deactivated, and nobody may deactivate themselves. Deactivation
   * rotates the session token, so every session dies immediately.
   */
  async setActive(actor: SafeUser, id: string, active: boolean, ctx: AdminCtx = {}) {
    const target = await userRepo.findById(id);
    if (!target) throw ApiError.notFound("User not found.", "USER_NOT_FOUND");
    const targetIsAdmin = Boolean(target.is_admin || target.is_super_admin) || ["admin", "super_admin"].includes(target.role || "");
    if (targetIsAdmin) {
      await rbacService.require(actor, ["admins.manage"], ctx);
    } else {
      await rbacService.require(actor, ["users.suspend"], ctx);
    }
    if (!active && target.id === actor.id) {
      throw ApiError.badRequest("You cannot deactivate your own account.", "SELF_SUSPEND");
    }
    if (!active && target.is_super_admin === 1) {
      const others = await userRepo.countActiveSuperAdminsExcluding(target.id);
      if (others < 1) {
        throw ApiError.badRequest("The last active Super Admin cannot be deactivated.", "LAST_SUPER_ADMIN");
      }
    }
    // Demoting powers for a pending invite is pointless but harmless; guard
    // reactivation of super admins by a non-super-admin already covered by
    // admins.manage + level ordering enforced elsewhere.
    await userRepo.setActive(target.id, active);
    await audit(actor, active ? "user.activate" : "user.deactivate", target.id, `${target.name} ${active ? "reactivated" : "deactivated"}`, { was_active: Boolean(target.is_active) }, ctx);
    await activityRepo.create(active ? "user_activate" : "user_deactivate", actor.id, `${actor.name} ${active ? "reactivated" : "deactivated"} ${target.name}`, { user: target.id }).catch(() => {});
    return {
      success: true,
      message: active
        ? `✅ ${target.name} is active again. They must sign in fresh (previous sessions stayed revoked).`
        : `✅ ${target.name} was deactivated. All sessions were revoked immediately.`,
    };
  },

  /** Revoke every session for an account (rotate the session token). */
  async revokeSessions(actor: SafeUser, id: string, ctx: AdminCtx = {}) {
    const target = await userRepo.findById(id);
    if (!target) throw ApiError.notFound("User not found.", "USER_NOT_FOUND");
    const targetIsAdmin = Boolean(target.is_admin || target.is_super_admin) || ["admin", "super_admin"].includes(target.role || "");
    if (target.id !== actor.id) {
      if (targetIsAdmin) await rbacService.require(actor, ["admins.manage"], ctx);
      else await rbacService.require(actor, ["users.suspend"], ctx);
    }
    await userRepo.setSessionToken(target.id, randomId(24));
    await audit(actor, "user.sessions.revoke", target.id, `All sessions revoked for ${target.name}`, null, ctx);
    return { success: true, message: `✅ All sessions for ${target.name} were revoked.` };
  },
};

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}
