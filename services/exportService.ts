import type { MonthlyRecord, Project } from '../types';
import { dbService } from './dbService';
import { lookupPrices, priceKey } from './pricing';
import { createLogger } from '../utils/logger';

const log = createLogger('exportService');

type Cell = string | number;

const PROJECT_HEADERS: Cell[] = [
  'Period',
  'Code',
  'Name',
  'Type',
  'Status',
  'Plan Price',
  'Actual Price',
  'Planned Hrs',
  'Actual Hrs',
  'Planned Revenue',
  'Actual Revenue'
];

const MONTHLY_HEADERS: Cell[] = [
  'Period',
  'Code',
  'Name',
  'Year',
  'Month',
  'Planned Hrs',
  'Actual Hrs',
  'Plan Price',
  'Actual Price',
  'Planned Revenue',
  'Actual Revenue'
];

interface HourTotals {
  planned: number;
  actual: number;
}

const emptyTotals = (): HourTotals => ({ planned: 0, actual: 0 });

/**
 * Builds and downloads `OS_Management_<year>_<yyyy-mm-dd>.xlsx`.
 *
 * Sheet "Projects": one row per (period, project) plus a final TOTAL row.
 * Sheet "Monthly": one row per monthly_record.
 *
 * Revenue is always hours × the price of that (period, project) pair resolved through the
 * frozen rule in `services/pricing.ts`, so the TOTAL row matches the Dashboard gross KPI
 * for the same year. The deprecated `projects.unit_price` is only ever the last fallback.
 */
export async function exportYearToExcel(year: number): Promise<void> {
  const [yearPrices, records] = await Promise.all([
    dbService.getYearProjectPrices(year),
    dbService.getAllRecords(year)
  ]);

  const { index, periodLabels, projectsByPeriod } = yearPrices;

  const projectsById = new Map<string, Project>();
  for (const project of yearPrices.projects) projectsById.set(project.id, project);

  // Hours summed per (period, project)
  const hoursByPair = new Map<string, HourTotals>();
  const allRecords: MonthlyRecord[] = records || [];

  for (const record of allRecords) {
    const period = record.period_label || '';
    const key = priceKey(period, record.project_id);
    const totals = hoursByPair.get(key) ?? emptyTotals();
    totals.planned += Number(record.planned_hours) || 0;
    totals.actual += Number(record.actual_hours) || 0;
    hoursByPair.set(key, totals);
  }

  // Ordered (period, project) pairs: everything linked to a period of the year first,
  // then any pair that only shows up in the records (orphaned link) so no hours are lost.
  const orderedPairs: Array<{ period: string; projectId: string }> = [];
  const seenPairs = new Set<string>();

  const pushPair = (period: string, projectId: string): void => {
    const key = priceKey(period, projectId);
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    orderedPairs.push({ period, projectId });
  };

  for (const label of periodLabels) {
    for (const project of projectsByPeriod[label] || []) pushPair(label, project.id);
  }
  for (const record of allRecords) pushPair(record.period_label || '', record.project_id);

  let totalPlannedHours = 0;
  let totalActualHours = 0;
  let totalPlannedRevenue = 0;
  let totalActualRevenue = 0;

  const projectRows: Cell[][] = orderedPairs.map(({ period, projectId }) => {
    const project = projectsById.get(projectId);
    const hours = hoursByPair.get(priceKey(period, projectId)) ?? emptyTotals();
    const prices = lookupPrices(index, period, projectId);

    const plannedRevenue = hours.planned * prices.plan;
    const actualRevenue = hours.actual * prices.actual;

    totalPlannedHours += hours.planned;
    totalActualHours += hours.actual;
    totalPlannedRevenue += plannedRevenue;
    totalActualRevenue += actualRevenue;

    return [
      period,
      project?.code ?? projectId,
      project?.name ?? '',
      project?.type ?? '',
      project?.status ?? '',
      prices.plan,
      prices.actual,
      hours.planned,
      hours.actual,
      plannedRevenue,
      actualRevenue
    ];
  });

  const totalRow: Cell[] = [
    'TOTAL', '', '', '', '', '', '',
    totalPlannedHours,
    totalActualHours,
    totalPlannedRevenue,
    totalActualRevenue
  ];

  const pairOrder = new Map<string, number>();
  orderedPairs.forEach(({ period, projectId }, i) => pairOrder.set(priceKey(period, projectId), i));

  const monthlyRows: Cell[][] = [...allRecords]
    .sort((a, b) => {
      const aKey = pairOrder.get(priceKey(a.period_label || '', a.project_id)) ?? Number.MAX_SAFE_INTEGER;
      const bKey = pairOrder.get(priceKey(b.period_label || '', b.project_id)) ?? Number.MAX_SAFE_INTEGER;
      if (aKey !== bKey) return aKey - bKey;
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
    .map(record => {
      const period = record.period_label || '';
      const project = projectsById.get(record.project_id);
      const prices = lookupPrices(index, period, record.project_id);
      const planned = Number(record.planned_hours) || 0;
      const actual = Number(record.actual_hours) || 0;

      return [
        period,
        project?.code ?? record.project_id,
        project?.name ?? '',
        record.year,
        record.month,
        planned,
        actual,
        prices.plan,
        prices.actual,
        planned * prices.plan,
        actual * prices.actual
      ];
    });

  // xlsx is the single heaviest dependency in the app and is only reachable
  // through this one export button, so it is fetched on demand.
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([PROJECT_HEADERS, ...projectRows, totalRow]),
    'Projects'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([MONTHLY_HEADERS, ...monthlyRows]),
    'Monthly'
  );

  log.debug('Exporting year', year, '-', projectRows.length, 'project rows,', monthlyRows.length, 'monthly rows');

  XLSX.writeFile(wb, `OS_Management_${year}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
