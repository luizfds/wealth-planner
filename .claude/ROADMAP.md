# Roadmap

The agreed build order, from the September 2026 audit. **Keep the status markers current** — this
file is how a session that didn't run the audit knows what's already been done.

Status values: `[ ] To do` · `[~] In progress` · `[x] Done`

When you finish an item: flip its marker, note the version it shipped in, and strike anything in
"How to verify" that turned out to be wrong. When you start one, flip it to `[~]` in the *first*
commit of the work, not the last — two sessions picking up the same item is the failure this file
exists to prevent.

---

## Why this order

The first two items are **corrections** — the app currently states things that aren't true. The
rest are **capability**. Correct numbers first, because a wrong headline erodes trust in every
other figure on the page, and because items 3–6 all feed the same screens.

Every number quoted below was measured by driving the app against a real exported backup
(30 shared lines, 3 scenarios, 1 investment property, 53 transactions) at v2.75.0 — not inferred
from reading the code.

---

## 1. `[x]` Fix what the FI panel counts — shipped v2.76.0

**Problem.** `renderFireProgress()` (`components/dashboard.js`) measures progress as
`totalNetWorthValue()` against a 4%-rule target. That net worth is *everything you own*:

| Component | Real data | Can it fund early retirement? |
|---|---:|---|
| Super | $179,806 | Not until preservation age (60) |
| Vehicle | $10,696 | No |
| Shares + Cash | $25,106 | Yes |
| Property equity | balance | Only investment property |
| **Reported progress** | **20.3%** | overstated |

Super alone is 32% of the figure driving that percentage. Worse, `propertiesTotalEquityToday()`
(`calc/property.js`) sums **every** property regardless of `kind`, so switching to a Buy scenario
folds the equity in the home you live in into a number you'd supposedly live off.

**What to build.** Split the FI figure into what actually funds early retirement — shares, cash,
investment-property equity — and show super as a separate bar that unlocks at 60. In Australia the
gap between a target retirement age and preservation age is the whole planning problem; the app
can't currently see it.

**What shipped.** `calc/fire.js` — a pure module answering both questions rather than one: whether
the pot will ever be big enough (the 4% rule the app already had) *and* whether you can reach
preservation age on the money that isn't super. Two ages on the panel ("I'm 38 and want to stop
working at 50") drive a year-by-year simulation in **today's dollars** — a real return, which
sidesteps item 2a's nominal-vs-real mismatch for this panel entirely — with a timeline showing the
saving years and the bridge years, coloured by whether the bridge survives.

**Measured on the real backup:**

| | Old panel | Now |
|---|---:|---:|
| Figure driving the headline | $559,607 (total net worth) | $369,111 accessible |
| Super | counted in it | $179,806, shown separately as locked until 60 |
| Vehicle + home equity | counted in it | $10,690, shown as excluded |

At 38 targeting 50: passes, with a 10-year bridge costing $1,104,357. At 38 targeting 40: fails the
bridge, and the panel names 50 as the earliest age that works.

**A trap if you touch this:** `propertyEquityToday()` already folds in the offset balance and
`liquidAssetsValue()` counts offsets too, so combining them double-counts every offset dollar.
`fireWealthSplit()` uses `propertyIlliquidEquityToday()` for the property side for exactly this
reason.

**Deliberately still open:** only *investment* property equity counts as accessible — a PPOR is
excluded on the grounds that selling it means buying or renting another. If downsizing should ever
be modelled, that's the line to revisit.

---

## 2. `[x]` Make the projection honest about time — shipped v2.77.0

Three related changes to one model (`computeNetWorthSeries` in `calc/engine.js`), plus a fourth
the work uncovered. Done together because they interact and two of them masked each other.

### 2a. `[x]` Show the projection in today's dollars

**Scope changed once item 1 shipped.** The original finding was a nominal series measured against
an FI target frozen in today's dollars (year 9 reported vs year 12 like-for-like). Item 1 replaced
that panel with a real-terms model, so ~~that comparison~~ is gone.

What shipped is the other half: a `Today's dollars / Future dollars` segmented control on the
Projections page (`state.projection.realTerms`, defaulting to real), with the headline, the
chart's aria-label and the Dashboard's projected-net-worth tile all naming the basis. Callers can
pin it — the projection-accuracy panel passes `{ realTerms: false }` because it grades a stored
reference series against real logged net worth, which is nominal by nature.

### 2b. `[x]` Add an income growth rate

`incomeMonthly` was read **once, before the year loop**, and held flat for the whole horizon while
expenses inflated. Real data: income $23,340/mo at 0%/yr against expenses $14,613/mo at 3%/yr —
the model had the $8,727/mo surplus **going negative around year 16**, then spent four years of a
20-year horizon assuming a drawdown.

`state.projection.incomeGrowthRate`, defaulting to 3 (matching the inflation default), with its
own number+slider pair on the Projections page. ~~The honest version derives a suggested default
from `item.history`~~ — not built; the rows record pay changes (v2.74.0) but nothing reads them
back as a suggestion yet. Worth doing, and cheap now that the field exists.

### 2c. `[x]` Let ledger rows end

Optional `item.endDate` per row, offered as "Ends (optional)" in the shared `timingFieldsHtml()`
so every ledger page (Income, Expenses, Scenarios housing, property income/expenses) gets it at
once. `calc/ledger.js` gained `isActiveOn` / `isActiveInYear` / `sumFieldActiveInYear`; blank
means "runs forever", which is what every pre-existing row carries and what the model assumed for
everything until now.

