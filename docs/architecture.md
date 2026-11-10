# Architecture

## One deployable application

BloodOra combines the former EJS frontend and TypeScript API into one Express application. `src/application.ts` builds the middleware and router graph. `src/dev.ts` is the only module that calls `listen()` for local development; `app.ts` adapts the same app to Vercel without listening.

The production build verifies 21 SSR modules and 62 EJS templates, local static assets, and the single function entrypoint. `vercel.json` includes `views/**` and `public/**` in the function bundle.

## Request flow

1. Platform probes `/health` and `/api/health` bypass unnecessary session/bootstrap work. `/api/health` performs a bounded database query.
2. Helmet applies CSP and browser security headers.
3. Same-origin browser requests bypass cross-origin CORS processing; configured external origins use the credentialed CORS allow-list. Foreign and opaque origins are rejected.
4. JSON and URL-encoded parsers apply bounded body sizes. Multipart routes apply their own file limits.
5. Turso-backed `express-session` loads browser sessions. Bearer authentication remains available for API clients.
6. CSRF middleware protects cookie-authenticated mutations. Browser forms receive per-session tokens in hidden fields and a meta tag for AJAX.
7. EJS routes call `src/web/api.js`, which executes API handlers in process with request-local context. It does not make an HTTP request to the application itself.
8. Controllers validate input, services enforce business rules, and repositories own SQL. Errors use a consistent JSON envelope or render the appropriate SSR error page.

## Main directories

| Path | Responsibility |
| --- | --- |
| `app.ts` | Vercel function export and startup failsafe |
| `src/application.ts` | Unified middleware/router composition |
| `src/dev.ts` | Local HTTP server and warm development bootstrap |
| `src/web/` | EJS routes, in-process API bridge, localization, browser middleware |
| `views/`, `public/` | SSR templates and static browser assets |
| `src/routes/`, `src/controllers/` | API transport and input handling |
| `src/services/` | Business rules and provider coordination |
| `src/repos/` | SQL persistence and bounded paginated queries |
| `src/db/` | Schema, additive migrations, bootstrap, timeout and breaker logic |
| `src/integrations/` | Email/SMS provider adapters and phone normalization |
| `test/unit/`, `tests/`, `e2e/` | Unit/integration, production-path, and real-browser verification |

## Persistence and consistency

Turso is the source of truth for users, sessions, catalogue/content, orders, requests, messages, notifications, payment transactions, integration metadata, email outbox rows, OTP records, and upload metadata. Business state is not held in serverless process memory.

Schema bootstrap is idempotent and additive. Existing upload BLOB rows remain valid when remote metadata columns are added. Catalogue fingerprints avoid unnecessary seed writes on warm databases. Batches reduce remote round trips; transactions preserve multi-step invariants.

The only intentionally ephemeral controls are best-effort process-local rate-limit windows. They must not be treated as globally exact quotas.

## External dependencies

- **Blob:** public object storage for new uploads when configured; Turso BLOB fallback otherwise.
- **Email:** Resend primary with configured SMTP fallback, plus durable outbox/dedupe metadata.
- **SMS:** bounded GreenWeb and SSL Wireless adapters; disabled by default.
- **AI:** OpenAI-compatible provider with total interaction deadlines and stored admin configuration.
- **Payments:** internal manual-review ledger, not a hosted payment gateway.

Every network dependency has a bounded path or is explicitly reported unconfigured. Tests do not claim real external delivery.

## Deadlines and failure behavior

`FUNCTION_MAX_DURATION_MS` mirrors Vercel `maxDuration`. `RESPONSE_RESERVE_MS` leaves time to flush the response. `UPSTREAM_RESERVE_MS` preserves compatibility with external callers that themselves have a deadline; unified SSR no longer needs an internal HTTP hop.

Database statements, batches, bootstrap waits, health probes, sessions, SMTP, SMS, uploads, AI, SSE, and whole requests are bounded. Per-call clamps use the remaining request budget. Dependency transport failures become retryable 503 responses rather than generic application crashes. SQL constraint errors retain their business meaning.

SSE endpoints poll durable state and close cleanly before the invocation limit. They do not depend on shared memory between function instances.

## Payments and authorization boundaries

Server-side services calculate order prices and scope user data to the authenticated identity. Payment confirmation is an authorized admin mutation. Admin transaction listing performs bounded joined SQL with status filters and real totals. RBAC checks run on the server for every protected page and mutation; navigation visibility is only a user-interface concern.
