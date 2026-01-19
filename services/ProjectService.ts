
import { BaseService } from './BaseService';
import { Project } from '../types';

export class ProjectService extends BaseService {

    // --- Project Code Generation ---

    /**
     * Generates the next available project code in PRJ-XXX format
     * @param period Optional period to scope the code generation (if you want per-period codes)
     * @returns Promise<string> Next code in format PRJ-001, PRJ-002, etc.
     */
    async getNextProjectCode(period?: string): Promise<string> {
        try {
            // Query all projects to find the highest code number
            let query = this.supabase
                .from('projects')
                .select('code');

            // Optional: Scope by period if you want codes to be period-specific
            // if (period) query = query.eq('period', period);

            const { data, error } = await query;
            this.handleError(error);

            let maxNumber = 0;

            if (data && data.length > 0) {
                // Extract numbers from PRJ-XXX format codes
                data.forEach(project => {
                    const match = project.code?.match(/^PRJ-(\d+)$/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNumber) {
                            maxNumber = num;
                        }
                    }
                });
            }

            // Increment and format with leading zeros
            const nextNumber = maxNumber + 1;
            const code = `PRJ-${String(nextNumber).padStart(3, '0')}`;

            return code;
        } catch (error) {
            console.error('Error generating next project code:', error);
            throw error;
        }
    }

    /**
     * Validates if a code matches the PRJ-XXX format
     * @param code Code string to validate
     * @returns boolean True if valid format
     */
    isValidProjectCode(code: string): boolean {
        return /^PRJ-\d{3}$/.test(code);
    }

    async generateNextProjectCode() {
        const { data, error } = await this.supabase
            .from('projects')
            .select('code');

        if (error) throw error;

        // Extract numbers from codes like "PRJ-001"
        const numbers = data
            .map(p => {
                const match = p.code.match(/PRJ-(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => !isNaN(n));

        const maxNum = Math.max(0, ...numbers);
        const nextNum = maxNum + 1;

        // Pad with leading zeros to 3 digits
        return `PRJ-${nextNum.toString().padStart(3, '0')}`;
    }


    // --- CRUD Operations ---

    async getProjects(period?: string) {
        if (period) {
            console.log('[ProjectService] Fetching projects for period:', period);

            // Query projects through the period_projects junction table
            const { data, error } = await this.supabase
                .from('period_projects')
                .select('plan_price, actual_price, projects(*)')
                .eq('period_label', period);

            if (error) {
                console.error('[ProjectService] Error fetching projects:', error);
                throw error;
            }

            console.log('[ProjectService] Raw data from period_projects:', data?.length || 0, 'items');

            // Extract projects from the junction table result and sort by display_order
            const projects = (data || []).map((pp: any) => {
                const project = pp.projects;
                if (!project) {
                    console.warn('[ProjectService] Found period_project without nested project data:', pp);
                    return null;
                }

                // Override global prices with period-specific prices if available
                // If period_price is null, fallback to global price
                return {
                    ...project,
                    plan_price: pp.plan_price ?? project.plan_price,
                    actual_price: pp.actual_price ?? project.actual_price,
                };
            }).filter(Boolean) as Project[];

            // Sort by display_order in JavaScript since Supabase doesn't support nested ordering
            projects.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

            console.log('[ProjectService] Returning', projects.length, 'projects');
            return projects;
        } else {
            console.log('[ProjectService] Fetching all projects (no period filter)');

            // If no period specified, return all projects sorted by display_order
            const { data, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) {
                console.error('[ProjectService] Error fetching projects:', error);
                throw error;
            }

            console.log('[ProjectService] Returning', data?.length || 0, 'projects');
            return data as Project[];
        }
    }

    async getProjectsForCarryOver() {
        try {
            console.log('[DEBUG ProjectService] Starting getProjectsForCarryOver');

            // Fetch ALL projects without any period filtering
            const { data, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error; // Will be caught by catch block

            if (!data) {
                console.log('[DEBUG ProjectService] No data returned (null/undefined)');
                return [];
            }

            // Group by unique project names to show distinct projects
            const uniqueProjects = data.filter((project, index, self) =>
                index === self.findIndex((p) => p.code === project.code)
            );

            return uniqueProjects as Project[];

        } catch (err) {
            console.error('[DEBUG ProjectService] Error:', err);
            throw err;
        }
    }

    async createProject(project: Omit<Project, 'id' | 'created_at' | 'code'> & { code?: string }) {
        console.log('[ProjectService] Creating project with period:', project.period);

        // Auto-generate code if not provided or invalid
        let finalCode = project.code;

        if (!finalCode || !this.isValidProjectCode(finalCode)) {
            finalCode = await this.getNextProjectCode(project.period);
        }

        // Extract period for linking
        const periodLabel = project.period;

        // Insert project into projects table
        const { data: createdProject, error } = await this.supabase
            .from('projects')
            .insert({ ...project, code: finalCode })
            .select()
            .single();

        if (error) {
            console.error('[ProjectService] Error creating project:', error);
            throw error;
        }

        // Link project to period in period_projects table
        if (periodLabel && createdProject?.id) {
            console.log('[ProjectService] Linking to period:', periodLabel);

            const { error: linkError } = await this.supabase
                .from('period_projects')
                .insert({
                    period_label: periodLabel,
                    project_id: createdProject.id,
                    plan_price: project.plan_price || project.unit_price || null,
                    actual_price: project.actual_price || project.unit_price || null
                });

            if (linkError) {
                console.error('[ProjectService] ERROR linking project to period:', linkError);
                // Don't throw - project was created successfully
            }
        }

        return createdProject as Project;
    }

    async updateProject(id: string, updates: Partial<Project>) {
        const { data, error } = await this.supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Project;
    }

    async updateProjectPriceForPeriod(projectId: string, periodLabel: string, prices: { plan_price?: number, actual_price?: number }) {
        // Check if link exists
        const { data: link, error: fetchError } = await this.supabase
            .from('period_projects')
            .select('*')
            .eq('project_id', projectId)
            .eq('period_label', periodLabel)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (!link) {
            throw new Error(`Project ${projectId} not linked to period ${periodLabel}`);
        }

        const { error } = await this.supabase
            .from('period_projects')
            .update(prices)
            .eq('project_id', projectId)
            .eq('period_label', periodLabel);

        if (error) throw error;
    }

    async updateProjectPriceForYear(projectId: string, year: number, prices: { plan_price?: number, actual_price?: number }) {
        // 1. Get all periods labels for this year
        const { data: periods, error: periodsError } = await this.supabase
            .from('periods')
            .select('label')
            .eq('year', year);

        if (periodsError) throw periodsError;

        const periodLabels = periods.map(p => p.label);
        if (periodLabels.length === 0) return;

        // 2. Update period_projects for all these periods
        const { error } = await this.supabase
            .from('period_projects')
            .update(prices)
            .eq('project_id', projectId)
            .in('period_label', periodLabels);

        if (error) throw error;
    }

    async deleteProject(id: string) {
        const { error } = await this.supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async deleteProjects(ids: string[]) {
        const { error } = await this.supabase
            .from('projects')
            .delete()
            .in('id', ids);

        if (error) throw error;
    }

    async copyProjectsToPeriod(targetPeriod: string, projectIds: string[]) {
        if (!projectIds || projectIds.length === 0) return [];

        // Fetch source projects to get their prices
        const { data: sourceProjects, error: fetchError } = await this.supabase
            .from('projects')
            .select('id, unit_price, plan_price, actual_price')
            .in('id', projectIds);

        if (fetchError) throw fetchError;
        if (!sourceProjects || sourceProjects.length === 0) return [];

        // Create period-project links (not new projects!)
        const periodProjectsPayload = sourceProjects.map(p => ({
            period_label: targetPeriod,
            project_id: p.id,
            plan_price: p.plan_price || p.unit_price || null,
            actual_price: p.actual_price || p.unit_price || null
        }));

        const { error: insertError } = await this.supabase
            .from('period_projects')
            .insert(periodProjectsPayload);

        if (insertError) throw insertError;

        return sourceProjects as Project[];
    }

    async getAllProjectsForPeriodManagement() {
        const { data, error } = await this.supabase
            .from('projects')
            .select('id, code, name, type, software, period')
            .order('name', { ascending: true });

        if (error) throw error;
        return data as Project[];
    }

    // --- Reordering ---

    async moveProjectUp(projectId: string, periodLabel: string) {
        // 1. Get projects FOR THIS PERIOD only, sorted by display_order
        // We reuse getProjects(periodLabel) to ensure we see exactly what the user sees
        const periodProjects = await this.getProjects(periodLabel);

        if (!periodProjects || periodProjects.length === 0) return;

        // 2. Find current project index in this filtered list
        const currentIndex = periodProjects.findIndex(p => p.id === projectId);
        if (currentIndex <= 0) return; // Already at top of this period's list

        const currentProject = periodProjects[currentIndex];
        const aboveProject = periodProjects[currentIndex - 1];

        // 3. Swap display_order values
        // Note: We need to update the PROJECTS table, not the junction table, as display_order is likely on the Project entity.
        // CHECK: If display_order is on projects table, it affects this project in ALL periods.
        // If sorting is per-period, display_order should be on period_projects. 
        // Based on previous code: "projects" table has "display_order".
        // This implies Global Ordering. 
        // IF we have global ordering but local filtering, "Move Up" is ambiguous.
        // However, user wants to move it up visually in THIS period.
        // If we swap display_order with the visible neighbor, it works for this view.
        // It might affect other views, but that's the tradeoff of global order + local view.

        // Critical: We must swap their display_order values.

        const currentOrder = currentProject.display_order || 0;
        const aboveOrder = aboveProject.display_order || 0;

        // If orders are identical (bad data), force a spread? 
        // For now, standard swap.

        await this.supabase.from('projects').update({ display_order: aboveOrder }).eq('id', currentProject.id);
        await this.supabase.from('projects').update({ display_order: currentOrder }).eq('id', aboveProject.id);
    }

    async moveProjectDown(projectId: string, periodLabel: string) {
        const periodProjects = await this.getProjects(periodLabel);

        if (!periodProjects || periodProjects.length === 0) return;

        const currentIndex = periodProjects.findIndex(p => p.id === projectId);
        if (currentIndex < 0 || currentIndex >= periodProjects.length - 1) return;

        const currentProject = periodProjects[currentIndex];
        const belowProject = periodProjects[currentIndex + 1];

        const currentOrder = currentProject.display_order || 0;
        const belowOrder = belowProject.display_order || 0;

        await this.supabase.from('projects').update({ display_order: belowOrder }).eq('id', currentProject.id);
        await this.supabase.from('projects').update({ display_order: currentOrder }).eq('id', belowProject.id);
    }
    async updateProjectDisplayOrders(items: { id: string, display_order: number }[]) {
        if (!items || items.length === 0) return;

        // Perform parallel updates
        const updates = items.map(item =>
            this.supabase
                .from('projects')
                .update({ display_order: item.display_order })
                .eq('id', item.id)
        );

        await Promise.all(updates);
    }
}

export const projectService = new ProjectService();
