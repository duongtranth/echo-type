import { useEffect, useRef, useState } from 'react';
import { getIOSNativeQAMockTranslation, getIOSNativeQAMode } from '@/lib/ios-native-qa';

interface ExplorerSense {
  pos: string;
  definition: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
}

interface ExplorerWordFamilyItem {
  word: string;
  pos: string[];
}

interface ExplorerRealWorldExample {
  text: string;
  translationVi: string;
}

export interface AccentPhonetic {
  accent: 'UK' | 'US' | '';
  text: string;
  audio: string;
}

interface ExplorerApiResponse {
  word: string;
  phonetic?: string;
  phonetics?: AccentPhonetic[];
  audioUrl?: string;
  senses?: ExplorerSense[];
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  wordFamily?: ExplorerWordFamilyItem[];
  contextualTerms?: string[];
  realWorldExamples?: ExplorerRealWorldExample[];
  source?: string;
  sourceUrl?: string;
}

export interface WordExample {
  text: string;
  translation?: string;
}

export interface WordMeaning {
  pos: string;
  definition: string;
  definitionEnglish: string;
  examples: WordExample[];
  /** Legacy single-example view retained for existing consumers. */
  example?: string;
  synonyms: string[];
  antonyms: string[];
  contextMatch?: boolean;
}

export interface WordFamilyItem {
  word: string;
  pos: string[];
}

interface CachedResult {
  translation: string;
  phonetic: string;
  phonetics: AccentPhonetic[];
  pos: string;
  meanings: WordMeaning[];
  example: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  wordFamily: WordFamilyItem[];
  /** Authentic community-written sentences from Tatoeba.org, with ready-made Vietnamese translations. */
  realWorldExamples: WordExample[];
  source: string;
  sourceUrl: string;
}

export interface WordDictionaryResult extends CachedResult {
  isLoading: boolean;
}

interface RawWordBookEntry {
  word?: string;
  sentence?: string;
}

const EXAMPLE_FALLBACK_BOOK_IDS = [
  'junior-high',
  'senior-high',
  'gaokao2026',
  'cet4',
  'cet6',
  'essential4000',
  'graduate',
  'tem4',
  'ielts',
  'it-words',
] as const;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'he',
  'her',
  'his',
  'i',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'she',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
]);

const localExampleCache = new Map<string, Promise<string>>();

function emptyResult(): CachedResult {
  return {
    translation: '',
    phonetic: '',
    phonetics: [],
    pos: '',
    meanings: [],
    example: '',
    synonyms: [],
    antonyms: [],
    collocations: [],
    wordFamily: [],
    realWorldExamples: [],
    source: '',
    sourceUrl: '',
  };
}

