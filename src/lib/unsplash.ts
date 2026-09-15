export interface UnsplashPhotoResult {
  id: string;
  thumbUrl: string;
  regularUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
}

interface UnsplashSearchResponse {
  results?: Array<{
    id: string;
    alt_description?: string | null;
    urls: { thumb: string; regular: string };
    links: { html: string };
    user: { name: string; links: { html: string } };
  }>;
}

export async function searchWordImage(query: string, accessKey: string): Promise<UnsplashPhotoResult | null> {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', 'squarish');

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!res.ok) {
    throw new Error(`Unsplash search failed with status ${res.status}`);
  }

  const data = (await res.json()) as UnsplashSearchResponse;
  const photo = data.results?.[0];
  if (!photo) return null;

  // Unsplash API guidelines require UTM-tagged attribution links back to the photographer and Unsplash.
  const utm = 'utm_source=echotype&utm_medium=referral';
  const withUtm = (link: string) => `${link}${link.includes('?') ? '&' : '?'}${utm}`;

  return {
    id: photo.id,
    thumbUrl: photo.urls.thumb,
    regularUrl: photo.urls.regular,
    alt: photo.alt_description || query,
    photographer: photo.user.name,
    photographerUrl: withUtm(photo.user.links.html),
    unsplashUrl: withUtm(photo.links.html),
  };
}
