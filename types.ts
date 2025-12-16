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
  unit_price: number;
  created_at?: string;
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
