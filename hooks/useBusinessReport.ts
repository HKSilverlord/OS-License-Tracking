import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbService } from '../services/dbService';
import { ReportTableMissingError, reportService } from '../services/ReportService';
import type { SavedReport } from '../services/ReportService';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from '../contexts/ToastContext';
import { buildReportFigures } from '../utils/reportFigures';
import type { ReportProject, ReportRecord, ReportYearData } from '../utils/reportFigures';
import { emptyReportContent, reportMonthKey } from '../utils/reportModel';
import type { ReportContent, ReportFigures } from '../utils/reportModel';
import { createLogger } from '../utils/logger';

const log = createLogger('BusinessReport');

/** How many earlier years the report compares with. */
const PAST_YEARS = 2;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The date a report is "as of" when nobody has set one: today for the month
 * under way, the month's last day for any other month.
 */
const defaultReportDate = (year: number, month: number, today = new Date()): string => {
  if (today.getFullYear() === year && today.getMonth() + 1 === month) {
    return `${year}-${pad(month)}-${pad(today.getDate())}`;
  }
  const last = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(last)}`;
};

interface YearLoad {
  year: number;
  records: ReportRecord[];
  base: ReportYearData;
  projects: ReportProject[];
}

/** The report year: its rows, plus names for projects with hours but no period link. */
interface CurrentLoad extends YearLoad {
  extraProjects: ReportProject[];
}

/** One year's rows and prices; `labels` are every period's, fetched once per load. */
async function loadYear(year: number, labels: readonly string[]): Promise<YearLoad> {
  const [records, prices] = await Promise.all([
    dbService.getDashboardStats(year),
    dbService.getYearProjectPrices(year, labels),
  ]);
  const rows = records as ReportRecord[];
  return {
    year,
    records: rows,
    base: { year, records: rows, index: prices.index },
    projects: prices.projects,
  };
}

/**
 * Names for the projects that have rows this year but are not linked to any
 * of its periods. One request, and only when there are such projects. A lookup
 * that fails leaves them unnamed rather than failing the report.
 */
async function lookUpMissingNames(load: YearLoad): Promise<ReportProject[]> {
  const known = new Set(load.projects.map(p => p.id));
  const missing = new Set<string>();
  for (const record of load.records) {
    if (record.project_id && !known.has(record.project_id)) missing.add(record.project_id);
  }
  if (missing.size === 0) return [];
  try {
    return await reportService.getProjectNames([...missing]);
  } catch {
    // ReportService has already logged it.
    return [];
  }
}

export type ReportContentStatus = 'loading' | 'ready' | 'missing' | 'error';

export interface ReportContentState {
  status: ReportContentStatus;
  /** `YYYY-MM` the state belongs to. */
  key: string;
  /** The report saved for this month; null when there is none (yet). */
  saved: SavedReport | null;
  /** The earlier report a new month starts from; null when the month has its own or none exists. */
  carriedFrom: SavedReport | null;
  /** What the page shows and editing starts from: saved, carried over, or empty. */
  content: ReportContent;
}

export interface BusinessReportData {
  /** Figures are loading (the first load of a year). */
  loading: boolean;
  /** The figures could not be loaded. */
  error: boolean;
  reload: () => void;
  /** The year has monthly records at all; false shows the empty state. */
  hasRecords: boolean;
  figures: ReportFigures | null;
  report: ReportContentState;
  reloadReport: () => void;
  /** Saves this month's report. Throws on failure (the caller keeps the edits). */
  save: (content: ReportContent) => Promise<SavedReport>;
}

/**
 * Everything the business report shows: the figures (this year and the two
 * before, priced like the Dashboard) and the written content for the report
 * month. Figures reload on a year change only; the month re-slices them.
 *
 * Requests: the periods once per load, then each year's rows and prices. The
 * earlier years are kept per year while the page is open, so a year change
 * fetches only what it has not seen, and hours saved elsewhere refresh the
 * report year alone.
 *
 * Both loads carry the Dashboard's race guard: a response for a year or month
 * that is no longer on screen is dropped.
 */
export function useBusinessReport(year: number, month: number): BusinessReportData {
  const { t } = useLanguage();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /* ---------------- figures ---------------- */

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState<CurrentLoad | null>(null);
  const [past, setPast] = useState<ReportYearData[]>([]);
  const figureSeq = useRef(0);
  // Earlier years already loaded, by year. A year that failed is not kept.
  const pastCache = useRef(new Map<number, YearLoad>());

  /**
   * `silent`: a refresh in place, no skeleton; a failure is a toast.
   * `reportYearOnly`: the earlier years on screen stay as they are.
   */
  const loadFigures = useCallback(async (options?: { silent?: boolean; reportYearOnly?: boolean }) => {
    const seq = ++figureSeq.current;
    if (!options?.silent) setLoading(true);
    try {
      const labels = await dbService.getPeriods();
      if (seq !== figureSeq.current) return;

      const earlier = options?.reportYearOnly
        ? []
        : Array.from({ length: PAST_YEARS }, (_, i) => year - PAST_YEARS + i);
      const cache = pastCache.current;
      const [main, ...others] = await Promise.all([
        loadYear(year, labels).then(async load => ({ ...load, extraProjects: await lookUpMissingNames(load) })),
        // An earlier year that fails to load is left out of the comparison,
        // not allowed to take the whole report down.
        ...earlier.map(y => {
          const cached = cache.get(y);
          if (cached) return Promise.resolve(cached);
          return loadYear(y, labels).then(
            load => {
              cache.set(y, load);
              return load;
            },
            loadError => {
              log.warn('Could not load an earlier year for the comparison', y, loadError);
              return null;
            },
          );
        }),
      ]);
      // The report year may be an earlier year of another report year.
      cache.set(year, main);
      if (seq !== figureSeq.current) return;
      setCurrent(main);
      // A year with no records at all is not a comparison anyone can use.
      if (!options?.reportYearOnly) {
        setPast(others.filter((o): o is YearLoad => o !== null && o.records.length > 0).map(o => o.base));
      }
      setError(false);
    } catch (loadError) {
      if (seq !== figureSeq.current) return;
      log.error('Failed to load the report figures', loadError);
      if (options?.silent) toast.error(tRef.current('toast.loadFailed', 'Failed to load data'));
      else setError(true);
    } finally {
      if (seq === figureSeq.current) setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void loadFigures();
  }, [loadFigures]);

  // Hours saved in Project tracking, or a new period, refresh the report year
  // in place. The earlier years on screen stay; a later year change loads them afresh.
  useEffect(() => {
    const refresh = () => {
      pastCache.current.clear();
      void loadFigures({ silent: true, reportYearOnly: true });
    };
    window.addEventListener('dataUpdated', refresh);
    window.addEventListener('periodCreated', refresh);
    return () => {
      window.removeEventListener('dataUpdated', refresh);
      window.removeEventListener('periodCreated', refresh);
    };
  }, [loadFigures]);

  const unnamedLabel = t('report.customers.unlinked', 'Unlinked project');
  const figures = useMemo<ReportFigures | null>(() => {
    if (!current || current.year !== year) return null;
    return buildReportFigures({
      ...current.base,
      asOfMonth: month,
      projects: current.projects,
      extraProjects: current.extraProjects,
      unnamedLabel,
      pastYears: past,
    });
  }, [current, past, year, month, unnamedLabel]);

  /* ---------------- written content ---------------- */

  const key = reportMonthKey(year, month);
  const fallbackDate = defaultReportDate(year, month);
  const [report, setReport] = useState<ReportContentState>(() => ({
    status: 'loading',
    key,
    saved: null,
    carriedFrom: null,
    content: emptyReportContent(fallbackDate),
  }));
  const reportSeq = useRef(0);

  const loadReport = useCallback(async () => {
    const seq = ++reportSeq.current;
    const date = defaultReportDate(year, month);
    setReport(prev => ({ ...prev, status: 'loading', key: reportMonthKey(year, month) }));
    try {
      const saved = await reportService.get(year, month, date);
      // Another month may have been picked while the first request was out.
      if (seq !== reportSeq.current) return;
      const carriedFrom = saved ? null : await reportService.getLatestBefore(year, month, date);
      if (seq !== reportSeq.current) return;
      // A month carried over keeps the earlier text, but is "as of" its own date.
      const content = saved?.content
        ?? (carriedFrom ? { ...carriedFrom.content, reportDate: date } : emptyReportContent(date));
      setReport({ status: 'ready', key: reportMonthKey(year, month), saved, carriedFrom, content });
    } catch (loadError) {
      if (seq !== reportSeq.current) return;
      // ReportService has already logged the request's error.
      const missing = loadError instanceof ReportTableMissingError;
      setReport({
        status: missing ? 'missing' : 'error',
        key: reportMonthKey(year, month),
        saved: null,
        carriedFrom: null,
        content: emptyReportContent(date),
      });
    }
  }, [year, month]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const save = useCallback(async (content: ReportContent): Promise<SavedReport> => {
    const saved = await reportService.save(year, month, content);
    // Only if that month is still the one on screen.
    setReport(prev => (prev.key === saved.id
      ? { status: 'ready', key: saved.id, saved, carriedFrom: null, content: saved.content }
      : prev));
    return saved;
  }, [year, month]);

  const reload = useCallback(() => {
    void loadFigures();
  }, [loadFigures]);

  const reloadReport = useCallback(() => {
    void loadReport();
  }, [loadReport]);

  // Until the load for a new month lands, the state still describes the old one.
  const reportForKey: ReportContentState = report.key === key
    ? report
    : { status: 'loading', key, saved: null, carriedFrom: null, content: emptyReportContent(fallbackDate) };

  return {
    loading: loading || (!error && figures === null),
    error,
    reload,
    hasRecords: (current?.records.length ?? 0) > 0,
    figures,
    report: reportForKey,
    reloadReport,
    save,
  };
}
