# Wealth Planner

A single-page Australian personal finance / property-investment planner. No backend, no build
step — a static site (`index.html` + `styles.css` + ES modules under `src/`) that persists
everything to `localStorage` in the browser. Deployed via GitHub Pages.

For the full detail behind every point below — business-logic assumptions, the complete gotcha
list with explanations, established UI patterns, and what's still pending — see
[`.claude/PROJECT_KNOWLEDGE.md`](.claude/PROJECT_KNOWLEDGE.md). This file is the short version.

**Before starting new work, read [`.claude/ROADMAP.md`](.claude/ROADMAP.md)** — the agreed build
order, with a status marker per item. Flip an item to `[~]` in the *first* commit of the work, not
the last, so two sessions can't pick up the same one.

## Architecture

- `index.html` — all markup for every page/section. Since v3.57.0 the pages are organised by job,
  and since v3.129.0 by what you own: Home (`page-dashboard`: Overview / Insights / Benchmarks /
  Review — Checks sit in Review), Cash flow (`page-expenses`: Budget / Income / Spending / Bills),
  **Net worth** — one menu entry over four pages sharing a rail of tabs: the overview
  (`page-networth`), Accounts, Investments (`page-assets`) and Property (`page-properties`) — Tax
  (Year / Returns / Documents / People), Plan (`page-plan`: Scenarios — the scenario cards live here
  — / Projections / Goals / Retirement), Reports, Settings (`page-settings`: Categories / Preferences /
  Import rules) and a Details page (`page-detail`, `/detail/<kind>/<id>`, in no menu) for any one
  thing. Pages are `<section class="app-page" id="page-...">`, shown/hidden via `showPage()`, not
  separate documents; old ids (`income`, `scenarios`, `projections`) still work through `nav.js`
  ALIASES, and `showAccountsSubpage("people"|"checks")` and `/settings/people|checks` land where
  those tabs moved (`MOVED_SETTINGS`). **Navigation (v3.140.0):** desktop has the sidebar; a phone
  (≤880px) has no brand bar — the page title is the header (slim once scrolled) — and a bottom bar of
  Home · Cash flow · Net worth · Tax · Plan. Both have the header's **avatar menu** (Reports, Settings,
  backup & sync, import/export, theme, sample data, reset, updates, version); its dot means a save failed.
  The smoke script taps the tabs and the avatar menu, so a broken nav fails CI.
- **Numbers:** every figure uses `var(--font-num)` with tabular figures (base.css) — whole dollars in
  totals and summaries, cents only on single items. Don't reintroduce a second number font.
- `styles.css` — just eight `@import` statements pulling in `src/styles/{base,shell,dashboard,
  ledger,income,properties,assets,projections}.css`, in that specific order. Light/dark theming is
  CSS custom properties + `prefers-color-scheme`, defined in `base.css`.
  **Import order is load-bearing, not cosmetic** — several classes with equal specificity are
  combined on the same element (e.g. `class="income-summary-line home-recon-line"` in
  `scenarios.js`) and rely on source order to resolve which value wins, exactly as the original
  monolithic file did. Moving one `@import` line before another can silently flip such an
  override. Before reordering, re-run the cross-bucket conflict check described in
  `.claude/PROJECT_KNOWLEDGE.md`'s "Modularization progress" section.
- `src/app.js` — the entry point (`<script type="module">`), ~5,800 lines (down from the original
  4,618-line monolith, then back up as features landed — it is the app's event-wiring layer, and
  that grows with every new control). All eight pages' rendering/routing and export/import/backup
  have moved to `src/components/`/`src/lib/backup.js`; what's left is DOM event
  wiring/registration, the purchase-calculator glue, and cross-cutting dispatch helpers
  (`rerenderTableFor`, `getArrayForSection`, `findProperty`, `updatePersonSuggestions`,
  `renderAll`) that route by a section-string key across every page and are expected
  to stay here permanently — see "Modularization progress" in `.claude/PROJECT_KNOWLEDGE.md` for
  the full list of functions deliberately pinned to `app.js` for good, not just for now. Both the
  JS and CSS splits (see above) are now complete — the ES-modules migration is done.
