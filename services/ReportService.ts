/**
 * ReportService
 *
 * The written half of the business report (docs/business-report.md): one row per
 * report month in `public.business_reports` (db/migration_business_reports.sql),
 * `id = 'YYYY-MM'`, the text in `content jsonb`.
 *
 * Until that migration has been run the table does not exist. The report's
 * figures do not depend on it, so a missing table is a state of its own
 * (`ReportTableMissingError`), never a crash: the page shows every figure and
 * tells an admin what to run.
 *
 * Whatever a row holds, it is read onto `emptyReportContent`, field by field, so
 * an old, partial or hand-edited row cannot break the page. The same reading is
 * applied before a save, so what is stored is always clean.
 */
import { BaseService } from './BaseService';
import { emptyReportContent, REPORT_COUNT_MAX, reportMonthKey, sanitizeReportText } from '../utils/reportModel';
import type {
  ReportAction,
  ReportContent,
  ReportCustomerNote,
  ReportFocusProject,
  ReportStaffChange,
} from '../utils/reportModel';

const REPORT_TABLE = 'business_reports';
export const REPORT_MIGRATION_FILE = 'db/migration_business_reports.sql';

export interface SavedReport {
  /** `YYYY-MM`. */
  id: string;
  year: number;
  month: number;
  content: ReportContent;
}

/** The table has not been created yet: run db/migration_business_reports.sql. */
export class ReportTableMissingError extends Error {
  constructor() {
    super(`Table public.${REPORT_TABLE} does not exist`);
    this.name = 'ReportTableMissingError';
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * PostgREST answers a query on a table it does not know with `PGRST205`
 * ("Could not find the table … in the schema cache"); Postgres itself with
 * `42P01` (undefined_table).
 */
export const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as PostgrestLikeError;
  if (code === '42P01' || code === 'PGRST205') return true;
  return typeof message === 'string' && message.includes('Could not find the table');
};

/* ------------------------------------------------------------------ *
 * Normalising a stored document
 * ------------------------------------------------------------------ */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  sanitizeReportText(
    typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '',
  );

/**
 * A whole number from 0 to `max`, or null. A fraction is rounded, as the deck
 * would round it; a negative number or one above `max` is dropped.
 */
const readReportCount = (value: unknown, max: number): number | null => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) return null;
  const whole = Math.round(number);
  return whole <= max ? whole : null;
};

const texts = (value: unknown): string[] => (Array.isArray(value) ? value.map(text) : []);

const list = <T>(value: unknown, read: (item: Record<string, unknown>) => T): T[] =>
  Array.isArray(value) ? value.filter(isPlainObject).map(read) : [];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The template has three priority themes. */
const ACTION_COUNT = 3;

/** A note with neither a status nor a part count says nothing, so it is not kept. */
const isEmptyNote = (note: ReportCustomerNote): boolean => note.status.trim() === '' && note.parts === null;

/** Reads anything onto a complete `ReportContent`; missing or malformed parts fall back to empty. */
export function normalizeReportContent(raw: unknown, fallbackDate: string): ReportContent {
  const base = emptyReportContent(fallbackDate);
  if (!isPlainObject(raw)) return base;

  const reportDate = text(raw.reportDate);
  const highlight = isPlainObject(raw.highlight) ? raw.highlight : {};
  const training = isPlainObject(raw.training) ? raw.training : {};
  const staffing = isPlainObject(raw.staffing) ? raw.staffing : {};

  const customers: Record<string, ReportCustomerNote> = {};
  if (isPlainObject(raw.customers)) {
    // Sorted, so the same notes always read back the same, whatever order they were typed in.
    for (const [id, note] of Object.entries(raw.customers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!isPlainObject(note)) continue;
      const read = { status: text(note.status), parts: readReportCount(note.parts, REPORT_COUNT_MAX.parts) };
      if (!isEmptyNote(read)) customers[id] = read;
    }
  }

  const focusProjects = list<ReportFocusProject>(raw.focusProjects, item => ({
    name: text(item.name),
    isNew: item.isNew === true,
    stage: text(item.stage),
    parts: readReportCount(item.parts, REPORT_COUNT_MAX.parts),
    points: texts(item.points),
  }));

  const changes = list<ReportStaffChange>(staffing.changes, item => ({
    when: text(item.when),
    text: text(item.text),
  }));

  // Exactly three themes: fewer are padded, and any beyond the third dropped.
  const actions = list<ReportAction>(raw.actions, item => ({
    title: text(item.title),
    points: texts(item.points),
  })).slice(0, ACTION_COUNT);
  while (actions.length < ACTION_COUNT) actions.push({ title: '', points: [] });

  return {
    version: 1,
    reportDate: ISO_DATE.test(reportDate) ? reportDate : base.reportDate,
    focus: text(raw.focus),
    highlight: { title: text(highlight.title), body: text(highlight.body) },
    customers,
    otherCustomers: text(raw.otherCustomers),
    focusProjects,
    policy: text(raw.policy),
    training: {
      title: text(training.title),
      points: texts(training.points),
      trainees: readReportCount(training.trainees, REPORT_COUNT_MAX.trainees),
      seats: readReportCount(training.seats, REPORT_COUNT_MAX.seats),
      progress: text(training.progress),
    },
    staffing: {
      planned: readReportCount(staffing.planned, REPORT_COUNT_MAX.headcount),
      current: readReportCount(staffing.current, REPORT_COUNT_MAX.headcount),
      changes,
      issues: text(staffing.issues),
    },
    actions,
    priority: text(raw.priority),
  };
}

