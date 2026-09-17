import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EffectCallback = () => void | (() => void);

const runtime = vi.hoisted(() => {
  type Cell =
    | { kind: 'state'; value: unknown }
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
    };
  }

  return { reset, renderHook, useState, useEffect };
});

vi.mock('react', () => ({
  useState: runtime.useState,
  useEffect: runtime.useEffect,
}));

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let changeListener: ((event: { matches: boolean }) => void) | null = null;

  const mql = {
    get matches() {
      return matches;
    },
    media: '(hover: hover) and (pointer: fine)',
    addEventListener: vi.fn((_event: string, listener: (event: { matches: boolean }) => void) => {
      changeListener = listener;
    }),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal('window', { matchMedia: vi.fn().mockReturnValue(mql) });

  return {
    fireChange: (nextMatches: boolean) => {
      matches = nextMatches;
      changeListener?.({ matches: nextMatches });
    },
  };
}

describe('useHasHover', () => {
  beforeEach(() => {
    runtime.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reports true on a hover-capable (mouse) device', async () => {
    mockMatchMedia(true);
    const { useHasHover } = await import('../use-has-hover');
    const { current } = runtime.renderHook(() => useHasHover());
    expect(current).toBe(true);
  });

  it('reports false on a touch-only device', async () => {
    mockMatchMedia(false);
    const { useHasHover } = await import('../use-has-hover');
    const { current } = runtime.renderHook(() => useHasHover());
    expect(current).toBe(false);
  });

  it('updates when the media query result changes (e.g. attaching a mouse)', async () => {
    const media = mockMatchMedia(false);
    const { useHasHover } = await import('../use-has-hover');
    const result = runtime.renderHook(() => useHasHover());
    expect(result.current).toBe(false);

    media.fireChange(true);
    expect(result.current).toBe(true);
  });
});
