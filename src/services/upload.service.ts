import { uploadRepo } from "../repos/upload.repo.js";
import { randomId } from "../utils/errors.js";
import { extFromMime, newFilename, type UploadedImage } from "../uploads/uploads.js";
import { logger } from "../utils/logger.js";
import { objectStorageService } from "./objectStorage.service.js";

export const uploadService = {
  status: () => objectStorageService.status(),

  /**
   * Return the legacy stable filename, never a provider URL that would require a
   * production data rewrite. Vercel Blob is used when configured; Turso BLOBs
   * remain the development and backward-compatible storage path.
   */
  async store(img: UploadedImage): Promise<string> {
    const filename = newFilename(img.ext || extFromMime(img.mime));
    const id = randomId();
    if (configBlobEnabled()) {
      const externalUrl = await objectStorageService.put(filename, img.data, img.mime);
      await uploadRepo.insertRemote(id, filename, img.originalName, img.mime, img.data.length, externalUrl);
    } else {
      await uploadRepo.insert(id, filename, img.originalName, img.mime, img.data);
    }
    logger.info("upload: stored", { filename, bytes: img.data.length, provider: configBlobEnabled() ? "vercel-blob" : "turso" });
    return filename;
  },

  async read(filename: string): Promise<{ mime: string; data?: Uint8Array; externalUrl?: string } | null> {
    const row = await uploadRepo.findByFilename(filename);
    if (!row) return null;
    if (row.external_url) return { mime: row.mime, externalUrl: row.external_url };
    const data = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data as ArrayBuffer);
    return { mime: row.mime, data };
  },

  async remove(filename: string): Promise<void> {
    const row = await uploadRepo.findByFilename(filename);
    if (!row) return;
    if (row.external_url) await objectStorageService.remove(row.external_url);
    await uploadRepo.delete(filename);
  },
};

function configBlobEnabled(): boolean {
  return objectStorageService.status().object_storage_configured;
}
