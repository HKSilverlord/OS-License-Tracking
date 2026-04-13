---
name: clean-architecture
description: Clean Architecture implementation guide with Inversify DI. Covers domain entities, repository interfaces, use cases, data layer implementations, IoC container configuration, and the migration path from legacy services.
---

# Clean Architecture + Inversify DI

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (src/ui/)                                 │
│  React components, pages, layouts                   │
├─────────────────────────────────────────────────────┤
│  Presentation Layer (src/presentation/)              │
│  ViewModels, Presenters, data transformation         │
├─────────────────────────────────────────────────────┤
│  Domain Layer (src/domain/)                          │
│  Entities, Repository Interfaces, Use Cases          │
│  ⚠️ ZERO external dependencies                      │
├─────────────────────────────────────────────────────┤
│  Data Layer (src/data/)                              │
│  Repository implementations, DTOs, API clients       │
├─────────────────────────────────────────────────────┤
│  IoC Container (src/ioc/)                            │
│  Inversify bindings, DI symbols                      │
├─────────────────────────────────────────────────────┤
│  Core (src/core/)                                    │
│  Logger, shared utilities                            │
└─────────────────────────────────────────────────────┘
```

## Dependency Rule

**Dependencies flow inward only:**
- `UI` → `Presentation` → `Domain` ← `Data`
- `Domain` depends on NOTHING external
- `Data` implements `Domain` interfaces
- `IoC` wires everything together

## Directory Structure

```
src/
├── core/
│   ├── logger/          # Logging utilities
│   └── utils/           # Shared helpers
├── data/
│   ├── clients/         # API clients (supabaseClient.ts)
│   ├── dto/             # Data Transfer Objects
│   └── repositories/    # Supabase* implementations
├── dataStore/
│   └── slices/          # Zustand store slices
├── domain/
│   ├── entities/        # Business entities
│   ├── mappers/         # Entity ↔ DTO mappers
│   ├── repositories/    # I*Repository interfaces
│   └── usecases/        # Business use cases
├── ioc/
│   ├── container.ts     # DI container setup
│   ├── types.ts         # DI symbols
│   ├── hooks/           # React DI hooks
│   └── modules/         # Container modules
├── presentation/
│   ├── project/         # Project view models
│   └── tracking/        # Tracking view models
└── ui/
    ├── components/      # Shared UI components
    ├── layouts/         # Page layouts
    └── pages/           # Route pages
```

## Creating a New Feature

### Step 1: Domain Entity
`src/domain/entities/<Feature>.ts`
```typescript
export class Feature {
  constructor(
    public readonly id: string,
    public name: string,
    // ... business properties only
  ) {}
}
```

### Step 2: Repository Interface
`src/domain/repositories/I<Feature>Repository.ts`
```typescript
import { Feature } from '../entities/Feature';

export interface IFeatureRepository {
  getAll(): Promise<Feature[]>;
  getById(id: string): Promise<Feature | null>;
  create(entity: Feature): Promise<void>;
  update(entity: Feature): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Step 3: Use Case
`src/domain/usecases/<feature>/Get<Feature>sUseCase.ts`
```typescript
import { inject, injectable } from 'inversify';
import { TYPES } from '@ioc/types';
import type { IFeatureRepository } from '../repositories/IFeatureRepository';

@injectable()
export class GetFeaturesUseCase {
  constructor(
    @inject(TYPES.FeatureRepository) private _repo: IFeatureRepository
  ) {}

  async execute(): Promise<Feature[]> {
    return this._repo.getAll();
  }
}
```

### Step 4: Data Repository Implementation
`src/data/repositories/Supabase<Feature>Repository.ts`
```typescript
import { inject, injectable } from 'inversify';
import { TYPES } from '@ioc/types';
import { IFeatureRepository } from '@domain/repositories/IFeatureRepository';
import type { SupabaseClient } from '@supabase/supabase-js';

@injectable()
export class SupabaseFeatureRepository implements IFeatureRepository {
  constructor(
    @inject(TYPES.SupabaseClient) private _client: SupabaseClient
  ) {}

  async getAll(): Promise<Feature[]> {
    const { data, error } = await this._client
      .from('features')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch features: ${error.message}`);
    return data.map(row => new Feature(row.id, row.name));
  }

  // ... implement other methods
}
```

### Step 5: IoC Registration

**`src/ioc/types.ts`** — Add symbols:
```typescript
export const TYPES = {
  // ... existing
  FeatureRepository: Symbol.for('IFeatureRepository'),
  GetFeaturesUseCase: Symbol.for('GetFeaturesUseCase'),
};
```

**`src/ioc/container.ts`** — Bind:
```typescript
container
  .bind<IFeatureRepository>(TYPES.FeatureRepository)
  .to(SupabaseFeatureRepository)
  .inSingletonScope();

container
  .bind<GetFeaturesUseCase>(TYPES.GetFeaturesUseCase)
  .to(GetFeaturesUseCase)
  .inSingletonScope();
```

### Step 6: UI Consumption
```tsx
import { container } from '@ioc/container';
import { TYPES } from '@ioc/types';
import { GetFeaturesUseCase } from '@domain/usecases/feature/GetFeaturesUseCase';

const useCase = container.get<GetFeaturesUseCase>(TYPES.GetFeaturesUseCase);
const features = await useCase.execute();
```

## Legacy Code Coexistence

The project has a **hybrid structure**:

| Location | Type | Status |
|---|---|---|
| `services/*.ts` | Legacy service classes | ⚠️ Deprecating |
| `services/dbService.ts` | Facade over legacy services | ⚠️ Deprecating |
| `components/*.tsx` | Legacy UI components | ⚠️ Migrating to `src/ui/` |
| `src/domain/` | Clean Architecture domain | ✅ Active |
| `src/data/` | Clean Architecture data | ✅ Active |

### Migration Strategy
1. New features → Always use Clean Architecture
2. Bug fixes in legacy code → Fix in place, no refactor required
3. Major changes to legacy → Refactor to Clean Architecture
4. `dbService` facade remains for backward compatibility

## Important Notes

- `reflect-metadata` must be imported first in the entry point (`main.tsx`)
- Inversify requires `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json`
- Use `@injectable()` on all classes resolved by the container
- Use `@inject(TYPES.*)` for constructor injection
