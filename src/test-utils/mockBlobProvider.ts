import type { BlobObject, BlobProvider } from "@/services/storage/blobProvider";

/**
 * A mock Blob provider for automated tests ONLY — never imported by
 * production code (src/services/storage/blobProvider.ts's
 * vercelBlobProvider is the only real implementation). Lives under
 * src/test-utils specifically so that's obvious from its location,
 * mirroring src/test-utils/mockAiProvider.ts's role for the AI provider.
 */
export function createMockBlobProvider(objects: Record<string, BlobObject> = {}) {
  const deletedUrls: string[] = [];
  const store = new Map(Object.entries(objects));

  const provider: BlobProvider = {
    async deleteObject(url: string) {
      deletedUrls.push(url);
      store.delete(url);
    },
    async getObject(url: string) {
      return store.get(url) ?? null;
    },
  };

  return { provider, deletedUrls, store };
}
