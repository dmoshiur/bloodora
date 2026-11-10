import { getSMSProvider, normalizeBangladeshPhone, smsConfigurationStatus, SMSProviderError } from "../integrations/sms/index.js";
import { smsDeliveryRepo } from "../repos/smsDelivery.repo.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { maskPhone, randomId } from "../utils/errors.js";
import { smsTemplateService, type SMSTemplate } from "./smsTemplate.service.js";

export interface SMSResult {
  success: boolean;
  status: "sent" | "failed" | "disabled" | "duplicate" | "invalid";
  id?: string;
  provider?: string;
  providerMessageId?: string | null;
  code?: string;
  message: string;
}

export interface SMSInput {
  to: string;
  body: string;
  template: SMSTemplate;
  userId?: string | null;
  language?: string | null;
  dedupeKey?: string | null;
}

export const smsService = {
  status: smsConfigurationStatus,

  async send(input: SMSInput): Promise<SMSResult> {
    const to = normalizeBangladeshPhone(input.to);
    if (!to) return { success: false, status: "invalid", code: "INVALID_BD_PHONE", message: "A valid Bangladesh mobile number is required." };
    const status = smsConfigurationStatus();
    const provider = getSMSProvider();
    if (!status.configured || !provider) {
      return { success: false, status: "disabled", code: "SMS_NOT_CONFIGURED", message: status.reason ?? "SMS is disabled. Use the available email or in-app notification instead." };
    }
    const body = String(input.body || "").trim().slice(0, 480);
    if (!body) return { success: false, status: "invalid", code: "EMPTY_SMS", message: "SMS body is required." };

    const id = randomId(10); // SSL csms_id: alphanumeric, <=20 chars.
    const inserted = await smsDeliveryRepo.create({
      id,
      userId: input.userId,
      to,
      template: input.template,
      provider: provider.name,
      cost: config.sms.costPerMessage,
      currency: config.sms.currency,
      dedupeKey: input.dedupeKey,
    });
    if (!inserted) return { success: true, status: "duplicate", id, provider: provider.name, message: "Duplicate SMS suppressed." };

    try {
      const delivered = await provider.send({ id, to, body });
      await smsDeliveryRepo.markSent(id, delivered.providerMessageId);
      logger.info("sms: provider accepted message", { provider: provider.name, to: maskPhone(to), template: input.template, id });
      return { success: true, status: "sent", id, provider: provider.name, providerMessageId: delivered.providerMessageId, message: "SMS accepted by the provider." };
    } catch (error) {
      const shaped = error instanceof SMSProviderError ? error : new SMSProviderError("SMS delivery failed.");
      await smsDeliveryRepo.markFailed(id, shaped.code).catch(() => {});
      logger.warn("sms: delivery failed; application workflow continues", { provider: provider.name, to: maskPhone(to), template: input.template, code: shaped.code });
      return { success: false, status: "failed", id, provider: provider.name, code: shaped.code, message: `${shaped.message} The application remains available; use email or in-app notifications where appropriate.` };
    }
  },

  async sendTemplate(input: Omit<SMSInput, "body"> & { params?: Record<string, string | number> }): Promise<SMSResult> {
    const body = smsTemplateService.render(input.template, input.params, input.language);
    return this.send({ ...input, body });
  },

  stats: () => smsDeliveryRepo.summary(),
  recent: (limit?: number) => smsDeliveryRepo.recent(limit),
};
