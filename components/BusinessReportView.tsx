import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ClipboardList, Info, Pencil, Presentation, Save } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { useConfirm, useToast } from '../contexts/ToastContext';
import { useBusinessReport } from '../hooks/useBusinessReport';
import { REPORT_MIGRATION_FILE, ReportTableMissingError, sameReportContent } from '../services/ReportService';
import { setNavigationBlocker } from '../utils/navigationGuard';
import { reportMonthKey } from '../utils/reportModel';
import type { ReportContent, ReportModel } from '../utils/reportModel';
import { createLogger } from '../utils/logger';
import { YearControl } from './YearControl';
import { Button } from './ui/Button';
import { buttonClasses } from './ui/buttonClasses';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Kbd } from './ui/Kbd';
import { Page } from './ui/Page';
import { Skeleton } from './ui/Skeleton';
import { ActionsSection } from './report/ActionsSection';
import { CustomersSection } from './report/CustomersSection';
import { PeopleSection } from './report/PeopleSection';
import { ResultsSection } from './report/ResultsSection';
import { SummarySection } from './report/SummarySection';
import type { ReportEdit } from './report/types';
import { useReportFormat } from './report/useReportFormat';

const log = createLogger('BusinessReportView');

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SAVE_SHORTCUT = isMac ? '⌘S' : 'Ctrl S';

export interface BusinessReportViewProps {
  /** The shell's year. */
  currentYear: number;
}

/** The month a year's report opens on: this month for this year, December for any other. */
const defaultMonthFor = (year: number, today = new Date()): number =>
  year === today.getFullYear() ? today.getMonth() + 1 : 12;

/** A confirm dialog is open: keyboard shortcuts wait until it has been answered. */
const dialogOpen = () => document.querySelector('[role="alertdialog"]') !== null;

// The app's other download helpers take a string (csvExport) or are private to
// the chart capture module; a deck is a Blob.
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** The report month, in the page header beside the year. */
const MonthControl: React.FC<{
  month: number;
  onChange: (month: number) => void;
  disabled?: boolean;
}> = ({ month, onChange, disabled }) => {
  const { t } = useLanguage();
  const f = useReportFormat();
  const label = t('report.month', 'Report month');
  return (
    <label
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3 shadow-sm shadow-slate-900/[0.04] focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
      title={label}
    >
      <span className="text-[13px] text-slate-500 dark:text-slate-400">{t('report.monthShort', 'Month')}</span>
      <select
        value={month}
        disabled={disabled}
        aria-label={label}
        onChange={event => {
          const next = Number.parseInt(event.target.value, 10);
          if (!Number.isNaN(next)) onChange(next);
        }}
        className="h-full appearance-none rounded-r-lg bg-transparent pr-3 text-sm font-semibold tabular-nums text-slate-900 outline-none disabled:opacity-50 dark:text-white"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
          <option key={m} value={m}>{f.monthName(m)}</option>
        ))}
      </select>
    </label>
  );
};

