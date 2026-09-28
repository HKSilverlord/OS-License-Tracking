import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Eye, Loader2, RotateCcw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { useConfirm } from '../contexts/ToastContext';
import { useNumberFormat } from '../hooks/useNumberFormat';
import { useCatiaHydration } from '../hooks/useCatiaHydration';
import { useCatiaStore, computeYearlyCost } from '../stores/useCatiaStore';
import type { CatiaSyncStatus } from '../stores/useCatiaStore';
import { exportTableToCSV, generateCSVFilename } from '../utils/csvExport';
import { ExportButton } from './ExportButton';
import { YearControl } from './YearControl';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card, cardClasses } from './ui/Card';
import { Metric } from './ui/Metric';
import { Page } from './ui/Page';
import { RefreshBar } from './ui/RefreshBar';

interface CatiaLicenseViewProps {
  currentYear: number;
}

interface SheetYear {
  year: number;
  /** The year's first slot in the 52-slot cost array the store keeps per license. */
  start: number;
  months: readonly number[];
}

const FULL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The months the sheet covers: September 2023 to December 2027. */
const SHEET: readonly SheetYear[] = [
  { year: 2023, start: 0, months: [9, 10, 11, 12] },
  { year: 2024, start: 4, months: FULL_YEAR },
  { year: 2025, start: 16, months: FULL_YEAR },
  { year: 2026, start: 28, months: FULL_YEAR },
  { year: 2027, start: 40, months: FULL_YEAR },
];

/** One column of the sheet. `opensYear` draws the rule between two years. */
const SLOTS = SHEET.flatMap(({ year, start, months }) =>
  months.map((month, i) => ({ year, month, index: start + i, opensYear: i === 0 && year !== SHEET[0].year })),
);

const GROUPS = [
  { key: 'purchase', ids: [1, 2, 3, 4] },
  { key: 'lease', ids: [5, 6, 7] },
] as const;

const LICENSE_IDS: readonly number[] = GROUPS.flatMap(group => group.ids);

/* Frozen cells stay opaque while the months slide under them, hover included. */
const SURFACE =
  'bg-white group-hover:bg-slate-50 dark:bg-slate-900 ' +
  'dark:group-hover:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-slate-800)_55%)]';
const CELL = 'group-hover:bg-slate-50 dark:group-hover:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-slate-800)_55%)]';
/* The year picked above the page: the one the figures at the top add up. */
const CELL_SELECTED =
  'bg-blue-50/60 group-hover:bg-blue-50 ' +
  'dark:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-blue-500)_7%)] ' +
  'dark:group-hover:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-blue-500)_12%)]';
const TOTALS = 'bg-slate-50 dark:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-slate-800)_70%)]';
const TOTALS_SELECTED = 'bg-blue-50 dark:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-blue-500)_12%)]';

/* The license and what the row holds stay frozen: without the second, a
   row of figures could be a cost or a revenue. Narrower on a phone. */
const STICKY_LICENSE = 'sticky left-0 z-10';
const LICENSE_WIDTH = 'w-[88px] min-w-[88px] max-w-[88px] sm:w-[136px] sm:min-w-[136px] sm:max-w-[136px]';
const STICKY_KIND = 'sticky left-[88px] z-10 sm:left-[136px]';
const KIND_WIDTH =
  'w-[92px] min-w-[92px] max-w-[92px] whitespace-nowrap px-2 sm:w-[128px] sm:min-w-[128px] sm:max-w-[128px] sm:px-3';
/* Where a year's label waits while its months scroll by: just past the frozen columns. */
const YEAR_LABEL = 'sticky left-[180px] inline-block px-2 sm:left-[264px]';

const HEAD = 'border-b border-slate-200 px-2 text-[12px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400';
const OPAQUE_HEAD = 'bg-white dark:bg-slate-900';
const ROW_END = 'border-b border-slate-100 dark:border-slate-800';
const KIND_EDGE = 'border-r border-r-slate-200 dark:border-r-slate-800';
const YEAR_EDGE = 'border-l border-l-slate-200 dark:border-l-slate-800';
const NUM = 'h-9 px-2 text-[13px] tabular-nums';

