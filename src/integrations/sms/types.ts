export interface SMSMessage {
  id: string;
  to: string;
  body: string;
}

export interface SMSProviderResult {
  providerMessageId: string | null;
  rawStatus?: string;
}

export interface SMSProvider {
  readonly name: "greenweb" | "sslwireless";
  configured(): boolean;
  send(message: SMSMessage): Promise<SMSProviderResult>;
}

export class SMSProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code = "SMS_PROVIDER_ERROR", retryable = true) {
    super(message);
    this.name = "SMSProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
