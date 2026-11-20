import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { config } from "../config/env.js";
import { all, get, run, transaction } from "../db/query.js";
import { ApiError, randomId } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { extFromMime, newFilename, type UploadedImage } from "../uploads/uploads.js";

export type StorageProvider = "cloudinary" | "database";
export interface StoreOptions {
  ownerId?: string | null;
  purpose?: string;
}
export interface StoredImage {
  filename: string;
  url: string;
  provider: StorageProvider;
}

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;
// Responsive delivery: browsers get an optimized image; originals are not upscaled.
const CLOUDINARY_TRANSFORM = "c_limit,w_1600,q_auto,f_auto";

function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function cloudinaryConfigured(): boolean {
  const c = config.cloudinary;
  return Boolean(c.cloudName && c.apiKey && c.apiSecret);
}

/**
 * Cloudinary is signed server-side: the API secret never leaves the process and
 * no unsigned preset exists. Signature covers exactly the parameters sent.
 */
function cloudinarySignature(params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(payload + config.cloudinary.apiSecret).digest("hex");
}

async function cloudinaryUpload(img: UploadedImage): Promise<{ filename: string; secureUrl: string; publicId: string; bytes: number; width: number | null; height: number | null }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { timestamp, transformation: CLOUDINARY_TRANSFORM, folder: "bloodferry" };
  const signature = cloudinarySignature(params);
  const form = new FormData();
  form.set("file", new Blob([img.data], { type: img.mime }), img.originalName || `upload.${extFromMime(img.mime)}`);
  form.set("api_key", config.cloudinary.apiKey);
  for (const [k, v] of Object.entries(params)) form.set(k, v);
  form.set("signature", signature);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Cloudinary upload timed out")), config.uploadTimeoutMs);
  try {
    const res = await fetch(`${config.cloudinary.apiBase}/${encodeURIComponent(config.cloudinary.cloudName)}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as { secure_url?: string; public_id?: string; bytes?: number; width?: number; height?: number; error?: { message?: string } } | null;
    if (!res.ok || !body?.secure_url || !body.public_id) {
      const reason = body?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Cloudinary rejected the upload: ${reason}`);
    }
    return {
      filename: newFilename("webp"),
      secureUrl: body.secure_url,
      publicId: body.public_id,
      bytes: body.bytes ?? img.data.length,
      width: body.width ?? null,
      height: body.height ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function cloudinaryDestroy(publicId: string): Promise<boolean> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { public_id: publicId, timestamp };
  const signature = cloudinarySignature(params);
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("timestamp", timestamp);
  form.set("api_key", config.cloudinary.apiKey);
  form.set("signature", signature);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Cloudinary destroy timed out")), config.uploadTimeoutMs);
  try {
    const res = await fetch(`${config.cloudinary.apiBase}/${encodeURIComponent(config.cloudinary.cloudName)}/image/destroy`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    logger.warn("storage: Cloudinary destroy failed", { err: String((err as Error)?.message ?? err).slice(0, 120) });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Sharp-optimize to WebP. Throws when the payload is not a decodable image. */
async function toWebp(data: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const out = await sharp(data, { failOn: "error" })
    .rotate() // honour EXIF orientation, then the tag no longer matters
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  if (!out.info.width || !out.info.height || out.info.size <= 0) {
    throw new Error("Optimized image failed validation");
  }
  return { data: out.data, width: out.info.width, height: out.info.height };
}

interface MediaRow {
  id: string;
  owner_id: string | null;
  purpose: string;
  filename: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  checksum: string;
  provider: StorageProvider;
  external_url: string | null;
  public_id: string | null;
  original_name: string | null;
  data: Uint8Array | null;
  created_at: string;
}

/**
 * Centralized image storage — Cloudinary-first with a database-backed WebP
 * fallback. Every upload feature in the app routes through this service, so
 * provider behavior, validation and deletion semantics live in exactly one
 * place. `/uploads/:filename` remains the stable public URL for both providers.
 */
export const imageStorageService = {
  status() {
    const configured = cloudinaryConfigured();
    return {
      configured,
      provider: "cloudinary" as const,
      reason: configured ? null : "CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET are not set",
      mode: configured ? ("cloudinary" as const) : ("database-webp-fallback" as const),
      primary: configured ? ("cloudinary" as const) : ("database" as const),
      cloudinary: { configured, cloud_name: configured ? config.cloudinary.cloudName : undefined },
      fallback: { provider: "database" as const, format: "image/webp" as const, max_dimension: MAX_DIMENSION, quality: WEBP_QUALITY, available: true },
    };
  },

  async store(img: UploadedImage, opts: StoreOptions = {}): Promise<StoredImage> {
    if (!img?.data?.length) throw ApiError.badRequest("No image data", "NO_FILE");
    if (!String(img.mime || "").startsWith("image/")) throw ApiError.badRequest("Only image uploads are supported", "NOT_AN_IMAGE");
    // Verify the payload really is a decodable image BEFORE trusting its MIME.
    try {
      await sharp(img.data, { failOn: "error" }).metadata();
    } catch {
      throw ApiError.badRequest("The uploaded file is not a valid image", "INVALID_IMAGE");
    }
    const now = new Date().toISOString();

    if (cloudinaryConfigured()) {
      try {
        const up = await cloudinaryUpload(img);
        const id = randomId();
        await transaction(async (tx) => {
          await tx.run(
            `INSERT INTO media_assets (id, owner_id, purpose, filename, mime, bytes, width, height, checksum, provider, external_url, public_id, original_name, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, opts.ownerId ?? null, opts.purpose ?? "upload", up.filename, "image/webp", up.bytes, up.width, up.height, sha256(img.data), "cloudinary", up.secureUrl, up.publicId, img.originalName ?? null, now, now],
          );
          // Companion row keeps the /uploads/:filename redirect contract stable.
          await tx.run(
            `INSERT INTO uploads (id, filename, original_name, mime, size, external_url, data, created_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            // The legacy `uploads` table requires a non-null data column; the
            // bytes live in Cloudinary, so keep a zero-length placeholder.
            [id, up.filename, img.originalName ?? null, "image/webp", up.bytes, up.secureUrl, new Uint8Array(0), now],
          );
        });
        logger.info("storage: cloudinary stored", { filename: up.filename, bytes: up.bytes, owner: opts.ownerId ?? undefined });
        return { filename: up.filename, url: `/uploads/${up.filename}`, provider: "cloudinary" };
      } catch (err) {
        // Never lose the image: fall through to the database-backed WebP copy.
        logger.warn("storage: cloudinary unavailable — using database WebP fallback", {
          err: String((err as Error)?.message ?? err).slice(0, 160),
        });
      }
    }

    const webp = await toWebp(img.data);
    const id = randomId();
    const filename = newFilename("webp");
    await run(
      `INSERT INTO media_assets (id, owner_id, purpose, filename, mime, bytes, width, height, checksum, provider, original_name, data, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'database',?,?,?,?)`,
      [id, opts.ownerId ?? null, opts.purpose ?? "upload", filename, "image/webp", webp.data.length, webp.width, webp.height, sha256(webp.data), img.originalName ?? null, webp.data, now, now],
    );
    logger.info("storage: database webp stored", { filename, bytes: webp.data.length, width: webp.width, height: webp.height, owner: opts.ownerId ?? undefined });
    return { filename, url: `/uploads/${filename}`, provider: "database" };
  },

  async read(filename: string): Promise<{ mime: string; data?: Uint8Array; externalUrl?: string } | null> {
    const safe = String(filename || "");
    if (!safe || safe.includes("/") || safe.includes("\\") || safe.includes("..")) return null;
    const legacy = await get<{ mime: string; data: Uint8Array | null; external_url: string | null }>(
      "SELECT mime, data, external_url FROM uploads WHERE filename = ?",
      [safe],
    );
    if (legacy?.external_url) return { mime: legacy.mime, externalUrl: legacy.external_url };
    if (legacy?.data) {
      const data = legacy.data instanceof Uint8Array ? legacy.data : new Uint8Array(legacy.data as ArrayBuffer);
      return { mime: legacy.mime, data };
    }
    const media = await get<MediaRow>("SELECT * FROM media_assets WHERE filename = ?", [safe]);
    if (!media) return null;
    if (media.external_url) return { mime: media.mime, externalUrl: media.external_url };
    if (!media.data) return null;
    const data = media.data instanceof Uint8Array ? media.data : new Uint8Array(media.data as ArrayBuffer);
    return { mime: media.mime, data };
  },

  /** Bounded metadata list for admins (never includes blobs). */
  async list(limit = 50, offset = 0) {
    const rows = await all<Omit<MediaRow, "data">>(
      `SELECT id, owner_id, purpose, filename, mime, bytes, width, height, checksum, provider, external_url, original_name, created_at
       FROM media_assets ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)],
    );
    return rows.map(({ checksum, ...rest }) => ({ ...rest, checksum: checksum.slice(0, 12) + "…" }));
  },

  /**
   * Remove every copy of an asset (media row, legacy companion row, and the
   * remote Cloudinary object when applicable). Returns what was removed.
   */
  async remove(filename: string): Promise<{ removed: boolean; cloudinaryDestroyed: boolean }> {
    const safe = String(filename || "");
    if (!safe || safe.includes("/") || safe.includes("\\") || safe.includes("..")) return { removed: false, cloudinaryDestroyed: false };
    const media = await get<MediaRow>("SELECT * FROM media_assets WHERE filename = ?", [safe]);
    let cloudinaryDestroyed = false;
    if (media?.provider === "cloudinary" && media.public_id) {
      cloudinaryDestroyed = await cloudinaryDestroy(media.public_id);
    }
    await transaction(async (tx) => {
      await tx.run("DELETE FROM media_assets WHERE filename = ?", [safe]);
      await tx.run("DELETE FROM uploads WHERE filename = ?", [safe]);
    });
    return { removed: Boolean(media) || true, cloudinaryDestroyed };
  },

  /**
   * Delete fallback assets that no application row references anymore.
   * Referenced anywhere (user photos, product images, organisation logos) are
   * kept. Bounded batch; safe to re-run. Returns the count removed.
   */
  async cleanupOrphans(days = 30, limit = 100): Promise<{ removed: number }> {
    const cutoff = new Date(Date.now() - Math.max(days, 1) * 24 * 3600 * 1000).toISOString();
    const candidates = await all<Pick<MediaRow, "id" | "filename" | "public_id" | "provider">>(
      `SELECT id, filename, public_id, provider FROM media_assets
       WHERE created_at < ? AND filename NOT IN (SELECT image_file FROM users WHERE image_file IS NOT NULL)
         AND filename NOT IN (SELECT image_file FROM products WHERE image_file IS NOT NULL)
         AND filename NOT IN (SELECT image_file FROM organization_members WHERE image_file IS NOT NULL)
         AND filename NOT IN (SELECT value FROM settings WHERE key IN ('logo_file', 'favicon_file') AND value IS NOT NULL)
       ORDER BY created_at ASC LIMIT ?`,
      [cutoff, Math.min(Math.max(limit, 1), 500)],
    );
    let removed = 0;
    for (const row of candidates) {
      if (row.provider === "cloudinary" && row.public_id) await cloudinaryDestroy(row.public_id);
      await transaction(async (tx) => {
        await tx.run("DELETE FROM media_assets WHERE id = ?", [row.id]);
        await tx.run("DELETE FROM uploads WHERE filename = ?", [row.filename]);
      });
      removed += 1;
    }
    if (removed > 0) logger.info("storage: orphan cleanup", { removed, cutoff });
    return { removed };
  },
};
