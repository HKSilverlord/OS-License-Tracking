# Project Rules

> Location: `.agent/rules/project-rules.md`
> Status: Active
> Framework: SASE

---

## 📋 Project Overview

- **Project Name**: OS Management System (Bangchamcong)
- **Description**: Management system implementation using Clean Architecture principles.
- **Tech Stack**:
    -   **Frontend**: React 19, Vite, TypeScript, Zustand (State Management)
    -   **Architecture**: Clean Architecture + Inversify (DI)
    -   **UI**: Generic Components (likely Custom/Tailwind), Lucide React (Icons)
    -   **Backend/DB**: Supabase (PostgreSQL), Edge Functions (implied)
    -   **Tooling**: ESLint, Prettier

---

## 📂 Project Structure

This project follows a **Hybrid Structure** migrating towards **Clean Architecture**.

```
project-root/
├── .agent/                 # AI Agent rules & workflows
├── db/                     # Database migrations & SQL scripts
├── public/                 # Static assets
├── services/               # Legacy Services (Deprecating)
├── src/                    # Main Source Code (Clean Arch)
│   ├── core/               # Core business logic & shared kernel
│   ├── data/               # Data Layer (API Impl, Repositories)
│   ├── domain/             # Domain Layer (Entities, Use Cases, Interfaces)
│   ├── ioc/                # Inversion of Control (DI Container setup)
│   ├── presentation/       # View Models / Presenters
│   └── ui/                 # React UI Components
├── components/             # Legacy/Shared Components (Refactoring to src/ui)
└── utils/                  # Shared Utilities
```

---

## 🔧 Coding Standards

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (React) | PascalCase | `EditProjectModal.tsx` |
| Files (Logic) | camelCase/PascalCase | `dbService.ts`, `ProjectService.ts` |
| Classes | PascalCase | `ProjectRepository` |
| Interfaces | PascalCase (Prefix I) | `IUserRepository` |
| Functions | camelCase | `getUserById` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| React Components | PascalCase | `UserProfile` |
| Hooks | camelCase (use*) | `useAuth` |

### Code Style & Patterns

-   **Clean Architecture**:
    -   **Domain**: Pure TS, no external deps (React, Supabase). Defines `Entities` and `Repository Interfaces`.
    -   **Data**: Implements `Repository Interfaces`. Depends on Supabase SDK.
    -   **IoC**: Use `inversify` to bind implementations to interfaces.
    -   **UI**: Depends on `UseCases` or `Presenters` (via DI), NOT directly on Data/API.
-   **State Management**: Use `Zustand` for global UI state.
-   **Type Safety**: `strict: true` is enabled. No `any`.

---

## 🔒 Security Requirements

### Authentication & API
-   **Supabase Auth**: Use Supabase provided auth context/hooks.
-   **Secrets**:
    -   Store API keys and URLs in `.env` (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
    -   **NEVER** commit `.env` files.
    -   **NEVER** hardcode secrets in source files.

### Data Access
-   **Row Level Security (RLS)**: Ensure all tables have RLS policies enabled in Supabase.
-   **Client-Side**: Assume all client-side code is public. Sensitive logic goes to Edge Functions.

---

## 🗄️ Database Conventions

-   **Platform**: PostgreSQL (via Supabase)
-   **Location**: `db/` folder contains SQL migrations.
-   **Naming**:
    -   Tables: `snake_case`, plural (e.g., `projects`, `period_projects`).
    -   Columns: `snake_case` (e.g., `created_at`, `project_id`).
-   **Migrations**: Always create a `.sql` file in `db/` for schema changes.

---

## 🌐 API Design

-   **Communication**: Direct Supabase Client calls (in `Data` layer) or Edge Function calls.
-   **Error Handling**: Wrap external calls in try-catch and return domain-specific Result/Error types.

---

## 🧪 Testing Requirements

-   **Unit Tests**: Focus on `domain` (business logic) and `presentation` logic.
-   **Integration Tests**: Test `data` repositories against a mock or test DB.
-   **Location**: Co-located `__tests__` or `tests/` directory (TBD).

---

## 🔄 Git Workflow

-   **Branches**: `feature/`, `fix/`, `refactor/`.
-   **Commits**: Descriptive messages.

---

## ⚠️ Known Issues & Legacy

-   **Legacy Services**: `services/*.ts` are legacy. Prefer creating Use Cases in `src/domain/usecases`.
-   **Legacy Components**: `components/*.tsx` might need moving to `src/ui`.
-   **Mixed Structure**: Be aware of imports spanning between `src/` and root folders.

---

*Verified by SASE Agent on 2026-01-19*
