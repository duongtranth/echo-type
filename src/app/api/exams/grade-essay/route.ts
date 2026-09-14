import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey, resolveModel } from '@/lib/ai-model';
import { parseAIJson } from '@/lib/parse-ai-json';
import { enforcePlatformRateLimit } from '@/lib/platform-provider';
import { ProviderResolutionError, resolveProviderForCapability } from '@/lib/provider-resolver';
import { type ProviderConfig, type ProviderId } from '@/lib/providers';
import type { EssayGrading, EssayGradingCriterion, ExamSkill, ExamType } from '@/types/exam';

export const runtime = 'nodejs';
export const maxDuration = 60;

function buildCriteriaList(skill: ExamSkill): string {
  if (skill === 'speaking') {
    return `- Fluency and coherence: pacing, logical flow, use of linking words
- Lexical resource: vocabulary range and accuracy
- Grammatical range and accuracy: sentence variety and correctness
- Task response: how directly and fully the prompt/cue card is addressed
Note: you are grading a TEXT TRANSCRIPT of a spoken answer, not audio. You cannot assess pronunciation, intonation, or stress — do not comment on them and do not penalize for their absence.`;
  }

  return `- Task achievement/response: how fully and directly the prompt is addressed, position clarity, development of ideas
- Coherence and cohesion: logical organization, paragraphing, linking devices
- Lexical resource: vocabulary range, precision, and appropriateness
- Grammatical range and accuracy: sentence variety and correctness`;
}

function sanitizeGrading(value: unknown): EssayGrading | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;

  const bandScore = typeof rec.bandScore === 'number' && Number.isFinite(rec.bandScore) ? rec.bandScore : null;
  if (bandScore === null) return null;
  const clampedBand = Math.min(9, Math.max(0, Math.round(bandScore * 2) / 2));

  const criteria: EssayGradingCriterion[] = Array.isArray(rec.criteria)
    ? rec.criteria
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          criterion: typeof item.criterion === 'string' ? item.criterion.trim() : '',
          score:
            typeof item.score === 'number' && Number.isFinite(item.score)
              ? Math.min(9, Math.max(0, Math.round(item.score * 2) / 2))
              : 0,
          feedback: typeof item.feedback === 'string' ? item.feedback.trim() : '',
        }))
        .filter((item) => item.criterion && item.feedback)
    : [];

  const strengths = Array.isArray(rec.strengths)
    ? rec.strengths.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
    : [];
  const improvements = Array.isArray(rec.improvements)
    ? rec.improvements.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
    : [];
  const overallFeedback = typeof rec.overallFeedback === 'string' ? rec.overallFeedback.trim() : '';
  if (!overallFeedback) return null;

  return {
    bandScore: clampedBand,
    criteria,
    strengths,
    improvements,
    overallFeedback,
    gradedAt: Date.now(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      examType,
      skill,
      prompt,
      answer,
      wordCountTarget,
      provider = 'groq',
      providerConfigs = {},
    }: {
      examType: ExamType;
      skill: ExamSkill;
      prompt: string;
      answer: string;
      wordCountTarget?: number;
      provider?: ProviderId;
      providerConfigs?: Partial<Record<ProviderId, Partial<ProviderConfig>>>;
    } = await req.json();

    if ((examType !== 'IELTS' && examType !== 'TOEIC') || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'examType and question prompt are required' }, { status: 400 });
    }
    if (typeof answer !== 'string' || !answer.trim()) {
      return NextResponse.json({ error: 'An answer is required to grade' }, { status: 400 });
    }

    const resolution = resolveProviderForCapability({
      capability: 'evaluate',
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
      capability: 'evaluate',
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

    const bandNote =
      examType === 'TOEIC'
        ? 'TOEIC has no official band-descriptor scale, so present bandScore as an IELTS-equivalent band estimate and say so explicitly in overallFeedback.'
        : 'Use the official IELTS band descriptor scale.';
    const wordCountNote = wordCountTarget
      ? `The task asks for at least ${wordCountTarget} words. Factor under-length responses into task achievement/response.`
      : '';

    const { text: modelText } = await generateText({
      model,
      system: `You are an expert ${examType} examiner grading a ${skill} response using the IELTS 0-9 band scale (whole or half bands).
${bandNote}
Grade strictly and honestly — do not inflate scores. Give specific, actionable feedback tied to the actual text submitted.
Score against these criteria:
${buildCriteriaList(skill)}
${wordCountNote}
Return ONLY valid JSON with this shape and no markdown:
{"bandScore":6.5,"criteria":[{"criterion":"Task response","score":6.5,"feedback":"specific feedback"}],"strengths":["specific strength"],"improvements":["specific improvement"],"overallFeedback":"a short paragraph summarizing the assessment"}`,
      prompt: `QUESTION PROMPT:\n${prompt.trim()}\n\nCANDIDATE'S ANSWER:\n${answer.trim()}`,
    });

    const parsed = parseAIJson<Record<string, unknown>>(modelText);
    const grading = parsed.data ? sanitizeGrading(parsed.data) : null;
    if (!grading) {
      return NextResponse.json({ error: 'AI did not return a valid grading result' }, { status: 502 });
    }

    return NextResponse.json({
      grading,
      providerId: resolution.providerId,
      credentialSource: resolution.credentialSource,
      fallbackApplied: resolution.fallbackApplied,
      fallbackReason: resolution.fallbackReason,
    });
  } catch (error) {
    console.error('Essay grading error:', error);
    if (error instanceof ProviderResolutionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Essay grading failed';
    const providerError = (error as { data?: { error?: { message?: string } } })?.data?.error?.message;
    return NextResponse.json({ error: providerError || message }, { status: 500 });
  }
}
