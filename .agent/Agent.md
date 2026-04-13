# Agent.md — OS Management System (Bangchamcong / 工数管理)

> **Last Updated**: 2026-04-13
> **Maintainer**: Tuấn Anh @ ESUTECH

---

## 🎯 Project Identity

**OS Management System** is an outsourcing project management tool for tracking engineering work hours, revenue, and CATIA license costs. Built for a Japanese company managing CAD/engineering outsourcing operations.

**Core Functions**:
- 📊 **Dashboard** — KPI metrics, revenue charts, achievement rates
- 📋 **Project Tracking** — Plan vs. actual hours per month
- 💰 **Revenue Management** — Dual pricing (plan/actual), multi-period
- 🖥️ **CATIA License Tracking** — License cost per computer
- 📈 **Long-term Planning** — Multi-year trend analysis
- 📤 **Export** — Excel, CSV, PNG chart export
- 🌐 **i18n** — Japanese / English / Vietnamese

---

## 🏗️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.2.x |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite` plugin) | 4.x |
| **Build** | Vite | 6.2.x |
| **Language** | TypeScript | 5.8.x (strict) |
| **State** | Zustand | 5.0.x |
| **Routing** | react-router-dom (HashRouter) | 7.10.x |
| **DI** | Inversify | 7.11.x |
| **Backend** | Supabase (PostgreSQL) | 2.87.x SDK |
| **Auth** | Supabase Auth | Built-in |
| **Charts** | Recharts | 3.5.x |
| **Icons** | Lucide React | 0.556.x |
| **DnD** | @dnd-kit | 6.3.x / 10.x |
| **Export** | xlsx + html2canvas | 0.18.x / 1.4.x |
| **Deploy** | Docker + Nginx | node:20 / nginx:alpine |

### Why React + Tailwind CSS?

Based on ecosystem analysis ([reference](data/Choosing%20a%20Frontend%20Stack%20for%20Dashboards%20with%20Charts%20and%20Tables.md)):
- **Largest ecosystem** of dashboard templates, UI kits, and charting integrations
- **Mature TypeScript support** with Vite for fast DX
- **Utility-first styling** for rapid, consistent, responsive dashboards
- **Rich charting** via Recharts (integrated), with Tremor-style patterns for KPI cards

---

## 🎨 Styling (Tailwind CSS v4)

### Setup

Tailwind CSS v4 is integrated via the **Vite plugin** (build-time, tree-shaken — not CDN):

- **Plugin**: `@tailwindcss/vite` in `vite.config.ts`
- **Entry CSS**: `index.css` with `@import "tailwindcss"` + `@theme { ... }`
- **Font**: Inter (Google Fonts, loaded in `index.html`)
- **No `tailwind.config.js`** — Tailwind v4 uses CSS-first configuration

### Key CSS File (`index.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

### Design System Quick Reference

| Element | Classes |
|---------|---------|
| **Page background** | `bg-slate-50` |
| **Card** | `bg-white rounded-xl shadow-sm border border-slate-200` |
| **Card elevated** | `bg-white rounded-xl shadow-md` |
| **Sidebar** | `bg-slate-900 text-white` |
| **Primary button** | `bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg` |
| **Success button** | `bg-emerald-600 hover:bg-emerald-700 text-white` |
| **Page title** | `text-2xl font-bold text-slate-900` |
| **Table header** | `text-xs font-semibold text-slate-600 uppercase tracking-wider` |
| **Active nav** | `bg-blue-600 text-white shadow-md` |
| **Inactive nav** | `text-slate-400 hover:bg-slate-800 hover:text-white` |

### Chart Color Palette

| Semantic | Hex | Tailwind |
|----------|-----|---------|
| Plan/Forecast | `#3B82F6` | `blue-500` |
| Actual | `#10B981` | `emerald-500` |
| Warning | `#F59E0B` | `amber-500` |
| Danger | `#EF4444` | `red-500` |
| Accent | `#8B5CF6` | `violet-500` |

### Styling Rules

- ✅ Use Tailwind utility classes for all styling
- ✅ Use standard spacing scale (`p-4`, `gap-6`) — avoid arbitrary values (`px-[13px]`)
- ✅ Wrap charts in `<ResponsiveContainer>` for responsive sizing
- ✅ Use `transition-colors` / `transition-all duration-300` for interactions
- ❌ No inline `style={{}}` for colors or spacing
- ❌ No CDN Tailwind — use the Vite plugin build

---

## 📂 Architecture

This project follows **Clean Architecture** with Inversify DI, coexisting with legacy code during migration:

