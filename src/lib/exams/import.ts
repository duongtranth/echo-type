import { getExamDb } from '@/lib/exams/db';
import type { ExamType, ParsedExamDraft } from '@/types/exam';

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function createExamFromParsedDraft(input: {
  title: string;
  examType: ExamType;
  sourceFilename?: string;
  rawText: string;
  draft: ParsedExamDraft;
}): Promise<{ testId: string; importedQuestions: number; skippedQuestions: number }> {
  const examDb = getExamDb();
  const now = Date.now();
  const testId = createId('exam');
  let importedQuestions = 0;
  let skippedQuestions = 0;
  const sections =
    input.draft.sections.length > 0
      ? input.draft.sections
      : [{ skill: 'reading' as const, title: 'Imported section', questions: [] }];

  await examDb.transaction('rw', examDb.tests, examDb.sections, examDb.questions, async () => {
    await examDb.tests.add({
      id: testId,
      title: input.draft.title?.trim() || input.title.trim() || input.sourceFilename || `${input.examType} exam`,
      examType: input.examType,
      status: 'draft',
      sourceFilename: input.sourceFilename,
      createdAt: now,
      updatedAt: now,
    });

    for (const [sectionIndex, section] of sections.entries()) {
      const sectionId = createId('section');
      await examDb.sections.add({
        id: sectionId,
        testId,
        skill: section.skill,
        title: section.title?.trim() || `Section ${sectionIndex + 1}`,
        instructions: section.instructions?.trim() || undefined,
        sourceText: section.sourceText?.trim() || (sectionIndex === 0 ? input.rawText : undefined),
        order: sectionIndex,
        createdAt: now,
        updatedAt: now,
      });

      let questionOrder = 0;
      for (const question of section.questions ?? []) {
        const correctAnswers = (question.correctAnswers ?? []).map((value) => value.trim()).filter(Boolean);
        if (!question.prompt?.trim() || correctAnswers.length === 0) {
          skippedQuestions += 1;
          continue;
        }

        await examDb.questions.add({
          id: createId('question'),
          testId,
          sectionId,
          number: Number.isFinite(question.number) && question.number > 0 ? question.number : questionOrder + 1,
          type: question.type || 'other',
          prompt: question.prompt.trim(),
          options: question.options?.map((value) => value.trim()).filter(Boolean),
          correctAnswers,
          explanation: question.explanation?.trim() || undefined,
          order: questionOrder,
          createdAt: now,
          updatedAt: now,
        });
        questionOrder += 1;
        importedQuestions += 1;
      }
    }
  });

  return { testId, importedQuestions, skippedQuestions };
}
