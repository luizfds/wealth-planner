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

## 3. `[x]` Month-over-month spending — shipped v2.78.0

Nothing in the app compared you against your own past. Every spending view was "this month", "this
cycle" or "this year" — so it could say you were over budget on groceries, but never that
groceries had climbed three months running.

**What shipped.** `calc/trends.js` (pure) plus a "Spending over time" section on the Spending tab:
a headline (this month against your own recent average), "up N months running" callouts, one bar
strip per category over six months, and the numbers behind it under a `<details>`.

Bar strips, **not** the category-by-month grid this item originally called for — six numeric
columns at 390px is a horizontal scroll you have to work at, and "is this climbing" is a shape
question. The table is still there, one disclosure away.

### The two ways this could have lied, and what it cost to find them

Both were only visible by running the panel against the real backup. Neither would have shown up
in a unit test written from the plan.

**1. An unlogged month looks exactly like a month with no spending.** Anyone who started logging
in August has $0 across every earlier month. The first working version reported *"Groceries up
3,124%"* and *"Car up 2 months running"* — confident nonsense, on the first day the panel is
visible. `coveredMonthCount()` now trims the window to the contiguous run of months that were
genuinely being logged, judged against the median of **this household's own** non-empty months
rather than a fixed dollar figure ("typical" is $600 for one person and $12,000 for another).

**2. A part-finished month can't be compared to whole ones.** Comparing raw reports a fall every
time — useless for three weeks of every month. *Scaling the partial month up to a full one looks
like the fix and is worse*: household spending is front-loaded (rent, power, insurance all land in
week one) and this app's own "Catch up on overdue" flow actively encourages logging in bulk.
Eleven days into September on the real data, that projection turned **$3,067 actually spent** into
a confident **"on track for $8,366"** — a 611% rise that never happened.

Every comparison now runs on a **month-to-date** series: this month so far against the *same days*
of earlier months. It never extrapolates, so there's no model of how spending is distributed to
get wrong. Whole months still drive the bars and the table.

### The limit that survived both fixes — read this before extending it

**The app cannot tell "spent more" from "logged more thoroughly."** Nothing short of a bank feed
can. On the real backup August was logged mostly in its last week and September mostly in its
first, so even a same-days comparison read *"515% more"*.

So deltas and streak alerts are withheld until **three** months are logged
(`TRENDS_MIN_MONTHS_FOR_COMPARISON`); below that the panel shows the bars and the numbers and says
plainly why it isn't comparing yet. Two points can't distinguish a trend from a difference. If you
ever loosen that threshold, this is the reason it exists.

### Smaller calls, each with a test

- A **flat** month breaks a streak rather than extending it, or an unchanged direct debit reads as
  a trend forever.
- Streaks run on **settled** months only — the current part-finished one can't support a claim
  about months.
- The average **excludes** the current month, so an outlier isn't partly compared against itself.
- `$0` this month reads **"none yet"**, not "new" — identical in the data (both have a null
  trend), opposite in meaning.
- Categories under **$50 across the window** are dropped, on the *window* total so a once-a-year
  line (car rego) keeps its place.

### Found while verifying this — fixed in v2.78.1

`navigator.serviceWorker.register("sw.js")` **and** the update check's `fetch("index.html?v=…")`
both used **document-relative** URLs, and `nav.js` has already rewritten the address bar to the
current route by the time either runs. One-segment routes resolved correctly by luck; two-segment
ones (`/expenses/*`, `/assets/*`) resolved to `/expenses/sw.js` and 404'd.

Measured on a fresh load of `/expenses/spending` (a shared link, a bookmark, or a reload):

| | before | after |
|---|---|---|
| Service worker | **none registered** — no offline support | registered, scope `/` |
| "Check for updates" | *"Couldn't read the deployed version"* | reports the real version |

Both now go through `appAssetUrl()` in `nav.js`. `tests/asset-urls.test.js` guards the spelling —
see `PROJECT_KNOWLEDGE.md` for why a source-level guard is the right shape here.

---

## 4. `[x]` Income overrides per scenario — shipped v2.79.0

