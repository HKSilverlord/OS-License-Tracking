---
name: clean-architecture
description: Generate code components following the Clean Architecture pattern (Domain, Data, Presentation, UI).
---

# Clean Architecture Code Generation

This skill guides the creation of new features using the Clean Architecture implementation in this project.

## Context
This project uses a strict separation of concerns:
- **Domain**: Pure business logic, entities, and repository interfaces. No external dependencies (no React, no Supabase).
- **Data**: Implementations of repositories, API calls, wrappers. Depends on infrastructure (Supabase).
- **Presentation**: ViewModels or Logic that prepares data for the UI.
- **UI**: React components. specific UI logic.
- **IoC**: InversifyJS for Dependency Injection.

## 1. Domain Layer (The Core)
Start by defining the business objects and interfaces.

**File:** `src/domain/entities/<Feature>.ts`
```typescript
export class <Feature> {
  constructor(
    public readonly id: string,
    public name: string,
    public createdAt: Date
    // ...
  ) {}
}
```

**File:** `src/domain/repositories/I<Feature>Repository.ts`
```typescript
import { <Feature> } from '../entities/<Feature>';

export interface I<Feature>Repository {
  getAll(): Promise<<Feature>[]>;
  getById(id: string): Promise<<Feature> | null>;
  create(entity: <Feature>): Promise<void>;
  update(entity: <Feature>): Promise<void>;
}
```

**File:** `src/domain/usecases/<Action><Feature>.ts`
```typescript
import { inject, injectable } from 'inversify';
import { TYPES } from '../../ioc/types';
import type { I<Feature>Repository } from '../repositories/I<Feature>Repository';

@injectable()
export class <Action><Feature>UseCase {
  constructor(
    @inject(TYPES.<Feature>Repository) private _repo: I<Feature>Repository
  ) {}

  async execute(params: any): Promise<void> {
    // Business logic here
    await this._repo.create(...);
  }
}
```

## 2. Data Layer (The Implementation)
Implement the interfaces using Supabase.

**File:** `src/data/repositories/Supabase<Feature>Repository.ts`
```typescript
import { injectable } from 'inversify';
import { I<Feature>Repository } from '../../domain/repositories/I<Feature>Repository';
import { <Feature> } from '../../domain/entities/<Feature>';
import { supabase } from '../../utils/supabaseClient'; // Verify path

@injectable()
export class Supabase<Feature>Repository implements I<Feature>Repository {
  async getById(id: string): Promise<<Feature> | null> {
    const { data, error } = await supabase
      .from('<table_name>')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    return new <Feature>(data.id, data.name, new Date(data.created_at));
  }
  
  // Implement other methods
}
```

## 3. IoC Configuration
Bind the interface to the implementation.

**File:** `src/ioc/types.ts`
Add symbol:
```typescript
export const TYPES = {
  // ... existing
  <Feature>Repository: Symbol.for('<Feature>Repository'),
  <Action><Feature>UseCase: Symbol.for('<Action><Feature>UseCase'),
};
```

**File:** `src/ioc/container.ts`
Bind:
```typescript
import { Supabase<Feature>Repository } from '../data/repositories/Supabase<Feature>Repository';
import { I<Feature>Repository } from '../domain/repositories/I<Feature>Repository';
import { <Action><Feature>UseCase } from '../domain/usecases/<Action><Feature>';

container.bind<I<Feature>Repository>(TYPES.<Feature>Repository).to(Supabase<Feature>Repository);
container.bind<Action><Feature>UseCase>(TYPES.<Action><Feature>UseCase).to(<Action><Feature>UseCase);
```

## 4. UI/Presentation Layer
Use the Use Cases in your React components.

**File:** `src/ui/pages/<Feature>Page.tsx`
```typescript
import { useInjection } from '../../ioc/react-bindings'; // Or however DI is hooked up in React
import { TYPES } from '../../ioc/types';
import { <Action><Feature>UseCase } from '../../domain/usecases/<Action><Feature>';

export const <Feature>Page = () => {
  const useCase = useInjection<<Action><Feature>UseCase>(TYPES.<Action><Feature>UseCase);
  
  // Interaction logic
};
```
