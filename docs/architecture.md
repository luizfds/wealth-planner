# Architecture

A reference map of the code — what lives where. The *why* is in [decisions/](decisions/README.md); the rules for
working on it are in [CLAUDE.md](../CLAUDE.md).

## Pages

All markup is in `index.html`; pages are `<section class="app-page" id="page-…">`, shown and hidden by `showPage()`
(`components/nav.js`), not separate documents. By what you own:

- **Home** (`page-dashboard`): Overview / Insights / Benchmarks / Review (Checks sit in Review). Cards carry
  `data-home-card` and can be arranged (`lib/homelayout.js`); "Your week" (`calc/weekrecap.js`) from each Monday.
- **Cash flow** (`page-expenses`): Budget / Income / Spending / Bills.
- **Net worth**: one menu entry over four pages sharing a rail of tabs — the overview (`page-networth`), Accounts,
  Investments (`page-assets`), Property (`page-properties`).
- **Tax**: Year / Returns / Documents / People. **Plan** (`page-plan`): Scenarios / Projections / Goals / Retirement;
  a scenario is edited on `page-scenario`; the purchase and invest calculators on `page-calc` (avatar menu).
- **Reports**, **Settings** (`page-settings`: Categories / Preferences / Import rules), and a Details page
  (`page-detail`, `/detail/<kind>/<id>`) for any one thing.

Old ids (`income`, `scenarios`, `projections`) still route through nav.js's ALIASES; `/settings/people|checks` land
where those tabs moved (`MOVED_SETTINGS`). `showPage()` applies inside a view transition — two navigations in one tick
are resolved "newest wins" (`applyPageChange` bails if `currentPage` moved on).

## Code

- `src/app.js` — the bootstrap (decision 0008).
- `src/state.js` — `state`, `defaultState()`, `migrateState()` / `MIGRATION_STEPS`, `persist()`, `commit()`, `setStatus()`.
- `src/calc/` — pure financial maths and parsing, no DOM. Among them: `ledger.js` (periods, sums, the selected
  period), `tax.js` (income tax, Medicare, super caps, Division 293), `property.js` (stamp duty, LMI, loans, equity),
  `engine.js` (the projection series, net worth, derived rows), `cashflow.js`, `fire.js`, `history.js`, `trends.js`,
  `bank-import.js` / `import-rules.js` / `pdfstatement.js` / `payslip.js` / `brokertrades.js` (bringing data in),
  `claims.js`, `people.js`, `received.js`, `closeyear.js`, `health.js` (Checks), `withholding.js`, `junemoves.js`,
  `actuals.js`, `monthreview.js`, `accounts.js` / `accountlinks.js` (decision 0006), `cashflowlist.js`, `bills.js`,
  `investments.js` / `investreturn.js` / `performance.js`, `reports.js` / `reportframe.js` and the report modules,
  `savegoals.js`, `firstrun.js`, `pricesheet.js`, `trips.js`, `recurring.js` / `subscriptions.js`, `nwhistory.js`,
  `takehome.js`, `canbuy.js`, `emergency.js`, `trim.js`, `advice.js`, `aisummary.js` (the anonymised summary behind
  Ask Claude), `estimates.js`, `merchantbook.js`, `budgetfromhistory.js`, `outcomes.js` (Monte Carlo), `lifeevents.js`,
  `agepension.js`, `networthlist.js`, `inbox.js`, `showas.js`, `payslipcheck.js`, `dailyforecast.js`, `autopay.js`,
  `txviews.js`, `receipts.js`, `activity.js`, `syncfile.js` / `syncmerge.js`, `parts.js`, `categorylook.js`, and the
  scenario modules (`scenariochanges.js`, `scenariodraft.js`, `scenariolegs.js`, `scenariotemplates.js`,
  `scenarioaccount.js`, `scenariotimeline.js`, `makereal.js`, `salecgt.js`).
- `src/components/` — one file per page or card, exporting render and patch functions, and the wiring modules
  (`*wiring.js`, `rows.js`, `redraw.js`, `overlays.js`, `notifpanel.js`, `updates.js`) that register every listener.
- `src/lib/` — dependency-free utilities: formatters (`format.js`), toasts, `escapeAttr` (`html.js`), the shared row
  renderers (`ledger-table.js`), the SVG charts (`charts.js`), notifications, search, the setup checklist, help (each
  page's ⓘ and ⋯), storage use, backup (`backup.js`), sync (`foldersync.js`, `dropbox.js`), receipts, the activity log,
  the views registry (`views.js`), sections (`sections.js`), the overlay stack (`overlaystack.js`), the theme, the
  error log, pdf text (`pdftext.js`, loading `vendor/pdfjs/`).
- `src/styles/` — the stylesheets, each in a cascade layer (decision 0009).
- `prices/`, `scripts/prices/` — the daily price file (decision 0012).

## Features worth knowing before you touch them

- **Saved views** (`calc/txviews.js`, `state.txViews`): Spending's filters saved as chips. Any button with `data-sv`
  and `data-sv-<filter>` opens Spending filtered; a filter with its own dates replaces the header's period.
- **Balance by the day** (`calc/dailyforecast.js`): an everyday account's 90 days from the bills calendar, pay landed
  before and usual spending; `account.buffer` warns on its detail page and Home.
- **Automatic payments** (`calc/autopay.js`, `state.autoPayments`): on the day, Home and the bell ask; an answer records
  a transfer tagged `autoPay` / `autoPayDate`; a transfer between the same accounts within 3 days answers it too. The
  bills calendar and an account's 90 days draw it in place of its Budget line.
- **Investment returns** (`calc/investreturn.js`): money-weighted per holding, the same money in an index (the price
  file's weekly A200 / IVV), a target mix (`state.targetMix`), distributions ahead.
- **On a phone**: rows and `.review-panel` dialogs are bottom sheets dragged closed by their head; Spending's rows swipe
  left for Edit / Split / Delete; pulling the page down refreshes prices and sync.
- **Scenario editor**: two columns with results pinned beside, a Save bar on a phone, a leave guard (`setLeaveGuard`),
  one "+ Add a change" sheet, saved-vs-draft marks, a timeline, `state.scenarioNotes`; Side by side adds the odds
  (`cashLastsOdds`), a bad first year (`badStartSeries`) and a lender check (`lenderCheck`).

There is no Classic mode any more — `lib/uimode.js`, `state.uiMode` and the `<table>` renderers (`buildTable`,
`rowHtml`) were removed once every page went to cards. A reference to any of them is stale.