`scenarioTotals()` called `effectiveIncomeItems()` — the same income rows for every scenario. On
the real backup all three scenarios differed only in housing rows (2 vs 5) and zero shared
overrides, so none of these were reachable: one partner dropping to three days, six months off, the
pay rise not arriving. The page was a housing comparison, not a what-if.

**What shipped.** Income rows carry the same sparse `scenarioOverrides` map `state.shared` rows do,
edited through the same "⇄ Vary" panel.

### Why this wasn't just a copy of the expense mechanism

**A Gross row's amount is an input to the tax engine, not a number you can vary at the end.** Change
it and the marginal rate, the Medicare levy, the SG, the concessional cap and Division 293 all move
with it. So the override is applied at the *bottom* of the chain — every read of a Gross row's
amount goes through `resolveSharedAmount` — and `personSuperRows` / `personIncomeBreakdown` /
`computePersonTax` all take an optional `opts` (`{scenario, includeRow}`). Omitted, each behaves
exactly as before, which is what leaves the Income page, `calc/fire.js` and the tax panels alone.

Measured: halving a $14,520.83/mo gross salary drops that scenario's income by **$4,532/mo, not the
naive $7,260** — the brackets doing their job, which a net-side override could not have expressed.

`scenarioIncomeRows()` is the single definition of "what does this scenario earn", used by
`scenarioTotals`, `computeNetWorthSeries` and `calc/cashflow.js` alike. Storing a synthetic net row
per person *per scenario* in `state.income` was rejected — N×M computed rows in the Income list, and
those rows are a display artifact, not the source of truth for any total.

`opts.includeRow` exists because `computeNetWorthSeries` honours `item.endDate` year by year and the
filter has to reach **inside** the tax chain: a salary that ends in three years must stop being
taxed, not just stop being counted.

Verified byte-identical output (totals, 20-year series, 12-month cash flow, all three scenarios)
against the previous implementation on the real backup with no overrides set.

### Two pre-existing bugs fixed along the way

- **Renaming or deleting a scenario only walked `state.shared`.** An income override would have been
  silently orphaned: the map keeps the old key, `resolveSharedAmount` stops finding it, and the row
  reverts to its default with nothing on screen to say why. Both paths now walk one
  `overridableRows()` list — **add a third overridable array and this is the place to edit.**
- **`selectScenario()` re-rendered only the Dashboard.** The Expenses budget list pulls in
  `state.home[activeScenario]`, so switching scenarios left it showing the *previous* scenario's
  housing rows — three where the new scenario has five — and with them the budget total, the
  category charts and the Actual-vs-Planned panel. Confirmed on `main` before fixing. Every scenario
  mutation now goes through `refreshScenarioDependentViews()`.

### UI notes

The "⇄ Vary" panel is generalised from `state.shared` to a `(section, idx)` pair, and refuses
anything but `shared`/`income` **by construction** rather than by a check someone can forget —
housing rows already belong to one scenario, property costs are global. Computed rows get no button
at all, which matters more on Income (most of that list is computed) than it did on shared.

A collapsed row that varies carries a **"⇄ $7,260.00 in Buy Sydney"** pill naming the active
scenario's own figure. The list shows the *default* amount, so without it the Income page could read
$14,520 while the scenario on screen used half that.

---

## 5. `[x]` Financial year as a first-class period — shipped v2.80.0

A tax return is a **financial-year** document. The app gained the concept in v2.72.0 but only on
reserve budgets, one line at a time — so the *household* had no year: every spending view was "this
month" or "this cycle", the shares YTD timeframe was hardcoded to 1 January, and nothing could
answer "what did we spend this financial year".

**What shipped.** `state.yearBasis` — `"financial"` (default) or `"calendar"` — under a new
**Accounts → Preferences** tab, plus `householdYearBasis()` / `householdYearWindow()` /
`householdYearToDate()` / `householdYearProgress()` in `calc/ledger.js`.

`"rolling12"` is deliberately **not** offered at household level even though `reserveYearWindow`
supports it per line: a rolling window is a way of budgeting one lumpy line, not a year anyone else
recognises, and "what did we spend last year" has to mean something you could put in front of an
accountant.

### What follows it

