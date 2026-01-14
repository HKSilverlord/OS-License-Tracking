/**
 * React Hooks for Use Cases
 *
 * These hooks provide easy access to use cases from React components.
 * The hooks use the DI container to resolve dependencies.
 */

import { useMemo } from 'react';
import { container } from '../container';
import { TYPES } from '../types';
import { GetProjectsUseCase } from '@domain/usecases/project/GetProjectsUseCase';

/**
 * Hook to get GetProjectsUseCase
 */
export function useGetProjectsUseCase(): GetProjectsUseCase {
  return useMemo(
    () => container.get<GetProjectsUseCase>(TYPES.GetProjectsUseCase),
    []
  );
}
