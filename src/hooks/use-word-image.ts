import { useEffect, useState } from 'react';
import { getWordImage, saveWordImage, type WordImageAttribution } from '@/lib/word-image-storage';

export interface WordImageResult {
  url: string | null;
  attribution: WordImageAttribution | null;
  isLoading: boolean;
}

interface UnsplashSearchApiResponse {
  photo?: { regularUrl: string; photographer: string; photographerUrl: string; unsplashUrl: string } | null;
}

// Words we've already confirmed have no photo (or the API is unavailable) — avoids refetching every mount.
const notFoundCache = new Set<string>();

export function useWordImage(word: string, enabled: boolean): WordImageResult {
  const [state, setState] = useState<{ url: string | null; attribution: WordImageAttribution | null }>({
    url: null,
    attribution: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const cacheKey = word.trim().toLowerCase();
    if (!enabled || !cacheKey) {
      setState({ url: null, attribution: null });
      return;
    }

    let cancelled = false;

    async function load() {
      const cached = await getWordImage(cacheKey);
      if (cancelled) return;
      if (cached) {
        setState(cached);
        return;
      }
      if (notFoundCache.has(cacheKey)) return;

      setIsLoading(true);
      try {
        const searchRes = await fetch(`/api/images/search?query=${encodeURIComponent(cacheKey)}`);
        if (!searchRes.ok) {
          notFoundCache.add(cacheKey);
          return;
        }
        const { photo } = (await searchRes.json()) as UnsplashSearchApiResponse;
        if (!photo || cancelled) {
          if (!photo) notFoundCache.add(cacheKey);
          return;
        }

        const imageRes = await fetch(photo.regularUrl);
        if (!imageRes.ok) {
          notFoundCache.add(cacheKey);
          return;
        }
        const blob = await imageRes.blob();
        const attribution: WordImageAttribution = {
          photographer: photo.photographer,
          photographerUrl: photo.photographerUrl,
          unsplashUrl: photo.unsplashUrl,
        };
        await saveWordImage(cacheKey, blob, attribution);
        if (cancelled) return;
        const stored = await getWordImage(cacheKey);
        if (stored) setState(stored);
      } catch {
        notFoundCache.add(cacheKey);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [word, enabled]);

  return { ...state, isLoading };
}