| Surface | Before | Now |
|---|---|---|
| Spending tab | "this month" / statement cycle only | **"This year so far"** panel — total + category breakdown with shares |
| Exports | config snapshots only | `exportYearTransactionsCsv()` — dated, categorised, period in the filename |
| Reserve lines | unset fell back to a hard `calendar` | unset means **follow my year** |
| Shares timeframe | `YTD` hardcoded to 1 Jan | `FYTD` on the financial basis, measured from the day before the year opened |
| Tax & super | no period named | heading names the year being estimated |

**The year panel is year-to-*date*, never the whole year.** On 11 September an FY is 20% done, and
a figure that silently covers ten weeks while reading like a year is the same failure the spending
trends panel exists to avoid. Nothing is scaled up to a full year, and the panel says how far
through it you are.

**The transactions export is the first period document in this app.** Every other CSV answers "what
does my budget look like"; this answers "what did I spend between these two dates". The category is
resolved through the linked budget line — most transactions carry none of their own, so a raw
`t.category` column would be empty on exactly the rows it matters for.

### Two decisions worth not re-litigating

- **`householdYearWindow` relabels the calendar basis** from `"this year"` to the year number.
  `"this year"` reads correctly in the sentence `reserveYearWindow` was written for (a row's "$X
  actual / $Y planned this year") but as a household year it lands in "$4,953 logged in ___" and in
  an export filename. The per-line label is untouched.
- **A reserve line's explicit basis is never overwritten.** Migration blanks only lines stamped with
  the old *implicit* `calendar` default, so a deliberate choice survives a household change.

**Measured on the reference backup:** FY26/27 so far is $4,244 across 47 transactions (20% through);
the same data on a calendar basis is $4,953 across 50.

One bug caught by a test written first: `householdYearProgress` guarded with `nowMs <= startMs`, so
1 July — day one of 365 — reported 0% through the year for the whole of its first day.

`calc/ledger.js` now imports `state.js`. Leaf-ward, not a cycle: `state.js` imports only
`constants.js` and `lib/toast.js`.

---

## 6. `[x]` Tax: HECS first, then deductions — all six shipped, v2.81.0–v2.86.0

`calc/tax.js` covers brackets, Medicare levy, super caps, Division 293, and an honest split between
blended take-home and what lands on a payslip. Not yet modelled, roughly by how many Australians
they affect:

| Gap | Note |
|---|---|
| `[x]` HECS / HELP | **Shipped v2.81.0.** Per-person balance on the Tax & super card; a flat-rate (not marginal) repayment withheld from take-home, with the next threshold and what crossing it costs. Repayment income adds back salary sacrifice and any rental loss, so neither reduces it. On the reference backup a $45k balance cuts household net savings **$8,727 → $7,040/mo**. |
| `[x]` Deductions | **Shipped v2.83.0.** Any budget line can be flagged work-related, with a **share** (a phone bill is rarely 100%) and a person. Reduces taxable income, so it cascades into the levy and the MLS tier — but *not* HELP, which is worked out on gross. The panel leads with what the deduction is **worth** at the marginal rate, not what it cost. The year's transactions CSV carries the flag, share and claimant. |
| `[x]` Dividends & franking | **Shipped v2.84.0.** Dividend **per unit** (so it follows the holding when units change) + franked %. Declared **grossed up**, credit as a **refundable** offset — so above a 30% marginal rate a fully franked dividend still costs a top-up, and at a low rate it pays more than the company distributed. Both stated on the card. |
| `[x]` Capital gains | **Shipped v2.85.0.** A sale event per holding (`asset.sales[]`) that reduces the units held, with the **12-month discount** — "more than" 12 months, exactly: 366 days, so a sale one day early costs half the discount. Losses are never discounted. Bounded to the household year, since a sale is a one-off rather than a rate. |
| `[x]` Medicare levy surcharge | **Shipped v2.82.0.** Household toggles for private hospital cover and family thresholds; flat-rate (not marginal) tiers, with the next tier and its step cost. Always states both directions — with cover it names what the cover is saving, so "is a policy worth it" is answerable. Family tiers are set by **combined** household income, then charged on each person's own. |
| `[x]` Property depreciation | **Shipped v2.86.0.** Capital works (2.5% of **construction** cost — not the purchase price; land isn't depreciable — for 40 years) and plant & equipment (straight-line over an effective life). Reduces the **taxable** result only; `propertyCashResultAnnual()` is the untouched cash figure. On the reference backup $13,300/yr, taking the IP result from −$8,106 to −$21,406 and household net savings from $8,339 to $8,820/mo. |

---

## 7. `[x]` Bank CSV import — shipped v2.91.0–v2.93.0

**Problem.** Every figure on the Spending tab, and every claim the trends panel is allowed to make,
depends on transactions having been logged by hand, one at a time. Item 3 shipped with a
three-month coverage gate precisely because that's a burden most people don't sustain — the panel
refuses to compare months it can see were only partly logged, which is honest but leaves the whole
feature dark for a new user's first quarter.

The bank already has the data. Importing one statement replaces three months of tapping.

**What to build.** Three increments, one PR:

- **a. A parser that survives real bank exports** (`calc/bank-import.js`). No two Australian banks
  agree on a shape: some have no header row, some split Debit/Credit into two columns, some put
  spending as a negative Amount. Dates are `DD/MM/YYYY` here and `03/04/2026` is 3 April — getting
  that backwards silently moves a third of a year's spending into the wrong months. Duplicate
  detection matters as much as parsing: re-importing an overlapping date range must not
  double-count.
- **b. Rules that learn** (`state.importRules[]`). "WOOLWORTHS 1234 SYDNEY NS" should become
  Groceries once, not every month. The payoff isn't the first import, it's the second.
- **c. The review-and-confirm UI**, mobile-first, on the Spending tab — and the trends empty state
  pointing at it, since importing a year of history is now the fastest way past the coverage gate.

**How to verify.** Drive it with real bank-shaped files, not hand-written ideal ones: a headerless
CommBank-style export, a Debit/Credit-split export, and the same file imported twice.

**What shipped.** `calc/bank-import.js` (parse), `calc/import-rules.js` (learn),
`components/bank-import.js` (review). 51 new tests, 312 total.

**Measured, driving a 12-row headerless CommBank-shaped file against the reference backup:**

| | Result |
|---|---|
| Rows → decisions | 12 transactions became **8 merchant groups**; Woolworths' three different store strings collapsed into one |
| First import | 1 of 11 placed automatically (a "Spotify" budget line matching SPOTIFY P2B3C4) |
| Same file again | "0 transactions to import. 11 already logged." No import button offered. |
| A *different* statement afterwards | **3 of 3 placed automatically**, all badged "learned" — zero decisions |

**Three things that turned out to matter more than the parsing:**

- **Group by merchant, not by transaction.** A month is ~40 rows and ~12 merchants. Being asked
  "where does WOOLWORTHS go" eight times is how a review screen gets abandoned halfway down.
- **Don't re-render on assignment.** The obvious implementation moves a row from "Needs you" to
  "Ready" the instant it's answered — reordering the list under the finger that just answered it.
  `patchBankImportPanel()` updates the badge and counts in place and leaves the row alone.
- **Learn from untouched suggestions too.** Confirming the import is confirming the suggestion, so
  a name match the user never opened still becomes a rule. That's what makes coverage climb with
  use instead of sitting wherever the budget line names happened to land it.

**The bug a review pass caught after shipping, worth knowing about before touching this again:**
a transaction logged *by hand* carries no description — `logExpenseTransaction()` leaves `what`
blank on purpose so the row shows its budget line's name. So duplicate detection, which keys on
date + amount + description, saw nothing in common between a hand-logged purchase and the same
purchase arriving in a statement. The person this feature is *for* — someone who has been logging
by hand and is now importing instead — would have re-imported their whole overlap and watched their
spending silently double. Those are now `possibleDuplicate`: matched on date + amount alone, which
is weaker evidence, so they're excluded by default, counted out loud, and opt-in-able. Fixed in
v2.94.0.

**A trap, and the one bug that got through to the browser:** `merchantKey` lives in
`import-rules.js`, not `bank-import.js`. Importing it from the wrong module passes `node --check`
*and* the whole test suite — the tests import the calc modules directly and never load the
component — and fails only when the page runs. Exactly the class of bug `CLAUDE.md` warns about.
Driving the app is not optional here.

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
