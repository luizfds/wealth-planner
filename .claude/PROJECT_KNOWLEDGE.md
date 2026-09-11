# Wealth Planner — project knowledge

Deeper reference behind the root [`CLAUDE.md`](../CLAUDE.md). Read that first; come here for the
"why" and the details it points to.

## What the app is

A single-page Australian personal finance / property tool. Pages: Dashboard, Income & Tax,
Expenses, Assets (Cash/Shares/Super/Vehicle/Other), Properties, Scenarios (rent-vs-buy, one
purchase calculator per scenario), Projections. Everything lives in one `state` object, persisted
to `localStorage` only — there is no server, no accounts, no sync between devices.

Every page (except Dashboard/Projections) has a **Classic** (spreadsheet-style `<table>`) and
**Modern** (card-based) rendering of the same data, controlled by one global `state.uiMode`. This
was a deliberate multi-week rollout across the project's history: Income & Tax → Expenses →
Properties → Assets → Scenarios, each shipped and verified before moving to the next, followed by
a polish pass (see "Modern-mode UI patterns" below) applied in the same order.

## Data model (top-level `state` keys)

`activeScenario`, `scenarios[]`, `uiMode`, `showAllPeriods`, `incomeCols`/`expenseCols`/`homeCols`
(classic-table column visibility prefs), `income[]`, `shared[]` (household/shared expenses),
`home{scenario: item[]}` (per-scenario recurring home costs — rent or "Rent / Home Loan" +
insurance/rates/water/maintenance), `purchase{scenario: cfg}` (purchase calculator config per
scenario), `assets[]` (category field distinguishes Cash/Shares/Super/Vehicle/Other), `properties[]`
(each with `loans[]`, `income[]`, `expenses[]`), `projection`, `tax` (super
guarantee rate, per-property IP ownership split, per-person settings), `fire` (current age,
target retirement age, preservation age — see `calc/fire.js`).

`projection` is `{ horizonYears, investReturnRate, propertyAppreciationRate, inflationRate,
rateShockPct, incomeGrowthRate, realTerms }`. The last two are v2.77.0: `incomeGrowthRate`
(default 3, matching the inflation default) is the annual pay rise applied to every income row —
before it existed income was held flat for the whole horizon while expenses inflated, which had
the surplus going negative partway through a 20-year horizon. `realTerms` (default `true`) is not
an assumption but a **unit**: it picks whether the series is deflated to today's dollars, and
changes nothing the model computes. Callers can pin it via `computeNetWorthSeries(scenario,
horizon, { realTerms })` — the projection-accuracy panel passes `false`, because it grades a
stored reference series against real logged net worth, which is nominal by nature.

### The budget list is three arrays, not one

The Expenses page's "Household budget" is assembled by `budgetLineSources()` in
`components/expenses.js` from three places that are deliberately *not* merged in state:

| Source | `section` key | Array |
|---|---|---|
| Shared household expenses | `shared` | `state.shared` |
| The active scenario's housing | `home:<scenario>` | `state.home[state.activeScenario]` |
| Each investment property's costs | `propexp:<propertyId>` | `property.expenses` |

Every row renders with its own `data-section`, so all the existing generic handlers (edit,
delete, add, scenario-override) route to the right array with no special-casing. Three
consequences worth knowing before touching any of this:

- **They stay separate on purpose.** Scenarios differ by *row set*, not just amount (Council
  Rates only exists if you buy), and an IP's costs belong to the property — they're edited from
  the Properties tab too, off the same array. Merging into `state.shared` would need `$0`
  placeholder rows or a "doesn't apply here" concept.
