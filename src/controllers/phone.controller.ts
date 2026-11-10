import type { Request, Response } from "express";
import { z } from "zod";
import { parse } from "../utils/validate.js";
import { ApiError } from "../utils/errors.js";
import { otpService } from "../services/otp.service.js";
import { userRepo } from "../repos/user.repo.js";
import { authService } from "../services/auth.service.js";

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict();

/** POST /api/auth/phone/request — send to the authenticated account's phone only. */
export async function requestPhoneCode(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const result = await otpService.request({ phone: req.user.phone, purpose: "phone_verification", userId: req.user.id, language: req.lang });
  res.json({ success: true, status: result.status, message: "Verification code sent. It expires in 10 minutes." });
}

/** POST /api/auth/phone/verify — mark only the authenticated account verified. */
export async function verifyPhoneCode(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const { code } = parse(codeSchema, req.body);
  await otpService.verify(req.user.phone, "phone_verification", code);
  await userRepo.setPhoneVerified(req.user.id, true);
  const user = await authService.me(req.user.id);
  res.json({ success: true, message: "Phone number verified.", user });
}
