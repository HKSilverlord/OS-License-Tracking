
import { BaseService } from './BaseService';
import { buildPriceIndex, lookupPrices } from './pricing';
import type { PeriodProjectPriceRow, ProjectPriceRow } from './pricing';
import { createLogger } from '../src/core/logger';
import { DashboardRecord } from '../types';

const log = createLogger('DashboardService');

const DEFAULT_SETTINGS = {
    exchangeRate: 165,
    licenseComputers: 7,
    licensePerComputer: 2517143,
    unitPrice: 2300
};

const HOURS_PER_DAY = 8;

/** Monthly record joined with the (fallback) global prices of its project. */
interface AggregationRecordRow {
    year: number;
    month: number;
    project_id: string;
    period_label: string | null;
    planned_hours: number | null;
    actual_hours: number | null;
    projects: ProjectPriceRow | null;
}

/** Pure: number of Mon–Fri days in the given month (month is 1-based). */
export function weekdaysInMonth(year: number, month: number): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    let weekdays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) weekdays++;
    }
    return weekdays;
}

/** Distinct, non-empty period labels carried by the records. */
const collectPeriodLabels = (rows: readonly AggregationRecordRow[]): string[] => {
    const labels = new Set<string>();
    for (const row of rows) {
        if (row.period_label) labels.add(row.period_label);
    }
    return Array.from(labels);
};

/** Distinct project rows carried by the nested join — the fallback tier of the price index. */
const collectProjects = (rows: readonly AggregationRecordRow[]): ProjectPriceRow[] => {
    const projects = new Map<string, ProjectPriceRow>();
    for (const row of rows) {
        const project = row.projects;
        if (!project) continue;
        const id = project.id || row.project_id;
        if (!id || projects.has(id)) continue;
        projects.set(id, { ...project, id });
    }
    return Array.from(projects.values());
};

export class DashboardService extends BaseService {

    // --- Settings (Often used in dashboard contexts) ---

    async getSettings() {
        const { data, error } = await this.supabase
            .from('settings')
            .select('*')
            .eq('label', 'default')
            .single();

        if (error || !data) return DEFAULT_SETTINGS;

        // Map DB columns to app keys
        return {
            exchangeRate: data.exchange_rate,
            licenseComputers: data.license_computers,
            licensePerComputer: data.license_per_computer,
            unitPrice: data.unit_price
        };
    }

    async saveSettings(settings: any) {
        // First get current to merge
        const current = await this.getSettings();
        const merged = { ...current, ...settings };

        const { data, error } = await this.supabase
            .from('settings')
            .upsert({
                label: 'default',
                exchange_rate: merged.exchangeRate,
                license_computers: merged.licenseComputers,
                license_per_computer: merged.licensePerComputer,
                unit_price: merged.unitPrice
            }, { onConflict: 'label' })
            .select()
            .single();

        if (error) throw error;

        return {
            exchangeRate: data.exchange_rate,
            licenseComputers: data.license_computers,
            licensePerComputer: data.license_per_computer,
            unitPrice: data.unit_price
        };
    }

    // --- Statistics and Aggregation ---

    /**
     * Every `monthly_records` row for the year, unpriced.
     *
     * Callers price each row themselves via `lookupPrices(index, period_label, project_id)`
     * against the index from `getYearProjectPrices(year)` — the price lives on the
     * `period_projects` junction, so a project can cost different amounts in H1 and H2 and
     * cannot be priced from the `projects` row alone. This used to embed
     * `projects(unit_price, plan_price, actual_price)` and flatten it with its own
     * `||` fallback chain; that was a second copy of the rule frozen in
     * `services/pricing.ts`, so it is gone. The query is otherwise identical to
     * `RecordService.getAllRecords(year)`, which is what keeps the Excel TOTAL row equal
     * to the Dashboard gross KPI.
     */
    async getDashboardStats(year: number): Promise<DashboardRecord[]> {
        const { data, error } = await this.supabase
            .from('monthly_records')
            .select('*')
            .eq('year', year);

        if (error) throw error;

        return (data || []) as DashboardRecord[];
    }

    async getRecordYears() {
        // Get unique years from records
        const { data, error } = await this.supabase
            .from('monthly_records')
            .select('year');

        if (error) return []; // Return empty on error or handle it

        const years = Array.from(new Set(data?.map((r: { year: number }) => r.year) || [])).sort((a, b) => b - a);
        return years as number[];
    }

    /**
     * Loads the `period_projects` rows for the periods the given records belong to and
     * builds the (period_label, project_id) -> price index used to value every record.
     * The nested `projects(...)` join on the records supplies the global fallback tier.
     */
    private async buildIndexForRecords(rows: readonly AggregationRecordRow[]) {
        const labels = collectPeriodLabels(rows);
        const projects = collectProjects(rows);

        if (labels.length === 0) return buildPriceIndex([], projects);

        const { data, error } = await this.supabase
            .from('period_projects')
            .select('period_label, project_id, plan_price, actual_price')
            .in('period_label', labels);

        if (error) {
            // Pricing must not take the whole dashboard down: fall back to global project prices.
            log.error('Failed to load period_projects prices, falling back to project prices:', error);
            return buildPriceIndex([], projects);
        }

        const periodRows: PeriodProjectPriceRow[] = data || [];
        return buildPriceIndex(periodRows, projects);
    }

