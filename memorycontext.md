# Combined Project Memory Bank

## Project Overview
Bilingual (JP/VN/EN) dashboard for tracking OS department projects, hours, and revenue.

- **Tech Stack:** Vite + React 19 + TypeScript SPA, Tailwind CSS, Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Email/Password). Sign-up is disabled; users must be created manually in Supabase Auth dashboard.
- **Fully integrated with Supabase** for authentication and data persistence (projects, monthly_records, periods, settings)
- Three primary views:
  - **Dashboard** – Year-based KPIs, revenue charts, profit margins, license cost analysis
  - **TrackingView** – Period-based (H1/H2) editable grid with autosave for planned/actual hours
  - **TotalView** – Full-year overview with charts and read-only data table
- Tri-lingual support (Japanese default, English, Vietnamese) with complete UI localization
- XLSX export functionality for project data and records

## Database Schema
- **Periods Table**:
  - Columns: `label` (PK, text), `year` (int), `half` (text)
  - Note: The column for semiannual designation is `half`, not `type`
- **Projects Table**:
  - Uses `period` (text) column to link to `periods.label`. Does NOT have a `year` column
  - `unique(code, period)` is effectively the constraint used by logic (though not strictly enforced by DB constraint yet, handled by app logic)
- **Monthly Records**: Linked to projects, stores monthly planned/actual hours and revenue data
- **Settings**: User preferences and configuration

## Recent Work

### 1. Environment Setup
- Installed dependencies and confirmed `npm run dev`/`npm run build` work (Vite 6.4)

### 2. Supabase Migration
- Migrated from localStorage to Supabase with full CRUD operations for projects, monthly_records, periods, and settings tables

### 3. Dashboard Data Fix
- `dbService.getRecordYears()` enumerates stored years
- Dashboard now picks available years, shows a selector, and has an empty state

### 4. Language System
- Added `LanguageProvider` context and UI toggle (default Japanese)
- Nav/sidebar/modals/search/export labels switch between JA/EN/VN

### 5. Full Localization
- Extended translations to cover dashboard KPIs/charts and the entire Tracking table
- Headers, month captions, totals, empty state
- Project-type dropdown and alert strings

### 6. Project Deletion Controls
- Tracking view now has row checkboxes, select-all/clear, single-row trash, and bulk "Delete Selected"
- Deleting also removes associated records in `dbService`

### 7. TotalView Chart Improvements
- **Unified Y-axis scale**: Both left (Monthly Hours) and right (Accumulated) axes now use the same maximum value
- **Complete localization**: Removed all hardcoded English strings
- **New translation keys**: nav.totalView, totalView.chartTitle, totalView.axis.*, totalView.tableHeader.*

### 8. Major Feature Additions and Code Optimization (2025-12-30)
- **Chart Export to PNG**:
  - Created `utils/chartExport.ts` with SVG-to-Canvas-to-PNG conversion
  - Export with transparent backgrounds for all charts
  - Download buttons added to TotalView yearly overview, Dashboard monthly revenue, and Dashboard cumulative revenue charts
  - Filenames include timestamps for organization

- **Table Export to CSV**:
  - Created `utils/csvExport.ts` with UTF-8 BOM encoding for Excel compatibility
  - Properly handles Japanese characters in exported files
  - CSV export button added to TotalView yearly data table
  - Includes all table data: code, name, type, monthly hours, totals, and revenue

- **Revenue Column in TotalView**:
  - Added 売上金額(円) / Revenue (JPY) / Doanh thu (JPY) column as the last column
  - Auto-calculates: `revenue = unit_price × hours` for both Plan and Actual rows
  - Proper formatting with `formatCurrency()` helper
  - Included in CSV exports with revenue data

- **Chart Internationalization**:
  - Month labels now display in correct language (Japanese: 1月, 2月; English: Jan, Feb; Vietnamese: Th1, Th2)
  - Y-axis major units standardized to 1500 intervals across all charts
  - Locale-aware date formatting using `toLocaleString()`

- **Code Quality Improvements**:
  - Created `utils/tableStyles.ts` with shared constants (eliminated 100+ lines of duplication)
  - Added proper TypeScript types: `MonthlyStats`, `AccumulatedStats`, `DashboardRecord`, `PeriodLabel`, `SupportedLanguage`
  - Removed all `any` types for 100% type safety
  - Fixed memory leaks in debounce timer cleanup (TrackingView)
  - Removed `window.location.reload()` after project creation for better UX
  - Fixed error handling to use proper `Error` type instead of `any`

- **New Translation Keys**:
  - `buttons.exportChart` – Chart export button label
  - `buttons.exportTable` – Table export button label
  - `totalView.tableHeader.title` – Table header title
  - `totalView.tableHeader.revenue` – Revenue column header

