/**
 * Axis, grid and marker colours for the full-page charts.
 *
 * These cannot be Tailwind `dark:` classes: every one of them is an SVG
 * `fill`/`stroke` prop that Recharts passes straight to the element.
 */
export const chartTheme = (isDark: boolean) => ({
  text: isDark ? '#e2e8f0' : '#334155',
  muted: isDark ? '#94a3b8' : '#475569',
  line: isDark ? '#475569' : '#cbd5e1',
  grid: isDark ? 'rgba(148,163,184,0.32)' : 'rgba(100,116,139,0.26)',
  // The card behind the labels, so an outlined label cuts cleanly through a bar.
  halo: isDark ? '#0f172a' : '#ffffff',
  // A soft plate behind a label that sits on top of a bar or line.
  plate: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.72)',
  focus: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.09)',
  marker: '#f97316',
});

export type ChartTheme = ReturnType<typeof chartTheme>;
