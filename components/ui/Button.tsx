import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses';

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
