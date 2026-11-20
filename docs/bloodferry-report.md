# BloodFerry engineering report

Date: 2026-11-20
Branch: `arena/f650583c-bloodora`
Base: `018469d9c7ac1a21d6795dc42a453398e99fb45f`

## Release assessment

**Substantial backend repairs and the rebrand are implemented, but the complete requested platform is NOT yet production-accepted.** Local application, database, HTTP and browser tests pass. Live external delivery, a production deployment, dedicated hospital/organization screens, and all remaining gaps below are not claimed as completed. The continuation implemented institutional registry/membership/request APIs without changing page layouts; see [institutions.md](institutions.md).

No production database, DNS, deployment alias, hosting settings or external provider credentials were changed. No production user records were accessed. Tests used local libSQL databases. The existing single Express application, EJS pages, route/controller/service/repository structure, CSS, typography, navigation and responsive layouts were retained.

## 1. Repository and original feature inventory

The actual stack is Node 22 (package engine), TypeScript, Express 4, EJS, libSQL/Turso, express-session with a database store, Zod, Multer, Resend/SMTP, GreenWeb/SSL Wireless and Vercel Blob. There is no separate frontend server or React application. `src/web/api.js` dispatches SSR domain calls in-process. Root `app.ts` is the single Vercel entrypoint; `src/dev.ts` serves local development.

The repository already contained substantial backend infrastructure and extensive tests. It was not a frontend-only shell. Replacing that infrastructure would have introduced unnecessary risk. The audit included package/lock files, routes, controllers, services, repositories, schema/bootstrap/seed logic, middleware, session storage, provider adapters, EJS integrations, tests and deployment documentation. Route declarations are catalogued in [bloodferry-routes.md](bloodferry-routes.md).

Status labels below refer to the original implementation and the assessed implementation after this work. WORKING means the covered local paths work, not that external production services were verified.

| Feature | Original assessment | Current assessment and evidence |
| --- | --- | --- |
| Express entrypoint, SSR gateway, health and DB deadlines | WORKING | Retained; deployment, budget, remote-transport and build tests pass |
| Schema initialization and additive migrations | WORKING | Extended additively; repeated migration preservation test passes |
| Registration, login, logout, session persistence | PARTIALLY WORKING | Covered HTTP/browser journeys pass; fixed first-public-production-user administrator escalation |
| Password hashing/reset/change | PARTIALLY WORKING | Existing bcrypt/token flows retained; new passwords limited to bcrypt's 72-byte UTF-8 boundary |
| Email verification/recovery delivery | PARTIALLY WORKING | Token/outbox and failure paths covered locally; real delivery requires credentials |
| Profiles, localization, preferences | PARTIALLY WORKING | Existing edits/localization pass; public identity/payment data exposure removed |
| Donor registration/availability/search | PARTIALLY WORKING | Profiles and location/group filters retained; self-reported adult age no longer grants donor verification |
| Donor verification | PARTIALLY WORKING | Existing authorized admin verification retained; new registrations await review |
| Blood groups | WORKING | Existing constant catalogue and request validation retained; no duplicate lookup table created |
| Blood request creation/search/emergency listing | PARTIALLY WORKING | Validated date/BD phone; atomic donor/admin in-app notifications; existing UI unchanged |
| Request approval, fulfillment, cancellation | BROKEN | Conditional transactional state transitions and owner/permission checks added |
| Donation records and donation history | BACKEND MISSING | New authorized recording and owner-scoped paginated history APIs, with audit and notifications; dedicated UI wiring remains |
| Donor matching | PARTIALLY WORKING | Exact group/district/availability/verified-profile matching for in-app alerts; not clinical compatibility or confirmed availability |
| Hospitals | PARTIALLY WORKING | Approved registry, private applications, review/suspension and registry-linked request APIs now implemented; dedicated screens remain |
| Organizations | PARTIALLY WORKING | Shared institutional registry, owner/manager/volunteer memberships, scoped request summaries, versioned changes, audit and notifications implemented; dedicated screens remain |
| Volunteer/hospital/organization roles | PARTIALLY WORKING | Non-admin domain account roles seeded; institutional permissions require separate memberships and never follow from the global role alone |
| User/private messaging | BROKEN access control | Read/original/reply ownership and admin-desk boundaries repaired and tested |
| Anonymous urgent contact | FRONTEND success with no persisted operation | Now inserts an unverified guest message into the actual admin inbox |
| Human live support | PARTIALLY WORKING | Existing session-key/SSE/polling/deduplication tests pass; capability-key design retained |
| AI configuration/provider calls | PARTIALLY WORKING | Compatible provider integration retained and hardened; live credentials unverified |
| AI conversations/history | BROKEN ownership and durability | Server-owned conversations, atomic turn writes, retrieval and duplicate-request guards added |
| AI streaming | NOT IMPLEMENTED | Responses remain non-streaming; live-support SSE is not AI token streaming |
| In-app notifications | PARTIALLY WORKING | Existing read/unread/deduplication retained; request and donation events now persist |
| Email and SMS adapters | PARTIALLY WORKING | Existing real adapters retained; disabled/error/provider-contract tests pass, no live delivery claim |
| Products/cart/checkout/orders | WORKING in covered local paths | Existing server-side pricing, inventory, ownership and cancellation tests pass |
| Payments | PARTIALLY WORKING | Manual-review ledger and authorized confirmation retained; no automated gateway settlement |
| Admin statistics/users/content/orders/settings | PARTIALLY WORKING | Existing admin sections render and covered operations pass; secret exposure and RBAC empty-grant fallback fixed |
| Uploads | PARTIALLY WORKING | Existing validation/storage/legacy alias tests retained; real Blob delivery unverified |
| Reviews/content/navigation | WORKING in covered local paths | Existing tests pass; public branding strings updated |
| Backup/recovery | PARTIALLY WORKING | Backup now reads a consistent snapshot without running migrations first; production restore drill remains |
| Public branding | Old brand | BloodFerry strings, exact supplied logo, derived favicons and one-time settings migration |

