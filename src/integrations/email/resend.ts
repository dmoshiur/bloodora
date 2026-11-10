import { Resend } from "resend";
import { config } from "../../config/env.js";
import { withTimeout } from "../../db/timeout.js";
import { ApiError } from "../../utils/errors.js";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}

export interface EmailProvider {
  readonly name: "resend";
  configured(): boolean;
  send(message: EmailMessage): Promise<string | null>;
}

/** Official Resend SDK adapter. No SMTP or provider secrets reach the browser. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private client: Resend | null = null;

  configured(): boolean {
    return Boolean(config.resend.apiKey && config.resend.fromEmail);
  }

  private getClient(): Resend {
    if (!this.configured()) {
      throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "Resend requires RESEND_API_KEY and RESEND_FROM_EMAIL.", { retryable: false });
    }
    this.client ||= new Resend(config.resend.apiKey);
    return this.client;
  }

  async send(message: EmailMessage): Promise<string | null> {
    const fromName = config.resend.fromName.replace(/["<>\r\n]/g, "").trim() || "BloodOra";
    const result = await withTimeout(
      this.getClient().emails.send({
        from: `${fromName} <${config.resend.fromEmail}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }, message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined),
      Math.min(config.smtpTimeoutMs * 3, config.answerByMs),
      "Resend send",
      "RESEND_TIMEOUT",
    );
    if (result.error) {
      const error = new Error(result.error.message || "Resend rejected the message") as Error & { code?: string; status?: number };
      error.code = "RESEND_ERROR";
      // 429 and provider 5xx are retryable by the outbox. Validation/auth errors
      // are still retained for operator visibility but should be fixed in config.
      throw error;
    }
    return result.data?.id ?? null;
  }
}

export const resendEmailProvider = new ResendEmailProvider();
