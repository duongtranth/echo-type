'use client';

import { ArrowLeft, Play, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { addExamQuestion, deleteExamQuestion, getExamBundle } from '@/lib/exams/repository';
import type { ExamBundle, ExamQuestionType } from '@/types/exam';

const QUESTION_TYPES: { value: ExamQuestionType; label: string }[] = [
  { value: 'multiple-choice', label: 'Multiple choice' },
  { value: 'true-false-not-given', label: 'True / False / Not Given' },
  { value: 'yes-no-not-given', label: 'Yes / No / Not Given' },
  { value: 'sentence-completion', label: 'Sentence completion' },
  { value: 'summary-completion', label: 'Summary completion' },
  { value: 'short-answer', label: 'Short answer' },
  { value: 'matching', label: 'Matching' },
  { value: 'other', label: 'Other' },
];

export default function ExamEditorPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;
  const [bundle, setBundle] = useState<ExamBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [number, setNumber] = useState('1');
  const [type, setType] = useState<ExamQuestionType>('multiple-choice');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState('');
  const [answers, setAnswers] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');

  const loadBundle = useCallback(async () => {
    setLoading(true);
    const nextBundle = await getExamBundle(examId);
    setBundle(nextBundle);
    if (nextBundle) {
      setSectionId((current) => current || nextBundle.sections[0]?.id || '');
      const nextNumber = nextBundle.questions.reduce((max, question) => Math.max(max, question.number), 0) + 1;
      setNumber(String(nextNumber));
    }
    setLoading(false);
  }, [examId]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  const selectedSection = useMemo(
    () => bundle?.sections.find((section) => section.id === sectionId) ?? bundle?.sections[0],
    [bundle, sectionId],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!bundle || !selectedSection) return;
    const parsedNumber = Number(number);
    const acceptedAnswers = answers
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0 || !prompt.trim() || acceptedAnswers.length === 0) {
      setError('Question number, prompt, and at least one correct answer are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await addExamQuestion({
        testId: bundle.test.id,
        sectionId: selectedSection.id,
        number: parsedNumber,
        type,
        prompt,
        options: options
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
        correctAnswers: acceptedAnswers,
        explanation,
      });
      setPrompt('');
      setOptions('');
      setAnswers('');
      setExplanation('');
      await loadBundle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    await deleteExamQuestion(questionId);
    await loadBundle();
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading exam…</div>;
  }

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/exams" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="h-4 w-4" />
            Test library
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
              {bundle.test.examType}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{bundle.test.status}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{bundle.test.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{bundle.test.sourceFilename || 'Imported exam'}</p>
        </div>
        <Link
          href={`/exams/${bundle.test.id}/practice`}
          aria-disabled={bundle.questions.length === 0}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            bundle.questions.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'pointer-events-none bg-slate-300'
          }`}
        >
          <Play className="h-4 w-4" />
          Start practice ({bundle.questions.length})
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Extracted source</h2>
          <p className="mt-1 text-xs text-slate-500">
            Phase 1 keeps the original extracted text visible while you verify questions. OCR/AI parsing can populate
            the editor later.
          </p>
          <pre className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {selectedSection?.sourceText || 'No source text.'}
          </pre>
        </section>

        <div className="space-y-6">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-500" />
              <h2 className="font-semibold text-slate-900">Add question</h2>
            </div>

            {bundle.sections.length > 1 && (
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                Section
                <select
                  value={sectionId}
                  onChange={(event) => setSectionId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
                >
                  {bundle.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-[100px_1fr] gap-3">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Number
                <input
                  type="number"
                  min="1"
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Type
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as ExamQuestionType)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
                >
                  {QUESTION_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Prompt
              <textarea
                rows={3}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
                placeholder="Question text"
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Options
              <textarea
                rows={4}
                value={options}
                onChange={(event) => setOptions(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
                placeholder={'One option per line\nA. First option\nB. Second option'}
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Correct answer(s)
              <input
                value={answers}
                onChange={(event) => setAnswers(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
                placeholder="TRUE | T (use | for accepted alternatives)"
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Explanation (optional)
              <textarea
                rows={2}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-normal"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add question'}
            </button>
          </form>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Questions ({bundle.questions.length})</h2>
            <div className="mt-4 space-y-3">
              {bundle.questions.length === 0 ? (
                <p className="text-sm text-slate-500">No questions yet. Add the first verified question above.</p>
              ) : (
                bundle.questions.map((question) => (
                  <div key={question.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          Q{question.number} · {question.type}
                        </p>
                        <p className="mt-1 text-sm text-slate-800">{question.prompt}</p>
                        <p className="mt-2 text-xs text-emerald-700">Answer: {question.correctAnswers.join(' / ')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteQuestion(question.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete question ${question.number}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
