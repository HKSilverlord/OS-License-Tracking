import type { Project } from '../types';

export type PriceSource = 'period' | 'project' | 'unit_price' | 'none';

export interface PeriodProjectPriceRow {
  period_label: string;
  project_id: string;
  plan_price: number | null;
  actual_price: number | null;
}

/** Subset of `projects` needed for fallback pricing. */
export type ProjectPriceRow = Pick<Project, 'id' | 'plan_price' | 'actual_price' | 'unit_price'>;

export interface ResolvedPrices {
  plan: number;          // never NaN, never negative, 0 when unset
  actual: number;
  planSource: PriceSource;
  actualSource: PriceSource;
}

export interface PriceIndex {
  /** key = priceKey(period_label, project_id) */
  byPeriodProject: ReadonlyMap<string, PeriodProjectPriceRow>;
  /** key = project id */
  byProject: ReadonlyMap<string, ProjectPriceRow>;
}

export function priceKey(periodLabel: string, projectId: string): string {
  return `${periodLabel}::${projectId}`;
}

/**
 * A candidate price counts as "set" only when it is a finite number greater than zero.
 * That reproduces the `||` fall-through exactly (null and 0 both mean "unset") while
 * also rejecting NaN/Infinity and negative values, so `ResolvedPrices` can guarantee
 * a finite, non-negative number.
 */
const usablePrice = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
};

type PriceCandidate = readonly [number | null | undefined, PriceSource];

const pick = (candidates: readonly PriceCandidate[]): { value: number; source: PriceSource } => {
  for (const [raw, source] of candidates) {
    const value = usablePrice(raw);
    if (value !== null) return { value, source };
  }
  return { value: 0, source: 'none' };
};

/**
 * FROZEN RESOLUTION RULE (identical to what the UI renders today; `||` on purpose:
 * null AND 0 both mean "unset", so they fall through to the next tier):
 *
 *   plan   = period?.plan_price   || project?.plan_price   || project?.unit_price || 0
 *   actual = period?.actual_price || project?.actual_price || project?.unit_price || 0
 *
 * Note that `actual` deliberately does NOT fall back to any `plan` price.
 * Non-finite inputs (NaN/Infinity) are treated as unset.
 * `planSource`/`actualSource` name the tier that supplied the value.
 */
export function resolvePrices(
  period: PeriodProjectPriceRow | null | undefined,
  project: ProjectPriceRow | null | undefined,
): ResolvedPrices {
  const plan = pick([
    [period?.plan_price, 'period'],
    [project?.plan_price, 'project'],
    [project?.unit_price, 'unit_price'],
  ]);

  const actual = pick([
    [period?.actual_price, 'period'],
    [project?.actual_price, 'project'],
    [project?.unit_price, 'unit_price'],
  ]);

  return {
    plan: plan.value,
    actual: actual.value,
    planSource: plan.source,
    actualSource: actual.source,
  };
}

export function buildPriceIndex(
  periodRows: readonly PeriodProjectPriceRow[],
  projects: readonly ProjectPriceRow[],
): PriceIndex {
  const byPeriodProject = new Map<string, PeriodProjectPriceRow>();
  for (const row of periodRows) {
    if (!row || !row.period_label || !row.project_id) continue;
    byPeriodProject.set(priceKey(row.period_label, row.project_id), row);
  }

  const byProject = new Map<string, ProjectPriceRow>();
  for (const project of projects) {
    if (!project || !project.id) continue;
    byProject.set(project.id, project);
  }

  return { byPeriodProject, byProject };
}

/** resolvePrices(index.byPeriodProject.get(priceKey(periodLabel, projectId)), index.byProject.get(projectId)) */
export function lookupPrices(index: PriceIndex, periodLabel: string, projectId: string): ResolvedPrices {
  return resolvePrices(
    index.byPeriodProject.get(priceKey(periodLabel, projectId)),
    index.byProject.get(projectId),
  );
}
