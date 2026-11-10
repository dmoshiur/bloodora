import { config } from "../../config/env.js";
import { GreenWebSMSProvider } from "./greenweb.js";
import { SSLWirelessSMSProvider } from "./sslWireless.js";
import type { SMSProvider } from "./types.js";

const greenweb = new GreenWebSMSProvider();
const sslwireless = new SSLWirelessSMSProvider();

export function getSMSProvider(): SMSProvider | null {
  if (["greenweb", "greenwebbd", "bdbulksms"].includes(config.sms.provider)) return greenweb;
  if (["sslwireless", "ssl", "ssl-wireless"].includes(config.sms.provider)) return sslwireless;
  return null;
}

export function smsConfigurationStatus(): { configured: boolean; provider: string; reason: string | null } {
  if (["", "disabled", "none", "off"].includes(config.sms.provider)) return { configured: false, provider: "disabled", reason: null };
  const provider = getSMSProvider();
  if (!provider) return { configured: false, provider: config.sms.provider, reason: "Unsupported SMS_PROVIDER. Use greenweb or sslwireless." };
  if (!provider.configured()) return { configured: false, provider: provider.name, reason: provider.name === "greenweb" ? "SMS_API_KEY is required." : "SMS_API_KEY and SMS_SENDER_ID are required." };
  return { configured: true, provider: provider.name, reason: null };
}

export * from "./types.js";
export * from "./phone.js";
