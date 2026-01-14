
import { BaseService } from './BaseService';

export class PeriodService extends BaseService {

    async getPeriods() {
        const { data, error } = await this.supabase
            .from('periods')
            .select('label')
            .order('label', { ascending: false });

        if (error) return [];
        return data.map((p: any) => p.label);
    }

    async addPeriod(label: string) {
        // Need to parse year and half from label "YYYY-HX"
        const [yearStr, half] = label.split('-');
        const year = parseInt(yearStr);

        const { error } = await this.supabase
            .from('periods')
            .insert({ label, year, half });

        if (error && error.code !== '23505') { // Ignore unique violation
            throw error;
        }

        return this.getPeriods();
    }

    /**
     * Get all periods with project counts and metadata
     */
    async getPeriodsWithProjectCount() {
        const { data: periods, error: periodsError } = await this.supabase
            .from('periods')
            .select('label, year, half, created_at')
            .order('year', { ascending: false })
            .order('half', { ascending: false });

        if (periodsError) throw periodsError;

        // For each period, count projects
        const periodsWithCount = await Promise.all(
            (periods || []).map(async (period) => {
                const { count, error: countError } = await this.supabase
                    .from('period_projects')
                    .select('*', { count: 'exact', head: true })
                    .eq('period_label', period.label);

                if (countError) console.error('Error counting projects:', countError);

                return {
                    ...period,
                    project_count: count || 0
                };
            })
        );

        return periodsWithCount;
    }

    /**
     * Create a new period and assign projects to it
     */
    async createPeriodWithProjects(year: number, half: 'H1' | 'H2', projectIds: string[]) {
        const label = `${year}-${half}`;

        // 1. Create period (or get existing)
        const { data: period, error: periodError } = await this.supabase
            .from('periods')
            .upsert({ label, year, half }, { onConflict: 'label' })
            .select()
            .single();

        if (periodError) throw periodError;

        // 2. Create period-project relationships
        if (projectIds.length > 0) {
            const periodProjects = projectIds.map(projectId => ({
                period_label: label,
                project_id: projectId
            }));

            const { error: linkError } = await this.supabase
                .from('period_projects')
                .insert(periodProjects);

            if (linkError) throw linkError;
        }

        return period;
    }

    /**
     * Update projects assigned to a period
     */
    async updatePeriodProjects(periodLabel: string, projectIds: string[]) {
        // 1. Delete existing links
        const { error: deleteError } = await this.supabase
            .from('period_projects')
            .delete()
            .eq('period_label', periodLabel);

        if (deleteError) throw deleteError;

        // 2. Insert new links
        if (projectIds.length > 0) {
            const periodProjects = projectIds.map(projectId => ({
                period_label: periodLabel,
                project_id: projectId
            }));

            const { error: insertError } = await this.supabase
                .from('period_projects')
                .insert(periodProjects);

            if (insertError) throw insertError;
        }
    }

    async deletePeriod(periodLabel: string) {
        const { error } = await this.supabase
            .from('periods')
            .delete()
            .eq('label', periodLabel);

        if (error) throw error;
    }

    async getProjectsForPeriod(periodLabel: string) {
        const { data, error } = await this.supabase
            .from('period_projects')
            .select('project_id, projects(*)')
            .eq('period_label', periodLabel);

        if (error) throw error;
        return (data || []).map((pp: any) => pp.projects);
    }
}

export const periodService = new PeriodService();
