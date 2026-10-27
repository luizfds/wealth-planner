# App assessment — late October 2026 (v3.101.0)

What it would take for the app to feel like a professional product rather than a capable
spreadsheet. Made by driving every page and subtab with sample data, at 1280px and 390px, and
comparing against well-known personal-finance apps. The build order that comes out of this is
items 135–165 in [`ROADMAP.md`](ROADMAP.md), under "Professional grade".

The short version: **the app already does more than nearly anything it would be compared with on
Australian tax, super and property. It loses on everything around that: what you see first, how
much you have to type, how often one thing lives in three places, and reports that are plain
tables.**

---

## What it's being compared with

| App | What it does better than us today | What we already do better |
|---|---|---|
| **PocketSmith** (AU/NZ) | Bank feeds; a calendar of future cash flow; up to 30-year balance forecasts per account; reports you can filter by any range | Tax, super, negative gearing, CGT parcels, land tax, buy-vs-rent scenarios |
| **Frollo** (AU, free) | Open-banking (CDR) feeds from 100+ institutions, super and loans included; a "Financial Passport" — a 12-month income/spend/assets summary to hand a lender | Planning of any kind; property; tax |
| **Sharesight / Navexa** (AU) | Prices and dividends fill themselves in; performance (annualised, split into capital gain, dividends, currency); taxable income, CGT and unrealised-gains reports per FY; diversity report | Holding shares next to the rest of the household's money |
| **Monarch Money** (US) | A polished look; cash flow as a Sankey diagram; reports by category, group or merchant as charts, with saved reports; one Accounts page with a detail view per account | AU anything; privacy (no server) |
| **ProjectionLab / Boldin** | Monte Carlo and historical-sequence testing; a Sankey per projected year; a life-events timeline; drawdown in retirement | AU tax depth; actuals feeding the plan |
| **Copilot Money** | Design polish; categorisation that just works; review queue for new transactions | Planning, tax |
| **Actual Budget** (local-first, open source) | Fast keyboard-first transaction grid; optional sync server | Everything beyond budgeting |

The constraint that shapes every recommendation below: **no backend, data stays in the browser,
repo is public.** Bank feeds through CDR need an accredited intermediary and a server, so "type
less" has to come from deriving, estimating and importing better — not from feeds.

---

## 1. First impression

What someone sees in their first minute decides whether the rest is trusted.

- **Sample data is random and thin.** `loadSampleData()` rolls dice: a property 60% of the time,
  different people and amounts each load, **no transactions**, no account balances, no money
  received. So a demo shows `$0` on This month, every Reports table is `$0`, Spending says "Nothing
  logged yet", Property is often empty, and "Net worth over time" asks you to log values. Every
  competitor's demo is a full household. This is the cheapest big win on the list.
- **Every card starts with a paragraph.** Accounts, Investments, Spending, Reports and the rest open
  with a sentence of explanation, and many cards add another. The ⓘ pattern (item 59) already
  exists. A professional app shows the figure and lets the help come on request.
- **Accordions everywhere.** Cash flow renders 38 `<details>` blocks; Investments 39. Every page
  reads as a stack of collapsible panels of equal weight, so nothing reads as the main thing.
  Pros use a fixed layout per page — a headline row, one main chart, one main list — and put the
  rest one click away (a detail page or a drawer).
- **The header spends its space on low-value controls.** "Theme: System" and "Export backup" are
  primary buttons on every page; the net-worth pill repeats a figure Home already shows twice.
- **Small things that read as unfinished:**
  - Chart axes labelled `$2,911,689 / $2,329,352 / …` instead of round ticks (`$3M / $2.5M …`).
  - ISO dates in the UI (`2026-10-04 – 2026-11-03`, "as at 2026-10-27") next to "4 Oct–3 Nov"
    elsewhere.
  - Settings → Checks: "Looks right" wraps into a two-line button squeezed under the text at
    1280px.
  - Net worth statement: "A month ago" shows `Total owned $47,372` (only the one holding logged
    then) beside today's `$410,160`; the note explains it, but a total that isn't a total
    shouldn't be printed.
  - "N/A" shows as a budget group with a `$0` card.
  - The wordmark is text in the default blue; no identity.
- **Weight.** Cash flow at phone width has **936 form controls** in the DOM — every collapsed row
  pre-renders its edit form. It works, but it is why the page feels heavy and why keyboard order
  needed item 26.

## 2. Too much input

Today almost every number the app shows was typed or imported by hand, and most need re-typing
to stay current: account balances, super, property values, vehicle, share prices (which need the
user to build and publish their own Google Sheet), every bill ("Catch up on 17 overdue").

What the app could do instead — in order of value for effort:

