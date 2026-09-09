/**
 * Get Projects Use Case
 *
 * Business operation: Retrieve projects, optionally filtered by period.
 * This is a simple use case that delegates to the repository.
 */

import { injectable, inject } from 'inversify';
import { Project } from '../../entities/Project';
// `import type` is required: the constructor below is decorated, and with
// isolatedModules + emitDecoratorMetadata a value import of a type-only symbol
// in a decorated signature is a TS1272 error.
import type { IProjectRepository } from '../../repositories/IProjectRepository';
import { TYPES } from '@ioc/types';

export interface GetProjectsInput {
  period?: string;
}

@injectable()
export class GetProjectsUseCase {
  constructor(
    @inject(TYPES.ProjectRepository) private projectRepository: IProjectRepository
  ) {}

  async execute(input: GetProjectsInput = {}): Promise<Project[]> {
    if (input.period) {
      return await this.projectRepository.getByPeriod(input.period);
    }
    return await this.projectRepository.getAll();
  }
}
