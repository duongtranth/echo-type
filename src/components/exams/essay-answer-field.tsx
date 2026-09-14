'use client';

import { Mic, Square } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFallbackSTT } from '@/hooks/use-fallback-stt';
import { cn } from '@/lib/utils';

interface EssayAnswerFieldProps {
  value: string;
  onChange: (value: string) => void;
  wordCountTarget?: number;
  allowVoice?: boolean;
  disabled?: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function EssayAnswerField({ value, onChange, wordCountTarget, allowVoice, disabled }: EssayAnswerFieldProps) {
  const [voiceError, setVoiceError] = useState('');
  const { isRecording, isTranscribing, startRecording, stopRecording } = useFallbackSTT({
    onTranscript: (text) => {
      onChange(value ? `${value} ${text}`.trim() : text);
    },
    onError: (message) => setVoiceError(message),
  });

  const wordCount = countWords(value);
  const belowTarget = wordCountTarget ? wordCount < wordCountTarget : false;

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer here…"
        rows={10}
        disabled={disabled}
        className="min-h-[220px]"
      />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn('text-muted-foreground', belowTarget && 'text-amber-600 dark:text-amber-500')}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
          {wordCountTarget ? ` / target ${wordCountTarget}` : ''}
        </span>

        {allowVoice && (
          <Button
            type="button"
            size="sm"
            variant={isRecording ? 'destructive' : 'outline'}
            disabled={disabled || isTranscribing}
            onClick={() => (isRecording ? stopRecording() : startRecording())}
          >
            {isRecording ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
            {isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing…' : 'Record answer'}
          </Button>
        )}
      </div>
      {voiceError && <p className="text-xs text-destructive">{voiceError}</p>}
    </div>
  );
}
