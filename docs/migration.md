# Split-to-unified migration guide

## Source baselines

The migration preserved the original frontend at `d130725` and backend at `860965f` as immutable local baselines during development. The unified branch imports their application code and assets, not their Git metadata. Existing Vercel projects, production aliases, domains, environment variables, and production Turso data were not modified by local migration work.

## What changed

| Former split design | Unified design |
| --- | --- |
| Separate EJS frontend and API servers | One Express app from `src/app.ts` |
| `BACKEND_URL` and frontend HTTP proxy | `src/web/api.js` in-process dispatch |
| Two Vercel functions/projects | One `api/index.ts` function with all routes |
| Separate session/proxy assumptions | One Turso-backed browser session plus stateless bearer APIs |
| Frontend-only route/API mappings | Shared controllers, services, repositories, and validation |
| Remote branding dependencies | Local default logo/favicon/assets |
| Ephemeral/function-missing view risk | Explicit `views/**` and `public/**` bundle inclusion |
| Legacy admin GET mutations | POST-only mutations with CSRF; legacy GETs are inert |
| Database-only new uploads | Vercel Blob when configured, Turso fallback otherwise |

Removed or unmounted legacy components include the old split `server.js`, `BACKEND_URL` proxy, development session fallback, and custom cookie store. Do not reintroduce them as a shortcut around unified integration failures.

## Compatibility retained

- Existing EJS pages, static URLs, public pages, API paths, admin sections, and localized content remain available.
- Existing `/uploads/:filename` references work for database-backed and Blob-backed rows.
- Existing Turso upload BLOB data is not rewritten by the additive storage migration.
- Bearer-token API clients remain stateless and do not need browser CSRF tokens.
- Unknown `/api/*` routes return JSON 404s; unknown site routes retain the custom EJS 404.
- Branding database `NULL` values fall back to local defaults rather than blank images.
- Local and test databases remain supported; production uses remote Turso.

## Database rollout

1. Back up production Turso using the normal operational backup process.
2. Run the preview against an isolated preview database first.
3. Let the idempotent bootstrap apply additive columns, indexes, seeds, RBAC, and navigation catalogues.
4. Verify admin status, existing users/sessions policy, orders/payment rows, content, and old upload aliases.
5. Only after preview acceptance, plan the production deployment and database bootstrap window.

No destructive table rename or upload-data rewrite is required. Session invalidation can still occur operationally when secrets change or old sessions are intentionally revoked; communicate that separately from schema migration.

## Preview rollout checklist

- Create a new preview deployment from the unified branch without promoting it.
- Use a preview Turso database or an explicitly approved isolated schema/data copy.
- Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, and canonical preview `FRONTEND_URL`.
- Set `BLOB_READ_WRITE_TOKEN` only on the intended preview project; use a provider test mode where available.
- Keep SMS disabled and email unconfigured until delivery recipients and costs are approved.
- Verify `/health`, `/api/health`, SSR login/registration, CSRF rejection, user/admin RBAC, logout, old upload aliases, multipart upload, storage metadata, and admin integrations.
- Inspect Vercel logs for bootstrap, deadline clamps, provider failures, and missing assets.
- Run browser responsive checks in Bangla and English.
- Do not point production DNS/aliases at the preview during validation.

## Production cutover

After explicit approval, deploy the same validated commit to the intended production project and apply production-only environment values. Recheck health and critical read paths before write flows. Keep the prior production deployment available for immediate platform rollback.

A platform rollback does **not** reverse additive database changes or sent email/SMS. Because the schema changes are additive, the previous application can generally continue reading existing tables, but this must be verified against the actual production baseline before cutover.

## Rollback triggers

Roll back the deployment if preview/production shows persistent database auth failures, missing EJS/static assets, broken authentication rotation, CSRF false positives on same-origin forms, authorization bypass, missing old uploads, or unbounded provider/request behavior. Do not weaken CORS, accept `Origin: null`, disable CSRF, or simulate provider success to make a rollout appear healthy.