Honoured by `computeNetWorthSeries` and by `calc/cashflow.js`, which now sums its smoothed side
**per month** rather than once — otherwise a row ending in month eight would never free up cash in
month nine. A collapsed row carries an "Ends …" pill, red once the date has passed, because a row
still sitting in the list after it ended is still inflating every per-month total on the page.

### 2d. `[x]` The one this uncovered: a renting scenario was never charged rent

Not in the audit, found while verifying 2c — ending the rent row changed the projection by $0.

`scenarioInflatableMonthly()` dropped the `homeLoanRow` because with the purchase leg **on** that
row is the mortgage, which the model replaces with its own amortised repayment (counting both
would charge the same housing cost twice). But with the purchase leg **off**, the very same row is
the rent, and nothing else was paying it. On the real backup the projection assumed **$3,510/mo
more savings** than the Dashboard's own net-savings tile showed for the same scenario.

The decision now lives in one place, `scenarioInflatableHomeItems()` in `calc/property.js`, with
the invest-leg-beats-purchase-leg precedence `computeNetWorthSeries` uses. **If you touch the
homeLoanRow, this is the trap** — the row's meaning depends on the scenario's purchase leg.

**Measured at year 20 on the reference backup** (20-year horizon, 7% / 5% / 3% / 3%). Only Renting
has an uncharged `homeLoanRow`, so only Renting moves:

| today's dollars | before rent fix | after |
|---|---:|---:|
| Renting | $6,373,317 | $5,094,846 |
| Buy Sydney | $5,322,626 | $5,322,626 |
| Buy Melbourne | $5,575,582 | $5,575,582 |

That **changes the headline's winner** from Renting to Buy Melbourne. "Renting comes out ahead"
was an artefact of not charging it rent.

On Renting, what v2.76.0 showed against what this ships: $8,002,576 (nominal, income flat) against
$5,094,846 (today's dollars, income growing 3%, rent counted) — the same figure in future dollars
is $9,201,859. 2a is optimistic and 2b pessimistic, so they partly cancel; the rent fix is what
actually moves the ranking.

---

## 3. `[ ]` Month-over-month spending

Nothing in the app compares you against your own past. Every spending view is "this month", "this
cycle" or "this year" — so it can say you're over budget on groceries, but never that groceries
have climbed three months running.

**The data is already there and correctly shaped**: dated transactions carrying a category through
their linked budget line. `transactionsInMonth` and `transactionsInRange` exist; nothing calls them
across more than one window. A category-by-month table and a "vs your 3-month average" line on the
Spending tab need no new data model.

Cheapest real capability on the list, and the one that makes daily logging pay off.

---

## 4. `[ ]` Income overrides per scenario

`scenarioTotals()` calls `effectiveIncomeItems()` — the same income rows for every scenario. On the
real backup all three scenarios differ only in housing rows (2 vs 5) and zero shared overrides. So
none of these are reachable: one partner dropping to three days, six months off, the pay rise not
arriving, selling the property.

The `scenarioOverrides` mechanism already on `state.shared` is the right shape — extend it to income
rows. Then the page's framing moves from housing comparison back to what-if.

---

## 5. `[ ]` Financial year as a first-class period

A tax return is a **financial-year** document. The app gained the concept only in v2.72.0, on
reserve budgets, one line at a time (`reserveYearWindow` in `calc/ledger.js` already knows Jul–Jun
and labels it `FY26/27`).

Promote it: a household-level preference, honoured by the spending views, the CSV exports and the
tax panel. **Do this before item 6, not during** — it's what makes the tax work cheap instead of
repetitive.

---

## 6. `[ ]` Tax: HECS first, then deductions

`calc/tax.js` covers brackets, Medicare levy, super caps, Division 293, and an honest split between
blended take-home and what lands on a payslip. Not yet modelled, roughly by how many Australians
they affect:

| Gap | Note |
|---|---|
| `[ ]` HECS / HELP | No concept at all. A compulsory repayment is a real deduction from take-home, so every net figure is currently too high for anyone carrying a debt. **Do first** — it corrects numbers already on screen. |
| `[ ]` Deductions | Nothing anywhere. Work-related expenses, donations, tax agent fee. Expense rows could carry a deductible flag and roll straight into a return. |
| `[ ]` Dividends & franking | Shares are tracked by quantity and price; dividends and franking credits don't exist. |
| `[ ]` Capital gains | Cost basis is stored, but there's no sale event and no 12-month CGT discount. |
| `[ ]` Medicare levy surcharge | Not modelled, so the app can't answer whether private hospital cover is worth it — a question it has every other input for. |
| `[ ]` Property depreciation | Interest and expenses flow into gearing, but there's no capital works or plant schedule — usually the largest non-cash deduction on an investment property. |

---

## Conventions for whoever picks this up

Read `CLAUDE.md` and `.claude/PROJECT_KNOWLEDGE.md` first — in particular the version-and-tag rule
and the one-PR-per-coherent-piece rule, both of which apply to every item here.

- **One item, one PR.** Sub-items (2a/2b/2c) may share a PR where they interact; say so in the body.
- **Verify by driving the app**, not by reasoning about the code. This project has no test framework
  for UI; `npm test` covers `calc/` only. Several findings in the audit were only visible because
  the app was run against real data.
- **Anything that changes a headline figure** gets the before-and-after in the PR body. These items
  move numbers the user has already read and formed expectations about.
