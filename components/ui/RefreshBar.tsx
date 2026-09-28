import React from 'react';

/**
 * A hairline that says "newer numbers are on the way", over data still on screen.
 *
 * Changing the year keeps the old year visible, dimmed, with this bar over it,
 * rather than blanking the page into a skeleton for the length of a request.
 *
 * `data-html2canvas-ignore` because it sits inside the panels that get
 * captured, and a progress bar has no business in an exported image.
 */
export const RefreshBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    data-html2canvas-ignore="true"
    role="progressbar"
    aria-hidden="true"
    className={`h-0.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/15 ${className}`}
  >
    <div className="h-full w-1/4 rounded-full bg-blue-500 dark:bg-blue-400 animate-sweep" />
  </div>
);
