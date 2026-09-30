# CLAUDE.md: OS License Tracking

Handoff notes for Claude Code sessions. For the product itself (routes, data model, roles, setup) read `README.md`; for the UI's design principles read `docs/redesign-brief.md`. This file covers how to work here safely, how to test, what has been done and what is still open.

The mock harness files and `harness-tests/` are **not in the repo**. They exist only on the main dev machine (`C:\Tool\code\OS-License-Tracking`), listed in `.git/info/exclude`; never run `git clean -x` there, because it would delete them. On any other machine, ask the user for them or rebuild them from the description below before running browser tests.

## Working with the user

- Reply in Vietnamese: concise, with short progress lines.
- Raise any problem with them as soon as it comes up.
- Workflow so far:
  1. Branch from `main` and open a PR.
  2. Run QA with agents, on the harness only.
  3. Merge with `gh pr merge <n> --rebase`, then `git fetch origin main:main`.

  For a new PR, confirm with the user before merging unless they have already said to merge it.
- Commit style: `fix(scope): <outcome in plain words>`, then a body that explains the cause. End with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. PR bodies have a Summary and a Test plan, and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Safety rules

- **`npm run dev` (http://localhost:3000) uses the production Supabase** from `.env.local`. Never drive it from tests or agents; use the harness below.
- Never commit `.env.local` and never hardcode keys.
- Keep RLS and admin gating: only admins can write, and `/diagnostic` is admin-only.
- Keep the colour scheme described in `docs/redesign-brief.md`.

## Commands

- `npm run verify` runs, in order: typecheck, lint, `check:locales` (ja/en/vn must hold the same keys), and build. The build's warning about a chunk over 500 kB was there before this work.
- **Mock harness:** `npx vite --config vite.harness.config.ts`, then open `http://127.0.0.1:4190/chart-harness.html?lang=en&theme=light#/monthly-plan-actual`.
  - It runs the real app on fixture data.
    - `harness-db.ts`: planned and actual hours, with actuals for Jan–Aug and none for Sep–Dec.
    - `harness-supabase.ts`: 5 projects, periods 2024-H1 to 2026-H2, signed in as admin.
  - Query switches:

    | Switch | Effect |
    |---|---|
    | `lang=ja\|en\|vn` | UI language |
    | `theme=light\|dark\|system` | Colour theme |
    | `session=0` | Start signed out (password `harness`) |
    | `role=user` | Sign in as a viewer |
    | `diag=empty` | Empty database |
    | `catiaFail=1` | CATIA saves fail |
    | `fail=N` | The first N loads fail |
    | `delay=ms` | Loads are delayed by this long |
    | `empty=1` | No records |
    | `report=missing` | The `business_reports` table does not exist (PGRST205) |
    | `reportFail=1` | Report saves fail; `reportFail=load` makes loading saved reports fail |
    | `orphan=1` | Projects p6 and p7 have hours but no period link |

  - The harness seeds a saved `2026-08` report, so `/report` for September shows the carry-over. `getDashboardStats` spreads each month's hours unevenly over p1–p5, with the same monthly totals, so the report has several customers. `window.harnessCalls`, `harnessRequests` and `harnessTables` expose what the page asked for.

  - Files, all in the repo root:
    - `chart-harness.html`: a copy of `index.html` that loads `chart-harness.tsx`.
    - `chart-harness.tsx`: stores `lang` and `theme` from the query in localStorage, then imports `./index`.
    - `vite.harness.config.ts`: the app's Vite config plus aliases that replace `services/dbService` with `harness-db.ts` and `lib/supabase` with `harness-supabase.ts`. It serves on port 4190 and keeps its own cache in `node_modules/.vite-harness`.
    - `harness-db.ts` and `harness-supabase.ts`: in-memory stand-ins.
    - `vite.harness-bundle.config.ts`: the bundled harness below.
  - **When the disk is saturated** (page loads take 20 s or more in dev mode), serve a bundled harness instead:
    1. `npx vite build --config vite.harness-bundle.config.ts`. It builds `chart-harness.html` into `node_modules/.harness-dist`, so `dist` keeps the real build.
    2. `npx vite preview --config vite.harness-bundle.config.ts` serves it on port 4190.

    Pages then load in about 3 s. A bundle does not pick up code changes: build again after each edit. If the config is missing, it is the harness config merged with those two settings.

## Browser test kit (`harness-tests/`)

Like the harness, this kit is not in the repo (see the top of this file). The kit drives headless Chrome over CDP directly, without Playwright. It uses the Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Each browser gets a temporary profile at `%TEMP%\cdp-*`. A run that is killed leaves its profile behind, so delete leftovers afterwards.

- `./run-all.sh > results.txt 2>&1` runs the whole regression suite, one test at a time: about 15 minutes, or much longer on a slow disk.
- `cdp.mjs` is the driver. `launch({width,height,mobile})` returns a page with these methods:
  - `goto(query, waitMs)`: with `waitMs` ≥ 2000 it also waits until the page has settled.
  - `eval`, `click`, `send`, `shot`, `close`.
  - `logs`: console errors and warnings.
- `font/` reproduces the run-together-words bug and checks for it:
  - `cdp7.mjs` and `lib7.mjs` provide the `exportCard` helper; set `DLT=240` to allow slow downloads.
  - `spc.mjs` exports the same card as PNG repeatedly.
  - `spcw.py` finds images whose words ran together. It groups images by where three lines of text end; a clean Inter export of the long-term card at 390 px ends at (612, 696, 1082).
  - `slowfont.mjs` delays Inter's files by `DELAY` ms (default 1500) and waits `SETTLE` ms before exporting. `VARIANT=old` removes the fix, in dev mode only. `DELAY=6000 SETTLE=9000` exercises the fallback font.
- `perf/` holds one-off probes:
  - `ptime.mjs`: PNG export time per theme.
  - `pprof.mjs`: a CPU profile of one export, summed by script and function.
  - `pgeo.mjs`: Monthly's column geometry.
  - `pshot.mjs`: a screenshot of Monthly with stored colours (`PREFS` holds the JSON).
- `qa/` holds the QA agent's checks for PR #5. They use their own `lib.mjs`, and write their output to `qa/out/`.
  - `q-crafted.mjs`: Monthly with crafted data. The bundled harness's monthly fixture is patched in the test browser only, so it needs the bundled harness. `SETS=lvl4,lvl5 WS=390` runs the level-months case.
  - `q-colors.mjs`: Monthly with stored series styles.
  - `q-exp.mjs`: exports in ja and vn.
  - `q-slowfont.mjs`: `slowfont` for other languages and cards.
- `t-report.mjs` covers `/report`:
  - Figures against the Dashboard, carry-over, editing and saving, guards, roles, a missing table and failed saves.
  - Layout at 360–1440 in every language and theme.
  - `ONLY_FIXES=1` runs only the checks added for the QA fixes. `SKIP_MATRIX=1` skips the language, theme and width screenshots.
  - Screenshots go to `report-shots/`.
- `report-pptx/` builds decks from fixture reports without the app, and checks them in the real PowerPoint:
  - `fixtures.ts` holds six fixtures:
    - `sample`: the sample deck's text;
    - `empty`;
    - `stress`: long text and many rows;
    - `partial`;
    - `controls`: control characters in every field;
    - `harness`: the harness data.
  - `build.ts` bundles `utils/reportPptx.ts` with esbuild and writes the decks.
  - `render.ps1` opens each deck in PowerPoint over COM and exports PNGs. It flags text that overflows its box or that PowerPoint had to shrink.
  - `run.sh [names]` runs all three steps.
  - Output goes to `out/<name>/`, with a contact sheet per deck in `out/<name>_sheet.png`.
- `qa-report/` holds the QA agent's checks for the report, with output in `qa-report/out/`.

Expected results at PR #6. The counts assume the clock is in September 2026:
- From 1 October, September counts as a finished month. Monthly then gets one more figure: `t-overlap` 41, `t-growin` 49.
- `t-report` fails 4 checks that assume September.
- `qa-report/t-report-sep.mjs`, `t-overlap-sep.mjs` and `t-growin-sep.mjs` pin the clock to 2026-09-30 and still give the figures below.

| Test | Expected |
|---|---|
| `t-overlap` | Monthly 40 labels, Total 24; 0 overlaps at 390/1024/1440 |
| `t-plates` | 0 figures covered, light and dark |
| `t-halo` | 0 covered at 390/1024/1440, light and dark, counting the 1.5 px a halo reaches past its figure |
| `t-contrast` | Defaults unchanged (contrast 2.5–7, indigo halo in both themes). A pale figure on a pale bar and a dark figure in dark mode go on a contrasting plate (about 15–18) |
| `t-svg` | 14–56 KB each, `oklch: false`. Label texts: Monthly 48, Total 36, Long-term 20, Dashboard cumulative 2 |
| `t-growin` | `exported` 48 (Monthly) and 20 (Long-term) even when clicked mid-animation; year change ends at 60 |
| `t-dashgrow` | Cumulative: `exported: 2, curves: 2` (the monthly chart shows bar figures only from 1920 px) |
| `t-zorder` | Label order unchanged after toggling capacity figures |
| `t-back`, `guard`, `t-note` | Unsaved-changes dialog appears; Stay and Leave both work; the note is saved; no console logs |
| `t-tableexp` | `yearly-data-table` 1492×551, `catia-license-table` 3176×820 |
| `t-pngexport` | Every card exports; charts that scroll sideways export at full width |
| `perf/ptime` | About 2–4 s per PNG export at 1440, light and dark alike, on a loaded machine |
| `font/slowfont` | `DELAY=1500`: Inter, no warning. `DELAY=6000`: system font, words spaced, one warning |
| `qa/q-crafted` | 0 covered at 1440 and for `d4`, `d5` and `lvl3`. At 390, `lvl4` covers 0.3–0.8 px each side and `lvl5` 1.2–3.6 px (see Known limitations) |
| `t-report` | 114 passed, 0 failed. For 2026 the report equals the Dashboard: 10,120 h, ¥32,384,000, plans 17,400 h and ¥52,200,000 |
| `report-pptx/run.sh` | Six decks, each 5 slides; every one opens in PowerPoint, with 0 overflows, 0 shrunk boxes, and `validate.py` passing |

## Where the chart and export code lives

- `utils/chartExport.ts`: every image export.
  - html2canvas capture: `captureElement` and `capturePass`, with an async `onclone`.
  - SVG export: `exportChartToSVG`, which inlines only the styles listed in `SVG_STYLES`.
  - Clipboard copy and CSV export.
- `utils/exportPrefs.ts`: export on a light background, on by default. `withExportTheme` swaps the palette under a veil, then waits a paint.
- `components/ExportButton.tsx`: the export menu. Its `onBeforeCapture` callback lets a chart settle its animation before capture.
- `hooks/useGrowIn.ts`: series animate only when their data changes, and `settle()` stops them.
- `utils/chartTheme.ts`: halo and plate colours for each theme.
- `components/MonthlyPlanActualView.tsx`:
  - `labelBacking` decides between plate and halo, and their colour: whatever stands apart from the figure (a contrast of at least 2).
  - `ValueLabel` draws a figure.
  - `SalesPlanLabel` lifts the plan figure above the actual's.
  - `HoursPlanLabel` moves the planned hours left, clear of the sales figure's halo but not under the previous month's. Where both stand level and there is no room between them, it sits halfway.
  - `LABEL_Z` fixes the stacking order of labels.
- `components/TotalView.tsx`: the Cumulative hours chart. `OutlinedLabel` does the lifting.
- `utils/textWidth.ts`: measures a figure's width on a canvas, for both charts.
- `components/Dashboard.tsx`: `lastRealMonth` counts the current month only once it has actual revenue.
- The business report, `/report`. The spec and its decisions are in `docs/business-report.md`.
  - `utils/reportModel.ts`: the types shared by the page and the deck, plus `sanitizeReportText`.
  - `utils/reportFigures.ts`: the figures, built with the Dashboard's `priceRecord` (`services/pricing.ts`) and `monthlyBuckets`, so the two cannot disagree.
  - `services/ReportService.ts`: the `business_reports` table.
    - It treats PostgREST `42P01` and `PGRST205` as "table missing", not as errors.
    - `normalizeReportContent` repairs partial JSON, strips control characters and caps actions at three.
  - `hooks/useBusinessReport.ts`: loads the figures and content. It reads periods once, caches the past years, and has a race guard.
  - `components/BusinessReportView.tsx` and `components/report/*`: the page and its editor.
  - `utils/reportPptx.ts`: the PowerPoint deck. Always load it with `import()`; pptxgenjs and jszip make a 412 kB chunk.
  - `db/migration_business_reports.sql`: the table, its RLS and its stamp trigger.
- `utils/logger.ts`: create loggers with `createLogger(scope)`. `debug` and `info` log only in development; `warn` and `error` always log.

## Hard-won knowledge

**Recharts 3.5**
- Any re-render with new series props restarts the grow-in, and `LabelList` hides its labels while that runs. Exports taken during it came out with no figures. The fix is `useGrowIn` with `isAnimationActive`, plus `settle()` before a capture.
- `LabelList` passes `offset = 5` to custom content.
- With an explicit domain, `useYAxisDomain` returns that exact domain; it is not rounded ("niced").
- Labels render into a z-index portal layer (`DefaultZIndexes.label` = 2000), in mount order unless they are given a `zIndex`.
- Bars without a fixed `barSize` share a month equally:
  - Each share is `floor((band × 0.8 − 4 × (bars − 1)) / bars)` wide, where `band = plot width / months`, 10 % stays clear at each side, and bars are 4 px apart.
  - Each bar is centred in its share, and `maxBarSize` only narrows the bar.
  - `HoursPlanLabel` relies on this; if the chart ever sets `barGap` or `barCategoryGap`, update its constants.

**html2canvas 1.4.1**
- Tailwind's preflight rule `img{display:block}` breaks its baseline measurement, so text sat low. `withInlineMeasuringImage` fixes this for the length of a capture.
- It cannot parse `oklch()` or `color-mix()`, so `resolveOklchColors` rewrites the stylesheets inside the clone.
  - Each colour is converted by painting it on a canvas. `createColorResolver` keeps one canvas per capture and converts each distinct colour once. A canvas per colour made one export spend 20 s converting and 13 s in garbage collection.
  - That step also swaps the Google Fonts `<link>` for a `<style>`, which makes the clone load Inter again. `loadCloneFonts` waits up to 3 s for it. If Inter is still missing then, it takes Inter out of the clone's font stacks (`dropWebFonts`) and logs a warning. The image then comes out in the system font with words spaced right.
  - The canvas draws with the page's fonts, but the words are laid out in the clone. Words laid out in the fallback font and drawn in Inter ran together ("Salesplan"), so both sides must use the same font.
- The canvas has no tabular figures and handles letter-spacing badly; `settleTextForCanvas` adjusts the clone for both.

**pptxgenjs 4.0.1 and PowerPoint**
- pptxgenjs writes one paragraph-settings element per run where the format allows one per paragraph. `utils/reportPptx.ts` unzips its output with jszip and keeps the first.
- pptxgenjs escapes only `& < > " '`. A control character, such as U+000B from a Shift+Enter pasted out of Word or PowerPoint, makes the slide XML invalid, and PowerPoint then refuses the file. Every string goes through `sanitize()` in the deck and `sanitizeReportText` in the page.
- Meiryo UI, the template's font, has no Vietnamese letters (ơ, ư, ạ). Vietnamese runs use Segoe UI, and the deck splits text into runs by script.
- PowerPoint does not refit text when it opens a file. The deck therefore sizes text itself, from font width tables, and cuts it with "…" as a last resort.
- To look at a deck, open it through COM (`New-Object -ComObject PowerPoint.Application`) and call `Slide.Export(png, 'PNG', 1920, 1080)`. Put `Close()` and `Quit()` in `finally`, or POWERPNT.EXE stays running.

**Windows and Git Bash**
- Set `MSYS_NO_PATHCONV=1` when passing `/routes` through environment variables.
- An empty `.git/index.lock` was left behind several times by git processes that were killed. If no `git.exe` is running, delete it.
- Worktrees: unlink the `node_modules` junction before `git worktree remove` (see memory).
- Other Claude sessions on this machine run heavy jobs. If Vite takes 30 s or more to start, the disk is saturated; the app is not at fault.

## State (2026-09-30)

- PRs:
  - #1 Redesign, every screen, for desktop, tablet and phone.
  - #2 Polish: chart labels, export baseline and file size, the current month.
  - #3 A console warning when the web font takes longer than the wait.
  - #4 This file.
  - #5 The four limitations left after #3: slow image exports, a late font running words together, figures lost on a plate or halo of their own lightness, and the sales figure's halo nicking the planned hours.
  - #6 The business report page `/report` and its PowerPoint deck in the team's template.
- **`db/migration_business_reports.sql` has to be run by hand** in the production Supabase SQL editor. Until then `/report` shows its figures, but nothing written can be saved. Admins see a note that says so.
- The sample deck `OS設計チーム_事業状況報告_2026年9月28日.pptx` in the repo root is the template. It is untracked, and `*.pptx` is ignored. Its last slide holds a login, so never commit it, copy it or quote it.
- The branches merged through #1–#5 are deleted. The older branches (`chore/cleanup`, `feat/ux-pass`, `feature/redesign`, `fix/export-input-and-race-bugs`, `fix/ux-and-architecture-repair`) predate this work; ask before touching them.

## Known limitations and possible next steps

- If the web font is more than 3 s late or fails to load, the image comes out in the system font instead of Inter. The spacing is right, and a console warning says why.
- With crafted data, a figure's corner can sit under the hours-actual plate, and the sales plan can overlap hours actual. Both were there before this work and are better than they were.
- At Monthly's 900 px minimum, several months in a row can have sales figures level with the planned hours. The planned hours then have no room between this month's sales figure and last month's, so they sit halfway.
  - With sales in the thousands, each side covers under 1 px; before, one side covered 5–6 px.
  - With sales in the tens of thousands, each side covers up to 3.6 px.
  - Clearing both would mean moving the figure up or down its column. A version of that was tried in `75fc275` (branch deleted; the commit is still reachable by hash) and left out as too involved.
- The contrast check covers `ValueLabel` on Monthly only.
  - Cumulative hours' outlined figures and Monthly's "0" plate still use the theme's colours whatever the figure's colour. In dark mode, a dark figure there would disappear.
  - The axis titles take the bar's colour, so a pale bar gives a pale title.
- The report deck does not recreate the template's picture slides (screenshots of the work, the Dashboard). They are added in PowerPoint.
- The report counts every project as a customer. In the sample deck, "GLW/FALTEC" was one line and six customers were counted; the page shows whatever the projects are called.
- The report's written text is sized to fit in the deck. Very long text gets small, then cut with "…"; the editor only warns in general terms.
- Text boxes grow with their text through `field-sizing: content`, which only Chromium supports. Other browsers fall back to a row count.
- Carrying a December report into January keeps last year's staffing changes under the new year's heading until someone edits them.
