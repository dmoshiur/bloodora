import { deliveryProfileService } from "./deliveryProfile.service.js";
import { resendEmailProvider, type EmailMessage } from "../integrations/email/resend.js";
import { resolveSmtpSettings, smtpService } from "./smtp.service.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { maskEmail } from "../utils/errors.js";

export type EmailProviderName = "resend" | "smtp";

/** Provider selection is centralized: Resend is primary; SMTP is selected only when Resend is not configured. */
export const emailDeliveryService = {
  async provider(): Promise<EmailProviderName | null> {
    if (await deliveryProfileService.resolve("email")) return "resend";
    if (resendEmailProvider.configured()) return "resend";
    const smtp = await resolveSmtpSettings();
    return smtp.enabled && smtp.host ? "smtp" : null;
  },

  async status(): Promise<{ configured: boolean; provider: EmailProviderName | null; from: string | null }> {
    const provider = await this.provider();
    if (provider === "resend") return { configured: true, provider, from: (await deliveryProfileService.resolve("email"))?.sender_email || config.resend.fromEmail };
    if (provider === "smtp") {
      const smtp = await resolveSmtpSettings();
      return { configured: true, provider, from: smtp.fromEmail || smtp.user || null };
    }
    return { configured: false, provider: null, from: null };
  },

  async send(message: EmailMessage): Promise<{ provider: EmailProviderName; providerId: string | null }> {
    const selected = message.profileId === undefined ? await deliveryProfileService.resolve("email") : null;
    if (selected) message = {...message,profileId:selected.id};
    const provider = message.profileId ? "resend" : message.profileId === null ? (resendEmailProvider.configured() ? "resend" : "smtp") : await this.provider();
    if (provider === "resend") {
      // A timeout is ambiguous: Resend may already have accepted the message.
      // Never switch transports after submission; retry with the same provider key.
      const providerId = await resendEmailProvider.send(message);
      logger.info("email: Resend accepted message", { to: maskEmail(message.to), providerId });
      return { provider, providerId };
    }
    if (provider === "smtp") {
      await smtpService.sendMail(message.to, message.subject, message.html, message.text);
      return { provider, providerId: null };
    }
    throw Object.assign(new Error("No transactional email provider is configured."), { code: "EMAIL_NOT_CONFIGURED", status: 503, retryable: false });
  },

  /** Real delivery test used by Admin → Email. It never reports a mocked success. */
  async test(to?: string): Promise<{ sent: boolean; message: string; provider?: EmailProviderName; info?: unknown; error?: string }> {
    const status = await this.status();
    if (!status.configured || !status.provider) {
      return { sent: false, message: "❌ Configure Resend (or the legacy SMTP fallback) before sending a test." };
    }
    if (!to || !to.includes("@")) return { sent: false, message: "❌ Enter a valid test recipient." };
    try {
      const result = await this.send({
        to,
        subject: `✅ BloodFerry ${status.provider === "resend" ? "Resend" : "SMTP"} test successful`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;padding:26px"><h1 style="color:#e31b23;font-size:22px">BloodFerry email is configured</h1><p>This real test message was accepted by <strong>${status.provider}</strong>.</p><p>Sent at ${new Date().toISOString()}</p></div>`,
        text: `BloodFerry email test accepted by ${status.provider} at ${new Date().toISOString()}`,
        idempotencyKey: `admin-test:${to.toLowerCase()}:${new Date().toISOString()}`,
      });
      return { sent: true, message: `✅ Test email accepted by ${result.provider}. Check the inbox and provider delivery status.`, provider: result.provider, info: result.providerId ? { id: result.providerId } : undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { sent: false, message: `❌ ${status.provider} test failed: ${message}`, provider: status.provider, error: message };
    }
  },
};
