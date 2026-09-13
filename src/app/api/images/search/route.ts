import { NextRequest } from 'next/server';
import { searchWordImage } from '@/lib/unsplash';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim();
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();

  if (!query) {
    return Response.json({ error: 'A search query is required.' }, { status: 400 });
  }

  if (!accessKey) {
    return Response.json({ error: 'Unsplash is not configured on this server.' }, { status: 501 });
  }

  try {
    const photo = await searchWordImage(query, accessKey);
    return Response.json(
      { photo },
      { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unsplash image search failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}
