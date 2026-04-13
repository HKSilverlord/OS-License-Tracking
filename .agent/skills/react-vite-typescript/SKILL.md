---
name: react-vite-typescript
description: React 19 + Vite 6 + TypeScript development patterns specific to this project. Covers component structure, hooks, state management with Zustand, routing with react-router-dom, and Vite configuration.
---

# React + Vite + TypeScript Patterns

## Tech Stack Reference

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.x | UI framework |
| Tailwind CSS | 4.x | Utility-first CSS (via `@tailwindcss/vite` plugin) |
| Vite | 6.2.x | Build tool & dev server |
| TypeScript | 5.8.x | Type safety |
| Zustand | 5.0.x | Global state management |
| react-router-dom | 7.10.x | Client-side routing (HashRouter) |
| Lucide React | 0.556.x | Icon library |
| Recharts | 3.5.x | Charts & data visualization |
| html2canvas | 1.4.x | Chart/section export to image |
| xlsx | 0.18.x | Excel import/export |
| @dnd-kit | 6.3.x / 10.x | Drag-and-drop sorting |

## Path Aliases

Configured in `vite.config.ts`:

```typescript
'@'            → project root
'@domain'      → ./src/domain
'@data'        → ./src/data
'@presentation'→ ./src/presentation
'@ui'          → ./src/ui
'@core'        → ./src/core
'@ioc'         → ./src/ioc
```

Always use these aliases in imports. Never use relative paths across layers.

## Component Conventions

### File Naming
- React components: `PascalCase.tsx` (e.g., `TrackingView.tsx`)
- Hooks: `use*.ts` (e.g., `useCatiaStore.ts`)
- Utilities: `camelCase.ts` (e.g., `chartExport.ts`)
- Services: `PascalCase.ts` (e.g., `ProjectService.ts`)

### Component Structure

```tsx
import React, { useState, useEffect } from 'react';
// 1. External deps
// 2. Internal services/hooks
// 3. Types
// 4. Sibling components

interface ComponentProps {
  currentYear: number;
  // ...typed props
}

export const ComponentName: React.FC<ComponentProps> = ({ currentYear }) => {
  // State
  // Effects
  // Handlers
  // Render
};
```

### State Management

- **Local state**: `useState` / `useReducer` for component-scoped state
- **Global state**: Zustand stores in `stores/` directory
- **Server state**: Direct Supabase calls via service layer (legacy) or Use Cases (clean arch)

### Routing

Uses `HashRouter` for SPA compatibility with static hosting:
```tsx
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
```

Main routes defined in `App.tsx`:
- `/` → Dashboard
- `/tracking` → TrackingView
- `/catia-license` → CatiaLicenseView
- `/yearly-data` → YearlyDataView
- `/total` → TotalView
- `/long-term-plan` → LongTermPlanView
- `/monthly-plan-actual` → MonthlyPlanActualView
- `/period-management` → PeriodManagement
- `/diagnostic` → DatabaseDiagnostic

## i18n (Internationalization)

Multi-language support via `LanguageContext`:
- Languages: Japanese (`ja`), English (`en`), Vietnamese (`vn`)
- Access: `const { t, language, toggleLanguage } = useLanguage();`
- All user-facing strings must use `t('key.path')` translations

## Dev Server

```bash
npm run dev    # Starts on http://localhost:3000
npm run build  # Production build to dist/
```

## Environment Variables

Prefix with `VITE_` for client-side access:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key

Access via `import.meta.env.VITE_*` or the `getEnvVar()` helper in `constants.ts`.
