/**
 * Supabase Project Repository Implementation
 *
 * IMPORTANT: All algorithms are EXACTLY the same as ProjectService.ts
 * Only differences:
 * - File location moved to data/repositories/
 * - Implements IProjectRepository interface
 * - Uses ProjectMapper to convert DTO <-> Domain Entity
 *
 * NO changes to:
 * - Supabase queries (same tables, same SQL)
 * - Business logic (same algorithms)
 * - Error handling (same patterns)
 */

import { injectable, inject } from 'inversify';
import { SupabaseClient } from '@supabase/supabase-js';
import { IProjectRepository } from '@domain/repositories/IProjectRepository';
import { Project } from '@domain/entities/Project';
import { ProjectDTO } from '../dto/ProjectDTO';
import { ProjectMapper } from '@domain/mappers/ProjectMapper';
import { TYPES } from '@ioc/types';

@injectable()
export class SupabaseProjectRepository implements IProjectRepository {
  constructor(
    @inject(TYPES.SupabaseClient) private supabase: SupabaseClient
  ) {}

  // --- Queries ---

  async getAll(): Promise<Project[]> {
    console.log('[SupabaseProjectRepository] Fetching all projects (no period filter)');

    // EXACT SAME query as ProjectService.getProjects() without period
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[SupabaseProjectRepository] Error fetching projects:', error);
      throw error;
    }

