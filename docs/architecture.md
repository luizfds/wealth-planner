# Architecture

A reference map of the code — what lives where. The *why* is in [decisions/](decisions/README.md); the rules for
working on it are in [CLAUDE.md](../CLAUDE.md).

## Pages

All markup is in `index.html`; pages are `<section class="app-page" id="page-…">`, shown and hidden by `showPage()`
(`components/nav.js`), not separate documents. By what you own:

- **Today** (`page-dashboard`, named Home before #412): its cards, then links to Insights, How you compare (benchmarks)
  and the Monthly review (Checks sit in it) — no tab rail; each opens at `/dashboard/<view>` with the header's back
  link. Cards carry `data-home-card` and can be arranged (`lib/homelayout.js`); "Your week" (`calc/weekrecap.js`) from
  each Monday.
- **More** (`page-more`, #412): a phone's tab for Tax, Reports, Calculators, Settings and Backup & sync; a desktop's
  sidebar lists the same five under a More heading. The phone's More tab stays lit on each of them (`MORE_GROUP`).
- **Money** (`page-expenses`, was Cash flow; #427): Budget / Transactions / Bills. Budget is one plan — Money in (the old
  Income tab, still `#expensesSub-income`, where `/expenses/income` and every Income link land) then Money out.
  Transactions is the old Spending (`data-expenses-sub="spending"`, `/expenses/spending`).
- **Accounts** (was Net worth; #428): the page is one list (`page-networth`), and the editing pages are behind it with
  no rail — Bank accounts (`page-accounts`), Investments (`page-assets`), Property (`page-properties`) — reached from a
  group's heading on Accounts, an item's Details (its "Manage on …" link), + and search, each with the header's
  "‹ Accounts". The list is one list with chips by kind (`setNetWorthFilter`) — the one switcher: `page-assets` has no
  pills and is titled with the group it shows (`ASSET_PAGE_TITLES`; "Other things" is Vehicle and Other together), and under it, folded, the allocation, purchase funding, net worth over time and where wealth
  sits (`#netWorthMore`, view `netWorthMore`). Debts are edited on Accounts (view `debts`). Investments has no Summary
  since #413: it opens on Cash, and `/assets/summary` lands there.
- **Tax**: Year / Returns / Documents / People. **Plan** (`page-plan`): Scenarios / Projections / Goals / Retirement;
  a scenario is edited on `page-scenario`; the purchase and invest calculators on `page-calc` (avatar menu).
- **Reports**, **Settings** (`page-settings`: Categories / Preferences / Import rules), and a Details page
  (`page-detail`, `/detail/<kind>/<id>`) for any one thing.

Every view has its own address — Home's tabs (`/dashboard/insights`, Overview plain `/dashboard`) and the report on
screen (`/reports/budget`) included — so Back steps through them. Each history entry the app writes carries `depth` and
the name of the screen it came from (`from`); the header's back link (`#pageBack`, nav.js `renderBackLink`, on the pages
in `BACK_LINK_PAGES`) goes back through it, named for that screen. With nothing of the app's own behind it (a deep link
starts with Home beneath it, `seedHomeBeneath`, marked `seeded`) it goes to the screen's parent instead — `lib/parents.js`
names one for every inner screen (a holding's Details → Accounts; a budget line's → Budget), then Home. The same chain is a
desktop's breadcrumb (`#pageCrumbs`) and decides the menu entry a Details page lights. Leaving a page keeps its scroll on
its history entry, and Back puts it back (`restoreScroll`). Anything that sends someone back calls `goBackInApp()`, never
`history.length`.
Old ids (`income`, `scenarios`, `projections`) still route through nav.js's ALIASES; `/settings/people|checks` land
where those tabs moved (`MOVED_SETTINGS`). `showPage()` applies inside a view transition — two navigations in one tick
are resolved "newest wins" (`applyPageChange` bails if `currentPage` moved on).

## Code

- `src/app.js` — the bootstrap (decision 0008).
- `src/state.js` — `state`, `defaultState()`, `migrateState()` / `MIGRATION_STEPS`, `persist()`, `commit()`, `setStatus()`.
- `src/calc/` — pure financial maths and parsing, no DOM. Among them: `ledger.js` (periods, sums, the selected
  period), `tax.js` (income tax, Medicare, super caps, Division 293), `property.js` (stamp duty, LMI, loans, equity),
  `engine.js` (the projection series, net worth, derived rows), `cashflow.js`, `fire.js`, `history.js`, `trends.js`,
  `bank-import.js` / `import-rules.js` / `pdfstatement.js` / `payslip.js` / `brokertrades.js` / `rowimport.js` / `pricepaste.js` (bringing data in; `rowimport.js` is the Budget, Income and
  Assets CSV imports' duplicates, apply and guarded Undo, drawn by `components/rowimport.js`; `pricepaste.js` reviews pasted share prices, drawn by
  `components/pricepaste.js`; `restore.js` checks and summarises a backup before it replaces the household),
  `claims.js`, `people.js`, `received.js`, `closeyear.js`, `health.js` (Checks), `withholding.js`, `junemoves.js`,
  `actuals.js`, `monthreview.js`, `accounts.js` / `accountlinks.js` (decision 0006), `cashflowlist.js`, `bills.js`,
  `investments.js` / `investreturn.js` / `performance.js`, `reports.js` / `reportframe.js` and the report modules,
  `savegoals.js`, `firstrun.js`, `pricesheet.js`, `trips.js`, `recurring.js` / `subscriptions.js`, `nwhistory.js`,
  `takehome.js`, `canbuy.js` / `cashdraw.js` (where a purchase's cash comes from, and what emptying an offset costs), `needstarget.js` (the take-home it would take for Needs to be a target share, #389), `yearreview.js` (the guided Year in review's year and sections, #396), `reconcile.js` (the year reconciled: kept, and where it went, read from balances, #397), `savingsoffset.js` (a savings account's after-tax interest beside an offset's, #398), `nextyearplan.js` (next year's goals sharing one monthly surplus in priority order, #399), `planprogress.js` (each planned goal against the plan each month: forecast, how far off, how to catch up, #400), `cashrate.js` (the RBA cash rate), `emergency.js`, `trim.js`, `advice.js`, `aisummary.js` (the anonymised summary behind
  Ask Claude), `estimates.js`, `merchantbook.js`, `tidy.js` (Budget → Tidy up: purchases on the wrong line, a line by shop), `budgetfromhistory.js`, `outcomes.js` (Monte Carlo), `lifeevents.js`,
  `agepension.js`, `networthlist.js`, `inbox.js`, `showas.js`, `payslipcheck.js`, `dailyforecast.js`, `autopay.js`,
  `txviews.js`, `receipts.js`, `activity.js`, `syncfile.js` / `syncmerge.js`, `parts.js`, `categorylook.js`, and the
  scenario modules (`scenariochanges.js`, `scenariodraft.js`, `scenariolegs.js`, `scenariotemplates.js`,
  `scenarioaccount.js`, `scenariotimeline.js`, `scenariostress.js` (rate rises and break-even growth on each card), `makereal.js`, `salecgt.js`).
- `src/components/` — one file per page or card, exporting render and patch functions, and the wiring modules
  (`*wiring.js`, `rows.js`, `redraw.js`, `overlays.js`, `notifpanel.js`, `updates.js`) that register every listener.
- `src/lib/` — dependency-free utilities: formatters (`format.js`), toasts, `escapeAttr` (`html.js`), the shared row
  renderers (`ledger-table.js`), the SVG charts (`charts.js`), notifications, search, the setup checklist, help (each
  page's ⓘ and ⋯), storage use, backup (`backup.js`), sync (`foldersync.js`, `dropbox.js`), receipts, the activity log,
  the views registry (`views.js`), sections (`sections.js`), the overlay stack (`overlaystack.js`), the theme, the
  error log, pdf text (`pdftext.js`, loading `vendor/pdfjs/`), the shared field (`field.js`), an empty state with its next step (`empty.js`) and reading one before it's
  saved (`validate.js`), keeping focus and drafts through a redraw (`keepui.js`), and ARIA tabs by keyboard (`tabs.js`).
- `src/styles/` — the stylesheets, each in a cascade layer (decision 0009).
- `prices/`, `scripts/prices/` — the daily price file (decision 0012).
- `rates/`, `scripts/cashrate/` — the RBA cash rate file, written by `.github/workflows/cashrate.yml` each weekday
  afternoon and read by the app from its own site, like the price file.

## Features worth knowing before you touch them

- **Saved views** (`calc/txviews.js`, `state.txViews`): Spending's filters saved as chips. Any button with `data-sv`
  and `data-sv-<filter>` opens Spending filtered; a filter with its own dates replaces the header's period.
- **Balance by the day** (`calc/dailyforecast.js`): an everyday account's 90 days from the bills calendar, pay landed
  before and usual spending; `account.buffer` warns on its detail page and Home.
- **Automatic payments** (`calc/autopay.js`, `state.autoPayments`): on the day, Home and the bell ask; an answer records
  a transfer tagged `autoPay` / `autoPayDate`; a transfer between the same accounts within 3 days answers it too. The
  bills calendar and an account's 90 days draw it in place of its Budget line.
- **A property manager's statement** (`calc/agentstatement.js`) is logged on its property's Income & costs tab. The
  same form opens filled in from the main import (`isAgentStatement` in `calc/pdfstatement.js` tells it from a bank
  statement, `propertyNamedIn` finds its property, else it asks), from an investment property's Overview and from
  the + menu — `components/rentstatement.js`.
- **One property ledger** (`propertyLedger`, calc/propertyactuals.js): everything logged about a property — statements,
  rent received, payments against its lines, claimed household lines at their deductible share, its loans' interest and
  fees — one entry each with its return line and source. The year so far, the schedule's logged figures, the property's
  Activity tab (`components/propertyactivity.js`: remove a record, move a payment to another line, type an interest
  charge) and the Rental tax pack report (`calc/taxpack.js`) all add up this list; nothing else walks those stores.
- **A property's year so far** (`calc/propertyactuals.js`): on an investment property's Tax tab, under the plan's
  result — rent from statements and money received, costs from statements and payments against its lines (and lines
  claimed against it), interest, depreciation and borrowing costs worked out to today — beside the plan for the
  same share of the year.
- **The rental schedule from what's logged** (`rentalLogged`, calc/propertyactuals.js): Tax → Returns' rental schedule
  shows under each return line what's logged for the year (statements, rent received, payments against the property's
  cost lines by their return line, claimed lines at their deductible share); "Use logged figures" makes them the
  year's actuals (undoable). Borrowing costs and depreciation stay worked out.
- **Loans as the bank charged them** (`calc/loancharges.js`): a statement imported into an account of type Loan linked
  to a property's loan keeps its interest charges and fees on the loan (`loan.charges`), sets its settled-on date from
  a drawdown and notes the bank's repayment (`loan.bankRepayment`, offered on the loan as "Use the bank's"). Interest
  everywhere — year so far, rental schedule, debts report — is `loanInterestCharged`: the charges for the days they
  cover, `loanInterestForWindow` (never before settlement) for the rest. A statement that reads like a loan's with no
  loan account picked (`looksLikeLoanStatement`) asks which loan, and `loanAccountFor` makes or finds its account.
- **Investment returns** (`calc/investreturn.js`): money-weighted per holding, the same money in an index (the price
  file's weekly A200 / IVV), a target mix (`state.targetMix`), distributions ahead.
- **On a phone**: rows and `.review-panel` dialogs are bottom sheets dragged closed by their head; Spending's rows swipe
  left for Edit / Split / Delete; pulling the page down refreshes prices and sync.
- **The quick tour** (`lib/tour.js`, `components/tour.js`, `components/tourwiring.js`): a card that walks the menu with
  each place on screen behind it, ending on the first-month steps (`lib/setup.js`). Offered once on Home — after the
  setup sheet closes or the sample household loads, never beside the sheet — and always under the avatar menu. Its
  answer is kept per browser (`wealthPlanner.tour` in localStorage, not `state`). Pages change under it with
  `skipUrl`, so the address bar still names the page it started from and closing puts that page back; it has its own
  history entry (`pushModalOverlay`), so a phone's Back closes it. A step whose target isn't on screen is shown
  without a ring. The test scripts start as someone who has answered it.
- **Adding, one question at a time** (November 2026; `calc/addflow.js`, `components/addflow.js`,
  `components/addflowwiring.js`): "+ Add property" and "+ Add account" open a dialog that asks one thing a screen — a
  property's kind, name, when it was bought, its worth and its loan (or, being bought, its price, deposit, settlement
  and loan); an account's kind, name (an offset's loan) and balance — and ends on a screen to check it all. calc/addflow.js
  orders the questions, says what a figure means and makes the record; the property opens on its edit form for the rest.
  Editing never uses it.
