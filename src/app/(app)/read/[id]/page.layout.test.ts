import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('read practice layout', () => {
  it('caps long reference text at a generous scrollable height instead of clipping it small', () => {
    expect(source).toContain('data-testid="read-reference-scroll"');
    expect(source).toMatch(/read-reference-scroll[\s\S]*max-h-\[65dvh\]/);
    expect(source).toMatch(/read-reference-scroll[\s\S]*overflow-y-auto/);
  });

  it('keeps read controls below the reference text in natural document flow', () => {
    expect(source).toContain('data-testid="read-practice-workspace"');
    expect(source).toMatch(/read-practice-workspace[\s\S]*ReadAloudInlineControls/);
  });

  it('shows recognition errors in the native controls', () => {
    const controlsStart = source.indexOf('{isIOSNativeHost ? (', source.indexOf('{raIsActive &&'));
    const controlsEnd = source.indexOf(') : (\n              <ReadAloudInlineControls', controlsStart);

    expect(source.slice(controlsStart, controlsEnd)).toContain(
      '{speechError && <p className="text-xs text-red-500 text-center max-w-md">{speechError}</p>}',
    );
  });
});
