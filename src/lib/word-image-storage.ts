import { db, type WordImageEntry } from './db';

const blobUrlCache = new Map<string, string>();

export type WordImageAttribution = WordImageEntry['attribution'];

export async function saveWordImage(cacheKey: string, blob: Blob, attribution: WordImageAttribution): Promise<void> {
  const entry: WordImageEntry = {
    cacheKey,
    blob,
    mimeType: blob.type || 'image/jpeg',
    attribution,
    createdAt: Date.now(),
  };
  await db.wordImages.put(entry);
}

export async function getWordImage(
  cacheKey: string,
): Promise<{ url: string; attribution: WordImageAttribution } | null> {
  try {
    const entry = await db.wordImages.get(cacheKey);
    if (!entry) return null;

    const cached = blobUrlCache.get(cacheKey);
    if (cached) return { url: cached, attribution: entry.attribution };

    const url = URL.createObjectURL(entry.blob);
    blobUrlCache.set(cacheKey, url);
    return { url, attribution: entry.attribution };
  } catch {
    return null;
  }
}

export async function deleteWordImage(cacheKey: string): Promise<void> {
  const cached = blobUrlCache.get(cacheKey);
  if (cached) {
    URL.revokeObjectURL(cached);
    blobUrlCache.delete(cacheKey);
  }
  await db.wordImages.delete(cacheKey);
}

export async function hasWordImage(cacheKey: string): Promise<boolean> {
  const count = await db.wordImages.where('cacheKey').equals(cacheKey).count();
  return count > 0;
}
