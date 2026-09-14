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
  | 'essay'
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
  /** Target minimum word count for essay/writing tasks (e.g. IELTS Writing Task 2 = 250). */
  wordCountTarget?: number;
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
  /** Target minimum word count for essay/writing tasks (e.g. IELTS Writing Task 2 = 250). */
  wordCountTarget?: number;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Per-criterion breakdown from an AI grading pass on an essay/speaking response. */
export interface EssayGradingCriterion {
  criterion: string;
  score: number;
  feedback: string;
}

/** AI-generated band-style grading for an essay (writing) or speaking-transcript response. */
export interface EssayGrading {
  bandScore: number;
  criteria: EssayGradingCriterion[];
  strengths: string[];
  improvements: string[];
  overallFeedback: string;
  gradedAt: number;
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
  /** null means this question type (e.g. essay) has no automatic correctness check. */
  correct?: boolean | null;
  answerAtDeadline?: string;
  /** Present once an essay/speaking response has been graded by AI. */
  aiGrading?: EssayGrading;
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
  /** null means this question type (e.g. essay) has no automatic correctness check. */
  correct: boolean | null;
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
