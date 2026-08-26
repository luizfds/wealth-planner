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
(each with `loans[]`, `income[]`, `expenses[]`), `projection` (horizon/rates), `tax` (super
guarantee rate, per-property IP ownership split, per-person settings).

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
`projections`, `scenarios`) plus `nav.js`. `app.js` is down to ~1,450 lines from the original
4,618 — DOM event wiring/delegation, the purchase-calculator and ledger-table generic handlers,
CSV export, encrypted backup, and a handful of genuinely cross-cutting helpers (`findProperty`,
`getArrayForSection`, `rerenderTableFor`, `updatePersonSuggestions`, `renderTotals`, `renderAll`,
`refreshAllUiModePages`). What's left in `.claude/PROJECT_KNOWLEDGE.md`'s "Not done yet" below is
`lib/backup.js` and the CSS split.

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

**Not done yet**, in the planned order:
1. `src/lib/backup.js` (export/import/CSV/Web Crypto encrypted backup) — last remaining lib
   extraction, since components would depend on it. (`src/lib/charts.js` was done much earlier
   than planned — pulled forward since Assets needed it immediately.)
2. Matching `styles.css` split into per-component files + `@import`, alongside each JS move.

**Believed-permanent `app.js` residents** (cross-cutting by nature — dispatch or wire across every
page by a section-string key or DOM id, unlike the now-fully-extracted page-specific code; don't
expect these to move into a component later without a real reason):
`onLedgerInput`/`onLedgerClick`/`refreshAfterLedgerChange`/`getArrayForSection`/
`rerenderTableFor`/`onCalcInput`/`onCalcChange`/`onCalcClick`/`onScenarioControlClick`/
`findProperty`/`updatePersonSuggestions`/`renderTotals`/`renderGlobalMetrics`/`renderAll`/
`refreshAllUiModePages`/`renameTaxPerson`/`removeTaxPerson`, plus all DOM event *registration*
(every `addEventListener` call in the file) and the nav-menu/mobile-tabbar wiring itself (see
`nav.js` above).

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
  estimate — real premiums are lender/insurer-specific.
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

- **Touch-target sizing** (found by an audit, not yet fixed): the edit (✎) / delete (✕)
  `.icon-btn` pair used on Scenarios/Dashboard/Income cards sit only ~2px apart — a low tap on
  "edit" can land on "delete". Same issue, smaller severity, for Assets' modern-card "Log"/
  "Delete" text links (zero gap) and a few `all:unset` text-link toggles rendering at 13-20px
  tall (`.row-breakdown-toggle`, `.calc-hint-link`, `.tax-advanced summary`). Fix is a handful of
  CSS changes (bump `.icon-btn` size + `.card-controls`/`.m-edit-actions` gap, add padding to the
  three text-link classes) — they're shared components, so each fix resolves every instance at
  once.

## Versioning (repeated from CLAUDE.md — important enough to say twice)

Every shipped change gets: (1) its own functional commit, (2) a separate "Bump version to
vX.Y.Z — reason" commit that updates `<p class="app-version">` in `index.html` (Minor for
features/behavior changes, Patch for bug fixes), (3) an annotated git tag `vX.Y.Z`, (4) both
pushed to `origin`. Do this without being asked, every time.