1. **Balances from statements.** A PDF or CSV statement carries an opening and closing balance;
   imports already read the PDF. Set the account balance from it, and roll it forward from
   imported transactions between statements. Account balances stop being a separate chore.
2. **Bills post themselves.** A planned bill on its due date becomes a *pending* transaction;
   an import that finds the real one replaces it; otherwise one tap confirms. "17 overdue"
   becomes "17 to confirm", with a "Confirm all".
3. **Estimate between logs, and say so.** Super between statements = last balance + SG from pay
   + an assumed return. Property = last value indexed by the growth assumption (or the suburb
   benchmark from item 70). Vehicle = depreciation. Shown with an "estimated" tag and dated; the
   user corrects them when a real figure arrives (super statements come once or twice a year).
4. **Prices with no setup.** A scheduled GitHub Action writes a daily price file (ASX 200 + the
   common ETFs + a short list of US names) to the Pages site; the app reads it like the Google
   Sheet. It must be a fixed broad list, **never the user's own tickers** — the repo is public and
   a ticker list is a portfolio. Keep the Sheet as the fallback for anything not on the list.
5. **A budget from history.** After importing 3–12 months, propose the budget lines (amount,
   frequency, Needs/Wants, account) from what was actually spent, rather than asking for them.
   Recurring detection (`calc/recurring.js`) already finds most of it.
6. **Know the common merchants.** A built-in map of large Australian merchants (supermarkets,
   fuel, telcos, utilities, insurers) to categories, so the first import is mostly categorised
   before any rules are learnt. Big brand names are public data, not personal data.
7. **Payslip import.** A payslip PDF → gross, tax withheld, super, salary sacrifice, YTD — fills
   the income lines and feeds the withholding check (item 90), the same way statements are read.
8. **A transaction grid.** Spreadsheet-style keyboard entry and multi-select editing for the
   transaction list (bulk edit exists, but in a card-per-row layout).
9. **First run that starts from files.** "Drop in your last three statements and a payslip" as
   the main path; the questionnaire as the fallback.

## 3. One thing, one place

The same figure or feature appears in several places, and related things are split across pages:

| Thing | Where it is today |
|---|---|
| Net worth | header pill (every page), Home card, Home → Scenarios "Total net worth today", Investments → Summary, Reports → Net worth statement, Reports → Net worth check |
| Scenarios | Home → Scenarios **and** Plan → Scenarios |
| Debts | Investments → Summary → Debts (cards, personal loans), Accounts ("Owed on cards and loans"), Property (home and investment loans) |
| Goals | Accounts → Savings goals, Accounts → Emergency fund, Home → Insights → Financial independence, Plan → Retirement, Plan → Scenarios → Can we buy? |
| Tax settings | Tax → This year, Settings → People (date of birth, HELP, caps, losses, home hours) |
| Data quality | Settings → Checks, Home → To do, the stale-assets banner, notifications |
| Time series | Investments → Net worth over time, Property → Total property value over time, Reports |
| Insights | Home → Insights plus a strip on six pages (fine as a pattern; listed for completeness) |

Two structural changes fix most of it:

- **A detail page for every thing.** An account, a holding, a property, a loan, a budget line, a
  merchant, a person: each gets one page with its history chart, its transactions, its related
  items and its edit form. Lists everywhere link there. This is the pattern Monarch, PocketSmith
  and Sharesight all share, and it gives every scattered panel an obvious home.
