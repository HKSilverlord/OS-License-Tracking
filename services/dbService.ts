import { supabase } from '../lib/supabase';
import { Project, MonthlyRecord } from '../types';

const DEFAULT_SETTINGS = {
  exchangeRate: 165,
  licenseComputers: 7,
  licensePerComputer: 2517143
};

export const dbService = {
  // --- Projects ---
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
    return data as Project[];
  },

  async createProject(project: Omit<Project, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
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
    return (data || []).map((r: any) => ({
      ...r,
      projects: {
        unit_price: r.projects?.unit_price || 0
      }
    }));
  },

  async getRecordYears() {
    // Get unique years from records
    const { data, error } = await supabase
      .from('monthly_records')
      .select('year');
    
    if (error) return []; // Return empty on error or handle it

    const years = Array.from(new Set(data?.map((r: any) => r.year) || [])).sort((a: any, b: any) => b - a);
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
  }
};
