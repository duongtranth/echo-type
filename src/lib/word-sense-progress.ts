import { gradeCard, Rating } from '@/lib/fsrs';
import { getWordSenseDb } from '@/lib/word-sense-db';
import type { WordSenseProgress, WordSenseStatus } from '@/types/word-sense';

const STATUS_RATING: Record<WordSenseStatus, Rating> = {
  learning: Rating.Again,
  review: Rating.Hard,
  known: Rating.Easy,
};

function normalizeIdentityPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'"-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createWordSenseId(word: string, pos: string, definitionEnglish: string): string {
  return `sense::${normalizeIdentityPart(word)}::${normalizeIdentityPart(pos)}::${normalizeIdentityPart(definitionEnglish)}`;
}

export function ratingForWordSenseStatus(status: WordSenseStatus): Rating {
  return STATUS_RATING[status];
}

export async function getWordSenseProgress(word: string): Promise<WordSenseProgress[]> {
  return getWordSenseDb().progress.where('word').equals(normalizeIdentityPart(word)).toArray();
}

export async function getWordSenseProgressMap(word: string): Promise<Map<string, WordSenseProgress>> {
  const rows = await getWordSenseProgress(word);
  return new Map(rows.map((row) => [row.id, row]));
}

export async function setWordSenseStatus(
  input: {
    word: string;
    pos: string;
    definitionEnglish: string;
    status: WordSenseStatus;
  },
  now = Date.now(),
): Promise<WordSenseProgress> {
  const word = normalizeIdentityPart(input.word);
  const pos = normalizeIdentityPart(input.pos) || 'other';
  const definitionEnglish = input.definitionEnglish.trim();
  const id = createWordSenseId(word, pos, definitionEnglish);
  const senseDb = getWordSenseDb();
  const existing = await senseDb.progress.get(id);
  const { cardData, nextReview } = gradeCard(existing?.fsrsCard, ratingForWordSenseStatus(input.status), new Date(now));

  const progress: WordSenseProgress = {
    id,
    word,
    pos,
    definitionEnglish,
    status: input.status,
    fsrsCard: cardData,
    nextReview,
    reviewCount: (existing?.reviewCount ?? 0) + 1,
    lastReviewedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await senseDb.progress.put(progress);
  return progress;
}

export async function listDueWordSenses(now = Date.now()): Promise<WordSenseProgress[]> {
  return getWordSenseDb().progress.where('nextReview').belowOrEqual(now).sortBy('nextReview');
}
