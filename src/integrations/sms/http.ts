import { config } from "../../config/env.js";
import { SMSProviderError } from "./types.js";

export function smsApiUrl(fallback: string): string {
  const raw = config.sms.apiUrl || fallback;
  let url: URL;
  try { url = new URL(raw); } catch { throw new SMSProviderError("SMS_API_URL must be an absolute HTTPS URL.", "SMS_CONFIG", false); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(config.isProd === false && url.protocol === "http:" && local)) {
    throw new SMSProviderError("SMS_API_URL must use HTTPS (local HTTP is allowed only in development).", "SMS_CONFIG", false);
  }
  if (url.username || url.password) throw new SMSProviderError("SMS_API_URL must not contain credentials.", "SMS_CONFIG", false);
  return url.toString();
}

export async function postSms(url: string, init: RequestInit): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.sms.timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
    const text = (await response.text()).slice(0, 16_000);
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new SMSProviderError(`SMS provider returned HTTP ${response.status}.`, `SMS_HTTP_${response.status}`, retryable);
    }
    return { status: response.status, text };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new SMSProviderError("SMS provider timed out.", "SMS_TIMEOUT", true);
    if (error instanceof SMSProviderError) throw error;
    throw new SMSProviderError("SMS provider could not be reached.", "SMS_UNREACHABLE", true);
  } finally {
    clearTimeout(timer);
  }
}

export function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { throw new SMSProviderError("SMS provider returned an invalid response.", "SMS_BAD_RESPONSE", true); }
}