const CELL_INPUT =
  'block h-8 w-full rounded-md border-0 bg-transparent px-2 text-[13px] tabular-nums text-slate-700 outline-none ' +
  'transition-[background-color,box-shadow] duration-100 placeholder:text-slate-300 ' +
  'hover:bg-slate-100/70 focus:bg-white focus:ring-2 focus:ring-blue-500/50 ' +
  'aria-invalid:ring-2 aria-invalid:ring-rose-500/60! ' +
  'dark:text-slate-200 dark:placeholder:text-slate-600 dark:hover:bg-slate-800 dark:focus:bg-slate-950 dark:focus:ring-blue-400/50';

const Dash = () => <span className="font-normal text-slate-300 dark:text-slate-600">–</span>;

/** What goes in the box once someone starts editing: up to four decimals, in the language's own mark. */
const exactText = (value: number, decimalMark: string): string =>
  String(Math.round(value * 10000) / 10000).replace('.', decimalMark);

/**
 * What a cell's text means: a number, `null` for a cell that was emptied, or
 * `undefined` for text that is not a number (yet), which leaves the value alone.
 *
 * Either mark counts as the decimal point, since people type the one they are
 * used to whatever language the app is in; the figures are too small to need
 * grouping, so neither is read as a thousands separator.
 */
const parseCell = (raw: string): number | null | undefined => {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^-?(\d+[.,]?\d*|[.,]\d+)$/.test(text)) return undefined;
  return Number(text.replace(',', '.'));
};

