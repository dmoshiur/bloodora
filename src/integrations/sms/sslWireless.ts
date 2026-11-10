import { config } from "../../config/env.js";
import { bangladeshPhoneDigits } from "./phone.js";
import { parseJson, postSms, smsApiUrl } from "./http.js";
import { SMSProviderError, type SMSMessage, type SMSProvider, type SMSProviderResult } from "./types.js";

/**
 * SSL Wireless iSMS Plus v3 single-SMS API.
 * Reference: https://ismsplus.sslwireless.com/api-documentation
 * Endpoint and fields are cross-checked against the provider API specification
 * at https://github.com/khomeni404/isms-ssl-api-plus.
 */
export class SSLWirelessSMSProvider implements SMSProvider {
  readonly name = "sslwireless" as const;
  configured(): boolean { return Boolean(config.sms.apiKey && config.sms.senderId); }

  async send(message: SMSMessage): Promise<SMSProviderResult> {
    const msisdn = bangladeshPhoneDigits(message.to);
    if (!msisdn || !this.configured()) throw new SMSProviderError("SSL Wireless requires SMS_API_KEY, SMS_SENDER_ID and a valid Bangladesh recipient.", "SMS_CONFIG", false);
    const response = await postSms(smsApiUrl("https://smsplus.sslwireless.com/api/v3/send-sms"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_token: config.sms.apiKey,
        sid: config.sms.senderId,
        msisdn,
        sms: message.body,
        csms_id: message.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20),
      }),
    });
    const row = parseJson(response.text) as { status?: unknown; reference_id?: unknown; error_message?: unknown; message?: unknown };
    const status = String(row.status ?? "").toUpperCase();
    if (status !== "SUCCESS" && status !== "SENT" && status !== "OK") {
      const detail = String(row.error_message ?? row.message ?? "");
      const insufficient = /balance|credit|insufficient/i.test(detail);
      const retryable = /timeout|temporar|unavailable/i.test(detail);
      throw new SMSProviderError(insufficient ? "SMS credits are exhausted." : `SSL Wireless rejected the message${detail ? `: ${detail.slice(0, 120)}` : "."}`, insufficient ? "SMS_CREDITS_EXHAUSTED" : "SMS_REJECTED", retryable);
    }
    return { providerMessageId: row.reference_id ? String(row.reference_id) : null, rawStatus: status };
  }
}