- `src/state.js` — `state` (the single source of truth), `defaultState()`, `migrateState()`
  (schema migration + safe defaults for old/partial saves), `persist()` (debounced localStorage
  write), `setStatus()`.
- `src/calc/{ledger,property,tax,engine,cashflow,fire,history,trends,bank-import,import-rules,claims,people,received,closeyear,health,withholding,junemoves,actuals,monthreview}.js` —
  pure financial math and parsing, no DOM access. `ledger.js`
  (period conversions, sums), `property.js` (stamp duty, LMI, loan repayments, gearing, equity —
  `propertyEquityToday()` and friends), `tax.js` (AU income tax/Medicare, super contribution caps,
  Division 293), `engine.js` (net-worth projection series, `totalNetWorthValue()`, the "recompute
  all derived/synthetic rows" pass), `cashflow.js` (the smoothed/reserve split), `fire.js` (the
  accessible-vs-super FI split and the bridge-to-preservation-age simulation), `history.js` and
  `trends.js` (logged values over time, month-over-month spending), and
  `bank-import.js`/`import-rules.js` (CSV parsing and merchant-name cleanup), `claims.js` (what a
  deductible line claims and against whom — a person or a property), `people.js` (renaming a person
  everywhere they're named), `received.js` (income received, kept apart from spending
  transactions), `closeyear.js` (a finished year's actuals into next year's plan), `health.js`
  (the Settings → Checks consistency list), `withholding.js` (the payslip refund-or-bill check),
  `junemoves.js` (Before 30 June), `actuals.js` (the plan corrected by what's been logged),
  `monthreview.js` (Home → Review), `accounts.js` (account types and balances, read and written
  through `account.link` to the record that holds the money), `cashflowlist.js` (one list of money
  in, out and transfers; splits; bulk edit), `bills.js` (the bills calendar), `investments.js`
  (portfolio performance, distributions by year, super against the cap), `reports.js`,
  `savegoals.js` (savings goals on account balances), `firstrun.js` (the first-run setup's answers into rows), `pricesheet.js` (share prices and weekly backfill read from a shared Google Sheet), `trips.js` (spending in a trip's dates filed to its line), `agentstatement.js` (a property manager's statement in one step), `monthdetail.js` (a month against your own usual month), `nwcheck.js` (whether what you kept explains how net worth moved), `recurring.js` (repeating payees and rising
  lines; what's hiding in a catch-all line), `nwhistory.js` (net worth on a past date), `takehome.js` (pay
  received against the plan), `canbuy.js` (Plan → Can we buy?), `brokertrades.js` (a broker's trade
  history into lots), `pdfstatement.js` (a PDF bank, card or property manager statement into rows),
  `emergency.js` (an emergency fund sized on essentials), `trim.js` (padding in the plan, flexible
  lines, lean scenarios), `advice.js` (what the app notices),
  `aisummary.js` (the anonymised summary behind Ask Claude), and from the October 2026 roadmap
  (items 135–165): `estimates.js` (a super or property value between logs), `merchantbook.js`
  (well-known merchants), `budgetfromhistory.js` (a budget proposed from spending), `payslip.js`
  (a payslip's text read), `reportframe.js` (the shared period / comparison / grouping every report
  reads), `investreports.js` (returns by holding, distributions, CGT parcels), `assetreports.js`
  (property returns, the loan schedule and payoff), `outcomes.js` (Monte Carlo bands and retirement
  odds), `lifeevents.js` (dated events on the projection), `agepension.js` (account-based pension
  drawdown and the Age Pension) and `networthlist.js` (everything owned and owed in one list); `inbox.js` (statements dropped into a
  Statements folder in Dropbox or the backup folder — `lib/inbox.js` lists, reads and moves them); and
  `showas.js` (Income per year, month, fortnight, week, day or hour).
- `src/components/{dashboard,home,income,taxyear,expenses,cashflow,accounts,assets,investments,
  properties,projections,scenarios,reports,rules,period,safekeeping,savegoals,recurring,yearend,nav,
  bank-import,search,people,received,health,junemoves,monthreview,retirement,networth,detail,
  lifeevents,budgethistory,…}.js` — one file per page or card (plus `nav.js` for routing/page-switching, and
  `bank-import.js`/`search.js` for the two cross-page flows), each exporting its functions for
  `app.js` to import and wire up. Not every function that "belongs" to a page lives in its
  component — `renameTaxPerson`/`removeTaxPerson` (Income) and `showAssetsSubpage` (Assets)
  turned out to be cross-cutting routing/dispatch code and stayed in `app.js`/moved to `nav.js`
  instead. DOM event *registration* (every `addEventListener` call) also stays in `app.js` for
  every component, `nav.js` included — only the callable render/patch/routing logic moved.
- `src/constants.js`, `src/lib/{format,toast,html,ledger-table,charts,swipe,notifications,search,
  setup,timerange,scroll-shadow,safekeeping}.js` — static data tables and dependency-free utilities used across
  everything above: currency/percent formatters, toasts, `escapeAttr`/`slug`, the shared ledger row
  renderers (`modernPlainRowHtml`/`modernRowShellHtml`/`timingFieldsHtml`) used by every ledger
  page, the hand-rolled SVG charts (`renderLineChart`, `renderStackedAreaChart`), the local
  notification layer, cross-page search, and the setup checklist.
  **There is no Classic mode any more** — `lib/uimode.js`, `state.uiMode` and the `buildTable`/
  `rowHtml` `<table>` renderers were all removed once every page went Modern-only. If you find a
  reference to any of them anywhere, it is stale.
- `index.html` starts with `<!doctype html><html lang="en-AU">` (v3.138.0 — before that the app ran in
  quirks mode). Text coloured as up/down/warning uses `--good-ink`/`--bad-ink`/`--warn-ink` (base.css),
  which pass 4.5:1 contrast; `--good`/`--bad` are for fills, bars and dots.
- `src/lib/storageuse.js` — how full localStorage is (a notification from 70%, a line in Settings →
  Preferences). `src/lib/help.js` also puts each page's ⓘ and its own ⋯ actions beside the title.
- `src/lib/backup.js` — JSON backup export/import (with optional Web Crypto passphrase
  encryption) and per-section CSV export. `applyImportedBackupJson` stays in `app.js` since it
  calls the permanent-resident `renderAll()`.
- `vendor/pdfjs/` — pdf.js (Apache-2.0, its LICENSE alongside), vendored rather than loaded from a CDN so PDF
  import works offline and never depends on a third-party host. Loaded only when a PDF is chosen
  (`src/lib/pdftext.js`); outside `src/`, so `npm run stamp` leaves it alone.
- `src/lib/foldersync.js` + `src/lib/dropbox.js` — sync between devices (v3.134.0/v3.136.0): one encrypted file
  (`calc/syncfile.js` decides load / write / ask), written through the chosen backup folder or the app's Dropbox
  folder (OAuth PKCE, `DROPBOX_APP_KEY`). Per-device sync memory and tokens live in localStorage, never in `state`.
  Since v3.143.0 a conflict is merged three ways (`calc/syncmerge.js`) against the last agreed copy, kept in IndexedDB;
  only the same thing changed on both devices is asked about.
- `prices/` — the daily price file (v3.133.0): `universe.json` is a fixed public ticker list (never add
  one because someone holds it — the repo is public), and `latest.json`/`weekly.json` are rewritten each
  weekday by `.github/workflows/prices.yml` (`scripts/prices/fetch.mjs`: Twelve Data for US with the
  `TWELVE_DATA_KEY` secret — its free plan has no ASX — and Yahoo Finance for ASX while the workflow sets
  `ASX_FROM: yahoo`; Stooq refuses GitHub's runners). The app reads them from its own site (`components/autoprices.js`).
- `manifest.webmanifest`, `sw.js`, `icons/` — installable PWA support. The manifest's
  `start_url`/`scope` are `"."` (relative to the manifest's own URL) rather than an absolute
  path, so the same file works unmodified from both local dev (served at root) and GitHub Pages
  (served under `/wealth-planner/`) — same reasoning as `nav.js`'s `BASE_PATH` detection, just via
  browser URL resolution instead of a JS runtime check. `sw.js` is network-first with
  cache-as-you-go (no fixed precache list): every online load refreshes the cache, and whatever's
  already cached keeps the app fully working offline, matching the fact that this app was already
  100%-client-side/localStorage before the PWA work. Registered from `app.js` via
  `navigator.serviceWorker.register("sw.js")` — see `.claude/PROJECT_KNOWLEDGE.md` for two gotchas
  that cost real debugging time here: the `event.waitUntil()` requirement for any cache write that
  outlives the fetch handler's synchronous return, and same-origin `no-cors` (opaque) responses
  always reporting `.ok === false` even on success.

**`state` is a live import, not a value** — never reassign the imported `state` binding directly
(`state = X` throws for an ES-module import). Use `setState(newState)` from `state.js` instead;
`app.js` does this correctly today (Reset, Sample data, Import backup) — keep it that way.

Because this is ES modules (`type="module"`), the app **cannot be opened via `file://`** — it
must be served over HTTP. See "Running it" below.

## The one rule that matters most: version + tag every shipped change

Every commit that ships a real change to the app must be followed by its own version-bump
commit and a matching git tag:

1. Make the functional change, commit it on its own.
2. Bump `<span class="app-version-num">vX.Y.Z</span>` in `index.html` (inside `<p class="app-version">`
   — the number sits in its own span because it's parsed, both from the live DOM and from a
   freshly-fetched copy of the file, to detect a newer deployed version) — **Minor** (`v1.X.0`) for a new
   feature/behavior change, **Patch** (`v1.0.X`) for a bug fix — in a separate commit titled
   `Bump version to vX.Y.Z — <short reason>`.
   In the same commit, run `npm run stamp`: it writes the version onto every module URL (an import
   map in `index.html`, plus a `modulepreload` per module so a first visit fetches them all at once
   rather than an import level at a time) and the stylesheet imports, so a browser can never pair a
   new page with an old cached module. `tests/stamp.test.js` fails if you forget — and a new module
   needs a stamp before the tests pass.
3. `git tag -a vX.Y.Z -m "<short reason>"`.
4. Push both `main` and the tag.

Do this for every shipped change, without being asked. This is a strong, explicit standing
preference — not optional polish.

## Never commit real personal data — this repo is public

Nothing from a real person's finances or identity goes into this repository: not in code, tests,
fixtures, comments, docs, commit messages or PR descriptions. That covers names, addresses,
employers, banks and lenders, merchants and places, account / card / tax file numbers, salaries,
balances, transactions, tax-return figures, purchase or settlement dates, ages and birthdays. It
applies just as much when the data is the repo owner's own — a backup, a payslip or a lodged return
shared during a session.

- **Every test and fixture uses invented data, far from anything real.** Placeholder people
  (Alex, Sam), "Employer A", "1 Example St", generic merchants (Fern Café, Bank One), and amounts
  made up from scratch. Never scale, round or lightly alter a real figure — invent a new one.
- **Verify against real data outside the repo.** Checking the engine against a real backup or a
  lodged return is good practice; do it in a scratch directory, and report the result without the
  figures ("every label matches", not the dollar amounts).
- **Files made from someone's real data** (a tax year import file, a corrected backup) go to them
  directly — never committed, never attached to a PR.
- **Before every push, grep the diff** for names, places, employers and non-round amounts that
  look like someone's real numbers. If in doubt, leave it out.

Git history is public too. Removing something later means rewriting history and asking GitHub
Support to purge cached pull-request commits, so getting this right before the push is the only
cheap option.

## Always open a pull request for shipped work

Pushing the branch is not the end of the job. Once a piece of work is complete and pushed, open a
pull request for it without being asked — same standing-preference weight as the version rule
above. One PR per coherent piece of work, covering however many increments it took; don't leave
finished commits sitting on a branch with no PR, and don't wait to be prompted.

## Running it locally

```
python3 -m http.server 8934   # from the repo root
```

Then open `http://localhost:8934/index.html`. A real browser (Playwright + an installed Chrome,
not the bundled Chromium) is the standard way to drive/verify UI changes in this repo — see
`.claude/PROJECT_KNOWLEDGE.md` for the exact pattern used throughout this project's history.

## A few things that will bite you

- **"This year" and "this month" are the header's period, not today.** `householdYearWindow()`,
  `transactionsInMonth()`, `budgetCycleFor()` and friends default to the period picked beside the
  page title (`calc/ledger.js` `selectedYearWindow`/`selectedMonth`/`periodAnchorDate`). Anything
  that is genuinely about *now* — notifications, Before 30 June, Checks' last finished year, which
  years can be closed — must pass today explicitly (`todayTaxFy()`, `localDateStr()`).
- **`showPage()` applies inside a view transition, i.e. later.** Two navigations in one tick (e.g.
  `showPage("accounts")` then `showAccountsSubpage("checks")`, which moves on to Settings) are
  resolved by "newest wins" — `applyPageChange` bails if `currentPage` moved on. Don't remove that.
- **Transfers and money received are never spending.** They live in `state.transfers` and
  `state.incomeLog`; every spending total sums `state.transactions` only. A split is several
  ordinary transactions sharing `splitGroup`, so totals need no special case.
- **An account name is a foreign key by string, and nothing enforces it.** No row anywhere stores
  an account *id* — `item.account` and `t.account` are plain names — so renaming or deleting an
  account has to walk every array that carries one, `state.home` (one per scenario) included.
  Both helpers live in `expenses.js` and both go through `everyAccountBearingArray()`; the
  category side has its own twin, `everyCategorisableArray()`. Adding a new array of rows that
  carries `account` or `category` means adding it to those, or renames silently orphan it.
  **Deleting an account deliberately leaves the name on the rows** (unlike deleting a category,
  which blanks it) — an account records where money actually moved, and keeping the name means
  re-adding one spelled the same way relinks everything for free. The cost is that a row can name
  an account that no longer exists, so anything offering a list of accounts must handle that: a
  `<select>` whose value matches no option silently shows the *first* one, which is why
  `transactionAccountOptionsHtml()` emits an explicit `… (deleted)` option.
- **When extracting a component out of `app.js`, its session-only UI-state maps (e.g. Modern-row
  open/closed state) can be mutated from code still in `app.js`** (the generic
  `wireModernRowToggle` takes the map by reference). Forgetting to export one of these produces a
  runtime `ReferenceError` on first interaction, not a syntax error — `node --check` won't catch
  it, only actually clicking the thing in a browser will. See `.claude/PROJECT_KNOWLEDGE.md`'s
  "Modularization progress" for the real instance of this.
- **CSS `[hidden]` silently does nothing** if any author rule sets `display` on that element —
  author CSS beats the browser's built-in `[hidden]{display:none}` regardless of specificity.
  Add an explicit `.your-class[hidden]{ display:none; }` override whenever you toggle `.hidden`
  on an element that also has its own `display` rule.
- **A same-specificity CSS rule wins by *source order*, not by whether its `@media` condition is
  the "more specific" one.** A `@media (max-width:880px){ .foo{ display:none } }` block placed
  *before* an unconditional `.foo{ display:flex }` rule loses to it on every viewport, mobile
  included. Always place a responsive override *after* the base rule it's meant to override.
  (This bit three different elements in one session before the pattern was recognized.)
- **Checkbox `preventDefault()` reverts the checkbox's own checked state after all its click
  listeners finish running** — regardless of what a listener sets `.checked` to in the meantime.
  Don't use a "preventDefault + forward to the real control" pattern for mirrored checkboxes;
  let each one toggle itself natively and sync via plain `.checked = ...` assignment on `change`.
- **A service worker `fetch` handler's async side effects (e.g. `cache.put()`) need
  `event.waitUntil()`** if they happen after the response you hand back — the browser is free to
  suspend/kill the worker the instant `event.respondWith()`'s promise resolves, mid-write, since
  nothing told it to wait. `sw.js`'s cache-as-you-go writes were silently no-ops for a while
  because the `caches.open().then(cache.put)` chain wasn't wrapped in `waitUntil()`.
- **A same-origin `fetch()` made in `no-cors` mode (which browsers use for plain `<link
  rel="stylesheet">`/`@import`/font fetches, even same-origin) always returns an opaque response
  with `status: 0` and `.ok === false`, even on success** — you cannot tell it apart from a real
  failure from JS. `sw.js` caches on `response.ok || response.type === "opaque"`, not `.ok` alone,
  or every CSS/font request would silently never get cached.

## Testing conventions

`npm test` runs Node's built-in runner over `tests/*.test.js`. No framework, no dependencies — that
is deliberate, and any fix that needs jsdom or a bundler to be testable is the wrong fix.

Three layers, and **knowing what each one cannot see is the whole point**:

1. **`tests/*.test.js` over `calc/`** — the financial arithmetic. Deep coverage, and none of it
   touches the DOM.
2. **`tests/render-smoke.test.js`** — calls the pure HTML builders (`modernPlainRowHtml`,
   `categoryChartHtml`, `sparklineHtml`, …) with fixture data and asserts they return markup.
   It exists because **a fully green suite twice sat on top of a page that did not render at all**:
   once from a function imported out of the wrong module, once from a variable referenced outside
   its scope. Both passed `node --check`. Both passed every test. Both were found by opening a
   browser. If you add a function that builds HTML from data, add it here.
3. **Driving the app** (Playwright + real Chrome against the http.server above), screenshotting,
   reading the DOM and console. Still the only thing that sees event wiring, CSS cascade, layout,
   and anything reached through `document`.

- **Fixtures are invented** — see "Never commit real personal data" above. A test that was checked
  against a real return keeps its logic and gets made-up inputs, with expectations rebuilt by hand.
- **CI (`.github/workflows/checks.yml`) runs `npm test` and `scripts/smoke.mjs` on every PR.** The
  smoke script opens every page and subtab headless at 390/1280px, light and dark, and fails on page
  or console errors, an empty page, sideways scroll, NaN/undefined text, or a %-width bar measuring
  0. Run it locally with `npm i --no-save playwright && npx playwright install chromium && node
  scripts/smoke.mjs`. It catches breakage, not layout taste — still look at what you changed.
  Adding a page, subtab or report means adding it to the smoke script's `VIEWS`.
- **Screens (v3.130.0):** on a pull request the `screens` job runs the same script with `SHOTS_DIR`
  (a full-page picture of every view, light, 390/1280px, clock fixed) against the base branch
  (`SMOKE_ROOT`) and the PR, and `scripts/shotdiff.mjs` lists what changed in the job summary and the
  "screens" artifact. Informational only — read it, it never fails.
- **A green run is not evidence the app renders.** Nothing in layers 1–2 loads a component or
  fires a listener. Any change to a component, a template or a stylesheet gets driven before it is
  called done.
- Prefer checking computed styles/behavior over eyeballing when a bug might be CSS-cascade-related
  — several real bugs in this project were only found via `getComputedStyle()` audits, not visual
  inspection. The same goes for geometry: measure `getBoundingClientRect()` rather than deciding
  a bar or a tap target looks about right.
