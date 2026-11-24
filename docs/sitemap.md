# Sitemap — every page and what it does

A map of the whole app as it stands in November 2026 (after v3.330): each page, its tabs and the address each opens
at, what's on it, and what Simple mode puts away. Taken from the app itself — every view opened with the sample
household (`?mock=1`) and its headings, folds, buttons and fields listed — and from `index.html` and `components/`.
The figures named below are the sample household's (Alex and Sam, 1 Example St), never anyone's real data.

Addresses are under the site's base path (`/wealth-planner` on GitHub Pages); `nav.js` `buildRoutePath` writes them, so
Back steps through every view. "Advanced" means `data-level="advanced"`: Simple mode puts it away (decision 0016),
and *More › Show everything* (or Settings › Preferences › Screens you rarely open) brings it back.

## The frame around every page

| Piece | Where | What it does |
| --- | --- | --- |
| **Menu** | Phone: tab bar Today · Money · Accounts · Plan · More. Desktop: sidebar with the same four, then a *More* heading listing Tax, Reports, Calculators, Settings, Backup & sync, and "Stored on this device · Back up". | Moves between pages. The More tab stays lit on each of its five pages. |
| **Page title + ⓘ** | Top of each page | ⓘ opens *About this page*; ⋯ holds the page's own tools (Export CSV, Import template, Import data…). |
| **Period chip** (`Nov · FY26/27`) | Under the title | Sets "this year" and "this month" for every page: July–June or January–December, the year, an optional month, *Back to today*. |
| **+ Add, log or import** | Header (desktop) / round button (phone) | **Log:** spend, income, a rent statement, pay a card, update a balance. **Import:** a file (statements, payslips, trades, prices, a spreadsheet). **Add something new:** budget line, income, shares, cash account, property, bank or card account. |
| **Search** | Header | Records by name, person, account or date; also finds Reports, Calculators and Import rules, and opens the fold a setting is in. |
| **Notifications (bell)** | Header | Bills due, automatic payments to confirm, checks, rate changes, price and sync problems. |
| **Avatar menu** | Header, top right | Backup & sync status, Export backup, Import data…, Import backup, Share securely, Theme, Load sample data, Reset everything…, Take a tour, Request a feature, Check for updates. |
| **Back link / breadcrumb** | Header on inner pages | Named for the screen it returns to (history first, then `lib/parents.js`). Desktop shows a breadcrumb. |
| **"N to look at" strip** | Top of most pages | The page's own checks and notices, opening the first. |
| **Quick tour** | Offered once on Today; avatar menu | Walks the menu with each place on screen. |
| **Pull to refresh** | Phone | Refreshes prices and sync. |

## Today — `/dashboard`

The household at a glance. Cards can be arranged (*Arrange*, `lib/homelayout.js`); each carries `data-home-card`.

- **Net worth hero** (`nw`) — net worth, change since a date, the line from recorded balances (sparkline spans ≥20%).
- **Where you stand** (`standing`/`glance`) — left this month, lowest cash in the next 12 months (settlement
  included), emergency runway, what a 2% rate rise costs.
- **Needs you** (`needs`) — bills this week with *Paid*, to-dos (rate changes, stale balances, the monthly review,
  suggested lines). The Today tab's dot shows only for a late bill or an urgent to-do.
- **This month** (`month`) — spent and received against plan, with *See spending*.
- **Your week** (`week`) — the weekly recap from each Monday (folded).
- **Automatic payments** (`autopay`), **Low balance** (`lowbal`), **Goals** (`goals`), **Savings** (`savings`),
  **Tax** (`tax`), **Year in review** (`yearreview`) — shown when they have something to say.
- **Plans** — scenarios compared (`scenarios`, advanced), projected net worth (`projected`, advanced), financial
  independence (`fi`, advanced); *Cash-flow and reserve risks*, *Compare monthly trade-offs* folds.
- Links to the three views below.