/** Enter walks down the licenses in a column, Shift+Enter back up, as in the Excel sheet this replaced. */
const walkColumn = (from: HTMLInputElement, step: 1 | -1) => {
  const column = from.dataset.catiaColumn;
  if (!column) return;
  const cells = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-catia-column="${column}"]`));
  cells[cells.indexOf(from) + step]?.focus();
};

interface FigureCellProps {
  value: number | null;
  editable: boolean;
  /** Read out for the input: the license, the row and the month or year. */
  label: string;
  /** Cells sharing a column key are what Enter walks between. */
  column: string;
  align?: 'right' | 'center';
  format: (value: number) => string;
  decimalMark: string;
  onCommit: (value: number | null) => void;
}

/**
 * One figure of the sheet: text for a viewer, a box for an admin.
 *
 * The box shows the rounded figure until it is focused, then the exact one, so
 * 20.8333 reads as 20.8 in the table but is not silently rounded by an edit.
 * Each keystroke that makes a number is committed at once (the store saves it
 * shortly after), and Esc puts back what was there when the box was entered.
 */
const FigureCell: React.FC<FigureCellProps> = ({
  value,
  editable,
  label,
  column,
  align = 'right',
  format,
  decimalMark,
  onCommit,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const enteredWithRef = useRef<number | null>(null);

  const shown = value === null ? null : format(value);
  const exact = value === null ? null : exactText(value, decimalMark);
  // Only worth a tooltip when rounding hid something.
  const title = exact !== null && exact !== shown ? exact : undefined;
  const alignClass = align === 'center' ? 'text-center' : 'text-right';

  if (!editable) {
    return (
      <span title={title} className={`block px-2 text-[13px] leading-8 tabular-nums text-slate-700 dark:text-slate-200 ${alignClass}`}>
        {shown ?? <Dash />}
      </span>
    );
  }

  const invalid = draft !== null && parseCell(draft) === undefined;

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      data-catia-column={column}
      aria-label={label}
      aria-invalid={invalid || undefined}
      title={title}
      placeholder="–"
      value={draft ?? shown ?? ''}
      onFocus={event => {
        enteredWithRef.current = value;
        setDraft(exact ?? '');
        // After the exact figure has replaced the rounded one.
        const input = event.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onBlur={() => setDraft(null)}
      onChange={event => {
        const raw = event.target.value;
        setDraft(raw);
        const next = parseCell(raw);
        if (next !== undefined && next !== value) onCommit(next);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          walkColumn(event.currentTarget, event.shiftKey ? -1 : 1);
        } else if (event.key === 'Escape') {
          const before = enteredWithRef.current;
          if (before !== value) onCommit(before);
          setDraft(before === null ? '' : exactText(before, decimalMark));
        }
      }}
      className={`${CELL_INPUT} ${alignClass} ${align === 'center' ? 'mx-auto max-w-36' : ''}`}
    />
  );
};

/** Where the shared sheet stands: loading, saving, saved, or out of step with the server. */
const SyncState: React.FC<{
  status: CatiaSyncStatus;
  error: string | null;
  isAdmin: boolean;
  justSaved: boolean;
  onRetry: () => void;
}> = ({ status, error, isAdmin, justSaved, onRetry }) => {
  const { t } = useLanguage();

  if (status === 'loading' || status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-500 dark:text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {status === 'loading' ? t('catia.syncing', 'Getting the latest figures…') : t('catia.saving', 'Saving…')}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span title={error ?? undefined}>{t('catia.syncError', 'Not synced — showing the copy on this device')}</span>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {t('buttons.retry', 'Try again')}
        </Button>
      </span>
    );
  }
  if (!isAdmin) {
    return (
      <Badge tone="neutral">
        <Eye className="h-3 w-3" aria-hidden="true" />
        {t('common.viewOnly', 'View only')}
      </Badge>
    );
  }
  if (justSaved) {
    return (
      <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-emerald-600 animate-fade-in dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {t('tracker.autosaved', 'Saved')}
      </span>
    );
  }
  return null;
};

export const CatiaLicenseView: React.FC<CatiaLicenseViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();
  const { formatDecimal, formatYen, localeTag } = useNumberFormat();
  const { isAdmin, role } = useUserRole();
  const confirm = useConfirm();

  // Value selectors only: selecting the stable `getYearlyCost` function is what
  // once stopped consumers re-rendering when CATIA data changed.
  const licenseCosts = useCatiaStore(s => s.licenseCosts);
  const licenseRevenues = useCatiaStore(s => s.licenseRevenues);
  const updateCost = useCatiaStore(s => s.updateCost);
  const updateRevenue = useCatiaStore(s => s.updateRevenue);
  const resetToDefaults = useCatiaStore(s => s.resetToDefaults);
  const retry = useCatiaStore(s => s.retry);
  const syncStatus = useCatiaStore(s => s.syncStatus);
  const syncError = useCatiaStore(s => s.syncError);

  useCatiaHydration();

  // The flush lives on its own unmount-only effect so a role change never fires
  // a save mid-session.
  useEffect(() => () => {
    void useCatiaStore.getState().flush();
  }, []);

  // "Saved" answers the save that just finished; it goes as soon as anything else happens.
  const [previousStatus, setPreviousStatus] = useState(syncStatus);
  const [justSaved, setJustSaved] = useState(false);
  if (previousStatus !== syncStatus) {
    setPreviousStatus(syncStatus);
    setJustSaved(previousStatus === 'saving' && syncStatus === 'idle');
  }

  const decimalMark = useMemo(
    () => new Intl.NumberFormat(localeTag).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.',
    [localeTag],
  );

  // An edit made while the server copy is on its way would be overwritten by it.
  const editable = isAdmin && syncStatus !== 'loading';
  const covered = SHEET.some(y => y.year === currentYear);

  const licenseName = (id: number) => `${t('catia.license', 'License')} ${id}`;
  const costMonthLabel = t('catia.row.costMonth', 'Cost/month');
  const costYearLabel = t('catia.row.costYear', 'Cost/year');
  const revenueYearLabel = t('catia.row.revenueYear', 'Revenue/year');
  const groupLabel = (key: (typeof GROUPS)[number]['key']) =>
    key === 'purchase' ? t('catia.purchase', 'Purchased') : t('catia.lease', 'Leased');

  // Sums in 万円, as the sheet shows them. `null` where nothing was entered at all.
  const sumOf = (values: readonly (number | null | undefined)[]): number | null =>
    values.some(v => v !== null && v !== undefined)
      ? values.reduce<number>((sum, v) => sum + (v ?? 0), 0)
      : null;
  const monthTotal = (index: number) => sumOf(LICENSE_IDS.map(id => licenseCosts[id]?.[index]));
  const yearCost = (y: SheetYear) =>
    sumOf(LICENSE_IDS.flatMap(id => y.months.map((_, i) => licenseCosts[id]?.[y.start + i])));
  const yearRevenue = (year: number) => sumOf(LICENSE_IDS.map(id => licenseRevenues[id]?.[year]));

  // The summary is in yen, like the Dashboard it feeds. A year whose revenue
  // nobody has entered has no revenue figure, and so no net either: showing
  // ¥0 and a loss the size of the cost would read as a fact.
  const costYen = computeYearlyCost(licenseCosts, currentYear);
  const revenueMan = yearRevenue(currentYear);
  const revenueYen = revenueMan === null ? null : Math.round(revenueMan * 10000);
  const netYen = revenueYen === null ? null : revenueYen - costYen;
  const manYen = t('catia.manYenUnit', '万');
  const toMan = (yen: number) => `${formatDecimal(yen / 10000)}${manYen}`;

  // Opening the page, or picking another year, brings that year's months into
  // view beside the frozen columns: they are the months the summary adds up.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef(false);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const heading = scroller?.querySelector<HTMLElement>(`[data-year-head="${currentYear}"]`);
    if (!scroller || !heading) return;
    const box = scroller.getBoundingClientRect();
    const frozen = Array.from(scroller.querySelectorAll<HTMLElement>('[data-frozen]'))
      .reduce((edge, el) => Math.max(edge, el.getBoundingClientRect().right - box.left), 0);
    const left = heading.getBoundingClientRect().left - box.left + scroller.scrollLeft - frozen;
    const glide = placedRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: Math.max(0, left), behavior: glide ? 'smooth' : 'auto' });
    placedRef.current = true;
  }, [currentYear]);

  const handleReset = async () => {
    const confirmed = await confirm({
      title: t('catia.resetTitle', 'Reset the license sheet?'),
      message: t(
        'catia.resetMessage',
        'Every cost and revenue goes back to the figures of the original spreadsheet, for everyone. This cannot be undone.',
      ),
      confirmLabel: t('catia.resetConfirmLabel', 'Reset sheet'),
      danger: true,
    });
    if (confirmed) resetToDefaults();
  };

  // Revenue is kept per year; like a merged cell in Excel, it goes under the year's first month.
  const handleExportCsv = () => {
    const csvNumber = (value: number | null | undefined) =>
      value === null || value === undefined ? '' : String(Math.round(value * 10000) / 10000);
    const headers = [
      t('catia.license', 'License'),
      t('catia.type', 'Type'),
      `${t('catia.figure', 'Figure')} (${t('catia.unit', '10,000 JPY')})`,
      ...SLOTS.map(slot => `${slot.year}-${String(slot.month).padStart(2, '0')}`),
    ];
    const rows: string[][] = [];
    GROUPS.forEach(group => {
      group.ids.forEach(id => {
        const costs = licenseCosts[id] ?? [];
        rows.push([licenseName(id), groupLabel(group.key), costMonthLabel, ...SLOTS.map(slot => csvNumber(costs[slot.index]))]);
        rows.push([
          licenseName(id),
          groupLabel(group.key),
          revenueYearLabel,
          ...SLOTS.map(slot =>
            SHEET.some(y => y.start === slot.index) ? csvNumber(licenseRevenues[id]?.[slot.year]) : '',
          ),
        ]);
      });
    });
    exportTableToCSV(headers, rows, generateCSVFilename('catia_licenses'));
  };

  const thisMonth = (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  /** The three rows of totals; `edge` closes the band under the last one. */
  const totalRows: { key: string; label: string; cells: (edge: string) => React.ReactNode }[] = [
    {
      key: 'costMonth',
      label: costMonthLabel,
      cells: edge => SLOTS.map(slot => {
        const total = monthTotal(slot.index);
        return (
          <td
            key={slot.index}
            className={`${NUM} ${edge} text-right font-medium text-slate-900 dark:text-white ${slot.opensYear ? YEAR_EDGE : ''} ${
              slot.year === currentYear ? TOTALS_SELECTED : TOTALS
            }`}
          >
            {total === null ? <Dash /> : formatDecimal(total)}
          </td>
        );
      }),
    },
    {
      key: 'costYear',
      label: costYearLabel,
      cells: edge => SHEET.map((y, i) => {
        const total = yearCost(y);
        return (
          <td
            key={y.year}
            colSpan={y.months.length}
            className={`${NUM} ${edge} text-center font-semibold text-slate-900 dark:text-white ${i > 0 ? YEAR_EDGE : ''} ${
              y.year === currentYear ? TOTALS_SELECTED : TOTALS
            }`}
          >
            {total === null ? <Dash /> : formatDecimal(total)}
          </td>
        );
      }),
    },
    {
      key: 'revenueYear',
      label: revenueYearLabel,
      cells: edge => SHEET.map((y, i) => {
        const total = yearRevenue(y.year);
        return (
          <td
            key={y.year}
            colSpan={y.months.length}
            className={`${NUM} ${edge} text-center font-semibold text-slate-900 dark:text-white ${i > 0 ? YEAR_EDGE : ''} ${
              y.year === currentYear ? TOTALS_SELECTED : TOTALS
            }`}
          >
            {total === null ? <Dash /> : formatDecimal(total)}
          </td>
        );
      }),
    },
  ];

  return (
    <Page
      title={t('nav.catiaLicense', 'CATIA licenses')}
      description={t('catia.desc', 'What each license costs a month, and what it brings in a year')}
      actions={<YearControl />}
      maxWidth="full"
    >
      {/* The year in three figures: what the licenses cost, what they earned, and the difference. */}
      <Card padding="lg" className="animate-fade-up">
        {covered ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 min-[560px]:grid-cols-3">
            <Metric
              size="lg"
              label={t('catia.metric.cost', 'Cost in {year}').replace('{year}', String(currentYear))}
              value={formatYen(costYen)}
              sub={toMan(costYen)}
              footnote={t('catia.costNote', 'The Dashboard uses this figure')}
            />
            <Metric
              size="lg"
              label={t('catia.metric.revenue', 'Revenue in {year}').replace('{year}', String(currentYear))}
              value={revenueYen === null ? '–' : formatYen(revenueYen)}
              sub={revenueYen === null ? t('catia.notEntered', 'Not entered yet') : toMan(revenueYen)}
            />
            <Metric
              size="lg"
              label={t('catia.metric.net', 'Net in {year}').replace('{year}', String(currentYear))}
              value={netYen === null ? '–' : formatYen(netYen)}
              tone={netYen !== null && netYen < 0 ? 'negative' : 'default'}
              sub={netYen === null ? undefined : toMan(netYen)}
              footnote={t('catia.netNote', 'Revenue minus cost')}
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t(
              'catia.outOfRange',
              'The license sheet runs from September 2023 to December 2027, so it has nothing for {year}.',
            ).replace('{year}', String(currentYear))}
          </p>
        )}
      </Card>

      <section
        aria-label={t('catia.tableLabel', 'License sheet')}
        className={`${cardClasses} overflow-hidden animate-fade-up [animation-delay:40ms]`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            {t('catia.unitNote', 'Figures in 10,000 JPY')}
            {isAdmin && (
              <span className="hidden sm:inline">
                {' · '}
                {t('catia.editHint', 'Changes save as you type')}
              </span>
            )}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <div aria-live="polite" className="flex items-center">
              <SyncState
                status={syncStatus}
                error={syncError}
                isAdmin={isAdmin}
                justSaved={justSaved}
                onRetry={() => void retry({ canSeed: role === 'admin' })}
              />
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={syncStatus === 'loading'}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('catia.resetDefaults', 'Reset to defaults')}
              </Button>
            )}
            <ExportButton
              targetId="catia-license-table"
              filename="catia_licenses"
              onExportCsv={handleExportCsv}
              allowSvg={false}
            />
          </div>
        </div>
        {syncStatus === 'loading' && <RefreshBar />}

        {/* The scroll padding keeps a focused cell out from under the frozen columns. */}
        <div ref={scrollerRef} className="relative isolate scroll-pl-[180px] overflow-x-auto custom-scrollbar sm:scroll-pl-[264px]">
          <table id="catia-license-table" className="w-full min-w-max border-separate border-spacing-0">
            {/* On screen the page says what this is; an exported image has no page around it. */}
            <caption hidden data-export-only className="caption-top px-3 pb-3 pt-1 text-left text-[15px] font-semibold text-slate-900 dark:text-white">
              {t('nav.catiaLicense', 'CATIA licenses')}{' '}
              <span className="font-normal tabular-nums text-slate-500 dark:text-slate-400">
                {SHEET[0].year}–{SHEET[SHEET.length - 1].year} · {t('catia.unitNote', 'Figures in 10,000 JPY')}
              </span>
            </caption>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  data-frozen
                  className={`${HEAD} ${OPAQUE_HEAD} ${STICKY_LICENSE} ${LICENSE_WIDTH} px-3 pb-2 text-left align-bottom`}
                >
                  {t('catia.license', 'License')}
                </th>
                <th rowSpan={2} scope="col" data-frozen className={`${HEAD} ${OPAQUE_HEAD} ${STICKY_KIND} ${KIND_WIDTH} ${KIND_EDGE}`}>
                  <span className="sr-only">{t('catia.figure', 'Figure')}</span>
                </th>
                {SHEET.map((y, i) => {
                  const selected = y.year === currentYear;
                  return (
                    <th
                      key={y.year}
                      scope="colgroup"
                      colSpan={y.months.length}
                      data-year-head={y.year}
                      className={`h-9 px-0 text-left text-[13px] tabular-nums ${i > 0 ? YEAR_EDGE : ''} ${
                        selected
                          ? 'bg-blue-50/60 font-semibold text-blue-700 dark:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-blue-500)_7%)] dark:text-blue-300'
                          : 'font-medium text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={YEAR_LABEL}>{y.year}</span>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {SLOTS.map(slot => {
                  const now = slot.year === thisMonth.year && slot.month === thisMonth.month;
                  return (
                    <th
                      key={slot.index}
                      scope="col"
                      aria-current={now ? 'date' : undefined}
                      title={now ? t('tracker.thisMonth', 'This month') : undefined}
                      className={`${HEAD} h-8 w-[56px] min-w-[56px] text-right font-normal tabular-nums ${
                        slot.opensYear ? YEAR_EDGE : ''
                      } ${slot.year === currentYear ? CELL_SELECTED : ''} ${
                        now ? 'font-medium text-orange-600! dark:text-orange-400!' : ''
                      }`}
                    >
                      {now && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" aria-hidden="true" />}
                      {slot.month}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* All licenses together first: the figures most people came for. */}
            <tbody>
              {totalRows.map((row, i) => {
                const last = i === totalRows.length - 1;
                const edge = last ? 'border-b border-slate-200 dark:border-slate-700' : '';
                return (
                  <tr key={row.key}>
                    {i === 0 && (
                      <th
                        scope="rowgroup"
                        rowSpan={totalRows.length}
                        className={`${TOTALS} ${STICKY_LICENSE} ${LICENSE_WIDTH} border-b border-slate-200 px-3 py-2 text-left align-top text-[13px] font-semibold text-slate-900 dark:border-slate-700 dark:text-white`}
                      >
                        {t('catia.allLicenses', 'All licenses')}
                      </th>
                    )}
                    <th
                      scope="row"
                      className={`${TOTALS} ${STICKY_KIND} ${KIND_WIDTH} ${KIND_EDGE} ${edge} text-left text-[11px] sm:text-[12px] font-medium text-slate-500 dark:text-slate-400`}
                    >
                      {row.label}
                    </th>
                    {row.cells(edge)}
                  </tr>
                );
              })}
            </tbody>

            {GROUPS.map(group => (
              <React.Fragment key={group.key}>
                <tbody>
                  <tr>
                    <th
                      colSpan={2 + SLOTS.length}
                      className="border-b border-slate-200 px-0 pb-2 pt-5 text-left text-[12px] font-semibold text-slate-900 dark:border-slate-800 dark:text-white"
                    >
                      <span className="sticky left-0 inline-block px-3">{groupLabel(group.key)}</span>
                    </th>
                  </tr>
                </tbody>
                {group.ids.map(id => {
                  const costs = licenseCosts[id] ?? [];
                  const name = licenseName(id);
                  return (
                    <tbody key={id} className="group">
                      <tr>
                        <th
                          scope="rowgroup"
                          rowSpan={2}
                          className={`${SURFACE} ${STICKY_LICENSE} ${LICENSE_WIDTH} ${ROW_END} px-3 py-2 text-left align-top text-[13px] font-medium text-slate-900 dark:text-white`}
                        >
                          {name}
                        </th>
                        <th
                          scope="row"
                          className={`${SURFACE} ${STICKY_KIND} ${KIND_WIDTH} ${KIND_EDGE} text-left text-[11px] sm:text-[12px] font-normal text-slate-500 dark:text-slate-400`}
                        >
                          {costMonthLabel}
                        </th>
                        {SLOTS.map(slot => (
                          <td
                            key={slot.index}
                            className={`p-0.5 ${slot.opensYear ? YEAR_EDGE : ''} ${slot.year === currentYear ? CELL_SELECTED : CELL}`}
                          >
                            <FigureCell
                              value={costs[slot.index] ?? null}
                              editable={editable}
                              label={`${name}, ${costMonthLabel}, ${slot.year}/${slot.month}`}
                              column={`cost-${slot.index}`}
                              format={formatDecimal}
                              decimalMark={decimalMark}
                              onCommit={next => updateCost(id, slot.index, next)}
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th
                          scope="row"
                          className={`${SURFACE} ${STICKY_KIND} ${KIND_WIDTH} ${KIND_EDGE} ${ROW_END} text-left text-[11px] sm:text-[12px] font-normal text-slate-500 dark:text-slate-400`}
                        >
                          {revenueYearLabel}
                        </th>
                        {SHEET.map((y, i) => (
                          <td
                            key={y.year}
                            colSpan={y.months.length}
                            className={`${ROW_END} p-0.5 ${i > 0 ? YEAR_EDGE : ''} ${y.year === currentYear ? CELL_SELECTED : CELL}`}
                          >
                            <FigureCell
                              value={licenseRevenues[id]?.[y.year] ?? null}
                              editable={editable}
                              label={`${name}, ${revenueYearLabel}, ${y.year}`}
                              column={`revenue-${y.year}`}
                              align="center"
                              format={formatDecimal}
                              decimalMark={decimalMark}
                              onCommit={next => updateRevenue(id, y.year, next)}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  );
                })}
              </React.Fragment>
            ))}
          </table>
        </div>
      </section>
    </Page>
  );
};
