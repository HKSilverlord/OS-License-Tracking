import React from 'react';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

/**
 * The surface every block of content sits on: white on the slate page, a
 * hairline edge, barely any shadow. One look everywhere, so the eye learns it
 * once and then reads the content, not the containers.
 */
export const cardClasses =
  'rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] ' +
  'dark:border-slate-800 dark:bg-slate-900 dark:shadow-none';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  padding = 'md',
  className = '',
  children,
  ...props
}, ref) => (
  <div ref={ref} className={`${cardClasses} ${PADDING[padding]} ${className}`} {...props}>
    {children}
  </div>
));

Card.displayName = 'Card';

/** A quieter surface for grouping inside a card. */
export const insetClasses = 'rounded-xl bg-slate-50 dark:bg-slate-800/50';

interface CardHeaderProps {
  title: React.ReactNode;
  /** One line on what this block answers. */
  description?: React.ReactNode;
  /** Controls for this block only; page-wide ones belong in the page header. */
  actions?: React.ReactNode;
  className?: string;
  /** Heading level, so a card inside a section can sit one level lower. */
  as?: 'h2' | 'h3';
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
  as: Heading = 'h2',
}) => (
  <div className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-3 ${className}`}>
    <div className="min-w-0">
      <Heading className="text-[15px] font-semibold leading-6 text-slate-900 dark:text-white">{title}</Heading>
      {description && (
        <p className="mt-0.5 text-[13px] leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/**
 * A card title with its year beside it, quieter than the title. Cards get
 * copied into slides, and an image that does not say which year it shows
 * leaves the reader guessing.
 */
export const WithYear: React.FC<{ year: number; children: React.ReactNode }> = ({ year, children }) => (
  <>
    {children}{' '}
    <span className="font-normal tabular-nums text-slate-400 dark:text-slate-500">{year}</span>
  </>
);