### 9. Chart Optimization and SVG Export System (2025-12-30)
- **Chart Display Improvements**:
  - Increased chart height from 384px to 600px for square-like, more readable shape
  - Fixed Y-axis to 0-21,000 range with 1,000 unit intervals (21 tick marks)
  - Better vertical spacing and data visualization

- **SVG Export as Primary Format** (Replacing problematic PNG export):
  - **Why SVG over PNG**: PNG export had dimension detection issues (14x14px bug), canvas rendering problems, and file bloat
  - Created `exportChartToSVG()` function - simple, reliable, no canvas conversion
  - Vector format with perfect quality at any size
  - Transparent background by default
  - ~50-80KB file size vs ~200-300KB for PNG
  - Works in browsers, PowerPoint, Figma, Illustrator, etc.
  - Can be edited in design tools

- **Multiple Export Options** (`utils/chartExport.ts`):
  - **Primary: SVG Export** - Green button, vector format, best quality
  - **Chart Data CSV Export** - Blue "Data" button, exports raw chart data for analysis
  - **PNG Export** - Available as fallback, uses SVG→Canvas→PNG conversion at 3x scale
  - All exports include proper filename timestamps

- **Implementation Details**:
  - `inlineAllStyles()` - Recursively copies all computed CSS styles to inline styles for standalone SVG rendering
  - `downloadFile()` - Unified download function for all export types
  - Uses container dimensions instead of SVG's getBoundingClientRect() to avoid size detection issues
  - Proper XML declaration for SVG files: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`
  - SVG attributes set: xmlns, xmlns:xlink, width, height, viewBox

- **UI Updates**:
  - TotalView: SVG (green) + Data CSV (blue) export buttons
  - Dashboard: SVG export buttons on both charts (Monthly Revenue, Cumulative Revenue)
  - Color coding: Green for SVG, Blue for Data/CSV, Emerald for table CSV
  - Tooltips with format descriptions

### 10. View Refactoring (2025-12-30)
- **Charts View**: Renamed from 'Yearly View' (TotalView). Now exclusively for charts.
- **Annual Data View**: Created new YearlyDataView for the data table.
- **Navigation**: Updated menu to include both views (/total and /yearly-data).

### 11. Table Features (2025-12-30)
- **Auto-Sorting**: Both Tracking and Annual Data tables automatically sort by Project Code.
- **Layout Changes**:
  - 'Project Name' renamed to 'Company Name' (会社名)
  - New 'Business Content' (業務内容) column replaces 'Type'. It is editable and positioned after Unit Price.
- **Localization**:
  - Full header support for Japanese, English, Vietnamese
  - Added '月' suffix to months in Japanese view

### 12. Data Logic (2025-12-30)
- **Period Scoping**: Projects are now isolated by Period. Creating a new Period starts with a blank project list.
  - **Problem**: Previously, projects were assumed to have a globally unique `code`. This prevented the same project code (e.g., '1') from existing independently in different years/periods.
  - **Solution**: Refined import logic to scope projects by **Period**.
    - Projects are now identified by `code` AND `period` (e.g., `period='2026-H1'`)
    - Import scripts now handle data in blocks (e.g., one block for H1, one for H2) to ensure correct scoping

- **Auto-Code Generation**: Project Codes (PRJ-XXX) are automatically generated globally (incrementing max ID) when creating a new project.
- **Yearly Filtering**: Annual view only shows projects relevant to that year.

## Architecture Notes
- **Data Layer**: `services/dbService.ts` handles all Supabase operations with autosave (800ms debounce)
- **Period System**: Half-year periods (H1: Jan-Jun, H2: Jul-Dec) for organizing project tracking
- **Financial Calculations**: Gross/net revenue, profit margins, CAD license cost per hour, break-even analysis
- **UI Patterns**: Sticky table columns, responsive design, real-time search filtering, optimistic UI updates
- **Utility Modules**:
  - `utils/tableStyles.ts` – Shared table column widths and sticky positioning classes
  - `utils/chartExport.ts` – Multiple chart export formats (SVG primary, PNG fallback, CSV data)
  - `utils/csvExport.ts` – Table CSV generation with UTF-8 BOM encoding for Excel compatibility
  - `utils/helpers.ts` – Currency formatting and general utilities
- **Type Safety**: Comprehensive TypeScript interfaces in `types.ts` for all data structures
- **Internationalization**: Complete tri-lingual support via `LanguageContext` with locale-aware formatting

## File Structure
```
├── components/
│   ├── Dashboard.tsx          # Financial analytics and KPIs
│   ├── TrackingView.tsx       # Editable data entry grid (period-scoped)
│   ├── TotalView.tsx          # Yearly overview with charts
│   ├── YearlyDataView.tsx     # Annual data table view
│   ├── Auth.tsx               # Supabase authentication
│   └── ...
├── contexts/
│   └── LanguageContext.tsx    # i18n provider (ja/en/vn)
├── services/
│   └── dbService.ts           # Supabase CRUD operations
├── utils/
│   ├── tableStyles.ts         # Shared table constants
│   ├── chartExport.ts         # Chart export (SVG, PNG, CSV data)
│   ├── csvExport.ts           # Table CSV export
│   └── helpers.ts             # Formatting utilities
├── types.ts                   # TypeScript interfaces
├── App.tsx                    # Root component
└── db/
    └── import_2025_data.sql   # Data import script
