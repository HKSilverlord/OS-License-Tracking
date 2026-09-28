import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

const GAP = 6;
const EDGE = 8;

export interface AnchoredPosition {
  top: number;
  left: number;
  /** transform-origin, so the open animation grows out of the button. */
  origin: string;
}

/**
 * Places a floating panel (a menu, a popover) against the button that opened
 * it: measured once it is on the page, below the button when it fits and above
 * when it does not, never past the edge of the window. It follows the button
 * when something underneath scrolls, and closes on a click outside or a resize.
 */
export function useAnchoredPosition({
  open,
  anchorRef,
  panelRef,
  align,
  onDismiss,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  align: 'start' | 'end';
  /** Called for a click outside or a resize — never with focus to restore. */
  onDismiss: () => void;
}): AnchoredPosition | null {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - EDGE;
    const fitsAbove = rect.top - GAP - height >= EDGE;
    const below = fitsBelow || !fitsAbove;
    const top = below ? rect.bottom + GAP : rect.top - GAP - height;
    const preferredLeft = align === 'end' ? rect.right - width : rect.left;
    setPosition({
      top: Math.max(EDGE, top),
      left: Math.min(Math.max(preferredLeft, EDGE), window.innerWidth - width - EDGE),
      origin: `${align === 'end' ? 'right' : 'left'} ${below ? 'top' : 'bottom'}`,
    });
  }, [align, anchorRef, panelRef]);

  // Before paint, so the panel never flashes at the wrong spot.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onDismissRef.current();
    };
    const onResize = () => onDismissRef.current();
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchorRef, panelRef, place]);

  return position;
}

/** Inline style for a panel placed by `useAnchoredPosition`, hidden until measured. */
export const anchoredStyle = (position: AnchoredPosition | null, minWidth?: number): CSSProperties => ({
  top: position?.top ?? 0,
  left: position?.left ?? 0,
  minWidth,
  transformOrigin: position?.origin,
  visibility: position ? 'visible' : 'hidden',
});
