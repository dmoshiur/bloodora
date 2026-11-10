# BloodOra

BloodOra is a unified blood-donation and medical-supply application: donor discovery, blood requests, shop and manual payments, notifications, messaging, live support, AI help, localized content, and a permission-based admin panel. The server-rendered site and JSON API run in the **same Express application and the same Vercel function**.

**Stack:** Node.js 20+ · TypeScript (strict ESM) · Express 4 · EJS · Turso/libSQL · Turso-backed sessions · Zod · Multer · Vercel Blob · Resend/SMTP · GreenWeb/SSL Wireless · OpenAI-compatible AI · Playwright.

## Quick start

```bash
cp .env.example .env
npm install
npm run make-defaults   # idempotent local image/default-data generation
npm run dev             # http://localhost:4000
```

For local development, leave `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` empty to use `./data/local.db`. Set a local `JWT_SECRET`; otherwise development uses an ephemeral secret and tokens become invalid after restart. Production requires remote Turso credentials, `JWT_SECRET`, and `FRONTEND_URL`.

Useful commands:

```bash
npm run typecheck       # strict TypeScript
npm run build           # typecheck + verify the unified SSR/Vercel asset graph
npm test                # all Node regression suites
npm run test:browser    # real Chromium against an isolated production-mode app
npm run db:init         # explicit idempotent schema/seed bootstrap
npm run db:backup       # local database backup helper
npm run bench:coldstart # synthetic remote cold-start budget benchmark
```

The browser harness uses the npm-hosted `@sparticuz/chromium` binary because some CI environments cannot reach `cdn.playwright.dev`. It starts HTTPS with a temporary certificate, an isolated temporary libSQL database, and test-only seeded accounts. No fixture API or production data is used.

## Unified architecture

```text
Browser / API client
        │
        ▼
Vercel app.ts  or  local src/dev.ts
        │
        ▼
src/application.ts — Helmet, same-origin policy, sessions, CSRF, EJS + API routers
        │
        ├── src/web/routes + views + public     (SSR and browser forms)
        └── src/routes → controllers → services → repositories → Turso
                                      ├── Vercel Blob / legacy Turso uploads
                                      ├── Resend → SMTP fallback + outbox
                                      ├── SMS provider adapters + hashed OTP
                                      └── AI / notifications / bounded SSE
```

`src/web/api.js` dispatches SSR API calls **in process**. There is no `BACKEND_URL`, frontend proxy server, duplicate service mapping, or same-application HTTP round trip. Browser forms and fetch requests share the same controllers, validation, authorization, and database transactions as bearer-token API clients.

See [Architecture](docs/architecture.md) and [Migration guide](docs/migration.md).

## Security highlights

- Session IDs rotate at login/registration and are destroyed at logout; sessions persist in Turso, not process memory.
- Cookie-based mutations require CSRF tokens and an allowed origin. `Origin: null`, foreign origins, tokenless requests, and query-string tokens are rejected.
- Bearer APIs remain stateless and are not forced through browser CSRF checks.
- Admin mutations are POST-only; legacy mutation GETs do not change state.
- Role and permission checks are enforced server-side. Hiding an admin link is never the authorization check.
- Helmet CSP, secure cookies in production, bounded request bodies/uploads, masked integration status, and leak-free error envelopes are enabled.
- `Referrer-Policy: same-origin` suppresses cross-site referrers while preserving valid native form `Origin` headers. Do not replace it with `no-referrer`: browsers can serialize those form posts as `Origin: null`.
- Password reset and verification responses do not reveal whether an account exists. OTPs are HMAC-hashed, expiring, throttled, and never returned or logged.

See [Security](docs/security.md).

## Storage and uploads

Set `BLOB_READ_WRITE_TOKEN` to store new public objects in Vercel Blob. Without it, development and legacy installations retain the Turso BLOB fallback. Upload metadata is stored in Turso either way. Stable `/uploads/:filename` URLs serve local rows or redirect to remote objects, so existing content does not need a URL rewrite. Deletion and branding replacement coordinate metadata and remote-object cleanup.

Blob is **not** a private-media access-control layer: uploaded objects are public by design. Keep the token server-side and do not upload secrets or sensitive documents.

See [Storage](docs/storage.md).

## Email, SMS, and AI

