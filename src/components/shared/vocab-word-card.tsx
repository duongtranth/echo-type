'use client';

import { ImageOff, Volume2 } from 'lucide-react';
import { WordDictionaryInfo } from '@/components/shared/word-dictionary-info';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWordImage } from '@/hooks/use-word-image';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/types/content';
import type { PracticeModule } from '@/types/translation';

export const difficultyColors: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

interface VocabWordCardProps {
  word: string;
  example: string;
  targetLang: string;
  module: PracticeModule;
  difficulty?: ContentItem['difficulty'];
  tags?: string[];
  idPrefix: string;
  showWord?: boolean;
  showMeaning?: boolean;
  onSpeakWord: () => void;
  playWordTooltip: string;
}

/**
 * Word/definition block shared by WordBookPractice and SingleItemPractice: title + speak
 * button, an Unsplash illustration for recall, dictionary meaning, and tag badges.
 */
export function VocabWordCard({
  word,
  example,
  targetLang,
  module,
  difficulty,
  tags = [],
  idPrefix,
  showWord = true,
  showMeaning = true,
  onSpeakWord,
  playWordTooltip,
}: VocabWordCardProps) {
  const { url: imageUrl, attribution, isLoading: isImageLoading } = useWordImage(word, showMeaning);

  return (
    <div className="text-center space-y-4">
      {showMeaning && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative h-44 w-44 overflow-hidden rounded-3xl bg-indigo-50 shadow-md sm:h-52 sm:w-52">
            {isImageLoading && <Skeleton className="h-full w-full" />}
            {!isImageLoading && imageUrl && <img src={imageUrl} alt={word} className="h-full w-full object-cover" />}
            {!isImageLoading && !imageUrl && (
              <div className="flex h-full w-full items-center justify-center text-indigo-200">
                <ImageOff className="h-10 w-10" />
              </div>
            )}
          </div>
          {attribution && (
            <p className="text-[9px] text-indigo-200">
              Ảnh:{' '}
              <a href={attribution.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {attribution.photographer}
              </a>{' '}
              /{' '}
              <a href={attribution.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Unsplash
              </a>
            </p>
          )}
        </div>
      )}

      {showWord && (
        <div className="flex items-center justify-center gap-2.5">
          <h2 className="font-heading text-5xl font-extrabold tracking-tight text-indigo-900 sm:text-6xl">{word}</h2>
          <button
            type="button"
            onClick={onSpeakWord}
            className="text-indigo-300 hover:text-indigo-600 cursor-pointer transition-colors p-1"
            title={playWordTooltip}
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {showMeaning && <WordDictionaryInfo word={word} targetLang={targetLang} module={module} contextText={example} />}

      {(difficulty || tags.length > 0) && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap opacity-60">
          {difficulty && (
            <Badge className={cn(difficultyColors[difficulty], 'text-[9px] px-1.5 py-0')} variant="secondary">
              {difficulty}
            </Badge>
          )}
          {tags.slice(0, 3).map((tag, index) => (
            <Badge
              key={`${idPrefix}-${tag}-${index}`}
              variant="outline"
              className="border-indigo-100 text-indigo-300 text-[9px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
