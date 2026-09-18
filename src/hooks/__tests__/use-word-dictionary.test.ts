import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EffectCallback = () => void | (() => void);

const runtime = vi.hoisted(() => {
  type Cell =
    | { kind: 'state'; value: unknown }
    | { kind: 'ref'; value: { current: unknown } }
    | { kind: 'effect'; deps?: unknown[]; cleanup?: (() => void) | void };

  const cells: Cell[] = [];
  let cursor = 0;
  let currentHook: (() => unknown) | null = null;
  let currentResult: unknown;
  let isRendering = false;
  let isRunningEffects = false;
  let rerenderRequested = false;
  const pendingEffects: Array<{ effect: EffectCallback; index: number }> = [];

  function reset() {
    for (const cell of cells) {
      if (cell.kind === 'effect' && typeof cell.cleanup === 'function') cell.cleanup();
    }
    cells.length = 0;
    cursor = 0;
    currentHook = null;
    currentResult = undefined;
    isRendering = false;
    isRunningEffects = false;
    rerenderRequested = false;
    pendingEffects.length = 0;
  }

  function areDepsEqual(a?: unknown[], b?: unknown[]) {
    if (!a || !b || a.length !== b.length) return false;
    return a.every((value, index) => Object.is(value, b[index]));
  }

  function scheduleRender() {
    if (!currentHook) return;
    if (isRendering || isRunningEffects) {
      rerenderRequested = true;
      return;
    }
    render();
  }

  function render() {
    if (!currentHook) return;
    do {
      rerenderRequested = false;
      cursor = 0;
      pendingEffects.length = 0;
      isRendering = true;
      currentResult = currentHook();
      isRendering = false;

      isRunningEffects = true;
      while (pendingEffects.length > 0) {
        const item = pendingEffects.shift();
        if (!item) continue;
        const cell = cells[item.index];
        if (cell && cell.kind === 'effect' && typeof cell.cleanup === 'function') {
          cell.cleanup();
          cell.cleanup = undefined;
        }
        const cleanup = item.effect();
        if (cell && cell.kind === 'effect') cell.cleanup = cleanup;
      }
      isRunningEffects = false;
    } while (rerenderRequested);
  }

  function useState<T>(initialValue: T | (() => T)) {
    const index = cursor++;
    const existing = cells[index];
    if (!existing || existing.kind !== 'state') {
      cells[index] = {
        kind: 'state',
        value: typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue,
      };
    }

    const cell = cells[index];
    if (!cell || cell.kind !== 'state') throw new Error('Expected state cell');
    const setState = (nextValue: T | ((prev: T) => T)) => {
      const target = cells[index];
      if (!target || target.kind !== 'state') return;
      const resolved =
        typeof nextValue === 'function' ? (nextValue as (prev: T) => T)(target.value as T) : nextValue;
      if (Object.is(target.value, resolved)) return;
      target.value = resolved;
      scheduleRender();
    };
    return [cell.value as T, setState] as const;
  }

  function useRef<T>(initialValue: T) {
    const index = cursor++;
    const existing = cells[index];
    if (!existing || existing.kind !== 'ref') cells[index] = { kind: 'ref', value: { current: initialValue } };
    const cell = cells[index];
    if (!cell || cell.kind !== 'ref') throw new Error('Expected ref cell');
    return cell.value as { current: T };
  }

  function useEffect(effect: EffectCallback, deps?: unknown[]) {
    const index = cursor++;
    const existing = cells[index];
    const shouldRun = !existing || existing.kind !== 'effect' || !areDepsEqual(existing.deps, deps);
    if (!shouldRun) return;
    const cleanup = existing && existing.kind === 'effect' ? existing.cleanup : undefined;
    cells[index] = { kind: 'effect', deps: deps ? [...deps] : undefined, cleanup };
    pendingEffects.push({ effect, index });
  }

  function renderHook<T>(hook: () => T) {
    currentHook = hook;
    render();
    return {
      get current() {
        return currentResult as T;
      },
      rerender(newHook?: () => T) {
        if (newHook) currentHook = newHook;
        render();
      },
    };
  }

  return { reset, renderHook, useState, useRef, useEffect };
});

