import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Link2, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';
import { diagnoseDatabaseLinks } from '../utils/databaseDiagnostic';
import {
  runDetailedDiagnostic,
  testTrackingViewQuery,
  testYearlyDataViewQuery,
  type DetailedDiagnosticResult,
} from '../utils/detailedDiagnostic';
import { createLogger } from '../utils/logger';
import { plural } from '../utils/plural';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirm } from '../contexts/ToastContext';
import { useNumberFormat } from '../hooks/useNumberFormat';
import { Button } from './ui/Button';
import { Card, CardHeader } from './ui/Card';
import { Field, Select } from './ui/Field';
import { Page } from './ui/Page';
import { Skeleton } from './ui/Skeleton';

const log = createLogger('DatabaseDiagnostic');

type RepairResult = Awaited<ReturnType<typeof diagnoseDatabaseLinks>>;
type QueryTest = {
  period: string;
  year: number;
  tracking: Awaited<ReturnType<typeof testTrackingViewQuery>>;
  yearly: Awaited<ReturnType<typeof testYearlyDataViewQuery>>;
};
type Busy = 'check' | 'repair' | 'query' | null;

/** One finding: a tick or a warning, what was looked at, and what it means. */
const Finding: React.FC<{
  ok: boolean;
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ ok, label, value, children }) => {
  const { t } = useLanguage();
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[15px] font-medium text-slate-900 dark:text-white">
            {label}
            <span className="sr-only">: {ok ? t('diagnostic.ok', 'OK') : t('diagnostic.attention', 'Needs attention')}</span>
          </span>
          {value !== undefined && (
            <span className="text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">{value}</span>
          )}
        </div>
        {children && <div className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{children}</div>}
      </div>
    </li>
  );
};

/** Error text as the database wrote it, so it can be searched for or passed on. */
const ErrorList: React.FC<{ title: string; errors: readonly string[] }> = ({ title, errors }) => (
  <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 dark:bg-rose-500/10">
    <p className="flex items-center gap-1.5 text-sm font-medium text-rose-700 dark:text-rose-300">
      <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {title}
    </p>
    <ul className="mt-1.5 space-y-1 break-words pl-[22px] font-mono text-[13px] leading-5 text-rose-600 dark:text-rose-400">
      {errors.map((error, i) => (
        <li key={i}>{error}</li>
      ))}
    </ul>
  </div>
);

const Spinner = () => <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;

