import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode; // For filters or tabs below the title
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className = ''
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 px-6 py-5 border-b border-slate-200 dark:border-slate-800 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
          </div>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex flex-wrap items-center gap-3 self-start">
            {actions}
          </div>
        )}
      </div>
      
      {children && (
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
};
