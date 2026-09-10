
import { BaseService } from './BaseService';
import { periodService } from './PeriodService';
import { buildPriceIndex, resolvePrices } from './pricing';
import type { PeriodProjectPriceRow, PriceIndex } from './pricing';
import { createLogger } from '../utils/logger';
import type { CreateProjectInput, Project } from '../types';

const log = createLogger('ProjectService');

/** Everything the year-scoped views need, fetched in at most two Supabase round-trips. */
export interface YearProjectPrices {
    year: number;
    /** period labels of the year present in `periods`, ascending, e.g. ['2025-H1','2025-H2'] */
    periodLabels: string[];
    /** projects linked to each period via period_projects, per-period prices already merged
     *  (same shape getProjects(period) returns today), sorted by display_order asc */
    projectsByPeriod: Record<string, Project[]>;
    /** every distinct project of the year (union across periods), sorted by display_order asc */
    projects: Project[];
    /** raw period_projects rows for the year, un-merged */
    periodRows: PeriodProjectPriceRow[];
    index: PriceIndex;
}

/** Shape of the `period_projects ... projects(*)` join used by the period-scoped queries.
 *  PostgREST types an embedded resource as an array when the cardinality is unknown, while
 *  this relation returns a single object at runtime — accept both and normalise. */
interface PeriodProjectJoinRow extends PeriodProjectPriceRow {
    projects: Project | Project[] | null;
}

/** Normalises an embedded PostgREST resource to a single row. */
const embeddedOne = <T,>(value: T | T[] | null | undefined): T | null => {
    if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
    return value ?? null;
};

const byDisplayOrder = (a: Project, b: Project): number =>
    (a.display_order || 0) - (b.display_order || 0);

/** Merge the period-specific price over the project's global price (null period price = keep global). */
const mergePeriodPrices = (project: Project, row: PeriodProjectPriceRow): Project => ({
    ...project,
    plan_price: row.plan_price ?? project.plan_price,
    actual_price: row.actual_price ?? project.actual_price,
});

export class ProjectService extends BaseService {

    // --- Project Code Generation ---