- **Email:** Resend is primary; configured SMTP can be selected or used after Resend failure. Messages are persisted in a durable outbox with dedupe keys and provider IDs. Unconfigured mail is reported honestly.
- **SMS:** `disabled`, `greenweb`, and `sslwireless` adapters are available. Bangladesh numbers are normalized before use. A disabled provider returns `SMS_NOT_CONFIGURED`; tests never simulate paid delivery.
- **AI:** Groq/OpenAI-compatible configuration is available through environment defaults and the admin panel. Stored admin AI settings take precedence. Calls have total interaction deadlines and controlled unconfigured/error responses.

Provider setup, test limitations, and operational endpoints are in [Providers](docs/providers.md).

## Payments are manual verification

BloodOra records payment submissions and an admin-reviewed ledger. It does **not** treat a browser return URL, screenshot, transaction ID, or client-provided amount as proof of payment. Prices are calculated server-side, and only an authorized admin can confirm a manual transaction. Hosted gateway signatures and automatic settlement are not implemented.

Admin payment listings use bounded SQL pagination, optional status filtering, joined usernames, and an actual total rather than N+1 lookups.

See [Payments](docs/payments.md).

## Vercel deployment

The application deploys as one function with EJS templates and static assets included:

```json
{
  "functions": {
    "app.ts": {
      "memory": 1024,
      "maxDuration": 10,
      "includeFiles": "{views/**,public/**}"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/app" }]
}
```

`app.ts` exports the Vercel handler. Only `src/dev.ts` owns a local listening server. `FUNCTION_MAX_DURATION_MS` must match `maxDuration`; operation deadlines are clamped to the remaining budget. Keep the function region near Turso.

**Initial rollout must use a preview deployment.** Do not overwrite the existing production projects or aliases until preview SSR, authentication, database, uploads, and provider checks pass. See [Deployment](docs/deployment.md).

### Health checks

```bash
curl -i https://YOUR_HOST/health       # process liveness; no DB dependency
curl -i https://YOUR_HOST/api/health  # bounded live DB probe
curl -i https://YOUR_HOST/login       # SSR page
```

`/api/health/live` is not a route. `/api/health` returns 200 with a connected database or a bounded 503 with a leak-free category such as `timeout`, `unreachable`, `auth_rejected`, or `not_configured`. Vercel Deployment Protection can intercept preview requests before Express; use an authorized bypass for automated preview checks without committing it.

## Testing and current verification

```bash
npm run typecheck
npm run build
npm test
npm run test:browser
npm audit --audit-level=high
```

Coverage includes deployment shape, invocation budgets, production-path workflows, remote-Turso transport behavior, AI sanitization, API contracts, v3 workflows, unified HTTP security, and real-browser responsive/auth/admin journeys. External provider calls are mocked or disabled in tests; a green suite is not evidence of real Resend, SMTP, SMS, or Blob delivery.

The latest local results and explicit release limitations are recorded in [Verification](docs/verification.md) and [Testing](docs/testing.md).

## Documentation map

| Document | Contents |
| --- | --- |
| [Architecture](docs/architecture.md) | Runtime, request flow, data boundaries, background work |
| [Migration](docs/migration.md) | Split-to-unified mapping, compatibility, rollout and rollback |
| [Deployment](docs/deployment.md) | Vercel/Turso setup, preview checklist, operations |
| [Providers](docs/providers.md) | Email, SMS, OTP, AI configuration and limitations |
| [Payments](docs/payments.md) | Manual ledger, pricing, confirmation, reconciliation |
| [Storage](docs/storage.md) | Blob/Turso selection, aliases, limits, deletion |
| [Security](docs/security.md) | Sessions, CSRF/CORS, RBAC, CSP, secrets, abuse controls |
| [Testing](docs/testing.md) | Suites, isolated data, browser setup, provider mocks |
| [Verification](docs/verification.md) | Latest evidence and remaining external validation |

## Operational notes

- Bootstrap is idempotent: additive schema migrations, settings/content seeds, RBAC/navigation catalogues, and optional super-admin provisioning.
- Business state lives in Turso. Rate-limit windows may be best-effort per instance and are not a substitute for provider-side controls.
- SSE polls durable state and closes before the function limit; clients should reconnect or poll.
- Root `/uploads/` is generated scratch space. Do not broaden its anchored ignore rule to also hide real `src/uploads/` source.
- Never commit `.env`, database files, Vercel tokens, provider credentials, OTPs, session cookies, or protection-bypass secrets.