### What the app notices — `/dashboard/insights` (advanced)
Opportunities, things worth knowing and what's on track, each dismissible with *See the figures*: concessional super
room, the rental's tax benefit in each pay, offset cash after tax, Lifestyle share, savings rate, emergency fund. Ends
with *Ask Claude directly* (your own API key; sends a minimised summary — `calc/aisummary.js`).

### How you compare — `/dashboard/benchmarks` (advanced)
Super and net worth against published Australian figures for people your age (ATO via ASFA), combined super against
a comfortable retirement, your shares against the market (same dollars, same dates; index prices), your targets, each
property against its suburb (growth, yield, rent).

### Monthly review — `/dashboard/review`
A guided ten-minute check-in for a month (‹ month ›): each step says what's missing and takes you to fix it. **Checks**
sit here: data problems (a name shared by two things, a stale balance…), each with *Open* and *Looks right*.

## Money — `/expenses/<tab>`

### Budget — `/expenses/budget`
- **Left for Lifestyle** hero — what's left this month, a day's allowance, the month's pace line, "at this pace…";
  Essentials and Lifestyle against plan.
- **One inbox** — "N things to tidy" (misfiled purchases, a line by shop) with *Review*; "N notices" (suggested lines).
- **Coming up** — the next 7 days of bills.
- **Pots** — set-aside lines (holidays, gifts) with what's in each and what's short.
- **Lines** — every budget line grouped Essentials / Lifestyle (and loans), with spent vs plan, filters (*Needs a look*,
  *Spent this month*, *All*), sort (*Biggest*, *A–Z*), *+ Add expense*. A line opens its Details.
- **Adjust the plan** — each line beside its typical month (*Use $…/mo*), *Far from typical*.
- **All suggestions** — Build from what you've spent · Tidy up (move a purchase to its usual line) · Trim (lines
  budgeted but not spent: Set to $0, Keep, Half, Pause) · Recurring payments (price changes: *Update to $…*; *Add
  recurring rule*) · Which lines are flexible? · Category spending changes.

### Transactions — `/expenses/spending`
- Header: the month's spending, a search, *Filters*, ⋯ (saved views, CSV), kind chips (*All*, *On your budget*,
  *One-offs*, *Moved, not spent*, *Money in*).
