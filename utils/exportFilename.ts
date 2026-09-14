/**
 * One timestamp format for every exported file.
 *
 * `toISOString()` is UTC, so a file saved at 09:00 in Hanoi or Tokyo was stamped
 * with the previous day's date — the name no longer matched the day the report
 * was made. Local time is what the person naming the file means.
 */
const pad = (value: number): string => String(value).padStart(2, '0');

/** `2026-09-14_0930`, in the user's own timezone. Seconds are noise here. */
export const exportTimestamp = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
  `_${pad(now.getHours())}${pad(now.getMinutes())}`;

/** `prefix_2026-09-14_0930.png` */
export const timestampedFilename = (prefix: string, extension: string): string =>
  `${prefix}_${exportTimestamp()}.${extension}`;
