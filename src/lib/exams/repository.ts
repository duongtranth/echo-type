import { getExamDb } from '@/lib/exams/db';
import { isExamAnswerCorrect } from '@/lib/exams/grading';
import { upsertWeakSpot } from '@/lib/weak-spots';
import type {
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

export async function submitExamAttempt(
  testId: string,
  answers: Record<string, string>,
): Promise<ExamSubmissionResult> {
  const bundle = await getExamBundle(testId);
  if (!bundle) throw new Error('Exam not found');

  const examDb = getExamDb();
  const submittedAt = Date.now();
  const attemptId = createId('attempt');
  const sectionById = new Map(bundle.sections.map((section) => [section.id, section]));

  const results = bundle.questions.map((question) => {
    const answer = answers[question.id] ?? '';
    return {
      questionId: question.id,
      answer,
      correct: isExamAnswerCorrect(answer, question.correctAnswers),
      correctAnswers: question.correctAnswers,
    };
  });

  const score = results.filter((result) => result.correct).length;

  await examDb.transaction('rw', examDb.attempts, examDb.answers, async () => {
    await examDb.attempts.add({
      id: attemptId,
      testId,
      startedAt: submittedAt,
      submittedAt,
      score,
      total: bundle.questions.length,
    });

    await examDb.answers.bulkAdd(
      results.map((result) => ({
        id: createId('answer'),
        attemptId,
        questionId: result.questionId,
        answer: result.answer,
        correct: result.correct,
      })),
    );
  });

  for (const result of results) {
    if (result.correct) continue;
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
    attemptId,
    score,
    total: bundle.questions.length,
    results,
  };
}