/** A line above the report: what is being shown, or what went wrong. */
const Notice: React.FC<{
  tone?: 'info' | 'warning';
  children: React.ReactNode;
  action?: React.ReactNode;
  testId?: string;
}> = ({ tone = 'info', children, action, testId }) => {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      data-notice={testId}
      className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm leading-6 animate-fade-up ${
        tone === 'warning'
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
      }`}
    >
      <Icon
        className={`mt-1 h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

const ReportSkeleton: React.FC = () => (
  <div className="space-y-5 sm:space-y-6" aria-hidden="true">
    <Card padding="lg">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-6 w-3/4" />
      <div className="mt-6 grid gap-6 min-[480px]:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
    </Card>
    <Card padding="lg">
      <Skeleton className="h-5 w-48" />
      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Card>
    <Card padding="lg">
      <Skeleton className="h-5 w-56" />
      <Skeleton.Table rows={4} cols={4} className="mt-5" />
    </Card>
  </div>
);

/**
 * The business status report (事業状況報告): every figure the monthly deck
 * needs, computed the Dashboard's way, beside the written parts an admin keeps
 * per report month. The deck itself downloads from here.
 */
export const BusinessReportView: React.FC<BusinessReportViewProps> = ({ currentYear }) => {
  const { t } = useLanguage();
  const { isAdmin } = useUserRole();
  const toast = useToast();
  const confirm = useConfirm();
  const f = useReportFormat();

  // The report month, fixed when a year is first shown and changed only by a
  // pick or a year change. Worked out afresh on every render, it would move on
  // by itself at midnight on the last day of a month, taking the edits with it.
  const [shownMonth, setShownMonth] = useState(() => ({ year: currentYear, month: defaultMonthFor(currentYear) }));
  let month = shownMonth.month;
  if (shownMonth.year !== currentYear) {
    month = defaultMonthFor(currentYear);
    setShownMonth({ year: currentYear, month });
  }
  const key = reportMonthKey(currentYear, month);

  const data = useBusinessReport(currentYear, month);
  const { figures, report } = data;

  /* ---------------- editing ---------------- */

  const [draft, setDraft] = useState<{ key: string; content: ReportContent } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<'failed' | 'missing' | null>(null);

  // A draft belongs to one report month. Once the year or month has moved on
  // (after the guard below asked), it is dropped.
  if (draft && draft.key !== key) {
    setDraft(null);
    setSaveError(null);
  }

  const editing = draft !== null && draft.key === key;
  const dirty = useMemo(
    () => editing && draft !== null && !sameReportContent(draft.content, report.content),
    [editing, draft, report.content],
  );
  // A year without hours has nothing to report, and nothing to write up either:
  // no Edit and no deck, or a save would file the last report's text under it.
  const hasReport = figures !== null && data.hasRecords && !data.loading && !data.error;
  const canEdit = isAdmin && hasReport && report.status === 'ready';

  const edit = useCallback<ReportEdit>(update => {
    setDraft(prev => (prev ? { ...prev, content: update(prev.content) } : prev));
  }, []);

  const confirmDiscard = useCallback(() => confirm({
    title: t('tracker.unsavedTitle', 'Unsaved changes'),
    message: t('report.unsavedLeave', 'The report has changes that are not saved. Leave without saving?'),
    confirmLabel: t('common.leave', 'Leave'),
    cancelLabel: t('common.stay', 'Stay'),
    danger: true,
  }), [confirm, t]);

  // Leaving the page, changing the year, signing out, Back: the shell asks first.
  useEffect(() => {
    if (!dirty) return;
    return setNavigationBlocker(confirmDiscard);
  }, [dirty, confirmDiscard]);

  // A refresh or a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const changeMonth = async (next: number) => {
    if (next === month) return;
    if (dirty && !(await confirmDiscard())) return;
    setDraft(null);
    setSaveError(null);
    setShownMonth({ year: currentYear, month: next });
  };

  const startEditing = () => {
    if (!canEdit) return;
    setSaveError(null);
    setDraft({ key, content: report.content });
  };

  const cancelEditing = async () => {
    if (dirty) {
      const discard = await confirm({
        title: t('report.discardTitle', 'Discard your changes?'),
        message: t('report.discardMessage', 'The changes you made to this report will be lost.'),
        confirmLabel: t('report.discard', 'Discard'),
        cancelLabel: t('report.keepEditing', 'Keep editing'),
        danger: true,
      });
      if (!discard) return;
    }
    setDraft(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!draft || draft.key !== key || saving) return;
    // A month that already has its report and no changes: nothing to write.
    // A month still showing an earlier report's text is saved as its own.
    if (!dirty && report.saved) {
      setDraft(null);
      toast.info(t('toast.nothingToSave', 'No changes to save'));
      return;
    }
    const snapshot = draft.content;
    setSaving(true);
    setSaveError(null);
    try {
      await data.save(snapshot);
      // Anything typed while the request was out stays in the editor.
      setDraft(prev => (prev && prev.content === snapshot ? null : prev));
      toast.success(t('report.saved', 'Report saved'));
    } catch (error) {
      // ReportService has already logged the request's error.
      const missing = error instanceof ReportTableMissingError;
      setSaveError(missing ? 'missing' : 'failed');
      toast.error(t('report.saveFailed', 'The report was not saved. Your changes are still here.'));
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S never opens the browser's Save Page on this page. It saves while
  // editing, and waits while a dialog is asking something.
  const saveRef = useRef(handleSave);
  const editingRef = useRef(editing);
  useEffect(() => {
    saveRef.current = handleSave;
    editingRef.current = editing;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (!editingRef.current || dialogOpen()) return;
      void saveRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ---------------- PowerPoint ---------------- */

  const [exporting, setExporting] = useState(false);
  // The deck needs the written parts too: none while they load or after they failed.
  // A missing table is different: there is nothing written yet, so the deck has figures only.
  const canDownload = hasReport && (report.status === 'ready' || report.status === 'missing');
  const handleDownload = async () => {
    if (!figures || !canDownload || exporting) return;
    setExporting(true);
    try {
      // pptxgenjs is large: it loads only when someone downloads a deck.
      const pptx = await import('../utils/reportPptx');
      const model: ReportModel = { figures, content: report.content };
      const blob = await pptx.buildReportPptx(model, { logoDataUrl: await pptx.loadReportLogo() });
      downloadBlob(blob, pptx.reportPptxFilename(model));
      toast.success(t('toast.exportDone', 'Export complete'));
    } catch (error) {
      log.error('PowerPoint export failed', error);
      toast.error(t('report.pptxFailed', 'The PowerPoint file could not be made. Try again in a moment.'));
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- header ---------------- */

  const shown = editing && draft ? draft.content : report.content;
  const asOf = report.status === 'loading' ? null : f.date(shown.reportDate);
  const reportName = t('report.monthYear', '{month} {year}')
    .replace('{month}', f.monthName(month))
    .replace('{year}', String(currentYear));

  const header = {
    title: t('nav.report', 'Business report'),
    description: (
      <>
        {t('report.header.desc', 'The monthly business report: results, customers, people and next actions')}
        {asOf && (
          <span className="whitespace-nowrap">
            {' · '}
            <span data-report="as-of">{t('report.asOfDate', 'As of {date}').replace('{date}', asOf)}</span>
          </span>
        )}
      </>
    ),
    actions: (
      <>
        <MonthControl month={month} onChange={next => void changeMonth(next)} disabled={saving} />
        <YearControl />
        {editing ? (
          <>
            <Button variant="secondary" onClick={() => void cancelEditing()} disabled={saving} data-action="cancel-edit">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              isLoading={saving}
              icon={<Save className="h-4 w-4" aria-hidden="true" />}
              title={`${t('common.save', 'Save')} (${SAVE_SHORTCUT})`}
              data-action="save-report"
              aria-keyshortcuts="Control+S"
            >
              {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
              <Kbd className="hidden sm:inline-flex">{SAVE_SHORTCUT}</Kbd>
            </Button>
          </>
        ) : (
          <>
            {canEdit && (
              <Button
                variant="secondary"
                onClick={startEditing}
                icon={<Pencil className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
                data-action="edit-report"
              >
                {t('report.edit.start', 'Edit')}
              </Button>
            )}
            {/* Hidden once a year turns out to have no hours; shown, disabled, while it loads. */}
            {(hasReport || data.loading) && (
              <Button
                variant="primary"
                onClick={() => void handleDownload()}
                isLoading={exporting}
                disabled={!canDownload}
                icon={<Presentation className="h-4 w-4" aria-hidden="true" />}
                title={report.status === 'error'
                  ? t('report.pptxNeedsContent', 'The written parts did not load, so the deck cannot be made yet')
                  : t('report.pptxTitle', 'Download this report as a PowerPoint deck')}
                data-action="download-pptx"
              >
                {t('report.pptx', 'PowerPoint')}
              </Button>
            )}
          </>
        )}
      </>
    ),
  };

  /* ---------------- states ---------------- */

  if (data.error) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            tone="error"
            title={t('empty.loadFailedTitle', 'Could not load this year')}
            description={t('empty.loadFailedHint', 'The request did not come back. Check the connection and try again.')}
            actions={
              <button type="button" onClick={data.reload} className={buttonClasses('secondary')}>
                {t('buttons.retry', 'Try again')}
              </button>
            }
          />
        </Card>
      </Page>
    );
  }

  if (data.loading || !figures) {
    return (
      <Page {...header}>
        <div role="status" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
          <ReportSkeleton />
        </div>
      </Page>
    );
  }

  if (!data.hasRecords) {
    return (
      <Page {...header}>
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={t('empty.noDataTitle', 'No hours recorded for {year} yet').replace('{year}', String(currentYear))}
            description={t('report.emptyHint', 'The report is built from the hours in Project tracking. Enter them there, or choose another year.')}
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

  /* ---------------- notices ---------------- */

  const notices: React.ReactNode[] = [];
  if (report.status === 'missing' && isAdmin) {
    notices.push(
      <Notice key="missing" tone="warning" testId="table-missing">
        <p className="font-medium">{t('report.missing.title', 'The written parts cannot be saved yet')}</p>
        <p>
          {t('report.missing.body', 'The business_reports table does not exist. Run {file} in the Supabase SQL editor, then reload this page. Every figure below is already live.')
            .split('{file}')
            .flatMap((part, i) => (i === 0 ? [part] : [<code key={i} className="rounded bg-amber-100 px-1 py-0.5 text-[13px] dark:bg-amber-500/20">{REPORT_MIGRATION_FILE}</code>, part]))}
        </p>
      </Notice>,
    );
  }
  if (report.status === 'error') {
    notices.push(
      <Notice
        key="error"
        tone="warning"
        testId="content-error"
        action={<Button variant="secondary" size="sm" onClick={data.reloadReport}>{t('buttons.retry', 'Try again')}</Button>}
      >
        {t('report.contentFailed', 'The written parts of the report could not be loaded. The figures are up to date.')}
      </Notice>,
    );
  }
  if (report.status === 'ready' && !report.saved && report.carriedFrom && !editing) {
    const from = t('report.monthYear', '{month} {year}')
      .replace('{month}', f.monthName(report.carriedFrom.month))
      .replace('{year}', String(report.carriedFrom.year));
    notices.push(
      <Notice key="carried" testId="carried-over">
        {(isAdmin
          ? t('report.carried.admin', 'No report has been saved for {month} yet. The written parts start from the {from} report; nothing is saved until you press Save.')
          : t('report.carried.viewer', 'No report has been saved for {month} yet. The written parts are from the {from} report.'))
          .replace('{month}', reportName)
          .replace('{from}', from)}
      </Notice>,
    );
  }
  if (editing) {
    const carried = !report.saved && report.carriedFrom;
    notices.push(
      <Notice
        key="editing"
        tone={saveError ? 'warning' : 'info'}
        testId={saveError ? 'save-failed' : 'editing'}
        action={saveError === 'failed' ? (
          <Button variant="secondary" size="sm" onClick={() => void handleSave()} isLoading={saving}>
            {t('buttons.retry', 'Try again')}
          </Button>
        ) : undefined}
      >
        {saveError === 'failed' && (
          <p className="font-medium">{t('report.saveFailed', 'The report was not saved. Your changes are still here.')}</p>
        )}
        {saveError === 'missing' && (
          <p className="font-medium">
            {t('report.saveMissing', 'The report cannot be saved until {file} has been run.').replace('{file}', REPORT_MIGRATION_FILE)}
          </p>
        )}
        <p>
          {t('report.editing', 'Editing the report for {month}.').replace('{month}', reportName)}{' '}
          {carried && t('report.editingCarried', 'It starts from an earlier report; save to keep it for this month.')}{' '}
          {t('report.edit.hint', 'In each text field, the first line is the main text and any further lines are its translation, shown smaller.')}{' '}
          {t('report.edit.pptxFit', 'PowerPoint shortens text that does not fit its box.')}
        </p>
      </Notice>,
    );
  }

  const onEdit = editing ? edit : undefined;
  // Without the written parts (still loading, not loadable, no table yet) the
  // page is the figures alone; nothing pretends to be an empty report.
  const written = editing || report.status === 'ready';

  return (
    <Page {...header}>
      {notices}
      <SummarySection figures={figures} content={shown} onEdit={onEdit} written={written} />
      <ResultsSection figures={figures} content={shown} onEdit={onEdit} written={written} />
      <CustomersSection figures={figures} content={shown} onEdit={onEdit} written={written} />
      {written ? (
        <>
          <PeopleSection content={shown} onEdit={onEdit} />
          <ActionsSection content={shown} onEdit={onEdit} />
        </>
      ) : report.status === 'loading' && (
        <div aria-hidden="true" className="space-y-5 sm:space-y-6">
          {[0, 1].map(i => (
            <Card key={i} padding="lg">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="mt-5 h-24 w-full" />
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => void cancelEditing()} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            isLoading={saving}
            icon={<Save className="h-4 w-4" aria-hidden="true" />}
          >
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </Button>
        </div>
      )}
    </Page>
  );
};

export default BusinessReportView;
