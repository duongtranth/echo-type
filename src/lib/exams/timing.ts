import type { ExamBundle, ExamSkill } from '@/types/exam';

const MINUTE = 60;

function uniqueSkills(bundle: ExamBundle): ExamSkill[] {
  return [...new Set(bundle.sections.map((section) => section.skill))];
}

export function getSuggestedExamTimeLimitSeconds(bundle: ExamBundle): number {
  const skills = uniqueSkills(bundle);

  if (bundle.test.examType === 'TOEIC') {
    if (skills.length === 1 && skills[0] === 'listening') return 45 * MINUTE;
    if (skills.length === 1 && skills[0] === 'reading') return 75 * MINUTE;
    return 120 * MINUTE;
  }

  const minutesBySkill: Record<ExamSkill, number> = {
    listening: 40,
    reading: 60,
    writing: 60,
    speaking: 14,
  };

  return (
    Math.max(
      1,
      skills.reduce((total, skill) => total + minutesBySkill[skill], 0),
    ) * MINUTE
  );
}

export function formatExamTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
