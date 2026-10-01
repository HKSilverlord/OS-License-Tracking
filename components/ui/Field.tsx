import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Text field look, shared by every input, select and textarea in the app.
 * Focus is a soft blue halo rather than the keyboard ring buttons use: a field
 * is where the caret is, and the halo says so without shouting.
 */
const controlClasses =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 ' +
  'shadow-sm shadow-slate-900/[0.03] placeholder:text-slate-400 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 ' +
  'dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:disabled:bg-slate-800/60';

/**
 * For inputs and textareas only: `:read-only` also matches every <select>
 * (a select is never "read-write" in the spec's sense), so it cannot live in
 * the shared control look.
 */
export const inputClasses =
  `${controlClasses} read-only:bg-slate-50 read-only:text-slate-500 ` +
  'dark:read-only:bg-slate-800/60 dark:read-only:text-slate-400';

type ControlSize = 'sm' | 'md' | 'lg';

/* The text size lives here, not in the shared look: Tailwind emits arbitrary
   sizes such as text-[15px] after text-sm and text-base, so a size in the
   shared look would win over every one of these. */
const HEIGHT: Record<ControlSize, string> = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-[15px]',
  lg: 'h-11 text-base',
};

const TEXTAREA_SIZE: Record<'md' | 'lg', string> = {
  md: 'text-[15px]',
  lg: 'text-base',
};

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  controlSize?: ControlSize;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', controlSize = 'md', ...props }, ref) => (
    <input ref={ref} className={`${inputClasses} ${HEIGHT[controlSize]} ${className}`} {...props} />
  ),
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** `lg` for a reading page's larger text, such as the report. */
  controlSize?: 'md' | 'lg';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', controlSize = 'md', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`${inputClasses} ${TEXTAREA_SIZE[controlSize]} min-h-[84px] resize-y py-2 leading-6 custom-scrollbar ${className}`}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  controlSize?: ControlSize;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', controlSize = 'md', children, ...props }, ref) => (
    <div className={`relative ${className}`}>
      <select
        ref={ref}
        className={`${controlClasses} ${HEIGHT[controlSize]} appearance-none pr-9`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
    </div>
  ),
);
Select.displayName = 'Select';

interface FieldProps {
  label: React.ReactNode;
  /** Help under the control. Replaced by `error` when there is one. */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Short note on the label's line, e.g. "Optional" or a unit. */
  aside?: React.ReactNode;
  className?: string;
  /** `lg` labels the larger controls of a reading page, such as the report. */
  size?: 'md' | 'lg';
  /** Receives the id to put on the control, so the label points at it. */
  children: (id: string) => React.ReactNode;
}

/** Label, control, and one line of help — stacked the same way in every form. */
export const Field: React.FC<FieldProps> = ({ label, hint, error, aside, className = '', size = 'md', children }) => {
  const id = useId();
  const small = size === 'lg' ? 'text-sm' : 'text-[13px]';
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={`${size === 'lg' ? 'text-[15px]' : 'text-sm'} font-medium text-slate-700 dark:text-slate-300`}>
          {label}
        </label>
        {aside && <span className={`${small} text-slate-500 dark:text-slate-400`}>{aside}</span>}
      </div>
      {children(id)}
      {error ? (
        <p className={`mt-1.5 ${small} text-rose-600 dark:text-rose-400`}>{error}</p>
      ) : hint ? (
        <p className={`mt-1.5 ${small} leading-5 text-slate-500 dark:text-slate-400`}>{hint}</p>
      ) : null}
    </div>
  );
};
