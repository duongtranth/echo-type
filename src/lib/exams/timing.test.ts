import { describe, expect, it } from 'vitest';
import { formatExamTime, getSuggestedExamTimeLimitSeconds } from '@/lib/exams/timing';
import type { ExamBundle, ExamSkill } from '@/types/exam';

function makeBundle(examType: 'IELTS' | 'TOEIC', skills: ExamSkill[]): ExamBundle {
  return {
    test: {
      id: 'exam-1',
      title: 'Test exam',
      examType,
      status: 'ready',
      createdAt: 1,
      updatedAt: 1,
    },
    sections: skills.map((skill, index) => ({
      id: `section-${index}`,
      testId: 'exam-1',
      skill,
      title: skill,
      order: index,
      createdAt: 1,
      updatedAt: 1,
    })),
    questions: [],
  };
}

describe('exam timing', () => {
  it('uses the IELTS reading time limit for reading-only exams', () => {
    expect(getSuggestedExamTimeLimitSeconds(makeBundle('IELTS', ['reading']))).toBe(60 * 60);
  });

  it('uses TOEIC listening and reading section limits when isolated', () => {
    expect(getSuggestedExamTimeLimitSeconds(makeBundle('TOEIC', ['listening']))).toBe(45 * 60);
    expect(getSuggestedExamTimeLimitSeconds(makeBundle('TOEIC', ['reading']))).toBe(75 * 60);
  });

  it('uses the full TOEIC limit for mixed-skill exams', () => {
    expect(getSuggestedExamTimeLimitSeconds(makeBundle('TOEIC', ['listening', 'reading']))).toBe(120 * 60);
  });

  it('formats minute and hour timers', () => {
    expect(formatExamTime(59)).toBe('00:59');
    expect(formatExamTime(3605)).toBe('1:00:05');
  });
});
