import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { Project, MonthlyRecord } from '../types';
import { dbService } from '../services/dbService';
import { buildPriceIndex, lookupPrices } from '../services/pricing';
import type { PriceIndex } from '../services/pricing';
import { exportTableToCSV, generateCSVFilename } from '../utils/csvExport';
import { plural } from '../utils/plural';
import { createLogger } from '../utils/logger';
import { useLanguage } from '../contexts/LanguageContext';
import { useNumberFormat, localeTagFor } from '../hooks/useNumberFormat';
import { useToast } from '../contexts/ToastContext';
import { ExportButton } from './ExportButton';
import { YearControl, YearExportButton } from './YearControl';
import { buttonClasses } from './ui/buttonClasses';
import { Card, cardClasses, WithYear } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Page } from './ui/Page';
import { RefreshBar } from './ui/RefreshBar';
import { Skeleton } from './ui/Skeleton';

const log = createLogger('YearlyDataView');

interface YearlyDataViewProps {
  currentYear: number;
}

/** Revenue of one project for the whole year, priced per (period, project). */
interface ProjectRevenue {
  plan: number;
  actual: number;
}

const EMPTY_PRICE_INDEX: PriceIndex = buildPriceIndex([], []);

/** Referentially stable so hooks that map over it can list it as a dependency. */
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Column widths in px, matching Project tracking so the two tables read alike. */
const W = { no: 48, month: 76, total: 88, revenue: 124 } as const;

/* Frozen cells stay opaque while the months slide under them, hover included. */
const SURFACE =
  'bg-white group-hover:bg-slate-50 dark:bg-slate-900 ' +
  'dark:group-hover:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-slate-800)_55%)]';
/* The year's totals: a quieter band pinned under the column headings. */
const TOTALS = 'bg-slate-50 dark:bg-[color-mix(in_oklab,var(--color-slate-900),var(--color-slate-800)_70%)]';

/* The project name and Plan/Actual stay frozen, so a row always says what it
   is; from `sm` up, No. does too. The offsets are the widths before each. */
const STICKY_NO = 'sm:sticky sm:left-0 sm:z-10';
const STICKY_NAME = 'sticky left-0 z-10 sm:left-[48px]';
const NAME_WIDTH = 'w-[128px] min-w-[128px] max-w-[128px] sm:w-[224px] sm:min-w-[224px] sm:max-w-[224px]';
const STICKY_KIND = 'sticky left-[128px] z-10 sm:left-[272px]';
const KIND_WIDTH = 'w-[72px] min-w-[72px] sm:w-[96px] sm:min-w-[96px]';

const HEAD =
  'h-10 border-b border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-500 ' +
  'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';

const ROW_END = 'border-b border-slate-100 dark:border-slate-800';
const NUM = 'px-2 py-1.5 text-right text-[13px] tabular-nums';

const Dash = () => <span className="font-normal text-slate-300 dark:text-slate-600">–</span>;

