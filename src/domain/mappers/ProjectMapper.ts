/**
 * Project Mapper
 *
 * Converts between Data layer (DTO - snake_case) and Domain layer (Entity - camelCase).
 * This ensures the domain layer is independent of database structure.
 */

import { Project, ProjectStatus } from '../entities/Project';
import { ProjectDTO } from '../../data/dto/ProjectDTO';

export class ProjectMapper {
  /**
   * Convert from database DTO to domain entity
   */
  static toDomain(dto: ProjectDTO): Project {
    return {
      id: dto.id,
      code: dto.code,
      name: dto.name,
      type: dto.type,
      software: dto.software,
      status: dto.status as ProjectStatus,
      unitPrice: dto.unit_price,
      planPrice: dto.plan_price,
      actualPrice: dto.actual_price,
      notes: dto.notes,
      exclusionMark: dto.exclusion_mark,
      displayOrder: dto.display_order,
      createdAt: new Date(dto.created_at),
      period: dto.period || '',
    };
  }

  /**
   * Convert from domain entity to database DTO
   */
  static toDTO(domain: Omit<Project, 'id' | 'createdAt'>): Omit<ProjectDTO, 'id' | 'created_at'> {
    return {
      code: domain.code,
      name: domain.name,
      type: domain.type,
      software: domain.software,
      status: domain.status,
      unit_price: domain.unitPrice,
      plan_price: domain.planPrice,
      actual_price: domain.actualPrice,
      notes: domain.notes,
      exclusion_mark: domain.exclusionMark,
      display_order: domain.displayOrder,
      period: domain.period,
    };
  }

  /**
   * Convert array of DTOs to domain entities
   */
  static toDomainArray(dtos: ProjectDTO[]): Project[] {
    return dtos.map(dto => this.toDomain(dto));
  }

  /**
   * Convert for full entity to DTO (including id and created_at)
   */
  static toFullDTO(domain: Project): ProjectDTO {
    return {
      id: domain.id,
      code: domain.code,
      name: domain.name,
      type: domain.type,
      software: domain.software,
      status: domain.status,
      unit_price: domain.unitPrice,
      plan_price: domain.planPrice,
      actual_price: domain.actualPrice,
      notes: domain.notes,
      exclusion_mark: domain.exclusionMark,
      display_order: domain.displayOrder,
      created_at: domain.createdAt.toISOString(),
      period: domain.period,
    };
  }
}
