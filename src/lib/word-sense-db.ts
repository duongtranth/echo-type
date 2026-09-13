import Dexie, { type Table } from 'dexie';
import { db as learningDb } from '@/lib/db';
import type { WordSenseProgress } from '@/types/word-sense';

class EchoTypeWordSenseDB extends Dexie {
  progress!: Table<WordSenseProgress>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      progress: 'id, word, status, nextReview, updatedAt, [word+status]',
    });
  }
}

function getWordSenseDatabaseName(): string {
  return `${learningDb.name}:word-senses`;
}

let activeWordSenseDb = new EchoTypeWordSenseDB(getWordSenseDatabaseName());

export function getWordSenseDb(): EchoTypeWordSenseDB {
  const expectedName = getWordSenseDatabaseName();
  if (activeWordSenseDb.name !== expectedName) {
    activeWordSenseDb.close();
    activeWordSenseDb = new EchoTypeWordSenseDB(expectedName);
  }
  return activeWordSenseDb;
}
