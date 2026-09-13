export type ExamType = 'IELTS' | 'TOEIC';

export type ExamSkill = 'reading' | 'listening' | 'writing' | 'speaking';

export type ExamQuestionType =
  | 'multiple-choice'
  | 'true-false-not-given'
  | 'yes-no-not-given'
  | 'sentence-completion'
  | 'summary-completion'
  | 'short-answer'
  | 'matching'
  | 'other';

export type ExamStatus = 'draft' | 'ready';
export type ExamAttemptStatus = 'in-progress' | 'submitted';

export interface ParsedExamQuestion {
  number: number;
  type: ExamQuestionType;
  prompt: string;
  options?: string[];
  correctAnswers?: string[];
  explanation?: string;
}

export interface ParsedExamSection {
  skill: ExamSkill;
  title: string;
  instructions?: string;
  sourceText?: string;
  questions: ParsedExamQuestion[];
}

export interface ParsedExamDraft {
  title?: string;
  sections: ParsedExamSection[];
}

export interface ExamTest {
  id: string;
  title: string;
  examType: ExamType;
  status: ExamStatus;
  sourceFilename?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExamSection {
  id: string;
  testId: string;
  skill: ExamSkill;
  title: string;
  instructions?: string;
  sourceText?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExamQuestion {
  id: string;
  testId: string;
  sectionId: string;
  number: number;
  type: ExamQuestionType;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  explanation?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExamAttempt {
  id: string;
  testId: string;
  status: ExamAttemptStatus;
  startedAt: number;
  updatedAt: number;
  submittedAt?: number;
  score?: number;
  total?: number;
  timeLimitSeconds?: number;
  deadlineAt?: number;
  timedOutAt?: number;
  timedScore?: number;
  timedTotal?: number;
  currentQuestionId?: string;
  flaggedQuestionIds: string[];
}

export interface ExamAttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  answer: string;
  correct?: boolean;
  answerAtDeadline?: string;
  updatedAt: number;
}

export interface ExamAttemptProgress {
  attempt: ExamAttempt;
  answers: Record<string, string>;
}

export interface ExamBundle {
  test: ExamTest;
  sections: ExamSection[];
  questions: ExamQuestion[];
}

export interface ExamQuestionResult {
  questionId: string;
  answer: string;
  correct: boolean;
  correctAnswers: string[];
}

export interface ExamSubmissionResult {
  attemptId: string;
  score: number;
  total: number;
  durationSeconds: number;
  timeLimitSeconds?: number;
  timedScore?: number;
  timedTotal?: number;
  timedOutAt?: number;
  results: ExamQuestionResult[];
}
