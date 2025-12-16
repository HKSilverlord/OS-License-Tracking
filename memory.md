# Project Memory Bank

## App Snapshot
- Vite + React 19 + TypeScript SPA that mocks data persistence via `localStorage` (`services/dbService.ts`) with seed projects/periods and XLSX export support.
- Two primary views: Dashboard (analytics, KPIs, charts) and TrackingView (editable monthly plan/actual grid with sticky columns and totals); auth screen is a local demo gate only.
- Supabase client/config scaffolding exists but is not wired to live data yet; all records/settings are still local.

## Recent Work
1. **Environment setup** – Installed dependencies and confirmed `npm run dev`/`npm run build` work (Vite 6.4).
2. **Dashboard data fix** – `dbService.getRecordYears()` enumerates stored years; Dashboard now picks available years, shows a selector, and has an empty state.
3. **Language system** – Added `LanguageProvider` context and UI toggle (default Japanese) so nav/sidebar/modals/search/export labels switch between JA/EN.
4. **Full localization** – Extended translations to cover dashboard KPIs/charts and the entire Tracking table (headers, month captions, totals, empty state) plus project-type dropdown and alert strings.

5. **Project deletion controls** ƒ?" Tracking view now has row checkboxes, select-all/clear, single-row trash, and bulk “Delete Selected”; deleting also removes associated records in `dbService`.

## Notes / Next Ideas
- Supabase integration remains TODO; once live data exists, hook `dbService` to Supabase or replace it.
- Consider persisting the selected language/year across sessions if required (currently in-memory only).
