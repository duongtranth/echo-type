import { useEffect, useState } from 'react';

/**
 * True on devices with real mouse hover (desktop/trackpad), false on touch-only devices.
 * Radix's HoverCard deliberately ignores touch pointer events, so callers use this to fall
 * back to tap-to-toggle instead of silently offering an unreachable hover-only feature.
 */
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(true);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    setHasHover(query.matches);

    const handleChange = (event: MediaQueryListEvent) => setHasHover(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return hasHover;
}
