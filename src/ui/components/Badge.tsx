import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  status?: 'active' | 'inactive' | 'success' | 'warning' | 'error' | 'neutral';
  variant?: 'solid' | 'subtle' | 'outline';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  status = 'neutral', 
  variant = 'subtle',
  className = '' 
}) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap';
  
  const styles = {
    subtle: {
      active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      inactive: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
      success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      error: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
      neutral: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    },
    solid: {
      active: 'bg-blue-600 text-white',
      inactive: 'bg-slate-500 text-white',
      success: 'bg-emerald-500 text-white',
      warning: 'bg-amber-500 text-white',
      error: 'bg-rose-500 text-white',
      neutral: 'bg-slate-500 text-white',
    },
    outline: {
      active: 'text-blue-600 border border-blue-200 dark:border-blue-800 dark:text-blue-400',
      inactive: 'text-slate-600 border border-slate-200 dark:border-slate-700 dark:text-slate-400',
      success: 'text-emerald-600 border border-emerald-200 dark:border-emerald-800 dark:text-emerald-400',
      warning: 'text-amber-600 border border-amber-200 dark:border-amber-800 dark:text-amber-400',
      error: 'text-rose-600 border border-rose-200 dark:border-rose-800 dark:text-rose-400',
      neutral: 'text-slate-600 border border-slate-200 dark:border-slate-700 dark:text-slate-400',
    }
  };

  return (
    <span className={`${baseClasses} ${styles[variant][status]} ${className}`}>
      {children}
    </span>
  );
};
