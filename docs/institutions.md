# Hospital and organization backend workflows

These APIs use the existing Express/session/bearer/CSRF/error infrastructure. No new server or UI theme exists. New institutional pages have **not** been added; the existing site remains visually unchanged.

## Data and access model

`organizations` is the single institutional registry. `kind='hospital'` and `kind='organization'` share the same validation and membership model rather than duplicating tables. The API prefixes are `/api/hospitals` and `/api/organizations`; a record of the wrong kind returns 404 under the other prefix.

Institution roles are **scoped memberships**, not global administrator flags:

| Caller | Access |
| --- | --- |
| Visitor | Approved public directory/details, with contacts only when `publish_contact=true` |
| Authenticated applicant | Submit an application; receives its initial owner membership |
| Owner | Read own application; edit details; manage managers/volunteers after approval; submit approved institution's blood requests |
| Manager | Read/edit institution, read minimal membership roster/request summaries; submit approved institution's requests |
| Volunteer | Read institution through own membership listing/details; no edits, rosters or request submissions |
| `partners.view` | Inspect all application statuses and rosters/summaries |
| `partners.manage` | Independently review applications; administrative edits/membership management |

Normal admin and super-admin roles receive the institutional review permissions through the existing safe catalogue reconciliation. Donor, recipient, volunteer, organization and hospital **account** roles have ordinary access only; assigning a hospital account role does not create a membership or permit representing a hospital. Existing custom roles are retained.

Application/review/member changes write audit logs and in-app notifications in the same transaction. No notification claims email/SMS delivery. Public projections omit review notes, applicant identity and unconsented contact details. Membership lists contain user IDs/names/roles, not private account/payment/contact fields.

## Endpoints

Replace `{prefix}` with `/api/organizations` or `/api/hospitals`.

| Method | Path | Operation |
| --- | --- | --- |
| GET | `{prefix}` | Approved public directory |
| POST | `{prefix}` | Authenticated application; 201 new, 200 idempotent replay |
| GET | `{prefix}/mine` | Current user's active memberships/institutions |
| GET | `{prefix}/:id` | Public approved details or authorized private details |
| PATCH | `{prefix}/:id` | Owner/manager or authorized administrator update |
| GET | `{prefix}/:id/members` | Owner/manager or reviewer roster |
| PUT | `{prefix}/:id/members` | Owner or administrator membership change |
| POST | `{prefix}/:id/review` | Independent reviewer approval/rejection/suspension |
| GET | `{prefix}/:id/requests` | Scoped summaries; excludes patient/contact/private notes |
| POST | `{prefix}/:id/requests` | Owner/manager submission for an approved institution |
| GET | `/api/admin/organizations` | Authorized all-status organization listing |
| GET | `/api/admin/hospitals` | Authorized all-status hospital listing |
| POST | `/api/admin/organizations/:id/review` | Review alias |
| POST | `/api/admin/hospitals/:id/review` | Review alias |

Directory/list query parameters: `limit` (1–100, default 25), `offset` (0–100000, default 0), exact `district`, bounded `q` name search, `sort=name|newest`. Private/admin lists optionally accept `status=pending|approved|rejected|suspended`; public listing always enforces approved status. Responses include `pagination: {limit,offset,total}`. Membership/request summaries accept the same bounded paging parameters but only use limit/offset. Unknown query/body fields are rejected.

### Application body

```json
{
  "name": "Example Community Hospital",
  "description": "Community blood-request coordination",
  "district": "Rajshahi",
  "address": "Example institutional address",
  "contact_email": "office@example.test",
  "contact_phone": "01712345678",
  "publish_contact": false,
  "request_key": "client-generated-unique-id"
}
```

All shown fields are required; description may be empty. Phones use the existing Bangladesh normalizer. `request_key` must contain 8–128 letters, numbers, underscores or hyphens. It is unique per applicant. Replaying identical normalized data returns the original application, while changing the payload or kind with the same key returns 409. No client-supplied `status`, owner or review fields are accepted. Applications begin pending and do not appear publicly.

### Updates and concurrency

Send the last read positive integer `version` plus one or more editable application fields (excluding `request_key`). Missing fields are preserved. Stale versions return `409 VERSION_CONFLICT`. Each successful mutation increments the institution version; re-fetch before the next mutation.

Changing name, district or address on an approved institution returns it to pending for fresh review. Editing a rejected application resubmits it as pending. Suspended institutions require an administrator to act; members cannot edit or submit requests while suspended.

### Reviews

```json
{ "version": 1, "status": "approved", "note": "Documents reviewed by the responsible operator" }
```

Review notes are required (3–1000 characters). Transitions:

- Pending → approved or rejected.
- Approved → suspended.
- Suspended → approved or rejected.
- Rejected → pending through an authorized details edit, then independent review.

Reviewers cannot review an institution they created or currently belong to, even if they are global administrators. Unsupported transitions return 409. Application approval is an administrative registry status, **not a claim that BloodFerry medically verified donors, inventories or services**.

### Memberships

```json
{ "version": 2, "user_id": "existing-user-id", "role": "manager", "active": true }
```

The target must be an existing account. Owners can manage manager/volunteer membership; only an authorized administrator can change owners. The last active owner cannot be removed or demoted. Revocation uses `active=false`, preserving history and denying subsequent scoped operations without waiting for a role cache. Membership changes require approved institution status. There is no invitation/acceptance UX yet; users are assigned to an institutional team by its authorized owner/operator.

### Institutional requests

Use the existing blood-request body with its required patient/group/hospital/contact/date/location fields. The scoped endpoint supplies `institution_id`; the generic `POST /api/blood-requests` may also receive it. **Both paths enforce active owner/manager membership and current approval inside the request transaction.** Hospital names for hospital-linked requests come from the registry, not an arbitrary submitted label. Unlinked legacy/free-text requests continue to work and are not presented as registry-verified requests.

Success includes the real request `id`. Request ownership remains the submitting user; institution membership does not grant global request moderation or ownership over another person's request. No automatic fulfillment, donation, payment or medical match is implied.

## Database/deployment

The existing additive migration mechanism creates `organizations`, `organization_members`, indexes and nullable `blood_requests.institution_id` with an FK. Existing requests/accounts are not rewritten or removed. No hard-delete institution endpoint was added; suspension preserves membership/request/audit references.

No new external credentials or hosting changes are required. Follow the staging snapshot/migration/rehearsal procedure in `bloodferry-report.md`. The regular role catalogue reconciliation seeds the additional roles/grants while retaining deliberate prior grant removals.

## Verification and limitations

`test/unit/organizations.test.mjs` uses an isolated libSQL database and real HTTP routes. It covers application idempotency, overposting, hidden pending applications, contact consent, permissions, independent reviews, stale versions, last-owner protection, membership revocation, hospital-linked requests, forged generic submissions, volunteers, FK integrity and repeated migrations. Additional tests cover non-admin account roles, donor availability not inventing a donation date, mail-token privacy, SMS duplicate truthfulness, transactional admin edits and donation pagination/aggregates.

No live institution credential validation, production deployment or provider delivery was performed. Dedicated hospital/organization and donation-admin pages, institutional invitations, organization billing, inventory/clinical scheduling, and automatic external notification fan-out remain outside the implemented UI workflows. The new APIs are usable and tested but do not make those absent screens functional by implication.