```
project-root/
├── .agent/                    # AI Agent configuration
│   ├── Agent.md              # ← This file
│   ├── rules/                # Project enforcement rules
│   ├── skills/               # Project-specific skills (11 skills)
│   └── workflows/            # Development workflows
│
├── src/                       # Clean Architecture (Active)
│   ├── core/                 # Logger, shared utilities
│   ├── data/                 # Repository implementations, DTOs, Supabase clients
│   │   ├── clients/          #   supabaseClient.ts
│   │   ├── dto/              #   Data Transfer Objects
│   │   └── repositories/     #   Supabase*Repository implementations
│   ├── domain/               # Pure business logic (NO external deps)
│   │   ├── entities/         #   Business entities
│   │   ├── mappers/          #   Entity ↔ DTO mappers
│   │   ├── repositories/     #   I*Repository interfaces
│   │   └── usecases/         #   Business use cases
│   ├── dataStore/            # Zustand store slices
│   ├── ioc/                  # Inversify DI container, types, hooks, modules
│   ├── presentation/         # ViewModels, Presenters
│   └── ui/                   # React components, pages, layouts
│
├── components/                # Legacy React components (⚠️ migrating to src/ui/)
├── services/                  # Legacy service classes (⚠️ migrating to src/domain/usecases)
│   └── dbService.ts          #   Facade over legacy services
├── contexts/                  # LanguageContext (i18n)
├── stores/                    # Zustand stores (useCatiaStore)
├── utils/                     # Chart export, CSV export, table styles, helpers
├── lib/                       # Supabase client (legacy location)
├── data/                      # CSV/Excel sample data files
├── db/                        # SQL migrations, schema, seeds
│
├── App.tsx                    # Root app — routing, auth, period state
├── index.tsx                  # Entry point (imports reflect-metadata first)
├── index.css                  # Tailwind CSS v4 entry (@import "tailwindcss")
├── index.html                 # HTML shell (Inter font, no CDN scripts)
├── types.ts                   # Shared TypeScript types & enums
├── constants.ts               # Env vars, defaults, project types
├── vite.config.ts             # Vite + Tailwind plugin + path aliases
├── Dockerfile                 # Multi-stage Docker build
└── nginx.conf                 # Production nginx config
```

### Dependency Flow

```
UI → Presentation → Domain ← Data
         ↑                     ↑
         └────── IoC ──────────┘
```

**Rule**: Domain layer has ZERO external dependencies.

---

## 🛠️ Skills Reference

### All 11 Project-Specific Skills

| # | Skill | Path | Covers |
|---|-------|------|--------|
| 1 | **scrollytelling-landing-page** | `skills/scrollytelling-landing-page/SKILL.md` | Scroll-driven landing pages, GSAP ScrollTrigger, Framer Motion, Lenis smooth scroll, sticky sections, reveal animations, hero/CTA/pricing patterns, section architecture, 2026 design trends |
| 2 | **dashboard-ui** | `skills/dashboard-ui/SKILL.md` | Tailwind layout, components (KPI cards, tables, nav), responsive design, chart styling, typography, buttons, status badges, dark mode prep |
| 3 | **react-vite-typescript** | `skills/react-vite-typescript/SKILL.md` | React 19 patterns, hooks, Zustand state, routing, Vite config, path aliases, component conventions |
| 4 | **clean-architecture** | `skills/clean-architecture/SKILL.md` | Inversify DI, entity/repository/use case creation, layer separation, legacy migration guide |
| 5 | **supabase-integration** | `skills/supabase-integration/SKILL.md` | Client singleton, query patterns (select/upsert/join), auth flow, RLS, error handling |
| 6 | **database-migrations** | `skills/database-migrations/SKILL.md` | PostgreSQL schema, migration SQL conventions, RLS policies, data imports |
| 7 | **period-project-management** | `skills/period-project-management/SKILL.md` | H1/H2 periods, pricing (plan/actual), time tracking, CATIA licensing, revenue formulas |
| 8 | **data-visualization** | `skills/data-visualization/SKILL.md` | Recharts charts, html2canvas export, xlsx/CSV export, KPI metrics, chart colors |
| 9 | **i18n-localization** | `skills/i18n-localization/SKILL.md` | LanguageContext (ja/en/vn), `t()` function, translation key patterns, adding strings |
| 10 | **deployment-docker** | `skills/deployment-docker/SKILL.md` | Multi-stage Docker, nginx, build args, env vars, deployment checklist |
| 11 | **project-knowledge** | `skills/project-knowledge/SKILL.md` | Architecture docs, feature guides, reference images, context history |

### Skill Selection Matrix

| When you need to... | Use this skill | Also consider |
|---------------------|---------------|---------------|
| Build a landing page / marketing site | **scrollytelling-landing-page** | dashboard-ui, react-vite-typescript |
| Add scroll animations / sticky sections | **scrollytelling-landing-page** | — |
| Build a new feature end-to-end | **clean-architecture** | react-vite-typescript, supabase-integration |
| Create/modify UI components | **dashboard-ui** | react-vite-typescript, i18n-localization |
| Style layouts, cards, tables | **dashboard-ui** | — |
| Create/update charts & KPIs | **data-visualization** | dashboard-ui |
| Change database schema | **database-migrations** | supabase-integration |
| Query or mutate data | **supabase-integration** | clean-architecture |
| Add/modify translations | **i18n-localization** | — |
| Understand business logic | **period-project-management** | project-knowledge |
| Fix bugs in legacy code | **project-knowledge** | react-vite-typescript |
| Deploy to production | **deployment-docker** | — |