vi.mock('react', () => ({
  useState: runtime.useState,
  useRef: runtime.useRef,
  useEffect: runtime.useEffect,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { useWordDictionary } = await import('../use-word-dictionary');

async function waitFor(assertion: () => void, timeoutMs = 2000) {
  const start = Date.now();
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

function response(payload: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(payload) });
}

function translationResponse(options?: { body?: string }) {
  const body = options?.body ? (JSON.parse(options.body) as { text?: string; sentences?: string[] }) : {};
  if (body.sentences) {
    return response({ translations: body.sentences.map((value) => `vi:${value}`) });
  }
  return response({ translation: body.text ? `vi:${body.text}` : '' });
}

beforeEach(() => {
  runtime.reset();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWordDictionary', () => {
  it('returns an empty result when disabled', () => {
    const hook = runtime.renderHook(() => useWordDictionary('run', 'vi', false));
    expect(hook.current.translation).toBe('');
    expect(hook.current.meanings).toEqual([]);
    expect(hook.current.synonyms).toEqual([]);
    expect(hook.current.collocations).toEqual([]);
    expect(hook.current.isLoading).toBe(false);
  });

  it('loads separate senses, examples, relations, collocations, and word family', async () => {
    mockFetch.mockImplementation((url: string, options?: { body?: string }) => {
      if (url.startsWith('/api/words/explore')) {
        return response({
          word: 'run',
          phonetic: '/rʌn/',
          senses: [
            {
              pos: 'verb',
              definition: 'To move quickly on foot.',
              examples: ['She runs every morning.'],
              synonyms: ['sprint'],
              antonyms: ['walk'],
            },
            {
              pos: 'verb',
              definition: 'To manage or operate something.',
              examples: ['She runs a small company.'],
              synonyms: ['manage', 'operate'],
              antonyms: [],
            },
            {
              pos: 'noun',
              definition: 'An act or period of running.',
              examples: ['He went for a run.'],
              synonyms: ['jog'],
              antonyms: [],
            },
          ],
          synonyms: ['manage', 'operate', 'sprint'],
          antonyms: ['walk'],
          collocations: ['run a business', 'run smoothly'],
          wordFamily: [
            { word: 'runner', pos: ['n'] },
            { word: 'running', pos: ['n', 'adj'] },
          ],
          contextualTerms: ['manage', 'company'],
          source: 'Free Dictionary API',
          sourceUrl: 'https://example.test/run',
        });
      }
      return translationResponse(options);
    });

    const hook = runtime.renderHook(() =>
      useWordDictionary('run', 'vi', true, 'She runs a small company with her sister.'),
    );

    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    expect(hook.current.phonetic).toBe('/rʌn/');
    expect(hook.current.meanings).toHaveLength(3);
    expect(hook.current.meanings[1].contextMatch).toBe(true);
    expect(hook.current.meanings[1].definition).toBe('vi:To manage or operate something.');
    expect(hook.current.meanings[1].definitionEnglish).toBe('To manage or operate something.');
    expect(hook.current.meanings[1].example).toBe('She runs a small company.');
    expect(hook.current.meanings[1].examples[0]).toEqual({
      text: 'She runs a small company.',
      translation: 'vi:She runs a small company.',
    });
    expect(hook.current.synonyms).toContain('manage');
    expect(hook.current.antonyms).toEqual(['walk']);
    expect(hook.current.collocations).toContain('run a business');
    expect(hook.current.wordFamily[0]).toEqual({ word: 'runner', pos: ['n'] });
    expect(hook.current.source).toBe('Free Dictionary API');
  });

  it('only translates multi-word phrases', async () => {
    mockFetch.mockImplementation((_url: string, options?: { body?: string }) => translationResponse(options));

    const hook = runtime.renderHook(() => useWordDictionary('run into', 'vi', true));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    expect(hook.current.translation).toBe('vi:run into');
    expect(hook.current.meanings).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to a local wordbook example when lexical sources have no example', async () => {
    mockFetch.mockImplementation((url: string, options?: { body?: string }) => {
      if (url.startsWith('/api/words/explore')) {
        return response({
          word: 'suitable',
          phonetic: '/ˈsuːtəbl/',
          senses: [
            {
              pos: 'adjective',
              definition: 'Right or appropriate for a particular purpose.',
              examples: [],
              synonyms: ['appropriate'],
              antonyms: ['unsuitable'],
            },
          ],
          synonyms: ['appropriate'],
          antonyms: ['unsuitable'],
          collocations: ['suitable candidate'],
          wordFamily: [],
          contextualTerms: [],
        });
      }
      if (url === '/wordbooks/junior-high.json') {
        return response([{ word: 'suitable', sentence: 'We are hoping to find a suitable school.' }]);
      }
      if (url.startsWith('/wordbooks/')) return response([], false);
      return translationResponse(options);
    });

    const hook = runtime.renderHook(() => useWordDictionary('suitable', 'vi', true));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    expect(hook.current.example).toBe('We are hoping to find a suitable school.');
  });

  it('uses the first sense when context does not provide a stronger signal', async () => {
    mockFetch.mockImplementation((url: string, options?: { body?: string }) => {
      if (url.startsWith('/api/words/explore')) {
        return response({
          word: 'issue',
          senses: [
            {
              pos: 'noun',
              definition: 'An important topic or problem for debate.',
              examples: [],
              synonyms: ['problem'],
              antonyms: [],
            },
            {
              pos: 'verb',
              definition: 'To officially provide or announce something.',
              examples: [],
              synonyms: ['provide'],
              antonyms: [],
            },
          ],
          contextualTerms: [],
        });
      }
      return translationResponse(options);
    });

    const hook = runtime.renderHook(() => useWordDictionary('issue', 'vi', true, 'This issue is complicated.'));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    expect(hook.current.meanings[0].contextMatch).toBe(true);
    expect(hook.current.pos).toBe('noun');
  });

  it('caches the rich result for identical word, language, and context', async () => {
    mockFetch.mockImplementation((url: string, options?: { body?: string }) => {
      if (url.startsWith('/api/words/explore')) {
        return response({
          word: 'significant',
          senses: [
            {
              pos: 'adjective',
              definition: 'Important or large enough to be noticed.',
              examples: ['There was a significant increase.'],
              synonyms: ['important'],
              antonyms: ['insignificant'],
            },
          ],
          synonyms: ['important'],
          antonyms: ['insignificant'],
          collocations: ['significant increase'],
          wordFamily: [{ word: 'significantly', pos: ['adv'] }],
          contextualTerms: [],
        });
      }
      return translationResponse(options);
    });

    const hook = runtime.renderHook(() => useWordDictionary('significant', 'vi', true, 'a significant increase'));
    await waitFor(() => expect(hook.current.isLoading).toBe(false));
    const callsAfterLoad = mockFetch.mock.calls.length;

    hook.rerender();
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterLoad);
    expect(hook.current.collocations).toEqual(['significant increase']);
  });
});
