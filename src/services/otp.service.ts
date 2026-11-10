import crypto from "node:crypto";
import { otpRepo } from "../repos/otp.repo.js";
import { normalizeBangladeshPhone } from "../integrations/sms/phone.js";
import { config } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { smsService } from "./sms.service.js";
import type { SMSResult } from "./sms.service.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function pepper(): string {
  const value = config.sms.otpPepper || config.jwtSecret;
  if (!value) throw new ApiError(503, "OTP_NOT_CONFIGURED", "OTP signing is not configured.");
  return value;
}

function hashCode(phone: string, purpose: string, code: string): string {
  return crypto.createHmac("sha256", pepper()).update(`${phone}:${purpose}:${code}`).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const otpService = {
  async request(input: { phone: string; purpose: "phone_verification" | "password_reset"; userId?: string | null; language?: string | null }): Promise<SMSResult> {
    const phone = normalizeBangladeshPhone(input.phone);
    if (!phone) throw ApiError.badRequest("Enter a valid Bangladesh mobile number.", "INVALID_BD_PHONE");
    const previous = await otpRepo.find(phone, input.purpose);
    if (previous && Date.now() - previous.last_sent_at < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - previous.last_sent_at)) / 1000);
      throw new ApiError(429, "OTP_RESEND_TOO_SOON", `Please wait ${retryAfter} seconds before requesting another code.`, { retryAfter });
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const now = Date.now();
    await otpRepo.replace({
      phone,
      purpose: input.purpose,
      code_hash: hashCode(phone, input.purpose, code),
      expires_at: now + OTP_TTL_MS,
      max_attempts: MAX_ATTEMPTS,
      last_sent_at: now,
      created_at: now,
    });
    const result = await smsService.sendTemplate({
      to: phone,
      template: input.purpose === "password_reset" ? "password_reset" : "otp",
      params: { code, minutes: 10 },
      userId: input.userId,
      language: input.language,
      dedupeKey: `otp:${input.purpose}:${phone}:${now}`,
    });
    // The code exists only in this request and in the provider payload. It is
    // never returned to the browser, logged, or stored in plaintext.
    if (!result.success) {
      throw new ApiError(503, result.code ?? "SMS_DELIVERY_FAILED", `${result.message} No verification code was exposed; use email verification or password reset instead.`);
    }
    return result;
  },

  async verify(phoneInput: string, purpose: "phone_verification" | "password_reset", codeInput: string): Promise<string> {
    const phone = normalizeBangladeshPhone(phoneInput);
    const code = String(codeInput || "").trim();
    if (!phone || !/^\d{6}$/.test(code)) throw ApiError.badRequest("Enter the 6-digit verification code.", "OTP_INVALID");
    const row = await otpRepo.find(phone, purpose);
    if (!row || row.consumed_at || row.expires_at < Date.now() || row.attempts >= row.max_attempts) {
      throw ApiError.badRequest("The verification code is invalid or expired. Request a new code.", "OTP_INVALID");
    }
    if (!(await otpRepo.consumeAttempt(phone, purpose))) {
      throw ApiError.badRequest("The verification code is invalid or expired. Request a new code.", "OTP_INVALID");
    }
    if (!safeEqual(row.code_hash, hashCode(phone, purpose, code))) {
      throw ApiError.badRequest("The verification code is invalid or expired.", "OTP_INVALID");
    }
    if (!(await otpRepo.consume(phone, purpose))) {
      throw ApiError.conflict("This verification code was already used.", "OTP_USED");
    }
    return phone;
  },
};