```

## Key Components
- **TrackingView**: Displays projects filtered by selected period
- **YearlyDataView & TotalView**: Aggregates data based on the `year` stored in `monthly_records` (for TotalView) or derived

## Data Import
- Import 2025 data using SQL script: `db/import_2025_data.sql`
- Run in Supabase SQL Editor to populate 16 projects and monthly records
- Periods table includes 2024-H2, 2025-H1, 2025-H2

### 13. Database Migration and Data Import (2025-12-31)
- **Period Scoping Migration Completed**:
  - Created `db/migration_period_scoping.sql` - Idempotent migration script
  - Added `period` column to projects table (NOT NULL, text)
  - Dropped old unique constraint on `code` alone
  - Added unique constraint on `(code, period)` combination
  - Added foreign key: `period` → `periods(label)` with ON DELETE RESTRICT
  - Created performance index: `idx_projects_period`
  - Added 2026-H1 and 2026-H2 periods
  - Migrated existing projects to default period (2025-H1)
  - **Result**: Period scoping fully enabled in database

- **Real Data Import (2024-2025)**:
  - Created `db/import_2024_2025_data.sql` from CSV data (`data/29251230_data.csv`)
  - Imported 48 projects across 3 periods:
    - **2024-H2** (Aug-Dec): 16 projects, 20 records, 1,200 planned hrs, 336 actual hrs
    - **2025-H1** (Jan-Jun): 16 projects, 96 records, 5,255 planned hrs, 1,434 actual hrs
    - **2025-H2** (Jul-Dec): 16 projects, 96 records, 6,295 planned hrs, 1,737 actual hrs
  - Projects include: ISJ (生産設備/自動車部品/金型), GLW (LM/FALTEC/河西テクノ), テクノハマ, GNN (multiple variants), 日泉化学, VUTEQ インドネシア, 啓装工業
  - Each project scoped by period with unique `(code, period)` identifier
  - All monthly records include both planned and actual hours from real tracking data

- **Database Documentation**:
  - Created `db/README.md` with comprehensive setup guide
  - Includes migration instructions for new and existing databases
  - Documents all import scripts and their purpose
  - Provides verification queries and troubleshooting guide
  - Rollback instructions included for safety

- **Git Commit and Push**:
  - Committed changes: App.tsx, TrackingView.tsx, LanguageContext.tsx, dbService.ts, import_2025_data.sql, memorycontext.md
  - Commit message: "feat: Add period scoping and import 2024-2025 data"
  - Pushed to GitHub: HKSilverlord/OS-License-Tracking (main branch)
  - Commit hash: 43641a9

- **Database State**:
  - **Total Projects**: 74 (16 each for 2024-H2, 2025-H1, 2025-H2 + 13 each for 2026-H1, 2026-H2)
  - **Total Periods**: 5 (2024-H2, 2025-H1, 2025-H2, 2026-H1, 2026-H2)
  - **Total Monthly Records**: 368 records
  - **Software Used**: CATIA, ICAD, NX CATIA, mixed
  - **Schema Version**: Fully migrated with period scoping

## Notes / Next Ideas
- Language preference persistence: Consider saving selected language to localStorage or user settings
- Year/period preference: Could persist last selected year/period across sessions
- Performance optimization: Monitor autosave performance with large datasets
- Print-friendly views: Add print CSS for direct printing (SVG exports work well for presentations)
- Dashboard enhancements: Add more customizable financial metrics or date range filters
- Mobile optimization: Further improve responsive design for tablet/mobile devices
- Chart interactions: Consider adding click/hover interactions for detailed data views
- **Consider version control for db scripts**: Currently in .gitignore, may want to track migration history

## Database Files (Local Only - Not in Git)
- `db/migration_period_scoping.sql` - Period scoping migration (idempotent)
- `db/import_2024_2025_data.sql` - Real 2024-2025 data from CSV
- `db/import_2025_data.sql` - 2026 sample/planning data
- `db/README.md` - Setup and troubleshooting guide
- Note: These files are ignored by .gitignore but available locally

---
*Last Updated: December 31, 2025*
