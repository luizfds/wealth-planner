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

## 2. `[ ]` Make the projection honest about time

Three related changes to one model (`computeNetWorthSeries` in `calc/engine.js`). Best done
together — they interact, and two of them currently mask each other.

### 2a. `[ ]` Inflate the FI target alongside the series

The series grows assets nominally and inflates expenses 3%/yr, but the FI target is computed once
from *today's* expenses and never inflated — a nominal series measured against a real target.

Real data, Renting: target $2,760,893 crossed at **year 9** as reported, **year 12** once the
target rises with the same 3% the model already applies to expenses.

Either inflate the target or deflate the series to today's dollars. The second option also makes
every figure on the Projections page something a person can hold in their head.

### 2b. `[ ]` Add an income growth rate

`incomeMonthly` is read **once, before the year loop**, and held flat for the whole horizon while
expenses inflate. Real data: income $23,340/mo at 0%/yr against expenses $14,613/mo at 3%/yr — the
model has the $8,727/mo surplus **going negative around year 16**, then spends four years of a
20-year horizon assuming a drawdown.

Add a rate to `state.projection`, defaulting to the inflation rate so the surplus at least holds
its real value. Income rows now record pay changes (`item.history`, v2.74.0) — the honest version
derives a suggested default from that history rather than only asking.

> **Note the interaction.** 2a is optimistic and 2b is pessimistic, so they partly cancel today.
> Shipping either alone will visibly move the headline in one direction. Ship both, and say so in
> the PR.

### 2c. `[ ]` Let ledger rows end

No income or expense row has a start or end date, so childcare that finishes in two years and a car
loan with eighteen payments left are both projected forever. Add an optional "until" date per row,
honoured by `computeNetWorthSeries` and `calc/cashflow.js`.

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