export const DatabaseDiagnostic: React.FC = () => {
  const { t } = useLanguage();
  const { format: nf, localeTag } = useNumberFormat();
  const confirm = useConfirm();

  const [busy, setBusy] = useState<Busy>(null);
  const [health, setHealth] = useState<DetailedDiagnosticResult | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [repair, setRepair] = useState<RepairResult | null>(null);
  const [queryTest, setQueryTest] = useState<QueryTest | null>(null);
  // Empty means "the first one in the list".
  const [testPeriod, setTestPeriod] = useState('');
  const [testYear, setTestYear] = useState('');

  const runCheck = useCallback(async () => {
    setBusy('check');
    try {
      // Read-only, and it reports its own failures in `errors`.
      setHealth(await runDetailedDiagnostic());
      setCheckedAt(new Date());
    } finally {
      setBusy(null);
    }
  }, []);

  // Opening the page is asking the question, so the answer is there already.
  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const periodLabels: string[] = (health?.periods.list ?? []).map(p => p.label);
  const years = Array.from(new Set<number>((health?.periods.list ?? []).map(p => p.year))).sort((a, b) => b - a);
  const period = testPeriod || periodLabels[0] || '';
  const year = testYear || (years[0] !== undefined ? String(years[0]) : '');

  const runRepair = async () => {
    const confirmed = await confirm({
      title: t('diagnostic.repair.confirmTitle', 'Repair missing links?'),
      message: t(
        'diagnostic.repair.confirmMessage',
        'Every project linked to no period gets linked to the period recorded on it, at its current prices. Nothing is changed or deleted.',
      ),
      confirmLabel: t('diagnostic.repair.confirm', 'Repair'),
    });
    if (!confirmed) return;

    setBusy('repair');
    setRepair(null);
    try {
      const result = await diagnoseDatabaseLinks();
      setRepair(result);
      // The views that were empty for want of these links fill in without a reload.
      if (result.linksCreated > 0) window.dispatchEvent(new Event('dataUpdated'));
    } catch (error) {
      log.error('Repair failed', error);
      setRepair({
        totalProjects: 0,
        totalPeriods: 0,
        projectsWithPeriod: 0,
        projectsWithoutLinks: 0,
        linksCreated: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    } finally {
      setBusy(null);
    }
    await runCheck();
  };

  const runQueryTest = async () => {
    if (!period || !year) return;
    setBusy('query');
    setQueryTest(null);
    try {
      const [tracking, yearly] = await Promise.all([
        testTrackingViewQuery(period),
        testYearlyDataViewQuery(Number(year)),
      ]);
      setQueryTest({ period, year: Number(year), tracking, yearly });
    } catch (error) {
      log.error('Query test failed', error);
    } finally {
      setBusy(null);
    }
  };

  const count = (key: string, n: number, fallback: string) => plural(t, key, n, fallback, nf);
  /* A label such as "2026 H1" breaks between the list's items, never inside one. */
  const joined = (entries: [string, number | null][]) =>
    entries.map(([label, n], i) => (
      <React.Fragment key={label}>
        {i > 0 && ' · '}
        <span className="whitespace-nowrap">{n === null ? label : `${label}: ${nf(n)}`}</span>
      </React.Fragment>
    ));

  /** Where to go to fix what a finding reports. */
  const openPage = (to: string, pageKey: string, pageFallback: string) => (
    <Link to={to} className="ml-1 whitespace-nowrap font-medium text-blue-600 hover:underline dark:text-blue-400">
      {t('diagnostic.openPage', 'Open {page}').replace('{page}', t(pageKey, pageFallback))}
    </Link>
  );
  const openTracking = () => openPage('/tracking', 'nav.tracking', 'Project tracking');
  const openPeriods = () => openPage('/period-management', 'nav.periodManagement', 'Periods');

  const renderHealth = () => {
    if (!health) {
      return (
        <ul className="mt-5 space-y-5" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <li key={i} className="flex items-start gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    const links = Object.entries(health.periodProjects.byPeriod);
    const emptyPeriods = links.filter(([, n]) => n === 0).map(([label]) => label);
    const recordYears = Object.entries(health.monthlyRecords.byYear)
      .map(([y, n]) => [y, n] as [string, number])
      .sort(([a], [b]) => Number(b) - Number(a));
    const otherRecords = health.monthlyRecords.total - recordYears.reduce((sum, [, n]) => sum + n, 0);

    return (
      <>
        <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
          <Finding ok={health.projects.total > 0} label={t('diagnostic.projects', 'Projects')} value={nf(health.projects.total)}>
            {health.projects.total === 0 && (
              <>
                {t('diagnostic.noProjects', 'No projects yet. Add them in Project tracking.')}
                {openTracking()}
              </>
            )}
          </Finding>
          <Finding ok={health.periods.total > 0} label={t('diagnostic.periods', 'Periods')} value={nf(health.periods.total)}>
            {health.periods.total === 0 ? (
              <>
                {t('diagnostic.noPeriods', 'No periods yet. Create one under Periods.')}
                {openPeriods()}
              </>
            ) : (
              joined(periodLabels.map(label => [label, null]))
            )}
          </Finding>
          <Finding
            ok={health.periodProjects.total > 0 && emptyPeriods.length === 0}
            label={t('diagnostic.links', 'Project links')}
            value={nf(health.periodProjects.total)}
          >
            {health.projects.total === 0 || health.periods.total === 0 ? (
              t('diagnostic.linksWaiting', 'Nothing to link until there is at least one project and one period.')
            ) : health.periodProjects.total === 0 ? (
              t('diagnostic.noLinks', 'No project is linked to a period, so every view is empty. Repair the links below.')
            ) : (
              <>
                {joined(links)}
                {emptyPeriods.length > 0 && (
                  <span className="block text-amber-700 dark:text-amber-300">
                    {t('diagnostic.emptyPeriods', 'No projects in {periods} yet.').replace('{periods}', emptyPeriods.join(', '))}
                    {openPeriods()}
                  </span>
                )}
              </>
            )}
          </Finding>
          <Finding ok={health.monthlyRecords.total > 0} label={t('diagnostic.records', 'Monthly records')} value={nf(health.monthlyRecords.total)}>
            {health.monthlyRecords.total === 0 ? (
              <>
                {t('diagnostic.noRecords', 'No hours recorded yet. Enter them in Project tracking.')}
                {openTracking()}
              </>
            ) : (
              joined([
                  ...recordYears,
                  ...(otherRecords > 0 ? [[t('diagnostic.otherYears', 'Other years'), otherRecords] as [string, number]] : []),
                ])
            )}
          </Finding>
        </ul>
        {health.errors.length > 0 && (
          <div className="mt-5">
            <ErrorList title={t('diagnostic.checkErrors', 'Some of this could not be read')} errors={health.errors} />
          </div>
        )}
      </>
    );
  };

  const renderRepairOutcome = () => {
    if (!repair) return null;
    if (repair.totalPeriods === 0 && repair.errors.length === 0) {
      return (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t('diagnostic.repair.noPeriods', 'There is no period to link to. Create one under Periods first.')}
          {openPeriods()}
        </p>
      );
    }
    if (repair.errors.length > 0) {
      return <ErrorList title={t('diagnostic.repair.failed', 'The repair did not finish')} errors={repair.errors} />;
    }
    if (repair.linksCreated > 0) {
      return (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {count('diagnostic.repair.created', repair.linksCreated, 'Linked {count} projects to their periods.')}
        </p>
      );
    }
    return (
      <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
        {t('diagnostic.repair.nothing', 'Nothing to repair: every project is linked to at least one period.')}
      </p>
    );
  };

  const checkedTime = checkedAt?.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });

  return (
    <Page
      title={t('nav.diagnostic', 'Database repair')}
      description={t('diagnostic.desc', 'Whether projects, periods and hours are connected, and a repair for when they are not')}
    >
      <div className="max-w-3xl space-y-5 sm:space-y-6">
        <Card padding="lg" className="animate-fade-up" aria-busy={busy === 'check'}>
          <CardHeader
            title={t('diagnostic.health.title', 'What the database holds')}
            description={
              checkedTime
                ? t('diagnostic.checkedAt', 'Counted at {time}').replace('{time}', checkedTime)
                : t('diagnostic.counting', 'Counting…')
            }
            actions={
              <Button variant="secondary" size="sm" onClick={() => void runCheck()} disabled={busy !== null}>
                {busy === 'check' ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                {t('diagnostic.checkAgain', 'Count again')}
              </Button>
            }
          />
          <div aria-live="polite">{renderHealth()}</div>
        </Card>

        <Card padding="lg" className="animate-fade-up [animation-delay:40ms]">
          <CardHeader
            title={t('diagnostic.repair.title', 'Missing project links')}
            description={t(
              'diagnostic.repair.desc',
              'A project shows up in a period only once it is linked to it. This finds projects linked to no period at all, and links each one to the period recorded on it.',
            )}
          />
          <div className="mt-5 flex flex-col items-start gap-4">
            <Button onClick={() => void runRepair()} disabled={busy !== null}>
              {busy === 'repair' ? <Spinner /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
              {t('diagnostic.repair.run', 'Find and repair')}
            </Button>
            <div aria-live="polite" className="w-full empty:hidden">
              {renderRepairOutcome()}
            </div>
          </div>
        </Card>

        <Card padding="lg" className="animate-fade-up [animation-delay:80ms]">
          <CardHeader
            title={t('diagnostic.query.title', 'Try a view’s query')}
            description={t(
              'diagnostic.query.desc',
              'Runs the query behind Project tracking for a period, and the one behind Annual data for a year, and shows what comes back.',
            )}
          />
          {health && periodLabels.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {t('diagnostic.query.needPeriods', 'There is nothing to query until a period exists.')}
            </p>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <Field label={t('diagnostic.query.period', 'Period')} className="w-40">
                  {id => (
                    <Select id={id} value={period} onChange={event => setTestPeriod(event.target.value)} disabled={!health}>
                      {periodLabels.map(label => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t('diagnostic.query.year', 'Year')} className="w-32">
                  {id => (
                    <Select id={id} value={year} onChange={event => setTestYear(event.target.value)} disabled={!health}>
                      {years.map(y => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button variant="secondary" className="h-10!" onClick={() => void runQueryTest()} disabled={busy !== null || !period || !year}>
                  {busy === 'query' ? <Spinner /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  {t('diagnostic.query.run', 'Run')}
                </Button>
              </div>

              {queryTest && (
                <ul aria-live="polite" className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
                  <Finding ok={queryTest.tracking.success} label={`${t('nav.tracking', 'Project tracking')} · ${queryTest.period}`}>
                    {queryTest.tracking.success ? (
                      count('diagnostic.query.projects', queryTest.tracking.data?.length ?? 0, '{count} projects')
                    ) : (
                      <span className="font-mono text-[13px] text-rose-600 dark:text-rose-400">{queryTest.tracking.error}</span>
                    )}
                  </Finding>
                  <Finding ok={queryTest.yearly.success} label={`${t('nav.yearlyData', 'Annual data')} · ${queryTest.year}`}>
                    {queryTest.yearly.success ? (
                      [
                        count('diagnostic.query.periods', queryTest.yearly.periods?.length ?? 0, '{count} periods'),
                        count('diagnostic.query.projectLinks', queryTest.yearly.projects?.length ?? 0, '{count} project links'),
                        count('diagnostic.query.records', queryTest.yearly.records?.length ?? 0, '{count} monthly records'),
                      ].join(' · ')
                    ) : (
                      <span className="font-mono text-[13px] text-rose-600 dark:text-rose-400">{queryTest.yearly.error}</span>
                    )}
                  </Finding>
                </ul>
              )}
            </>
          )}
        </Card>
      </div>
    </Page>
  );
};
