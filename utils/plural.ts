import type { TranslateFn } from '../contexts/LanguageContext';

/**
 * `key.one` or `key.other` by count, with `{count}` filled in.
 *
 * English needs both forms; Japanese and Vietnamese carry the same text in
 * each, so every language goes through the same two keys. Pass `format` for
 * counts that can run into the thousands, so they get the language's grouping.
 */
export const plural = (
  t: TranslateFn,
  key: string,
  count: number,
  fallback: string,
  format: (count: number) => string = String,
): string => t(`${key}.${count === 1 ? 'one' : 'other'}`, fallback).replace('{count}', format(count));
