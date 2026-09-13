import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_PDF_SIZE = 10 * 1024 * 1024;

interface PaddleOCRLayoutResult {
  markdown?: {
    text?: string;
  };
}

interface PaddleOCRResponse {
  errorCode?: number;
  errorMsg?: string;
  result?: {
    layoutParsingResults?: PaddleOCRLayoutResult[];
  };
}

function getEndpoint(): string | null {
  const configured = process.env.PADDLEOCR_VL_URL?.trim();
  if (!configured) return null;
  return `${configured.replace(/\/+$/, '')}/layout-parsing`;
}

export async function POST(req: Request) {
  try {
    const endpoint = getEndpoint();
    if (!endpoint) {
      return NextResponse.json(
        {
          error:
            'PaddleOCR-VL is not configured. Set PADDLEOCR_VL_URL to your PaddleOCR-VL service, for example http://127.0.0.1:8080.',
        },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return NextResponse.json({ error: 'Only PDF files are supported by this exam OCR route' }, { status: 400 });
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 });
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.PADDLEOCR_VL_API_KEY?.trim();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file: fileBytes.toString('base64'),
        fileType: 0,
        visualize: false,
        returnMarkdownImages: false,
        prettifyMarkdown: false,
        restructurePages: true,
        mergeTables: true,
        relevelTitles: true,
      }),
      signal: AbortSignal.timeout(110_000),
    });

    const payload = (await response.json()) as PaddleOCRResponse;
    if (!response.ok || (typeof payload.errorCode === 'number' && payload.errorCode !== 0)) {
      return NextResponse.json(
        { error: payload.errorMsg || `PaddleOCR-VL request failed with HTTP ${response.status}` },
        { status: response.ok ? 502 : response.status },
      );
    }

    const pages = payload.result?.layoutParsingResults ?? [];
    const pageTexts = pages
      .map((page) => page.markdown?.text?.trim() || '')
      .filter(Boolean);
    const text = pageTexts.join('\n\n---\n\n');

    if (!text) {
      return NextResponse.json({ error: 'PaddleOCR-VL returned no Markdown text' }, { status: 502 });
    }

    return NextResponse.json({
      text,
      pageCount: pages.length,
      metadata: { title: null, author: null },
      extractionMethod: 'paddleocr-vl',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PaddleOCR-VL extraction failed';
    console.error('PaddleOCR-VL exam extraction error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
