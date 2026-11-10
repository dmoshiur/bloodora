# Upload and object storage

## Backend selection

When `BLOB_READ_WRITE_TOKEN` is configured, new uploads are written to **Vercel Blob** as public objects. Without it, BloodOra retains the Turso BLOB backend for development and legacy installations. Turso stores upload metadata in both modes.

```dotenv
BLOB_READ_WRITE_TOKEN=
MAX_UPLOAD_MB=4
UPLOAD_TIMEOUT_MS=5000
```

Vercel Blob writes/deletes and storage status are bounded. The Blob token is never exposed through integration status, EJS, or browser code.

## Stable aliases and metadata

Each upload retains a stable filename and `/uploads/:filename` alias. Database-backed rows are served by the application; remote rows redirect to their external object URL. Existing pages and content therefore do not need a URL rewrite when new uploads move to Blob.

Additive metadata distinguishes remote objects and records external URL/size information. Existing BLOB rows remain unchanged. Upload metadata persistence and remote insertion use separate repository paths so controllers can coordinate object writes and metadata consistently.

## Deletion and branding replacement

Deleting an upload coordinates metadata removal with remote-object deletion where applicable. Replacing the site logo/favicon uses the upload service so obsolete Blob objects can be removed rather than orphaned. A failed external operation must not be reported as verified cleanup.

Local default branding is used when database logo/favicon values are `NULL` or blank. Do not restore remote placeholder-branding dependencies.

## Limits and security

- `MAX_UPLOAD_MB` is capped at 4 MB, below Vercel's request-body ceiling, so oversized uploads can receive an application error instead of a platform 413.
- Multipart parsing uses memory storage with explicit file-size limits.
- Validate image type/content and use generated/stable server-side names; never trust a client path for filesystem writes.
- Blob objects are public. Do not upload identity documents, medical records, secrets, or other private data to this public storage flow.
- `/uploads/:filename` is an alias, not authorization for private media.

## Verification

Local tests cover Turso fallback, metadata, aliases, redirects, deletion coordination, and mocked/disabled Blob behavior. A real preview check must use a dedicated Blob store and verify:

1. Multipart upload returns a stable alias and expected metadata.
2. The alias redirects to a readable public object.
3. Old database-backed aliases still serve bytes.
4. Branding replacement removes or correctly reports the previous remote object.
5. Delete removes the alias and remote object, or surfaces a truthful failure.
6. Integration/storage status never includes `BLOB_READ_WRITE_TOKEN`.

These real Blob checks have not been completed locally.
