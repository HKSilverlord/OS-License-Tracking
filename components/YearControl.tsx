import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { useYearControl } from '../contexts/YearContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { exportYearToExcel } from '../services/exportService';
import { Button } from './ui/Button';
import { createLogger } from '../utils/logger';

const log = createLogger('YearControl');

const STEP =
  'grid h-full w-8 place-items-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 ' +
  'disabled:pointer-events-none disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

/**
 * The year a page is showing, in the page's own header.
 *
 * Arrows step to the neighbouring year — the common move, comparing this year
 * with last — and the year itself opens the full list. Every change goes
 * through the navigation guard, so unsaved hours in Tracking are never
 * dropped by a year switch.
 */
export const YearControl: React.FC<{ className?: string }> = ({ className = '' }) => {
  const control = useYearControl();
  const { t } = useLanguage();
  if (!control) return null;

  const { year, years, requestYear } = control;
  // Oldest first, so "previous" is on the left; the shown year is always listed
  // even before the period list has arrived.
  const options = Array.from(new Set([...years, year])).sort((a, b) => a - b);
  const index = options.indexOf(year);
  const previous = index > 0 ? options[index - 1] : null;
  const next = index < options.length - 1 ? options[index + 1] : null;

  return (
    <div
      role="group"
      aria-label={t('year.select', 'Select year')}
      className={`inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none ${className}`}
    >
      <button
        type="button"
        className={STEP}
        disabled={previous === null}
        onClick={() => previous !== null && requestYear(previous)}
        aria-label={t('year.previous', 'Previous year')}
        title={previous !== null ? String(previous) : undefined}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <select
        value={year}
        onChange={event => {
          const picked = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(picked) || picked === year) return;
          // A controlled select has already moved in the DOM; put it back when
          // the user decides to stay with their unsaved edits.
          if (!requestYear(picked)) event.target.value = String(year);
        }}
        aria-label={t('year.select', 'Select year')}
        className="appearance-none border-x border-slate-200 bg-transparent px-3 text-center text-sm font-semibold tabular-nums text-slate-900 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <button
        type="button"
        className={STEP}
        disabled={next === null}
        onClick={() => next !== null && requestYear(next)}
        aria-label={t('year.next', 'Next year')}
        title={next !== null ? String(next) : undefined}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

/**
 * The whole year as an Excel workbook: every project, every month, plan and
 * actual — the file people attach to the monthly report.
 */
export const YearExportButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const control = useYearControl();
  const { t } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!control) return null;

  const { year } = control;
  const title = t('export.yearTitle', 'Download every project and month of {year} as an Excel workbook')
    .replace('{year}', String(year));

  const run = async () => {
    // Two database round-trips and a file write: a double-click must not
    // download the same workbook twice.
    if (busy) return;
    setBusy(true);
    try {
      await exportYearToExcel(year);
      toast.success(t('toast.exportDone', 'Export complete'));
    } catch (error) {
      log.error('Export failed', error);
      toast.error(t('toast.exportFailed', 'Export failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={run}
      isLoading={busy}
      icon={<FileSpreadsheet className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
      title={title}
      aria-label={title}
      className={className}
    >
      <span className="hidden sm:inline">{t('export.excel', 'Excel')}</span>
    </Button>
  );
};
