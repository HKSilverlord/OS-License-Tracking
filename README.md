# OS License Tracking

Internal web application for tracking **outsourcing (OS) project hours, licence costs and
revenue** for a design/engineering team.

Work is planned and recorded per half-year period (`2025-H1`, `2025-H2`, …). For every
project the team enters **planned** and **actual hours per month**; the application
multiplies those hours by the price agreed *for that project in that period* and reports
revenue, achievement rate, capacity utilisation and — after subtracting CATIA licence cost
— net profit. The UI is available in Japanese, English and Vietnamese.

## Features

| Route | View | What it does |
|---|---|---|
| `/` | Dashboard | KPI cards (hours, gross revenue, licence cost, net profit) and monthly charts |
| `/tracking` | Tracking | The editable grid: planned/actual hours per project per month |
| `/catia-license` | CATIA Licence | Licence cost and licence revenue per machine |
| `/total` | Total | Aggregated totals for the selected year |
| `/yearly-data` | Yearly Data | Per-project yearly breakdown with manual ordering |
| `/long-term-plan` | Long-Term Plan | Multi-year revenue and hourly-rate trend |
| `/monthly-plan-actual` | Monthly Plan vs Actual | Plan/actual hours and revenue by month |
| `/period-management` | Period Management | Create periods and assign projects to them |
| `/diagnostic` | Diagnostic | Read-only database connectivity checks |

Access is role based: every signed-in user can read everything, only users with the
`admin` role can write (see [Roles](#roles-and-access-control)).

## Stack

- **React 19** + **TypeScript** (`strict`), **Vite 6**
- **Tailwind CSS v4** (`@tailwindcss/vite`), dark mode via the `dark` class
- **React Router 7** (`HashRouter`)
- **Recharts 3** for charts, **framer-motion 12** for transitions, **lucide-react** for icons
- **Zustand 5** for the CATIA licence store, **@dnd-kit** for drag-and-drop ordering
- **Supabase** (`@supabase/supabase-js`) — PostgreSQL, Auth and Row Level Security
- **xlsx** + **html2canvas** for Excel and chart export
- **inversify** — a Clean-Architecture container under `src/` used by part of the codebase

## Getting started

**Prerequisites:** Node.js 20+ and a Supabase project.

```bash
npm install
npm run dev
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the two values from your Supabase project
(**Project Settings > API**). No other variables are required.

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

`.env.local` is git-ignored — never commit real credentials. When deploying (Vercel,
Netlify, Docker, …) set the same two variables in the platform's environment settings.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | `tsc --noEmit` — must be clean before every commit |
| `npm run preview` | Serve the built `dist/` locally |

### Database setup

The application will not start usefully against an empty Supabase project. Follow
**[`db/SETUP_GUIDE.md`](db/SETUP_GUIDE.md)**, which lists the SQL files to run and in what
order, and explains how to create users and grant the first admin role.

### Docker

The included `Dockerfile` builds the app and serves `dist/` with nginx. The Supabase
variables are baked in at build time:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY \
  -t os-license-tracking .
docker run -p 8080:80 os-license-tracking
```

## Data model

```
periods (label 'YYYY-H1' | 'YYYY-H2', year, half)
   │ 1:N
period_projects (period_label, project_id, plan_price, actual_price)   ← AUTHORITATIVE PRICE
   │ N:1
projects (id, code, name, type, software, status,
          plan_price, actual_price, unit_price /* deprecated */,
          display_order, notes, exclusion_mark, period)
   │ 1:N
monthly_records (project_id, period_label, year, month, planned_hours, actual_hours)
          UNIQUE (project_id, period_label, year, month)

settings (label = 'default', exchange_rate, license_computers,
          license_per_computer, unit_price)          -- single row
user_roles (user_id, role)  +  RPC public.get_my_role()
catia_license_data (id = 'default', license_costs, license_revenues)
```

**The price lives on the junction, not on the project.** `period_projects.plan_price` /
`actual_price` are the authoritative hourly prices for a project *in a given period*, so
the same project can be billed differently in H1 and H2. `NULL` there means "inherit the
project's global price"; the project columns are the fallback and `projects.unit_price` is
a deprecated last resort.

Revenue is therefore always **hours × price-of-that-(project, period)** — never a single
global price per project.

`periods.label` is the join key everywhere; `monthly_records` carries `period_label` on
every row so a record can always be priced against the correct period.

## Roles and access control

Row Level Security is enabled on every table:

- **SELECT** — any authenticated user.
- **INSERT / UPDATE / DELETE** — only when `public.get_my_role() = 'admin'`.

`get_my_role()` is a `security definer` SQL function reading `public.user_roles`. The
frontend calls it once after sign-in (`supabase.rpc('get_my_role')`) and stores the result
in `UserRoleContext`; non-admins get a read-only UI. The UI restriction is cosmetic — the
real enforcement is the RLS policies, so keep them intact.

Sign-up is disabled in the app: users are created manually in the Supabase dashboard.

## Project layout

```
App.tsx                 shell: routing, top bar, year selector, sidebar
components/             one file per view, plus modals/
contexts/               LanguageContext (ja/en/vn), UserRoleContext
services/               *Service.ts (extend BaseService) behind the dbService facade
lib/supabase.ts         the single Supabase client
stores/                 Zustand stores (CATIA licence data)
utils/                  export helpers, chart export, diagnostics
db/                     schema.sql, migrations, setup guide, data import
src/                    Clean-Architecture layer (domain / data / ioc / ui)
```

`src/` contains an in-progress Clean-Architecture skeleton (inversify container, use cases,
repositories). Only the shared presentational components in `src/ui/components/` are wired
into the live views today; the rest is not on the main code path.
