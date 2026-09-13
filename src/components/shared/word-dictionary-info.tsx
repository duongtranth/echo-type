'use client';

import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWordDictionary, type WordMeaning } from '@/hooks/use-word-dictionary';
import { usePracticeTranslationStore } from '@/stores/practice-translation-store';
import type { PracticeModule } from '@/types/translation';

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
  exclamation: 'excl.',
};

const POS_LABELS: Record<string, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  interjection: 'Thán từ',
  determiner: 'Từ hạn định',
};

function abbreviatePos(pos: string): string {
  return POS_ABBR[pos.toLowerCase()] || pos;
}

function posLabel(pos: string): string {
  return POS_LABELS[pos.toLowerCase()] || pos;
}

interface WordDictionaryInfoProps {
  word: string;
  targetLang: string;
  module: PracticeModule;
  contextText?: string;
}

function meaningContainsTranslation(meanings: WordMeaning[], translation: string): boolean {
  const normalized = translation.trim().toLowerCase();
  if (!normalized) return true;
  return meanings.some((meaning) => meaning.definition.toLowerCase().includes(normalized));
}

function WordChips({ values, tone = 'indigo' }: { values: string[]; tone?: 'indigo' | 'emerald' | 'rose' | 'slate' }) {
  const classes = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>
          {value}
        </span>
      ))}
    </div>
  );
}

export function WordDictionaryInfo({ word, targetLang, module, contextText }: WordDictionaryInfoProps) {
  const [expanded, setExpanded] = useState(false);
  const showTranslation = usePracticeTranslationStore((state) => state.isVisible(module));
  const {
    phonetic,
    pos,
    meanings,
    translation,
    synonyms,
    antonyms,
    collocations,
    wordFamily,
    source,
    sourceUrl,
    isLoading,
  } = useWordDictionary(word, targetLang, true, contextText);

  const contextMeaning = meanings.find((meaning) => meaning.contextMatch) ?? meanings[0];
  const meaningsByPos = useMemo(() => {
    const groups = new Map<string, WordMeaning[]>();
    for (const meaning of meanings) {
      const key = meaning.pos || 'other';
      groups.set(key, [...(groups.get(key) ?? []), meaning]);
    }
    return [...groups.entries()];
  }, [meanings]);

  const hasMeanings = showTranslation && meanings.length > 0;
  const hasPhoneticOrPos = phonetic || pos;
  const hasTranslationSummary =
    showTranslation && translation && (!hasMeanings || !meaningContainsTranslation(meanings, translation));
  const hasExplorerData =
    showTranslation &&
    (meanings.length > 1 ||
      synonyms.length > 0 ||
      antonyms.length > 0 ||
      collocations.length > 0 ||
      wordFamily.length > 0);

  if (isLoading) {
    return (
      <div className="min-h-[2.75rem] flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!hasPhoneticOrPos && !hasMeanings && !hasTranslationSummary) return null;

  return (
    <div className="space-y-2">
      {hasPhoneticOrPos && (
        <div className="min-h-[1.5rem] flex items-center justify-center gap-1.5">
          {phonetic && <span className="text-sm text-indigo-500">{phonetic}</span>}
          {phonetic && pos && <span className="text-xs text-slate-300">·</span>}
          {pos && <span className="text-xs text-slate-400">{posLabel(pos)}</span>}
        </div>
      )}

      {hasTranslationSummary && (
        <p className="min-h-[1.25rem] text-center text-[15px] font-semibold text-indigo-500/85">{translation}</p>
      )}

      {hasMeanings && contextMeaning && (
        <div className="mx-auto max-w-2xl rounded-xl border border-indigo-100 bg-indigo-50/55 px-4 py-3 text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
            <Sparkles className="h-3.5 w-3.5" />
            Nghĩa ưu tiên theo ngữ cảnh
          </div>
          <p className="mt-1.5 text-sm font-semibold text-indigo-900">
            <span className="mr-1.5 text-indigo-500">{abbreviatePos(contextMeaning.pos)}</span>
            {contextMeaning.definition}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{contextMeaning.definitionEnglish}</p>
          {contextText?.trim() && (
            <p className="mt-2 text-xs italic leading-5 text-indigo-600">“{contextText.trim()}”</p>
          )}
        </div>
      )}

      {hasExplorerData && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mx-auto flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {expanded ? 'Thu gọn' : 'Khám phá từ này'}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      )}

      {expanded && hasExplorerData && (
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Các nghĩa khác</h3>
            <div className="mt-2 space-y-4">
              {meaningsByPos.map(([meaningPos, posMeanings]) => (
                <div key={meaningPos}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
                      {abbreviatePos(meaningPos)}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{posLabel(meaningPos)}</span>
                  </div>
                  <ol className="mt-2 space-y-3">
                    {posMeanings.map((meaning, index) => (
                      <li
                        key={`${meaningPos}-${meaning.definitionEnglish}-${index}`}
                        className={`rounded-xl border p-3 ${
                          meaning.contextMatch ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex gap-2">
                          <span className="mt-0.5 text-xs font-bold text-slate-400">{index + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-5 text-slate-800">{meaning.definition}</p>
                            <p className="mt-0.5 text-xs leading-5 text-slate-500">{meaning.definitionEnglish}</p>
                            {meaning.examples.length > 0 && (
                              <div className="mt-2 space-y-1.5 border-l-2 border-indigo-100 pl-3">
                                {meaning.examples.map((example) => (
                                  <div key={example.text}>
                                    <p className="text-xs italic leading-5 text-slate-700">{example.text}</p>
                                    {example.translation && (
                                      <p className="text-xs leading-5 text-indigo-500">{example.translation}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          {synonyms.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Từ đồng nghĩa</h3>
              <WordChips values={synonyms.slice(0, 12)} tone="emerald" />
            </section>
          )}

          {antonyms.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Từ trái nghĩa</h3>
              <WordChips values={antonyms.slice(0, 12)} tone="rose" />
            </section>
          )}

          {collocations.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Cụm từ thường gặp</h3>
              <WordChips values={collocations.slice(0, 12)} />
            </section>
          )}

          {wordFamily.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Word family · Họ từ</h3>
              <div className="flex flex-wrap gap-2">
                {wordFamily.map((item) => (
                  <span
                    key={item.word}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    <strong>{item.word}</strong>
                    {item.pos.length > 0 && <span className="text-slate-400">{item.pos.join(' / ')}</span>}
                  </span>
                ))}
              </div>
            </section>
          )}

          {source && (
            <p className="border-t border-slate-100 pt-3 text-[10px] text-slate-400">
              Nguồn từ điển: {source}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 underline hover:text-slate-600"
                >
                  xem nguồn <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
