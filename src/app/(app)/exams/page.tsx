'use client';

import { BookOpenCheck, FileUp, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { deleteExamTest, listExamTests } from '@/lib/exams/repository';
import type { ExamTest } from '@/types/exam';

export default function ExamsPage() {
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      setTests(await listExamTests());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const handleDelete = async (test: ExamTest) => {
    if (!window.confirm(`Delete “${test.title}”?`)) return;
    await deleteExamTest(test.id);
    await loadTests();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Exam practice</p>
          <h1 className="text-2xl font-semibold text-slate-900">IELTS & TOEIC Test Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Import a test, add or review its questions, then practise and send mistakes to Weak Spots.
          </p>
        </div>
        <Link
          href="/exams/import"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <FileUp className="h-4 w-4" />
          Import exam
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading exams…</div>
      ) : tests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpenCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 font-medium text-slate-800">No imported exams yet</h2>
          <p className="mt-1 text-sm text-slate-500">Start with an IELTS or TOEIC PDF.</p>
          <Link
            href="/exams/import"
            className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Import your first exam
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => (
            <div key={test.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                      {test.examType}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{test.status}</span>
                  </div>
                  <h2 className="mt-3 truncate font-semibold text-slate-900">{test.title}</h2>
                  <p className="mt-1 truncate text-xs text-slate-500">{test.sourceFilename || 'Manual import'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(test)}
                  className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${test.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-slate-400">Updated {new Date(test.updatedAt).toLocaleDateString()}</span>
                <Link href={`/exams/${test.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
