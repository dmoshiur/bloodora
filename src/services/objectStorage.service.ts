import { put, del } from "@vercel/blob";
import { config } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** Public image storage with stable application-owned /uploads/:filename aliases. */
export const objectStorageService = {
  status() {
    const configured = Boolean(config.blobReadWriteToken);
    return {
      provider: configured ? "vercel-blob" : "turso-blob",
      configured: true,
      object_storage_configured: configured,
      persistent: true,
      recommended_for_production: configured,
    };
  },

  async put(filename: string, data: Uint8Array, mime: string): Promise<string> {
    if (!config.blobReadWriteToken) throw new ApiError(503, "OBJECT_STORAGE_NOT_CONFIGURED", "Production object storage is not configured.");
    try {
      const blob = await put(`bloodora/${filename}`, Buffer.from(data), {
        access: "public",
        contentType: mime,
        token: config.blobReadWriteToken,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 31_536_000,
        abortSignal: AbortSignal.timeout(config.uploadTimeoutMs),
      });
      return blob.url;
    } catch (error) {
      logger.warn("storage: Vercel Blob upload failed", { code: (error as { name?: string })?.name || "BlobError" });
      throw new ApiError(503, "OBJECT_STORAGE_FAILED", "The image storage provider could not accept this upload. Retry shortly; no local-only fallback was reported as success.");
    }
  },

  async remove(externalUrl: string): Promise<void> {
    if (!config.blobReadWriteToken) return;
    try {
      await del(externalUrl, { token: config.blobReadWriteToken, abortSignal: AbortSignal.timeout(config.uploadTimeoutMs) });
    } catch (error) {
      logger.warn("storage: Vercel Blob delete failed", { code: (error as { name?: string })?.name || "BlobError" });
      throw new ApiError(503, "OBJECT_STORAGE_DELETE_FAILED", "The previous stored image could not be removed. Metadata was left intact for a later retry.");
    }
  },
};