function isSingleWord(text: string): boolean {
  return text.trim().split(/\s+/).length === 1;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function scoreSense(sense: ExplorerSense, context: string, contextualTerms: string[], word: string): number {
  if (!context.trim()) return 0;

  const target = word.toLowerCase();
  const contextTokens = new Set(tokenize(context).filter((token) => token !== target));
  const datamuseTerms = new Set(contextualTerms.map((term) => term.toLowerCase()));
  const definitionTokens = new Set(tokenize([sense.definition, ...sense.examples].join(' ')));
  const relationTokens = new Set(sense.synonyms.map((term) => term.toLowerCase()));

  let score = 0;
  for (const token of definitionTokens) {
    if (contextTokens.has(token)) score += 2;
    if (datamuseTerms.has(token)) score += 1;
  }
  for (const synonym of relationTokens) {
    if (datamuseTerms.has(synonym)) score += 5;
    if (contextTokens.has(synonym)) score += 3;
  }
  return score;
}

function markContextSense(
  senses: ExplorerSense[],
  context: string,
  contextualTerms: string[],
  word: string,
): Array<ExplorerSense & { contextMatch?: boolean }> {
  if (senses.length === 0) return [];
  const scores = senses.map((sense) => scoreSense(sense, context, contextualTerms, word));
  const bestScore = Math.max(...scores);
  const bestIndex = bestScore > 0 ? scores.indexOf(bestScore) : 0;
  return senses.map((sense, index) => ({ ...sense, contextMatch: index === bestIndex }));
}

async function fetchExplorer(word: string, context: string): Promise<ExplorerApiResponse> {
  try {
    const params = new URLSearchParams({ word });
    if (context.trim()) params.set('context', context.trim());
    const response = await fetch(`/api/words/explore?${params}`);
    if (!response.ok) return { word };
    return (await response.json()) as ExplorerApiResponse;
  } catch {
    return { word };
  }
}

async function fetchTranslation(text: string, targetLang: string): Promise<string> {
  try {
    const response = await fetch('/api/translate/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });
    if (!response.ok) return '';
    const data = (await response.json()) as { translation?: string };
    return data.translation || '';
  } catch {
    return '';
  }
}

async function fetchBatchTranslations(sentences: string[], targetLang: string): Promise<string[]> {
  if (sentences.length === 0) return [];
  try {
    const response = await fetch('/api/translate/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentences, targetLang }),
    });
    if (!response.ok) return sentences.map(() => '');
    const data = (await response.json()) as { translations?: string[] };
    return data.translations?.length === sentences.length ? data.translations : sentences.map(() => '');
  } catch {
    return sentences.map(() => '');
  }
}

async function translateSenses(
  senses: Array<ExplorerSense & { contextMatch?: boolean }>,
  targetLang: string,
): Promise<WordMeaning[]> {
  const texts: string[] = [];
  const layout = senses.map((sense) => {
    const definitionIndex = texts.push(sense.definition) - 1;
    const exampleIndexes = sense.examples.slice(0, 3).map((example) => texts.push(example) - 1);
    return { definitionIndex, exampleIndexes };
  });
  const translated = await fetchBatchTranslations(texts, targetLang);

  return senses.map((sense, index) => {
    const examples = layout[index]!.exampleIndexes.map((translationIndex, exampleIndex) => ({
      text: sense.examples[exampleIndex]!,
      translation: translated[translationIndex] || undefined,
    }));

    return {
      pos: sense.pos,
      definition: translated[layout[index]!.definitionIndex] || sense.definition,
      definitionEnglish: sense.definition,
      examples,
      example: examples[0]?.text,
      synonyms: sense.synonyms,
      antonyms: sense.antonyms,
      contextMatch: sense.contextMatch,
    };
  });
}

function isUsefulEnglishExample(word: string, sentence: string): boolean {
  const normalized = sentence.trim();
  if (!normalized || /[\u4e00-\u9fff]/.test(normalized)) return false;
  if (!/[.!?]$/.test(normalized)) return false;
  if (normalized.split(/\s+/).length < 4) return false;
  return normalized.toLowerCase().includes(word.trim().toLowerCase());
}

async function fetchLocalExampleSentence(word: string): Promise<string> {
  const normalizedWord = word.trim().toLowerCase();
  if (!normalizedWord || normalizedWord.includes(' ')) return '';

  const cached = localExampleCache.get(normalizedWord);
  if (cached) return cached;

  const promise = (async () => {
    for (const bookId of EXAMPLE_FALLBACK_BOOK_IDS) {
      try {
        const response = await fetch(`/wordbooks/${bookId}.json`);
        if (!response.ok) continue;
        const entries = (await response.json()) as RawWordBookEntry[];
        const match = entries.find(
          (entry) =>
            entry.word?.trim().toLowerCase() === normalizedWord &&
            entry.sentence &&
            isUsefulEnglishExample(normalizedWord, entry.sentence),
        );
        if (match?.sentence) return match.sentence.trim();
      } catch {
        // Try the next local book.
      }
    }
    return '';
  })();

  localExampleCache.set(normalizedWord, promise);
  return promise;
}

export function useWordDictionary(
  word: string,
  targetLang: string,
  enabled: boolean,
  contextText?: string,
): WordDictionaryResult {
  const [result, setResult] = useState<CachedResult>(emptyResult());
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<Map<string, CachedResult>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setResult(emptyResult());
      return;
    }
    if (!word) return;

    const context = contextText?.trim() || '';
    const key = `${word}::${targetLang}::${context}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    if (getIOSNativeQAMode()) {
      const mockTranslation = getIOSNativeQAMockTranslation(word, targetLang);
      const mockEntry: CachedResult = {
        ...emptyResult(),
        translation: mockTranslation,
        phonetic: word ? `/${word.toLowerCase()}/` : '',
        pos: isSingleWord(word) ? 'noun' : '',
        meanings: isSingleWord(word)
          ? [
              {
                pos: 'noun',
                definition: getIOSNativeQAMockTranslation(`${word} practice term`, targetLang),
                definitionEnglish: `${word} practice term`,
                examples: [],
                synonyms: [],
                antonyms: [],
                contextMatch: true,
              },
            ]
          : [],
      };
      cacheRef.current.set(key, mockEntry);
      setResult(mockEntry);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;

    async function load() {
      let next = emptyResult();

      if (isSingleWord(word)) {
        const [explorer, translation] = await Promise.all([
          fetchExplorer(word, context),
          fetchTranslation(word, targetLang),
        ]);
        const rankedSenses = markContextSense(explorer.senses ?? [], context, explorer.contextualTerms ?? [], word);
        const meanings = await translateSenses(rankedSenses, targetLang);
        const contextMeaning = meanings.find((meaning) => meaning.contextMatch) ?? meanings[0];
        let example = contextMeaning?.examples[0]?.text || '';
        if (!example) example = await fetchLocalExampleSentence(word);

        next = {
          translation,
          phonetic: explorer.phonetic ?? '',
          phonetics: explorer.phonetics ?? [],
          pos: contextMeaning?.pos ?? meanings[0]?.pos ?? '',
          meanings,
          example,
          synonyms: explorer.synonyms ?? [],
          antonyms: explorer.antonyms ?? [],
          collocations: explorer.collocations ?? [],
          wordFamily: explorer.wordFamily ?? [],
          realWorldExamples: (explorer.realWorldExamples ?? []).map((item) => ({
            text: item.text,
            translation: item.translationVi,
          })),
          source: explorer.source ?? '',
          sourceUrl: explorer.sourceUrl ?? '',
        };
      } else {
        next.translation = await fetchTranslation(word, targetLang);
      }

      if (cancelled) return;
      cacheRef.current.set(key, next);
      setResult(next);
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, word, targetLang, contextText]);

  return { ...result, isLoading };
}
