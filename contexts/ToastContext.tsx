import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Auto-dismiss delay. Default 4000 ms (6000 ms for errors). Pass 0 to keep it until dismissed. */
  durationMs?: number;
}

export interface ToastApi {
  success(message: string, opts?: ToastOptions): void;
  error(message: string, opts?: ToastOptions): void;
  info(message: string, opts?: ToastOptions): void;
  warning(message: string, opts?: ToastOptions): void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type ShowToast = (kind: ToastKind, message: string, opts?: ToastOptions) => void;

const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 6000;

/* ------------------------------------------------------------------ *
 * Module-level imperative bridge.
 * Calls made before <ToastProvider> mounts are queued and flushed on mount.
 * ------------------------------------------------------------------ */

let showToastImpl: ShowToast | null = null;
const pendingToasts: Array<{ kind: ToastKind; message: string; opts?: ToastOptions }> = [];

const emit: ShowToast = (kind, message, opts) => {
  if (showToastImpl) {
    showToastImpl(kind, message, opts);
  } else {
    pendingToasts.push({ kind, message, opts });
  }
};

/** Imperative API usable outside React (services, event handlers). */
export const toast: ToastApi = {
  success: (message, opts) => emit('success', message, opts),
  error: (message, opts) => emit('error', message, opts),
  info: (message, opts) => emit('info', message, opts),
  warning: (message, opts) => emit('warning', message, opts),
};

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

interface ToastContextValue {
  api: ToastApi;
  confirm: ConfirmFn;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const useToastContext = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast/useConfirm must be used within a ToastProvider');
  }
  return context;
};

export function useToast(): ToastApi {
  return useToastContext().api;
}

/** Promise-based replacement for window.confirm; resolves true on confirm. */
export function useConfirm(): ConfirmFn {
  return useToastContext().confirm;
}

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

type IconComponent = React.ComponentType<{ className?: string }>;

const KIND_ICON: Record<ToastKind, IconComponent> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const KIND_ACCENT: Record<ToastKind, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
};

const KIND_BORDER: Record<ToastKind, string> = {
  success: 'border-emerald-300 dark:border-emerald-700',
  error: 'border-rose-300 dark:border-rose-700',
  warning: 'border-amber-300 dark:border-amber-700',
  info: 'border-sky-300 dark:border-sky-700',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

  const nextIdRef = useRef(0);
  const timersRef = useRef<Map<number, number>>(new Map());
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);

  const show = useCallback<ShowToast>((kind, message, opts) => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    const durationMs = opts?.durationMs ?? (kind === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);

    setToasts(prev => [...prev, { id, kind, message }]);

    if (durationMs > 0) {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(id);
        setToasts(prev => prev.filter(item => item.id !== id));
      }, durationMs);
      timersRef.current.set(id, timer);
    }
  }, []);

  // Register the imperative bridge and flush anything queued before mount.
  useEffect(() => {
    showToastImpl = show;
    if (pendingToasts.length > 0) {
      const queued = pendingToasts.splice(0, pendingToasts.length);
      queued.forEach(item => show(item.kind, item.message, item.opts));
    }
    return () => {
      if (showToastImpl === show) showToastImpl = null;
    };
  }, [show]);

  const closeConfirm = useCallback((result: boolean) => {
    const resolve = confirmResolveRef.current;
    confirmResolveRef.current = null;
    setConfirmOpts(null);
    const restore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (restore && typeof restore.focus === 'function') restore.focus();
    if (resolve) resolve(result);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    opts =>
      new Promise<boolean>(resolve => {
        // A second confirm supersedes a pending one; the old promise resolves false.
        const previous = confirmResolveRef.current;
        if (previous) previous(false);
        const active = document.activeElement;
        restoreFocusRef.current = active instanceof HTMLElement ? active : null;
        confirmResolveRef.current = resolve;
        setConfirmOpts(opts);
      }),
    [],
  );

  // Escape cancels the confirm dialog wherever focus happens to be.
  useEffect(() => {
    if (!confirmOpts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpts, closeConfirm]);

  // Initial focus: the safe choice first when the action is destructive.
  useEffect(() => {
    if (!confirmOpts) return;
    const target = confirmOpts.danger ? cancelButtonRef.current : confirmButtonRef.current;
    target?.focus();
  }, [confirmOpts]);

  // Focus trap: only the two buttons are reachable while the dialog is open.
  const handleDialogKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const isOnCancel = document.activeElement === cancelButtonRef.current;
    const target = isOnCancel ? confirmButtonRef.current : cancelButtonRef.current;
    target?.focus();
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      api: {
        success: (message, opts) => show('success', message, opts),
        error: (message, opts) => show('error', message, opts),
        info: (message, opts) => show('info', message, opts),
        warning: (message, opts) => show('warning', message, opts),
      },
      confirm,
    }),
    [show, confirm],
  );

  const toastStack = createPortal(
    <div
      className="fixed top-4 right-4 z-[10000] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(item => {
        const Icon = KIND_ICON[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            onClick={() => dismiss(item.id)}
            className={`pointer-events-auto flex cursor-pointer items-start gap-2 rounded-lg border ${KIND_BORDER[item.kind]} bg-white dark:bg-slate-900 px-3 py-2 shadow-lg shadow-slate-900/10 dark:shadow-black/40`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${KIND_ACCENT[item.kind]}`} />
            <span className="flex-1 text-sm leading-snug text-slate-900 dark:text-slate-100 break-words">
              {item.message}
            </span>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                dismiss(item.id);
              }}
              aria-label={t('common.close', 'Close')}
              className="shrink-0 rounded p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );

  const confirmDialog =
    confirmOpts &&
    createPortal(
      <div
        className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 p-4"
        onMouseDown={event => {
          if (event.target === event.currentTarget) closeConfirm(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="toast-confirm-title"
          aria-describedby="toast-confirm-message"
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xl"
        >
          <h2
            id="toast-confirm-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {confirmOpts.title}
          </h2>
          <p
            id="toast-confirm-message"
            className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300"
          >
            {confirmOpts.message}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={() => closeConfirm(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
            >
              {confirmOpts.cancelLabel ?? t('common.cancel', 'Cancel')}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={() => closeConfirm(true)}
              className={
                confirmOpts.danger
                  ? 'rounded-lg border border-rose-600 dark:border-rose-500 bg-rose-600 dark:bg-rose-600 px-3 py-1.5 text-sm font-medium text-white dark:text-white hover:bg-rose-700 dark:hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 dark:focus:ring-rose-500'
                  : 'rounded-lg border border-blue-600 dark:border-blue-500 bg-blue-600 dark:bg-blue-600 px-3 py-1.5 text-sm font-medium text-white dark:text-white hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500'
              }
            >
              {confirmOpts.confirmLabel ?? t('common.confirm', 'Confirm')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastStack}
      {confirmDialog}
    </ToastContext.Provider>
  );
};
