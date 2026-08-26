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
- `styles.css` — one stylesheet, light/dark via CSS custom properties + `prefers-color-scheme`.
- `src/app.js` — the entry point (`<script type="module">`). Still owns most DOM rendering, event
  wiring, and page-specific logic — components are being carved out of it one page at a time (see
  "Modularization progress" in `.claude/PROJECT_KNOWLEDGE.md` for exactly how far that's gotten).
  Imports everything else it needs.
- `src/state.js` — `state` (the single source of truth), `defaultState()`, `migrateState()`
  (schema migration + safe defaults for old/partial saves), `persist()` (debounced localStorage
  write), `setStatus()`.
- `src/calc/{ledger,property,tax,engine}.js` — pure financial math, no DOM access. `ledger.js`
  (period conversions, sums), `property.js` (stamp duty, LMI, loan repayments, gearing, equity —
  `propertyEquityToday()` and friends), `tax.js` (AU income tax/Medicare, super contribution caps,
  Division 293), `engine.js` (net-worth projection series, `totalNetWorthValue()`, the "recompute
  all derived/synthetic rows" pass).
- `src/components/` — one file per page, each exporting its `render*()` functions for `app.js` to
  import and wire up. Extraction is incremental and in call-graph order (see
  `.claude/PROJECT_KNOWLEDGE.md`); `dashboard.js`, `income.js`, `expenses.js`, `assets.js`, and
  `properties.js` exist so far. Not every function on a page moves — one that also depends on an
  un-extracted page (e.g. `renderAssets()` needs Projections' `renderProjectionOutputs()`) stays
  in `app.js` and calls the component's exports instead of the other way around.
- `src/constants.js`, `src/lib/{format,toast,html,uimode,ledger-table,charts}.js` — static data
  tables and dependency-free utilities used across everything above: currency/percent formatters,
  toasts, `escapeAttr`, the global Classic/Modern toggle sync, the generic Classic/Modern-mode row
  and `<table>` renderers (`buildTable`/`rowHtml`/`modernPlainRowHtml`) shared by every ledger
  page, and the hand-rolled SVG line chart (`renderLineChart`).

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

## Testing conventions

- No test framework — verification is done by actually driving the app (Playwright + real Chrome
  against the http.server above), screenshotting, and reading the DOM/console. See
  `.claude/PROJECT_KNOWLEDGE.md` for the exact working setup and scratchpad conventions.
- Prefer checking computed styles/behavior over eyeballing when a bug might be CSS-cascade-related
  — several real bugs in this project were only found via `getComputedStyle()` audits, not visual
  inspection.