## 2. Root causes and concrete repairs

### Critical security findings

- `/api/meta/settings` and `/api/meta/home` returned internal settings, including stored AI and SMTP secrets. Public projections now exclude provider credentials/internal mail settings. The admin settings-service response also no longer includes raw AI/SMTP secrets.
- Message read, original-message and reply operations checked login but not whether the caller participated in the conversation. They now enforce participant access; permission-holding desk staff may access desk messages, not arbitrary user-to-user messages.
- AI chat accepted `user_id` from the request and reconstructed history from any supplied conversation ID. Ownership is now resolved exclusively from authenticated identity or a random value in the server-side guest session.
- Public donor/profile responses exposed identity documents, financial fields, contact details and account metadata. Public projections now omit private fields. Contact details are shown only on authenticated profile reads of available, verified donor profiles; directory responses remain redacted. A more granular consent/contact-release policy remains a release decision.
- The first public production registration became a super administrator. Production registration now always creates a normal user. Bootstrap administrators must be provisioned explicitly through existing `SUPER_ADMIN_*` configuration. Development retains the legacy first-account behavior.
- An empty permission set restored built-in role defaults, defeating complete revocation. Empty grants now remain empty (fail closed).
- Public activity could disclose private message subjects/admin events. The public feed and stream now use a public-event allowlist.
- Request-error/access logs could include query strings containing reset tokens. Paths are now logged without queries; access logs omit referer URLs. AI upstream error bodies are no longer logged.
- AI configured endpoints could be used to send stored provider credentials to arbitrary URLs. HTTPS Groq/OpenAI hosts and explicitly operator-approved hosts/origin are now enforced; redirects are rejected. **`AI_BASE_URL` is an operator-trusted origin, so operators must use HTTPS and never populate it from user input.**

### Additional continuation security findings

