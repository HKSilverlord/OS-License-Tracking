
import { BaseService } from './BaseService';
import { DashboardRecord, Settings } from '../types';

const DEFAULT_SETTINGS = {
    exchangeRate: 165,
    licenseComputers: 7,
    licensePerComputer: 2517143,
    unitPrice: 2300
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

    async getDashboardStats(year: number) {
        // Fetch records and join with projects to get unit_price
        const { data, error } = await this.supabase
            .from('monthly_records')
            .select('*, projects(unit_price)')
            .eq('year', year);

        if (error) throw error;

        // Transform to match the expected shape:
        // { ...record, projects: { unit_price: x } }
        return (data || []).map((r: DashboardRecord) => ({
            ...r,
            projects: {
                unit_price: r.projects?.unit_price || 0,
                plan_price: (r.projects as any)?.plan_price || r.projects?.unit_price || 0,
                actual_price: (r.projects as any)?.actual_price || r.projects?.unit_price || 0
            }
        }));
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

    async getYearlyAggregatedData(startYear: number, endYear: number) {
        // Fetch all monthly records and projects for the year range
        const { data: records, error } = await this.supabase
            .from('monthly_records')
            .select(`
        *,
        projects (
          plan_price,
          actual_price,
          unit_price
        )
      `)
            .gte('year', startYear)
            .lte('year', endYear);

        if (error) throw error;

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
        (records || []).forEach((record: any) => {
            const year = record.year;
            if (!yearlyData[year]) return;

            const project = record.projects;
            const planPrice = project?.plan_price || project?.unit_price || 0;
            const actualPrice = project?.actual_price || project?.unit_price || 0;

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
          plan_price,
          actual_price,
          unit_price
        )
      `)
            .eq('year', year);

        if (error) throw error;

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
        (records || []).forEach((record: any) => {
            const month = record.month;
            if (!monthlyData[month]) return;

            const project = record.projects;
            const planPrice = project?.plan_price || project?.unit_price || 0;
            const actualPrice = project?.actual_price || project?.unit_price || 0;

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

        // Typical working days per month (can be customized)
        const workingDaysPerMonth = [20, 19, 21, 21, 20, 21, 21, 22, 21, 22, 20, 20]; // 2024-ish average
        const hoursPerDay = 8; // Standard work day

        // Capacity = license_computers × working_days × hours_per_day
        return workingDaysPerMonth.map((days, index) => ({
            month: index + 1,
            capacity: settings.licenseComputers * days * hoursPerDay
        }));
    }
}

export const dashboardService = new DashboardService();
