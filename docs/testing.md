# Testing

## Commands

```bash
npm run typecheck
npm run build
npm test
npm run test:browser
npm audit --audit-level=high
```

`npm test` runs the complete Node sequence: unit/integration, deployment shape, invocation budget, production-path E2E, remote-Turso transport, AI, API contract, and v3 workflows. Run suites independently while debugging with the corresponding `test:*` scripts in `package.json`.

## Isolation

Tests use temporary local libSQL databases, controlled environment variables, local HTTP servers, and mocked/disabled external providers. They do not require or modify production Turso, Vercel aliases, domains, environment variables, or real paid-provider accounts.

Do not point a test command at production credentials. Do not weaken assertions, CORS, CSRF, RBAC, validation, or timeouts to make an environment issue disappear.

## Unit and unified HTTP tests

`test/unit/*.test.mjs` covers account/security behavior, deployment/frontend invariants, localization/content, integrations, and the real unified HTTP stack. The unified HTTP tests verify session rotation, CSRF, same-origin referrer policy, opaque-origin rejection, invalid phone persistence protection, SMS-disabled behavior, generic recovery, mocked outbox dedupe/provider IDs, JSON API 404s, and liveness.

## Production-path Node suites

The deployment and budget suites check the one-function entrypoint, included EJS/static assets, absence of split proxy dependencies, and deadline clamps. Production E2E covers auth/RBAC, secure sessions, server-priced orders, manual payment confirmation, support dedupe, bounded SSE, unconfigured AI, JSON errors, and token revocation.

Remote transport tests emulate/classify Hrana-over-HTTP behavior, including token rejection, server errors, SQL constraints, and timeouts. These are transport tests, not proof that a particular production Turso database is healthy.

## Real Chromium suite

`npm run test:browser` launches Playwright with `@sparticuz/chromium` and its bundled Amazon Linux shared libraries. This avoids the blocked Playwright CDN in the sandbox. The harness:

- starts the real unified app in production mode on HTTPS port 4599;
- creates a temporary self-signed certificate and isolated temporary database;
- seeds test-only user, admin, and super-admin accounts;
- uses no split server or fixture API;
- checks anonymous redirects/custom 404, secure sessions, reload/new-tab/history, profile persistence and invalid phone rejection, RBAC, all connected admin sections, logout revocation, safe return URLs, registration, CSRF/SMS, generic recovery, and Bangla/English layouts at mobile/tablet/laptop/desktop widths.

Playwright writes screenshots/traces only under ignored `.tmp/browser-results/` on failure. A verified dashboard screenshot is also written under `.tmp/`.

If `cdn.playwright.dev` is reachable in another environment, a stock Playwright browser can be selected through the existing browser executable configuration. Do not repeatedly retry a blocked CDN in the restricted sandbox.

## External checks are separate

The following require explicit preview/provider validation and are not claimed by automated local tests:

- real Vercel Blob writes, redirects, replacement, and deletion;
- real Resend and SMTP delivery/fallback to controlled mailboxes;
- real GreenWeb/SSL Wireless delivery, sender registration, receipts, and costs;
- production Turso health and latency;
- Vercel preview deployment/protection behavior;
- external payment settlement (the app implements manual review only).

Record external evidence, date, environment, and redacted provider IDs separately from mocked test results.
