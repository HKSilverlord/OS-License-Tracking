import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  elevated?: boolean;
  inset?: boolean;
  gradient?: boolean;
  fromColor?: string;
  toColor?: string;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  elevated = false, 
  inset = false, 
  gradient = false,
  fromColor = 'sky-500', 
  toColor = 'sky-600',
  style,
  ...props 
}) => {
  let baseClasses = 'rounded-xl overflow-hidden ';
  let gradientStyle = style || {};

  if (gradient) {
    baseClasses += 'text-white shadow-sm border-0 ';
    // Since we need to support dynamic color codes from the user's DB/settings
    // we'll apply them via inline style if they are hex codes, otherwise via classes
    if (fromColor.startsWith('#') && toColor.startsWith('#')) {
      gradientStyle = { 
        ...gradientStyle, 
        background: `linear-gradient(to right, ${fromColor}, ${toColor})` 
      };
    } else {
      baseClasses += `bg-gradient-to-r from-${fromColor} to-${toColor} `;
    }
  } else if (inset) {
    baseClasses += 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ';
  } else {
    baseClasses += 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ';
  }

  if (elevated) {
    baseClasses += 'shadow-md ';
  } else if (!gradient) {
    baseClasses += 'shadow-sm ';
  }

  return (
    <div className={`${baseClasses} ${className}`} style={gradientStyle} {...props}>
      {children}
    </div>
  );
};
