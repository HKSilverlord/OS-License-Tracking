/**
 * Dependency Injection Types (Symbols)
 *
 * These symbols are used to identify dependencies in the IoC container.
 * Using symbols prevents naming collisions.
 */

export const TYPES = {
  // External Services
  SupabaseClient: Symbol.for('SupabaseClient'),

  // Repositories
  ProjectRepository: Symbol.for('IProjectRepository'),

  // Use Cases
  GetProjectsUseCase: Symbol.for('GetProjectsUseCase'),
};
