# Upload and object storage

## Backend selection

All image uploads in the application (user/donor photos, product images, organization logos, site branding, library media) go through one service — `imageStorage.service.ts`. It is Cloudinary-first with a database-backed WebP fallback:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MAX_UPLOAD_MB=4
UPLOAD_TIMEOUT_MS=5000
```

- **Cloudinary (primary).** Uploads are signed server-side; the API secret never leaves the process. Images are stored with a `c_limit,w_1600,q_auto,f_auto` transformation, `folder=bloodferry`. The API stores `provider=cloudinary`, the remote `secure_url`, `public_id`, byte count, dimensions and a SHA-256 checksum of the original payload; the image bytes themselves are NOT duplicated in the database.
- **Database WebP fallback.** When Cloudinary is unconfigured, unreachable, or rejects the upload (misconfiguration, outage, auth failure, timeout), the image is re-encoded locally with Sharp — orientation corrected, bounded to 1600 px, WebP q82 — and stored as binary WebP (`provider=database`) with MIME, size, dimensions, SHA-256 checksum, owner and timestamps in the `media_assets` table. The request never fails just because the remote provider did, and the image is returned to the caller only after the row is committed.
- **Never** a broken URL, and never a claim of success before the provider confirms persistence: `/api/uploads` reports the provider that actually accepted the bytes (`cloudinary` vs `database`).

## Stable aliases and metadata

Every upload gets a stable generated filename and `/uploads/:filename` alias regardless of provider. The media endpoint resolves the row: Cloudinary rows **redirect** to the stored `secure_url`; database rows **stream the stored WebP bytes** with `Content-Type: image/webp`, `Cache-Control: immutable` long-lived caching and correct `Content-Length`. Existing pages keep working with no URL rewrite, and rows written before the media-assets migration remain readable.

Metadata per image: filename, MIME (`image/webp`), bytes, width, height, SHA-256 checksum, provider, owner id, original name, purpose, timestamps. Checksums are for integrity auditing/dedup detection; they are truncated in admin list responses.

## Deletion and replacement

`imageStorageService.remove(filename)` deletes the `media_assets` row (+ its legacy companion row) and, for Cloudinary rows, issues a signed `image/destroy` for the recorded `public_id`. Replacing a user photo, product image, logo or favicon removes the superseded object after the new one is persisted (see `uploadService.removeReplaced`); product deletion removes its image. Settings changes to `logo_file`/`favicon_file` clean the previous object. Seeded shared defaults (`default.jpg`) are never deleted.

`cleanupOrphans(days, limit)` removes media older than `days` that is not referenced by users, products, organization members, or the site settings (logo/favicon) — bounded batch, safe to re-run, and it destroys the remote Cloudinary object as well. It writes an audit log line.

## Limits and security

- `MAX_UPLOAD_MB` is capped at 4 MB, below common serverless request-body ceilings — oversized uploads receive an application error instead of a platform 413.
- Multipart parsing uses memory storage with explicit file-size limits.
- The payload is verified as a decodable image (Sharp metadata probe) before its MIME is trusted; filenames are generated server-side; client paths are never used.
- Cloudinary redirects keep the alias stable but are public objects; do not upload identity documents or other sensitive data through this public flow.
- `/uploads/:filename` is an alias, not an authorization boundary for private media.

## Verification

Local tests exercise the Cloudinary HTTP contract against a stub (upload signature, destroy, provider-reported `secure_url` persisted) and the fallback path end-to-end (WebP bytes actually stored, actually served back byte-correctly, checksum and dimensions recorded, delete removes the row and destroys the remote object). A real Cloudinary account has NOT been exercised here — the stub verifies the wire contract, not the account's entitlements or data-retention behavior.
