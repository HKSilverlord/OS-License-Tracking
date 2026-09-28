import { useCallback, useEffect, useState } from 'react';

/** Recharts' own default for a Line, the slowest of the series it animates. */
const DEFAULT_GROW_IN_MS = 1500;

/**
 * Whether a chart's series animate right now, and a way to stop them.
 *
 * Recharts hides a series' value labels while it animates, and any re-render
 * of the chart starts the animation over — the palette swap an export makes
 * included, so a copy taken in dark mode came out with no figures on it. The
 * series grow in when `data` changes and stand still the rest of the time;
 * `settle` stops them at once, for a capture taken mid-grow-in.
 */
export function useGrowIn(data: unknown, durationMs = DEFAULT_GROW_IN_MS): [animating: boolean, settle: () => void] {
  const [animating, setAnimating] = useState(true);
  // Set during render, not in an effect, so the frame that brings new data is
  // already the one that animates it.
  const [grownFor, setGrownFor] = useState(data);
  if (grownFor !== data) {
    setGrownFor(data);
    setAnimating(true);
  }

  useEffect(() => {
    if (!animating) return;
    const id = window.setTimeout(() => setAnimating(false), durationMs + 120);
    return () => window.clearTimeout(id);
  }, [animating, durationMs, grownFor]);

  const settle = useCallback(() => setAnimating(false), []);
  return [animating, settle];
}
