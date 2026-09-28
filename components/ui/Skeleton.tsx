import React from 'react';

export interface SkeletonProps {
  className?: string;
}

/**
 * The shape of what is loading, drawn where it will appear, so the page does
 * not jump when the numbers arrive.
 */
export const Skeleton: React.FC<SkeletonProps> & {
  Table: React.FC<{ rows?: number; cols?: number; className?: string }>;
} = ({ className = '' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800 ${className}`} />
);

const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 4,
  className = '',
}) => (
  <div aria-hidden="true" className={`w-full ${className}`}>
    <div className="flex gap-4 border-b border-slate-100 px-4 pb-3 dark:border-slate-800">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={`th-${i}`} className="flex-1">
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`tr-${r}`} className="flex gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={`td-${r}-${c}`} className="flex-1">
              <Skeleton className={`h-3.5 ${c === 0 ? 'w-4/5' : 'w-3/5'}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

Skeleton.Table = SkeletonTable;
