import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatVariance } from '../../utils/variance';
import type { ReportFigures } from '../../utils/reportModel';
import { insetClasses } from '../ui/Card';
import { Meter, Metric } from '../ui/Metric';
import { Bilingual, BilingualInput, ReportSection, SubHeading, TextInput, wrapAnywhere } from './ReportParts';
import type { ReportSectionProps } from './types';
import { useReportFormat } from './useReportFormat';

/** A figure the regression test reads back: the raw number rides along on the element. */
const Figure: React.FC<{ name: string; value: number; children: React.ReactNode }> = ({ name, value, children }) => (
  <span data-figure={name} data-value={value}>{children}</span>
);

const varianceTone = (delta: number) =>
  delta < 0 ? 'text-rose-600 dark:text-rose-400' : delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400';

/** One annual progress bar: actual against the year's plan, and where the plan says it should be by now. */
const Progress: React.FC<{
  label: string;
  actual: number;
  planYear: number;
  planToDate: number;
  format: (value: number) => string;
}> = ({ label, actual, planYear, planToDate, format }) => {
  const { t, language } = useLanguage();
  const f = useReportFormat();
  const fraction = planYear > 0 ? actual / planYear : 0;
  const delta = actual - planToDate;
  const variance = formatVariance(delta, language, format);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-[13px] tabular-nums text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-white">{format(actual)}</span> / {format(planYear)}
          {planYear > 0 && <span className="ml-2">{f.percent(fraction)}</span>}
        </p>
      </div>
      <div className="relative mt-2">
        <Meter value={fraction} label={`${label} ${f.percent(fraction)}`} className="h-2" />
        {/* Where the plan stands at the report month: orange, as "this month" is everywhere in the app. */}
        {planYear > 0 && planToDate > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-orange-500"
            style={{ left: `${Math.min(planToDate / planYear, 1) * 100}%` }}
          />
        )}
      </div>
      {planToDate > 0 && (
        <p className="mt-1.5 text-xs leading-5 tabular-nums text-slate-500 dark:text-slate-400">
          <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-0.5 rounded-full bg-orange-500 align-[-1px]" />
          {t('report.results.planToDate', 'Plan to date {value}').replace('{value}', format(planToDate))}
          <span className={`ml-2 font-medium ${varianceTone(delta)}`}>
            {variance.arrow && <span className="mr-0.5">{variance.arrow}</span>}
            {variance.text}
          </span>
        </p>
      )}
    </div>
  );
};

