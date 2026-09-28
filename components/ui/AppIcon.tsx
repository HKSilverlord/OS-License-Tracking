import React, { useId } from 'react';

/** Rounded-square outline shared with public/favicon.svg. */
const SQUIRCLE =
  'M32 0C50.9 0 57 0 60.5 3.5C64 7 64 13.1 64 32C64 50.9 64 57 60.5 60.5C57 64 50.9 64 32 64' +
  'C13.1 64 7 64 3.5 60.5C0 57 0 50.9 0 32C0 13.1 0 7 3.5 3.5C7 0 13.1 0 32 0Z';

/**
 * The app's mark: three rising bars, plan becoming actual. Drawn, not loaded,
 * so it is sharp at every size and there before any request finishes.
 */
export const AppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  // useId can contain characters that are awkward inside url(#…).
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={SQUIRCLE} fill={`url(#${id}-fill)`} />
      <path d={SQUIRCLE} fill={`url(#${id}-shine)`} />
      <rect x="15" y="34" width="8" height="12" rx="2.5" fill="#ffffff" fillOpacity="0.75" />
      <rect x="28" y="26" width="8" height="20" rx="2.5" fill="#ffffff" fillOpacity="0.75" />
      <rect x="41" y="18" width="8" height="28" rx="2.5" fill="#ffffff" />
    </svg>
  );
};