- Non-default role names previously implied global administrator status. Seeded domain roles now remain non-admin; scoped institutional roles never modify the global user role/flags. Custom administrative roles continue to use their actual grants.
- Admin mail-outbox views returned reset/verification links, enabling account takeover by mail operators. Views now return metadata only; protected bodies remain available to the delivery worker. Reset/verification tests read only the isolated fixture mailbox instead of relying on this leak. External `V3_BASE` runs require an explicitly designated isolated `V3_TEST_DB_FILE`; never point the mutating suite at production.
- SMS deduplication previously returned success even if the prior send failed or was still unconfirmed. It now uses the original delivery row/ID and reports success only for provider-accepted records. No blind paid-provider retry was added.
- Administrative user edits treated `"0"`/`"false"` as true, accepted short passwords and could change flags without the separate role-assignment grant. Validation and permission checks now precede all writes; account/profile changes and their audit entry commit together. Changed contacts clear verification, and password/role changes revoke the old session. Editing an administrator requires role-assignment permission.

### Functional failures

- AI history returned the first N turns instead of the most recent N. It now selects the newest rows and returns them in chronological order.
- AI persistence was best-effort: partial/missing transcripts could still produce success. User/assistant turns, submission response and conversation timestamp now commit together.
- AI history was pruned to 300 conversations during chat and maintenance. Automatic transcript pruning has been removed.
- Frontend/provider retry layers could multiply calls. The SSR retry loop no longer retries the already-bounded service call. Widget retries use a stable request ID for the same submission.
- The legacy ask endpoint did not enforce disabled AI settings. It now does.
- Seeded AI provider/model/base URL values shadowed environment configuration on new installs. New defaults are empty and fall back to environment settings. Existing saved deployment settings are deliberately preserved; operators must review them.
- Request cancellation set `is_fulfilled=1`; admin status edits did not reconcile flags. Status, fulfillment flags, timestamps and notifications now change transactionally.
- Requests could move from cancelled/fulfilled back into other states without checks. Terminal transitions now return 409.
- Any authenticated user could mark another person's request fulfilled. Only the requester or authorized administrator can confirm fulfillment through that route.
- Personal request history filtered the latest global 100 rows in memory. It now queries the owner's records directly.
- A joined admin request query used an ambiguous `created_at` sort. It now qualifies the blood-request column.
- Urgent contact returned success for anonymous users without sending/storing anything. It now persists a real guest inbox item. Guest contact information is explicitly marked unverified.
- Turning donor availability off used to stamp a donation date without a recorded donation. Availability changes now leave donation history untouched.
- Age alone marked new donors verified. New profiles are not verified until existing admin review approves them. Historical flags were not reset.

## 3. Database changes and safety

New additive tables/indexes:

- `schema_migrations`: tracks the one-time branding migration.
- `ai_conversations`: conversation owner key, optional user FK and timestamps; owner/timestamp index.
- `ai_submissions`: conversation FK, composite unique request identity, status, message and completed response. Identical successful retries return the stored result; conflicting/repeated unresolved submissions return 409.
- `donations`: donor/request/recording-actor FKs, units constraint, unique idempotency key, timestamps; donor/date and request indexes.
- `organizations`: one registry for hospital and organization kinds, review state, public-contact consent, versions and per-applicant idempotency.
- `organization_members`: user/institution FKs, owner/manager/volunteer roles, active status, composite primary key and user-access index.
- `blood_requests.institution_id`: nullable additive FK plus index; old free-text hospital names remain compatible. The request transaction checks current membership and approval; hospital-linked names come from the registry.

Existing users, profiles, blood groups, requests, notifications, payments, messages, settings, roles and audit tables are reused. There is no user-table replacement, production reset or drop. Existing AI messages are preserved; legacy conversation IDs with untrustworthy ownership cannot be claimed by a new caller. They remain available through the existing authorized admin summary, not automatically assigned to users.

The one-time brand migration changes the old default brand name, tagline, logo/favicon settings and old brand text in selected settings. Other site settings are retained. Subsequent admin branding edits are not overwritten by the one-time logo migration.

Request creation now inserts matching donor notifications and an admin notification in the same transaction. Matching requires exact blood group and district, availability, donor verification and in-app preference. It does not query or promise medically verified matches. Fulfillment/cancellation/approval notifications share the status transaction.

