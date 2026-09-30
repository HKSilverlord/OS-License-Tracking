/** Helpers for the report's editor: clean input, field names, list keys. */
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { sanitizeReportText } from '../../utils/reportModel';
import { moveItem, removeAt } from './listOps';

/**
 * What a text field hands on: pasted control characters are gone before they
 * reach the draft, so the field shows exactly what will be saved. Replacing
 * the value moves the caret to the end, so it is put back after the text that
 * was typed or pasted.
 */
export const cleanInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string => {
  const field = event.target;
  const clean = sanitizeReportText(field.value);
  if (clean !== field.value && field.selectionStart !== null) {
    const caret = sanitizeReportText(field.value.slice(0, field.selectionStart)).length;
    requestAnimationFrame(() => field.setSelectionRange(caret, caret));
  }
  return clean;
};

/**
 * A field's name with the item it belongs to, e.g. "Focus project 1, Name", so
 * the many "Name" and "Point 1" fields of a report can be told apart.
 */
export function useFieldName() {
  const { t } = useLanguage();
  return (item: string, field: string) =>
    t('report.edit.fieldOf', '{item}, {field}').replace('{item}', item).replace('{field}', field);
}

let lastItemKey = 0;
const newItemKey = () => {
  lastItemKey += 1;
  return lastItemKey;
};

/**
 * React keys for an editable list, kept in step with its moves and removals,
 * so an item keeps its fields (and its focus) when it moves. They live only
 * in the editor; nothing about them is saved.
 */
export function useItemKeys(length: number) {
  const [keys, setKeys] = useState<number[]>(() => Array.from({ length }, newItemKey));
  let current = keys;
  if (current.length !== length) {
    // Added at the end, or replaced from outside: new keys for new items.
    current = current.length < length
      ? [...current, ...Array.from({ length: length - current.length }, newItemKey)]
      : current.slice(0, length);
    setKeys(current);
  }
  return {
    keys: current,
    move: (index: number, step: -1 | 1) => setKeys(prev => moveItem(prev, index, step)),
    remove: (index: number) => setKeys(prev => removeAt(prev, index)),
  };
}
