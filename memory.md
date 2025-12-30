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

7. **TotalView chart improvements** (Latest - 2025-12-30):
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

## Architecture Notes
- **Data Layer**: `dbService.ts` handles all Supabase operations with autosave (800ms debounce)
- **Period System**: Half-year periods (H1: Jan-Jun, H2: Jul-Dec) for organizing project tracking
- **Financial Calculations**: Gross/net revenue, profit margins, CAD license cost per hour, break-even analysis
- **UI Patterns**: Sticky table columns, responsive design, real-time search filtering, optimistic UI updates

## Notes / Next Ideas
- Language preference persistence: Consider saving selected language to localStorage or user settings
- Year/period preference: Could persist last selected year/period across sessions
- Performance optimization: Monitor autosave performance with large datasets
- Chart enhancements: Consider adding more financial metrics or customizable date ranges