/** Hours by customer, with each customer's hourly rate. */
const CustomerHours: React.FC<{ figures: ReportFigures }> = ({ figures }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const withHours = figures.customers.filter(c => c.hoursActual > 0);
  const without = figures.customers.filter(c => c.hoursActual <= 0);
  const max = Math.max(1, ...withHours.map(c => c.hoursActual));
  const perHour = t('unit.yenPerHour', 'JPY/h');

  return (
    <div className="min-w-0">
      <SubHeading aside={t('report.window', 'January–{month}').replace('{month}', f.monthName(figures.asOfMonth))}>
        {t('report.results.byCustomer', 'Hours by customer')}
      </SubHeading>
      {withHours.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('report.results.noCustomerHours', 'No customer has actual hours in these months.')}</p>
      ) : (
        <ul className="space-y-3" data-report="customer-hours">
          {withHours.map(customer => (
            <li key={customer.projectId} data-project={customer.projectId}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-white" title={customer.name}>
                  {customer.name}
                </p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{f.hours(customer.hoursActual)}</p>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(customer.hoursActual / max) * 100}%` }} />
                </div>
                <p className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {customer.rate === null ? t('report.results.noRate', 'No rate set') : `${f.count(customer.rate)} ${perHour}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {without.length > 0 && (
        <p className={`mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400 ${wrapAnywhere}`}>
          {t('report.results.noHoursYet', 'No hours yet: {names}').replace('{names}', without.map(c => c.name).join(', '))}
        </p>
      )}
    </div>
  );
};

/** This year against the two before it, over the same months. */
const EarlierYears: React.FC<{ figures: ReportFigures }> = ({ figures }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const rows = [
    ...figures.pastYears.map(p => ({ ...p, current: false })),
    { year: figures.year, hoursActual: figures.hoursActual, revenueActual: figures.revenueActual, current: true },
  ];
  const change = (past: number) => {
    if (past <= 0) return '—';
    const pct = (figures.hoursActual - past) / past;
    const arrow = pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '';
    return `${arrow}${f.percent(Math.abs(pct))}`;
  };

  return (
    <div>
      <SubHeading aside={t('report.window', 'January–{month}').replace('{month}', f.monthName(figures.asOfMonth))}>
        {t('report.results.earlierYears', 'Against earlier years')}
      </SubHeading>
      {figures.pastYears.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('report.results.noEarlierYears', 'There are no earlier years to compare with.')}</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[20rem] text-sm" data-report="earlier-years">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th scope="col" className="py-2 pr-3 font-medium">{t('report.results.year', 'Year')}</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">{t('report.results.hours', 'Hours')}</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">{t('report.results.revenue', 'Revenue')}</th>
                <th scope="col" className="py-2 text-right font-medium">{t('report.results.thisYearAgainst', 'This year, hours')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(row => (
                <tr key={row.year} className={row.current ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium tabular-nums">{row.year}</th>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{f.hours(row.hoursActual)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{f.man(row.revenueActual)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {row.current ? '' : change(row.hoursActual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** Section 1 (経営実績と案件状況): the year against its target, customer by customer. */
export const ResultsSection: React.FC<ReportSectionProps> = ({ figures, content, onEdit, written = true }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const rate = figures.achievementRate;
  const monthName = f.monthName(figures.asOfMonth);

  return (
    <ReportSection
      id="report-results"
      number={1}
      title={t('report.results.title', 'Results and customers')}
      description={t('report.results.desc', 'Progress against the annual target, and results by customer')}
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t('report.metric.hours', 'Actual design hours')}
          value={<Figure name="hoursActual" value={figures.hoursActual}>{f.hours(figures.hoursActual)}</Figure>}
          sub={t('report.summary.ofTarget', 'Annual target {value}').replace('{value}', f.hours(figures.hoursPlanYear))}
        />
        <Metric
          label={t('report.metric.achievement', 'Achievement')}
          value={rate === null ? '—' : f.percent(rate)}
          sub={t('report.asOfMonth', 'As of {month}').replace('{month}', monthName)}
          meter={rate ?? undefined}
          meterLabel={rate === null ? undefined : f.percent(rate)}
        />
        <Metric
          label={t('report.metric.revenue', 'Actual revenue')}
          value={f.man(figures.revenueActual)}
          sub={<Figure name="revenueActual" value={figures.revenueActual}>{f.yen(figures.revenueActual)}</Figure>}
          footnote={t('report.metric.revenuePlan', 'Annual plan {man} ({yen})')
            .replace('{man}', f.man(figures.revenuePlanYear))
            .replace('{yen}', f.yen(figures.revenuePlanYear))}
        />
        <Metric
          label={t('report.metric.customers', 'Customers with actuals')}
          value={<Figure name="customersWithActuals" value={figures.customersWithActuals}>{f.count(figures.customersWithActuals)}</Figure>}
          sub={t('report.metric.customersSub', 'With hours in {window}').replace('{window}', t('report.window', 'January–{month}').replace('{month}', monthName))}
        />
      </div>

      {/* grid-cols-1 is minmax(0, 1fr): the earlier-years table scrolls inside
          its column on a phone instead of pushing the column past the card. */}
      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 border-t border-slate-100 pt-6 lg:grid-cols-2 dark:border-slate-800">
        <div className="min-w-0 space-y-6">
          <div>
            <SubHeading>{t('report.results.progress', 'Annual progress')}</SubHeading>
            <div className="space-y-5">
              <Progress
                label={t('report.results.hours', 'Hours')}
                actual={figures.hoursActual}
                planYear={figures.hoursPlanYear}
                planToDate={figures.hoursPlanToDate}
                format={f.hours}
              />
              <Progress
                label={t('report.results.revenue', 'Revenue')}
                actual={figures.revenueActual}
                planYear={figures.revenuePlanYear}
                planToDate={figures.revenuePlanToDate}
                format={f.man}
              />
            </div>
          </div>
          <EarlierYears figures={figures} />
        </div>
        <CustomerHours figures={figures} />
      </div>

      {(onEdit || written) && <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
        <SubHeading>{t('report.results.highlight', 'Highlight')}</SubHeading>
        {onEdit ? (
          <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
            <TextInput
              label={t('report.results.highlightTitle', 'Customer or title')}
              value={content.highlight.title}
              onChange={title => onEdit(c => ({ ...c, highlight: { ...c.highlight, title } }))}
            />
            <BilingualInput
              label={t('report.results.highlightBody', 'Story')}
              value={content.highlight.body}
              minRows={3}
              onChange={body => onEdit(c => ({ ...c, highlight: { ...c.highlight, body } }))}
            />
          </div>
        ) : content.highlight.title || content.highlight.body ? (
          <div className={`${insetClasses} grid gap-x-6 gap-y-2 p-4 md:grid-cols-[12rem_minmax(0,1fr)]`}>
            <p className={`min-w-0 text-[15px] font-semibold text-slate-900 dark:text-white ${wrapAnywhere}`}>{content.highlight.title}</p>
            <Bilingual text={content.highlight.body} empty={null} />
          </div>
        ) : (
          <Bilingual text="" />
        )}
      </div>}
    </ReportSection>
  );
};
