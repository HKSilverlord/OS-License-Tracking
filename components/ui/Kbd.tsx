import React from 'react';

/** A key on the keyboard, for the few shortcuts worth knowing (Ctrl S to save). */
export const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <kbd
    className={`inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 px-1 font-sans text-[11px] font-medium leading-none opacity-70 ${className}`}
  >
    {children}
  </kbd>
);
