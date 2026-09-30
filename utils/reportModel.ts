/**
 * The business status report (事業状況報告): what the report page shows and
 * what its PowerPoint export draws. See docs/business-report.md.
 *
 * A report has two halves:
 * - `ReportFigures` are computed from the database, the same way the Dashboard
 *   computes them, so the two can never disagree. Nobody types these.
 * - `ReportContent` is what an admin writes: status notes, focus projects,
 *   people and actions. It is saved per report month in `business_reports`.
 *
 * Free text follows the template's bilingual convention: the first line is the
 * main text (usually Japanese), and any further lines are its translation
 * (usually Vietnamese), drawn smaller underneath.
 */

/** One project's line in "hours by customer". Projects are the customers here. */
export interface ReportCustomerFigures {
  projectId: string;
  code: string;
  name: string;
  /** Actual hours from January to the report month. */
  hoursActual: number;
  /** Actual revenue in JPY over the same months, hours × that period's price. */
  revenueActual: number;
  /** Actual hourly price in JPY for the report month's period; null when unset. */
  rate: number | null;
}

/** Actuals of an earlier year over the same months (January to the report month). */
export interface ReportPastYear {
  year: number;
  hoursActual: number;
  revenueActual: number;
}

export interface ReportFigures {
  year: number;
  /** 1–12; figures cover January to this month inclusive. */
  asOfMonth: number;
  hoursActual: number;
  /** The year's planned hours: the annual target. */
  hoursPlanYear: number;
  /** Planned hours from January to the report month. */
  hoursPlanToDate: number;
  /** JPY. */
  revenueActual: number;
  revenuePlanYear: number;
  revenuePlanToDate: number;
  /** hoursActual / hoursPlanYear, 0–1+; null when there is no plan. */
  achievementRate: number | null;
  /** revenueActual / revenuePlanYear; null when there is no plan. */
  revenueRate: number | null;
  /** Projects with actual hours first, most hours first; then the rest by display order. */
  customers: ReportCustomerFigures[];
  /** Projects with actual hours above zero in the window. */
  customersWithActuals: number;
  /** The two years before, same months; oldest first. Empty when unknown. */
  pastYears: ReportPastYear[];
}

/** Status and part count an admin keeps for one project. */
export interface ReportCustomerNote {
  /** e.g. "案件完了／次期案件を継続提案\nDự án đã hoàn thành…" */
  status: string;
  /** Parts designed; null when not reported. */
  parts: number | null;
}

export interface ReportFocusProject {
  name: string;
  /** Marks a new customer (新規顧客). */
  isNew: boolean;
  /** Short state label, e.g. 対応中 or 確認中. */
  stage: string;
  parts: number | null;
  /** Numbered points ①②③. */
  points: string[];
}

export interface ReportStaffChange {
  /** Free text, e.g. "4月", "9/25", "現在". */
  when: string;
  text: string;
}

export interface ReportAction {
  title: string;
  points: string[];
}

export interface ReportContent {
  version: 1;
  /** ISO date the report is "as of", shown on the cover (e.g. 2026-09-28). */
  reportDate: string;
  /** The cover's one-line focus (重点). */
  focus: string;
  /** A highlighted customer story under the figures. */
  highlight: { title: string; body: string };
  /** Keyed by project id. */
  customers: Record<string, ReportCustomerNote>;
  /** Other customers with results, e.g. "※ FALTEC / Koizumi も実績あり". */
  otherCustomers: string;
  focusProjects: ReportFocusProject[];
  /** The policy line under customers and focus projects (方針). */
  policy: string;
  training: {
    title: string;
    points: string[];
    /** Trainees (KS students). */
    trainees: number | null;
    /** Seats or licences available for training (e.g. NX). */
    seats: number | null;
    /** e.g. "次講座：3週目まで進行". */
    progress: string;
  };
  staffing: {
    /** Headcount the team is sized for. */
    planned: number | null;
    current: number | null;
    changes: ReportStaffChange[];
    /** 課題. */
    issues: string;
  };
  /** Three priority themes, each with points. */
  actions: ReportAction[];
  /** マネジメント上の最優先. */
  priority: string;
}

/** Everything the page and the export need. */
export interface ReportModel {
  figures: ReportFigures;
  content: ReportContent;
}

/** `YYYY-MM`, the key of a saved report. */
export const reportMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

export const emptyReportContent = (reportDate: string): ReportContent => ({
  version: 1,
  reportDate,
  focus: '',
  highlight: { title: '', body: '' },
  customers: {},
  otherCustomers: '',
  focusProjects: [],
  policy: '',
  training: { title: '', points: [], trainees: null, seats: null, progress: '' },
  staffing: { planned: null, current: null, changes: [], issues: '' },
  actions: [
    { title: '', points: [] },
    { title: '', points: [] },
    { title: '', points: [] },
  ],
  priority: '',
});

/** The largest count each kind of number field takes; anything above is a typo. */
export const REPORT_COUNT_MAX = {
  parts: 9999,
  headcount: 999,
  trainees: 999,
  seats: 999,
} as const;

// Line and paragraph separators a paste can bring in (Word and PowerPoint use
// U+000B, U+000C, U+0085, U+2028 and U+2029), read as ordinary line breaks.
const LINE_BREAKS = /\r\n?|[\v\f\u0085\u2028\u2029]/g;
// Control characters (C0 and C1), noncharacters and lone surrogates: nothing a
// person means to type, and some of them make the PowerPoint file unreadable.
// Tabs and line breaks stay. With the `u` flag the surrogate range matches only
// a lone half, never a pair.
// eslint-disable-next-line no-control-regex
const UNWANTED = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]|[\uD800-\uDFFF]/gu;

/** Report text with stray control characters removed, as it is shown and saved. */
export const sanitizeReportText = (text: string): string =>
  text.replace(LINE_BREAKS, '\n').replace(UNWANTED, '');

/** Splits bilingual free text into its main line and the translation below it. */
export const splitBilingual = (text: string): { main: string; sub: string } => {
  // Blank lines above the text are not a missing main line.
  const [main = '', ...rest] = text.replace(/^(?:[ \t]*\n)+/, '').split('\n');
  return { main: main.trim(), sub: rest.join('\n').trim() };
};
