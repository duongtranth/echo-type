import type { WordBook } from '@/types/wordbook';

export const collegeBooks: WordBook[] = [
  {
    id: 'cet4',
    name: 'Từ vựng CET-4 (Đại học Trung Quốc)',
    nameEn: 'CET-4',
    description:
      'Core vocabulary for the College English Test Band 4, the most widely taken English exam in China. Covers ~4500 essential words.',
    kind: 'vocabulary',
    emoji: '🎓',
    difficulty: 'intermediate',
    filterTag: 'College',
    tags: ['college', 'cet4', 'exam'],
    itemCount: 4501,
  },
  {
    id: 'cet6',
    name: 'Từ vựng CET-6 (Đại học Trung Quốc)',
    nameEn: 'CET-6',
    description:
      'Advanced vocabulary for the College English Test Band 6, building on CET-4 with higher-level academic and professional words.',
    kind: 'vocabulary',
    emoji: '🎓',
    difficulty: 'intermediate',
    filterTag: 'College',
    tags: ['college', 'cet6', 'exam'],
    itemCount: 3987,
  },
  {
    id: 'tem4',
    name: 'Từ vựng TEM-4 (Chuyên ngành Anh)',
    nameEn: 'TEM-4',
    description:
      'Vocabulary for the Test for English Majors Band 4, required for English major undergraduates in China.',
    kind: 'vocabulary',
    emoji: '📖',
    difficulty: 'intermediate',
    filterTag: 'College',
    tags: ['college', 'tem4', 'english-major'],
    itemCount: 4340,
  },
  {
    id: 'tem8',
    name: 'Từ vựng TEM-8 (Chuyên ngành Anh)',
    nameEn: 'TEM-8',
    description:
      'Comprehensive vocabulary for the Test for English Majors Band 8, the highest-level English proficiency test for English majors.',
    kind: 'vocabulary',
    emoji: '📖',
    difficulty: 'advanced',
    filterTag: 'College',
    tags: ['college', 'tem8', 'english-major'],
    itemCount: 12336,
  },
];
