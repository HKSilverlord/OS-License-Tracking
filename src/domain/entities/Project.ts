/**
 * Project Domain Entity
 *
 * Domain layer uses camelCase naming convention.
 * This represents the core business model for projects.
 */

export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PENDING = 'pending',
  ARCHIVED = 'archived'
}

export interface Project {
  readonly id: string;
  code: string;
  name: string;
  type: string;
  software: string;
  status: ProjectStatus;
  unitPrice: number;      // Legacy field
  planPrice: number;
  actualPrice: number;
  notes: string;
  exclusionMark: string;
  displayOrder: number;
  createdAt: Date;
  period: string;
}

/**
 * Domain validation functions
 */
export function validateProjectName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100;
}

export function validateProjectType(type: string): boolean {
  return type.trim().length > 0;
}

export function validateProjectCode(code: string): boolean {
  return /^PRJ-\d{3}$/.test(code);
}