    async getYearlyAggregatedData(startYear: number, endYear: number) {
        // Fetch all monthly records and projects for the year range
        const { data: records, error } = await this.supabase
            .from('monthly_records')
            .select(`
        *,
        projects (
          id,
          plan_price,
          actual_price,
          unit_price
        )
      `)
            .gte('year', startYear)
            .lte('year', endYear);

        if (error) throw error;

        const rows: AggregationRecordRow[] = records || [];
        // Price per (period_label, project_id) — a project may cost differently in H1 and H2 (A1).
        const index = await this.buildIndexForRecords(rows);

        // Aggregate by year
        const yearlyData: Record<number, {
            salesPlan: number;
            salesActual: number;
            totalPlanHours: number;
            totalActualHours: number;
            priceSum: number;
            projectCount: number;
        }> = {};

        // Initialize years
        for (let year = startYear; year <= endYear; year++) {
            yearlyData[year] = {
                salesPlan: 0,
                salesActual: 0,
                totalPlanHours: 0,
                totalActualHours: 0,
                priceSum: 0,
                projectCount: 0
            };
        }

        // Aggregate data
        rows.forEach((record) => {
            const year = record.year;
            if (!yearlyData[year]) return;

            const { plan: planPrice, actual: actualPrice } =
                lookupPrices(index, record.period_label || '', record.project_id);

            yearlyData[year].salesPlan += (record.planned_hours || 0) * planPrice;
            yearlyData[year].salesActual += (record.actual_hours || 0) * actualPrice;
            yearlyData[year].totalPlanHours += record.planned_hours || 0;
            yearlyData[year].totalActualHours += record.actual_hours || 0;
            yearlyData[year].priceSum += planPrice;
            yearlyData[year].projectCount += 1;
        });

        // Convert to array with calculated average hourly rates
        return Object.entries(yearlyData).map(([year, data]) => ({
            year: parseInt(year),
            salesPlan: Math.round(data.salesPlan / 10000), // Convert to 万円
            salesActual: data.salesActual > 0 ? Math.round(data.salesActual / 10000) : null, // 万円, null if no actual
            hourlyRatePlan: data.projectCount > 0 ? Math.round(data.priceSum / data.projectCount) : null, // Average price
            hourlyRateActual: data.totalActualHours > 0
                ? Math.round((data.salesActual / data.totalActualHours))
                : null // Actual average rate, null if no hours
        }));
    }

    async getMonthlyAggregatedData(year: number) {
        // Fetch all monthly records for the specified year
        const { data: records, error } = await this.supabase
            .from('monthly_records')
            .select(`
        *,
        projects (
          id,
          plan_price,
          actual_price,
          unit_price
        )
      `)
            .eq('year', year);

        if (error) throw error;

        const rows: AggregationRecordRow[] = records || [];
        // Price per (period_label, project_id) — H1 and H2 prices must not be mixed up (A1).
        const index = await this.buildIndexForRecords(rows);

        // Initialize 12 months
        const monthlyData: Record<number, {
            workingHoursPlan: number;
            workingHoursActual: number;
            salesPlan: number;
            salesActual: number;
        }> = {};

        for (let month = 1; month <= 12; month++) {
            monthlyData[month] = {
                workingHoursPlan: 0,
                workingHoursActual: 0,
                salesPlan: 0,
                salesActual: 0
            };
        }

        // Aggregate data by month
        rows.forEach((record) => {
            const month = record.month;
            if (!monthlyData[month]) return;

            const { plan: planPrice, actual: actualPrice } =
                lookupPrices(index, record.period_label || '', record.project_id);

            monthlyData[month].workingHoursPlan += record.planned_hours || 0;
            monthlyData[month].workingHoursActual += record.actual_hours || 0;
            monthlyData[month].salesPlan += (record.planned_hours || 0) * planPrice;
            monthlyData[month].salesActual += (record.actual_hours || 0) * actualPrice;
        });

        // Convert to array
        return Object.entries(monthlyData).map(([month, data]) => ({
            month: parseInt(month),
            workingHoursPlan: Math.round(data.workingHoursPlan),
            workingHoursActual: Math.round(data.workingHoursActual),
            salesPlan: Math.round(data.salesPlan / 10000), // Convert to 万円
            salesActual: Math.round(data.salesActual / 10000) // Convert to 万円
        }));
    }

    async getCapacityLine(year: number) {
        // Get license settings to calculate capacity
        const settings = await this.getSettings();

        // Capacity = license_computers × Mon–Fri days of that month × hours_per_day
        return Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            return {
                month,
                capacity: settings.licenseComputers * weekdaysInMonth(year, month) * HOURS_PER_DAY
            };
        });
    }
}

export const dashboardService = new DashboardService();