- The list by day; each row opens to edit, split or delete (phone: swipe left); *+ Log spend*, *Show all*.
- **Trips** (advanced) — a trip's dates file spending to its line; *+ Add trip*.
- **Import from your bank** — CSV, PDF, OFX/QFX, QIF (and from a Statements folder or the phone's share sheet). The
  review groups rows by merchant: one **Goes to** per group (a budget line, a new line, spending not on a line, a
  transfer to an account — or a new one —, income received), the category under it, badges (learned, guessed,
  known shop, guessed from "café", matches Alex's pay, transfer, trip), possible duplicates, a loan statement's
  charges, the statement's account and closing balance; *Import*, then *Undo*. Rules are learned for next time.
- **Patterns** — this month / this year / 6 months (advanced) by merchant and category, as a chart.
- **Property** — spending that belongs to a purchase or a property, with *Open the purchase / property*.

### Bills — `/expenses/bills`
Still to pay this month, list or calendar; *From your accounts* (each bill with paid ✓, a card's charges together);
lines with no payment yet; **Subscriptions** (each with its next date and yearly cost); monthly expenses by account;
*Bill or spending budget?* (advanced). An everyday account's next 90 days (**balance by the day**) is on its Details
page, and a low point shows on Today.

### Income — `/expenses/income`
- **Income** — the pay rows per person (salary, bonus, super on top, tax refund at lodgement, take-home), household
  rows, *Show as* (Year, Month, Fortnight, Week, Hour), *Monthly total*.
- **Received** — money in, actual against planned.
- **Your month, planned** — money in, money out, once-a-year averaged, left over in a normal month.

## Accounts — `/networth`

One list of everything owned and owed: the net worth hero (owned, owed, the mix bar), chips **All · Cash ·
Investments · Super · Property · Other things · Debts**, each group with its total and *Open ›*, *All accounts and
cards*, *Offsets*. Folded (advanced): **Allocation**, **Net worth over time**, **Net worth history** (every recorded
day; change a figure or remove a day, days out of line flagged), **Where your wealth sits**.

### Bank accounts — `/accounts`
Cash held and owed on cards and loans; each bank account (everyday, savings, offset) and credit card with *Details*
and *Update*; **Debts** (personal loans, HECS etc.) — the debts are edited here (view `debts`).

### Investments — `/assets/<group>`
Opened from Accounts with no pills of its own; titled for the group.
- **Cash** `/assets/cash` — each cash account, *+ Add cash account*, cash over time.
- **Shares** `/assets/shares` — holdings with daily prices and a change window (1D…All), *Filters*, ⋯; gain/loss
  breakdown, **Performance** (money-weighted), **Against the market** (index), **Target mix**, distributions in the
  year ahead and by year, value over time; *+ Add holding*; crypto too.
- **Super** `/assets/super` — each fund, contributions this year against the cap per person, super over time.
- **Other things** `/assets/vehicle`, `/assets/other` — vehicles (with depreciation) and other things, over time.
- **Offsets** `/assets/offsets` — each offset against its loan.

### Property — `/properties`
- **Buying** card (a purchase under way): price, settlement countdown, paid so far / still to pay / the loan, *Edit*,
  **Deposit and costs** (stamp duty worked out, conveyancer, inspections, loan fees; each paid by a transaction or
  another way, or added to the loan; suggested costs not yet listed), *Settled — make it a property*.
- **Each property** with tabs **Overview · Money · Loans · Income & costs · Activity · Tax · Sale**: value and
  equity, loans (rate, offsets, the bank's charges, "Use the bank's" repayment), rent and costs, a property manager's
  statement (*Log a statement*), everything logged (Activity), the year so far against the plan (Tax), selling and its
  capital gain (Sale); *Edit details*.
- **Figures** — portfolio summary, equity vs debt, total value over time; *+ Add property*.

## Plan — `/plan/<tab>`

- **Scenarios** `/plan/scenarios` (advanced) — saved in a normal month per scenario (Renting, Buy a house…), the
  12-month cash-flow forecast (lowest balance, settlement), what each month adds or takes, side by side (rate rises,
  *Set beside*, *Full table*), net worth if you buy; each scenario *Show on Today*, *Edit this scenario →*, *+ Add
  scenario*. A scenario is edited on **`/scenario`**: changes, shared items, legs, templates, stress, *Make it real*.
- **Projections** `/plan/projections` (advanced) — long-term net worth in today's dollars, assumptions and life events
  (horizon, return, property growth, inflation, income growth, rate shock, ups and downs), how to read it, details
  and milestones; actual vs expected, projection accuracy, saved vs grown; the range of outcomes (Monte Carlo), also
  on Retirement and in a scenario's comparison.
- **Goals** `/plan/goals` — **Emergency fund** (3/6/12 months of essentials, if one income stopped, what counts as
  essential), **Savings goals** (each with its plan and catch-up), **Can we buy?** (each purchase scenario), **Financial
  independence**. Next year's plan (goals sharing one monthly surplus) is in the Year in review report and set in
  Settings › Preferences.
- **Retirement** `/plan/retirement` (advanced) — your age and when super opens, the 4% rule in today's dollars, when
  you could stop working, Age Pension.

## More — `/more` (phone)

Tax, Reports, Calculators (advanced), Settings, Backup & sync — and **Show everything** (Simple/Advanced).

### Tax — `/tax/<tab>` (opens on Returns 1 July–31 October, else This year)
- **This year** `/tax/year` — **Before 30 June** (moves still open: top up super, prepay…), **Tax & super** per person
  (marginal and effective rate, *Breakdown* flip, take-home pay, the waterfall, super cap, manual sacrifice with *Max
  out cap*), **Check a payslip** (PDF or pasted text; logs pay, sets the salary), household settings (SG %, private
  hospital cover, rebate tier, family thresholds, the rental).
- **Returns** `/tax/returns` — the tax return worksheet in myTax's order per person (income statements, interest,
  dividends, rent, deductions with their codes, private health), each property's rental schedule (*Use logged
  figures*), compared with last year, *Print / save as PDF*, *Copy for myTax*, *Mark as lodged*.
- **Documents** `/tax/documents` (advanced) — what to keep for the year, ticked off, with receipts attached;
  deductions and their receipts.
- **People** `/tax/people` — each person: name (renaming updates everything), date of birth, HELP/HECS, carry-forward
  super, *Remove from tax*.

### Reports — `/reports/<key>`
*Choose report* opens eight families; each report has dates, compare-with, *Pin*, *Print / PDF*, *Download CSV*
(*Share CSV* where supported), *Full table*, and "As of … · Assumptions and data quality".

| Family | Reports (`key`) |
| --- | --- |
| Cash flow | Monthly cash flow (`cashflow`), Spending (`categories`), Income statement (`income`), Where the money goes (`flow`, a Sankey), Year on year (`trends`), Month in detail (`month`) |
| Budget | Budget vs actual (`budget`) |
| Net worth | Net worth statement (`networth`), Net worth check (`nwcheck`), Loans and debts (`debts`) |
| Investments | Investment returns (`invest`), Distributions (`dividends`), Capital gains (`cgt`), Super (`super`) |
| Property | Property P&L (`property`), Property returns (`propreturns`) |
| Tax | Tax summary (`tax`), Rental tax pack (`taxpack`) |
| The year | Year in review (`review`), Year-end pack (`yearend`) |
| For your lender | Lender pack (`lender`) |

### Calculators — `/calc` (advanced)
Stamp duty (state, price, first home buyer), Lenders mortgage insurance, Loan repayments, What a lender might lend.

### Settings — `/settings/<tab>`
- **Categories** `/settings/categories` — each category with its icon, colour and how many lines use it.
- **Preferences** `/settings/preferences` — each part folded: Keeping your data safe (backups, automatic weekly
  backups to a folder, sync through Dropbox or a folder with a passphrase, using it on another device, a passcode,
  storage used, problems the app hit), About this app (version, updates, request a feature), Who changed what (this
  device's name), Your year (financial or calendar), Needs and take-home, Next year's plan, What this household has,
  Explanations, Screens you rarely open (Simple/Advanced).
- **Import rules** `/settings/rules` (advanced) — test a bank description, find a rule, most used / A–Z, one line a
  rule opening in place (words, line, category, account, delete), merge one-rule-per-branch, *+ Add rule*.

### Backup & sync
The avatar menu's backup, the Preferences fold, `welcome.html` (importing a file someone shared).

## Details — `/detail/<kind>/<id>`
One page for any single thing, reached from lists and search: `line` (budget line: its transactions, typical month,
rules), `transaction`, `income`, `account` (balance by the day, buffer), `asset`, `property`, `loan`, `debt`,
`merchant`, `person`, `scenario`. Each has history and "Manage on …".

## Outside the app

| Page | What it is |
| --- | --- |
| `onboarding.html` | The first visit (no saved household): what the app is, *Try it with sample data*, *Start from scratch*. `noindex`. |
| `welcome.html` | For someone sent a shared backup: how to import it. `noindex`. |
| `404.html` | Sends a deep link back into the app (GitHub Pages has no rewrites). |
| `sw.js` | Offline: the app shell and the price file cached. |
| `manifest.webmanifest` | Installable; shortcuts; a share target for statements. |
| `prices/`, `rates/` | The daily price file and the RBA cash rate, written by scheduled workflows. |

## What happens once, first

The setup sheet (`components/firstrun.js`): people and pay, accounts, a month's costs — or the sample household. Then
the tour, and *Start the review* each month.
