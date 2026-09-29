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

  - Files, all in the repo root:
    - `chart-harness.html`: a copy of `index.html` that loads `chart-harness.tsx`.
    - `chart-harness.tsx`: stores `lang` and `theme` from the query in localStorage, then imports `./index`.
    - `vite.harness.config.ts`: the app's Vite config plus aliases that replace `services/dbService` with `harness-db.ts` and `lib/supabase` with `harness-supabase.ts`. It serves on port 4190 and keeps its own cache in `node_modules/.vite-harness`.
    - `harness-db.ts` and `harness-supabase.ts`: in-memory stand-ins.
  - **When the disk is saturated** (page loads take 20 s or more in dev mode), serve a bundled harness instead:
    1. Write a config that extends `vite.harness.config.ts` with `build.rollupOptions.input` set to `chart-harness.html` and an `outDir` outside the repo.
    2. Run `vite build`, then `vite preview` on port 4190.

    Pages then load in about 3 s.

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
  - `spcw.py` finds images whose words ran together.
  - `slowfont.mjs` delays Inter's files; `VARIANT=old` removes the fix.

Expected results at `80425b7`:

| Test | Expected |
|---|---|
| `t-overlap` | Monthly 40 labels, Total 24; 0 overlaps at 390/1024/1440 |
| `t-plates` | 0 figures covered, light and dark |
| `t-svg` | 14–56 KB each, `oklch: false`. Label texts: Monthly 48, Total 36, Long-term 20, Dashboard cumulative 2 |
| `t-growin` | `exported` 48 (Monthly) and 20 (Long-term) even when clicked mid-animation; year change ends at 60 |
| `t-dashgrow` | Cumulative: `exported: 2, curves: 2` (the monthly chart shows bar figures only from 1920 px) |
| `t-zorder` | Label order unchanged after toggling capacity figures |
| `t-back`, `guard`, `t-note` | Unsaved-changes dialog appears; Stay and Leave both work; the note is saved; no console logs |
| `t-tableexp` | `yearly-data-table` 1492×551, `catia-license-table` 3176×820 |
| `t-pngexport` | Every card exports; charts that scroll sideways export at full width |

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
  - `ValueLabel` decides between plate and halo.
  - `SalesPlanLabel` lifts the plan figure above the actual's.
  - `LABEL_Z` fixes the stacking order of labels.
- `components/TotalView.tsx`: the Cumulative hours chart. `OutlinedLabel` does the lifting; `figureWidth` measures text on a canvas.
- `components/Dashboard.tsx`: `lastRealMonth` counts the current month only once it has actual revenue.
- `utils/logger.ts`: create loggers with `createLogger(scope)`. `debug` and `info` log only in development; `warn` and `error` always log.

## Hard-won knowledge

**Recharts 3.5**
- Any re-render with new series props restarts the grow-in, and `LabelList` hides its labels while that runs. Exports taken during it came out with no figures. The fix is `useGrowIn` with `isAnimationActive`, plus `settle()` before a capture.
- `LabelList` passes `offset = 5` to custom content.
- With an explicit domain, `useYAxisDomain` returns that exact domain; it is not rounded ("niced").
- Labels render into a z-index portal layer (`DefaultZIndexes.label` = 2000), in mount order unless they are given a `zIndex`.

**html2canvas 1.4.1**
- Tailwind's preflight rule `img{display:block}` breaks its baseline measurement, so text sat low. `withInlineMeasuringImage` fixes this for the length of a capture.
- It cannot parse `oklch()` or `color-mix()`, so `resolveOklchColors` rewrites the stylesheets inside the clone. That step also swaps the Google Fonts `<link>` for a `<style>`, which makes the clone load Inter again.
  - `loadCloneFonts` waits up to 3 s for it and logs a warning if it gives up.
  - Without that wait, words were measured in the fallback font and drawn in Inter, so they ran together ("Salesplan").
- The canvas has no tabular figures and handles letter-spacing badly; `settleTextForCanvas` adjusts the clone for both.

**Windows and Git Bash**
- Set `MSYS_NO_PATHCONV=1` when passing `/routes` through environment variables.
- An empty `.git/index.lock` was left behind several times by git processes that were killed. If no `git.exe` is running, delete it.
- Worktrees: unlink the `node_modules` junction before `git worktree remove` (see memory).
- Other Claude sessions on this machine run heavy jobs. If Vite takes 30 s or more to start, the disk is saturated; the app is not at fault.

## State (2026-09-29)

- `main` is at `80425b7`. These PRs are merged:
  - #1 Redesign, every screen, for desktop, tablet and phone.
  - #2 Polish: chart labels, export baseline and file size, the current month.
  - #3 A console warning when the web font takes longer than the wait.
- Branches that are merged but still exist: `fix/polish` and `fix/font-timeout-warning` on origin, and local `backup/fix-polish-*`. Delete them only once the user agrees. The older branches (`chore/cleanup`, `feat/ux-pass`, `feature/redesign`, `fix/export-input-and-race-bugs`, `fix/ux-and-architecture-repair`) predate this work; ask before touching them.

## Known limitations and possible next steps

- If the web font is more than 3 s late or fails to load, the export still goes ahead and words may run together. A console warning says so.
- Monthly at 390 and 1024 px: February's planned-hours "1,400" sits 0.8 px under the halo of "400". This is cosmetic and already known.
- With crafted data, a figure's corner can sit under the hours-actual plate, and the sales plan can overlap hours actual. Both were there before this work and are better than they were.
- If a user picks a light bar colour and a light figure colour, the plate is hard to read. This was there before this work.
- A PNG export in dark mode is slow because of the palette swap and the capture (about 17 s on a loaded machine).
