'use client';

import { Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import enPracticeUi from '@/lib/i18n/messages/practice-ui/en.json';
import zhPracticeUi from '@/lib/i18n/messages/practice-ui/zh.json';
import { cn } from '@/lib/utils';
import { useLanguageStore } from '@/stores/language-store';
import { useReadAloudStore } from '@/stores/read-aloud-store';
import { useTTSStore } from '@/stores/tts-store';

const PRACTICE_UI_LOCALES = { en: enPracticeUi, zh: zhPracticeUi } as const;
const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface ReadAloudInlineControlsProps {
  accentClassName?: string;
  children?: React.ReactNode;
  className?: string;
  label: string;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRestart?: () => void;
  progress?: number;
  showImmersive?: boolean;
  showProgress?: boolean;
}

export function ReadAloudInlineControls({
  accentClassName = 'text-indigo-600',
  children,
  className,
  label,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onRestart,
  progress: progressOverride,
  showImmersive = true,
  showProgress = true,
}: ReadAloudInlineControlsProps) {
  const raT = PRACTICE_UI_LOCALES[useLanguageStore((s) => s.interfaceLanguage)].readAloud;
  const isPlaying = useReadAloudStore((s) => s.isPlaying);
  const immersiveMode = useReadAloudStore((s) => s.immersiveMode);
  const toggleImmersiveMode = useReadAloudStore((s) => s.toggleImmersiveMode);
  const words = useReadAloudStore((s) => s.words);
  const currentWordIndex = useReadAloudStore((s) => s.currentWordIndex);
  const { speed, setSpeed } = useTTSStore();

  const ttsProgress = words.length > 0 && currentWordIndex >= 0 ? ((currentWordIndex + 1) / words.length) * 100 : 0;
  const progress = Math.min(100, Math.max(0, progressOverride ?? ttsProgress));

  return (
    <div
      data-testid="read-aloud-inline-controls"
      className={cn('rounded-2xl border border-slate-200 bg-slate-50/95 p-2.5 shadow-sm backdrop-blur', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
          {showProgress ? ` · ${Math.round(progress)}% ${raT.progress.toLowerCase()}` : null}
        </p>
        <Select value={String(speed)} onValueChange={(value) => setSpeed(Number(value))}>
          <SelectTrigger size="sm" className="h-7 min-w-16 rounded-full bg-white text-xs font-semibold shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_STEPS.map((step) => (
              <SelectItem key={step} value={String(step)}>
                {step}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showProgress ? (
        <div
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white"
        >
          <div
            className={cn(
              'h-full rounded-full bg-[linear-gradient(90deg,rgba(79,70,229,0.96)_0%,rgba(129,140,248,0.92)_100%)] transition-all duration-300',
              accentClassName.includes('orange') &&
                'bg-[linear-gradient(90deg,rgba(249,115,22,0.94)_0%,rgba(251,146,60,0.9)_100%)]',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <Button type="button" variant="outline" size="icon-sm" onClick={onPrev} aria-label={raT.previousSentence}>
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onRestart ?? onPrev}
          aria-label="Restart"
          disabled={!onRestart}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={isPlaying ? onPause : onPlay}
          className={cn(
            'min-w-24 gap-2 shadow-sm',
            accentClassName.includes('orange')
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white',
          )}
          aria-label={isPlaying ? raT.pause : raT.play}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          {isPlaying ? raT.pause : raT.play}
        </Button>
        <Button type="button" variant="outline" size="icon-sm" onClick={onNext} aria-label={raT.nextSentence}>
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        {showImmersive ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={toggleImmersiveMode}
            aria-label={immersiveMode ? raT.exitImmersive : raT.immersiveMode}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {children ? <div className="mt-2 border-t border-slate-200 pt-2">{children}</div> : null}
    </div>
  );
}