Donation recording atomically adds the record, updates the donor's latest donation date, sets availability off, and inserts a notification and audit event. Recording does **not** imply clinical approval or automatically fulfill a blood request.

`db:backup` no longer bootstraps/migrates before copying data. It exports schema/data in a read transaction, tags binary fields with base64 and writes owner-only files (0600). This is a local export utility, not a substitute for managed Turso snapshots/PITR. Large exports may exceed configured database deadlines and should use provider-native tooling.

## 4. Repaired and added APIs

Existing contracts were retained where safe. Intentional security changes return 404 for unrelated message/conversation access, 403 for unauthorized request fulfillment, and 409 for invalid terminal transitions/conflicting submissions.

- `POST /api/ai/chat`: accepts existing message/conversation/language fields plus optional `request_id`. Submitted `user_id` is ignored. Clients should supply a stable conversation ID and request ID before sending to obtain retry deduplication.
- `GET /api/ai/conversations`: latest 100 conversations owned by the current user/session.
- `GET /api/ai/conversations/:id/messages`: latest 100 messages in chronological order, owner enforced.
- Existing `/ai-help/chat` forwards the request ID and preserves existing widget response shape. The widget can reload the most recent owned conversation into its existing layout; reset starts a new conversation.
- `POST /api/donations`: authenticated `requests.moderate` permission required. Body: `donor_id`, optional `request_id`, `donated_at`, `blood_group`, integer `units` (1–10), optional `note`, `request_idempotency_key` (8–128 safe characters). Dates must be valid and not future dates.
- `GET /api/donations/mine?limit=25&offset=0`: authenticated donor's records only; limit capped at 100.
- `GET /api/admin/donations`: `requests.view` required; `donor_id`, `request_id`, `limit`, `offset` filters with real total count. `POST /api/admin/donations` aliases the authorized recording operation.
- `/api/organizations` and `/api/hospitals`: validated public directories, private applications, owner lists, scoped edits, memberships and request operations. `/api/admin/organizations` and `/api/admin/hospitals` provide reviewed/admin lists and review aliases; see [the full API contract](institutions.md).
- Existing blood-request status, fulfill, cancel, contact and mine endpoints use the repaired service/repository logic.
- Existing metadata/profile/message endpoints use repaired privacy/ownership rules.

## 5. Authentication and authorization results

Existing registration/login/logout, profile edit, secure persistent sessions, CSRF, password reset and verification token machinery were retained. Local tests cover revoked bearer tokens, cookie rotation/persistence, role denials, invalid profile phone input, tokenless form rejection and password recovery's non-enumerating response.

Additional regressions cover production first-user privilege prevention, private-message IDOR, conversation IDOR, spoofed AI user IDs, request moderator permissions, donation recording permissions, complete permission revocation, institutional ownership/review/roster isolation, domain roles, mail-token redaction and truthful SMS duplicate results.

Domain account roles (donor, recipient, volunteer, organization, hospital) now carry only ordinary account/AI access by default. Hospital/organization business access is membership-scoped; dedicated dashboards remain unwired. The existing five-second permission cache remains; cross-instance permission revocation is not instantaneous. Donor verification is an administrative profile flag, not medical certification. Account suspension/appeal workflows need a dedicated implementation/review.

## 6. AI implementation and verification

The real OpenAI-compatible HTTP integration remains backend-only and supports Groq. Default model for new installations is `llama-3.3-70b-versatile`; operators must verify model availability with their provider. Existing saved model selections are not silently overwritten. Provider errors, missing credentials, disabled settings and deadlines return explicit errors rather than fake responses.

Both AI chat/ask routes now use shared database-backed rate limiting. Provider calls have bounded body reads and invocation budgets. Stored assistant text is sanitized before persistence. System guidance explicitly forbids invented donor availability, matches, diagnoses or completed transactions.

Automated tests use a clearly labelled provider stub to verify request construction, sanitization, persistence, ownership, multiple conversations, duplicate requests and failure timing. **These are not live Groq/OpenAI verification.**

