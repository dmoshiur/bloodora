# External providers

All provider credentials are server-only. Tests use disabled providers, local infrastructure, or explicit mocks. Persisted outbox/provider IDs in a mocked test are not evidence that an external service delivered anything.

## Email: Resend and SMTP

Resend is the primary provider when `RESEND_API_KEY` and a sender are configured. SMTP can be explicitly selected or used as fallback after Resend selection/send failure when `SMTP_ENABLED=1` and its host/credentials are configured.

```dotenv
RESEND_API_KEY=
RESEND_FROM_NAME=BloodOra
RESEND_FROM_EMAIL=no-reply@your-verified-domain.example
SMTP_ENABLED=0
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=BloodOra
SMTP_FROM_EMAIL=no-reply@your-domain.example
SMTP_TIMEOUT_MS=2500
```

Use a verified sending domain and provider-approved From address. SMTP settings saved in the admin panel can override environment defaults according to the application configuration rules. Do not place provider secrets in `FRONTEND_URL` or public settings.

The email service writes durable outbox metadata with dedupe keys and provider IDs. Admin mail flush retries queued work within the remaining invocation budget. A configured-but-unavailable provider must remain a failure/queued state, never a simulated success.

Verification requires sending to controlled mailboxes through Resend and SMTP separately, checking fallback by forcing primary failure, validating dedupe, and inspecting real provider message IDs. Those external checks have not been performed by the local suite.

## SMS: GreenWeb and SSL Wireless

Supported `SMS_PROVIDER` values are `disabled`, `greenweb`, and `sslwireless`.

```dotenv
SMS_PROVIDER=disabled
SMS_API_KEY=
SMS_API_SECRET=
SMS_SENDER_ID=
SMS_API_URL=
SMS_TIMEOUT_MS=4000
SMS_COST_PER_MESSAGE=0
SMS_CURRENCY=BDT
SMS_OTP_PEPPER=
```

Leave `SMS_API_URL` empty unless the selected provider requires an endpoint override. Configure sender ID and credentials exactly as issued by the provider. Cost/currency values are reporting metadata; they do not prove billing.

Bangladesh numbers are normalized to `+8801XXXXXXXXX`. Provider adapters translate to their required local/digits format. Disabled SMS returns `SMS_NOT_CONFIGURED`; invalid numbers return a validation error. Admin integration status masks secrets.

### OTP guarantees

- Codes are generated with cryptographic randomness and exist in plaintext only for the provider payload.
- Stored codes are HMAC-hashed with `SMS_OTP_PEPPER` or `JWT_SECRET` fallback.
- OTPs expire, have bounded attempts, are single-use, and have resend cooldowns.
- Code plaintext is not returned in API/SSR responses or written to logs.
- Failed delivery does not expose a code or claim verification.

Real SMS verification must use approved test numbers and paid credits, with explicit attention to message templates, sender registration, delivery receipts, throttling, and cost. Local disabled/mocked tests are insufficient.

## AI: OpenAI-compatible / Groq

```dotenv
GROQ_API_KEY=
AI_PROVIDER=groq
AI_MODEL=qwen/qwen3.6-27b
AI_BASE_URL=https://api.groq.com/openai/v1
AI_TIMEOUT_MS=6000
```

Admin → AI Assistant stored settings take precedence over environment defaults on an already bootstrapped database. If a provider/base URL change appears ineffective, inspect the saved admin configuration rather than repeatedly redeploying environment values.

The AI timeout covers the total interaction, including attempts/backoff and response-body processing, and is clamped to the caller-safe invocation budget. Unconfigured AI returns a controlled response. Tests validate sanitization and failure handling with controlled providers, not model quality or real account quota.

## Operational rollout

1. Enable one provider at a time in preview.
2. Use least-privilege credentials and approved recipients/numbers.
3. Test success, timeout, invalid credentials, provider 4xx/5xx, and fallback.
4. Confirm secrets are masked and no OTP/session/token appears in logs.
5. Review provider-side delivery and billing records.
6. Rotate credentials if they were ever pasted into tickets, logs, browser code, or Git.
