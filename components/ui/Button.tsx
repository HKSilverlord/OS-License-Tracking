import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-quiet' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-50';

const SECONDARY =
  'border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/[0.04] ' +
  'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none ' +
  'dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-700';

const VARIANTS: Record<ButtonVariant, string> = {
  // The one filled blue per screen: the action the screen exists for.
  primary:
    'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 active:bg-blue-800 ' +
    'dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-700',
  secondary: SECONDARY,
  // Kept as a name so older call sites read naturally; it is the secondary look.
  outline: SECONDARY,
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 ' +
    'dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-700',
  danger:
    'bg-rose-600 text-white shadow-sm shadow-rose-600/25 hover:bg-rose-700 active:bg-rose-800 ' +
    'dark:hover:bg-rose-500',
  // A destructive action that is not the point of the screen: "Delete period" in an editor.
  'danger-quiet':
    'text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100 ' +
    'dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 dark:active:bg-rose-500/20',
  success:
    'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:bg-emerald-800 ' +
    'dark:hover:bg-emerald-500',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-3 text-[13px]',
  md: 'h-9 rounded-lg px-3.5 text-sm',
  lg: 'h-11 rounded-xl px-5 text-[15px]',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

/**
 * The button classes on their own, for things that must be a different element
 * — a router `<Link>` that should look exactly like the button beside it.
 */
export const buttonClasses = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string => `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the icon for a spinner and blocks further clicks, keeping the width. */
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  disabled,
  type = 'button',
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    className={buttonClasses(variant, size, className)}
    {...props}
  >
    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
    {children}
  </button>
));

Button.displayName = 'Button';
