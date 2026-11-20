import { imageStorageService } from "./imageStorage.service.js";
import type { UploadedImage } from "../uploads/uploads.js";

/**
 * Legacy facade over the centralized image storage service. Every upload
 * feature in the app keeps calling `uploadService`; the storage decision
 * itself (Cloudinary primary, database WebP fallback) lives in exactly one
 * place — `imageStorageService`.
 *
 * The returned value stays the stable `/uploads/:filename` filename, never a
 * provider URL, so no client-side rewrite is ever required.
 */
export const uploadService = {
  status: () => imageStorageService.status(),

  async store(img: UploadedImage, ownerId?: string | null): Promise<string> {
    const stored = await imageStorageService.store(img, { ownerId: ownerId ?? null });
    return stored.filename;
  },

  /** Same as store(), but reports the provider that ACTUALLY persisted the
   *  bytes (never the configured primary) for honest caller-side reporting. */
  async storeWithMeta(img: UploadedImage, ownerId?: string | null): Promise<{ filename: string; provider: "cloudinary" | "database" }> {
    const stored = await imageStorageService.store(img, { ownerId: ownerId ?? null });
    return { filename: stored.filename, provider: stored.provider };
  },

  async read(filename: string): Promise<{ mime: string; data?: Uint8Array; externalUrl?: string } | null> {
    return imageStorageService.read(filename);
  },

  async remove(filename: string): Promise<void> {
    await imageStorageService.remove(filename);
  },

  /**
   * Best-effort cleanup of the image a write just replaced. Never deletes the
   * seeded shared default avatar, never deletes a file identical to its
   * replacement, and never fails the caller (a leaked object is better than a
   * failed save). Skips folder-style values like '/assets/...' which are not
   * stored uploads at all.
   */
  async removeReplaced(oldFilename?: string | null, newFilename?: string | null): Promise<void> {
    const old = String(oldFilename || "").trim();
    if (!old || old === "default.jpg" || old.startsWith("/")) return;
    if (newFilename && old === String(newFilename).trim()) return;
    await this.remove(old).catch(() => {});
  },
};
