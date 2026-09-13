interface FreeDictionaryDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface FreeDictionaryMeaning {
  partOfSpeech?: string;
  definitions?: FreeDictionaryDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface FreeDictionaryEntry {
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: FreeDictionaryMeaning[];
  sourceUrls?: string[];
}

interface WiktionaryDefinition {
  definition?: string;
  examples?: string[];
}

interface WiktionaryMeaning {
  partOfSpeech?: string;
  definitions?: WiktionaryDefinition[];
}

interface WiktionaryResponse {
  en?: WiktionaryMeaning[];
}

interface DatamuseWord {
  word?: string;
  score?: number;
  tags?: string[];
}

interface ExplorerSense {
  pos: string;
  definition: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
}

interface WordFamilyItem {
  word: string;
  pos: string[];
}

const DATAMUSE_BASE = 'https://api.datamuse.com/words';
const POS_TAGS = new Set(['n', 'v', 'adj', 'adv']);

function unique(values: Array<string | undefined>, limit = 20): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].slice(
    0,
    limit,
  );
}

function cleanHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPhonetic(entries: FreeDictionaryEntry[]): string {
  for (const entry of entries) {
    if (entry.phonetic?.trim()) return entry.phonetic.trim();
    const fallback = entry.phonetics?.find((item) => item.text?.trim());
    if (fallback?.text) return fallback.text.trim();
  }
  return '';
}

function extractAudio(entries: FreeDictionaryEntry[]): string {
  for (const entry of entries) {
    const audio = entry.phonetics?.find((item) => item.audio?.trim())?.audio;
    if (audio) return audio;
  }
  return '';
}

function buildFreeDictionarySenses(entries: FreeDictionaryEntry[]): ExplorerSense[] {
  const senses: ExplorerSense[] = [];

  for (const entry of entries) {
    for (const meaning of entry.meanings ?? []) {
      const pos = meaning.partOfSpeech?.trim() || 'other';
      for (const definition of (meaning.definitions ?? []).slice(0, 4)) {
        if (!definition.definition?.trim()) continue;
        senses.push({
          pos,
          definition: definition.definition.trim(),
          examples: unique([definition.example], 2),
          synonyms: unique([...(definition.synonyms ?? []), ...(meaning.synonyms ?? [])], 8),
          antonyms: unique([...(definition.antonyms ?? []), ...(meaning.antonyms ?? [])], 8),
        });
        if (senses.length >= 16) return senses;
      }
    }
  }

  return senses;
}

async function fetchFreeDictionary(word: string): Promise<{
  senses: ExplorerSense[];
  phonetic: string;
  audioUrl: string;
  sourceUrl: string;
}> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) return { senses: [], phonetic: '', audioUrl: '', sourceUrl: '' };

    const entries = (await response.json()) as FreeDictionaryEntry[];
    if (!Array.isArray(entries)) return { senses: [], phonetic: '', audioUrl: '', sourceUrl: '' };

    return {
      senses: buildFreeDictionarySenses(entries),
      phonetic: extractPhonetic(entries),
      audioUrl: extractAudio(entries),
      sourceUrl: entries.flatMap((entry) => entry.sourceUrls ?? [])[0] ?? '',
    };
  } catch {
    return { senses: [], phonetic: '', audioUrl: '', sourceUrl: '' };
  }
}

