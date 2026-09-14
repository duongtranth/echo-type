import type { ExamQuestionType } from '@/types/exam';

export function normalizeExamAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ');
}

export function isExamAnswerCorrect(answer: string, acceptedAnswers: string[]): boolean {
  const normalized = normalizeExamAnswer(answer);
  return acceptedAnswers.some((candidate) => normalizeExamAnswer(candidate) === normalized);
}

/**
 * Essay/writing/speaking responses have no fixed correct answer, so they can't be
 * scored by exact-match comparison — they're graded separately (see grade-essay API).
 */
export function isAutoGradableQuestionType(type: ExamQuestionType): boolean {
  return type !== 'essay';
}
