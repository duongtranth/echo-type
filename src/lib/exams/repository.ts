import { getExamDb } from '@/lib/exams/db';
import { isAutoGradableQuestionType, isExamAnswerCorrect } from '@/lib/exams/grading';
import { upsertWeakSpot } from '@/lib/weak-spots';
import type {
  EssayGrading,
  ExamAttempt,
  ExamAttemptAnswer,
  ExamAttemptProgress,
  ExamBundle,
  ExamQuestion,
  ExamQuestionType,
  ExamSkill,
  ExamSubmissionResult,
  ExamTest,
  ExamType,
} from '@/types/exam';

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function skillToWeakSpotModule(skill: ExamSkill): 'listen' | 'speak' | 'read' | 'write' {
  if (skill === 'listening') return 'listen';
  if (skill === 'speaking') return 'speak';
  if (skill === 'writing') return 'write';
  return 'read';
}

function normalizeAttempt(attempt: ExamAttempt): ExamAttempt {
  return {
    ...attempt,
    status: attempt.status || (attempt.submittedAt ? 'submitted' : 'in-progress'),
    updatedAt: attempt.updatedAt || attempt.submittedAt || attempt.startedAt,
    flaggedQuestionIds: attempt.flaggedQuestionIds ?? [],
  };
}

async function loadAttemptAnswers(attemptId: string): Promise<Record<string, string>> {
  const examDb = getExamDb();
  const rows = await examDb.answers.where('attemptId').equals(attemptId).toArray();
  return Object.fromEntries(rows.map((row) => [row.questionId, row.answer]));
}

export async function listExamTests(): Promise<ExamTest[]> {
  const examDb = getExamDb();
  return examDb.tests.orderBy('updatedAt').reverse().toArray();
}

export async function getExamBundle(testId: string): Promise<ExamBundle | null> {
  const examDb = getExamDb();
  const test = await examDb.tests.get(testId);
  if (!test) return null;

  const [sections, questions] = await Promise.all([
    examDb.sections.where('testId').equals(testId).sortBy('order'),
    examDb.questions.where('testId').equals(testId).sortBy('order'),
  ]);

  return { test, sections, questions };
}