async function fetchWiktionary(word: string): Promise<ExplorerSense[]> {
  try {
    const response = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}?redirect=true`,
      {
        headers: { 'User-Agent': 'EchoType/1.4 vocabulary learning app' },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 86400 },
      },
    );
    if (!response.ok) return [];

    const payload = (await response.json()) as WiktionaryResponse;
    const senses: ExplorerSense[] = [];
    for (const meaning of payload.en ?? []) {
      const pos = meaning.partOfSpeech?.trim().toLowerCase() || 'other';
      for (const definition of (meaning.definitions ?? []).slice(0, 4)) {
        const cleaned = definition.definition ? cleanHtml(definition.definition) : '';
        if (!cleaned) continue;
        senses.push({
          pos,
          definition: cleaned,
          examples: unique((definition.examples ?? []).map(cleanHtml), 2),
          synonyms: [],
          antonyms: [],
        });
        if (senses.length >= 16) return senses;
      }
    }
    return senses;
  } catch {
    return [];
  }
}

async function fetchDatamuse(params: Record<string, string>): Promise<DatamuseWord[]> {
  try {
    const url = new URL(DATAMUSE_BASE);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } });
    if (!response.ok) return [];
    const payload = (await response.json()) as DatamuseWord[];
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

function contextWindow(word: string, context: string): { left?: string; right?: string } {
  const tokens = context.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  const normalizedWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
  const index = tokens.findIndex((token) => token.toLowerCase().replace(/[^a-z'-]/g, '') === normalizedWord);
  if (index < 0) return {};
  const left = tokens.slice(Math.max(0, index - 4), index).join(' ');
  const right = tokens.slice(index + 1, index + 5).join(' ');
  return { left: left || undefined, right: right || undefined };
}

function familyPattern(word: string): string {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.length <= 3) return normalized;
  const prefixLength = Math.max(3, Math.ceil(normalized.length * 0.65));
  return normalized.slice(0, Math.min(prefixLength, 8));
}

function datamusePos(tags: string[] | undefined): string[] {
  return unique((tags ?? []).filter((tag) => POS_TAGS.has(tag)), 4);
}

function mapFamily(items: DatamuseWord[], originalWord: string): WordFamilyItem[] {
  const normalized = originalWord.toLowerCase();
  return items
    .filter((item) => item.word && item.word.toLowerCase() !== normalized && !item.word.includes(' '))
    .map((item) => ({ word: item.word!, pos: datamusePos(item.tags) }))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.word === item.word) === index)
    .slice(0, 10);
}

function mapWords(items: DatamuseWord[], limit = 12): string[] {
  return unique(items.map((item) => item.word), limit);
}

function buildCollocations(
  word: string,
  followers: DatamuseWord[],
  predecessors: DatamuseWord[],
  adjectiveNouns: DatamuseWord[],
  nounAdjectives: DatamuseWord[],
): string[] {
  return unique(
    [
      ...followers.slice(0, 5).map((item) => (item.word ? `${word} ${item.word}` : undefined)),
      ...predecessors.slice(0, 5).map((item) => (item.word ? `${item.word} ${word}` : undefined)),
      ...adjectiveNouns.slice(0, 5).map((item) => (item.word ? `${word} ${item.word}` : undefined)),
      ...nounAdjectives.slice(0, 5).map((item) => (item.word ? `${item.word} ${word}` : undefined)),
    ],
    12,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word')?.trim() ?? '';
  const context = searchParams.get('context')?.trim() ?? '';

  if (!word || word.split(/\s+/).length !== 1 || !/^[A-Za-z][A-Za-z'-]*$/.test(word)) {
    return Response.json({ error: 'A single English word is required.' }, { status: 400 });
  }

  const dictionary = await fetchFreeDictionary(word);
  const senses = dictionary.senses.length > 0 ? dictionary.senses : await fetchWiktionary(word);
  const primaryPos = senses[0]?.pos.toLowerCase() ?? '';
  const window = contextWindow(word, context);
  const contextParams: Record<string, string> = { ml: word, md: 'p', max: '16' };
  if (window.left) contextParams.lc = window.left;
  if (window.right) contextParams.rc = window.right;

  const familyPrefix = familyPattern(word);
  const [synonyms, antonyms, followers, predecessors, adjectiveNouns, nounAdjectives, family, contextualTerms] =
    await Promise.all([
      fetchDatamuse({ rel_syn: word, max: '14' }),
      fetchDatamuse({ rel_ant: word, max: '14' }),
      fetchDatamuse({ rel_bga: word, max: '8' }),
      fetchDatamuse({ rel_bgb: word, max: '8' }),
      primaryPos === 'adjective' ? fetchDatamuse({ rel_jja: word, max: '8' }) : Promise.resolve([]),
      primaryPos === 'noun' ? fetchDatamuse({ rel_jjb: word, max: '8' }) : Promise.resolve([]),
      familyPrefix
        ? fetchDatamuse({ ml: word, sp: `${familyPrefix}*`, md: 'p', max: '24' })
        : Promise.resolve([]),
      context ? fetchDatamuse(contextParams) : Promise.resolve([]),
    ]);

  const senseSynonyms = senses.flatMap((sense) => sense.synonyms);
  const senseAntonyms = senses.flatMap((sense) => sense.antonyms);
  const source = dictionary.senses.length > 0 ? 'Free Dictionary API' : senses.length > 0 ? 'Wiktionary' : 'Unknown';
  const sourceUrl =
    dictionary.sourceUrl ||
    (source === 'Wiktionary' ? `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}` : '');

  return Response.json(
    {
      word,
      phonetic: dictionary.phonetic,
      audioUrl: dictionary.audioUrl,
      senses,
      synonyms: unique([...senseSynonyms, ...mapWords(synonyms)], 16),
      antonyms: unique([...senseAntonyms, ...mapWords(antonyms)], 16),
      collocations: buildCollocations(word, followers, predecessors, adjectiveNouns, nounAdjectives),
      wordFamily: mapFamily(family, word),
      contextualTerms: mapWords(contextualTerms, 16),
      source,
      sourceUrl,
    },
    { headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } },
  );
}
