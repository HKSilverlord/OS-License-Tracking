/**
 * The business report's figures (docs/business-report.md), built from the same
 * rows and the same pricing as the Dashboard.
 *
 * Pure: the caller loads `getDashboardStats(year)` and `getYearProjectPrices(year)`
 * and hands the rows in. Every record goes through `priceRecord`, the
 * Dashboard's own pricing, into twelve monthly buckets in the same order the
 * Dashboard fills them, and totals are sums of those buckets. So for the same
 * year, with the report month at December (or past the last month with actuals),
 * the report's totals are the Dashboard's to the yen.
 */
import { lookupPrices, priceRecord } from '../services/pricing';
import type { PriceableRecord, PriceIndex } from '../services/pricing';
import type { ReportCustomerFigures, ReportFigures, ReportPastYear } from './reportModel';

/** What the report needs to know about a project to list it. */
export interface ReportProject {
  id: string;
  code?: string | null;
  name?: string | null;
  display_order?: number | null;
}

export interface ReportRecord extends PriceableRecord {
  month: number;
}

/** One year's rows, as loaded for the Dashboard. */
export interface ReportYearData {
  year: number;
  records: readonly ReportRecord[];
  index: PriceIndex;
}

export interface ReportFigureInput extends ReportYearData {
  /** 1–12: figures run from January to this month inclusive. */
  asOfMonth: number;
  /** The year's projects, in display order (`getYearProjectPrices(year).projects`). */
  projects: readonly ReportProject[];
  /** Earlier years to compare with over the same months; any order. */
  pastYears?: readonly ReportYearData[];
  /**
   * Names for projects that have hours but are not in `projects` (no link to
   * any of the year's periods), looked up separately.
   */
  extraProjects?: readonly ReportProject[];
  /** The name shown for a project whose name cannot be found at all. */
  unnamedLabel?: string;
}

export interface MonthBucket {
  plannedHours: number;
  actualHours: number;
  plannedRevenue: number;
  actualRevenue: number;
}

/** 1–12, clamped; anything unreadable is December. */
const clampMonth = (month: number): number =>
  Number.isFinite(month) ? Math.min(12, Math.max(1, Math.trunc(month))) : 12;

/** The half-year period a month belongs to: `2026-H2` for September 2026. */
const periodOfMonth = (year: number, month: number): string =>
  `${year}-${month <= 6 ? 'H1' : 'H2'}`;

/**
 * Twelve buckets, filled record by record in load order. The Dashboard's
 * monthly `stats` are these buckets with month names, so both add up alike.
 */
export function monthlyBuckets(records: readonly ReportRecord[], index: PriceIndex): MonthBucket[] {
  const buckets: MonthBucket[] = Array.from({ length: 12 }, () => ({
    plannedHours: 0,
    actualHours: 0,
    plannedRevenue: 0,
    actualRevenue: 0,
  }));
  for (const record of records) {
    if (record.month < 1 || record.month > 12) continue;
    const priced = priceRecord(record, index);
    const target = buckets[record.month - 1];
    target.plannedHours += priced.plannedHours;
    target.actualHours += priced.actualHours;
    target.plannedRevenue += priced.plannedRevenue;
    target.actualRevenue += priced.actualRevenue;
  }
  return buckets;
}

const sum = (buckets: readonly MonthBucket[], key: keyof MonthBucket, months = 12): number =>
  buckets.slice(0, months).reduce((acc, bucket) => acc + bucket[key], 0);

const ratio = (actual: number, plan: number): number | null => (plan > 0 ? actual / plan : null);

/** Actuals of one earlier year, January to `asOfMonth`. */
function pastYearFigures(data: ReportYearData, asOfMonth: number): ReportPastYear {
  const buckets = monthlyBuckets(data.records, data.index);
  const months = clampMonth(asOfMonth);
  return {
    year: data.year,
    hoursActual: sum(buckets, 'actualHours', months),
    revenueActual: sum(buckets, 'actualRevenue', months),
  };
}

export function buildReportFigures(input: ReportFigureInput): ReportFigures {
  const { year, records, index, projects } = input;
  const asOfMonth = clampMonth(input.asOfMonth);
  const buckets = monthlyBuckets(records, index);

  const hoursActual = sum(buckets, 'actualHours', asOfMonth);
  const hoursPlanYear = sum(buckets, 'plannedHours');
  const hoursPlanToDate = sum(buckets, 'plannedHours', asOfMonth);
  const revenueActual = sum(buckets, 'actualRevenue', asOfMonth);
  const revenuePlanYear = sum(buckets, 'plannedRevenue');
  const revenuePlanToDate = sum(buckets, 'plannedRevenue', asOfMonth);

  // Hours and revenue per project over the same window, priced the same way.
  const byProject = new Map<string, { hours: number; revenue: number }>();
  for (const record of records) {
    if (record.month < 1 || record.month > asOfMonth || !record.project_id) continue;
    const priced = priceRecord(record, index);
    const entry = byProject.get(record.project_id) ?? { hours: 0, revenue: 0 };
    entry.hours += priced.actualHours;
    entry.revenue += priced.actualRevenue;
    byProject.set(record.project_id, entry);
  }

  // Every project of the year, plus any project that has hours but is missing
  // from the year's list (a link removed after the hours went in), under the
  // name looked up for it.
  const listed = new Map<string, ReportProject>();
  for (const project of projects) {
    if (project?.id && !listed.has(project.id)) listed.set(project.id, project);
  }
  const extra = new Map((input.extraProjects ?? []).map(project => [project.id, project]));
  for (const id of byProject.keys()) {
    if (!listed.has(id)) listed.set(id, extra.get(id) ?? { id });
  }
  const unnamed = input.unnamedLabel ?? 'Unlinked project';

  const reportPeriod = periodOfMonth(year, asOfMonth);
  const order = Array.from(listed.values());
  const customers: ReportCustomerFigures[] = order.map(project => {
    const totals = byProject.get(project.id);
    const rate = lookupPrices(index, reportPeriod, project.id).actual;
    return {
      projectId: project.id,
      code: project.code ?? '',
      // Never the id itself: a UUID is not a name anyone can read.
      name: project.name?.trim() || project.code?.trim() || unnamed,
      hoursActual: totals?.hours ?? 0,
      revenueActual: totals?.revenue ?? 0,
      rate: rate > 0 ? rate : null,
    };
  });

  const position = new Map(order.map((project, i) => [project.id, i]));
  customers.sort((a, b) => {
    const aHas = a.hoursActual > 0;
    const bHas = b.hoursActual > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && a.hoursActual !== b.hoursActual) return b.hoursActual - a.hoursActual;
    return (position.get(a.projectId) ?? 0) - (position.get(b.projectId) ?? 0);
  });

  const pastYears = (input.pastYears ?? [])
    .map(data => pastYearFigures(data, asOfMonth))
    .sort((a, b) => a.year - b.year);

  return {
    year,
    asOfMonth,
    hoursActual,
    hoursPlanYear,
    hoursPlanToDate,
    revenueActual,
    revenuePlanYear,
    revenuePlanToDate,
    achievementRate: ratio(hoursActual, hoursPlanYear),
    revenueRate: ratio(revenueActual, revenuePlanYear),
    customers,
    customersWithActuals: customers.filter(c => c.hoursActual > 0).length,
    pastYears,
  };
}
