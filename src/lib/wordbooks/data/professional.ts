import type { WordBook } from '@/types/wordbook';

export const professionalBooks: WordBook[] = [
  {
    id: 'business-english',
    name: 'Từ vựng cốt lõi tiếng Anh thương mại',
    nameEn: 'Business English',
    description: 'Professional vocabulary for the modern workplace, from emails and meetings to negotiations.',
    kind: 'vocabulary',
    emoji: '💼',
    difficulty: 'intermediate',
    filterTag: 'Professional',
    tags: ['professional', 'business', 'workplace'],
    itemCount: 100,
  },
  {
    id: 'bec',
    name: 'Từ vựng chứng chỉ BEC',
    nameEn: 'BEC Certificate',
    description: 'Targeted vocabulary for the Cambridge Business English Certificate exam series.',
    kind: 'vocabulary',
    emoji: '📋',
    difficulty: 'intermediate',
    filterTag: 'Professional',
    tags: ['professional', 'bec', 'cambridge'],
    itemCount: 2822,
  },
  {
    id: 'daily-vocab',
    name: 'Từ vựng thông dụng hằng ngày',
    nameEn: 'Daily Essentials',
    description:
      'The most useful everyday English words for daily conversation, shopping, travel, and social situations.',
    kind: 'vocabulary',
    emoji: '☀️',
    difficulty: 'beginner',
    filterTag: 'General',
    tags: ['general', 'daily', 'conversation'],
    itemCount: 100,
  },
  {
    id: 'coca',
    name: 'Từ vựng học thuật tần suất cao COCA',
    nameEn: 'COCA Academic',
    description:
      'Top academic words from the Corpus of Contemporary American English, essential for reading comprehension.',
    kind: 'vocabulary',
    emoji: '📚',
    difficulty: 'intermediate',
    filterTag: 'Academic',
    tags: ['academic', 'coca', 'corpus'],
    itemCount: 100,
  },
];
