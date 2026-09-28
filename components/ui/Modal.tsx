import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZE = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons, right-aligned; stacked full-width on a phone. */
  footer?: React.ReactNode;
  size?: keyof typeof SIZE;
  /**
   * False while something is saving: Esc, the backdrop and the close button
   * stop working, so a half-finished write cannot be walked away from.
   */
  dismissible?: boolean;
}

/**
 * The one dialog in the app. Centred on a desktop, a sheet rising from the
 * bottom edge on a phone, where a thumb can reach its buttons.
 *
 * It takes focus when it opens (the first field, or the element marked
 * `data-autofocus`), keeps Tab inside itself, and gives focus back to whatever
 * opened it on close.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}) => {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Read inside listeners that are bound once per opening.
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  }, [onClose, dismissible]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]');
    const firstField = panel?.querySelector<HTMLElement>(
      'input:not([disabled]):not([readonly]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
    );
    (preferred ?? firstField ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // Already handled by something on top: a menu, or a confirm raised from this dialog.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl shadow-slate-950/20 ring-1 ring-slate-900/5 outline-none animate-slide-in-up sm:rounded-2xl sm:animate-scale-in dark:bg-slate-900 dark:ring-white/10 ${SIZE[size]}`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold leading-6 text-slate-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label={t('common.close', 'Close')}
            className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3 custom-scrollbar sm:px-6">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-slate-900 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