---

## 🔧 Development Workflows

### `/dev` — Start Development
```bash
npm install    # Install dependencies (includes Tailwind v4)
npm run dev    # Starts on http://localhost:3000
```

### `/build` — Docker Production Build
```powershell
docker build -t os-management-system . `
  --build-arg VITE_SUPABASE_URL=$env:VITE_SUPABASE_URL `
  --build-arg VITE_SUPABASE_ANON_KEY=$env:VITE_SUPABASE_ANON_KEY
docker run -p 8080:80 os-management-system
```

---

## 📋 Coding Standards

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| React components | PascalCase | `TrackingView.tsx` |
| Logic/utils | camelCase | `chartExport.ts` |
| Service classes | PascalCase | `ProjectService.ts` |
| Interfaces | I-prefix PascalCase | `IProjectRepository` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_UNIT_PRICE` |
| Hooks | use-prefix camelCase | `useCatiaStore` |
| DB tables | snake_case plural | `monthly_records` |
| DB columns | snake_case | `created_at` |
| CSS classes | Tailwind utilities | `bg-white rounded-xl shadow-sm` |

### TypeScript Rules
- `strict: true` — No `any` types
- All public functions must have type annotations
- Use path aliases (`@domain/`, `@data/`, etc.) — never relative cross-layer imports
- Prefer `interface` over `type` for object shapes

### React + Tailwind Rules
- Functional components only (no class components)
- All user-facing strings go through `t()` i18n function
- All styling via Tailwind utility classes (no inline styles, no vanilla CSS for layout)
- Wrap charts in `<ResponsiveContainer>` for responsiveness
- Use semantic HTML (`<section>`, `<nav>`, `<header>`, `<main>`, `<aside>`)
- Custom CSS only for scrollbars and Tailwind `@theme` overrides

### Git Conventions
- Branch naming: `feature/`, `fix/`, `refactor/`
- Commit messages: Conventional Commits format

---

## ⚠️ Known Issues & Legacy

1. **Hybrid Structure**: Code exists in both root (`components/`, `services/`) and `src/` (Clean Architecture). New code goes in `src/`.
2. **Legacy dbService Facade**: `services/dbService.ts` wraps all legacy services. Still used by most components — will be replaced gradually.
3. **Duplicate Auth Check**: `App.tsx` has a duplicate `if (!session)` guard. Cosmetic, not harmful.
4. **Mixed Imports**: Some files use both `@domain/` aliases and root-relative paths. Always prefer aliases.
5. **`unit_price` Deprecated**: Projects now use `plan_price` / `actual_price`. The old field remains for backward compatibility.

---

## 🔒 Security

- ✅ Supabase RLS enabled on all tables
- ✅ Credentials in `.env.local` (gitignored)
- ✅ Anonymous key only (no service_role key in frontend)
- ✅ Auth flow via Supabase Auth
- ❌ Never hardcode secrets
- ❌ Never commit `.env` files

---

## 📖 Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Root component — routing, auth, sidebar, year selector |
| `index.css` | Tailwind v4 entry (`@import "tailwindcss"` + `@theme`) |
| `index.html` | HTML shell (Inter font, no CDN) |
| `vite.config.ts` | Vite + `@tailwindcss/vite` plugin + path aliases |
| `constants.ts` | Env vars, default prices, project types, software options |
| `types.ts` | Shared TypeScript interfaces and enums |
| `contexts/LanguageContext.tsx` | i18n translations (ja/en/vn) |
| `services/dbService.ts` | Legacy service facade |
| `src/ioc/container.ts` | Inversify DI container bindings |
| `src/ioc/types.ts` | DI symbols |

### Path Aliases (vite.config.ts + tsconfig.json)
```
@              → project root
@domain        → src/domain
@data          → src/data
@presentation  → src/presentation
@ui            → src/ui
@core          → src/core
@ioc           → src/ioc
```

### Routes (App.tsx)

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | Dashboard | KPI cards, revenue charts |
| `/tracking` | TrackingView | Monthly hours grid |
| `/catia-license` | CatiaLicenseView | License cost tracking |
| `/yearly-data` | YearlyDataView | Year-over-year data |
| `/total` | TotalView | Aggregated totals |
| `/long-term-plan` | LongTermPlanView | Multi-year trends |
| `/monthly-plan-actual` | MonthlyPlanActualView | Plan vs actual charts |
| `/period-management` | PeriodManagement | Period CRUD |
| `/diagnostic` | DatabaseDiagnostic | DB repair tools |
