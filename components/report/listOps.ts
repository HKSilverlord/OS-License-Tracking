/** Small immutable list edits for the report's editable lists. */

export const replaceAt = <T>(items: readonly T[], index: number, value: T): T[] =>
  items.map((item, i) => (i === index ? value : item));

export const removeAt = <T>(items: readonly T[], index: number): T[] =>
  items.filter((_, i) => i !== index);

/** Moves one item up (-1) or down (+1); out of range leaves the list as it is. */
export const moveItem = <T>(items: readonly T[], index: number, step: -1 | 1): T[] => {
  const target = index + step;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** ①②③ … for the template's numbered points; plain numbers past twenty. */
export const circled = (index: number): string =>
  index >= 0 && index < 20 ? String.fromCharCode(0x2460 + index) : `${index + 1}.`;
