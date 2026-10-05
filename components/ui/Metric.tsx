import React from 'react';

const VALUE_TONE = {
  default: 'text-slate-900 dark:text-white',
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400',
} as const;

export type MetricTone = keyof typeof VALUE_TONE;

interface MeterProps {
  /** Progress as a fraction: 1 is on plan, above 1 is past it. */
  value: number;
  /** Read out by screen readers, e.g. "87% of plan". */
  label?: string;
  className?: string;
}

/**
 * How far along the plan a figure is. Blue while it is on its way, green once
 * the plan is met — the one place the colour changes, because that is the one
 * thing worth noticing.
 */
export const Meter: React.FC<MeterProps> = ({ value, label, className = '' }) => {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const reached = safe >= 1;
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(safe, 1) * 100)}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out-soft ${
          reached ? 'bg-emerald-500' : 'bg-blue-500'
        }`}
        style={{ width: `${Math.min(safe, 1) * 100}%` }}
      />
    </div>
  );
};

interface MetricProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Colours the value by what it means (a loss is red), never for decoration. */
  tone?: MetricTone;
  /** One line under the value: the same figure in 万, or what it is compared with. */
  sub?: React.ReactNode;
  /** Progress towards plan, as a fraction. Draws a meter under the value. */
  meter?: number;
  meterLabel?: string;
  /** Small print: where the number comes from, what it assumes. */
  footnote?: React.ReactNode;
  /** `xl` is for pages read from across a room: its label and small print grow with the figure. */
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  md: { label: 'text-[15px] leading-5', value: 'text-[28px] leading-9', sub: 'text-[15px] leading-5', footnote: 'text-sm leading-5' },
  lg: { label: 'text-[15px] leading-5', value: 'text-[28px] leading-9 sm:text-[32px] sm:leading-10', sub: 'text-[15px] leading-5', footnote: 'text-sm leading-5' },
  xl: { label: 'text-[15px] leading-5', value: 'text-[30px] leading-9', sub: 'text-[15px] leading-6', footnote: 'text-sm leading-5' },
} as const;

/**
 * One number, said plainly: what it is, the figure, and one line of context.
 * The figure is the largest thing in the block and nothing competes with it.
 */
export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  tone = 'default',
  sub,
  meter,
  meterLabel,
  footnote,
  size = 'md',
  className = '',
}) => (
  <div className={`min-w-0 ${className}`}>
    <p className={`${SIZE[size].label} font-medium text-slate-500 dark:text-slate-400`}>{label}</p>
    <p className={`mt-1 font-semibold tracking-tight tabular-nums ${SIZE[size].value} ${VALUE_TONE[tone]}`}>
      {value}
    </p>
    {sub && <p className={`mt-0.5 ${SIZE[size].sub} text-slate-500 tabular-nums dark:text-slate-400`}>{sub}</p>}
    {meter !== undefined && <Meter value={meter} label={meterLabel} className="mt-3" />}
    {footnote && <p className={`mt-2 ${SIZE[size].footnote} text-slate-500 dark:text-slate-400`}>{footnote}</p>}
  </div>
);
