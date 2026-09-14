import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey, resolveModel } from '@/lib/ai-model';
import { parseAIJson } from '@/lib/parse-ai-json';
import { enforcePlatformRateLimit } from '@/lib/platform-provider';
import { ProviderResolutionError, resolveProviderForCapability } from '@/lib/provider-resolver';
import { type ProviderConfig, type ProviderId } from '@/lib/providers';
import type { ExamQuestionType, ExamSkill, ExamType, ParsedExamDraft } from '@/types/exam';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SKILLS = new Set<ExamSkill>(['reading', 'listening', 'writing', 'speaking']);
const QUESTION_TYPES = new Set<ExamQuestionType>([
  'multiple-choice',
  'true-false-not-given',
  'yes-no-not-given',
  'sentence-completion',
  'summary-completion',
  'short-answer',
  'matching',
  'essay',
  'other',
]);

function sanitizeDraft(value: ParsedExamDraft): ParsedExamDraft {
  const sections = Array.isArray(value?.sections) ? value.sections : [];

  return {
    title: typeof value?.title === 'string' ? value.title.trim() : undefined,
    sections: sections.map((section, sectionIndex) => ({
      skill: SKILLS.has(section.skill) ? section.skill : 'reading',
      title:
        typeof section.title === 'string' && section.title.trim()
          ? section.title.trim()
          : `Section ${sectionIndex + 1}`,
      instructions: typeof section.instructions === 'string' ? section.instructions.trim() : undefined,
      sourceText: typeof section.sourceText === 'string' ? section.sourceText.trim() : undefined,
      questions: (Array.isArray(section.questions) ? section.questions : []).map((question, questionIndex) => ({
        number:
          typeof question.number === 'number' && Number.isFinite(question.number) && question.number > 0
            ? question.number
            : questionIndex + 1,
        type: QUESTION_TYPES.has(question.type) ? question.type : 'other',
        prompt: typeof question.prompt === 'string' ? question.prompt.trim() : '',
        options: Array.isArray(question.options)
          ? question.options
              .filter((option): option is string => typeof option === 'string')
              .map((option) => option.trim())
          : undefined,
        correctAnswers: Array.isArray(question.correctAnswers)
          ? question.correctAnswers
              .filter((answer): answer is string => typeof answer === 'string')
              .map((answer) => answer.trim())
              .filter(Boolean)
          : [],
        explanation: typeof question.explanation === 'string' ? question.explanation.trim() : undefined,
        wordCountTarget:
          typeof question.wordCountTarget === 'number' && Number.isFinite(question.wordCountTarget)
            ? question.wordCountTarget
            : undefined,
      })),
    })),
  };
}

function selectSourceWindow(text: string): { sourceText: string; truncated: boolean } {
  const normalized = text.trim();
  if (normalized.length <= 60000) {
    return { sourceText: normalized, truncated: false };
  }

  return {
    sourceText: `${normalized.slice(0, 45000)}\n\n[... middle of source omitted because the import is very long ...]\n\n${normalized.slice(-15000)}`,
    truncated: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      examType,
      text,
      provider = 'groq',
      providerConfigs = {},
    }: {
      examType: ExamType;
      text: string;
      provider?: ProviderId;
      providerConfigs?: Partial<Record<ProviderId, Partial<ProviderConfig>>>;
    } = await req.json();

    if ((examType !== 'IELTS' && examType !== 'TOEIC') || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'examType and extracted exam text are required' }, { status: 400 });
    }

    const resolution = resolveProviderForCapability({
      capability: 'generate',
      requestedProviderId: provider,
      availableProviderConfigs: providerConfigs,
      headers: req.headers,
    });

    const apiKey = resolveApiKey(resolution.providerId, req.headers, providerConfigs[resolution.providerId]?.auth);
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured. Add your key in Settings.' }, { status: 401 });
    }

    const rateLimit = await enforcePlatformRateLimit({
      headers: req.headers,
      capability: 'generate',
      resolution,
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: rateLimit.message, code: 'platform_rate_limited' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const model = resolveModel({
      providerId: resolution.providerId,
      modelId: resolution.modelId,
      apiKey,
      baseUrl: resolution.baseUrl,
      apiPath: resolution.apiPath,
    });

    const { sourceText, truncated } = selectSourceWindow(text);

    const { text: modelText } = await generateText({
      model,
      system: `You convert extracted ${examType} test text into structured test data.
Preserve the original question wording as closely as possible.
Do not invent answers. Only populate correctAnswers when an answer key or explicit answer is present in the supplied text and can be matched confidently.
If an answer is not explicit, use an empty correctAnswers array.
Use only these skills: reading, listening, writing, speaking.
Use only these question types: multiple-choice, true-false-not-given, yes-no-not-given, sentence-completion, summary-completion, short-answer, matching, essay, other.
Writing and speaking tasks (e.g. an essay prompt, a "describe/discuss..." task, or a speaking cue card) have no fixed correct answer — classify these as type "essay" with an empty correctAnswers array. These are graded separately by AI after the test, not by exact match.
When an essay/writing task states a minimum or target word count (e.g. "write at least 250 words"), extract it as a numeric wordCountTarget on that question. Omit wordCountTarget when not stated.
Keep passage/source material in sourceText and instructions separately from individual question prompts.
Return ONLY valid JSON with this shape and no markdown:
{"title":"optional test title","sections":[{"skill":"reading","title":"section title","instructions":"optional instructions","sourceText":"passage/transcript if present","questions":[{"number":1,"type":"multiple-choice","prompt":"question text","options":["A. ...","B. ..."],"correctAnswers":["A. ..."],"explanation":"optional only when explicitly supported by source","wordCountTarget":250}]}]}`,
      prompt: `Parse this ${examType} test. The extracted text may contain layout noise. Map any explicit answer key back to the corresponding questions, but never guess missing answers. If the source contains an omission marker, the final block is intentionally preserved because answer keys often appear near the end.\n\nSOURCE TEXT:\n${sourceText}`,
    });

    const parsed = parseAIJson<ParsedExamDraft>(modelText);
    if (!parsed.data) {
      return NextResponse.json({ error: 'AI did not return valid structured exam JSON' }, { status: 502 });
    }

    const draft = sanitizeDraft(parsed.data);
    if (draft.sections.length === 0) {
      return NextResponse.json({ error: 'AI could not identify any exam sections' }, { status: 502 });
    }

    return NextResponse.json({
      draft,
      truncated,
      providerId: resolution.providerId,
      credentialSource: resolution.credentialSource,
      fallbackApplied: resolution.fallbackApplied,
      fallbackReason: resolution.fallbackReason,
    });
  } catch (error) {
    console.error('Exam parse error:', error);
    if (error instanceof ProviderResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Exam parsing failed';
    const providerError = (error as { data?: { error?: { message?: string } } })?.data?.error?.message;
    return NextResponse.json({ error: providerError || message }, { status: 500 });
  }
}
