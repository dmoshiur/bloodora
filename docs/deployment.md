# Deployment and operations

## Prerequisites

- Node.js 20+ and npm.
- A Turso/libSQL database for preview/production.
- A Vercel project connected to the unified repository/branch.
- Optional Vercel Blob, Resend/SMTP, SMS, and AI credentials.

Run locally before deploying:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run test:browser
npm audit --audit-level=high
```

## Vercel shape

`vercel.json` declares exactly one function, `api/index.ts`, with 1024 MB memory, a 10-second maximum duration, and `views/**` plus `public/**`. A single rewrite sends all paths to that function. Do not add a legacy `routes` array, a second unreachable function, or a separate frontend proxy.

The function and Turso database should be in nearby regions. Remote SQL latency is dominated by HTTPS round trips; batching and warm-catalogue fingerprints reduce cold-start work but cannot remove geographic latency.

## Environment configuration

Required in production:

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | Remote `libsql://…` URL |
| `TURSO_AUTH_TOKEN` | Database token with only required access |
| `JWT_SECRET` | Long random secret, ideally `openssl rand -hex 32` |
| `FRONTEND_URL` | Canonical public HTTPS origin; optional comma-separated external API origins |

Production forces Secure cookies. Set `COOKIE_DOMAIN` only when a shared parent-domain cookie is intentionally required. Do not set it to an unrelated domain.

Optional services are disabled/unconfigured until their variables are supplied. See [Providers](providers.md) and [Storage](storage.md). Keep all secrets in Vercel environment settings, never in EJS, browser JavaScript, Git, or documentation.

`FUNCTION_MAX_DURATION_MS=10000` must match `maxDuration: 10`. If a plan and workload justify a different limit, change both together and rerun `npm run test:budget`.

## Preview-first procedure

1. Push the unified working branch.
2. Create a **preview** deployment from that branch.
3. Configure isolated preview resources and environment values. Do not alter existing production aliases, domains, variables, or Turso data.
4. If Deployment Protection is enabled, use Vercel's authorized preview-bypass mechanism for automation. Never commit the bypass secret.
5. Run the smoke checks below and inspect function logs.
6. Exercise auth, RBAC, admin pages, forms, uploads, old aliases, localization, responsive layouts, and provider-disabled behavior.
7. Only after approval, deploy the validated commit to production and perform the production checks.

## Smoke checks

```bash
BASE=https://YOUR_PREVIEW_HOST
curl -fsS "$BASE/health"
curl -fsS "$BASE/api/health"
curl -fsS "$BASE/login" >/dev/null
curl -fsS "$BASE/register" >/dev/null
curl -fsS "$BASE/public/favicon.svg" >/dev/null || true
```

Expected behavior:

- `/health`: process liveness without a database dependency.
- `/api/health`: 200 with connected database; otherwise a bounded, actionable 503.
- `/login` and `/register`: EJS HTML, not a platform 404 or function error.
- Unknown API path: JSON 404. Unknown site path: custom HTML 404.
- Response headers include CSP and `Referrer-Policy: same-origin`.
- Native same-origin form POSTs succeed with a valid session/CSRF token; tokenless, foreign-origin, and `Origin: null` mutations fail.

Use `/health`, not `/api/health/live`, for liveness.

## Bootstrap and provisioning

The first data request runs idempotent schema and seed bootstrap. Optional `SUPER_ADMIN_*` variables provision the first super-admin. Remove or rotate bootstrap credentials after provisioning according to operational policy. Do not expose them in logs or screenshots.

For an explicit local/operational bootstrap, use `npm run db:init` with the intended environment. Back up production before schema rollout. `npm run db:backup` is a helper, not a substitute for a verified remote backup/restore procedure.

## Logs and incidents

Logs should identify request IDs, dependency categories, bootstrap state, budget clamps, and provider outcomes without passwords, cookies, tokens, OTP plaintext, or full recipient details. During a Turso outage, expect 503 dependency responses and circuit-breaker behavior rather than generic 500s.

If Vercel returns HTML `FUNCTION_INVOCATION_TIMEOUT` or `FUNCTION_INVOCATION_FAILED`, inspect platform logs and configuration first; those responses occur outside the normal application JSON envelope.

## External validation still required

Local tests do not prove real paid/provider behavior. Before enabling production delivery, perform separately authorized low-volume checks for Blob write/read/delete, Resend and SMTP fallback, each selected SMS adapter, sender IDs, delivery receipts, costs, and failure handling. Payment ledger checks require admin reconciliation; no hosted gateway webhook exists.
