'use client';

import { ArrowLeft, CheckCircle2, Clock3, Flag, RotateCcw, Save, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  captureTimedExamSnapshot,
  getExamBundle,
  saveExamAttemptProgress,
  startExamAttempt,
  submitExamAttempt,
} from '@/lib/exams/repository';
import { formatExamTime, getSuggestedExamTimeLimitSeconds } from '@/lib/exams/timing';
import { cn } from '@/lib/utils';
import type { ExamAttemptProgress, ExamBundle, ExamSubmissionResult } from '@/types/exam';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ExamPracticePage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;
  const [bundle, setBundle] = useState<ExamBundle | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamSubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [attemptReady, setAttemptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attemptId, setAttemptId] = useState('');
  const [deadlineAt, setDeadlineAt] = useState<number | undefined>();
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | undefined>();
  const [timedOutAt, setTimedOutAt] = useState<number | undefined>();
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [now, setNow] = useState(Date.now());

  const loadBundle = useCallback(async () => {
    setLoading(true);
    setBundle(await getExamBundle(examId));
    setLoading(false);
  }, [examId]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  const applyAttemptProgress = useCallback((progress: ExamAttemptProgress) => {
    setAttemptId(progress.attempt.id);
    setAnswers(progress.answers);
    setDeadlineAt(progress.attempt.deadlineAt);
    setTimeLimitSeconds(progress.attempt.timeLimitSeconds);
    setTimedOutAt(progress.attempt.timedOutAt);
    setFlaggedQuestionIds(progress.attempt.flaggedQuestionIds ?? []);
    setCurrentQuestionId(progress.attempt.currentQuestionId);
    setNow(Date.now());
    setSaveState('saved');
    setAttemptReady(true);
  }, []);

  useEffect(() => {
    if (!bundle) return;
    if (bundle.questions.length === 0) {
      setAttemptReady(true);
      return;
    }

    let cancelled = false;
    setAttemptReady(false);

    void (async () => {
      try {
        const timedMode =
          typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'test';
        const progress = await startExamAttempt(bundle.test.id, {
          timeLimitSeconds: timedMode ? getSuggestedExamTimeLimitSeconds(bundle) : undefined,
        });
        if (!cancelled) applyAttemptProgress(progress);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not start this attempt.');
          setAttemptReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAttemptProgress, bundle]);

  useEffect(() => {
    if (!deadlineAt || result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt, result]);

  const remainingSeconds = deadlineAt ? Math.max(0, Math.ceil((deadlineAt - now) / 1000)) : undefined;

  useEffect(() => {
    if (!attemptId || !deadlineAt || timedOutAt || result || remainingSeconds !== 0) return;

    void captureTimedExamSnapshot(attemptId)
      .then((attempt) => {
        if (attempt?.timedOutAt) setTimedOutAt(attempt.timedOutAt);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not save the timed snapshot.'));
  }, [attemptId, deadlineAt, remainingSeconds, result, timedOutAt]);

  useEffect(() => {
    if (!attemptReady || !attemptId || result || submitting) return;

    setSaveState('saving');
    const timer = window.setTimeout(() => {
      void saveExamAttemptProgress(attemptId, {
        answers,
        currentQuestionId,
        flaggedQuestionIds,
      })
        .then((attempt) => {
          if (attempt.timedOutAt) setTimedOutAt(attempt.timedOutAt);
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, 500);

    return () => window.clearTimeout(timer);
  }, [answers, attemptId, attemptReady, currentQuestionId, flaggedQuestionIds, result, submitting]);

  const resultByQuestionId = useMemo(
    () => new Map(result?.results.map((item) => [item.questionId, item]) ?? []),
    [result],
  );

  const answeredCount = useMemo(
    () => bundle?.questions.filter((question) => (answers[question.id] ?? '').trim().length > 0).length ?? 0,
    [answers, bundle],
  );
  const unansweredCount = (bundle?.questions.length ?? 0) - answeredCount;

  const scrollToQuestion = (questionId: string) => {
    setCurrentQuestionId(questionId);
    document.getElementById(`question-${questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateAnswer = (questionId: string, answer: string) => {
    setCurrentQuestionId(questionId);
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  const toggleFlag = (questionId: string) => {
    setCurrentQuestionId(questionId);
    setFlaggedQuestionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!bundle || bundle.questions.length === 0 || !attemptId) return;

    if (unansweredCount > 0 && !window.confirm(`${unansweredCount} question(s) are unanswered. Submit anyway?`)) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await saveExamAttemptProgress(attemptId, {
        answers,
        currentQuestionId,
        flaggedQuestionIds,
      });
      setResult(await submitExamAttempt(bundle.test.id, answers, { attemptId }));
      setSaveState('saved');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit this attempt.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAttempt = async () => {
    if (!bundle) return;
    setResult(null);
    setError('');
    setAttemptReady(false);
    try {
      const progress = await startExamAttempt(bundle.test.id, {
        timeLimitSeconds: timeLimitSeconds ? getSuggestedExamTimeLimitSeconds(bundle) : undefined,
        forceNew: true,
      });
      applyAttemptProgress(progress);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start another attempt.');
      setAttemptReady(true);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading practice…</div>;

  if (!bundle) {
    return (
      <div className="p-8">
        <p className="text-foreground">Exam not found.</p>
        <Link href="/exams" className="mt-3 inline-block text-sm font-medium text-primary">
          Back to test library
        </Link>
      </div>
    );
  }

  if (!attemptReady && bundle.questions.length > 0) {
    return <div className="p-8 text-sm text-muted-foreground">Preparing your attempt…</div>;
  }

  const sourceText = bundle.sections.find((section) => section.sourceText)?.sourceText;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/exams/${bundle.test.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Edit exam
          </Link>
          <p className="mt-3 text-sm font-semibold text-primary">
            {bundle.test.examType} {timeLimitSeconds ? 'timed test' : 'practice'}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{bundle.test.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bundle.questions.length} questions · {answeredCount} answered
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {timeLimitSeconds && remainingSeconds !== undefined && !result && (
            <Card
              className={cn(
                'p-0 px-5 py-3 text-center',
                timedOutAt || remainingSeconds === 0
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : remainingSeconds <= 300
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'text-foreground',
              )}
            >
              <p className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wide">
                <Clock3 className="h-3.5 w-3.5" /> Time
              </p>
              <p className="mt-1 text-xl font-bold">{formatExamTime(remainingSeconds)}</p>
            </Card>
          )}

          {result && (
            <Card className="border-success/30 bg-success/10 p-0 px-5 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-success">Final score</p>
              <p className="text-2xl font-bold text-success">
                {result.score}/{result.total}
              </p>
              <p className="mt-1 text-xs text-success">{formatExamTime(result.durationSeconds)}</p>
            </Card>
          )}

          {result?.timeLimitSeconds && result.timedScore !== undefined && result.timedTotal !== undefined && (
            <Card className="border-primary/30 bg-primary/10 p-0 px-5 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {result.timedOutAt ? 'At time limit' : 'Within time'}
              </p>
              <p className="text-2xl font-bold text-primary">
                {result.timedScore}/{result.timedTotal}
              </p>
            </Card>
          )}
        </div>
      </div>

      {timedOutAt && !result && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Time limit reached.</strong> Your answers at the deadline were snapshotted. You can keep working;
          after submission the app will show both your score at the time limit and your final score.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Source</h2>
          <pre className="mt-4 max-h-[75vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-7 text-foreground">
            {sourceText || 'No source text attached to this exam.'}
          </pre>
        </Card>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {bundle.questions.length > 0 && (
            <Card className="sticky top-4 z-10 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Question navigator</p>
                  <p className="text-xs text-muted-foreground">
                    {answeredCount}/{bundle.questions.length} answered · {flaggedQuestionIds.length} flagged
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Save className="h-3.5 w-3.5" />
                  {saveState === 'saving' && 'Saving…'}
                  {saveState === 'saved' && 'Saved'}
                  {saveState === 'error' && <span className="text-destructive">Save failed</span>}
                  {saveState === 'idle' && 'Autosave ready'}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bundle.questions.map((question) => {
                  const answered = (answers[question.id] ?? '').trim().length > 0;
                  const flagged = flaggedQuestionIds.includes(question.id);
                  const questionResult = resultByQuestionId.get(question.id);
                  const active = currentQuestionId === question.id;

                  let className = 'border-border bg-card text-muted-foreground hover:border-primary/40';
                  if (questionResult) {
                    className = questionResult.correct
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-destructive/40 bg-destructive/10 text-destructive';
                  } else if (flagged) {
                    className = 'border-amber-300 bg-amber-50 text-amber-800';
                  } else if (answered) {
                    className = 'border-success/30 bg-success/10 text-success';
                  }
                  if (active) className += ' ring-2 ring-ring ring-offset-1';

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => scrollToQuestion(question.id)}
                      className={`min-w-9 rounded-md border px-2 py-1.5 text-xs font-semibold ${className}`}
                      aria-label={`Go to question ${question.number}${flagged ? ', flagged' : ''}`}
                    >
                      {question.number}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {bundle.questions.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              This exam has no questions yet. Return to the editor and add one first.
            </Card>
          ) : (
            bundle.questions.map((question) => {
              const questionResult = resultByQuestionId.get(question.id);
              const isMultipleChoice = question.type === 'multiple-choice' && (question.options?.length ?? 0) > 0;
              const flagged = flaggedQuestionIds.includes(question.id);

              return (
                <fieldset
                  id={`question-${question.id}`}
                  key={question.id}
                  disabled={Boolean(result)}
                  onFocusCapture={() => setCurrentQuestionId(question.id)}
                  className={`scroll-mt-40 rounded-xl border bg-white p-5 shadow-sm ${
                    questionResult
                      ? questionResult.correct
                        ? 'border-emerald-200'
                        : 'border-red-200'
                      : flagged
                        ? 'border-amber-300'
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
                    <div className="flex shrink-0 items-center gap-2">
                      {!result && (
                        <button
                          type="button"
                          onClick={() => toggleFlag(question.id)}
                          className={`rounded-md border p-1.5 ${
                            flagged
                              ? 'border-amber-300 bg-amber-50 text-amber-600'
                              : 'border-slate-200 text-slate-400 hover:text-amber-600'
                          }`}
                          aria-label={`${flagged ? 'Unflag' : 'Flag'} question ${question.number}`}
                        >
                          <Flag className="h-4 w-4" fill={flagged ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      {questionResult?.correct && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {questionResult && !questionResult.correct && <XCircle className="h-5 w-5 text-red-500" />}
                    </div>
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
                            onChange={(event) => updateAnswer(question.id, event.target.value)}
                            className="mt-0.5"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      value={answers[question.id] ?? ''}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
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
              disabled={submitting || !attemptId}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting
                ? 'Submitting…'
                : `Submit answers${unansweredCount > 0 ? ` (${unansweredCount} unanswered)` : ''}`}
            </button>
          )}

          {result && (
            <button
              type="button"
              onClick={() => void resetAttempt()}
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
