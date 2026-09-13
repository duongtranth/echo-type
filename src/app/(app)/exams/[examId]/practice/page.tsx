'use client';

import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getExamBundle, submitExamAttempt } from '@/lib/exams/repository';
import type { ExamBundle, ExamSubmissionResult } from '@/types/exam';

export default function ExamPracticePage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;
  const [bundle, setBundle] = useState<ExamBundle | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamSubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadBundle = useCallback(async () => {
    setLoading(true);
    setBundle(await getExamBundle(examId));
    setLoading(false);
  }, [examId]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  const resultByQuestionId = useMemo(
    () => new Map(result?.results.map((item) => [item.questionId, item]) ?? []),
    [result],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!bundle || bundle.questions.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      setResult(await submitExamAttempt(bundle.test.id, answers));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit this attempt.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAttempt = () => {
    setAnswers({});
    setResult(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading practice…</div>;

  if (!bundle) {
    return (
      <div className="p-8">
        <p className="text-slate-700">Exam not found.</p>
        <Link href="/exams" className="mt-3 inline-block text-sm font-medium text-indigo-600">
          Back to test library
        </Link>
      </div>
    );
  }

  const sourceText = bundle.sections.find((section) => section.sourceText)?.sourceText;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/exams/${bundle.test.id}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Edit exam
          </Link>
          <p className="mt-3 text-sm font-semibold text-indigo-600">{bundle.test.examType} practice</p>
          <h1 className="text-2xl font-semibold text-slate-900">{bundle.test.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{bundle.questions.length} questions</p>
        </div>

        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Score</p>
            <p className="text-2xl font-bold text-emerald-800">
              {result.score}/{result.total}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Source</h2>
          <pre className="mt-4 max-h-[75vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {sourceText || 'No source text attached to this exam.'}
          </pre>
        </section>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {bundle.questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              This exam has no questions yet. Return to the editor and add one first.
            </div>
          ) : (
            bundle.questions.map((question) => {
              const questionResult = resultByQuestionId.get(question.id);
              const isMultipleChoice = question.type === 'multiple-choice' && (question.options?.length ?? 0) > 0;

              return (
                <fieldset
                  key={question.id}
                  disabled={Boolean(result)}
                  className={`rounded-xl border bg-white p-5 shadow-sm ${
                    questionResult
                      ? questionResult.correct
                        ? 'border-emerald-200'
                        : 'border-red-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        Question {question.number} · {question.type}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{question.prompt}</p>
                    </div>
                    {questionResult?.correct && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                    {questionResult && !questionResult.correct && <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
                  </div>

                  {isMultipleChoice ? (
                    <div className="mt-4 space-y-2">
                      {question.options?.map((option) => (
                        <label
                          key={option}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(event) =>
                              setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                            }
                            className="mt-0.5"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      value={answers[question.id] ?? ''}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      placeholder="Your answer"
                      className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  )}

                  {questionResult && !questionResult.correct && (
                    <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                      <p>
                        Correct answer: <strong>{questionResult.correctAnswers.join(' / ')}</strong>
                      </p>
                      {question.explanation && <p className="mt-1 text-red-700">{question.explanation}</p>}
                      <p className="mt-2 text-xs text-red-600">This question was added to Weak Spots for review.</p>
                    </div>
                  )}

                  {questionResult?.correct && question.explanation && (
                    <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{question.explanation}</p>
                  )}
                </fieldset>
              );
            })
          )}

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {bundle.questions.length > 0 && !result && (
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit answers'}
            </button>
          )}

          {result && (
            <button
              type="button"
              onClick={resetAttempt}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
