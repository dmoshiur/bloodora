# Admin provider accounts and manual sending

## Where to configure

Open **Admin → Integrations & SMS** (`/admin/integrations`). The existing Email page also links there. Existing page layouts/styles and legacy email settings are retained; new controls use the existing form/card components.

### Resend accounts and sender addresses

1. Verify your sending domain in Resend and create an appropriately scoped sending API key. Do not paste credentials into chat.
2. Add a profile with channel **Email**, provider **Resend**, a descriptive label, the API key, sender email and sender display name.
3. For another sender on the same account, add another profile with that sender address. For another Resend account, supply its corresponding key in a separate profile.
4. Explicitly select **Use as default**. Saving alone does not change the active provider.
5. Use the existing Email page's test action to send a real message to an operator-controlled inbox. Confirm both provider acceptance and actual receipt. Successful configuration storage is not provider verification.

One default email profile is active at a time. Account failover, round-robin distribution, per-template sender routing and bulk mail campaigns are not implemented. If no database default is selected, existing server-side Resend environment configuration or legacy SMTP selection remains available for compatibility. An active database Resend profile takes priority over legacy SMTP settings; the legacy SMTP toggle does not disable that Resend profile.

New outbox messages persist their selected profile ID. Changing the default cannot change the sender/account for those retries. Existing unprofiled messages retain environment/legacy selection. Resend submissions retain the stable outbox ID as provider idempotency key. No cross-account/provider fallback occurs after an ambiguous failure.

### SMS provider setup

Add a profile with channel **SMS**, provider **GreenWeb** or **SSL Wireless**, and the corresponding key. SSL Wireless also requires its sender ID. Activate the intended default explicitly. Database-configured gateways use the official adapter endpoints; the admin cannot provide an arbitrary URL to receive credentials.

Existing environment-configured SMS remains the fallback when no database profile is active. The same selected provider is used by manual SMS, test SMS and existing transactional SMS/OTP flows. Provider cost remains an estimate from the existing server configuration, not a live account balance.

### Manual SMS

Enter one Bangladesh mobile number, a message of at most 480 characters, and a unique reference of 8–128 letters/numbers/underscores/hyphens. Reuse the reference only to retry the **same intended message**: the deduplication mechanism suppresses repeat references per administrator, even if their text is changed. Failed or unconfirmed prior attempts do not become successful merely by submitting the same reference again. Inspect the recorded delivery state before deciding to use a new reference.

The endpoint allows ten submissions per administrator per hour. Provider charges may apply. Only send operational messages to recipients you are authorized to contact; this feature is not an automated marketing consent system. Manual attempts add an audit activity with delivery ID/provider/status but not the message body or recipient. Provider acceptance does not guarantee handset delivery. Bulk recipient imports and automated campaigns are not included.

## Permissions and storage

- Profile list/create/default selection require both `settings.smtp` and `settings.manage` under the existing backend RBAC middleware.
- Manual SMS requires `settings.manage` and a shared rate limiter.
- Existing session CSRF protection remains in force for browser forms.
- Strict server-side validation rejects unsupported providers, invalid channel/sender combinations and extra fields.
- Provider keys are write-only. Lists return metadata, never ciphertext or plaintext keys.
- Keys are AES-256-GCM encrypted with random IVs, profile-ID authenticated data and a context-derived key based on the server's stable `JWT_SECRET` (minimum 24 characters enforced for profile encryption). Use a strong randomly generated production secret.
- **Back up the secret securely with your disaster-recovery configuration. Rotating JWT_SECRET also changes this encryption key. Existing profiles must be migrated/recreated under a coordinated procedure before that rotation; otherwise they cannot be decrypted.** This version does not implement online encryption-key rotation or an external KMS.
- The additive `delivery_profiles` table and `email_outbox.profile_id` column preserve existing accounts, settings and queued messages. Profiles are included in the database backup table inventory.
- Create a replacement profile for credential rotation. There is currently no edit/delete/deactivate UI; retaining old profiles protects queued retries. Reconcile pending mail before revoking a provider key. Database access and backup access must still be tightly restricted.

## Groq AI

The existing AI admin page manages the Groq API key/model. Use provider `groq`, base URL `https://api.groq.com/openai/v1`, and a model available to your Groq account. Environment defaults remain Groq; an existing explicit admin override is not silently overwritten. The effective database configuration takes priority over environment defaults.

Integration health now reads that effective configuration, rather than reporting only environment keys. The admin enable flag correctly handles string `0` as disabled; zero temperature is preserved. Use the existing provider test and model-list actions to validate actual credentials. Authorized configuration, owned conversation persistence, submission deduplication, bounded provider calls and honest provider errors remain in place. This pass does not add streaming or claim successful live Groq requests.

## API additions

- `GET /api/admin/delivery-profiles`: metadata list.
- `POST /api/admin/delivery-profiles`: create profile; fields `kind`, `label`, `provider`, `api_key`, optional `sender_email`, `sender_name`, `sender_id` as appropriate.
- `POST /api/admin/delivery-profiles/:id/activate`: transactionally select the single default for its channel and audit the action.
- `POST /api/admin/sms/send`: `{to, body, request_key}`; paid send with rate limit and deduplication.

## Verification and outstanding acceptance

Final build/TypeScript and **789 Node checks** passed. The 12 Chromium tests passed after admin UI/profile integration; subsequent changes were limited to Groq flag/temperature handling, backup inventory, SMS audit metadata and formatting, followed by the final Node/build run. No live credentials were entered and no deployment, real email or paid SMS was performed.

New regressions cover permissions, incompatible provider input, encrypted storage, secret-free responses, default uniqueness, queued sender pinning, manual-send denial/validation and Groq configuration behavior. Existing outbox concurrency and browser checks remain passing. Provider fixtures are not evidence of production delivery.
