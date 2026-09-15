import type { FSRSCardData } from '@/types/content';

export type WordSenseStatus = 'learning' | 'review' | 'known';

export interface WordSenseProgress {
  id: string;
  word: string;
  pos: string;
  definitionEnglish: string;
  status: WordSenseStatus;
  fsrsCard?: FSRSCardData;
  nextReview?: number;
  reviewCount: number;
  lastReviewedAt: number;
  createdAt: number;
  updatedAt: number;
}
