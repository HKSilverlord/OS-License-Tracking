import React from 'react';
import { AlertTriangle, Inbox, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** What the reader is looking at. One line. */
  title: string;
  /** Why it is empty, and what to do about it. */
  description?: string;
  /** Buttons or links out - the ways forward from here. */
  actions?: React.ReactNode;
  /** `error` when the data failed to arrive, rather than not existing yet. */
  tone?: 'empty' | 'error';
  icon?: LucideIcon;
  className?: string;
}

/**
 * What a view shows instead of an empty chart or a table of dashes.
 *
 * An empty year and a failed request must not look alike: each says which one
 * it is and offers the way out - the tracking view for entering hours, a retry
 * for a request that did not land. It sits inside the page, under the page's
 * own header, so the year control stays in reach.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actions,
  tone = 'empty',
  icon,
  className = '',
}) => {
  const Icon = icon ?? (tone === 'error' ? AlertTriangle : Inbox);
  const iconTone = tone === 'error'
    ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';

  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`flex flex-1 min-h-0 items-center justify-center px-6 py-14 ${className}`}
    >
      <div className="max-w-sm text-center animate-fade-up">
        <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl ${iconTone}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-lg font-bold leading-7 text-slate-900 dark:text-white">{title}</p>
        {description && (
          <p className="mt-1.5 text-[15px] leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