- **Regroup the navigation around nouns the user owns:** Home · Cash flow · **Net worth**
  (accounts, investments, super, property, debts — one list grouped by kind, Accounts + Investments
  + Property merged at the top level, each opening its detail page) · Tax · **Plan** (scenarios,
  projections, retirement, goals — emergency fund, savings goals, FI, can-we-buy) · Reports ·
  Settings (no Checks — that moves to Home's to-do / Review).

## 4. Reports

Reports today: eight fixed tables — 194 lines of `calc/reports.js` and 59 of
`components/reports.js`. No charts, period fixed to the header's FY, no comparison column except
the net worth statement, no grouping choices, no saved views. The CSV/print buttons are good.

What the comparison apps offer that matters here:

- **One report frame**: range (month, quarter, FY, calendar year, last 12 months, custom), compare
  to (previous period, same period last year, budget), group by (category, group, merchant,
  account, person, property), chart + table, click any figure to see its transactions.
- **Cash flow Sankey**: gross pay → tax / super / take-home → Needs / Wants / saved / invested.
  The single most-shared chart in Monarch and ProjectionLab, and the app has every number for it.
- **Household income statement**: income, spending by group, savings, savings rate — month by month
  across the year, with a budget column.
- **Budget vs actual by month**: lines × months heat map of variance.
- **Spending trends**: 12/24 months, year-on-year per category and merchant.
- **Investment performance** (Sharesight's core): per holding and total — capital gain, income,
  currency, annualised return, against a benchmark; distributions and franking by FY; realised and
  unrealised CGT by parcel with the discount.
- **Property performance**: gross and net yield, cash flow after tax, equity growth, total return,
  per property and per year.
- **Debt report**: balances, interest paid by year, deductible share, payoff dates.
- **Super report**: contributions against caps by year, carry-forward room, balance history.
- **Lender pack** (Frollo's "Financial Passport"): 12 months of income, spending, assets and
  liabilities on one printable page — directly useful to a property investor refinancing or buying.
- **Year in review**: a narrative one-pager each 30 June.
- **Saved reports and a proper printout**: a title block, the household, the period, page breaks,
  charts that print.

## 5. Planning depth

Projections are a single deterministic line per scenario. Compared with ProjectionLab/Boldin the
missing pieces are: a **range of outcomes** (historical sequences or Monte Carlo — a 10th/50th/90th
band on the projection and a probability on the FI/retirement answer), **life events on a
timeline** (a child, a career break, a sale, a downsizer), **drawdown in retirement** with tax and
the **Age Pension** (no reference to it anywhere today), and an **age axis** rather than "Yr 7".

## 6. Platform

- **Data safety** is the biggest risk a professional user would raise: one browser's
  `localStorage`, with folder backups (item 106). An optional, client-side-encrypted sync to the
  user's own cloud drive would remove the "clearing the browser deletes everything" warning from
  the sidebar.
- **CLAUDE.md has drifted**: it says `app.js` is ~3,400 lines; it is 5,801.
- **No visual regression check.** CI catches errors and overflow, not "this looks wrong". Saved
  screenshots of each page compared on every PR would have caught the Checks button.

## 7. On a real household's data

The same pass was repeated against a real exported backup — over a year of imported transactions,
an investment property with loans and manager statements, a share portfolio with lots, two lodged tax
years — loaded in a scratch copy, outside the repo. No figures from it are recorded here. Nothing errored
and no NaN/undefined appeared. It confirmed the sections above and added these (items 135, 136, 141, 147,
148 and 153 in the roadmap):

- **The headline follows the selected scenario.** The header's Monthly cash, on every page, is the
  *selected* scenario's figure. Selecting a Buy scenario to study it turns the household's headline into
  a what-if. It also differs from the same scenario's card (a normal month vs one averaged with bonuses)
  with nothing on screen to say why.
- **Trend lines disagree with their numbers.** Home's net worth card printed a rise "since" the last log
  beside a sparkline that fell, because the sparkline leaves out today's figure. The property value
  chart drew three hand-logged values as steps on a zoomed axis, so one revaluation read as a crash.
- **Rules are learnt one store at a time.** Most learnt import rules had matched exactly once. A rule is
  keyed on the exact bank description, so every new branch of the same chain is another rule to teach.
  This is the clearest measure of "too much input" found.
- **Raw bank text in the lists.** About one transaction in seven still shows the bank's description,
  store numbers and suburb included.
- **Pages grow with the data.** Cash flow → Spending ran to several screen-heights on a desktop, and
  Settings → Import rules to tens of thousands of pixels on a phone, because every list shows every row.
  Cash flow built well over 1,500 form controls.
- **Reports stop at the FY boundary.** With more than a year of data there is no way to see the last 12
  months in one report.
- **Things you own are forms.** A property's Overview opens as input fields, not as a summary with an
  Edit button.

What held up well: every transaction was tied to a budget line, share prices were current, and the
tax, property and scenario figures were consistent from page to page. The data was well maintained.
That is what makes the amount of upkeep it takes the main finding.

---

## What was deliberately left out

- **Bank feeds (CDR)** — needs accreditation (or a paid intermediary) and a server holding tokens;
  both contradict "nothing is sent anywhere". Revisit only if the app ever gets a backend.
- **Native apps** — the PWA plus share target covers it.
- **Credit score, bill negotiation, marketplace offers** — what free apps monetise with; not this
  app's job.

## Sources

- [PocketSmith — Frollo alternative](https://pocketsmith.com/frollo-alternative)
- [Mozo — budgeting and savings apps](https://mozo.com.au/fintech/the-seven-budget-and-savings-apps-every-aussie-needs)
- [Finder — top apps to save money](https://www.finder.com.au/budgeting/top-apps-save-money)
- [Monarch — Using Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports)
- [Monarch — saved reports](https://www.monarch.com/blog/saved-reports-and-more)
- [ProjectionLab — quick start](https://projectionlab.com/resources/employers/quick-start-guide)
- [The College Investor — ProjectionLab review](https://thecollegeinvestor.com/44369/projectionlab-review/)