No token streaming has been added. The existing widget receives complete answers, consistent with the 10-second deployment budget. An unresolved/failed submission ID is not automatically replayed against a billed provider: retrieve history and explicitly submit with a new ID. A crash after a provider call but before commit cannot guarantee provider-side exactly-once billing. Legacy anonymous histories cannot be safely reassigned. The existing widget has no all-conversations picker; the API supports listing/history and the widget restores the latest conversation.

## 7. Blood donation workflow results

Isolated HTTP/database regression tests cover:

1. Register real users and create authenticated sessions/tokens.
2. Reject invalid needed-by dates.
3. Create a blood request and query the owner's history.
4. Reject moderation by an ordinary user.
5. Approve through an authorized administrator.
6. Reject fulfillment by an unrelated user.
7. Cancel as the requester; verify `status='cancelled'`, `is_fulfilled=0` in the database.
8. Reject subsequent terminal-state mutation.
9. Verify the owner's persisted status notification.
10. Record a donation as an authorized actor; retry without duplicating the record.
11. Reject conflicting idempotency payloads and unauthorized recording.
12. Retrieve only the donor's history; verify availability off and the audit record.

Existing contract/browser tests cover login/profile edits/donor availability and donor search routes. Dedicated production donor-contact consent, clinician eligibility, geospatial radius matching, blood inventory and appointment scheduling are not implemented.

## 8. Email, SMS and notification status

Existing Resend primary / SMTP alternate selection, email outbox, GreenWeb/SSL Wireless adapters, OTP hashing, delivery records and user notification preferences were preserved. No delivery is simulated as a real provider success. Local suites exercise disabled/error/contract paths.

**Not verified externally:** Resend delivery, SMTP acceptance/inbox receipt, SMS sender authorization/receipt/cost, real OTP delivery and live Blob storage.

Blood request matching/status changes in this patch persist **in-app** notifications. Email/SMS fan-out for all new request/donation events is not fully wired; do not equate a database notification with email/SMS delivery. Urgent guest contact confirms inbox persistence, not an email being sent.

## 9. Admin and other modules

Existing admin sections, users, donor verification, content, products, orders, manual payment confirmation, roles/permissions, notifications, settings and support remain in place. Browser tests render every existing connected admin section under admin and super-admin accounts. Existing transaction and contract suites cover the principal mutations and ownership restrictions.

The donation record/history APIs now include an authorized, filtered/paginated admin list and aliases, plus real donation totals/history on the personal dashboard API; a dedicated admin form remains unwired. Hospital/organization management now has real validated APIs, not fabricated records: application, approval/rejection/suspension, scoped membership management and registry-linked blood requests. No dedicated institutional pages were added. The existing admin backup page remains informational; the repaired export is a CLI operation.

## 10. Branding and supplied logo

Public brand text was changed to **BloodFerry** across views, translation catalogues, backend user-facing messages, email/SMS templates and documentation. The Bangla meaning is **রক্ত বহনকারী**; tagline is **DONATE • TRANSFUSE • SAVE LIVES**.

Exact supplied file: `public/assets/brand/bloodferry-logo.png`.

SHA-256 of both owner upload and repository logo:

`742d561037826bb61aa592e0bebb67f1d2516c7092156f3795eb5e5063ffc878`

Legacy `/images/logo.png` and `/logo.png` aliases contain the same supplied image. PNG/ICO favicons are resized derivatives of that image, not a generated substitute. Header/footer asset references changed without changing their CSS, dimensions or positions. No PWA manifest was found. Existing metadata inherits the new brand/settings. Historical user-generated content and technical identifiers were not blindly rewritten.

The internal package name, cookie/session identifiers, API routes, database names and repository slug remain unchanged for compatibility. Existing contact email addresses were retained rather than inventing new inboxes. The supplied artwork has a different aspect ratio/whitespace from the old logo; it is intentionally not cropped or redrawn.

## 11. Security scope and remaining review

Addressed: exposed provider secrets, public profile data, message and AI IDOR, production first-user escalation, empty-grant RBAC bypass, AI endpoint trust boundary, sensitive query logging, public activity leakage, shared AI rate limits, bounded passwords and unsafe request state mutations.

