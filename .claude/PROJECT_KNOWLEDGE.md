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

(none currently — the touch-target sizing issue below was fixed in the v1.42.2 UX pass.)

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
