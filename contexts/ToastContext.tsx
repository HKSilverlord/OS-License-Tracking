import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { Button } from '../components/ui/Button';

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
  success: 'text-emerald-500 dark:text-emerald-400',
  error: 'text-rose-500 dark:text-rose-400',
  warning: 'text-amber-500 dark:text-amber-400',
  info: 'text-blue-500 dark:text-blue-400',
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

  // Escape cancels the confirm dialog wherever focus happens to be. Capture
  // phase, so a dialog underneath (which skips handled keys) stays open.
  useEffect(() => {
    if (!confirmOpts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
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
    // Along the bottom edge, where it covers no page title or control: centred
    // on a phone within reach of a thumb, bottom-right on a desktop.
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[10000] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[22rem] sm:items-stretch"
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
            className="pointer-events-auto flex w-full max-w-[26rem] cursor-pointer items-start gap-3 rounded-xl bg-white/95 py-3 pl-3.5 pr-2 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.07] backdrop-blur-xl animate-fade-up dark:bg-slate-800/95 dark:shadow-black/40 dark:ring-white/10"
          >
            <Icon className={`mt-px h-[18px] w-[18px] shrink-0 ${KIND_ACCENT[item.kind]}`} />
            <span className="flex-1 break-words text-sm leading-5 text-slate-800 dark:text-slate-100">
              {item.message}
            </span>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                dismiss(item.id);
              }}
              aria-label={t('common.close', 'Close')}
              className="-my-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
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
        className="fixed inset-0 z-[10001] flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6"
        onMouseDown={event => {
          if (event.target === event.currentTarget) closeConfirm(false);
        }}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="toast-confirm-title"
          aria-describedby="toast-confirm-message"
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          className="w-full rounded-t-2xl bg-white p-5 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-900/5 animate-slide-in-up sm:max-w-sm sm:rounded-2xl sm:p-6 sm:animate-scale-in dark:bg-slate-900 dark:ring-white/10"
        >
          <h2 id="toast-confirm-title" className="text-[17px] font-semibold leading-6 text-slate-900 dark:text-white">
            {confirmOpts.title}
          </h2>
          <p
            id="toast-confirm-message"
            className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300"
          >
            {confirmOpts.message}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={cancelButtonRef} variant="secondary" onClick={() => closeConfirm(false)} className="w-full sm:w-auto">
              {confirmOpts.cancelLabel ?? t('common.cancel', 'Cancel')}
            </Button>
            <Button
              ref={confirmButtonRef}
              variant={confirmOpts.danger ? 'danger' : 'primary'}
              onClick={() => closeConfirm(true)}
              className="w-full sm:w-auto"
            >
              {confirmOpts.confirmLabel ?? t('common.confirm', 'Confirm')}
            </Button>
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