Retained: parameterized repositories, CSRF/origin checks, secure cookies, backend role lookup, upload limits/type validation, server-side order pricing and explicit payment confirmation. `npm audit --audit-level=high` reports zero known dependency vulnerabilities for this lockfile.

This is **not a penetration-test certification**. Existing inline script allowances in CSP, support capability tokens, upload storage access, seed/demo catalog behavior, account suspension, legacy donor verification flags and consent/retention policies still require production security/product review. Existing seed products and payment merchant defaults must be reviewed before accepting real purchases; no automatic external payment settlement exists.

## 12. Build and test results

Executed locally on this branch:

| Check | Result |
| --- | --- |
| `npm ci` | Passed; lockfile retained |
| `npm run typecheck` | Passed |
| `npm run build` | Passed: 21 SSR modules, 62 EJS templates, one Vercel handler |
| Unit/integration tests | 112 passed (includes 29 new BloodFerry regression tests across the two repair passes) |
| Deployment tests | 129 passed |
| Invocation budget tests | 88 passed |
| Production-path local HTTP E2E | 65 passed |
| Remote-Turso transport stub | 56 passed |
| AI sanitization | 31 passed |
| API contract suite | 131 passed |
| v3 workflows | 169 passed |
| Total Node checks | 781 passed across suites |
| Playwright Chromium | 12 passed |
| Dependency audit | 0 known vulnerabilities |
| Backup smoke | Isolated export contains schema/data/new tables; permissions 0600 |
| Logo equality | Exact SHA-256 match |
| `git diff --check` | Passed |

The activity-stream test was updated to create an explicitly public fixture rather than depending on leaked private account events. Branding assertions now expect BloodFerry and the supplied asset. Production test accounts are explicitly granted admin rights in the isolated fixture after asserting public registration remains a normal user. The production E2E harness no longer deletes the repository's entire local `data/` directory.

Browser tests verify responsive behavior at existing mobile/tablet/laptop/desktop sizes; no pixel-diff claim is made. External transport stubs and local production-mode tests are not proof of hosted production connectivity.

## 13. Required external configuration

Copy `.env.example` locally; enter real secrets only in protected environment settings, never Git/chat.

