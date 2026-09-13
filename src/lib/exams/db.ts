import Dexie, { type Table } from 'dexie';
import { db as learningDb } from '@/lib/db';
import type { ExamAttempt, ExamAttemptAnswer, ExamQuestion, ExamSection, ExamTest } from '@/types/exam';

class EchoTypeExamDB extends Dexie {
  tests!: Table<ExamTest>;
  sections!: Table<ExamSection>;
  questions!: Table<ExamQuestion>;
  attempts!: Table<ExamAttempt>;
  answers!: Table<ExamAttemptAnswer>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      tests: 'id, examType, status, createdAt, updatedAt',
      sections: 'id, testId, skill, [testId+order], updatedAt',
      questions: 'id, testId, sectionId, number, type, [sectionId+order], updatedAt',
      attempts: 'id, testId, startedAt, submittedAt',
      answers: 'id, attemptId, questionId, correct, [attemptId+questionId]',
    });
  }
}

function getExamDatabaseName(): string {
  return `${learningDb.name}:exams`;
}

let activeExamDb = new EchoTypeExamDB(getExamDatabaseName());

export function getExamDb(): EchoTypeExamDB {
  const expectedName = getExamDatabaseName();
  if (activeExamDb.name !== expectedName) {
    activeExamDb.close();
    activeExamDb = new EchoTypeExamDB(expectedName);
  }
  return activeExamDb;
}