- **Anything that walks "every budget line" must use `budgetLineItems()`**, never `state.shared`
  alone. That caught out the category manager's usage counts, `renameCategoryEverywhere`,
  `deleteCategory`, the Actual-vs-Planned empty state, and `lib/search.js` (which keeps its own
  mirror of the same list, since `lib/` can't import a component — keep the two in step).
  Rename/delete go wider still, via `everyCategorisableArray()`: they must reach rows in
  scenarios you aren't currently in, or the old name comes back the next time you switch.
- **`loggableBudgetLineItems()` is the subset you can log spend against** — `budgetLineItems()`
  minus `computed` rows. Quick-log chips, the overdue queue, the transaction "link to" select,
  the Actual-vs-Planned panel and per-row progress bars all use it; the Budget tab's list and
  monthly total use the full set. A computed line is real money but nobody logs a direct debit,
  so it would otherwise read "$0 of $3,510" forever.

### `homeLoanRow` means two different things, and the projection has to know which

Every scenario's housing array has one row with `id: "homeLoanRow"`, labelled "Rent / Home Loan".
Which of those two it actually is depends on the scenario's **purchase leg**:

| Purchase leg | The row is | Who pays it in `computeNetWorthSeries` |
|---|---|---|
| on (`state.purchase[scenario].enabled`) | the mortgage | the model's own amortised `repaymentMonthly`, fixed in nominal terms |
| off | the rent | the inflatable expense set, inflating each year |

Getting this wrong is **silent and large in both directions**: include it with the purchase leg on
and the same housing cost is charged twice; exclude it with the leg off and a renting household's
single largest expense vanishes from the projection. The second one was a real, shipped bug — on
the reference backup the model assumed $3,510/mo more savings than the Dashboard's own
net-savings tile showed for the same scenario, and it flattered precisely the scenario the "comes
out ahead" headline named, which changed the headline's winner once fixed (v2.77.0).

The decision lives in exactly one place: `scenarioInflatableHomeItems()` in `calc/property.js`,
which also carries the invest-leg-beats-purchase-leg precedence `computeNetWorthSeries` uses. Use
it rather than re-filtering `state.home[scenario]` by id — that re-filter is the bug.

Note that `scenarioTotals()` deliberately counts the **whole** housing array including this row:
it reports what the household actually spends, with no purchase calculator in the picture. The two
are not supposed to agree on this row, which is why the discrepancy went unnoticed for so long.

### Rows can end (`item.endDate`, v2.77.0)

Every ledger row takes an optional `endDate` (ISO date string, `""` = runs forever, which is what
every pre-existing row carries after migration). Offered as "Ends (optional)" inside
`timingFieldsHtml()` in `lib/ledger-table.js`, so every ledger surface gets the field from one
edit — Income's bespoke Modern row included, since it calls the same helper.

Anything that projects a row forward must filter on it — `calc/ledger.js` has `isActiveOn(item,
dateStr)`, `isActiveInYear(item, yearsFromNow, todayStr)` and `sumFieldActiveInYear(items, field,
yearsFromNow, todayStr, amountFor)` (the resolver argument is how the shared ledger gets
scenario-resolved amounts out of the same helper income uses raw). Two consumers today:
`computeNetWorthSeries` and `calc/cashflow.js`.

**The cash-flow forecast's smoothed side is summed per month, not once.** It used to compute one
`baselineNet` before the month loop; with end dates that would mean a row ending in month eight
never frees up cash in month nine. A row that ends part-way through a month is counted for the
whole of it — the forecast's unit is a month, and dropping a cost the day it ends would understate
the very month you still have to pay it in.

Rows do **not** end anywhere else yet: the Spending tab, the budget totals and the CSV exports all
still count an ended row at full value. That's why a collapsed row shows a red "Ended …" pill — it
is still inflating every per-month figure on the page until it's deleted.

### Reaching a file next to index.html: always root-relative (v2.78.1)

**Never write a document-relative URL in app code.** By the time any of it runs, `nav.js` has
rewritten the address bar to the current route, so a relative URL resolves against *that*, not
against `index.html`:

| address bar | `"sw.js"` resolves to | |
|---|---|---|
| `/dashboard` | `/sw.js` | correct, by luck |
| `/expenses/spending` | `/expenses/sw.js` | **404** |

Use `appAssetUrl(file)` from `components/nav.js` (it's `BASE_PATH + "/" + file`, and `BASE_PATH`
is `""` locally / `"/wealth-planner"` on Pages, so both come out root-relative).

This shipped silently for a long time, and the way it hid is the lesson:

- **One-segment routes resolve correctly.** Only the two-segment ones (`/expenses/*`,
  `/assets/*`) broke, and only on a *fresh load* there — a shared link, a bookmark, or a plain
  reload. Everyday clicking around never triggers it, because the document was loaded from the
  root.
- **Both sites had comments asserting they were fine** ("even from a pushState'd path"). The
  comments were wrong; the code read as deliberate.
- **Service worker script fetches don't surface in page-level request logging**, so Playwright's
  `response` events saw nothing — only the console message "A bad HTTP response code (404) was
  received when fetching the script" gave it away. (Same family as the `page.route` gotcha below.)

Measured on a fresh load of `/expenses/spending`: **no service worker registered at all** (so no
offline support), and "Check for updates" reported *"Couldn't read the deployed version"* every
time. `tests/asset-urls.test.js` guards the spelling, since no runtime assertion would catch it
being reintroduced in a file the tests don't exercise.

`sw.js` itself was always correct — it uses `new URL("index.html", self.registration.scope)`,
which is why the scope `appAssetUrl` produces has to stay the app root.

### Spending trends: what the transaction log can and cannot tell you (v2.78.0)

`calc/trends.js` powers the Spending tab's "Spending over time" panel. The arithmetic is easy;
everything hard about it is about **not making claims the data can't support**. Three rules, all
learned by running it against a real backup rather than by reasoning about the code:

1. **An unlogged month is indistinguishable from a month with no spending.** Both are `$0`.
   Comparing against months from before the user started logging produced *"Groceries up 3,124%"*
   on the reference data. `coveredMonthCount()` trims the window to the contiguous run of months
   that were genuinely being logged — thresholded against the median of *that household's own*
   non-empty months, never a fixed dollar figure.

2. **Never extrapolate a part-finished month.** The obvious fix for "a partial month always looks
   like a fall" is to scale it up by the fraction of the month elapsed. **Don't.** Household
   spending is front-loaded — rent, power and insurance all land in week one — and this app's own
   "Catch up on overdue" flow encourages logging in bulk. Eleven days into the month that turned
   $3,067 into a confident "on track for $8,366". Instead every comparison runs on a
   **month-to-date** series: this month so far against the *same days* of earlier months
   (`spendByCategoryByMonth`'s `throughDay`). Whole months still drive the bars and the table, so
   the view carries two series per category — `values` (whole) and `mtdValues` (truncated).

3. **The app cannot tell "spent more" from "logged more thoroughly."** Nothing short of a bank
   feed can. On the reference backup August was logged mostly in its last week and September
   mostly in its first, so even a same-days comparison read "515% more". Hence
   `TRENDS_MIN_MONTHS_FOR_COMPARISON = 3` in `components/expenses.js`: below three logged months
   the panel renders bars and numbers but **no deltas and no streak alerts**, and says why. Two
   points can't distinguish a trend from a difference. Don't loosen this without a better signal
   than transaction counts.

Direction colours are **inverted** from the rest of the app in this panel — `.up` is `--bad`,
because this is spending. Everywhere else (asset trends, capital gain) up is good.

### Two comparison windows, and how a line picks one

A budget line is judged against one of two windows, and `item.irregular` is the switch:

- **Regular lines** get `budgetCycleFor()` — the line's own billing cycle (this month, `this
  month ×4` for weekly, `Sep–Nov` for a quarterly bill). Anchored on `dueMonth`, else inferred
  from the last logged transaction.
- **Irregular lines** ("no fixed timing") are reserves — Extras, property maintenance, a travel
  budget — and are compared against a *whole year*, because they aren't expected in any
  particular month. They're excluded from the monthly rollup, from the overdue queue
  (`isDueForReview` returns false), and from the Budget row's progress bar, all deliberately:
  there's no schedule to be behind on.

Which year is per line, via `item.reserveYear` and `reserveYearWindow()`: `"calendar"` (Jan–Dec,
the default and what every reserve line used before the choice existed), `"financial"` (the
Australian Jul–Jun year, labelled `FY26/27`), or `"rolling12"` (the twelve months ending today).
Rows can differ, so the period is named per row rather than in the section heading. Anything
unset or unrecognised falls back to calendar, so an old save reads the same numbers as before.

The `rolling12` window clamps the day-of-month before stepping back a year: `new Date(y - 1, 1,
30)` for a 29 Feb "today" silently overflows to 2 March and yields a window a day short. There's
a test for exactly this.

Investment *loan repayments* are the one IP cost that is not a budget line — derived from
balance/rate/term, nothing to edit and nothing to fall behind on. They keep the read-only
"Investment loan repayments" card at the bottom of the page (`#propertyExpensesCard`), which is
explicitly *not* counted in the budget total above it.

### Two different "Log" buttons, and only one records money moving

They look alike and do unrelated things — a real source of confusion, so keep them straight:

- **Expenses' quick-log** writes a dated entry to `state.transactions[]` linked to a budget line.
  That's a real transaction: it feeds actual-vs-planned, the overdue queue and the category charts.
- **Every other page's `[data-log]`** (assets, properties, debts, home costs) snapshots the row's
  *current amount* into `item.history[]` via `appendHistorySnapshot`. That's a valuation over time,
  not a payment.

Income used to carry the second kind, labelled "Log", which made a pay rise a two-step-in-the-right-
order dance (edit Amount, then Log) and silently recorded the wrong figure in the wrong order. It
now has **"Record a pay change"** (`[data-pay-change]`) instead: you give it the new amount and a
date, and it *applies* the amount and dates the change. Same `item.history[]` store, so old saves
and backups keep working — and the row now actually displays that history, which nothing did
before beyond a one-line "since" delta.

### When an income row is paid

`nextPayDate(item, transactions, todayStr)` in `calc/ledger.js`, driven by a different field per
frequency — because the three families genuinely need different information, and one polymorphic
"payDay" would mean three things depending on a select two fields away:

| Frequency | Field | Why |
|---|---|---|
| Weekly | `payWeekday` (0=Sun…6=Sat) | a weekday is enough |
| Fortnightly | `payAnchor` (a real pay date) | a weekday can't say *which* of the two weeks |
| Monthly and less often | `payDay` (1–31 or `"last"`) | a day of the month |

All three are stored independently so flipping a row's frequency and back doesn't discard what was
set. Less-than-monthly rows combine `payDay` with the existing `dueMonth` to place the day inside
the right month. Anything unset returns `null` and the row simply shows no next-pay line — a blank
beats an invented date. Two traps with tests on them: a day the month doesn't have is clamped (the
31st in a 30-day month is the 30th, not the 1st of the next), and a *stored* date must never be
parsed by a helper that defaults to "now" when absent — that turned "no anchor set" into "the
anchor is today" and produced a confident wrong answer.

Several `income[]` rows are **synthetic/computed** (`item.computed === true`): a per-person
"Net income after tax & super" mirror, and a per-IP-property "Rent" mirror. These are
recalculated by `recalcComputedItems()` (in `calc/engine.js`) and must never be hand-edited or
double-counted elsewhere. The same `computed` flag pattern is used for the auto Property Manager
Fee expense row and for vehicle assets whose value is declining-balance depreciated from a
purchase price/date rather than manually entered.

## Modularization progress

The app is mid-migration from one `app.js` closure (pre-v1.33.1) to native ES modules under
`src/`, done in small verified steps rather than one rewrite — see the versioning rule below,
each step is its own tagged commit. Current state:

**All seven page components now exist** (`dashboard`, `income`, `expenses`, `assets`, `properties`,
`projections`, `scenarios`) plus `nav.js`. `lib/backup.js` (export/import/CSV/Web Crypto encrypted
backup) is also done — the last planned `lib/` extraction. `app.js` is down to ~1,275 lines from
the original 4,618 — DOM event wiring/delegation, the purchase-calculator and ledger-table generic
handlers, and a handful of genuinely cross-cutting helpers (`findProperty`, `getArrayForSection`,
`rerenderTableFor`, `updatePersonSuggestions`, `renderTotals`, `renderAll`,
`refreshAllUiModePages`). `applyImportedBackupJson` stays in `app.js` (not `backup.js`) since it
calls the permanent-resident `renderAll()`. **The CSS split is also done** — `styles.css` is now
eight `@import` statements into `src/styles/{base,shell,dashboard,ledger,income,properties,
assets,projections}.css`. The whole ES-modules migration described in this section is complete.

**Done:**
- `src/constants.js` — config-only constants (tax brackets, stamp duty tables, LMI bands,
  `STORAGE_KEY`, `PERIODS`, `FREQS`/`CLASSES`/`INCOME_TYPES`/`SUPER_MODES`/`SACRIFICE_MODES`/
  `ASSET_CATEGORIES`/`LIQUID_CATEGORIES`/`SHARE_MARKETS`/`PURCHASE_STATE_CODES`/
  `STATE_GROWTH_RATES` + label-mapping helpers). `PAGES`/`BASE_PATH`/`ASSETS_SUB_TO_SLUG`/
  `SLUG_TO_ASSETS_SUB`/`MOBILE_MORE_PAGES` live in `nav.js` instead (routing-only config, never
  needed elsewhere). Still-local-to-`app.js`: `EXPENSE_COL_DEFS` (only ever read by `app.js`'s own
  column-picker wiring, never needed by a component — may just stay put).
- `src/state.js` — the `state` singleton (`export let`, a live binding — see the gotcha in the
  root `CLAUDE.md`), `persist`/`setStatus`, `defaultState`/`migrateState`/`defaultHomeBlock`/
  `defaultPurchaseConfig`, `setState(newState)`.
- `src/calc/{ledger,property,tax,engine}.js` — layered `ledger` → `property`/`tax` → `engine`,
  no import cycles. `property.js` also owns the property-equity family
  (`propertyEquityToday`/`propertiesOffsetTotal`/etc.) even though `totalNetWorthValue()` — which
  combines equity with `totalAssetsValue()` — lives one layer up in `engine.js`.
- `src/lib/{format,toast,html,uimode}.js` — leaf DOM utilities with no page-specific logic.
  `uimode.js`'s `syncUiModeToggle()` is called from the top of nearly every page's `render*()`,
  which is why it's a lib export rather than living in whichever component happened to need it
  first.
- `src/lib/ledger-table.js` — the fully generic Classic-mode `<table>` renderer (`buildTable`,
  `rowHtml`, `periodTh`/`periodTd`, `optionsHtml`) shared by Income/Expenses/Home/Property-expense
  tables alike, plus `modernPlainRowHtml` — the equivalent generic Modern-mode row (What/
  [Classification]/Amount/Frequency/[Account], no person-tax machinery), used by Expenses/
  Properties/Home. Unlike Income's row renderer, `modernPlainRowHtml` takes its `openState` map as
  a parameter rather than a module-level var, so there's no cross-module-export gotcha for it —
  each caller passes its own. Nothing here imports `state`, so zero cycle risk for any component.
- `src/components/dashboard.js` — `renderCards`/`renderDashboardStats`/`renderDetail` (all
  exported; `app.js` still calls them from scenario CRUD) + the private `renderFireProgress`
  helper (not exported — nothing outside the module calls it).
- `src/components/income.js` — the Income ledger (group-by-person rows, synthetic net-income/rent
  rows) and the Tax & Super section (per-person cards, waterfall bar, concessional-cap usage,
  flip-to-breakdown). Exports: `renderIncomeGroups`, `renderTaxSuper`, `personBreakdownHtml`,
  `flipTaxCard`, `patchAllTaxPersonOutputs`, `patchOpenRowBreakdowns`, `patchIncomeGroupTotals`,
  `patchSyntheticIncomeRows`, `patchIncomeSuperNotes`, and the mutable `modernIncomeRowOpen` map
  (see gotcha below). `renameTaxPerson`/`removeTaxPerson` stay in `app.js` — same reason as
  scenario CRUD: they also call `updatePersonSuggestions`/`renderProjectionOutputs`, not extracted
  yet.
- `src/components/expenses.js` — the Shared living expenses ledger (grouped by
  Needs/Wants/Savings/N/A) and the read-only "Investment property costs" mirror on the same page
  (each IP property's expenses + loan repayment, summed — never written into `state.shared`, since
  those costs are already counted via `ipExpenseItemsForClassification`/`ipExpensesMonthly`
  elsewhere; adding a real row here would double-count). Exports: `renderSharedGroups`,
  `patchSharedGroupTotals`, `renderPropertyExpensesSummary`, and the mutable `modernSharedRowOpen`
  map.
- `src/lib/charts.js` — `renderLineChart` (+ private `svgEl`), the hand-rolled SVG line chart with
  crosshair/tooltip, used by Assets' "Net worth over time" and Projections' net-worth-series chart.
  Extracted as a prerequisite for the Assets extraction below rather than waiting for its own
  planned step, since Assets needed it immediately. No `state` import.
- `src/components/assets.js` — the Cash/Shares/Super/Vehicle/Other subpages, the allocation/
  net-worth-if-you-buy/net-worth-over-time summary panels, and (once Projections existed to
  import) the composer `renderAssets()` plus `logAssetSnapshot`/`applySharesPaste` themselves.
  Exports: `renderAssetCategoryPage`, `renderSharesSubpage`, `renderVehiclesSubpage`,
  `renderAssetsSummary`, `patchAssetCategoryTotals`, `renderNetWorthPanel`,
  `renderPortfolioHistoryChart`, `patchHoldingRow`, `patchVehicleRow`, `assetTrendHtml`,
  `modernAssetRowOpen`, `renderAssets`, `logAssetSnapshot`, `applySharesPaste`.
  `showAssetsSubpage` stays in `app.js` regardless (see routing note below) — it never touches any
  assets.js export.
- **`assetTrendHtml` gotcha**: looked Assets-only (asset/share/vehicle rows all show a value-trend
  arrow) but Properties' `propertyCardHtml` also calls it for a property's own value history —
  missed on the first pass, caught by the browser smoke test (`assetTrendHtml is not defined` on
  the Properties page), not by `node --check`. Same lesson as the `modernIncomeRowOpen` gotcha:
  counting a function's call sites isn't enough — check *where* each call site actually is before
  assuming they're all inside the block you're moving.
- `src/components/properties.js` — the Properties page's cards: value/loans/income/expenses per
  property, gearing/yield badges, net-equity/usable-equity tiles, plus `logPropertySnapshot`
  (moved in once its blocker — Projections — existed; inlines the property lookup rather than
  importing `app.js`'s generic `findProperty`, to avoid a reverse-direction import for one
  one-line helper). Exports: `renderProperties`, `patchPropertyCardComputed`,
  `renderPropListModern`, `logPropertySnapshot`, and the mutable `modernPropRowOpen` map.
  `applyPeriodVisibility` (a `state`-driven column/period visibility toggle `renderProperties`
  needs, alongside several other pages) moved to `lib/uimode.js` next to `syncUiModeToggle` — same
  shape of dependency as that one, same fix.
- `src/components/projections.js` — just `renderProjectionOutputs` (the net-worth-by-scenario
  chart + headline sentence + milestone table). The smallest extraction in the whole series, and
  the one that unblocked the rest: it has zero dependency on any other page, which is *why* every
  orchestrator stuck in `app.js` up to that point (`renderAssets`, `logAssetSnapshot`,
  `applySharesPaste`, `logPropertySnapshot`, scenario CRUD) was stuck on this one function
  specifically. The `#proj*` input/slider event wiring and the `pairSlider` helper stay in
  `app.js` — DOM event *registration* never moves, only the render/patch functions it calls.
- `src/components/scenarios.js` — the last page component: `renderHomeBody` and the per-scenario
  purchase-calculator panel (stamp duty/LMI/repayment breakdown, acquisition-cost list), plus
  scenario CRUD (`selectScenario`/`addScenario`/`renameScenario`/`deleteScenario` — movable once
  this file existed, since they only ever needed `renderHomeBody` here and `renderAssets`, already
  exported from `assets.js`). Exports: `selectScenario`, `addScenario`, `renameScenario`,
  `deleteScenario`, `renderHomeBody`, `renderHomeListModern`, `renderHomeBodyTotalsOnly`,
  `patchHomeLoanRowIfSynced`, `patchCalcOutputs`, `afterCalcChange`, and the mutable
  `homeBlockCollapsed`/`modernHomeRowOpen` maps. `onCalcInput`/`onCalcChange`/`onCalcClick` (the
  `#homeBody` purchase-calculator event handlers) and `onScenarioControlClick` (shared between the
  Dashboard cards and Scenarios' home blocks) stay in `app.js`, importing these exports — same
  "DOM registration stays, logic moves" split as every other component.
- **`renameTaxPerson`/`removeTaxPerson` turned out to be permanently pinned to `app.js`**, not
  just temporarily blocked like the others were: beyond `renderProjectionOutputs` (now
  extractable), they also call `rerenderTableFor` and `updatePersonSuggestions` — genuine
  cross-page routers/helpers that touch every page's DOM by section-string dispatch, which makes
  them architecturally app.js-resident forever (or a candidate for `nav.js`, never for a
  page-specific component). Don't expect these two to ever move to `income.js`.
- `src/components/nav.js` — routing (`showPage`, `parseRouteFromLocation`, `showAssetsSubpage`,
  the private `buildRoutePath`/`syncUrl`, and the `PAGES`/`BASE_PATH`/slug-map config that back
  them) plus the two menu-close helpers `closeNavMenu`/`closeMobileMore`. Unlike every other
  component, this one's actual DOM event *registration* (`appNav`/`navMenuToggle`/`mobileTabbar`/
  `assetsSubnav` click handlers, the document-level click-away/Escape listeners for both menus)
  stayed in `app.js` too, on purpose — keeping that one consistent rule ("registration in
  `app.js`, logic in the component") for all eight modules beat carving out a one-off exception
  just because nav's wiring doesn't depend on any other component's data. `currentAssetsSub`
  turned fully private once `showAssetsSubpage` moved in with it — it had only ever been read by
  `buildRoutePath`/`syncUrl` (both private too) and mutated by `showAssetsSubpage` itself, so
  nothing outside `nav.js` was left needing an import for it.
- `src/lib/backup.js` — the last `lib/` extraction. Exports: `decryptBackup`, `doExport`,
  `exportIncomeCsv`, `exportExpensesCsv`, `exportAssetsCsv`, `exportPropertyLoansCsv`. Everything
  else (`isoDateStamp`, `bufToBase64`/`base64ToBuf`, `deriveBackupKey`, `encryptBackup`,
  `finishExport`/`shareExport`/`fallbackExport`, `csvCell`/`buildCsv`/`exportCsv`) stays private —
  only ever called from inside this file. `applyImportedBackupJson` deliberately stayed in
  `app.js` rather than moving here: it calls the permanent-resident `renderAll()`, so pulling it
  into `backup.js` would create a component→app.js import backwards from every other extraction.
- **Web Share API hangs in headless Chrome — test gotcha, not a bug**: `shareExport()`'s
  `navigator.share({files: [file], ...})` call never resolves or rejects in this project's
  Playwright-driven headless Chrome, for any file type tested, even though
  `navigator.canShare()` synchronously reports `true` first. Confirmed pre-existing (not a
  refactor regression) by running the identical CSV-export click against the untouched
  pre-`v1.33.1` `app.js` via `git cat-file -p <commit>:app.js` — same indefinite hang, byte-for-byte
  unchanged code. Real devices show the native OS share sheet, which resolves the promise either
  way once the user picks something or dismisses it; headless Chrome has no such UI to dismiss, so
  the promise just sits forever. **When testing export-adjacent features, don't `await` the
  share-triggered path directly** — either test on a build where `canShare()` returns `false`
  (forces the plain-download `fallbackExport` path instead) or race the assertion against a short
  timeout and treat a timeout on `navigator.share()` specifically as inconclusive, not a failure.

**How the boundaries were actually chosen:** by tracing the real call graph (which function calls
which, and which touch `state` directly) before moving anything — not by section headings or
"looks dashboard-y"/"looks income-y." Things this caught:
- `totalAssetsValue`/property-equity functions looked like they belonged with Assets/Properties
  rendering (that's where they physically sat in the old file) but are pure calc needed by
  `engine.js`'s projection series and by Dashboard's stat tiles — they moved to `calc/` instead.
- `selectScenario`/`addScenario`/`renameScenario`/`deleteScenario` look like Dashboard code (the
  "Add scenario" card lives there) but call `renderHomeBody` — they ended up in `scenarios.js`,
  not `dashboard.js`, once that existed. Until then they stayed in `app.js`, same as every other
  orchestrator blocked on a not-yet-extracted page.
- `buildTable`/`rowHtml`/`periodTh`/`periodTd`/`optionsHtml` looked like "the income table's
  renderer" but are genuinely page-agnostic (`section` is just a string key) — every future
  Classic-mode component needs them, so they became `lib/ledger-table.js` rather than getting
  duplicated or creating an income→other-component import.
- **Gotcha that cost a real bug**: a component's own session-only UI state (like
  `modernIncomeRowOpen`, the open/closed map for Modern-mode rows) can be *mutated from app.js*
  even after the component owns the code that *reads* it — `app.js`'s generic
  `wireModernRowToggle(containerId, openState)` takes the map by reference and writes
  `openState[key] = ...` on click. Moving `renderIncomeGroups`/`modernIncomeRowHtml` to
  `income.js` without also exporting `modernIncomeRowOpen` produced a silent-until-runtime
  `ReferenceError` the moment a Modern row was clicked — caught by the browser smoke test, not by
  `node --check` (module syntax was fine; the bug was a missing export). When extracting a
  component, grep the *whole* `app.js`, not just the block being moved, for every `var` the moved
  code reads — session-state maps like this are the easy ones to miss since they don't look like
  "data."

**Not done yet:** nothing — the JS and CSS migrations described in this section are both complete.

**`src/styles/` split (the CSS half of the migration)**: the original 945-line `styles.css` had
no per-page structure — its `/* ---- Section ---- */` comments were mostly chronological (rules
appended as features shipped), not organized by page, so several buckets below don't map 1:1 to a
single component. Boundaries were decided pragmatically, then verified empirically (see below),
not redesigned "properly" — a page-perfect split isn't there and wasn't the goal.
- `base.css` — tokens (`:root`/dark overrides), reset, typography primitives, `.wrap`, the
  Header/buttons/actions/status-chip block, the categorical series-color palette, the shared
  chart tooltip (`.viz-tooltip`, used by both Assets and Projections), toast, `.visually-hidden`.
  Anything used broadly enough that no single page "owns" it landed here.
- `shell.css` — the app chrome matching `nav.js`: sidebar, desktop topbar, mobile tabbar/More
  panel, and their own `@media (max-width: 880px)` block.
- `ledger.css` — the generic Classic `<table>` styles, row-breakdown panels, account bars,
  section shells (`.panel`/`.section-title`/fire-bar), **and** the generic Modern-mode card/row
  system (`.m-card`/`.m-row`/`.m-avatar`/`.m-edit-grid`, shared by Income/Expenses/Properties/
  Assets/Scenarios alike) — this is the CSS counterpart to `lib/ledger-table.js`.
- `dashboard.css`, `income.css` (Tax & super only — the modern row system itself is in
  `ledger.css`), `properties.css` (home-block/property-card/purchase-calculator — covers both
  Properties *and* Scenarios' home block, since they're the same visual component), `assets.css`,
  `projections.css` — one file per remaining page-specific chunk.
- **`styles.css`'s `@import` order is load-bearing** (`base, shell, dashboard, ledger, income,
  properties, assets, projections`) — see the CLAUDE.md gotcha. Two different classes with equal
  specificity can land on the *same element* (one component composing another's CSS via a second
  class, e.g. `class="income-summary-line home-recon-line"`) and rely on **source order**, not
  specificity, to pick the winning value — exactly how a single unsplit stylesheet always worked.
  Splitting into files preserves each bucket's *internal* order for free (ranges were extracted
  verbatim, never reassembled), but a naive import order can still flip the *relative* order
  between two buckets that never had a reason to be ordered relative to each other before.
- **How this was actually caught**: a full before/after Playwright screenshot diff (every page,
  desktop+mobile, light+dark, Google Fonts requests aborted via `page.route` for determinism —
  they're blocked in this sandbox anyway, and left unblocked they add nondeterministic
  hash-level noise across runs even for byte-identical CSS) turned up one real, reproducible
  layout shift (`.home-recon-line`'s `margin-bottom` resolving to 14px instead of 10px on
  Scenarios). Found the exact culprit via `getComputedStyle` + walking `document.styleSheets` for
  every rule matching the element — turned out to be `.income-summary-line`'s `margin` shorthand
  (also 3-margin-value, includes `margin-bottom:14px`) landing later than `.home-recon-line`'s
  `margin-bottom:10px` because `properties.css` was imported before `income.css`. Fixed by
  reordering the `@import`s (income before properties). **Don't trust "no visual diff" from
  eyeballing screenshots alone** — this bug was invisible to the eye in isolation (a few px of
  card spacing) and only surfaced as a byte-level hash mismatch; the systematic pixel-diff (via a
  `<canvas>`-based per-pixel comparison, not just perceptual judgment) is what made it findable.
- **Before trusting any other reorder**: this project's static check for this class of bug —
  extract every literal `class="a b c"` string from `src/**/*.js` and `index.html`, find pairs of
  classes that (a) co-occur on the same element and (b) are each defined as a bare single-class
  CSS selector in a *different* bucket, then confirm the chosen import order preserves each
  pair's original relative line order in the pre-split `styles.css` (`git show <pre-split-tag>
  :styles.css`) — found exactly one real violation (the one above) among 15 candidate pairs.
  This only catches *literal* class strings, not dynamically concatenated ones — the empirical
  screenshot-diff pass is still the real gate, this is just how the fix was located quickly.
- **Residual pixel-level nondeterminism** (1–138 px per screenshot, always on slider thumbs or
  percentage-width bar edges — `.proj-slider::-webkit-slider-thumb`, `.rule-bar`/`.fire-bar-fill`/
  `.cap-bar-fill`) is sub-pixel antialiasing jitter, present even between two runs of the
  *identical* build — not a regression signal. Confirmed by re-running the same build twice and
  seeing it self-diff by the same small margin.

**Believed-permanent `app.js` residents** (cross-cutting by nature — dispatch or wire across every
page by a section-string key or DOM id, unlike the now-fully-extracted page-specific code; don't
expect these to move into a component later without a real reason):
`onLedgerInput`/`onLedgerClick`/`refreshAfterLedgerChange`/`getArrayForSection`/
`rerenderTableFor`/`onCalcInput`/`onCalcChange`/`onCalcClick`/`onScenarioControlClick`/
`findProperty`/`updatePersonSuggestions`/`renderTotals`/`renderGlobalMetrics`/`renderAll`/
`refreshAllUiModePages`/`renameTaxPerson`/`removeTaxPerson`, plus all DOM event *registration*
(every `addEventListener` call in the file) and the nav-menu/mobile-tabbar wiring itself (see
`nav.js` above).

## Installability (PWA)

### Getting a shipped update onto a device

Three layers sit between a merge and a phone showing new code, and only the third is ours:

1. **GitHub Pages build** — a minute or two after the merge before the files exist at all.
2. **The CDN edge.** `cache: "no-store"` stops the *browser* answering from its own cache; it says
   nothing about an intermediary. This is why the version probe fetches `index.html?v=<Date.now()>`:
   a URL nothing has requested before can't be served from an edge cache. Without the query string
   a check can be answered by a minutes-old copy, quietly conclude "no update", and then wait for
   the next one — the failure mode that looks exactly like a bug.
3. **The app's own check.** `checkForNewVersion()` compares the deployed `app-version-num` against
   the running one, on `visibilitychange`, on `focus`, every 15 minutes, and on demand via
   **Check for updates** (sidebar footer, and the mobile More panel). The manual one reports both
   outcomes — a background check that finds nothing is silent by design, but a person who just
   tapped a button and got silence can't tell that from a broken button.

The version number lives in its own `<span class="app-version-num">` because it is parsed twice:
out of the live DOM, and out of a freshly-fetched copy of `index.html`. Anything else added to that
line (the Check for updates button) would otherwise land inside the match.

Accepting the update banner does **not** just reload. It messages the worker
(`{type:"purge-and-reprime"}`), which clears its caches and immediately re-caches the shell. Both
halves matter: the version check only reads `index.html`, so a fresh shell beside a stale
`src/*.js` would reload into a new version number running old code — and a bare purge would delete
the cached shell that is the only thing making a reload work on a pushState'd path when the network
hiccups. The page reloads on the worker's reply or after a 3s timeout, whichever comes first; a
failed purge is a stale cache, which is where we already were, whereas not reloading leaves a
banner that does nothing.

Worth knowing: a first visit never caches the shell at all — that navigation happens before the
worker has control, so nothing is stored under `SHELL_URL`. Measured, not assumed.


`manifest.webmanifest` + `sw.js` + `icons/` make the app installable (Chrome's install-icon/
`beforeinstallprompt`, iOS "Add to Home Screen") and fully offline-capable, added after the JS/CSS
modularization was complete. Three requirements, all independently verified in a real browser
(not just "the files exist"): a valid manifest (name/icons/`start_url`/`display`), a registered
service worker with a `fetch` handler, served over a valid origin (HTTPS in production; localhost
is exempt).

- **Icons**: `icons/icon-192.png` and `icon-512.png` (`purpose: "any"`) are the existing favicon
  design (blue rounded square, white "W") rendered to PNG at each size via Playwright screenshot
  of an inline SVG — no separate source-of-truth asset to keep in sync, just re-render if the
  brand mark ever changes. `icons/icon-maskable-512.png` is a *different* SVG: full-bleed
  background with no rounding (Android applies its own shape mask — circle/squircle/rounded
  square depending on OEM launcher) and the "W" scaled down to fit inside the safe zone (~80% of
  the canvas), so it survives any mask without the letter getting clipped. `apple-touch-icon.png`
  reuses the maskable (full-bleed, no pre-rounding) version — iOS also applies its own squircle
  mask on top of whatever's provided.
- **Manifest `start_url`/`scope` are `"."`**, not `"/"` or `"/wealth-planner/"` — a relative URL
  resolves against the manifest file's own location, so the identical file works whether the app
  is served from domain root (local dev) or a GitHub Pages project subpath, with zero runtime
  detection needed (unlike `nav.js`'s `BASE_PATH`, which has to branch on `location.hostname`
  because it's building paths in JS, not letting the browser resolve a relative URL for it).
  Verified by copying the whole site into a `/wealth-planner/` subdirectory under a second local
  server and confirming `new URL(manifest.start_url, manifestLinkHref)` and the service worker's
  resolved `registration.scope` both land on the subpath, not root.
- **`sw.js` is network-first with cache-as-you-go** — deliberately no fixed list of files to
  precache (would need manual updates every time a component/`src/styles/*.css` file is added or
  renamed, the exact kind of hidden coupling this codebase's modularization has been trying to
  eliminate elsewhere). Every successful `fetch()` response is written into the cache as a side
  effect before being returned to the page; offline, the same handler falls back to whatever's
  cached. Cache name (`wealth-planner-cache-v1`) is versioned independently of the app's own
  semver — bump the number in `sw.js` only if the *caching strategy itself* changes in a way that
  requires wiping old cache entries, not on every release (network-first already keeps the cache
  fresh on every online visit, so there's no staleness problem the version-bump convention needs
  to solve here).
- **Client-side routing needs an explicit shell fallback, or offline reload/relaunch breaks**:
  clicking a nav tab calls `history.pushState` (see `nav.js`) without ever issuing a real network
  request for that path — so a URL like `/properties` is never actually fetched, never cached
  under its own key, and a plain per-URL `caches.match()` fallback (the "obvious" first attempt)
  produces a hard `net::ERR_FAILED` the moment you reload that URL offline, or when the OS
  relaunches an installed PWA to a remembered non-root path. This is the *offline* version of the
  already-documented "deep-link 404 on `page.reload()`" testing gotcha — except now it's a real
  runtime bug, not just a test-methodology footgun, because a real user's browser really can be
  offline. Fixed by having the fetch handler special-case `event.request.mode === "navigate"`:
  on success, also stash a copy of the response under the canonical `index.html` URL (not just the
  actual requested URL); on failure with no exact-URL cache hit, fall back to that stashed shell
  copy instead of failing. Caught by an actual offline-reload Playwright test
  (`context.setOffline(true)` + `page.reload()` on a pushState'd sub-path) — not by inspecting the
  code, which looked correct before this was found.
- **Two service-worker-specific footguns, both silent (no thrown error, just "nothing gets
  cached")** — see the two `CLAUDE.md` gotchas: (1) any cache write that outlives the synchronous
  return from a `fetch` handler must be wrapped in `event.waitUntil()`, or the browser can tear
  down the worker mid-write; (2) a same-origin request made in `no-cors` mode (which is what
  browsers use for plain stylesheet `<link>`/`@import`/font fetches, even same-origin) always
  comes back as an opaque response with `.ok === false`, so gating "should I cache this" on
  `.ok` alone silently drops every CSS/font file. Both were only caught by adding a temporary
  `console.log` inside the `fetch` handler and reading it via Playwright's
  `context.on("serviceworker", sw => sw.on("console", ...))` — `page.on("console")` does **not**
  surface a service worker's own console output, only requests made *by* the page.
- **`beforeinstallprompt` did not fire in headless Playwright testing** even with a fully valid
  manifest + activated service worker — this is a known Chrome engagement-heuristic limitation in
  headless/automated contexts, not a signal that the setup is broken. Don't chase this signal in
  this environment; verify installability by checking the manifest/service-worker requirements
  directly (as above) instead.

### App-like feel (v1.34.1–v1.34.4, after installability shipped)

Four independent, separately-shipped improvements to how the *installed* app feels to use, not
just whether it can be installed — each is its own tagged commit pair, on purpose, so any one can
be reverted without touching the others.

- **Mobile-browser tells removed** (`base.css`): `-webkit-tap-highlight-color: transparent`,
  `-webkit-touch-callout: none`, `user-select: none`, and `touch-action: manipulation` on `button`
  (plus the toggle-switch classes `.switch`/`.toggle-periods`/`.calc-enable`/
  `.calc-check-inline`) — targeting the *element*, not a long tail of individual classes, since
  virtually every clickable control in this codebase is a real `<button>` (confirmed by grep
  before relying on it, not assumed). `overscroll-behavior-y: none` on `html` stops the page-level
  pull-to-refresh/rubber-band bounce; the scrollable sub-areas that need their own independent
  scroll (`.app-sidebar`, `.mobile-more-panel`, `.table-scroll`) get `overscroll-behavior: contain`
  so their bounce doesn't chain up into the now-disabled page-level one.
- **Page-switch cross-fade** (`nav.js`'s `showPage`, `base.css`): wraps the existing DOM-toggle
  body of `showPage` in `document.startViewTransition()` when supported and
  `prefers-reduced-motion` isn't set — no manual before/after class choreography, the API
  snapshots old/new state and animates automatically. Zero fallback code: unsupported browsers
  (Firefox, older Safari) just never call it, so today's instant-swap behavior is exactly what
  they still get. Tuned `::view-transition-old(root)`/`::view-transition-new(root)`
  `animation-duration` down to `0.16s` to match this app's existing snappier hover/focus
  transitions rather than the browser's ~0.25s default. Verified by monkey-patching
  `document.startViewTransition` in a Playwright test to count real invocations on nav clicks —
  not just "the code looks right."
- **Home-screen shortcuts** (`manifest.webmanifest`): long-press the installed icon for Income &
  Tax/Expenses/Assets/Properties (Dashboard excluded — it's already the default launch target).
  URLs are relative (`"./income"`) for the same reason `start_url`/`scope` are — resolves
  correctly under both local root and the GitHub Pages subpath with no JS-side `BASE_PATH`
  handling needed, since a relative `url` in a manifest resolves against the manifest's own
  location exactly like `start_url` does.
- **iOS launch screens** (`icons/splash/*.png` + `index.html` `apple-touch-startup-image` links):
  8 images (4 device-size tiers × light/dark) — **deliberately not an exhaustive per-model
  matrix**. Apple's mechanism needs an *exact* `device-width`/`device-height`/
  `-webkit-device-pixel-ratio` match per physical screen; a device that isn't listed just shows no
  splash (a brief blank flash), never a broken one, so this was scoped to the current + one prior
  generation's common tiers rather than chasing every historical iPhone/iPad panel size. Add more
  `<link rel="apple-touch-startup-image">` tiers the same way if a specific gap turns out to
  matter in practice — same generator approach as the app icons (Playwright screenshot of an
  inline SVG: solid `background_color`-matching fill + centered brand mark), see
  `icons/splash/` generation notes in the shipping commit.
- **Swipe gestures** (`src/lib/swipe.js`'s `onHorizontalSwipe`, wired from `app.js`): the Assets
  subnav (Cash/Shares/Super/Vehicle/Other, no wraparound past either end) and Tax & Super's
  breakdown-flip cards (either swipe direction just toggles — there are only two faces, so there's
  no "which direction reveals what" to get wrong). Both gated to `max-width: 880px` — desktop
  already has the subnav buttons/flip button within easy reach, and a touch-enabled desktop
  swiping to scroll shouldn't also flip a card. `onHorizontalSwipe` ignores any touch that
  *starts* inside a `.table-scroll` element entirely (checked once, at `touchstart`, via
  `e.target.closest`) — without that, swiping a horizontally-scrollable ledger/holdings table to
  see its hidden columns would also fire the page-level gesture underneath it. Requires a
  reasonable speed (< 600ms) and a horizontal:vertical ratio favoring horizontal (`abs(dx) >
  abs(dy) * 1.5`) before firing, so it doesn't compete with the page's normal vertical scroll.
  **Testing gotcha**: dispatching a synthetic `TouchEvent` directly on the element an
  `addEventListener` delegation listener is attached to (e.g. `#taxSuperBody` itself) sets
  `e.target` to that same container — `closest()` only searches an element and its *ancestors*,
  never descendants, so a delegated handler expecting to find a descendant like
  `[data-tax-person]` will never match. Dispatch on an actual descendant of the card instead (a
  real touch's `target` is whatever's under the finger, then bubbles up) — this cost a debugging
  round-trip before being recognized as a test bug, not an app bug.
- **OS status/nav bar theming**: Android's top toolbar already matched via the two
  `<meta name="theme-color" media="(prefers-color-scheme: ...)">` tags (set to `--paper`'s light/
  dark values, matching `.app-topbar`'s own background) — no separate work needed there. Android's
  bottom system gesture/nav bar color is **not controllable** from a regular installed web app
  (no standard API outside a native Trusted Web Activity wrapper) — don't attempt to "fix" this,
  it's a platform wall. iOS's status bar is set to `black-translucent`
  (`apple-mobile-web-app-status-bar-style`) — transparent, showing the app's own background
  through it in both themes — a deliberate trade-off the user chose explicitly: Apple's mechanism
  only offers *white* status-bar icons in this mode, which read with genuinely low contrast
  against the light theme's near-white `--paper` (`#f8fafc`). The alternative (`default`, opaque
  bar) has no theme mismatch in light mode but is a jarring white stripe over the dark theme; a
  third option (opaque but theme-switching between `black`/`default`) isn't supported — iOS reads
  this meta tag once at launch, it can't be changed live to track `prefers-color-scheme`. Requires
  `viewport-fit=cover` on the `<meta name="viewport">` tag to actually take effect — without it,
  every `env(safe-area-inset-*)` in the CSS silently resolves to `0` (content is confined to the
  safe area automatically instead, so there's nothing to inset for) — this also means the
  pre-existing `env(safe-area-inset-bottom)` padding on `.mobile-tabbar`/`.toast-wrap` was already
  correct code, just inert until now. Added matching `padding-top: env(safe-area-inset-top)` to
  the mobile `.app-sidebar` (the actual top-of-viewport sticky element) so its content clears the
  now-transparent status bar/notch — verified this doesn't change anything on a non-notched
  device (`env()` resolves to `0`, so it's the exact same `10px` as before).
- **App mark redesign — geometric "W", not a system-font letter (went through two rounds)**:
  round 1 shipped three ascending bars (no letterform at all); the user tried it live and called
  it "not good enough, a bit ugly," so it was replaced, not patched. Round 2 rendered five fresh
  concepts (pill-shaped bars on a gradient, a bold up-arrow, a coin-with-arrow, this geometric W,
  and a flat-color bars variant) — the user picked the geometric W. It's a hand-drawn path (`M8 11
  L11.5 21 L16 14 L20.5 21 L24 11`, one continuous stroke, `stroke-width:3`, round caps/joins), not
  a font character — the whole reason the very first version (pre-any-redesign, an Arial "W" text
  node) needed replacing at all was that a system font doesn't stay crisp/consistent at every icon
  size, and a custom-drawn path does. Applied identically everywhere: favicon, `.app-brand-mark`
  (sidebar — the `<span>` still provides the rounded-blue-square *container* via
  `background:var(--brass)`; only the inline `<svg>` glyph inside changed), all PWA icons, the iOS
  launch screens, and `#appLoading` (below). **Takeaway for next time a shipped design gets
  rejected**: don't iterate on the same concept — render several genuinely different directions
  side by side and let the user pick, same as both rounds here did.
- **In-app animated loading screen** (`#appLoading` in `index.html`, hidden by a hook at the end
  of `app.js`'s init IIFE): distinct from — and the *only* animatable option, given — the native
  OS-level PWA splash/launch screen, which is a static image the OS paints before a single byte of
  this app's JS or CSS has run and **cannot** be animated by any web-standard mechanism. This is a
  separate, in-page overlay: the same W mark, animated as a continuously-traveling dash along the
  path (`stroke-dasharray: 12 26` — a 12-long visible segment, everything else gap — animating
  `stroke-dashoffset` linearly to `-38`, looping), like the line is perpetually being drawn. The
  page paints it immediately and `app.js` fades it out once `renderAll()`/`showPage()` have
  actually finished building the real UI — not on a fixed timer, so it's up for exactly as long as
  real init takes and no artificial delay is ever added. **Its CSS is inline in `index.html`, not
  in `styles.css`/`src/styles/*.css`** — deliberately: it has to be visible before the external
  stylesheet's 8-file `@import` chain (a separate network round-trip) resolves, or there's nothing
  to show during precisely the gap it exists to cover. Respects `prefers-reduced-motion`
  (`stroke-dasharray: none` — full solid mark, no animation at all, not just a shorter one).
  **Real dash-animation bug caught only by looking at a mid-animation screenshot, not by reading
  the code**: the first attempt used `stroke-dasharray: 40` (roughly the ~37.8-long path, dash =
  gap = 40) with a `0 → 0 → ±40` back-and-forth keyframe. At exactly `dashoffset: 40` — precisely
  one full dash-cycle — the pattern shifts by exactly one dash-width, which lands the *entire*
  path inside the gap phase: the mark blinks completely invisible at both animation extremes, only
  briefly visible near the 50% keyframe. Code review alone wouldn't catch this (the logic "looks"
  right); a CDP-throttled-network Playwright test (`Network.emulateNetworkConditions`) sampling
  several real frames mid-animation showed a plain blue square with no mark at all. Fixed with the
  shorter-dash-longer-gap "traveling segment" pattern described above, which is never fully hidden
  by construction (the dash is always shorter than the full path, so some part of it is always
  within the path's length) — the general lesson: verify a CSS animation by actually sampling
  frames of it, not by eyeballing the keyframe math.

## Business-logic assumptions (all approximate — the app says so in-UI, keep it that way)

- **AU tax brackets** (`constants.js: AU_TAX_BRACKETS`) are stage-3 2024-25 rates. Indexed/changed
  by policy — revisit periodically. No HECS/HELP, no Medicare levy surcharge modeled.
- **Medicare levy** (`tax.js: medicareLevyAU`) — low-income shade-in thresholds are approximate
  and indexed yearly.
- **Division 293** (`tax.js`, inside `computePersonTax`) — simplified to taxable income + low-tax
  concessional contributions vs. the $250k threshold; doesn't model reportable fringe benefits or
  net investment losses.
- **Maximum Super Contribution Base** (`constants.js: MAX_SUPER_BASE`) — one annual ceiling under
  the "Payday Super" reform (effective 1 July 2026), applied once per person across all their
  Gross income rows combined (not per-row, not per-employer — this app doesn't model separate
  employers). Indexed each financial year.
- **Stamp duty** (`calc/property.js`) is only modeled precisely for NSW and VIC
  (`constants.js: STAMP_DUTY_BRACKETS`, `FHB_RULES`); other states return `null` from
  `standardStampDuty()` and the UI falls back to a manual entry field. Don't silently extend this
  to "estimate" other states without flagging it clearly as an estimate in the UI.
- **LMI** (`calc/property.js: calcLMI`, `constants.js: LMI_BANDS`) is an indicative flat-band
  estimate — real premiums are lender/insurer-specific. Mechanically correct: `0` at ≤80% LVR,
  tiered by LVR band above that, calculated on the *loan amount* (matching real-world convention,
  not the property price).
- **LMI can be paid upfront (cash at settlement) or capitalized into the loan** — a per-scenario
  toggle (`cfg.lmiCapitalized`, default `false` — unchanged behavior unless the user turns it on),
  since real lenders default to capitalizing it (adding it to the loan balance/repayments) rather
  than requiring cash on top, which defeats much of the point of a low-deposit loan; the app
  originally only modeled the upfront-cash path. `recalcPurchase()` in `calc/property.js` returns
  both `loanAmount` (the base, pre-LMI figure — always what LVR is measured against, since real
  lenders price the premium off the LVR *before* adding it, not after) and `loanBalance` (what
  repayments are actually calculated on — equals `loanAmount` unless capitalized, in which case
  it's `loanAmount + lmi`). `upfrontCash` excludes `lmi` when capitalized. UI elements affected by
  this toggle (`[data-out="lmicapwrap"]` the checkbox itself, `[data-out="loanlmicap"]` the "+ $X
  capitalized = $Y" note under Loan amount, `[data-out="upfrontwrap"]`'s tooltip) are **always
  rendered, visibility toggled via inline `style.display`, not conditionally omitted from the
  initial HTML** — deliberately, so `patchCalcOutputs()` (the per-keystroke patch path used while
  typing Price/Deposit — see the "scoped-rebuild" pattern in the Modern-mode section below) can
  show/hide them live as LVR crosses the 80% threshold, without needing a full `renderHomeBody()`
  that would drop focus mid-keystroke. Don't use the `hidden` attribute for this kind of
  toggle-by-JS visibility here — `.calc-check-inline`/`.calc-out` both set their own `display`,
  which (per the root CLAUDE.md's `[hidden]` gotcha) silently wins over the browser's built-in
  `[hidden]{display:none}` regardless of specificity.
- **Transfer Fee / Mortgage Registration Fee** (`constants.js: TRANSFER_FEE_BY_STATE`,
  `MORTGAGE_REG_FEE_BY_STATE`) — flat statutory land-registry lodgement fees, NSW/VIC-precise same
  scope as stamp duty, `Other` a generic estimate. Unlike every other `otherCosts` row (which are
  free-text, user-owned, never auto-touched), these two are the one pair that **auto-resyncs to
  the new state's figure whenever the State dropdown changes** (`app.js`'s `onCalcChange`,
  matched by exact `what` label) — deliberately different from e.g. Conveyancing, since these are
  fixed government fees with no legitimate reason for a user to want a different number than
  whatever their state currently charges, unlike genuinely variable/negotiated costs. Renaming a
  row (e.g. to "Transfer Fee (custom)") exempts it from the auto-resync, same as any other row —
  verified this exact behavior (rename → survives a state change; leave the label alone → syncs,
  even overwriting a manually-typed amount) in the browser, not just by reading the code.
- **Negative gearing / tax refund timing** (`tax.js: computePersonTax`) — this is the one most
  worth understanding before touching: `netTakeHome` folds a property's tax effect (loss or
  profit) evenly across the year, but that's not how it actually arrives unless the person has an
  active PAYG withholding variation — by default it's a lump sum after lodging a return.
  `payslipTakeHome` (tax computed as if the property's result were zero) and `ipTaxEffect`
  (`netTakeHome - payslipTakeHome`) exist specifically to surface that gap in
  `personBreakdownHtml()` (the "▸ Breakdown" / flip-card view), **additively** — the existing
  `netTakeHome` figure used everywhere else (Dashboard, Scenarios affordability) is deliberately
  left untouched. If asked to make the rest of the app "cash-flow accurate," that's a bigger,
  separate decision (would need a real "how is this refund actually received" setting) — don't
  fold it in casually.
- Loan interest-only vs P&I, offset accounts, rate-shock stress test, property equity/gearing —
  see the doc comments directly above each function in `calc/property.js`; they're dense but
  current and explain the "why," not just the "what."

## Modern-mode UI patterns (established over many rounds — follow these, don't reinvent)

- **Page header hierarchy is three tiers, and only one of them is navigation.** In order down the
  page: the page intro plus a single `⋯` (`.page-overflow`) holding rare actions like Export/Import
  CSV; then `.subnav`, the tab rail; then any filter, as a `.filter-chip` reading `Showing <X> ▾`
  that opens a sheet. Two of these looking alike is the failure mode — Assets once had the subnav
  and the person filter as two adjacent rows of identical pills, told apart only by a border, and
  neither read as "the tabs".
- **`.subnav` is a scrollable underlined tab rail, never wrapping pills.** The full-width hairline
  on `.subnav` is what makes it read as navigation before any label is read; `flex-wrap:nowrap` +
  `overflow-x:auto` is what stops six Assets categories wrapping so "Other" lands alone on a second
  line. There is deliberately **no edge gradient**: a clipped tab is the scroll affordance, and a
  static fade would lie on the two-tab rails (Dashboard, Expenses, Accounts) that never overflow.
  `.subnav-item` must re-declare `border-bottom` *after* `all:unset` (which strips it), transparent
  on inactive tabs so the active underline doesn't shift its neighbours.
  Because the rail scrolls, every `show<X>Subpage()` calls `scrollActiveSubnavIntoView()` — a tab
  can be active but off-screen when a page is entered rather than tapped (a deep link to
  `/assets/other`, a restored route).
- **Four control vocabularies, and they are not interchangeable.** Reaching for whichever one
  looks right is how the Assets page ended up with three near-identical pill rows:
  | Class | Means | Where |
  |---|---|---|
  | `.subnav` / `.subnav-item` | page navigation | the four page rails, **nothing else** |
  | `.filter-chip` | a filter whose options live in a sheet | `Showing <person> ▾` |
  | `.chip-row` / `.chip` | a filter applied in place, several plausibly tried | Shares winners/losers |
  | `.seg-control` / `.seg-option` | one mutually-exclusive fixed set | Shares change window |
  `.subnav` is navigation *only* — the Shares card's two filter rows used to borrow it purely for
  the pill look, which became visibly wrong the moment `.subnav` grew a hairline and an active
  underline and they started rendering as tab rails inside a card. A segmented control reads as one
  control rather than N buttons because of its shared sunken track, so it scrolls inside itself
  rather than wrapping; `--paper-raised` is lighter than `--paper-sunken` in both themes, so the
  active thumb needs no per-theme override.
- **A control you change occasionally belongs in a sheet, not a row of its own.** Reuse the
  `.review-backdrop` / `.review-panel` shell (quick-log, quick actions, expense review, asset
  person filter all share it) and register with `pushActiveOverlay` so the device back button
  closes it. `.qfab-action` rows carry `.is-selected` when the sheet presents a *choice* rather
  than a list of actions.

- **`modernPlainRowHtml(item, idx, section, openState, opts)`** — the generic "name + amount,
  expands to a small field grid" row, shared by Properties' income/expense lists, Expenses'
  shared groups, and Scenarios' recurring-costs list. `opts.showClass` toggles a Classification
  field; `opts.primaryId` bolds one specific row (e.g. the home loan row); `opts.colorIdx`
  (optional) adds a colored identity dot — pass it only from call sites that also render a
  composition bar (see below), so unrelated pages don't pick up dots they don't need.
- **Session-only open/closed-state maps**, one per modernized list (e.g. `modernIncomeRowOpen`,
  `modernPropRowOpen`), keyed by `section + ":" + idx` — never by bare index, since one container
  can hold rows from several separately-indexed arrays (e.g. Properties, where each property's
  own income/expense arrays share one open-state map). These are **not persisted** — intentional,
  it's UI state, not data.
- **Composition bar + colored dot** — a row gets a colored dot (`series-color-0` through `-7`,
  cycling), and the card gets a thin composition bar showing each row's share of the total, when
  a card has 2+ non-computed contributing rows. Computed/synthetic rows never get a dot or join
  the bar (would double-count or represent something the user didn't directly enter). Established
  independently for Income, Properties' Loans, every Assets category, and Scenarios' recurring
  costs — each with its own small `xRowMeta()` + `modernXCompBarHtml()` pair, not a shared
  abstraction, because the "what counts as the total" question differs slightly each time.
- **Progressive disclosure** — a `<details class="tax-advanced m-more-options"><summary>More
  options</summary>...` wraps secondary fields when a row's edit grid would otherwise have too
  many fields at once (Loans, Shares holdings). Threshold is a judgment call, not a fixed field
  count — used for ~7+ fields, not for simple 3-field rows (Cash/Super/Other assets).
  the shared `.rb-secondary`/`.calc-note` styling for muted/secondary figures inside a breakdown
  is the same idea applied to display, not just editing.
- **Scoped-rebuild functions** (`renderPropListModern(propId, section, items, showClass)`,
  `renderHomeListModern(scenario, i)`, etc.) rebuild *one specific list's container* rather than
  the whole page. Necessary because some edits trigger a sibling list's re-render as a side
  effect (e.g. typing rent recalculates a Property Manager Fee expense row; typing a purchase
  price re-syncs the Home Loan row) — a full-page re-render would destroy focus mid-keystroke in
  the field the user is actually typing in.
- **`state.uiMode` is global, consolidated to one control per device class** — desktop: a single
  "Modern layout" switch in the sidebar (styled like "Show all periods" right below it); mobile: a
  single cycling "Layout: Classic/Modern" button inside the bottom tab bar's "More" panel. There
  used to be five duplicate per-page segmented toggles (one per page); they were removed
  entirely, not just hidden, once consolidated. Any code path that changes `state.uiMode` must
  call both `refreshAllUiModePages()` (re-renders every modernized page) and `syncUiModeToggle()`
  (syncs both toggle controls' visual state + hides classic-only pickers like the Columns
  dropdown) — missing either one leaves some page/control stale.
- **Mobile nav** — a fixed bottom tab bar (Dashboard/Income/Expenses/Assets/Properties direct,
  Scenarios/Projections behind a "More" popup) replaced an earlier hamburger-dropdown pattern.
  Utility actions that used to live in the desktop-only topbar (Theme/Import/Export/Sample
  data/Reset), plus "Show all periods" and the "Modern layout" toggle, all live in that same
  "More" panel on mobile. Rather than duplicating their logic, the mobile buttons **forward
  clicks to the real desktop buttons** (`document.getElementById("themeToggleBtn").click()`,
  etc.) — except checkbox-style controls (Show all periods, Modern layout), which mirror via
  plain `.checked` assignment on `change` instead (see the CLAUDE.md gotcha about
  `preventDefault()` on checkboxes — forwarding via `.click()` + `preventDefault()` does *not*
  work for checkboxes the way it does for buttons).
- **Per-section CSV export** (Income/Expenses/Assets/Properties-loans) reuses the JSON backup's
  existing download pipeline (`finishExport`/`shareExport`/`fallbackExport` — mobile share sheet
  with a desktop direct-download fallback), generalized to take a `mime` type and toast message
  instead of hardcoding JSON's. Export-only; there's no matching CSV *import* — that's a
  deliberately separate, harder problem (column mapping, type coercion, merge-vs-replace
  semantics), not yet scoped.
- **Fresh state defaults to Modern on a mobile-sized viewport** (`<880px`, same breakpoint the
  CSS uses everywhere), Classic on desktop — both in `defaultState()` and in `migrateState()`'s
  fallback (which is what "Sample data" actually goes through, since `generateMockData()` never
  sets `uiMode` itself). A *returning* user's own explicit choice is never overridden regardless
  of device.
- **Editing a Modern-row's name must patch `.m-row-name`, not just state** — every "what"-field
  input handler (`f-what` in the shared `onLedgerInput`, `a-what`/`h-what`/`v-what` in the Assets
  input handler, `loan-what` in the Properties loan handler) had the identical gap: it updated
  the underlying item/state correctly but only ever patched the row's *amount* output
  (`[data-computed="amt"]`), never the collapsed summary's own name label. All three now also do
  `tr.querySelector(".m-row-name").textContent = item.what`. If a new "what"-style field gets
  added anywhere with this row-summary/edit-panel split, remember this patch — it's easy to
  reproduce the same gap since the amount-only patch is the existing pattern to copy from.
- **`.home-block-head`/`.home-block-head-left` are, confusingly, reused as plain class names by
  Properties' own (non-interactive, no-collapse) card header** — a CSS rule or JS behavior meant
  only for Scenarios' collapsible `.home-block` must be scoped via `.home-block > .home-block-head`
  (or an `#homeBody` ancestor), never the bare class, or it silently bleeds onto Properties cards
  too. Found and fixed exactly this leak while making the Scenarios collapse header fully
  clickable (previously only the small chevron `<button>` toggled collapse, unlike every other
  page's "click anywhere on the row" Modern-row pattern) — the fix moved `data-collapse-toggle`/
  `role="button"`/`tabindex` onto the whole `.home-block-head` div, which required reordering
  `onScenarioControlClick`'s checks (`data-rename`/`data-delete`/`data-edit-scenario2` — all
  *nested inside* that now-clickable header — must be checked before the generic collapse-toggle
  catch-all, not after, or they'd never be reachable) and adding a `keydown` handler for Enter/
  Space (free before, since it used to be a real `<button>`).
- **Two real spacing bugs found by measuring actual pixel gaps between siblings, not by
  eyeballing a screenshot**: `.home-recurring-label`'s bottom margin was `2px` against a
  consistent ~10-14px rhythm everywhere else on the page (fixed: `2px 0 10px`), and `.calc-note`
  (a `<p>`) was the one child of `.calc-body` (a flex column with its own `gap:14px`) still
  carrying the browser's unset default paragraph margin, stacking an extra ~11px on top of that
  gap instead of relying on it like every sibling does (fixed: `margin:0`, not "add a matching
  margin" — that was the wrong first fix, confirmed wrong by re-measuring rather than assuming a
  similar-looking number was correct). The general method that found both: walk every parent's
  direct children in the live DOM, compute `nextRect.top - prevRect.bottom` for each consecutive
  pair, and look for outliers against the surrounding values — far more reliable than visual
  inspection for "this gap looks off" complaints, and immune to being fooled by intentional
  negative margins used elsewhere for fine-tuning (e.g. `.calc-outputs-label`/`.calc-costs-title`
  both deliberately use small negative bottom margins — don't "fix" those without reason).

## Testing / dev workflow

There's no test framework or CI. Verification throughout this project's history has meant: serve
the app locally, drive it with a real installed Chrome via Playwright, and actually look at
screenshots or query computed DOM state — not just read the code and assume it works. The
recurring working pattern:

```js
const { chromium } = require('playwright-core'); // `npm install playwright-core` in your scratchpad if not already present — it's a thin driver, no browser download
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // confirmed present; falls back to `npx playwright install chromium` (downloads its own browser) if a real Chrome isn't found
  args: ['--no-sandbox'],
});
```

- Serve via `python3 -m http.server <port>` from the repo root first — required now that
  `src/app.js` is an ES module (`file://` won't work).
- `page.on('dialog', d => d.accept())` — several actions (`Reset`, `Sample data`, encrypted
  export) use native `confirm()`/`prompt()`.
- Click `#mockDataBtn` (desktop) or the mobile More panel's `#mobileSampleDataBtn` to populate
  realistic data before testing anything that needs content.
- Several `uiMode`-related selectors are **global**, not scoped to one page — e.g. multiple
  `[data-uimode="modern"]`-style elements can exist if old test habits assume the removed
  per-page toggles; use `#uiModeToggleWrap` (desktop) or `.mobile-tab`/`#mobileLayoutBtn`
  (mobile) instead.
- `persist()` debounces writes by 300ms — a test that clicks something, then immediately
  reloads/navigates to check persistence, needs to wait past that or the write never happens.
- **Don't use `page.reload()` after the app has navigated client-side** (clicking a tab pushes a
  URL like `/properties` via `history.pushState`, with no matching file on a plain
  `http.server`). A real reload of that URL 404s — looks like a persistence bug, isn't one. Use
  `page.goto()` back to `/` instead to test a fresh load/localStorage round-trip.
- A one-time key-backfill diff is expected between the *first* load after generating sample data
  and the *next* fresh load: `migrateState()` backfills fields like `sacrificeMode`/`superMode`
  onto every `income[]` row that lacks them, including synthetic rows `recalcComputedItems()` just
  created (which don't set those fields) — settles after one more load. Not a regression signal.
- Write throwaway scripts/screenshots to the session scratchpad directory, never inside the repo.
- When a bug might be CSS-cascade-related, write a quick `getComputedStyle()` probe rather than
  guessing from a screenshot — this project's real bugs were consistently found that way, not by
  eyeballing (see the CSS gotchas in the root CLAUDE.md).

## Known pending work

The agreed build order lives in [`ROADMAP.md`](ROADMAP.md), with a status marker per item — check
there first. Items 1 and 2 — the two **corrections** — have shipped (v2.76.0, v2.77.0): the FI
panel no longer counts super and the family home toward a number you can't draw 4% from, and the
projection now reports in today's dollars, grows income, lets rows end, and charges a renting
scenario its rent. What's left is **capability**: no spending view compares you against your own
past (**done**, v2.78.0); scenarios can't vary income; then financial-year support, then tax
(HECS first).

(The service-worker registration bug found while building item 3 was fixed in v2.78.1 — see
"Reaching a file next to index.html" above.)

One thread deliberately left open from item 2: income rows have recorded pay changes since
v2.74.0 (`item.history`), and nothing reads that history back to suggest an income growth rate.
The field exists now, so that suggestion is cheap.

**Touch-target sizing** (fixed, v1.42.2): the edit (✎) / delete (✕) `.icon-btn` pair used on
Scenarios/Dashboard/Income cards sat only ~2px apart — a low tap on "edit" could land on
"delete". Bumped `.icon-btn` to 32x32px with a 6px `.card-controls` gap / 8px `.m-edit-actions`
gap (the latter was actually 0px, unset — worse than the 2px first measured, and the same
container the per-scenario-expense "⇄ Vary" button landed in next to Delete without a gap during
the Scenarios expansion work), plus padding on three `all:unset` text-link toggles
(`.row-breakdown-toggle`, `.calc-hint-link`, `.tax-advanced summary`) that previously had only
their text's own line-height as a tap target.

## Versioning (repeated from CLAUDE.md — important enough to say twice)

Every shipped change gets: (1) its own functional commit, (2) a separate "Bump version to
vX.Y.Z — reason" commit that updates `<p class="app-version">` in `index.html` (Minor for
features/behavior changes, Patch for bug fixes), (3) an annotated git tag `vX.Y.Z`, (4) both
pushed to `origin`. Do this without being asked, every time.
