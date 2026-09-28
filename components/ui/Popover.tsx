import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { anchoredStyle, useAnchoredPosition } from './useAnchoredPosition';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  /** Names the panel for screen readers. */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A small panel of settings next to the button that opened it: the account
 * and appearance settings, a chart's colours. Unlike a menu it holds real
 * controls, so Tab moves through them; Esc, a click outside, or tabbing past
 * either end closes it and returns focus to the button.
 */
export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  anchorRef,
  align = 'end',
  label,
  children,
  className = '',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition({ open, anchorRef, panelRef, align, onDismiss: onClose });

  const close = useCallback(() => {
    onClose();
    anchorRef.current?.focus();
  }, [anchorRef, onClose]);

  useEffect(() => {
    if (!open || !position) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    // The selected segment of a segmented control, else the first control.
    const preferred =
      panel.querySelector<HTMLElement>('[data-autofocus], [role="radio"][aria-checked="true"]') ??
      panel.querySelector<HTMLElement>(FOCUSABLE);
    (preferred ?? panel).focus();
  }, [open, position]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.tabIndex >= 0);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const leaving = event.shiftKey ? document.activeElement === first : document.activeElement === last;
    if (focusables.length === 0 || leaving) {
      event.preventDefault();
      close();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-html2canvas-ignore="true"
      style={anchoredStyle(position)}
      className={`fixed z-[1100] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-2xl bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.08] outline-none custom-scrollbar dark:bg-slate-900 dark:shadow-black/50 dark:ring-white/10 ${
        position ? 'animate-scale-in' : ''
      } ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
};
