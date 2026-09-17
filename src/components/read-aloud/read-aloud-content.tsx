'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WordLookupContent } from '@/components/shared/word-lookup';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useHasHover } from '@/hooks/use-has-hover';
import { type ContentBlock, splitContentBlocks } from '@/lib/content-format';
import { cn } from '@/lib/utils';
import { useReadAloudStore } from '@/stores/read-aloud-store';

interface ReadAloudContentProps {
  text: string;
  onWordClick?: (word: string) => void;
  showTranslation?: boolean;
  sentenceTranslations?: Array<{ startWordIndex: number; endWordIndex: number; translation: string }> | null;
  /** When set, hovering any word shows a Cambridge/Collins-style dictionary popup. */
  lookupTargetLang?: string;
}

function cleanLookupWord(rawWord: string): string {
  return rawWord.replace(/[^A-Za-z'-]/g, '');
}

function SelectableWord({
  word,
  globalIndex,
  currentWordIndex,
  currentSentenceIndex,
  sentenceIndex,
  isPlaying,
  onClick,
  lookupTargetLang,
}: {
  word: string;
  globalIndex: number;
  currentWordIndex: number;
  currentSentenceIndex: number;
  sentenceIndex: number;
  isPlaying: boolean;
  onClick?: (word: string) => void;
  lookupTargetLang?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const hasHover = useHasHover();
  const isCurrent = currentWordIndex >= 0 && globalIndex === currentWordIndex;
  const isRead = currentWordIndex >= 0 && globalIndex < currentWordIndex;
  const isActiveSentence = currentSentenceIndex >= 0 && sentenceIndex === currentSentenceIndex;

  useEffect(() => {
    if (isCurrent && isPlaying && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCurrent, isPlaying]);

  const wordSpan = (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      data-read-aloud-word={globalIndex}
      onClick={() => {
        if (window.getSelection()?.isCollapsed !== false) onClick?.(word);
      }}
      onKeyDown={(event) => {
        if (event.key === ' ') event.preventDefault();
        if (event.key === 'Enter' || event.key === ' ') onClick?.(word);
      }}
      className={cn(
        'inline rounded-md px-0.5 py-0.5 cursor-pointer select-text transition-all duration-300 ease-out',
        isCurrent
          ? 'font-semibold scale-[1.06] text-white'
          : isRead
            ? 'text-indigo-400'
            : isActiveSentence
              ? 'text-slate-800'
              : 'text-inherit hover:bg-slate-100 hover:text-slate-900',
      )}
      style={
        isCurrent
          ? {
              background: '#F97316',
              boxShadow: '0 2px 10px rgba(249, 115, 22, 0.4)',
            }
          : undefined
      }
    >
      {word}
    </span>
  );

  const cleanWord = lookupTargetLang ? cleanLookupWord(word) : '';
  // Skip the lookup wrapper on touch-only devices: HoverCardTrigger calls preventDefault()
  // on touchstart, which would risk breaking the existing tap-to-seek gesture below.
  if (!lookupTargetLang || !cleanWord || !hasHover) return wordSpan;

  return (
    <HoverCard open={lookupOpen} onOpenChange={setLookupOpen} openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>{wordSpan}</HoverCardTrigger>
      <HoverCardContent className="p-4">
        <WordLookupContent word={cleanWord.toLowerCase()} targetLang={lookupTargetLang} enabled={lookupOpen} />
      </HoverCardContent>
    </HoverCard>
  );
}

function SentenceBlock({
  block,
  currentSentenceIndex,
  currentWordIndex,
  isPlaying,
  getSentenceIndex,
  onWordClick,
  translations,
  lookupTargetLang,
}: {
  block: ContentBlock;
  currentSentenceIndex: number;
  currentWordIndex: number;
  isPlaying: boolean;
  getSentenceIndex: (globalWordIndex: number) => number;
  onWordClick?: (word: string) => void;
  translations: Map<number, string>;
  lookupTargetLang?: string;
}) {
  return (
    <div>
      <div
        className={
          block.kind === 'title'
            ? 'font-heading text-2xl font-bold text-slate-900 leading-tight md:text-3xl'
            : block.kind === 'label'
              ? 'text-[11px] font-semibold tracking-[0.2em] text-slate-300'
              : block.kind === 'quote'
                ? 'border-l-2 border-slate-200 pl-4 italic text-slate-600 text-lg leading-9'
                : 'text-[19px] leading-9 text-slate-700 md:text-[21px] md:leading-10'
        }
      >
        <div className="select-text">
          {block.words.map((word, localIndex) => {
            const globalIndex = block.wordStart + localIndex;
            const wordSentenceIndex = getSentenceIndex(globalIndex);
            return (
              <span key={`${block.id}-${globalIndex}`}>
                <SelectableWord
                  word={word}
                  globalIndex={globalIndex}
                  currentWordIndex={currentWordIndex}
                  currentSentenceIndex={currentSentenceIndex}
                  sentenceIndex={wordSentenceIndex}
                  isPlaying={isPlaying}
                  onClick={onWordClick}
                  lookupTargetLang={lookupTargetLang}
                />
                {localIndex < block.words.length - 1 ? ' ' : null}
                {translations.has(globalIndex) && (
                  <span
                    data-testid="read-inline-translation"
                    className="block mt-1 mb-3 text-sm leading-relaxed text-slate-600"
                  >
                    {translations.get(globalIndex)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReadAloudContent({
  text,
  onWordClick,
  showTranslation,
  sentenceTranslations,
  lookupTargetLang,
}: ReadAloudContentProps) {
  const currentWordIndex = useReadAloudStore((s) => s.currentWordIndex);
  const currentSentenceIndex = useReadAloudStore((s) => s.currentSentenceIndex);
  const isPlaying = useReadAloudStore((s) => s.isPlaying);
  const sentences = useReadAloudStore((s) => s.sentences);

  const contentBlocks = splitContentBlocks(text);

  const getSentenceIndex = useCallback(
    (globalWordIndex: number): number => {
      return sentences.findIndex((s) => globalWordIndex >= s.startWordIndex && globalWordIndex <= s.endWordIndex);
    },
    [sentences],
  );

  const translations = new Map(
    showTranslation ? sentenceTranslations?.map((entry) => [entry.endWordIndex, entry.translation]) : [],
  );

  return (
    <div className="space-y-4" data-testid="read-aloud-content">
      {contentBlocks.map((block) => {
        return (
          <SentenceBlock
            key={block.id}
            block={block}
            currentSentenceIndex={currentSentenceIndex}
            currentWordIndex={currentWordIndex}
            isPlaying={isPlaying}
            getSentenceIndex={getSentenceIndex}
            onWordClick={onWordClick}
            translations={translations}
            lookupTargetLang={lookupTargetLang}
          />
        );
      })}
    </div>
  );
}