- Runtime: `NODE_ENV`, `FRONTEND_URL`, persistent random `JWT_SECRET`, existing timeout settings.
- Durable DB: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Initial production admin: `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` and optional profile variables. Remove bootstrap password after successful provisioning under operator policy.
- AI: `AI_API_KEY` or compatible legacy `GROQ_API_KEY`; `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, optional `AI_ALLOWED_HOSTS`. Saved admin AI settings override defaults. Review old stored values before testing. Use HTTPS.
- Email: `RESEND_API_KEY`, verified `RESEND_FROM_EMAIL`, optional sender name; or complete existing `SMTP_*` configuration.
- SMS: configured `SMS_PROVIDER`, `SMS_API_KEY`, provider-required secret/sender settings; optional OTP pepper and provider URL.
- Files: `BLOB_READ_WRITE_TOKEN` for durable production uploads.
- Payments: operator-confirmed merchant numbers in protected admin settings; the existing ledger remains manual review.

## 14. Safe deployment and recovery procedure

1. Review this patch and the remaining product/security gates. Do not promote as a complete hospital/organization platform.
2. Obtain a provider-native production backup/snapshot **before** applying code or migrations. Restrict/encrypt exports; they contain personal data and credentials.
3. Restore that snapshot to a separate staging database. Never run tests or `db:init` against production merely to inspect it.
4. Configure staging secrets and explicitly provision the first administrator. Use a valid public origin and HTTPS. Configure a durable staging Turso database, not an ephemeral Vercel `/tmp` database.
5. Run `npm ci`, `npm run build`, `npm test`, then `npm run test:browser` sequentially (the deployment test probes a fixed browser-test port). Run `npm run db:init` only after confirming the intended staging URL.
6. Verify schema/migration markers and account counts. Review branding, existing AI DB overrides, merchant settings and donor verification records.
7. Deploy a preview using the unchanged `vercel.json`: one `app.ts` function, 10 seconds, bundled `views/**` and `public/**`, all requests rewritten to `/app`. No second server or internal HTTP base URL is needed.
8. Check `/health` (process) and `/api/health` (DB connectivity); test public pages, secure login/reload/logout, CSRF, donor review/search, request approval, notifications, products/orders/manual confirmation and unauthorized access rejection.
9. Perform actual provider tests: AI message/history/timeout, verified email receipt, SMS/OTP receipt and Blob round trip. Record provider IDs without publishing secrets. Tune budgets only with an explicitly approved hosting change.
10. Obtain owner approval before production deployment/alias changes. This session did not deploy or promote anything.
11. Roll back application code only with caution: the old build contains the security vulnerabilities documented above. Additive tables can remain. Prefer a fix-forward for code defects; use provider-native point-in-time recovery only under an authorized outage/recovery plan. Never drop the live database or automatically import a dump over production records.

The JSON backup includes schema and typed binary data but no automatic restore command; production recovery must be rehearsed into a new isolated database with count/relationship checks before any cutover. Existing deployment instructions in `docs/deployment.md` still apply except where this report records safer production admin provisioning and branding.

## 15. Remaining limitations / acceptance gates

- No live AI, email, SMS, Blob, production Turso or hosted preview verification was possible/claimed.
- Institutional registry, memberships and domain account roles are now implemented/tested. Dedicated hospital/organization UI pages remain unwired. Clinical credential verification is an operator responsibility, not inferred from API approval.
- Donation APIs are not connected to a dedicated existing admin form; historical donations cannot be reconstructed from self-reported `last_donation` without reliable source data.
- AI is non-streaming; latest-conversation restoration exists, but no all-conversations selector was added to the unchanged UI.
- Full request/donation email/SMS event fan-out remains incomplete.
- Donor contact consent/granular access, clinical eligibility, age/identity verification, suspension workflows and historical auto-verification flags need product/security decisions.
- Public request pages still intentionally contain requester-supplied contact information; consent and retention need review.
- Existing product/merchant seed defaults need production review. Payments are manual accounting, not automatic settlement.
- Existing tables were not comprehensively rebuilt to add every possible legacy FK; destructive rebuilding was avoided. Production data-quality and recovery rehearsal remain necessary.
- End-to-end exactly-once external AI billing is not guaranteed after a process crash. Pending submission IDs require explicit client recovery rather than blind replay.
- Responsive behavior is tested, but there is no before/after pixel comparison. Logo artwork itself differs as requested.

These are explicit incomplete acceptance criteria, not fabricated successes. The repository contains real implemented repairs and regression evidence; it should not yet be described as a fully completed production reconstruction.


## Continuation verification

Latest complete sequential run: build and TypeScript passed; **781 Node checks** passed (112 unit/integration, 129 + 88 + 65 + 56 specialized checks, 31 AI sanitization, 131 API contract, 169 v3 workflow checks); **12 Chromium browser tests** passed. Dependency audit reported zero known vulnerabilities. `git diff --check` passed. After formatting the new institutional/donation modules, TypeScript and all 16 continuation regressions passed again.

Evidence logs in this workspace session: `/tmp/bloodferry-continue-build2.log`, `/tmp/bloodferry-continue-tests2.log`, `/tmp/bloodferry-continue-browser.log`, `/tmp/bloodferry-formatted-tests.log`. These tests use isolated databases and controlled provider fixtures where appropriate; they are not proof of production Turso access, real SMTP/SMS delivery or live AI credentials. No production settings or credentials were changed.


## Mail reliability hardening — next production-readiness pass

The outbox previously selected rows without reserving them, allowing overlapping cron/inline sends to duplicate delivery. It now uses atomic shared-database claims, ten-minute leases, fenced acknowledgements, attempt accounting at reservation, exponential retry backoff and terminal handling for exhausted/crashed workers. Inline and cron paths share the same mechanism. Newly recorded queue errors use stable categories rather than raw provider responses.

Resend failures no longer trigger an SMTP send: a timeout may follow acceptance and switching transports would risk duplication. SMTP remains available when Resend is not configured. External delivery remains at-least-once under ambiguous failures; exactly-once and inbox receipt are not claimed. See [mail-reliability.md](mail-reliability.md) for schema additions, safe coordinated rollout/rollback, operational monitoring and provider limitations.

Latest sequential evidence: build/TypeScript passed, **787 Node checks passed**, **12 Chromium tests passed**. Logs: `/tmp/bloodferry-reliability-build.log`, `/tmp/bloodferry-reliability-tests.log`, `/tmp/bloodferry-reliability-browser.log`. Six new queue tests use a real isolated database and controlled provider behavior, not live mail. Production credentials, provider delivery, deployment and remaining feature gates still require verification. Existing UI/layouts were unchanged in this pass.

## Admin-managed delivery profiles and Groq configuration

Implemented multiple Resend account/sender profiles and supported SMS gateway profiles through the existing Integrations admin page. Explicit transactional defaults, write-only encrypted credentials, audit metadata and permission checks protect configuration. New mail rows pin their Resend profile for retries; supported SMS profiles feed both manual and existing transactional sends. Manual SMS has validation, shared rate limiting and per-admin reference deduplication. Existing UI styles/navigation remain; a link from the legacy email page exposes the new controls.

Groq remains the environment default and the existing admin configuration is respected. Integration status now reads effective database overrides. Fixed string `0` being interpreted as enabled and numeric zero temperature being replaced by a default. No live provider success is claimed.

See [admin-delivery-profiles.md](admin-delivery-profiles.md) for setup, permissions, provider limits, migration/key-rotation caveats and actual validation evidence. Final build/TypeScript and **789 Node checks passed**. **12 browser tests passed** after the UI/profile implementation, before the final small configuration/audit/backup adjustments; those adjustments passed final build/Node checks. Dependency audit: zero known vulnerabilities; diff checks clean. No production credentials or deployment changed.

Evidence: `/tmp/bloodferry-profiles-final-build.log`, `/tmp/bloodferry-profiles-final-tests.log`, `/tmp/bloodferry-profiles-browser.log`. Remaining gates include live Resend verified-domain delivery, actual SMS acceptance/receipt, live Groq credentials/model response, deployment rehearsal and the previously documented unfinished institutional/UI/fan-out features. Profile deletion/deactivation and online encryption-key rotation are not implemented; read the operational caveats before production activation.

## CSRF incident remediation (2026-11-20, branch arena/9f3afcca-bloodora)

A global `CSRF_TOKEN_INVALID` failure on deployed forms was traced to compounding causes: (1) the session store read ran before the schema bootstrap, so fresh/degraded instances silently minted a session without a token on every request; (2) an unloadable session cookie was reported identically to a tampered token; (3) production booted with missing/ephemeral signing configuration and an always-`ok` liveness probe. Fixes: schema bootstrap awaited before the session middleware for non-probe requests; a distinct 403 `CSRF_SESSION_MISSING` (CSRF fully enabled) for unloadable sessions; `/health` now reports `503 degraded` with the missing variable names (never values) when required production variables are absent; new production-mode regression suite (`csrf-session.test.mjs`, `prod-degraded.test.mjs`). See [render-deployment.md](render-deployment.md) for the full root-cause analysis, the Render blueprint (`render.yaml`) and required hosted configuration.

Hosted verification status: Vercel project metadata (names/targets only) confirmed the same defect class — all variables scoped to `preview`, including an empty preview `JWT_SECRET` and an ephemeral `file:/tmp` preview database — and is documented; no values or dashboards were changed. Render is not connected in this environment and direct access to the deployed host is blocked; the live login acceptance flow must be performed by an operator after the Render environment checklist is applied. Local isolated production-mode tests pass; this is not proof of the hosted deployment.

## Pre-merge current-tree verification (2026-11-20)

A final Chromium run on the current tree passed all **12 browser tests** after the Groq/admin adjustments and documentation alignment. No live provider, deployment, DNS or secret changes were performed as part of this verification.
