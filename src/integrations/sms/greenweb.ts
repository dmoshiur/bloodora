import { config } from "../../config/env.js";
import { bangladeshPhoneLocal } from "./phone.js";
import { parseJson, postSms, smsApiUrl } from "./http.js";
import { SMSProviderError, type SMSMessage, type SMSProvider, type SMSProviderResult } from "./types.js";

/**
 * GreenWeb / BD Bulk SMS documented form API.
 * Documentation: https://bdbulksms.net/bulk-sms-api-bd-english.php
 * Official package: https://github.com/bdgreenweb/Laravel-sms-package-for-bdbulksms.net-SMS-API
 */
export class GreenWebSMSProvider implements SMSProvider {
  readonly name = "greenweb" as const;
  configured(): boolean { return Boolean(config.sms.apiKey); }

  async send(message: SMSMessage): Promise<SMSProviderResult> {
    const to = bangladeshPhoneLocal(message.to);
    if (!to || !this.configured()) throw new SMSProviderError("GreenWeb requires a valid Bangladesh recipient and SMS_API_KEY.", "SMS_CONFIG", false);
    const form = new URLSearchParams({ token: config.sms.apiKey, to, message: message.body });
    const endpoint = new URL(smsApiUrl("https://api.bdbulksms.net/api.php"));
    // The documented JSON-output variant; custom provider paths are preserved.
    if (!endpoint.searchParams.has("json")) endpoint.searchParams.set("json", "");
    const response = await postSms(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form,
    });
    const parsed = parseJson(response.text);
    const row = Array.isArray(parsed) ? parsed[0] : parsed;
    const status = String((row as { status?: unknown })?.status ?? "").toUpperCase();
    const statusMessage = String((row as { statusmsg?: unknown; message?: unknown })?.statusmsg ?? (row as { message?: unknown })?.message ?? "");
    if (status !== "SENT" && status !== "SUCCESS" && status !== "OK") {
      const insufficient = /balance|credit|insufficient/i.test(statusMessage);
      throw new SMSProviderError(insufficient ? "SMS credits are exhausted." : `GreenWeb rejected the message${statusMessage ? `: ${statusMessage.slice(0, 120)}` : "."}`, insufficient ? "SMS_CREDITS_EXHAUSTED" : "SMS_REJECTED", false);
    }
    const value = row as { message_id?: unknown; id?: unknown };
    return { providerMessageId: value.message_id || value.id ? String(value.message_id ?? value.id) : null, rawStatus: status };
  }
}
