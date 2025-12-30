# Project Memory Bank

## App Snapshot
- Vite + React 19 + TypeScript SPA for engineering project time tracking and financial analytics
- **Fully integrated with Supabase** for authentication and data persistence (projects, monthly_records, periods, settings)
- Three primary views:
  - **Dashboard** – Year-based KPIs, revenue charts, profit margins, license cost analysis
  - **TrackingView** – Period-based (H1/H2) editable grid with autosave for planned/actual hours
  - **TotalView** – Full-year overview with charts and read-only data table
- Tri-lingual support (Japanese default, English, Vietnamese) with complete UI localization
- XLSX export functionality for project data and records

## Recent Work
1. **Environment setup** – Installed dependencies and confirmed `npm run dev`/`npm run build` work (Vite 6.4).

2. **Supabase migration** – Migrated from localStorage to Supabase with full CRUD operations for projects, monthly_records, periods, and settings tables.

3. **Dashboard data fix** – `dbService.getRecordYears()` enumerates stored years; Dashboard now picks available years, shows a selector, and has an empty state.

4. **Language system** – Added `LanguageProvider` context and UI toggle (default Japanese) so nav/sidebar/modals/search/export labels switch between JA/EN/VN.

5. **Full localization** – Extended translations to cover dashboard KPIs/charts and the entire Tracking table (headers, month captions, totals, empty state) plus project-type dropdown and alert strings.

6. **Project deletion controls** – Tracking view now has row checkboxes, select-all/clear, single-row trash, and bulk "Delete Selected"; deleting also removes associated records in `dbService`.

7. **TotalView chart improvements**:
   - **Unified Y-axis scale**: Both left (Monthly Hours) and right (Accumulated) axes now use the same maximum value for better chart readability
   - **Complete localization**: Removed all hardcoded English strings from TotalView component
   - **New translation keys added**:
     - `nav.totalView` – Navigation menu label
     - `totalView.chartTitle` – Chart title
     - `totalView.axis.monthlyHours` – Left Y-axis label
     - `totalView.axis.accumulated` – Right Y-axis label
     - `totalView.tableHeader.type` – Table header
     - `totalView.tableHeader.total` – Table header
   - All translations properly switch between Japanese, English, and Vietnamese without mixed languages

8. **Major feature additions and code optimization** (Latest - 2025-12-30):
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
     - All keys translated to Japanese, English, and Vietnamese

## Architecture Notes
- **Data Layer**: `dbService.ts` handles all Supabase operations with autosave (800ms debounce)
- **Period System**: Half-year periods (H1: Jan-Jun, H2: Jul-Dec) for organizing project tracking
- **Financial Calculations**: Gross/net revenue, profit margins, CAD license cost per hour, break-even analysis
- **UI Patterns**: Sticky table columns, responsive design, real-time search filtering, optimistic UI updates
- **Utility Modules**:
  - `utils/tableStyles.ts` – Shared table column widths and sticky positioning classes
  - `utils/chartExport.ts` – SVG to PNG export with transparent backgrounds
  - `utils/csvExport.ts` – CSV generation with UTF-8 BOM encoding for Excel compatibility
  - `utils/helpers.ts` – Currency formatting and general utilities
- **Type Safety**: Comprehensive TypeScript interfaces in `types.ts` for all data structures
- **Internationalization**: Complete tri-lingual support via `LanguageContext` with locale-aware formatting

## File Structure
```
├── components/
│   ├── Dashboard.tsx          # Financial analytics and KPIs
│   ├── TrackingView.tsx       # Editable data entry grid
│   ├── TotalView.tsx          # Yearly overview with charts
│   ├── Auth.tsx               # Supabase authentication
│   └── ...
├── contexts/
│   └── LanguageContext.tsx    # i18n provider (ja/en/vn)
├── services/
│   └── dbService.ts           # Supabase CRUD operations
├── utils/
│   ├── tableStyles.ts         # Shared table constants
│   ├── chartExport.ts         # PNG export functionality
│   ├── csvExport.ts           # CSV export functionality
│   └── helpers.ts             # Formatting utilities
├── types.ts                   # TypeScript interfaces
└── App.tsx                    # Root component
```

## Data Import
- Import 2025 data using SQL script: `db/import_2025_data.sql`
- Run in Supabase SQL Editor to populate 16 projects and monthly records
- Periods table includes 2024-H2, 2025-H1, 2025-H2

## Notes / Next Ideas
- Language preference persistence: Consider saving selected language to localStorage or user settings
- Year/period preference: Could persist last selected year/period across sessions
- Performance optimization: Monitor autosave performance with large datasets
- Additional export formats: Consider PDF export for reports
- Dashboard enhancements: Add more customizable financial metrics or date range filters
- Mobile optimization: Further improve responsive design for tablet/mobile devices
