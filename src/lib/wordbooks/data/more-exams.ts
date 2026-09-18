import type { WordBook } from '@/types/wordbook';

export const moreExamBooks: WordBook[] = [
  {
    id: 'toeic',
    name: 'Từ vựng cốt lõi TOEIC',
    nameEn: 'TOEIC',
    description:
      'Vocabulary for the TOEIC exam — the global standard for measuring workplace English communication skills.',
    kind: 'vocabulary',
    emoji: '💼',
    difficulty: 'intermediate',
    filterTag: 'Professional',
    tags: ['exam', 'toeic', 'workplace', 'professional'],
    itemCount: 1668,
  },
  {
    id: 'ket',
    name: 'Từ vựng Cambridge KET (sơ cấp)',
    nameEn: 'KET (A2 Key)',
    description:
      'Vocabulary for the Cambridge A2 Key (KET) exam — a great starting point for young and beginner learners.',
    kind: 'vocabulary',
    emoji: '🔑',
    difficulty: 'beginner',
    filterTag: 'Cambridge',
    tags: ['exam', 'ket', 'cambridge', 'beginner'],
    itemCount: 892,
  },
  {
    id: 'pet',
    name: 'Từ vựng Cambridge PET (trung cấp)',
    nameEn: 'PET (B1 Preliminary)',
    description:
      'Vocabulary for the Cambridge B1 Preliminary (PET) exam — intermediate-level English for everyday use.',
    kind: 'vocabulary',
    emoji: '🏅',
    difficulty: 'intermediate',
    filterTag: 'Cambridge',
    tags: ['exam', 'pet', 'cambridge', 'intermediate'],
    itemCount: 1537,
  },
  {
    id: 'pets3',
    name: 'PETS-3 - Kỳ thi tiếng Anh cấp 3 toàn quốc (Trung Quốc)',
    nameEn: 'PETS-3',
    description:
      'Vocabulary for the Public English Test System Level 3 (全国英语等级考试三级), equivalent to CET-4 level.',
    kind: 'vocabulary',
    emoji: '📝',
    difficulty: 'intermediate',
    filterTag: 'Domestic Exam',
    tags: ['exam', 'pets', 'domestic'],
    itemCount: 4440,
  },
  {
    id: 'hongbaoshu',
    name: 'Từ vựng "Sách Đỏ" luyện thi Cao học',
    nameEn: 'Hongbaoshu (红宝书)',
    description:
      'The famous "Red Book" (红宝书) vocabulary for the graduate entrance exam — a must-have for 考研 preparation.',
    kind: 'vocabulary',
    emoji: '📕',
    difficulty: 'advanced',
    filterTag: 'Graduate',
    tags: ['exam', 'graduate', 'kaoyan', 'hongbaoshu'],
    itemCount: 4770,
  },
];