export async function createExamFromExtractedText(input: {
  title: string;
  examType: ExamType;
  sourceFilename?: string;
  text: string;
}): Promise<string> {
  const examDb = getExamDb();
  const now = Date.now();
  const testId = createId('exam');
  const sectionId = createId('section');

  await examDb.transaction('rw', examDb.tests, examDb.sections, async () => {
    await examDb.tests.add({
      id: testId,
      title: input.title.trim() || input.sourceFilename || `${input.examType} exam`,
      examType: input.examType,
      status: 'draft',
      sourceFilename: input.sourceFilename,
      createdAt: now,
      updatedAt: now,
    });

    await examDb.sections.add({
      id: sectionId,
      testId,
      skill: 'reading',
      title: 'Imported section',
      instructions: 'Review the extracted source and add questions below.',
      sourceText: input.text,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  return testId;
}

export async function addExamQuestion(input: {
  testId: string;
  sectionId: string;
  number: number;
  type: ExamQuestionType;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  explanation?: string;
  wordCountTarget?: number;
}): Promise<string> {
  const examDb = getExamDb();
  const now = Date.now();
  const questionId = createId('question');
  const existing = await examDb.questions.where('sectionId').equals(input.sectionId).toArray();
  const nextOrder = existing.reduce((max, item) => Math.max(max, item.order), -1) + 1;

  const question: ExamQuestion = {
    id: questionId,
    testId: input.testId,
    sectionId: input.sectionId,
    number: input.number,
    type: input.type,
    prompt: input.prompt.trim(),
    options: input.options?.map((value) => value.trim()).filter(Boolean),
    correctAnswers: input.correctAnswers.map((value) => value.trim()).filter(Boolean),
    explanation: input.explanation?.trim() || undefined,
    wordCountTarget: input.wordCountTarget,
    order: nextOrder,
    createdAt: now,
    updatedAt: now,
  };

  await examDb.transaction('rw', examDb.questions, examDb.tests, async () => {
    await examDb.questions.add(question);
    await examDb.tests.update(input.testId, { updatedAt: now });
  });

  return questionId;
}

export async function deleteExamQuestion(questionId: string): Promise<void> {
  const examDb = getExamDb();
  const question = await examDb.questions.get(questionId);
  if (!question) return;

  await examDb.transaction('rw', examDb.questions, examDb.tests, async () => {
    await examDb.questions.delete(questionId);
    await examDb.tests.update(question.testId, { updatedAt: Date.now() });
  });
}

export async function deleteExamTest(testId: string): Promise<void> {
  const examDb = getExamDb();
  const attempts = await examDb.attempts.where('testId').equals(testId).toArray();
  const attemptIds = attempts.map((attempt) => attempt.id);

  await examDb.transaction(
    'rw',
    [examDb.tests, examDb.sections, examDb.questions, examDb.attempts, examDb.answers],
    async () => {
      await examDb.tests.delete(testId);
      await examDb.sections.where('testId').equals(testId).delete();
      await examDb.questions.where('testId').equals(testId).delete();
      await examDb.attempts.where('testId').equals(testId).delete();
      if (attemptIds.length > 0) {
        await examDb.answers.where('attemptId').anyOf(attemptIds).delete();
      }
    },
  );
}

export async function getActiveExamAttempt(testId: string): Promise<ExamAttemptProgress | null> {
  const examDb = getExamDb();
  const attempts = await examDb.attempts.where('testId').equals(testId).toArray();
  const attempt = attempts
    .map(normalizeAttempt)
    .filter((item) => item.status === 'in-progress' && !item.submittedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  if (!attempt) return null;

  return {
    attempt,
    answers: await loadAttemptAnswers(attempt.id),
  };
}

export async function startExamAttempt(
  testId: string,
  options: { timeLimitSeconds?: number; forceNew?: boolean } = {},
): Promise<ExamAttemptProgress> {
  if (!options.forceNew) {
    const existing = await getActiveExamAttempt(testId);
    if (existing) return existing;
  }

  const bundle = await getExamBundle(testId);
  if (!bundle) throw new Error('Exam not found');
  if (bundle.questions.length === 0) throw new Error('This exam has no questions.');

  const examDb = getExamDb();
  const startedAt = Date.now();
  const timeLimitSeconds =
    options.timeLimitSeconds && options.timeLimitSeconds > 0 ? Math.floor(options.timeLimitSeconds) : undefined;
  const attempt: ExamAttempt = {
    id: createId('attempt'),
    testId,
    status: 'in-progress',
    startedAt,
    updatedAt: startedAt,
    timeLimitSeconds,
    deadlineAt: timeLimitSeconds ? startedAt + timeLimitSeconds * 1000 : undefined,
    flaggedQuestionIds: [],
  };

  await examDb.attempts.add(attempt);
  return { attempt, answers: {} };
}

export async function captureTimedExamSnapshot(attemptId: string): Promise<ExamAttempt | null> {
  const examDb = getExamDb();
  const rawAttempt = await examDb.attempts.get(attemptId);
  if (!rawAttempt) return null;

  const attempt = normalizeAttempt(rawAttempt);
  if (
    attempt.status !== 'in-progress' ||
    !attempt.deadlineAt ||
    attempt.timedOutAt ||
    Date.now() < attempt.deadlineAt
  ) {
    return attempt;
  }

  const bundle = await getExamBundle(attempt.testId);
  if (!bundle) return attempt;

  const existingRows = await examDb.answers.where('attemptId').equals(attempt.id).toArray();
  const existingByQuestionId = new Map(existingRows.map((row) => [row.questionId, row]));
  const snapshotAnswers = Object.fromEntries(existingRows.map((row) => [row.questionId, row.answer]));
  const gradableQuestions = bundle.questions.filter((question) => isAutoGradableQuestionType(question.type));
  const timedScore = gradableQuestions.filter((question) =>
    isExamAnswerCorrect(snapshotAnswers[question.id] ?? '', question.correctAnswers),
  ).length;
  const now = Date.now();

  await examDb.transaction('rw', examDb.attempts, examDb.answers, async () => {
    await examDb.attempts.update(attempt.id, {
      timedOutAt: attempt.deadlineAt,
      timedScore,
      timedTotal: gradableQuestions.length,
      updatedAt: now,
    });

    const snapshotRows = bundle.questions.map((question) => {
      const existing = existingByQuestionId.get(question.id);
      const answer = existing?.answer ?? '';
      return {
        id: existing?.id ?? createId('answer'),
        attemptId: attempt.id,
        questionId: question.id,
        answer,
        correct: existing?.correct,
        answerAtDeadline: answer,
        updatedAt: existing?.updatedAt ?? now,
      };
    });
    await examDb.answers.bulkPut(snapshotRows);
  });

  return normalizeAttempt({
    ...attempt,
    timedOutAt: attempt.deadlineAt,
    timedScore,
    timedTotal: gradableQuestions.length,
    updatedAt: now,
  });
}

export async function saveExamAttemptProgress(
  attemptId: string,
  input: {
    answers: Record<string, string>;
    currentQuestionId?: string;
    flaggedQuestionIds: string[];
  },
): Promise<ExamAttempt> {
  const examDb = getExamDb();
  const rawAttempt = await examDb.attempts.get(attemptId);
  if (!rawAttempt) throw new Error('Attempt not found');

  let attempt = normalizeAttempt(rawAttempt);
  if (attempt.status !== 'in-progress') return attempt;

  if (attempt.deadlineAt && !attempt.timedOutAt && Date.now() >= attempt.deadlineAt) {
    attempt = (await captureTimedExamSnapshot(attempt.id)) ?? attempt;
  }

  const existingRows = await examDb.answers.where('attemptId').equals(attempt.id).toArray();
  const existingByQuestionId = new Map(existingRows.map((row) => [row.questionId, row]));
  const now = Date.now();

  await examDb.transaction('rw', examDb.attempts, examDb.answers, async () => {
    await examDb.attempts.update(attempt.id, {
      updatedAt: now,
      currentQuestionId: input.currentQuestionId,
      flaggedQuestionIds: input.flaggedQuestionIds,
    });

    const answerRows = Object.entries(input.answers).map(([questionId, answer]) => {
      const existing = existingByQuestionId.get(questionId);
      return {
        id: existing?.id ?? createId('answer'),
        attemptId: attempt.id,
        questionId,
        answer,
        correct: existing?.correct,
        answerAtDeadline: existing?.answerAtDeadline,
        updatedAt: now,
      };
    });

    if (answerRows.length > 0) {
      await examDb.answers.bulkPut(answerRows);
    }
  });

  return normalizeAttempt({
    ...attempt,
    updatedAt: now,
    currentQuestionId: input.currentQuestionId,
    flaggedQuestionIds: input.flaggedQuestionIds,
  });
}

export async function submitExamAttempt(
  testId: string,
  answers: Record<string, string>,
  options: { attemptId?: string } = {},
): Promise<ExamSubmissionResult> {
  const bundle = await getExamBundle(testId);
  if (!bundle) throw new Error('Exam not found');

  const examDb = getExamDb();
  const submittedAt = Date.now();
  const sectionById = new Map(bundle.sections.map((section) => [section.id, section]));

  let attempt: ExamAttempt | undefined;
  if (options.attemptId) {
    const existing = await examDb.attempts.get(options.attemptId);
    if (existing) attempt = normalizeAttempt(existing);
  }
  if (!attempt) {
    attempt = (await getActiveExamAttempt(testId))?.attempt;
  }

  if (attempt?.deadlineAt && !attempt.timedOutAt && submittedAt >= attempt.deadlineAt) {
    attempt = (await captureTimedExamSnapshot(attempt.id)) ?? attempt;
  }

  const results = bundle.questions.map((question) => {
    const answer = answers[question.id] ?? '';
    const autoGradable = isAutoGradableQuestionType(question.type);
    return {
      questionId: question.id,
      answer,
      correct: autoGradable ? isExamAnswerCorrect(answer, question.correctAnswers) : null,
      correctAnswers: question.correctAnswers,
    };
  });
  const gradableResults = results.filter((result) => result.correct !== null);
  const score = gradableResults.filter((result) => result.correct).length;
  const total = gradableResults.length;

  const finalAttempt: ExamAttempt = attempt ?? {
    id: createId('attempt'),
    testId,
    status: 'in-progress',
    startedAt: submittedAt,
    updatedAt: submittedAt,
    flaggedQuestionIds: [],
  };
  const submittedWithinLimit = Boolean(finalAttempt.deadlineAt && submittedAt < finalAttempt.deadlineAt);
  const timedScore = submittedWithinLimit ? score : finalAttempt.timedScore;
  const timedTotal = submittedWithinLimit ? total : finalAttempt.timedTotal;
  const existingRows = await examDb.answers.where('attemptId').equals(finalAttempt.id).toArray();
  const existingByQuestionId = new Map(existingRows.map((row) => [row.questionId, row]));

  await examDb.transaction('rw', examDb.attempts, examDb.answers, async () => {
    const submittedAttempt: ExamAttempt = {
      ...finalAttempt,
      status: 'submitted',
      submittedAt,
      updatedAt: submittedAt,
      score,
      total,
      timedScore,
      timedTotal,
    };

    if (attempt) {
      await examDb.attempts.put(submittedAttempt);
    } else {
      await examDb.attempts.add(submittedAttempt);
    }

    await examDb.answers.bulkPut(
      results.map((result) => {
        const existing = existingByQuestionId.get(result.questionId);
        return {
          id: existing?.id ?? createId('answer'),
          attemptId: finalAttempt.id,
          questionId: result.questionId,
          answer: result.answer,
          correct: result.correct,
          answerAtDeadline: existing?.answerAtDeadline,
          updatedAt: submittedAt,
        };
      }),
    );
  });

  for (const result of results) {
    if (result.correct !== false) continue;
    const question = bundle.questions.find((item) => item.id === result.questionId);
    if (!question) continue;
    const section = sectionById.get(question.sectionId);
    if (!section) continue;

    await upsertWeakSpot({
      module: skillToWeakSpotModule(section.skill),
      weakSpotType: 'exam-question',
      sourceId: question.id,
      sourceType: 'exam',
      text: question.prompt,
      reason: `Incorrect ${bundle.test.examType} ${section.skill} question ${question.number}. Correct answer: ${question.correctAnswers.join(' / ')}`,
      targetHref: `/exams/${testId}/practice`,
      accuracy: 0,
    });
  }

  return {
    attemptId: finalAttempt.id,
    score,
    total,
    durationSeconds: Math.max(0, Math.floor((submittedAt - finalAttempt.startedAt) / 1000)),
    timeLimitSeconds: finalAttempt.timeLimitSeconds,
    timedScore,
    timedTotal,
    timedOutAt: finalAttempt.timedOutAt,
    results,
  };
}

export async function getAttemptAnswers(attemptId: string): Promise<ExamAttemptAnswer[]> {
  const examDb = getExamDb();
  return examDb.answers.where('attemptId').equals(attemptId).toArray();
}

export async function saveEssayGrading(attemptId: string, questionId: string, grading: EssayGrading): Promise<void> {
  const examDb = getExamDb();
  const existing = await examDb.answers.where('[attemptId+questionId]').equals([attemptId, questionId]).first();
  if (!existing) throw new Error('Answer not found for this question');

  await examDb.answers.update(existing.id, { aiGrading: grading, updatedAt: Date.now() });
}
