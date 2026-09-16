'use client';

import { Loader2, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useTTS } from '@/hooks/use-tts';
import { useWordDictionary } from '@/hooks/use-word-dictionary';
import { cn } from '@/lib/utils';

const POS_ABBR: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  pronoun: 'pron.',
  preposition: 'prep.',
  conjunction: 'conj.',
  interjection: 'interj.',
  determiner: 'det.',
};

interface WordLookupContentProps {
  word: string;
  contextText?: string;
  targetLang: string;
  /** Only fetches once true — lets the caller gate the network call on the popup actually being open. */
  enabled: boolean;
}

/** The fetched dictionary body shown inside a lookup popup. No wrapper/trigger of its own. */
export function WordLookupContent({ word, contextText, targetLang, enabled }: WordLookupContentProps) {
  const { speak } = useTTS();
  const { phonetic, meanings, translation, isLoading } = useWordDictionary(word, targetLang, enabled, contextText);

  const contextMeaning = meanings.find((meaning) => meaning.contextMatch) ?? meanings[0];
  const examples = contextMeaning?.examples.slice(0, 3) ?? [];
  const hasResult = Boolean(contextMeaning || translation);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!hasResult) {
    return <p className="text-xs text-slate-400">Không tìm thấy nghĩa cho “{word}”.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-base font-bold text-indigo-950">{word}</span>
          {phonetic && <span className="text-xs text-indigo-400">{phonetic}</span>}
        </div>
        <button
          type="button"
          onClick={() => void speak(word)}
          className="shrink-0 text-indigo-300 transition-colors hover:text-indigo-600"
          aria-label={`Phát âm ${word}`}
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>

      {contextMeaning ? (
        <div>
          <p className="text-sm font-semibold text-indigo-900">
            {contextMeaning.pos && (
              <span className="mr-1 font-normal text-indigo-400">
                {POS_ABBR[contextMeaning.pos.toLowerCase()] || contextMeaning.pos}
              </span>
            )}
            {contextMeaning.definition}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{contextMeaning.definitionEnglish}</p>
        </div>
      ) : (
        translation && <p className="text-sm font-semibold text-indigo-900">{translation}</p>
      )}

      {examples.length > 0 && (
        <div className="space-y-1 border-l-2 border-indigo-100 pl-2.5">
          {examples.map((example) => (
            <div key={example.text}>
              <p className="text-xs leading-5 text-slate-700 italic">{example.text}</p>
              {example.translation && <p className="text-xs leading-5 text-indigo-500">{example.translation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WordLookupProps {
  word: string;
  contextText?: string;
  targetLang: string;
  children: ReactNode;
  className?: string;
}

/**
 * Cambridge/Collins-style hover-to-define popup for a single word.
 * Fetches lazily (only once the popup actually opens) and caches per word via useWordDictionary.
 */
export function WordLookup({ word, contextText, targetLang, children, className }: WordLookupProps) {
  const [open, setOpen] = useState(false);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span
          className={cn(
            'cursor-help rounded-sm border-b border-dotted border-indigo-300 transition-colors hover:bg-indigo-50 hover:text-indigo-700',
            className,
          )}
        >
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="p-4">
        <WordLookupContent word={word} contextText={contextText} targetLang={targetLang} enabled={open} />
      </HoverCardContent>
    </HoverCard>
  );
}
