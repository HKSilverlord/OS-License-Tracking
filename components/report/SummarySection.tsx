import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui/Card';
import { Bilingual, BilingualInput, labelText, TextInput } from './ReportParts';
import type { ReportSectionProps } from './types';
import { useReportFormat } from './useReportFormat';

/** The cover's three figures are the largest on the page, as they are on the deck's cover. */
const SummaryFigure: React.FC<{ label: string; value: React.ReactNode; note: React.ReactNode }> = ({ label, value, note }) => (
  <div className="min-w-0">
    <dt className={`font-medium ${labelText}`}>{label}</dt>
    <dd className="mt-1 text-[30px] font-semibold leading-9 tracking-tight tabular-nums text-slate-900 @4xl:text-4xl @4xl:leading-[44px] dark:text-white">
      {value}
    </dd>
    <dd className="mt-0.5 text-sm leading-6 tabular-nums text-slate-500 dark:text-slate-400">{note}</dd>
  </div>
);

/**
 * The template's cover: the one-line focus, then the three figures the deck
 * opens on. Everything below it is the detail behind these.
 */
export const SummarySection: React.FC<ReportSectionProps> = ({ figures, content, onEdit, written = true }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const rate = figures.achievementRate;

  return (
    <Card id="report-summary" padding="lg" className="@container animate-fade-up">
      {onEdit ? (
        <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_14rem]">
          <BilingualInput
            label={t('report.summary.focus', 'Focus')}
            value={content.focus}
            onChange={focus => onEdit(c => ({ ...c, focus }))}
          />
          <TextInput
            type="date"
            label={t('report.summary.reportDate', 'Report date')}
            value={content.reportDate}
            onChange={reportDate => onEdit(c => ({ ...c, reportDate }))}
          />
        </div>
      ) : written && (
        <>
          <h2 className={`font-medium ${labelText}`}>
            {t('report.summary.focus', 'Focus')}
          </h2>
          <Bilingual
            text={content.focus}
            className="mt-1"
            mainClassName="text-xl font-semibold leading-8 text-slate-900 @2xl:text-2xl @2xl:leading-9 dark:text-white"
            subClassName="text-base leading-7 text-slate-500 dark:text-slate-400"
          />
        </>
      )}

      {/* Side by side only where each figure has room for its full width. */}
      <dl className={`grid gap-x-8 gap-y-5 @[37rem]:grid-cols-3 ${onEdit || written ? 'mt-6 border-t border-slate-100 pt-5 dark:border-slate-800' : ''}`}>
        <SummaryFigure
          label={t('report.summary.hours', 'Design hours to date')}
          value={f.hours(figures.hoursActual)}
          note={t('report.summary.ofTarget', 'Annual target {value}').replace('{value}', f.hours(figures.hoursPlanYear))}
        />
        <SummaryFigure
          label={t('report.metric.achievement', 'Achievement')}
          value={rate === null ? '—' : f.percent(rate)}
          note={t('report.asOfMonth', 'As of {month}').replace('{month}', f.monthName(figures.asOfMonth))}
        />
        <SummaryFigure
          label={t('report.metric.revenue', 'Actual revenue')}
          value={f.man(figures.revenueActual)}
          note={t('report.summary.ofPlan', 'Annual plan {value}').replace('{value}', f.man(figures.revenuePlanYear))}
        />
      </dl>
    </Card>
  );
};
