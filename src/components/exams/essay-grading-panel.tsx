'use client';

import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { saveEssayGrading } from '@/lib/exams/repository';
import { PROVIDER_REGISTRY } from '@/lib/providers';
import { cn } from '@/lib/utils';
import { useProviderStore } from '@/stores/provider-store';
import type { EssayGrading, ExamSkill, ExamType } from '@/types/exam';

interface EssayGradingPanelProps {
  attemptId: string;
  questionId: string;
  examType: ExamType;
  skill: ExamSkill;
  prompt: string;
  answer: string;
  wordCountTarget?: number;
  grading?: EssayGrading;
  onGraded: (grading: EssayGrading) => void;
}

function bandColorClass(band: number): string {
  if (band >= 7) return 'text-emerald-600 dark:text-emerald-400';
  if (band >= 5) return 'text-primary';
  return 'text-destructive';
}

export function EssayGradingPanel({
  attemptId,
  questionId,
  examType,
  skill,
  prompt,
  answer,
  wordCountTarget,
  grading,
  onGraded,
}: EssayGradingPanelProps) {
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const activeConfig = useProviderStore((state) => state.getActiveConfig());
  const providers = useProviderStore((state) => state.providers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGrade = async () => {
    setLoading(true);
    setError('');
    try {
      const apiKey = activeConfig.auth.apiKey || activeConfig.auth.accessToken || '';
      const headerKey = PROVIDER_REGISTRY[activeProviderId].headerKey;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers[headerKey] = apiKey;

      const response = await fetch('/api/exams/grade-essay', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          examType,
          skill,
          prompt,
          answer,
          wordCountTarget,
          provider: activeProviderId,
          providerConfigs: providers,
        }),
      });
      const json = (await response.json()) as { grading?: EssayGrading; error?: string };
      if (!response.ok || !json.grading) {
        throw new Error(json.error || 'AI could not grade this answer.');
      }

      await saveEssayGrading(attemptId, questionId, json.grading);
      onGraded(json.grading);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI could not grade this answer.');
    } finally {
      setLoading(false);
    }
  };

  if (!grading) {
    return (
      <div className="space-y-2">
        <Button type="button" size="sm" onClick={handleGrade} disabled={loading || !answer.trim()}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {loading ? 'Grading…' : 'Grade with AI'}
        </Button>
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className="space-y-4 border-primary/20 bg-primary/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI band estimate</span>
        </div>
        <span className={cn('font-heading text-2xl font-bold', bandColorClass(grading.bandScore))}>
          {grading.bandScore.toFixed(1)}
        </span>
      </div>

      {grading.criteria.length > 0 && (
        <div className="space-y-2">
          {grading.criteria.map((criterion) => (
            <div key={criterion.criterion} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{criterion.criterion}</p>
                <p className="text-xs text-muted-foreground">{criterion.feedback}</p>
              </div>
              <Badge variant="outline" className={bandColorClass(criterion.score)}>
                {criterion.score.toFixed(1)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-foreground">{grading.overallFeedback}</p>

      {grading.strengths.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Strengths
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {grading.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {grading.improvements.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">To improve</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {grading.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
