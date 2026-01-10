import { supabase } from '../lib/supabase';
import { Project, MonthlyRecord, DashboardRecord, Settings } from '../types';

const DEFAULT_SETTINGS = {
  exchangeRate: 165,
  licenseComputers: 7,
  licensePerComputer: 2517143
};

/**
 * Generates the next available project code in PRJ-XXX format
 * @param period Optional period to scope the code generation (if you want per-period codes)
 * @returns Promise<string> Next code in format PRJ-001, PRJ-002, etc.
 */
async function getNextProjectCode(period?: string): Promise<string> {
  try {
    // Query all projects to find the highest code number
    let query = supabase
      .from('projects')
      .select('code');

    // Optional: Scope by period if you want codes to be period-specific
    // Uncomment the next line if you want separate numbering per period
    // if (period) query = query.eq('period', period);

    const { data, error } = await query;

    if (error) throw error;

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
function isValidProjectCode(code: string): boolean {
  return /^PRJ-\d{3}$/.test(code);
}

export const dbService = {
  // --- Projects ---
  async getProjects(period?: string) {
    if (period) {
      // Query projects through the period_projects junction table
      const { data, error } = await supabase
        .from('period_projects')
        .select('plan_price, actual_price, projects(*)')
        .eq('period_label', period)
        .order('projects(display_order)', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }

      // Extract projects from the junction table result
      return (data || []).map((pp: any) => {
        const project = pp.projects;
        if (!project) return null;

        // Override global prices with period-specific prices if available
        // If period_price is null, fallback to global price
        return {
          ...project,
          plan_price: pp.plan_price ?? project.plan_price,
          actual_price: pp.actual_price ?? project.actual_price,
          // Store the original period_projects ID or keys if needed, but here we just map fields
        };
      }).filter(Boolean) as Project[];
    } else {
      // If no period specified, return all projects sorted by display_order
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
      return data as Project[];
    }
  },

  async getProjectsForCarryOver() {
    try {
      console.log('[DEBUG dbService] Starting getProjectsForCarryOver');

      // Fetch ALL projects without any period filtering
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      console.log('[DEBUG dbService] Raw query result:', {
        dataLength: data?.length,
        error: error,
        errorDetails: error ? JSON.stringify(error) : null,
        firstProject: data?.[0],
        sampleProjects: data?.slice(0, 3)
      });

      if (error) {
        console.error('[DEBUG dbService] Supabase error:', error);
        console.error('[DEBUG dbService] Error code:', error.code);
        console.error('[DEBUG dbService] Error message:', error.message);
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data) {
        console.log('[DEBUG dbService] No data returned (null/undefined)');
        return [];
      }

      console.log('[DEBUG dbService] Successfully returning', data.length, 'projects');

      // Group by unique project names to show distinct projects
      const uniqueProjects = data.filter((project, index, self) =>
        index === self.findIndex((p) => p.code === project.code)
      );

      console.log('[DEBUG dbService] After deduplication:', uniqueProjects.length, 'unique projects');

      return uniqueProjects as Project[];

    } catch (err) {
      console.error('[DEBUG dbService] Catch block error:', err);
      throw err; // Re-throw to let the caller handle it
    }
  },

  async createProject(project: Omit<Project, 'id' | 'created_at' | 'code'> & { code?: string }) {
    // Auto-generate code if not provided or invalid
    let finalCode = project.code;

    if (!finalCode || !isValidProjectCode(finalCode)) {
      finalCode = await getNextProjectCode(project.period);
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...project, code: finalCode })
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  async updateProject(id: string, updates: Partial<Project>) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Project;
  },

  async updateProjectPriceForPeriod(projectId: string, periodLabel: string, prices: { plan_price?: number, actual_price?: number }) {
    // Check if link exists
    const { data: link, error: fetchError } = await supabase
      .from('period_projects')
      .select('*')
      .eq('project_id', projectId)
      .eq('period_label', periodLabel)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (!link) {
      // Logic for if link doesn't exist (shouldn't happen in tracking view usually)
      throw new Error(`Project ${projectId} not linked to period ${periodLabel}`);
    }

    const { error } = await supabase
      .from('period_projects')
      .update(prices)
      .eq('project_id', projectId)
      .eq('period_label', periodLabel);

    if (error) throw error;
  },

  async updateProjectPriceForYear(projectId: string, year: number, prices: { plan_price?: number, actual_price?: number }) {
    // 1. Get all periods labels for this year
    const { data: periods, error: periodsError } = await supabase
      .from('periods')
      .select('label')
      .eq('year', year);

    if (periodsError) throw periodsError;

    const periodLabels = periods.map(p => p.label);
    if (periodLabels.length === 0) return;

    // 2. Update period_projects for all these periods
    const { error } = await supabase
      .from('period_projects')
      .update(prices)
      .eq('project_id', projectId)
      .in('period_label', periodLabels);

    if (error) throw error;
  },

  async deleteProject(id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteProjects(ids: string[]) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .in('id', ids);

    if (error) throw error;
  },

  async copyProjectsToPeriod(targetPeriod: string, projectIds: string[]) {
    // 1. Fetch Source Projects
    const { data: sourceProjects, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds);

    if (fetchError) throw fetchError;
    if (!sourceProjects || sourceProjects.length === 0) return [];

    // 2. Prepare new project payloads (omit id, created_at, etc.)
    const newProjectsPayload = sourceProjects.map(p => ({
      name: p.name,
      code: p.code, // Keep the same code for continuity
      type: p.type,
      software: p.software,
      status: p.status,
      unit_price: p.unit_price,
      plan_price: p.plan_price || p.unit_price || 0,
      actual_price: p.actual_price || p.unit_price || 0,
      period: targetPeriod
    }));

    // 3. Insert new projects
    const { data: insertedProjects, error: insertError } = await supabase
      .from('projects')
      .insert(newProjectsPayload)
      .select();

    if (insertError) throw insertError;
    return insertedProjects as Project[];
  },

  async generateNextProjectCode() {
    const { data, error } = await supabase
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
  },

  // --- Records ---
  async getRecords(periodLabel: string) {
    const { data, error } = await supabase
      .from('monthly_records')
      .select('*')
      .eq('period_label', periodLabel);

    if (error) throw error;
    return data as MonthlyRecord[];
  },

  async getAllRecords(year: number) {
    const { data, error } = await supabase
      .from('monthly_records')
      .select('*')
      .eq('year', year);

    if (error) throw error;
    return data as MonthlyRecord[];
  },

  async upsertRecord(record: Partial<MonthlyRecord> & { project_id: string, year: number, month: number }) {
    // Ensure period_label exists
    const period_label = record.period_label || `${record.year}-${record.month <= 6 ? 'H1' : 'H2'}`;

    const payload = {
      project_id: record.project_id,
      year: record.year,
      month: record.month,
      period_label: period_label,
      planned_hours: record.planned_hours ?? 0,
      actual_hours: record.actual_hours ?? 0
    };

    const { data, error } = await supabase
      .from('monthly_records')
      .upsert(payload, { onConflict: 'project_id,period_label,year,month' })
      .select()
      .single();

    if (error) throw error;
    return data as MonthlyRecord;
  },

  // --- Dashboard ---
  async getDashboardStats(year: number) {
    // Fetch records and join with projects to get unit_price
    const { data, error } = await supabase
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
  },

  async getRecordYears() {
    // Get unique years from records
    const { data, error } = await supabase
      .from('monthly_records')
      .select('year');

    if (error) return []; // Return empty on error or handle it

    const years = Array.from(new Set(data?.map((r: { year: number }) => r.year) || [])).sort((a, b) => b - a);
    return years as number[];
  },

  // --- Periods ---
  async getPeriods() {
    const { data, error } = await supabase
      .from('periods')
      .select('label')
      .order('label', { ascending: false });

    if (error) return [];
    return data.map((p: any) => p.label);
  },

  async addPeriod(label: string) {
    // Need to parse year and half from label "YYYY-HX"
    const [yearStr, half] = label.split('-');
    const year = parseInt(yearStr);

    const { error } = await supabase
      .from('periods')
      .insert({ label, year, half });

    if (error && error.code !== '23505') { // Ignore unique violation
      throw error;
    }

    return this.getPeriods();
  },

  // --- Period Management ---
  /**
   * Get all projects for period management (no filtering)
   */
  async getAllProjectsForPeriodManagement() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, code, name, type, software, period')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Project[];
  },

  /**
   * Get all periods with project counts and metadata
   */
  async getPeriodsWithProjectCount() {
    const { data: periods, error: periodsError } = await supabase
      .from('periods')
      .select('label, year, half, created_at')
      .order('year', { ascending: false })
      .order('half', { ascending: false });

    if (periodsError) throw periodsError;

    // For each period, count projects
    const periodsWithCount = await Promise.all(
      (periods || []).map(async (period) => {
        const { count, error: countError } = await supabase
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
  },

  /**
   * Create a new period and assign projects to it
   */
  async createPeriodWithProjects(year: number, half: 'H1' | 'H2', projectIds: string[]) {
    const label = `${year}-${half}`;

    // 1. Create period (or get existing)
    const { data: period, error: periodError } = await supabase
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

      const { error: linkError } = await supabase
        .from('period_projects')
        .insert(periodProjects);

      if (linkError) throw linkError;
    }

    return period;
  },

  /**
   * Update projects assigned to a period
   */
  async updatePeriodProjects(periodLabel: string, projectIds: string[]) {
    // 1. Delete existing links
    const { error: deleteError } = await supabase
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

      const { error: insertError } = await supabase
        .from('period_projects')
        .insert(periodProjects);

      if (insertError) throw insertError;
    }
  },

  /**
   * Delete a period (cascade will delete period_projects)
   */
  async deletePeriod(periodLabel: string) {
    const { error } = await supabase
      .from('periods')
      .delete()
      .eq('label', periodLabel);

    if (error) throw error;
  },

  /**
   * Get projects assigned to a specific period
   */
  async getProjectsForPeriod(periodLabel: string) {
    const { data, error } = await supabase
      .from('period_projects')
      .select('project_id, projects(*)')
      .eq('period_label', periodLabel);

    if (error) throw error;
    return (data || []).map((pp: any) => pp.projects) as Project[];
  },

  // --- Settings ---
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('label', 'default')
      .single();

    if (error || !data) return DEFAULT_SETTINGS;

    // Map DB columns to app keys
    return {
      exchangeRate: data.exchange_rate,
      licenseComputers: data.license_computers,
      licensePerComputer: data.license_per_computer
    };
  },

  async saveSettings(settings: any) {
    // First get current to merge
    const current = await this.getSettings();
    const merged = { ...current, ...settings };

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        label: 'default',
        exchange_rate: merged.exchangeRate,
        license_computers: merged.licenseComputers,
        license_per_computer: merged.licensePerComputer
      }, { onConflict: 'label' })
      .select()
      .single();

    if (error) throw error;

    return {
      exchangeRate: data.exchange_rate,
      licenseComputers: data.license_computers,
      licensePerComputer: data.license_per_computer
    };
  },

  // --- Chart Data Aggregation Functions ---
  async getYearlyAggregatedData(startYear: number, endYear: number) {
    // Fetch all monthly records and projects for the year range
    const { data: records, error } = await supabase
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
  },

  async getMonthlyAggregatedData(year: number) {
    // Fetch all monthly records for the specified year
    const { data: records, error } = await supabase
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
  },

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
  },

  // --- Project Reordering Functions ---
  async moveProjectUp(projectId: string, periodLabel: string) {
    // Get all projects for this period, sorted by display_order
    const { data: allProjects, error: fetchError } = await supabase
      .from('projects')
      .select('id, display_order')
      .order('display_order', { ascending: true });

    if (fetchError) throw fetchError;
    if (!allProjects || allProjects.length === 0) return;

    // Find current project and the one above it
    const currentIndex = allProjects.findIndex(p => p.id === projectId);
    if (currentIndex <= 0) return; // Already at top or not found

    const currentProject = allProjects[currentIndex];
    const aboveProject = allProjects[currentIndex - 1];

    // Swap display_order values
    await supabase.from('projects').update({ display_order: aboveProject.display_order }).eq('id', currentProject.id);
    await supabase.from('projects').update({ display_order: currentProject.display_order }).eq('id', aboveProject.id);
  },

  async moveProjectDown(projectId: string, periodLabel: string) {
    // Get all projects for this period, sorted by display_order
    const { data: allProjects, error: fetchError } = await supabase
      .from('projects')
      .select('id, display_order')
      .order('display_order', { ascending: true });

    if (fetchError) throw fetchError;
    if (!allProjects || allProjects.length === 0) return;

    // Find current project and the one below it
    const currentIndex = allProjects.findIndex(p => p.id === projectId);
    if (currentIndex < 0 || currentIndex >= allProjects.length - 1) return; // Already at bottom or not found

    const currentProject = allProjects[currentIndex];
    const belowProject = allProjects[currentIndex + 1];

    // Swap display_order values
    await supabase.from('projects').update({ display_order: belowProject.display_order }).eq('id', currentProject.id);
    await supabase.from('projects').update({ display_order: currentProject.display_order }).eq('id', belowProject.id);
  },

  // --- Helper Functions ---
  getNextProjectCode,
  isValidProjectCode
};
