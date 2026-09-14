'use client';

import { ArrowLeft, Clock3, Play, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { addExamQuestion, deleteExamQuestion, getExamBundle } from '@/lib/exams/repository';
import { cn } from '@/lib/utils';
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
    return <div className="p-8 text-sm text-muted-foreground">Loading exam…</div>;
  }

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

  const hasQuestions = bundle.questions.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/exams"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Test library
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary">{bundle.test.examType}</Badge>
            <Badge variant="secondary">{bundle.test.status}</Badge>
          </div>
          <h1 className="font-heading mt-2 text-2xl font-semibold text-foreground">{bundle.test.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{bundle.test.sourceFilename || 'Imported exam'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild className={cn(!hasQuestions && 'pointer-events-none opacity-50')}>
            <Link href={`/exams/${bundle.test.id}/practice`} aria-disabled={!hasQuestions}>
              <Play className="h-4 w-4" />
              Practice ({bundle.questions.length})
            </Link>
          </Button>
          <Button
            asChild
            className={cn(
              'bg-success text-white hover:bg-success/90',
              !hasQuestions && 'pointer-events-none opacity-50',
            )}
          >
            <Link href={`/exams/${bundle.test.id}/practice?mode=test`} aria-disabled={!hasQuestions}>
              <Clock3 className="h-4 w-4" />
              Timed test
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Extracted source</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep the original extracted text visible while you verify imported questions and answers.
          </p>
          <pre className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-6 text-foreground">
            {selectedSection?.sourceText || 'No source text.'}
          </pre>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">Add question</h2>
              </div>

              {bundle.sections.length > 1 && (
                <div className="space-y-1">
                  <label htmlFor="question-section" className="text-sm font-medium text-foreground">
                    Section
                  </label>
                  <Select value={sectionId} onValueChange={setSectionId}>
                    <SelectTrigger id="question-section" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bundle.sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-[100px_1fr] gap-3">
                <div className="space-y-1">
                  <label htmlFor="question-number" className="text-sm font-medium text-foreground">
                    Number
                  </label>
                  <Input
                    id="question-number"
                    type="number"
                    min="1"
                    value={number}
                    onChange={(event) => setNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="question-type" className="text-sm font-medium text-foreground">
                    Type
                  </label>
                  <Select value={type} onValueChange={(value) => setType(value as ExamQuestionType)}>
                    <SelectTrigger id="question-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="question-prompt" className="text-sm font-medium text-foreground">
                  Prompt
                </label>
                <Textarea
                  id="question-prompt"
                  rows={3}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Question text"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="question-options" className="text-sm font-medium text-foreground">
                  Options
                </label>
                <Textarea
                  id="question-options"
                  rows={4}
                  value={options}
                  onChange={(event) => setOptions(event.target.value)}
                  placeholder={'One option per line\nA. First option\nB. Second option'}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="question-answers" className="text-sm font-medium text-foreground">
                  Correct answer(s)
                </label>
                <Input
                  id="question-answers"
                  value={answers}
                  onChange={(event) => setAnswers(event.target.value)}
                  placeholder="TRUE | T (use | for accepted alternatives)"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="question-explanation" className="text-sm font-medium text-foreground">
                  Explanation (optional)
                </label>
                <Textarea
                  id="question-explanation"
                  rows={2}
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Adding…' : 'Add question'}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-foreground">Questions ({bundle.questions.length})</h2>
            <div className="mt-4 space-y-3">
              {bundle.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions yet. Add the first verified question above.
                </p>
              ) : (
                bundle.questions.map((question) => (
                  <div key={question.id} className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          Q{question.number} · {question.type}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{question.prompt}</p>
                        <p className="mt-2 text-xs text-success">Answer: {question.correctAnswers.join(' / ')}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDeleteQuestion(question.id)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete question ${question.number}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
