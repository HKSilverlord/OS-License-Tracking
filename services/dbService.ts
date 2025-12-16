import { Project, MonthlyRecord } from '../types';
import { getSeedData } from '../utils/periodData';

// Keys for LocalStorage - Updated to v4 to force new data load
const STORAGE_KEYS = {
  PROJECTS: 'os_projects_v4',
  RECORDS: 'os_records_v4',
  PERIODS: 'os_periods_v4',
  SETTINGS: 'os_settings_v4'
};

const DEFAULT_SETTINGS = {
  exchangeRate: 165,
  licenseComputers: 7,
  // Rounded per-seat cost from 17,620,000 / 7
  licensePerComputer: 2517143
};

const SEED_FROM_SPEC = getSeedData();

// Helper to simulate delay for "async" feel
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize LocalStorage if empty
const initializeData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(SEED_FROM_SPEC.projects));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PERIODS)) {
    localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(SEED_FROM_SPEC.periods));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RECORDS)) {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(SEED_FROM_SPEC.records));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
};

initializeData();

export const dbService = {
  // --- Projects ---
  async getProjects() {
    await delay(150);
    const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    return data ? JSON.parse(data) as Project[] : [];
  },

  async createProject(project: Omit<Project, 'id' | 'created_at'>) {
    await delay(150);
    const projects = await this.getProjects();
    const newProject: Project = {
      ...project,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    projects.push(newProject);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    return newProject;
  },

  async updateProject(id: string, updates: Partial<Project>) {
    await delay(100);
    const projects = await this.getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');
    
    projects[index] = { ...projects[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    return projects[index];
  },

  async deleteProject(id: string) {
    return this.deleteProjects([id]);
  },

  async deleteProjects(ids: string[]) {
    if (!ids.length) return;
    await delay(100);

    // Remove projects
    const projects = await this.getProjects();
    const filteredProjects = projects.filter(p => !ids.includes(p.id));
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(filteredProjects));

    // Remove related records
    const recordData = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (recordData) {
      const allRecords = JSON.parse(recordData) as MonthlyRecord[];
      const remaining = allRecords.filter(r => !ids.includes(r.project_id));
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(remaining));
    }
  },

  // --- Records ---
  async getRecords(periodLabel: string) {
    await delay(150);
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    const allRecords = data ? JSON.parse(data) as MonthlyRecord[] : [];
    return allRecords.filter(r => r.period_label === periodLabel);
  },

  async getAllRecords(year: number) {
    await delay(150);
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    const allRecords = data ? JSON.parse(data) as MonthlyRecord[] : [];
    return allRecords.filter(r => r.year === year);
  },

  async upsertRecord(record: Partial<MonthlyRecord> & { project_id: string, year: number, month: number }) {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    let allRecords = data ? JSON.parse(data) as MonthlyRecord[] : [];
    
    const index = allRecords.findIndex(r => 
      r.project_id === record.project_id && 
      r.year === record.year && 
      r.month === record.month &&
      r.period_label === record.period_label
    );

    let resultRecord: MonthlyRecord;

    if (index >= 0) {
      allRecords[index] = { ...allRecords[index], ...record };
      resultRecord = allRecords[index];
    } else {
      resultRecord = {
        id: Math.random().toString(36).substr(2, 9),
        project_id: record.project_id,
        year: record.year,
        month: record.month,
        period_label: record.period_label || `${record.year}-${record.month <= 6 ? 'H1' : 'H2'}`,
        planned_hours: record.planned_hours || 0,
        actual_hours: record.actual_hours || 0,
        ...record
      } as MonthlyRecord;
      allRecords.push(resultRecord);
    }

    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(allRecords));
    return resultRecord;
  },

  // --- Dashboard ---
  async getDashboardStats(year: number) {
    const records = await this.getAllRecords(year);
    const projects = await this.getProjects();
    const projectMap = new Map<string, Project>();
    projects.forEach(p => projectMap.set(p.id, p));

    return records.map(r => ({
      ...r,
      projects: {
        unit_price: projectMap.get(r.project_id)?.unit_price || 0
      }
    }));
  },

  async getRecordYears() {
    await delay(50);
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    const allRecords = data ? JSON.parse(data) as MonthlyRecord[] : [];
    const years = Array.from(new Set(allRecords.map(r => r.year))).sort((a, b) => b - a);
    return years;
  },

  // --- Periods ---
  async getPeriods() {
    const data = localStorage.getItem(STORAGE_KEYS.PERIODS);
    return data ? JSON.parse(data) as string[] : SEED_FROM_SPEC.periods;
  },

  async addPeriod(label: string) {
    const periods = await this.getPeriods();
    if (!periods.includes(label)) {
      periods.push(label);
      periods.sort().reverse(); 
      localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(periods));
    }
    return periods;
  },

  // --- Settings (Exchange Rate) ---
  async getSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const parsed = data ? JSON.parse(data) : {};
    return { ...DEFAULT_SETTINGS, ...parsed };
  },

  async saveSettings(settings: any) {
    const current = await this.getSettings();
    const updated = { ...DEFAULT_SETTINGS, ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }
};
