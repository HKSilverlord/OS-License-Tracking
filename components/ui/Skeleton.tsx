import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> & {
  Table: React.FC<{ rows?: number; cols?: number; className?: string }>;
} = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700/50 rounded ${className}`} />
  );
};

Skeleton.Table = ({ rows = 5, cols = 4, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`th-${i}`} className="flex-1 px-4">
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={`td-${r}-${c}`} className="flex-1 px-4">
                <Skeleton className="h-4 w-full max-w-[80%]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
