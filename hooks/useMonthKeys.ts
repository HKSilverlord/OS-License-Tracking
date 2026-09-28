import React, { useEffect } from 'react';

/** Keys typed into a control, or inside a menu or panel, are that control's own. */
export const isOwnedKey = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  target.closest('input, select, textarea, [contenteditable="true"], [role="dialog"], [role="menu"], [role="radiogroup"]') !== null;

/**
 * With a month selected: Esc releases it, the arrows walk the year, Home and
 * End jump to January and December.
 *
 * Reading a month at a time is what the detail card is for, and stepping to
 * the next one used to mean the select or a thin bar under the pointer. Only
 * bound while a month is selected, and never over a control that wants the
 * arrows for itself.
 */
export const useMonthKeys = (
  selected: boolean,
  setMonth: React.Dispatch<React.SetStateAction<number | null>>,
  release: () => void,
) => {
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isOwnedKey(e.target)) return;
      if (e.key === 'Escape') {
        release();
        return;
      }
      const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const jump = e.key === 'Home' ? 1 : e.key === 'End' ? 12 : 0;
      if (!step && !jump) return;
      e.preventDefault();
      // Stops at January and December rather than wrapping: a card that jumps
      // from December to January reads as having lost its place.
      setMonth(current => (current === null ? current : jump || Math.min(12, Math.max(1, current + step))));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, setMonth, release]);
};
