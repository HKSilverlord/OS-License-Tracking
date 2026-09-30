import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui/Card';
import { Bilingual, BilingualInput, TextInput } from './ReportParts';
import type { ReportSectionProps } from './types';
import { useReportFormat } from './useReportFormat';

const SummaryFigure: React.FC<{ label: string; value: React.ReactNode; note: React.ReactNode }> = ({ label, value, note }) => (
  <div className="min-w-0">
    <dt className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-0.5 text-[17px] font-semibold leading-7 tabular-nums text-slate-900 dark:text-white">{value}</dd>
    <dd className="text-xs leading-5 tabular-nums text-slate-500 dark:text-slate-400">{note}</dd>
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
    <Card id="report-summary" padding="lg" className="animate-fade-up">
      {onEdit ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem]">
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
          <h2 className="text-[13px] font-medium leading-5 text-slate-500 dark:text-slate-400">
            {t('report.summary.focus', 'Focus')}
          </h2>
          <Bilingual
            text={content.focus}
            className="mt-1"
            mainClassName="text-lg font-semibold leading-7 text-slate-900 sm:text-xl dark:text-white"
            subClassName="text-sm leading-6 text-slate-500 dark:text-slate-400"
          />
        </>
      )}

      <dl className={`grid gap-x-8 gap-y-4 min-[480px]:grid-cols-3 ${onEdit || written ? 'mt-5 border-t border-slate-100 pt-4 dark:border-slate-800' : ''}`}>
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