/**
 * Whether two reports say the same thing once both are read the way a save
 * would store them: an emptied customer note or a note typed in another order
 * is not a change.
 */
export const sameReportContent = (a: ReportContent, b: ReportContent): boolean =>
  a === b ||
  JSON.stringify(normalizeReportContent(a, a.reportDate)) === JSON.stringify(normalizeReportContent(b, b.reportDate));

interface ReportRow {
  id: string;
  year: number | null;
  month: number | null;
  content: unknown;
}

const COLUMNS = 'id, year, month, content';

/** `2026-09` -> [2026, 9]; null for anything else. */
const parseKey = (id: string): [number, number] | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(id);
  return match ? [Number(match[1]), Number(match[2])] : null;
};

/** A project's name and code, looked up by id. */
export interface ProjectName {
  id: string;
  code: string | null;
  name: string | null;
}

export class ReportService extends BaseService {
  constructor() {
    super('ReportService');
  }

  private toSaved(row: ReportRow, fallbackDate: string): SavedReport {
    const [year, month] = parseKey(row.id) ?? [row.year ?? 0, row.month ?? 0];
    return {
      id: row.id,
      year: row.year ?? year,
      month: row.month ?? month,
      content: normalizeReportContent(row.content, fallbackDate),
    };
  }

  /** Throws `ReportTableMissingError` for a missing table, the error itself otherwise. */
  private check(error: unknown): void {
    if (!error) return;
    if (isMissingTableError(error)) throw new ReportTableMissingError();
    this.log.error('business_reports request failed:', error);
    throw error;
  }

  /** The report saved for this month, or null when there is none. */
  async get(year: number, month: number, fallbackDate: string): Promise<SavedReport | null> {
    const { data, error } = await this.supabase
      .from(REPORT_TABLE)
      .select(COLUMNS)
      .eq('id', reportMonthKey(year, month))
      .maybeSingle();
    this.check(error);
    return data ? this.toSaved(data as ReportRow, fallbackDate) : null;
  }

  /** The latest report saved before this month, to start a new month from. */
  async getLatestBefore(year: number, month: number, fallbackDate: string): Promise<SavedReport | null> {
    const { data, error } = await this.supabase
      .from(REPORT_TABLE)
      .select(COLUMNS)
      .lt('id', reportMonthKey(year, month))
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    this.check(error);
    return data ? this.toSaved(data as ReportRow, fallbackDate) : null;
  }

  /**
   * Writes this month's report, cleaned the way a load would read it. RLS lets
   * only admins write; `updated_by` is set by the database. Throws on failure
   * so the caller keeps the edits.
   */
  async save(year: number, month: number, content: ReportContent): Promise<SavedReport> {
    const clean = normalizeReportContent(content, content.reportDate);
    const row = {
      id: reportMonthKey(year, month),
      year,
      month,
      content: clean,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.from(REPORT_TABLE).upsert(row, { onConflict: 'id' });
    this.check(error);
    return { id: row.id, year, month, content: clean };
  }

  /**
   * Names for projects that have hours in a year but no link to any of its
   * periods, so the report can list them by name. Ids it cannot find are left out.
   */
  async getProjectNames(ids: readonly string[]): Promise<ProjectName[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase
      .from('projects')
      .select('id, code, name')
      .in('id', [...ids]);
    if (error) {
      this.log.warn('Could not look up project names:', error);
      throw error;
    }
    return (data ?? []) as ProjectName[];
  }
}

export const reportService = new ReportService();