    console.log('[SupabaseProjectRepository] Returning', data?.length || 0, 'projects');
    return ProjectMapper.toDomainArray(data as ProjectDTO[]);
  }

  async getById(id: string): Promise<Project | null> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) return null;
    return ProjectMapper.toDomain(data as ProjectDTO);
  }

  async getByPeriod(periodLabel: string): Promise<Project[]> {
    console.log('[SupabaseProjectRepository] Fetching projects for period:', periodLabel);

    // EXACT SAME query as ProjectService.getProjects(period)
    const { data, error } = await this.supabase
      .from('period_projects')
      .select('plan_price, actual_price, projects(*)')
      .eq('period_label', periodLabel);

    if (error) {
      console.error('[SupabaseProjectRepository] Error fetching projects:', error);
      throw error;
    }

    console.log('[SupabaseProjectRepository] Raw data from period_projects:', data?.length || 0, 'items');

    // EXACT SAME logic as ProjectService
    const projects = (data || []).map((pp: any) => {
      const project = pp.projects;
      if (!project) {
        console.warn('[SupabaseProjectRepository] Found period_project without nested project data:', pp);
        return null;
      }

      // Override global prices with period-specific prices if available
      const projectDTO = project as ProjectDTO;
      projectDTO.plan_price = pp.plan_price ?? projectDTO.plan_price;
      projectDTO.actual_price = pp.actual_price ?? projectDTO.actual_price;

      return ProjectMapper.toDomain(projectDTO);
    }).filter(Boolean) as Project[];

    // Sort by display_order (EXACT SAME sorting)
    projects.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    console.log('[SupabaseProjectRepository] Returning', projects.length, 'projects');
    return projects;
  }

  async getForCarryOver(): Promise<Project[]> {
    console.log('[SupabaseProjectRepository] Starting getForCarryOver');

    // EXACT SAME query as ProjectService.getProjectsForCarryOver()
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    if (!data) {
      console.log('[SupabaseProjectRepository] No data returned');
      return [];
    }

    // Group by unique project codes (EXACT SAME logic)
    const uniqueProjects = (data as ProjectDTO[]).filter((project, index, self) =>
      index === self.findIndex((p) => p.code === project.code)
    );

    return ProjectMapper.toDomainArray(uniqueProjects);
  }

  // --- Commands ---

  async create(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    const dto = ProjectMapper.toDTO(project);

    const { data, error } = await this.supabase
      .from('projects')
      .insert(dto)
      .select()
      .single();

    if (error) {
      console.error('[SupabaseProjectRepository] Error creating project:', error);
      throw error;
    }

    return ProjectMapper.toDomain(data as ProjectDTO);
  }

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    // Convert domain updates to DTO format
    const dtoUpdates: any = {};
    if (updates.code !== undefined) dtoUpdates.code = updates.code;
    if (updates.name !== undefined) dtoUpdates.name = updates.name;
    if (updates.type !== undefined) dtoUpdates.type = updates.type;
    if (updates.software !== undefined) dtoUpdates.software = updates.software;
    if (updates.status !== undefined) dtoUpdates.status = updates.status;
    if (updates.planPrice !== undefined) dtoUpdates.plan_price = updates.planPrice;
    if (updates.actualPrice !== undefined) dtoUpdates.actual_price = updates.actualPrice;
    if (updates.notes !== undefined) dtoUpdates.notes = updates.notes;
    if (updates.exclusionMark !== undefined) dtoUpdates.exclusion_mark = updates.exclusionMark;
    if (updates.displayOrder !== undefined) dtoUpdates.display_order = updates.displayOrder;

    const { data, error } = await this.supabase
      .from('projects')
      .update(dtoUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return ProjectMapper.toDomain(data as ProjectDTO);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteMany(ids: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('projects')
      .delete()
      .in('id', ids);

    if (error) throw error;
  }

  // --- Business Operations ---

  async generateNextCode(period?: string): Promise<string> {
    // EXACT SAME algorithm as ProjectService.getNextProjectCode()
    let query = this.supabase
      .from('projects')
      .select('code');

    const { data, error } = await query;

    if (error) {
      console.error('Error generating next project code:', error);
      throw error;
    }

    let maxNumber = 0;

    if (data && data.length > 0) {
      // Extract numbers from PRJ-XXX format codes (EXACT SAME logic)
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

    // Increment and format with leading zeros (EXACT SAME)
    const nextNumber = maxNumber + 1;
    const code = `PRJ-${String(nextNumber).padStart(3, '0')}`;

    return code;
  }

  async linkToPeriod(projectId: string, periodLabel: string, planPrice: number, actualPrice: number): Promise<void> {
    // EXACT SAME logic as ProjectService linking to period
    const { error } = await this.supabase
      .from('period_projects')
      .insert({
        period_label: periodLabel,
        project_id: projectId,
        plan_price: planPrice,
        actual_price: actualPrice,
      });

    if (error) {
      console.error('[SupabaseProjectRepository] ERROR linking project to period:', error);
      // Don't throw - project was created successfully
    }
  }

  async updatePriceForPeriod(projectId: string, periodLabel: string, prices: { planPrice?: number; actualPrice?: number }): Promise<void> {
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

    const dtoUpdates: any = {};
    if (prices.planPrice !== undefined) dtoUpdates.plan_price = prices.planPrice;
    if (prices.actualPrice !== undefined) dtoUpdates.actual_price = prices.actualPrice;

    const { error } = await this.supabase
      .from('period_projects')
      .update(dtoUpdates)
      .eq('project_id', projectId)
      .eq('period_label', periodLabel);

    if (error) throw error;
  }

  // --- Reordering ---

  async moveUp(projectId: string, periodLabel: string): Promise<void> {
    // EXACT SAME logic as ProjectService.moveProjectUp()
    const { data: allProjects, error: fetchError } = await this.supabase
      .from('projects')
      .select('id, display_order')
      .order('display_order', { ascending: true });

    if (fetchError) throw fetchError;
    if (!allProjects || allProjects.length === 0) return;

    const currentIndex = allProjects.findIndex(p => p.id === projectId);
    if (currentIndex <= 0) return; // Already at top or not found

    const currentProject = allProjects[currentIndex];
    const aboveProject = allProjects[currentIndex - 1];

    // Swap display_order values
    await this.supabase.from('projects').update({ display_order: aboveProject.display_order }).eq('id', currentProject.id);
    await this.supabase.from('projects').update({ display_order: currentProject.display_order }).eq('id', aboveProject.id);
  }

  async moveDown(projectId: string, periodLabel: string): Promise<void> {
    // EXACT SAME logic as ProjectService.moveProjectDown()
    const { data: allProjects, error: fetchError } = await this.supabase
      .from('projects')
      .select('id, display_order')
      .order('display_order', { ascending: true });

    if (fetchError) throw fetchError;
    if (!allProjects || allProjects.length === 0) return;

    const currentIndex = allProjects.findIndex(p => p.id === projectId);
    if (currentIndex < 0 || currentIndex >= allProjects.length - 1) return; // Already at bottom or not found

    const currentProject = allProjects[currentIndex];
    const belowProject = allProjects[currentIndex + 1];

    // Swap display_order values
    await this.supabase.from('projects').update({ display_order: belowProject.display_order }).eq('id', currentProject.id);
    await this.supabase.from('projects').update({ display_order: currentProject.display_order }).eq('id', belowProject.id);
  }
}
