import React, { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  /** Tooltip, and the accessible name when `label` is visually hidden. */
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md' | 'lg';
  /** Stretch the segments to fill the container. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * A small set of mutually exclusive choices, all visible at once: H1/H2, the
 * language, the appearance. The selection slides between segments so the eye
 * follows the change instead of hunting for it.
 *
 * A radio group underneath: one tab stop, arrow keys move the choice.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  const indicatorId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    }
  };

  // lg sits level with a 40px text field in a form row.
  const height = size === 'sm' ? 'h-7 text-xs' : size === 'lg' ? 'h-9 text-sm' : 'h-8 text-[13px]';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`${fullWidth ? 'flex w-full' : 'inline-flex'} items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 ${className}`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={node => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={option.title}
            onClick={() => onChange(option.value)}
            onKeyDown={event => onKeyDown(event, index)}
            className={`relative inline-flex items-center justify-center rounded-md px-3 font-medium transition-colors duration-150 ${height} ${
              fullWidth ? 'flex-1' : ''
            } ${
              selected
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-600 dark:ring-white/10"
                transition={{ type: 'spring', bounce: 0.12, duration: 0.32 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5 whitespace-nowrap">
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
