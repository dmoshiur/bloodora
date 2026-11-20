import type { Request, Response } from "express";
import { adminAccountsService } from "../services/adminAccounts.service.js";
import { str } from "../utils/validate.js";

function ctx(req: Request): { ip: string | null; userAgent: string | null } {
  const xff = req.headers["x-forwarded-for"];
  const ip = typeof xff === "string" && xff.trim() ? xff.split(",")[0].trim() : req.ip || null;
  return { ip, userAgent: str(req.headers["user-agent"]) ?? null };
}

/** GET /api/auth/accept-invite/validate — is this invite token usable? */
export async function validateInvite(req: Request, res: Response): Promise<void> {
  const info = await adminAccountsService.inviteInfo(str(req.query.token) || "");
  if (!info.valid) {
    res.status(400).json({ valid: false, error: { code: "INVITE_INVALID", message: "This invitation link is invalid, used or expired." } });
    return;
  }
  res.json({ valid: true, name: info.name, email: info.email, role: info.role });
}

/** POST /api/auth/accept-invite — set a password for an invited admin account. */
export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = str(body.token) || "";
  const out = await adminAccountsService.acceptInvite(token, body, ctx(req));
  res.json(out);
}
