import { describe, expect, it } from 'vitest';
import { isExamAnswerCorrect, normalizeExamAnswer } from '@/lib/exams/grading';

describe('exam grading', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeExamAnswer('  Northern   Hotel Group ')).toBe('northern hotel group');
  });

  it('accepts any configured alternative answer', () => {
    expect(isExamAnswerCorrect('True', ['TRUE', 'T'])).toBe(true);
    expect(isExamAnswerCorrect('false', ['TRUE', 'T'])).toBe(false);
  });
});
