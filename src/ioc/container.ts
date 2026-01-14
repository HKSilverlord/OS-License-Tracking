/**
 * Dependency Injection Container
 *
 * This file sets up the IoC container and wires all dependencies together.
 * IMPORTANT: import 'reflect-metadata' must be first in main.tsx
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types';

// External Services
import { supabase } from '@data/clients/supabaseClient';

// Repositories
import { IProjectRepository } from '@domain/repositories/IProjectRepository';
import { SupabaseProjectRepository } from '@data/repositories/SupabaseProjectRepository';

// Use Cases
import { GetProjectsUseCase } from '@domain/usecases/project/GetProjectsUseCase';

// Create container
const container = new Container();

// Bind Supabase client (singleton - same instance everywhere)
container.bind(TYPES.SupabaseClient).toConstantValue(supabase);

// Bind Repositories (singleton - one instance per app)
container
  .bind<IProjectRepository>(TYPES.ProjectRepository)
  .to(SupabaseProjectRepository)
  .inSingletonScope();

// Bind Use Cases (singleton - one instance per app)
container
  .bind<GetProjectsUseCase>(TYPES.GetProjectsUseCase)
  .to(GetProjectsUseCase)
  .inSingletonScope();

export { container };