export const YearlyDataView: React.FC<YearlyDataViewProps> = ({ currentYear }) => {
  const { t, language } = useLanguage();
  const { format: nf } = useNumberFormat();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<Record<string, MonthlyRecord[]>>({});
  // Per-(period, project) prices for the whole year — fetched in ONE request (A5).
  const [priceIndex, setPriceIndex] = useState<PriceIndex>(EMPTY_PRICE_INDEX);
  const [periodLabels, setPeriodLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  /** A failed load used to leave a table of dashes behind a toast nobody saw. */
  const [loadError, setLoadError] = useState(false);
  /** After the first year has landed, later loads refresh in place. */
  const loadedOnceRef = useRef(false);

  // Years can change faster than a request completes; the sequence number
  // drops any response that is no longer for the year on screen.
  const loadSeqRef = useRef(0);

  // `t` is read through a ref so a language switch does not refetch the year.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /**
   * `silent` keeps the table on screen while the request runs.
   *
   * Saving hours in another view fires `dataUpdated`, and refetching loudly
   * meant a save in Tracking wiped this whole table back to a skeleton.
   */
  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    const seq = ++loadSeqRef.current;
    if (!options?.silent) setLoading(true);
    try {
      // A5: one year-scoped call replaces getPeriods() + getProjects(period) per period.
      // A1: `yearPrices.index` resolves the price of a (period_label, project_id) pair, so a
      // project priced differently in H1 and H2 keeps BOTH prices instead of the last one won.
      const [yearPrices, recordsData] = await Promise.all([
        dbService.getYearProjectPrices(currentYear),
        dbService.getAllRecords(currentYear)
      ]);

      const relevantProjects = [...yearPrices.projects];

      const groupedRecords: Record<string, MonthlyRecord[]> = {};
      recordsData.forEach(r => {
        if (!groupedRecords[r.project_id]) groupedRecords[r.project_id] = [];
        groupedRecords[r.project_id].push(r);
      });

      // Projects with hours first, each group in the order set in Project tracking.
      relevantProjects.sort((a, b) => {
        const aTotal = Object.values(groupedRecords[a.id] ?? {})
          .reduce((s, r) => s + (r.planned_hours ?? 0) + (r.actual_hours ?? 0), 0);
        const bTotal = Object.values(groupedRecords[b.id] ?? {})
          .reduce((s, r) => s + (r.planned_hours ?? 0) + (r.actual_hours ?? 0), 0);
        if (aTotal > 0 && bTotal === 0) return -1;
        if (aTotal === 0 && bTotal > 0) return 1;
        return (a.display_order ?? 999) - (b.display_order ?? 999);
      });

      if (seq !== loadSeqRef.current) return; // superseded by a newer year
      setProjects(relevantProjects);
      setRecords(groupedRecords);
      setPriceIndex(yearPrices.index);
      setPeriodLabels(yearPrices.periodLabels);
      setLoadError(false);
      loadedOnceRef.current = true;
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      log.error('Failed to load data for Yearly Data View', error);
      setLoadError(true);
      toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [currentYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // In place: an edit somewhere else must not blank the table being read.
    const handleDataUpdated = () => fetchData({ silent: true });
    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => window.removeEventListener('dataUpdated', handleDataUpdated);
  }, [fetchData]);

  /**
   * A1/A2 — revenue is summed PER RECORD, priced with the (period_label, project_id) price.
   * A project at 2,500 JPY/h in 2025-H1 and 2,300 JPY/h in 2025-H2 yields
   * H1 hours x 2,500 + H2 hours x 2,300, which is what the Dashboard KPI and the Excel
   * TOTAL row compute from the same index.
   */
  const projectRevenues = useMemo(() => {
    const totals: Record<string, ProjectRevenue> = {};
    projects.forEach(project => {
      let plan = 0;
      let actual = 0;
      (records[project.id] || []).forEach(rec => {
        const prices = lookupPrices(priceIndex, rec.period_label, project.id);
        plan += (rec.planned_hours || 0) * prices.plan;
        actual += (rec.actual_hours || 0) * prices.actual;
      });
      totals[project.id] = { plan, actual };
    });
    return totals;
  }, [projects, records, priceIndex]);

  const yearRevenue = useMemo(
    () => Object.values(projectRevenues).reduce(
      (sum, r) => ({ plan: sum.plan + r.plan, actual: sum.actual + r.actual }),
      { plan: 0, actual: 0 }
    ),
    [projectRevenues]
  );

  /**
   * The per-period prices behind a revenue figure, but only when the periods
   * of the year disagree — the case a single price would hide.
   */
  const priceBreakdown = (projectId: string, kind: 'plan' | 'actual'): string | undefined => {
    if (periodLabels.length < 2) return undefined;
    const entries = periodLabels.map(label => ({
      label,
      value: lookupPrices(priceIndex, label, projectId)[kind],
    }));
    const distinct = new Set(entries.map(e => e.value));
    if (distinct.size < 2) return undefined;
    const unit = t('unit.yenPerHour', 'JPY/h');
    return entries.map(e => `${e.label}: ${nf(e.value)} ${unit}`).join(' / ');
  };

  const hasSplitPrices = projects.some(project =>
    priceBreakdown(project.id, 'plan') !== undefined || priceBreakdown(project.id, 'actual') !== undefined
  );

  const monthlyTotals = useMemo(() => months.map(m => {
    let plan = 0;
    let actual = 0;
    projects.forEach(project => {
      const rec = (records[project.id] || []).find(r => r.month === m);
      if (rec) {
        plan += rec.planned_hours || 0;
        actual += rec.actual_hours || 0;
      }
    });
    return { month: m, plan, actual };
  }), [projects, records]);

  const accumulatedTotals = useMemo(() => {
    let runningPlan = 0;
    let runningActual = 0;
    return monthlyTotals.map(mt => {
      runningPlan += mt.plan;
      runningActual += mt.actual;
      return { month: mt.month, accPlan: runningPlan, accActual: runningActual };
    });
  }, [monthlyTotals]);

  const yearPlan = monthlyTotals.reduce((sum, m) => sum + m.plan, 0);
  const yearActual = monthlyTotals.reduce((sum, m) => sum + m.actual, 0);

  const planLabel = t('tracker.planShort', 'Plan');
  const actualLabel = t('tracker.actualShort', 'Actual');
  const thisMonth = new Date().getFullYear() === currentYear ? new Date().getMonth() + 1 : null;

  const formatMonthLabel = (month: number) => {
    if (language === 'ja') return `${month}月`;
    if (language === 'vn') return `Tháng ${month}`;
    return new Date(2000, month - 1).toLocaleString(localeTagFor(language), { month: 'short' });
  };

  // The CSV is built here because its headings are translated.
  const handleExportCSV = () => {
    const headers = [
      t('tracker.code', 'Code'),
      t('tracker.projectName', 'Company name'),
      t('tracker.rowKind', 'Plan or actual'),
      ...months.map(m => m.toString()),
      t('tracker.total', 'Total'),
      t('totalView.tableHeader.revenue', 'Revenue (JPY)'),
    ];

    const rows: string[][] = [];
    projects.forEach(project => {
      const projRecords = records[project.id] || [];
      const monthlyData = months.map(m => {
        const r = projRecords.find(rec => rec.month === m);
        return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
      });
      const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
      const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);
      const revenue = projectRevenues[project.id] ?? { plan: 0, actual: 0 };

      rows.push([
        project.code,
        project.name,
        planLabel,
        ...monthlyData.map(d => d.plan > 0 ? d.plan.toString() : '-'),
        totalPlan > 0 ? totalPlan.toString() : '-',
        revenue.plan > 0 ? revenue.plan.toString() : '-',
      ]);
      rows.push([
        project.code,
        project.name,
        actualLabel,
        ...monthlyData.map(d => d.actual > 0 ? d.actual.toString() : '-'),
        totalActual > 0 ? totalActual.toString() : '-',
        revenue.actual > 0 ? revenue.actual.toString() : '-',
      ]);
    });

    exportTableToCSV(headers, rows, generateCSVFilename(`yearly_data_${currentYear}`));
  };

  const header = {
    title: t('nav.yearlyData', 'Annual data'),
    description: t('yearly.desc', 'Hours and revenue of every project, month by month'),
    actions: (
      <>
        <YearControl />
        <YearExportButton />
      </>
    ),
  };

  if (loading && !loadedOnceRef.current) {
    return (
      <Page {...header} layout="fill" maxWidth="full">
        <Card padding="none" className="p-4" role="status" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
          <Skeleton.Table rows={8} cols={8} />
        </Card>
      </Page>
    );
  }

  // Without a guard the table still draws its header and four total rows, all
  // reading `–`, which is what a broken year looks like too.
  if (loadError && !loading) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            tone="error"
            title={t('empty.loadFailedTitle', 'Could not load this year')}
            description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
            actions={
              <button type="button" onClick={() => fetchData()} className={buttonClasses('secondary')}>
                {t('buttons.retry', 'Try again')}
              </button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (projects.length === 0 && !loading) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={t('empty.noDataTitle', 'No hours recorded for {year} yet').replace('{year}', String(currentYear))}
            description={t('empty.noDataHint', 'Enter planned and actual hours in Project tracking, or choose another year.')}
            actions={
              <Link to="/tracking" className={buttonClasses('secondary')}>
                {t('empty.goToTracking', 'Go to Project tracking')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </Card>
      </Page>
    );
  }

  const totalRows: { key: string; label: string; strong: boolean; values: number[]; total?: number; revenue?: number }[] = [
    { key: 'plan', label: planLabel, strong: false, values: monthlyTotals.map(m => m.plan), total: yearPlan, revenue: yearRevenue.plan },
    { key: 'actual', label: actualLabel, strong: true, values: monthlyTotals.map(m => m.actual), total: yearActual, revenue: yearRevenue.actual },
    { key: 'accPlan', label: t('dashboard.chart.accPlan', 'Cumulative plan'), strong: false, values: accumulatedTotals.map(m => m.accPlan) },
    { key: 'accActual', label: t('dashboard.chart.accActual', 'Cumulative actual'), strong: true, values: accumulatedTotals.map(m => m.accActual) },
  ];

  return (
    <Page {...header} layout="fill" maxWidth="full">
      <section
        aria-label={t('totalView.tableHeader.title', 'Annual data table')}
        className={`${cardClasses} flex min-h-0 flex-1 flex-col overflow-hidden animate-fade-up`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            {plural(t, 'yearly.projectCount', projects.length, '{count} projects')}
            {hasSplitPrices && (
              <span className="hidden md:inline">
                {' · '}
                {t('yearly.splitPrices', 'Some prices change between periods; point at a revenue figure to see them')}
              </span>
            )}
          </p>
          {/* No SVG: the target is an HTML table, not a chart. */}
          <ExportButton
            targetId="yearly-data-table"
            filename={`yearly_data_${currentYear}`}
            onExportCsv={handleExportCSV}
            allowSvg={false}
            disabled={loading}
          />
        </div>
        {loading && <RefreshBar />}

        {/* The old year stays readable while the new one loads; it is dimmed so
            nobody reads it as the year they just picked. */}
        <div className={`relative isolate min-h-0 flex-1 overflow-auto custom-scrollbar transition-opacity duration-200 ${loading ? 'opacity-40' : ''}`}>
          <table id="yearly-data-table" className="w-full min-w-max border-separate border-spacing-0">
            {/* On screen the page header says what this is; an exported image
                has no page around it, so it carries its own title and year. */}
            <caption hidden data-export-only className="caption-top px-3 pb-3 pt-1 text-left text-[15px] font-semibold text-slate-900 dark:text-white">
              <WithYear year={currentYear}>{t('nav.yearlyData', 'Annual data')}</WithYear>
            </caption>
            <thead className="sticky top-0 z-20">
              <tr>
                <th scope="col" style={{ width: W.no, minWidth: W.no }} className={`${HEAD} ${STICKY_NO} text-center`}>
                  {t('tracker.no', 'No.')}
                </th>
                <th scope="col" className={`${HEAD} ${STICKY_NAME} ${NAME_WIDTH} border-r px-3 text-left`}>
                  {t('tracker.projectName', 'Company name')}
                </th>
                <th scope="col" className={`${HEAD} ${STICKY_KIND} ${KIND_WIDTH} border-r`}>
                  <span className="sr-only">{t('tracker.rowKind', 'Plan or actual')}</span>
                </th>
                {months.map(m => (
                  <th
                    key={m}
                    scope="col"
                    style={{ width: W.month, minWidth: W.month }}
                    aria-current={m === thisMonth ? 'date' : undefined}
                    title={m === thisMonth ? t('tracker.thisMonth', 'This month') : undefined}
                    className={`${HEAD} text-right ${m === thisMonth ? 'text-orange-600! dark:text-orange-400!' : ''}`}
                  >
                    {m === thisMonth && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" aria-hidden="true" />}
                    {formatMonthLabel(m)}
                  </th>
                ))}
                <th scope="col" style={{ width: W.total, minWidth: W.total }} className={`${HEAD} border-l text-right`}>
                  {t('tracker.total', 'Total')}
                </th>
                <th scope="col" style={{ width: W.revenue, minWidth: W.revenue }} className={`${HEAD} border-l text-right`}>
                  {t('yearly.revenue', 'Revenue')}
                  <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">{t('csv.unitCurrency', 'JPY')}</span>
                </th>
              </tr>

              {totalRows.map((row, i) => {
                const last = i === totalRows.length - 1;
                const edge = last ? 'border-b border-slate-200 dark:border-slate-700' : '';
                // Actual figures in blue, as in the charts; the plan recedes.
                const tone = row.strong ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400';
                return (
                  <tr key={row.key}>
                    {i === 0 && (
                      <>
                        <td rowSpan={totalRows.length} className={`${TOTALS} ${STICKY_NO} border-b border-slate-200 px-1 py-2 text-center align-top text-[13px] text-slate-400 dark:border-slate-700 dark:text-slate-500`}>
                          <span aria-hidden="true">Σ</span>
                        </td>
                        <th scope="rowgroup" rowSpan={totalRows.length} className={`${TOTALS} ${STICKY_NAME} ${NAME_WIDTH} border-b border-r border-slate-200 px-3 py-2 text-left align-top text-[13px] font-semibold text-slate-900 dark:border-slate-700 dark:text-white`}>
                          {t('yearly.allProjects', 'All projects')}
                        </th>
                      </>
                    )}
                    <th scope="row" className={`${TOTALS} ${STICKY_KIND} ${edge} border-r border-r-slate-200 px-2 py-1.5 text-left text-[12px] font-medium leading-4 text-slate-500 dark:border-r-slate-700 dark:text-slate-400`}>
                      {row.label}
                    </th>
                    {row.values.map((value, idx) => (
                      <td key={idx} className={`${TOTALS} ${edge} ${NUM} ${tone}`}>
                        {value > 0 ? nf(value) : <Dash />}
                      </td>
                    ))}
                    <td className={`${TOTALS} ${edge} ${NUM} ${tone} border-l border-l-slate-200 dark:border-l-slate-700`}>
                      {row.total === undefined ? null : row.total > 0 ? nf(row.total) : <Dash />}
                    </td>
                    <td className={`${TOTALS} ${edge} ${NUM} ${tone} border-l border-l-slate-200 dark:border-l-slate-700`}>
                      {row.revenue === undefined ? null : row.revenue > 0 ? nf(Math.round(row.revenue)) : <Dash />}
                    </td>
                  </tr>
                );
              })}
            </thead>

            {projects.map((project, index) => {
              const projRecords = records[project.id] || [];
              const monthlyData = months.map(m => {
                const r = projRecords.find(rec => rec.month === m);
                return { plan: r?.planned_hours || 0, actual: r?.actual_hours || 0 };
              });
              const totalPlan = monthlyData.reduce((sum, d) => sum + d.plan, 0);
              const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);

              // Per-record, per-period pricing (A1/A2) — never a single flattened price.
              const revenue = projectRevenues[project.id] ?? { plan: 0, actual: 0 };
              const planPriceNote = priceBreakdown(project.id, 'plan');
              const actualPriceNote = priceBreakdown(project.id, 'actual');

              return (
                <tbody key={project.id} className="group">
                  <tr>
                    <td rowSpan={2} style={{ width: W.no, minWidth: W.no }} className={`${SURFACE} ${STICKY_NO} ${ROW_END} px-1 py-2 text-center align-top text-[13px] tabular-nums text-slate-400 dark:text-slate-500`}>
                      <span className="inline-block pt-0.5">{index + 1}</span>
                    </td>
                    <th scope="rowgroup" rowSpan={2} className={`${SURFACE} ${STICKY_NAME} ${NAME_WIDTH} ${ROW_END} border-r border-r-slate-200 px-3 py-2 text-left align-top font-normal dark:border-r-slate-800`}>
                      <span className="line-clamp-2 text-[13px] font-medium leading-5 text-slate-900 dark:text-white" title={project.name}>
                        {project.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-slate-400 dark:text-slate-500">{project.code}</span>
                    </th>
                    <th scope="row" className={`${SURFACE} ${STICKY_KIND} border-r border-slate-100 px-2 py-1.5 text-left text-[12px] font-normal text-slate-500 dark:border-slate-800 dark:text-slate-400`}>
                      {planLabel}
                    </th>
                    {monthlyData.map((d, idx) => (
                      <td key={idx} className={`${SURFACE} ${NUM} text-slate-500 dark:text-slate-400`}>
                        {d.plan > 0 ? nf(d.plan) : <Dash />}
                      </td>
                    ))}
                    <td className={`${SURFACE} ${NUM} border-l border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400`}>
                      {totalPlan > 0 ? nf(totalPlan) : <Dash />}
                    </td>
                    <td
                      className={`${SURFACE} ${NUM} border-l border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400 ${planPriceNote ? 'cursor-help underline decoration-slate-300 decoration-dotted underline-offset-4 dark:decoration-slate-600' : ''}`}
                      title={planPriceNote}
                    >
                      {revenue.plan > 0 ? nf(Math.round(revenue.plan)) : <Dash />}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className={`${SURFACE} ${STICKY_KIND} ${ROW_END} border-r border-r-slate-100 px-2 py-1.5 text-left text-[12px] font-medium text-blue-700 dark:border-r-slate-800 dark:text-blue-300`}>
                      {actualLabel}
                    </th>
                    {monthlyData.map((d, idx) => (
                      <td key={idx} className={`${SURFACE} ${ROW_END} ${NUM} font-medium text-blue-700 dark:text-blue-300`}>
                        {d.actual > 0 ? nf(d.actual) : <Dash />}
                      </td>
                    ))}
                    <td className={`${SURFACE} ${ROW_END} ${NUM} border-l border-l-slate-100 font-semibold text-blue-700 dark:border-l-slate-800 dark:text-blue-300`}>
                      {totalActual > 0 ? nf(totalActual) : <Dash />}
                    </td>
                    <td
                      className={`${SURFACE} ${ROW_END} ${NUM} border-l border-l-slate-100 font-semibold text-blue-700 dark:border-l-slate-800 dark:text-blue-300 ${actualPriceNote ? 'cursor-help underline decoration-slate-300 decoration-dotted underline-offset-4 dark:decoration-slate-600' : ''}`}
                      title={actualPriceNote}
                    >
                      {revenue.actual > 0 ? nf(Math.round(revenue.actual)) : <Dash />}
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      </section>
    </Page>
  );
};
