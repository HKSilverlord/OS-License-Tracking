import React, { useCallback, useState } from 'react';

interface PageProps {
  title: React.ReactNode;
  /** What this page answers, in one line. */
  description?: React.ReactNode;
  /** Page-wide controls, right of the title: the year, the page's main action. */
  actions?: React.ReactNode;
  /**
   * `scroll` (default): the page scrolls, and from `sm` up the header stays pinned above it.
   * `fill`: the page is exactly the viewport and its content — a table with
   * sticky headers — does its own scrolling.
   */
  layout?: 'scroll' | 'fill';
  /** Cap the content width on reading pages; tables use the full width. */
  maxWidth?: 'default' | 'full';
  children: React.ReactNode;
  /** Extra classes for the content column. */
  className?: string;
  /** `lg` for a page whose sections already carry large headings, so the title stays above them. */
  titleSize?: 'md' | 'lg';
}

const GUTTER = 'px-4 sm:px-6 lg:px-8';

const WIDTH = {
  default: 'mx-auto w-full max-w-[1440px]',
  full: 'w-full',
} as const;

const PageHeading: React.FC<Pick<PageProps, 'title' | 'description' | 'actions' | 'titleSize'>> = ({
  title,
  description,
  actions,
  titleSize = 'md',
}) => (
  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div className="min-w-0">
      <h1
        className={`font-semibold leading-tight tracking-tight text-slate-900 dark:text-white ${
          titleSize === 'lg' ? 'text-[26px] sm:text-[30px]' : 'text-[22px] sm:text-2xl'
        }`}
      >
        {title}
      </h1>
      {description && (
        <p className={`mt-1 text-slate-500 dark:text-slate-400 ${titleSize === 'lg' ? 'text-[15px] leading-6' : 'text-sm leading-6'}`}>
          {description}
        </p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/**
 * Every view's frame: a large title that says where you are, one line on what
 * the page is for, and the page's controls on the same line.
 *
 * On a scrolling page the header pins to the top and turns translucent once
 * content passes under it, with a hairline to mark the edge; at rest it has
 * neither, so an unscrolled page reads as one surface. Not on a phone: there a
 * pinned title, description and controls would hold a fifth of the screen.
 */
export const Page: React.FC<PageProps> = ({
  title,
  description,
  actions,
  layout = 'scroll',
  maxWidth = 'default',
  children,
  className = '',
  titleSize = 'md',
}) => {
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop > 2;
    setScrolled(prev => (prev === next ? prev : next));
  }, []);

  if (layout === 'fill') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className={`shrink-0 pb-4 pt-5 sm:pt-6 ${GUTTER}`}>
          <div className={WIDTH[maxWidth]}>
            <PageHeading title={title} description={description} actions={actions} titleSize={titleSize} />
          </div>
        </header>
        <div className={`flex min-h-0 flex-1 flex-col pb-4 sm:pb-6 ${GUTTER}`}>
          <div className={`${WIDTH[maxWidth]} flex min-h-0 flex-1 flex-col gap-4 ${className}`}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" onScroll={handleScroll}>
      <header
        className={`z-20 pb-4 pt-5 sm:sticky sm:top-0 transition-[background-color,box-shadow] duration-200 sm:pt-6 ${GUTTER} ${
          scrolled
            ? 'bg-slate-50/80 backdrop-blur-xl sm:shadow-[0_1px_0_0_rgb(15_23_42/0.07)] dark:bg-slate-950/80 sm:dark:shadow-[0_1px_0_0_rgb(255_255_255/0.06)]'
            : 'bg-slate-50 dark:bg-slate-950'
        }`}
      >
        <div className={WIDTH[maxWidth]}>
          <PageHeading title={title} description={description} actions={actions} titleSize={titleSize} />
        </div>
      </header>
      <div className={`pb-10 pt-1 ${GUTTER}`}>
        <div className={`${WIDTH[maxWidth]} space-y-5 sm:space-y-6 ${className}`}>{children}</div>
      </div>
    </div>
  );
};
