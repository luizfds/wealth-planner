# Wealth Planner

A single-page Australian personal finance / property-investment planner. No backend, no build
step — a static site (`index.html` + `styles.css` + ES modules under `src/`) that persists
everything to `localStorage` in the browser. Deployed via GitHub Pages.

For the full detail behind every point below — business-logic assumptions, the complete gotcha
list with explanations, established UI patterns, and what's still pending — see
[`.claude/PROJECT_KNOWLEDGE.md`](.claude/PROJECT_KNOWLEDGE.md). This file is the short version.

## Architecture

- `index.html` — all markup for every page/section (Dashboard, Income & Tax, Expenses, Assets,
  Properties, Scenarios, Projections). Pages are `<section class="app-page" id="page-...">`,
  shown/hidden via `showPage()`, not separate documents.
- `styles.css` — just eight `@import` statements pulling in `src/styles/{base,shell,dashboard,
  ledger,income,properties,assets,projections}.css`, in that specific order. Light/dark theming is
  CSS custom properties + `prefers-color-scheme`, defined in `base.css`.
  **Import order is load-bearing, not cosmetic** — several classes with equal specificity are
  combined on the same element (e.g. `class="income-summary-line home-recon-line"` in
  `scenarios.js`) and rely on source order to resolve which value wins, exactly as the original
  monolithic file did. Moving one `@import` line before another can silently flip such an
  override. Before reordering, re-run the cross-bucket conflict check described in
  `.claude/PROJECT_KNOWLEDGE.md`'s "Modularization progress" section.
- `src/app.js` — the entry point (`<script type="module">`), ~1,275 lines (down from the original
  4,618-line monolith). All seven pages' rendering/routing and export/import/backup have moved to
  `src/components/`/`src/lib/backup.js`; what's left is DOM event wiring/registration, the
  purchase-calculator glue, and cross-cutting dispatch helpers (`rerenderTableFor`,
  `getArrayForSection`, `findProperty`, `updatePersonSuggestions`, `renderAll`,
  `refreshAllUiModePages`) that route by a section-string key across every page and are expected
  to stay here permanently — see "Modularization progress" in `.claude/PROJECT_KNOWLEDGE.md` for
  the full list of functions deliberately pinned to `app.js` for good, not just for now. Both the
  JS and CSS splits (see above) are now complete — the ES-modules migration is done.
- `src/state.js` — `state` (the single source of truth), `defaultState()`, `migrateState()`
  (schema migration + safe defaults for old/partial saves), `persist()` (debounced localStorage
  write), `setStatus()`.
- `src/calc/{ledger,property,tax,engine}.js` — pure financial math, no DOM access. `ledger.js`
  (period conversions, sums), `property.js` (stamp duty, LMI, loan repayments, gearing, equity —
  `propertyEquityToday()` and friends), `tax.js` (AU income tax/Medicare, super contribution caps,
  Division 293), `engine.js` (net-worth projection series, `totalNetWorthValue()`, the "recompute
  all derived/synthetic rows" pass).
- `src/components/{dashboard,income,expenses,assets,properties,projections,scenarios,nav}.js` —
  one file per page (plus `nav.js` for routing/page-switching), each exporting its functions for
  `app.js` to import and wire up. Not every function that "belongs" to a page lives in its
  component — `renameTaxPerson`/`removeTaxPerson` (Income) and `showAssetsSubpage` (Assets)
  turned out to be cross-cutting routing/dispatch code and stayed in `app.js`/moved to `nav.js`
  instead. DOM event *registration* (every `addEventListener` call) also stays in `app.js` for
  every component, `nav.js` included — only the callable render/patch/routing logic moved.
- `src/constants.js`, `src/lib/{format,toast,html,uimode,ledger-table,charts}.js` — static data
  tables and dependency-free utilities used across everything above: currency/percent formatters,
  toasts, `escapeAttr`/`slug`, the global Classic/Modern toggle sync and period/column-visibility
  sync, the generic Classic/Modern-mode row and `<table>` renderers
  (`buildTable`/`rowHtml`/`modernPlainRowHtml`) shared by every ledger page, and the hand-rolled
  SVG line chart (`renderLineChart`).
- `src/lib/backup.js` — JSON backup export/import (with optional Web Crypto passphrase
  encryption) and per-section CSV export. `applyImportedBackupJson` stays in `app.js` since it
  calls the permanent-resident `renderAll()`.
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
2. Bump `<p class="app-version">vX.Y.Z</p>` in `index.html` — **Minor** (`v1.X.0`) for a new
   feature/behavior change, **Patch** (`v1.0.X`) for a bug fix — in a separate commit titled
   `Bump version to vX.Y.Z — <short reason>`.
3. `git tag -a vX.Y.Z -m "<short reason>"`.
4. Push both `main` and the tag.

Do this for every shipped change, without being asked. This is a strong, explicit standing
preference — not optional polish.

## Running it locally

```
python3 -m http.server 8934   # from the repo root
```

Then open `http://localhost:8934/index.html`. A real browser (Playwright + an installed Chrome,
not the bundled Chromium) is the standard way to drive/verify UI changes in this repo — see
`.claude/PROJECT_KNOWLEDGE.md` for the exact pattern used throughout this project's history.

## A few things that will bite you

- **`state.uiMode` is one global setting**, not per-page, even though it affects five different
  pages' rendering. Changing it anywhere must call `refreshAllUiModePages()` and
  `syncUiModeToggle()` together, or other pages go stale.
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

- No test framework — verification is done by actually driving the app (Playwright + real Chrome
  against the http.server above), screenshotting, and reading the DOM/console. See
  `.claude/PROJECT_KNOWLEDGE.md` for the exact working setup and scratchpad conventions.
- Prefer checking computed styles/behavior over eyeballing when a bug might be CSS-cascade-related
  — several real bugs in this project were only found via `getComputedStyle()` audits, not visual
  inspection.
