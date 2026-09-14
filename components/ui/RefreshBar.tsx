import React from 'react';

/**
 * A hairline that says "newer numbers are on the way", over data still on screen.
 *
 * Changing the year used to replace the whole view with a skeleton, so the
 * toolbar, the title and every control vanished for as long as the request
 * took - a switch between two years read as the page breaking and coming back.
 * The view now keeps the old year visible and dimmed with this bar over it.
 *
 * `data-html2canvas-ignore` because it sits inside the panels that get
 * captured, and a progress bar has no business in an exported image.
 */
export const RefreshBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    data-html2canvas-ignore="true"
    role="progressbar"
    aria-hidden="true"
    className={`h-0.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}
  >
    <div className="h-full w-1/4 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-sweep" />
  </div>
);