- **Records that disagree** (#453, `calc/integrity.js`): more checks for Settings → Checks (`calc/health.js` merges
  them) — income entered twice (never the worked-out net-pay rows, nor two rents with different names), a scenario's
  purchase plan against the home being bought, balances stale or never recorded, dates that can't be, two accounts on
  one balance, a cash asset counted twice, a purchase whose figures disagree. Read-only; each names the record, where to
  fix it and how sure it is (`confidence`); "Looks right" dismisses it.
- **Cash month by month** (#454, `calc/liquidity.js`): Insights' 12-month forecast carries the cash and offsets held
  today through `monthlyCashFlowForecast` (which takes a scenario, to set one beside the household) — a home being
  bought settling in its month (the cash to bring from `purchaseFigures`, so the deposit, the lender's deductions and
  the costs land once), its loan's repayments after; a +1%/+2% rate rise on every loan; the lowest balance; what's set
  aside for settlement rather than emergencies; months under the emergency reserve; what it assumes and what's missing.
- **Spare cash, four ways** (#455, `cashStrategies` in calc/loanstrategy.js): under a loan's strategy, the same amount
  kept, in savings (its rate less the holder's tax), in the offset, or paid off the loan, run month by month on one
  timeline (a repayment no longer needed, or interest-only interest not charged, is cash kept) at 1/5/10 years —
  interest saved, balance, cash to hand, payoff sooner; on an investment loan the deduction lost (owners' rate, shown and
  editable, `strategyDefaults` in calc/savingsoffset.js). It starts from the cash held less the emergency reserve.
- **Where you stand** (#457, `calc/standing.js`, `standingCardHtml` in components/home.js): Today's five decision
  figures, each from a calculation done elsewhere (liquidity, scenarioTotals, emergencyFund, rateStress, Needs you's
  to-dos), linked to where it's worked out, "—" when it can't be known.
- **Kept per device, never in `state`** (#426): Simple/Advanced (`wealthPlanner.mode`) and Today's one-time offer of
  Simple (`wealthPlanner.modeOffer`, `lib/mode.js`); the count of screens opened (`wealthPlanner.pageUse`,
  `lib/pageuse.js`, recorded by nav.js `syncUrl`, shown in Settings → Preferences, cleared by Reset). The test scripts
  start with the offer answered. A dialog that asks which one of a few things (a property, an account) is
  `lib/chooser.js`'s `chooseOne`.
- **Scenario editor**: two columns with results pinned beside, a Save bar on a phone, a leave guard (`setLeaveGuard`),
  one "+ Add a change" sheet, saved-vs-draft marks, a timeline, `state.scenarioNotes`; Side by side adds the odds
  (`cashLastsOdds`), a bad first year (`badStartSeries`) and a lender check (`lenderCheck`).

There is no Classic mode any more — `lib/uimode.js`, `state.uiMode` and the `<table>` renderers (`buildTable`,
`rowHtml`) were removed once every page went to cards. A reference to any of them is stale.
