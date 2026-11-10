# Security model

## Authentication and sessions

Browser authentication uses Turso-backed `express-session`; API clients can use signed bearer tokens. Login and registration rotate the session identifier to prevent fixation. Logout destroys the server-side session rather than only clearing browser state. Production cookies are Secure and HttpOnly with SameSite=Lax. The removed custom cookie store and development fallback must not be restored.

A stalled session store fails closed for authenticated access by treating the caller as logged out rather than hanging indefinitely. JWT/session secrets must be long, random, environment-specific, and rotated through an intentional session-invalidation plan.

## CSRF, CORS, and native forms

Cookie-authenticated state changes require a valid CSRF token and an allowed origin. Tokens are delivered in hidden form fields and a meta tag for same-origin AJAX. Query-string CSRF tokens are rejected. Bearer-only API calls remain stateless.

Same-host SSR/forms bypass cross-origin CORS processing; configured external frontend origins use a credentialed allow-list. Foreign, malformed, and `Origin: null` requests are rejected. Never add `null` to the allow-list to fix local browser failures.

`Referrer-Policy: same-origin` is intentional. Under the Fetch origin algorithm, a `no-referrer` document can send `Origin: null` on its own native non-CORS form POST. `same-origin` sends no referrer cross-site while preserving the actual same-origin value needed by origin/CSRF checks. Fetch/XHR behavior differs, so API-only tests cannot catch this browser issue.

## Authorization

Server-side guards enforce user ownership, admin roles, super-admin-only actions, and permission grants on every protected route. Normal users receive 403 for admin pages/mutations. UI navigation filtering is not an authorization boundary.

Admin browser mutations require POST and CSRF. Legacy mutation GET URLs are intentionally inert. Impersonation/switch-back, donor verification, user promotion/deletion, payment confirmation, integration tests, branding, and settings remain privileged operations.

## Browser headers and content

Helmet sets CSP with self-only default/form-action/connect sources, no objects, no framing, and explicit asset sources. Production enables `upgrade-insecure-requests`. Additional headers include no-sniff, frame protection, HSTS in production HTTPS, and same-origin referrer policy.

Local default branding avoids unexpected third-party image dependencies. EJS escapes dynamic values by default; review any raw-output rendering and rich-text sanitization before adding new content fields.

## Passwords, recovery, email verification, and OTP

Passwords are hashed with bcrypt. Password recovery and account verification use generic responses that do not disclose account existence or tokens. SMS OTPs are cryptographically generated, HMAC-hashed, expiring, attempt-limited, single-use, and resend-throttled. Plaintext codes are never returned or logged. Disabled SMS fails honestly and email alternatives remain available.

## Uploads and provider secrets

Upload size is bounded and storage aliases are server-controlled. Blob objects are public and must not contain sensitive documents. `BLOB_READ_WRITE_TOKEN`, Turso tokens, Resend/SMTP/SMS/AI keys, OTP peppers, session/JWT secrets, and Vercel bypass secrets are server-only.

Admin integration/storage status reports configuration and masked metadata, not credentials. Do not log request bodies, cookies, authorization headers, provider payloads containing OTPs, or reset URLs with tokens.

## Availability and abuse resistance

Request bodies, uploads, database operations, provider calls, AI interactions, SSE, and total request time are bounded. Database transport failures use retryable 503 categories and a circuit breaker. Rate-limit windows can be per instance and are best effort; high-risk production abuse controls should also use durable or edge-level limits.

AI output and user-provided content must be treated as untrusted. Payment success requires independent admin verification; browser callbacks are not trusted evidence.

## Reporting and release checks

Before release, run typecheck/build, all Node suites, real browser tests, and dependency audit. Manually verify CSRF rejection, cross-origin rejection, RBAC, session revocation, and secret masking after security-related changes. External credential delivery and production infrastructure require separate authorized validation.