    /**
     * Generates the next available project code in PRJ-XXX format
     * @param _period Optional period to scope the code generation (codes are global today)
     * @returns Promise<string> Next code in format PRJ-001, PRJ-002, etc.
     */
    async getNextProjectCode(_period?: string): Promise<string> {
        try {
            // Query all projects to find the highest code number
            const query = this.supabase
                .from('projects')
                .select('code');

            // Codes are global for now; scoping by period would go here.

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
            log.error('Error generating next project code:', error);
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

    // --- CRUD Operations ---

    async getProjects(period?: string) {
        if (period) {
            log.debug('Fetching projects for period:', period);

            // Query projects through the period_projects junction table
            const { data, error } = await this.supabase
                .from('period_projects')
                .select('period_label, project_id, plan_price, actual_price, projects(*)')
                .eq('period_label', period);

            if (error) {
                log.error('Error fetching projects:', error);
                throw error;
            }

            const rows: PeriodProjectJoinRow[] = data || [];
            log.debug('Raw data from period_projects:', rows.length, 'items');

            // Extract projects from the junction table result and sort by display_order
            const projects: Project[] = [];
            for (const pp of rows) {
                const project = embeddedOne(pp.projects);
                if (!project) {
                    log.warn('Found period_project without nested project data:', pp);
                    continue;
                }

                // Override global prices with period-specific prices if available.
                // If the period price is null, fall back to the global price.
                projects.push(mergePeriodPrices(project, pp));
            }

            // Sort by display_order in JavaScript since Supabase does not support nested ordering
            projects.sort(byDisplayOrder);

            log.debug('Returning', projects.length, 'projects');
            return projects;
        } else {
            log.debug('Fetching all projects (no period filter)');

            // If no period specified, return all projects sorted by display_order
            const { data, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) {
                log.error('Error fetching projects:', error);
                throw error;
            }

            log.debug('Returning', data?.length || 0, 'projects');
            return data as Project[];
        }
    }

    /**
     * One-shot loader for a whole year: every period of `year`, the projects linked to each
     * of those periods (with per-period prices merged in) and a `PriceIndex` that resolves a
     * price for any (period_label, project_id) pair. Costs at most two Supabase requests and
     * replaces the getPeriods() + getProjects(p)-per-period N+1 storm (A5).
     */
    async getYearProjectPrices(year: number): Promise<YearProjectPrices> {
        const allLabels: string[] = await periodService.getPeriods();
        const periodLabels = allLabels
            .filter((label) => typeof label === 'string' && label.startsWith(`${year}-`))
            .sort((a, b) => a.localeCompare(b));

        if (periodLabels.length === 0) {
            log.debug('No periods found for year', year);
            return {
                year,
                periodLabels,
                projectsByPeriod: {},
                projects: [],
                periodRows: [],
                index: buildPriceIndex([], []),
            };
        }

        const { data, error } = await this.supabase
            .from('period_projects')
            .select('period_label, project_id, plan_price, actual_price, projects(*)')
            .in('period_label', periodLabels);

        if (error) {
            log.error('Error fetching period_projects for year:', year, error);
            throw error;
        }

        const rows: PeriodProjectJoinRow[] = data || [];

        const projectsByPeriod: Record<string, Project[]> = {};
        for (const label of periodLabels) projectsByPeriod[label] = [];

        const periodRows: PeriodProjectPriceRow[] = [];
        // Union of the raw (un-merged) projects — this is the global fallback tier of the index.
        const projectsById = new Map<string, Project>();

        for (const row of rows) {
            periodRows.push({
                period_label: row.period_label,
                project_id: row.project_id,
                plan_price: row.plan_price,
                actual_price: row.actual_price,
            });

            const project = embeddedOne(row.projects);
            if (!project) {
                log.warn('Found period_project without nested project data:', row.period_label, row.project_id);
                continue;
            }

            if (!projectsByPeriod[row.period_label]) projectsByPeriod[row.period_label] = [];
            projectsByPeriod[row.period_label].push(mergePeriodPrices(project, row));

            if (!projectsById.has(project.id)) projectsById.set(project.id, project);
        }

        for (const label of Object.keys(projectsByPeriod)) {
            projectsByPeriod[label].sort(byDisplayOrder);
        }

        const projects = Array.from(projectsById.values()).sort(byDisplayOrder);

        log.debug('getYearProjectPrices', year, '->', periodLabels.length, 'periods,', projects.length, 'projects');

        return {
            year,
            periodLabels,
            projectsByPeriod,
            projects,
            periodRows,
            index: buildPriceIndex(periodRows, projects),
        };
    }

    async getProjectsForCarryOver() {
        try {
            log.debug('Starting getProjectsForCarryOver');

            // Fetch ALL projects without any period filtering
            const { data, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error; // Will be caught by catch block

            if (!data) {
                log.debug('No data returned (null/undefined)');
                return [];
            }

            // Group by unique project names to show distinct projects
            const uniqueProjects = data.filter((project, index, self) =>
                index === self.findIndex((p) => p.code === project.code)
            );

            return uniqueProjects as Project[];

        } catch (err) {
            log.error('getProjectsForCarryOver failed:', err);
            throw err;
        }
    }

    /**
     * Highest display_order among the projects already linked to `period`, plus one.
     * Falls back to 1 when the period is empty or the lookup fails.
     */
    private async getNextDisplayOrder(period: string): Promise<number> {
        const { data, error } = await this.supabase
            .from('period_projects')
            .select('projects(display_order)')
            .eq('period_label', period);

        if (error) {
            log.warn('Could not determine display_order for period', period, error);
            return 1;
        }

        type OrderRow = { display_order: number | null };
        const rows: Array<{ projects: OrderRow | OrderRow[] | null }> = data || [];
        let max = 0;
        for (const row of rows) {
            const order = embeddedOne(row.projects)?.display_order;
            if (typeof order === 'number' && Number.isFinite(order) && order > max) max = order;
        }

        return max + 1;
    }

    /**
     * Creates a project and its `period_projects` link.
     * The link carries the authoritative per-period price; `unit_price` is written only to
     * keep the deprecated column consistent with `plan_price`.
     * If the link insert fails, the orphan `projects` row is removed (best effort) and the
     * error is rethrown — a project without a period link is invisible everywhere.
     */
    async createProject(input: CreateProjectInput): Promise<Project> {
        log.debug('Creating project with period:', input.period);

        // Auto-generate code if not provided or invalid
        let finalCode = input.code;

        if (!finalCode || !this.isValidProjectCode(finalCode)) {
            finalCode = await this.getNextProjectCode(input.period);
        }

        const displayOrder = input.display_order ?? await this.getNextDisplayOrder(input.period);

        const { data: createdProject, error } = await this.supabase
            .from('projects')
            .insert({
                code: finalCode,
                name: input.name,
                type: input.type,
                software: input.software,
                status: input.status,
                period: input.period,
                plan_price: input.plan_price,
                actual_price: input.actual_price,
                unit_price: input.plan_price,
                notes: input.notes ?? '',
                exclusion_mark: input.exclusion_mark ?? '',
                display_order: displayOrder,
            })
            .select()
            .single();

        if (error) {
            log.error('Error creating project:', error);
            throw error;
        }

        const project = createdProject as Project;

        // Link project to period in the period_projects table
        log.debug('Linking to period:', input.period);

        const { error: linkError } = await this.supabase
            .from('period_projects')
            .insert({
                period_label: input.period,
                project_id: project.id,
                plan_price: input.plan_price || null,
                actual_price: input.actual_price || null,
            });

        if (linkError) {
            log.error('ERROR linking project to period, rolling back:', linkError);

            const { error: rollbackError } = await this.supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

            if (rollbackError) {
                log.error('Failed to roll back orphan project', project.id, rollbackError);
            }

            throw linkError;
        }

        return project;
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
            // Seed the junction from the project's own prices through the frozen rule in
            // services/pricing.ts, so this write cannot drift from how reads resolve.
            plan_price: resolvePrices(null, p).plan || null,
            actual_price: resolvePrices(null, p).actual || null
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

        // 3. Swap display_order values.
        // display_order lives on the `projects` table, so ordering is global while the view is
        // period-local; swapping with the visible neighbour is the accepted trade-off.

        const currentOrder = currentProject.display_order || 0;
        const aboveOrder = aboveProject.display_order || 0;

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

        log.debug(`Updating display_order for ${items.length} items`);

        // Perform parallel updates
        const updates = items.map(item =>
            this.supabase
                .from('projects')
                .update({ display_order: item.display_order })
                .eq('id', item.id)
                .then(({ error }) => {
                    if (error) {
                        log.error(`Failed to update project ${item.id}:`, error);
                        throw error;
                    }
                })
        );

        await Promise.all(updates);
        log.debug(`Successfully updated ${items.length} items`);
    }
}

export const projectService = new ProjectService();
