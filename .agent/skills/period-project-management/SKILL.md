---
name: period-project-management
description: Business domain knowledge for the period-based project tracking system. Covers period lifecycle (H1/H2), project CRUD, time tracking, pricing, and billing calculation logic.
---

# Period & Project Management Domain

## Business Context

This application tracks **outsourcing projects** (primarily CAD/engineering work) organized by **half-year periods**. It manages:
- Project definitions (code, name, type, software)
- Time tracking (planned vs. actual hours per month)
- Revenue calculation (hours × unit price)
- CATIA license cost tracking
- Multi-year trend analysis

## Period System

### Period Format
- Pattern: `YYYY-HN` (e.g., `2025-H1`, `2025-H2`)
- `H1` = January–June
- `H2` = July–December

### Year-Based Navigation
The UI navigates by **year** (not period). Views show full-year data combining H1+H2.

```typescript
// Constants
const MONTHS_H1 = [1, 2, 3, 4, 5, 6];
const MONTHS_H2 = [7, 8, 9, 10, 11, 12];
```

### Period Lifecycle

```
Create Period → Assign Projects → Track Hours → Review/Export
                     ↓
            Copy from Previous Period
            (carry over active projects)
```

## Project Entity

### Core Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `code` | string | Project code (auto-generated, e.g., "OS-001") |
| `name` | string | Project name |
| `type` | string | Category: Mechanical Design, Electrical Design, Software Development, Translation, Other |
| `software` | string | Tool used: AutoCAD, SolidWorks, CATIA, NX, Excel, Other |
| `status` | enum | `active`, `completed`, `pending`, `archived` |
| `plan_price` | number | Planned unit price (JPY/hour) |
| `actual_price` | number | Actual unit price (JPY/hour) |
| `exclusion_mark` | string | Mark for excluding from totals (×, ○, -) |
| `display_order` | number | Sort order in tables |
| `notes` | string | Supplementary notes (補足) |

### Default Unit Price
```typescript
const DEFAULT_UNIT_PRICE = 2300; // JPY per hour
```

## Monthly Records

Each project has monthly time entries:

| Field | Type | Description |
|---|---|---|
| `project_id` | UUID | FK to projects |
| `period_label` | string | e.g., "2025-H1" |
| `year` | number | Year |
| `month` | number | 1-12 |
| `planned_hours` | number | Planned work hours |
| `actual_hours` | number | Actual work hours |

### Revenue Calculation

```
Planned Revenue = planned_hours × plan_price
Actual Revenue  = actual_hours × actual_price
Achievement %   = (Actual Revenue / Planned Revenue) × 100
```

## Service Layer (Legacy)

The facade `dbService` exposes all operations:

### Project Operations
- `getProjects()` — Fetch projects for current period
- `createProject(data)` — Create new project
- `updateProject(id, data)` — Update project fields
- `deleteProject(id)` / `deleteProjects(ids)` — Remove projects
- `moveProjectUp/Down(id)` — Reorder projects
- `updateProjectDisplayOrders(orders)` — Batch reorder (DnD)

### Record Operations
- `getRecords(period)` — Fetch monthly records for a period
- `getAllRecords()` — Fetch all records
- `upsertRecord(record)` — Insert or update a monthly record

### Period Operations
- `getPeriods()` — List all period labels
- `addPeriod(label)` — Create new period
- `copyProjectsToPeriod(from, to, projectIds)` — Carry over projects
- `createPeriodWithProjects(label, projects)` — Create period + projects atomically

### Dashboard Operations
- `getDashboardStats(year)` — KPI metrics
- `getYearlyAggregatedData()` — Multi-year trends
- `getMonthlyAggregatedData(year)` — Monthly breakdowns
- `getSettings() / saveSettings()` — System settings (exchange rate, license costs)

## CATIA License Tracking

Managed in `CatiaLicenseView` and `useCatiaStore`:
- License cost per computer
- Number of licensed computers
- Monthly cost calculations
- Yearly cost summaries

### Settings (from `settings` table)

| Setting | Description |
|---|---|
| `exchange_rate` | JPY exchange rate |
| `license_computers` | Number of CATIA workstations |
| `license_per_computer` | License cost per computer |
| `unit_price` | Default global unit price |

## Important Business Rules

1. **Exclusion Mark**: Projects with exclusion marks (×) are excluded from revenue totals
2. **Carry Over**: When creating a new period, active projects can be copied from the previous period
3. **Dual Pricing**: Projects have both `plan_price` and `actual_price` (legacy `unit_price` is deprecated)
4. **Display Order**: Projects are sorted by `display_order`, modifiable via drag-and-drop
5. **Auto-Generated Codes**: New project codes follow `OS-XXX` pattern, auto-incremented
