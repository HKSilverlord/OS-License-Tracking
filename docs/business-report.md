# Business status report (事業状況報告)

## Goal

The OS design team presents a monthly business status report as a PowerPoint deck. Until
now it was built by hand: figures read off the Dashboard and typed into slides, where
units and totals could drift from the app. The report page does two things:

- It shows every figure the deck needs, computed by the app.
- It keeps the written parts of the report: status notes, focus projects, people and
  actions.

From the page, the deck downloads in the team's template, ready to present.

## The template

The deck has a cover and four numbered sections. Each slide has:

- A light-blue header band, with the company logo on the left and the title on the right.
- A grey footer reading "OS Design Team", with the month and the page number.
- Headings in Japanese, each with a Vietnamese line underneath.

| Slide | Content | Source |
|---|---|---|
| Cover | Design hours to date, annual target and achievement %; actual revenue and annual plan; the one-line focus (重点); the report date | Figures; focus and date written |
| 1. 経営実績と案件状況 | Four cards: actual hours / annual target, achievement %, actual revenue / plan, customers with actuals. Annual progress bars for hours and revenue. Hours by customer with each customer's hourly rate. A highlighted customer story | Figures; the story is written |
| 2. 顧客別単価と現在の重点案件 | Each customer's hourly rate and status; other customers with results; focus projects (new customer, stage, parts count, numbered points); the policy line (方針) | Rates from figures; the rest written |
| 3. 人材育成と人員状況 | Training programme: title, points, trainees, seats and progress. Headcount: planned → current and the fill rate; staffing changes this year as a timeline; issues (課題) | Written; the fill rate is computed |
| 4. 今後の重点アクション | Three priority themes, each with points; the management priority | Written |

The deck's reference slides (screenshots of the work done, a Dashboard screenshot) are not
generated. They are pictures, and they are added in PowerPoint when needed. The one
figure the Dashboard slide carries, "this year against earlier years at the same point",
is on the report page and in section 1.

## Decisions

- **Projects are the customers.** "Hours by customer" lists projects, and "customers with
  actuals" counts projects with actual hours in the window.
- **One way to compute.** Hours and revenue use the Dashboard's pricing path:
  `getDashboardStats` plus `getYearProjectPrices`, with hours × the price of that
  project in that period. For the same year and month, the report and the Dashboard show
  the same totals.
- **Units are consistent.** Revenue shows in 万円 with one decimal, and the full yen amount
  sits beside it.
- **The report month.** Figures run from January to the report month inclusive. The
  default is the current month in the current year, and December for a past year. The
  annual target is the whole year's plan.
- **Saved per month.** Written content lives in `business_reports`, one row per month
  (`id = 'YYYY-MM'`, `content jsonb`). A month with no saved report starts from the latest
  earlier report, and says which month it was copied from. Nothing is written until an
  admin saves.
- **Access.** As on every other table, any signed-in user can read and only admins can write
  (`db/migration_business_reports.sql`). Viewers see the report read-only.
- **The table may be missing.** Until the migration is run, the page still shows every
  figure. Admins see what to run; viewers see only the figures.
- **Bilingual free text.** The first line of a text field is the main text, and any
  further lines are its translation, drawn smaller. The page says so beside the fields.
- **The export is PowerPoint** (`pptxgenjs`, loaded only when exporting). Its headings
  follow the template, in Japanese with Vietnamese underneath, whatever the interface
  language. Numbers use Japanese formatting.

## Done when

1. `/report` appears under Analytics in all three languages, with the same design rules as
   the other pages (`docs/redesign-brief.md`). It works at phone and desktop widths, in
   light and dark.
2. Every figure in the template's sections 1–4 and on its cover is on the page: computed
   where the data exists, written where it does not.
3. The report's hours and revenue totals equal the Dashboard's for the same year, and
   customer rates equal the period prices.
4. An admin can edit and save every written part. Viewers cannot edit. Unsaved edits prompt
   before leaving the page or changing the year. A failed save keeps the edits and says so.
5. The PowerPoint download opens in PowerPoint without repair. Its cover and four slides
   match the template's layout, colours and structure, and hold the page's figures and text.
6. `npm run verify` passes. The regression suite still matches `CLAUDE.md`'s expected results.
   Nothing is run against `localhost:3000`.
