/**
 * How a plan-vs-actual difference is written, in the reader's own convention.
 *
 * The dashboard used to contradict itself: one card marked a shortfall with
 * `▲` (Japanese accounting, where the triangle IS the minus sign) while the
 * card beside it used `▲` for a rise, and both then printed the number through
 * `Math.abs`, so the arrow was the only thing saying which way it went.
 *
 * Japanese keeps its convention - `▲1,180` reads as -1,180, and a figure above
 * plan is written plain, because the triangle stands in for the sign rather
 * than pairing with a `▼`. Every other language reads `▲` as "up", so there the
 * arrow is only a cue and the number carries its own `+`/`-`.
 */

/** The arrow that marks `delta`, or '' when the convention prints none. */
export const varianceArrow = (delta: number, language: string): string => {
  if (delta === 0) return '';
  if (language === 'ja') return delta < 0 ? '▲' : '';
  return delta < 0 ? '▼' : '▲';
};

export interface VarianceMark {
  /** Print before the number. May be empty. */
  arrow: string;
  /** The number itself, signed unless the arrow already carries the sign. */
  text: string;
}

/**
 * `delta` as the arrow and the text to print beside it.
 *
 * `format` renders the magnitude - pass the same formatter the surrounding
 * figures use, so a variance in hours reads like the hours above it.
 */
export const formatVariance = (
  delta: number,
  language: string,
  format: (value: number) => string
): VarianceMark => {
  const magnitude = format(Math.abs(delta));
  const arrow = varianceArrow(delta, language);

  // In Japanese the triangle is the sign; printing both would read as a double
  // negative.
  if (language === 'ja' || delta === 0) return { arrow, text: magnitude };

  return { arrow, text: `${delta < 0 ? '-' : '+'}${magnitude}` };
};
