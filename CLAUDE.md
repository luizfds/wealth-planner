# Wealth Planner

A single-page Australian personal finance and property-investment planner. No backend and no build step: `index.html`,
`styles.css` and ES modules under `src/`, persisting to `localStorage` in the browser, deployed by GitHub Pages.

- **Why it's built this way:** [`docs/decisions/`](docs/decisions/README.md), one short record per decision.
- **What lives where:** [`docs/architecture.md`](docs/architecture.md).
- **Business rules, history and older gotchas:** [`.claude/PROJECT_KNOWLEDGE.md`](.claude/PROJECT_KNOWLEDGE.md).
- **Before starting new work, read [`.claude/ROADMAP.md`](.claude/ROADMAP.md)** — the agreed build order, with a
  status per item. Flip an item to `[~]` in the *first* commit of the work, so two sessions can't pick up the same one.

## The shape of it

- `index.html` holds every page's markup; `showPage()` (`components/nav.js`) shows one. Home · Cash flow · Net worth ·
  Tax · Plan, plus Reports, Settings, Calculators and a Details page — see docs/architecture.md.
- `src/app.js` only starts the app. Every listener lives in a page's wiring module (`components/*wiring.js`, `rows.js`,
  `redraw.js`…), called from app.js in the order listeners have always been added. Nothing imports app.js
  ([0008](docs/decisions/0008-app-js-is-a-bootstrap.md)).
- `src/state.js`: `state` is the single source of truth ([0003](docs/decisions/0003-local-first-data.md)). `src/calc/` is
  pure financial maths, no DOM ([0011](docs/decisions/0011-one-place-for-each-sum.md)). `src/components/` renders,
  `src/lib/` holds dependency-free utilities.
- `styles.css` puts every `src/styles/*.css` in a cascade layer: `base, layout, components, pages, utilities, phone`
  ([0009](docs/decisions/0009-css-cascade-layers.md)).

## Rules that always apply

**Every shipped change is a release — never bump the version by hand** ([0002](docs/decisions/0002-every-change-is-a-release.md)).
The Release workflow versions, stamps, tests and tags after a merge. You: commit the change, open a PR, and label it
`release: minor` (feature or behaviour change), `release: patch` (fix, or a refactor nobody can see) or
`release: none` (nothing ships). A PR that adds a module or an inline `<script>` runs `npm run stamp` (import map and
CSP hashes; `tests/stamp.test.js` fails otherwise).

**Always open a pull request for finished work**, without being asked: one PR per coherent piece of work.

**Never commit real personal data — this repo and its history are public** ([0004](docs/decisions/0004-no-real-personal-data.md)).
No real names, places, employers, banks, merchants, account numbers, amounts, dates or ages anywhere — code, tests,
fixtures, comments, docs, commits, PRs — including the owner's own. Fixtures are invented from scratch (Alex, Sam,
Employer A, 1 Example St, Fern Café, Bank One), never a real figure altered. Check against real data outside the repo
and report without figures. Before every push, grep the diff for names, places and non-round amounts.

**Security** ([0014](docs/decisions/0014-security-baseline.md)): a new third-party host goes in the CSP in
`index.html`; text a person typed or a file brought in goes into HTML through `escapeAttr()`.

## When you add something

- **An edit** saves with `commit([...top-level keys it touched])`, never a bare `persist()` or a write the ratchet
  counts; its commit *is* its redraw — no list of render calls after it
  ([0007](docs/decisions/0007-edits-redraw-what-they-touched.md)).
- **A new part of the full redraw** is a `defineView(name, pages, draw, reads)` in `components/redraw.js`; an edit's own
  partial redraw is `redraw([names])`. The projection chart goes through `renderProjectionsWhenSeen()`.
- **A new listener** goes in its page's wiring module; **a new list of editable rows** registers its kind with
  `defineSection` (`lib/sections.js`); a page's own button inside rows is `defineRowAction`.
- **A new field or change of shape** in `state` is a new `MIGRATION_STEPS` entry with a test in
  `tests/migrations.test.js`. Replace `state` with `setState()`, never `state = …`.
- **A new array of rows** that names an account goes in `everyAccountLink`
  ([0006](docs/decisions/0006-accounts-linked-by-id.md)); one that can hold receipts in `receiptRefs`; a new view
  setting or bookkeeping key in `calc/activity.js`'s SKIP ([0012](docs/decisions/0012-sync-without-a-server.md)).
- **Scenario maths** reads `effectiveChanges(name)`, `scenarioSharedItems(name)` and `projectionFor(scenario)` — never
  the household's rows or `state.projection` directly; every other page shows the household (`currentScenario()`)
  ([0005](docs/decisions/0005-scenarios-are-sandboxes.md)).
- **Something about a property or shares** gets a `data-part` or a `part`; a new Home card a `data-home-card`
  ([0010](docs/decisions/0010-one-design-system.md)).
- **Styles** use the tokens: `--fs-*` sizes, weights 400/600, `var(--font-num)` for figures, `fmtCompact` for a figure
  read at a glance, `.btn-danger` for every delete, `--good-ink`/`--bad-ink`/`--warn-ink` for coloured text. A rule
  that adjusts another file's rule goes after it or in a later layer, not in a more specific selector; no page sets
  `min-height`/`min-width` `!important` (the phone floors are, and `!important` reverses layers).
- **A new page, subtab or report** goes in the smoke script's `VIEWS`; **a function that builds HTML from data** in
  `tests/render-smoke.test.js`; **a flow people rely on** gets a journey in `scripts/journeys.mjs`.

## Traps no check catches

- **"This year" and "this month" are the header's period, not today.** Anything genuinely about *now* — notifications,
  Before 30 June, the last finished year — passes today explicitly (`todayTaxFy()`, `localDateStr()`).
- **Transfers and money received are never spending.** Spending totals sum `state.transactions` only.
- **`showPage()` applies later, inside a view transition.** Two navigations in one tick resolve "newest wins".
- **A deleted account's name stays on its rows**, so a `<select>` of accounts must offer `… (deleted)` — a value matching
  no option silently shows the first one.
- **CSS `[hidden]` does nothing** on an element with its own `display` rule — add `.your-class[hidden]{ display:none; }`.
- **Inside one stylesheet, a `@media` override must come after the rule it overrides** — same layer and specificity,
  so source order decides, whatever the media condition.
- **A checkbox's `preventDefault()` reverts its checked state** after all its click listeners run. Let each mirrored
  checkbox toggle itself and sync on `change`.

## Running and testing

```
python3 -m http.server 8934   # then http://localhost:8934/index.html — modules don't load from file://
npm test                      # node --test over tests/*.test.js — no framework, no dependencies
npm run check                 # ESLint (+ local rules: escaping, the commit ratchet), tsc over calc/, stylelint
npm run stamp                 # after adding a module or an inline script
```

Three layers, each blind to something ([0013](docs/decisions/0013-testing-in-three-layers.md)): the `calc/` tests (no
DOM), the render smoke test (builders return markup, nothing wired), and driving the app with Playwright — the only
one that sees wiring, the cascade and layout. CI runs the tests, `scripts/smoke.mjs` (every view at 390/1280px, light
and dark, and an empty household), `scripts/journeys.mjs` (real flows and a speed budget) and the `screens` diff
(informational). **A green run is not evidence the app renders** — drive any change to a component, template or
stylesheet before calling it done, and measure (`getComputedStyle`, `getBoundingClientRect`) rather than eyeball.
Locally: `npm i --no-save playwright && npx playwright install chromium && node scripts/smoke.mjs`.
