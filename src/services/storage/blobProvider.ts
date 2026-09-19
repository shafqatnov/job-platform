import { del, get } from "@vercel/blob";

export type BlobObject = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
};

/**
 * The storage operations this app's resume feature needs, behind an
 * interface — lets tests inject a mock instead of ever calling real
 * Vercel Blob (mirrors src/services/ai/types.ts's AiModerationProvider
 * pattern for the one other external network dependency in this app).
 */
export type BlobProvider = {
  /** Deletes a blob object by its full URL. */
  deleteObject(url: string): Promise<void>;
  /** Reads a private blob object's content by its full URL, or null if it doesn't exist. */
  getObject(url: string): Promise<BlobObject | null>;
};

/**
 * The real provider, used everywhere in production. Resumes are always
 * stored and read with `access: "private"` — never public — per this
 * app's resume-storage security requirements.
 */
export const vercelBlobProvider: BlobProvider = {
  async deleteObject(url) {
    await del(url);
  },
  async getObject(url) {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return null;
    }
    return { stream: result.stream, contentType: result.blob.contentType };
  },
};
