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
 * An empty year used to render the same way a broken one did: axes drawn
 * against a fallback scale, rows of `-`, and nothing saying whether the year
 * has no hours in it or the request failed. Both cases now say which one it is
 * and offer the way out - the tracking view for entering hours, a retry for a
 * request that did not land.
 *
 * Modelled on the Dashboard's own empty state, which already got this right.
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
    ? 'text-amber-500 dark:text-amber-400'
    : 'text-slate-400 dark:text-slate-500';

  return (
    <div className={`flex flex-1 min-h-0 items-center justify-center p-6 ${className}`}>
      <div className="max-w-sm text-center">
        <Icon className={`w-10 h-10 mx-auto mb-3 ${iconTone}`} aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        {description && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

/** The one button style these states use, so the two views cannot drift apart. */
export const emptyStateActionClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ' +
  'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 ' +
  'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ' +
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

/**
 * The same state as a whole view, inside the panel every view is drawn in.
 *
 * Both the chart and the table replace their entire body when there is nothing
 * to show - a toolbar of controls that act on no data is worse than no toolbar.
 */
export const EmptyStatePage: React.FC<EmptyStateProps> = props => (
  <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-6 overflow-hidden">
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col">
      <EmptyState {...props} />
    </div>
  </div>
);
