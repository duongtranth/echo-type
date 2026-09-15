import { Fragment } from 'react';
import { WordLookup } from '@/components/shared/word-lookup';

interface LookupSentenceProps {
  sentence: string;
  targetLang: string;
  /** Word to render as plain text instead of wrapping again (e.g. the flashcard's own headword). */
  excludeWord?: string;
  className?: string;
}

const WORD_PATTERN = /([A-Za-z][A-Za-z'-]*)/g;

/** Splits a sentence into hoverable words (Cambridge/Collins-style lookup) plus untouched punctuation/whitespace. */
export function LookupSentence({ sentence, targetLang, excludeWord, className }: LookupSentenceProps) {
  const parts = sentence.split(WORD_PATTERN);
  const excluded = excludeWord?.trim().toLowerCase();

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isWord = index % 2 === 1;
        if (!isWord || part.toLowerCase() === excluded) {
          return <Fragment key={`${index}-${part}`}>{part}</Fragment>;
        }
        return (
          <WordLookup key={`${index}-${part}`} word={part.toLowerCase()} contextText={sentence} targetLang={targetLang}>
            {part}
          </WordLookup>
        );
      })}
    </span>
  );
}
