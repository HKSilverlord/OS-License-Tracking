/**
 * Project Repository Interface
 *
 * Defines the contract for project data access.
 * This interface is in the domain layer and implementation is in the data layer.
 * This follows the Dependency Inversion Principle.
 */

import { Project } from '../entities/Project';

export interface IProjectRepository {
  // Queries
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  getByPeriod(periodLabel: string): Promise<Project[]>;
  getForCarryOver(): Promise<Project[]>;

  // Commands
  create(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project>;
  update(id: string, updates: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;

  // Business operations
  generateNextCode(period?: string): Promise<string>;
  linkToPeriod(projectId: string, periodLabel: string, planPrice: number, actualPrice: number): Promise<void>;
  updatePriceForPeriod(projectId: string, periodLabel: string, prices: { planPrice?: number; actualPrice?: number }): Promise<void>;

  // Reordering
  moveUp(projectId: string, periodLabel: string): Promise<void>;
  moveDown(projectId: string, periodLabel: string): Promise<void>;
}
