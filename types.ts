export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PENDING = 'pending',
  ARCHIVED = 'archived'
}

export enum PeriodType {
  H1 = 'H1', // Jan - Jun
  H2 = 'H2'  // Jul - Dec
}

export interface Project {
  id: string;
  code: string;
  name: string;
  type: string;
  software: string;
  status: ProjectStatus;
  unit_price: number; // @deprecated use plan_price and actual_price
  plan_price: number;
  actual_price: number;
  created_at?: string;
  period?: string; // e.g. "2024-H1"
}

export interface MonthlyRecord {
  id?: string;
  project_id: string;
  period_label: string; // e.g., "2024-H1"
  year: number;
  month: number; // 1-12
  planned_hours: number;
  actual_hours: number;
}

// UI Transformation Types
export interface ProjectRow extends Project {
  records: Record<string, MonthlyRecord>; // Key is "YYYY-M"
}

export interface KPIMetrics {
  totalRevenue: number;
  totalPlannedRevenue: number;
  totalHours: number;
  achievementRate: number;
  activeProjects: number;
}

// Dashboard specific types
export interface MonthlyStats {
  month: number;
  name: string;
  plannedHours: number;
  actualHours: number;
  plannedRevenue: number;
  actualRevenue: number;
}

export interface AccumulatedStats {
  month: string;
  accPlannedRevenue: number;
  accActualRevenue: number;
}

export interface DashboardRecord extends MonthlyRecord {
  projects: {
    unit_price: number;
  } | null;
}

// Utility types
export type PeriodLabel = `${number}-${'H1' | 'H2'}`;
export type SupportedLanguage = 'ja' | 'en' | 'vn';

// Settings interface
export interface Settings {
  label: string;
  exchange_rate: number;
  license_computers: number;
  license_per_computer: number;
}
