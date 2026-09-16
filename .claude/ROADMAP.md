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

## 8. `[x]` Finish what item 7 started — shipped v2.95.0–v2.97.0

Three things item 7 measured and left standing.

**a. The import can't create a budget line.** Importing 12 rows into an app with no budget set up
placed **0 of 11** — all 8 merchant groups in "Needs you", and the only options in the dropdown were
the seeded housing rows. So the importer works beautifully if you've already built a budget by hand
and does almost nothing if you haven't. It already knows the merchant, the category you pick, and
what you actually spend there, which is everything a budget line needs. Creating one from a group
turns a single statement into a working budget — the onboarding path this app has never had.

**b. Refunds are dropped.** Credits are parsed, counted and named in the review screen, then thrown
away on import. Return a $220 jacket and your spending should fall $220; right now it can't, because
a transaction has no way to be negative. The parser already identifies them — it's the model and
the UI that don't accept them.

**c. Mobile density, the half of the audit that didn't get fixed.** The Tax & super card is
**1,828px** on an 844px viewport (v2.89.0 fixed the legend, not the stacked wall of prose notes
below it), and the Expenses page is **4,852px**. Both measured at 390px against the real backup.

**How to verify.** Same as item 7: drive it. For (a), a genuinely empty app — the case that
motivated it. For (b), a statement containing a real refund, checking the category totals and the
month rollup both move *down*. For (c), re-measure the same two numbers rather than eyeballing.

**What shipped, measured at 390px against the real backup:**

| | Before | After |
|---|---:|---:|
| Empty-app import, rows placed | 0 of 11 | 3 budget lines created, $1,890 / $240 / $138.70 per month |
| Tax & super card | 1,863px | **1,514px** |
| Expenses page | 4,958px | **2,100px** collapsed (4,973px expanded, one tap) |
| A refunded $420 booking | unrepresentable | line nets $200 |

**Three things worth knowing before touching this again:**

- **The amount on a created budget line divides by the months the *import* covers**, not the
  months that merchant appears in. Shopping somewhere in two of three imported months is still a
  three-month average; the other reading overstates the line by half, and this figure becomes a
  budget the user plans against.
- **A credit is ambiguous and the app must not guess.** It cannot tell a $220 refund from a $220
  salary instalment from a transfer between your own accounts. Money-in rows sit in their own
  section, default to "don't import", and only become a (negative) transaction once assigned to a
  budget line — which is the user saying "this is a refund".
- **A proportional bar cannot draw a negative slice.** A category that nets negative inverts its
  own width *and* shrinks the denominator, pushing every other slice past its true share — $300 +
  $150 − $40 rendered as 110% of a 100% bar. `categoryChartHtml()` builds the bar from the positive
  categories only; negatives stay in the legend.

**A dev-server trap, not an app bug:** the app uses real paths (`/expenses/budget`), and
`python3 -m http.server` has no SPA fallback, so reloading a deep link 404s locally. GitHub Pages
(`404.html`) and the service worker both handle it. Navigate to `/index.html` in a test rather
than calling `reload()`.

---

## 9. `[x]` Look at your data over time — shipped v2.98.0–v2.99.0

Measured from the reference backup, the app captures far more history than it shows:

| | Holdings | With history | Points | Span |
|---|---:|---:|---:|---|
| **Super** | 2 | 2 | 7 | **2025-07-31 → 2026-08-31 (13 months)** |
| Cash | 1 | 1 | 3 | 13 months |
| Shares | 11 | 11 | 129 | 9 days |
| Property | 1 | 1 | 3 | — |
| Net worth log | — | — | 5 | — |
| Vehicle | 1 | 0 | 0 | never logged |
| Debts | 1 | 0 | 0 | never logged |

Shares — nine days of history — has a dedicated chart *and* a 1D/1W/1M/3M/6M/1Y/YTD/All
window picker. Super, with the longest history in the file, has a 56px row sparkline and a
share of one combined net-worth line. Transactions have no time control at all: the list is
the 10 most recent or all 53, with nothing in between, and every figure on the Spending tab
is either this-month or this-year.

**a. One time-range control, used in more than one place.** Extract the Shares window picker
into a shared lib and put it on Transactions.

**b. Value over time per asset category**, not just Shares — the same chart, driven by the
category subpage you are already on.

**c. Allocation over time.** A stacked area of Super / Shares / Cash / Property equity. A single
net-worth line cannot answer "am I getting more property-heavy".

**d. Income vs spending vs saved, by month.** 53 dated transactions and full income data exist;
the Dashboard only ever shows one month.

**e. Contributions vs growth.** Net worth rose — how much was money you added versus assets
appreciating? The highest-insight chart in a wealth tracker, and the one most easily made
dishonest, since the split is an inference and has to be labelled as one.

**How to verify.** Drive it. Colour is computed, not eyeballed: every categorical subset goes
through the dataviz validator before shipping (the existing 8-slot palette passes adjacent-pair,
but each chart's own subset needs `--pairs all`).

**What shipped, and the three things that only driving it caught.** All four charts were built,
run against the real backup, found to be lying, and rebuilt. The arithmetic was never wrong.

1. **"Kept $21,713/mo"** — the cash-flow panel subtracted *logged* spending from income. Logged
   averaged $777/mo against a $14,613/mo budget (5%), so it was measuring how little had been
   typed in and calling it thrift. The household keeps $8,339. `spendCoverage()` now gates the
   savings claim at 80% coverage; below that the panel says what it has.
2. **"$290,911 of growth"** — super and cash were logged from July 2025, shares and the property
   only from August 2026, so ~$385,000 of that was assets that merely began being tracked.
   `fullCoverageFrom()` opens the window only where every asset tracked now was already tracked,
   and the panel names what it set aside.
3. **A property acquired over twelve months** — the stacked bands were linearly interpolated, so
   an asset first logged in August 2026 ramped smoothly from July 2025. Stepped now, which is
   what `valueOn()` always meant. The x labels were also picked by array position and, because
   observation dates cluster, overprinted four labels into a smear; they're spaced by time with a
   56px minimum gap.

The lesson worth keeping: a chart is not verified by its tests passing. Each of these three
produced correct numbers from correct inputs and still told a false story.

---

## 10. `[x]` Make the new charts readable — shipped v3.0.0

Found by driving v2.99.0's four charts against the real backup, in **both** colour schemes — the
first pass had only ever been looked at in light mode.

**What was wrong.**

1. **Every legend swatch was invisible.** `.rule-swatch` and `.rule-seg` set a background only for
   their four *named* variants (`.needs`, `.wants`, `.savings`, `.na`) and for `.cat-seg`. The new
   charts pass `series-color-N`, which sets `--series-color` and nothing else — so all nine
   swatches across the allocation, cash-flow and saved-vs-grown legends computed to
   `rgba(0, 0, 0, 0)`, and the saved-vs-grown bar drew two zero-alpha segments over an empty
   track. A stacked chart encodes identity in colour alone; its legend had no colour.
2. **The band separators were the wrong colour in both schemes.** They stroke `var(--paper)` —
   the page background — but every one of these charts sits inside a `.ledger` or `.panel` card,
   which is `var(--paper-raised)`. Invisible on white, a black hairline on dark.
3. **"Where your wealth sits" was 95% empty.** Thirteen months of x-axis for a dataset whose
   composition only exists in its last fortnight: one flat blue slab, and the actual mix crushed
   into a 20px sliver at the right edge.
4. **Three different net-worth numbers on one screen.** "Net worth over time" and "Saved vs grown"
   both label their total *net worth* while omitting `state.debts` — $576,367 against the
   $559,604 in the page header, a $17,000 credit-card limit apart.
5. **"Today" wasn't today.** `categorySeries()` took the last logged snapshot over the amount
   currently typed in the app whenever any history existed, contradicting its own docstring.

**How to verify.** Assets → Summary and Dashboard → Insights, at 390px, in light *and* dark:
read `getComputedStyle(swatch).backgroundColor` rather than looking at it, and check the chart
totals against the page-header net worth.

---

## 11. `[x]` Fix the line chart the way the stacked one was fixed — shipped v3.1.0

Item 10 fixed `renderStackedAreaChart`. Its sibling `renderLineChart` — which draws "Net worth over
time", every asset category's history, the shares history, total property value and the projections
— still has the same defects, measured on merged main at 390px.

1. **Every label renders 6px tall.** A nominal 720-unit viewBox scaled uniformly into a 316px box
   paints an 11px font at 6px. Unreadable on a phone.
2. **It interpolates straight across gaps nobody logged.** On the reference data the observations
   are Jul 2025, Aug 2025, then nothing until Aug 2026 — and the line draws net worth climbing
   smoothly from $166k to $650k across that year. What happened was flat super for twelve months
   and a jump in one week, when the property and shares were first entered. This is the same
   fabrication stepped geometry was introduced to stop in the stacked chart, and it is the same
   class of error as the "$290,911 of growth" and "kept $21,713/mo" claims already gated: the app
   asserting a shape that is an artifact of when logging started.
   Stepping is right for *logged history* and wrong for *projections*, which are a continuous
   model — so it is per-call, not global.
3. **No time-range control**, so the same 95%-empty framing with no escape hatch.

Plus, on the panel item 10 touched: **"Markets took $91,361"** is, on the reference data, the
household's own revaluation of the house from $900k to $812k, over 0.4 months. The arithmetic is
right; the word "markets" makes a manual valuation edit read as a crash.

**How to verify.** Assets → Summary at 390px in both schemes: measure `getBoundingClientRect()` on
the axis labels rather than looking at them, and check the line's shape between Aug 2025 and Aug
2026 against what was actually logged.

---

## 12. `[x]` Touch targets and accessible names — shipped v3.2.0

Measured across all eight pages at 390px, counting only controls a user can actually see and reach:
**261 under 40px tall against 53 at or above it.** On an app built mobile-first and used daily on a
phone, 83% of the interactive surface was below comfortable thumb size.

Two tiers, and they were not equally urgent. Failing WCAG 2.2 AA (2.5.8 wants 24x24 CSS px): the
edit-panel checkboxes at 13px, `.proj-slider` at 16px — a range control whose entire grabbable
height was 16px — `.proj-legend-item` and `.debt-what` at 21px, `.asset-log-btn` and
`.home-setactive-btn` at 22px, `.prop-kind` at 23px. Passing AA but well short of the 44pt/48dp
platform guidance: `.seg-option` at 26px (the time-range control shipped in items 10-11), `.btn` at
27px and 35px, and every form field at 29-31px — `.f-what`, `.f-amount`, `.f-freq`, `.f-account`,
the whole property and loan editing surface, the account manager.

**What shipped.** Two sizes, set on the shared control rules rather than patched per page: 44px for
something you tap on its own (`.btn`, `.m-add-row`, a checkbox's whole label row), 40px for controls
that come in runs — form fields down an edit panel, segmented options, chips, icon buttons — where
44 each would push a list well past a screenful for little gain. The slider keeps its 4px track and
14px thumb; only the box around them grew. Checkboxes went 13px -> 22px, and because each `<input>`
sits inside its `<label>`, the 44px row is the target (verified: clicking the label toggles it).

Result: **261 -> 7**, and the 7 are deliberate. `.proj-legend-item` at 32px (a chart legend toggle,
above AA, and 40px each would shove the chart down a row); `.calc-hint-link` at 24px (a link inside
a sentence — WCAG 2.5.8 exempts targets in a block of text, because growing them vertically overlaps
the lines around them); and the two 22px checkbox boxes, whose label rows are the real 44px target.

**Also: 19 inputs had no accessible name** — the five Projections fields and the super-guarantee
rate had visible `<label>` text with no `for`, and the per-person tax fields and per-property fields
had none at all. A screen reader announced "edit text, blank". The singletons got `for`/`id`; the
repeating ones got `aria-label` instead, since one id across several people or properties would
collide. The tax fields name the person, so several in a row are tellable apart.

**The cost, stated plainly.** Lists and edit panels are taller: on Projections the chart is pushed
noticeably further down, and Properties and Accounts fit fewer rows per screen. 40px on dense fields
rather than 44 was chosen to limit that.

**How to verify.** Drive all eight pages at 390px and count controls under 40px that pass
`checkVisibility()` — a before/after count is the acceptance test, not a visual impression.

---

## 13. `[x]` The first five minutes — shipped v3.3.0

Every audit so far has driven the app against a real exported backup. Nobody had ever driven it
*empty*, which is how every user starts. The empty state itself turned out sound — every page
renders, nothing shows NaN or undefined, and there are 1-12 empty-state notes per page — but the
path into the app has real problems.

1. **Both ways in are below the fold.** `onboarding.html` is 1374px tall on an 844px viewport.
   "Try it with sample data" sits at 1155px and "Start from scratch" at 1209px, so a first-time
   visitor must scroll 1.4 screens on faith before seeing any way to begin.
2. **The dashboard tells phone users to click a button that isn't there.** The intro copy reads
   'add your own numbers or click "Sample data" above'. Measured at 390px, `#mockDataBtn` computes
   as hidden and the mobile equivalent is inside the closed More menu — also hidden. At 1280px the
   button is visible (96x40). So the sentence is true on desktop and points at nothing on a phone,
   which is this app's primary surface, at the one moment a new user most needs it.
3. **`Go here instead ->` is 33px** with an empty `class` — inline-styled, so it slipped through
   item 12's touch-target pass.
4. **The empty projection chart draws a $0-$1 axis**, from renderLineChart's `yMax = yMin + 1`
   degenerate-range guard leaking into the axis labels.
5. **The FAB covers the last dashboard card** when the page is too short to scroll it clear.

**The product call** (the user delegated it): keep the intro, stop it gating entry. A stranger
following a link genuinely needs to know what this is — there are no accounts and no other
explanation anywhere. What it must not do is hide both CTAs behind a scroll. It is a once-per-device
screen (`hasSeenIntro`), so it should cost one glance: value proposition and both CTAs above the
fold, the feature detail below for anyone who wants it.

And for (2): don't fix the sentence. An empty dashboard should not describe where a control lives,
it should offer the action. Real buttons in the empty state remove the broken reference entirely and
are better on desktop too.

**How to verify.** Load `onboarding.html` at 390x844 with a cleared localStorage and assert both
CTAs have `top < 844`; then click through to an empty app and check the dashboard offers an action
rather than naming one.

---

## 14. `[x]` A thread through the eight pages — shipped v3.4.0

Five UI/UX suggestions were put up after item 13; the user asked for all five. **Two did not survive
checking, and were dropped rather than built:**

- *"The header shows $559,603 on one page and $559,604 on another."* It reads **$559,603 on all
  eight**, measured. The two figures came from screenshots taken at different points in this
  session's own chart work, not from disagreeing pages. There was no bug.
- *"The ⋯ overflow menu is doing too much, with no grouping."* Each page's menu holds three related
  CSV items under an explicit label ("Income import and export"), and the mobile More menu is
  already divider-grouped into navigation / data / danger / about. Both were already fine.

**What shipped.**

1. **`lib/setup.js` + the Dashboard setup panel.** The app is eight independent pages and nothing
   ever connected them: enter income and it says nothing about expenses. Every Dashboard figure is
   derived from data spread across four tabs, so until all four have something in them the page is
   a wall of zeroes with no hint which tab is the missing one. The panel names the five things its
   own figures depend on — income, expenses, housing, what you own, a second scenario — shows
   progress, and gives **one** button for the next step (five "do this" links is a chore; one is a
   next move). Not a wizard: every page stays reachable in any order, and it dismisses for good via
   a new persisted `setupDismissed`. Hides itself once all five are done.
   The housing step deliberately tests "a home row with an amount > 0", not "a home block exists" —
   `migrateState` seeds a block for every scenario, so the latter is true from first load and would
   tick the step before the user typed anything.
2. **The empty stat grid collapses.** Six tiles reading $0, $0/mo, $0 and an em-dash told a
   first-time user nothing except that they had entered nothing — which the panel above now says,
   with somewhere to go. One dashed card instead, spanning the grid (`grid-column: 1 / -1`, or it
   lands in a 150px column and wraps to ten lines).
3. **iOS no longer zooms on every field tap.** Safari zooms any text field under 16px and never
   zooms back out, so every tap into an amount left the app scaled up until pinched back by hand.
   16px at phone widths only, on text entry only — a `<select>` opens a picker, never triggers the
   zoom, and forcing it would blow out the badge-styled dropdowns (`.prop-kind` is 10.5px uppercase
   by design). `!important` is deliberate: every field is sized by its own component rule
   (`.m-edit-field input`, `.calc-field input`, `.acct-mgmt-name`), and a class selector beats a
   bare element one whatever the source order — the alternative is repeating it in a dozen rules the
   next new field would forget to join.

**How to verify.** From a cleared localStorage: the panel reads 0 of 5 and points at income; its CTA
navigates; entering income moves it to 1 of 5 and points at expenses; loading sample data hides it
and returns the five tiles; dismissing persists across a reload. Then count text-entry fields under
16px at 390px — it should be zero, with selects excluded.

---

## 15. `[x]` Tell people what the bank import reads — shipped v3.5.0

The feature's defining property is that there **is no template**: unlike the Income/Expenses/Assets
CSV imports, which each offer an "Import template" button because they expect this app's own column
layout, `parseBankCsv` works out the bank's layout instead — header aliases per role, column
sniffing for the headerless exports (CommBank's), DD/MM unless the file proves otherwise, and
`$1,234.56` / `(1,234.56)` / `-1234.56` all landing.

None of which was written down anywhere a user could see. The card said "Export a CSV from your
bank and drop it in here" and left the reader to discover the rest by being rejected.

**What shipped.**

1. **"What this reads — no template needed"**, a `<details>` in the card from load, before any file
   is picked. Rendered from the component that owns the parser rather than written into
   `index.html`, so the copy and the aliases it describes sit together — they drift apart the
   moment someone adds a header alias and forgets the help text exists.
2. **A failure message that names what was missing.** The old one said "Couldn't find a date column
   and an amount column" whatever was wrong, which is misleading for the commonest failure: a file
   with Merchant/Spend/Notes has a perfectly good amount column and no date, and being told both
   are missing sends the reader looking for the wrong thing. New `parseDiagnosis()` separates found
   from missing, and the panel also shows **the first row it read** — faster to recognise your own
   file than to check it against a rule about columns.
3. **Why rows were skipped.** `parseBankCsv` has always collected a row number and a reason for
   every unreadable row, and the panel has always thrown them away and shown a bare count. "3 rows
   couldn't be read" is not actionable; *"Row 3: Couldn't read \"Pending\" as a date"* is. Capped at
   three, with a note that skipped rows are usually statement headings, pending lines or a total.

**How to verify.** Spending tab: the help is present before picking a file. Feed it a
Merchant/Spend/Notes file and the message should name only the date as missing and echo the header
row. Feed it a file with a "Pending" date, a blank amount and a TOTAL line and all three reasons
should be listed.

---

## 16. `[x]` Reachable by keyboard — shipped v3.6.0

Three areas had never been driven: backup/restore round-trip, PWA offline, and keyboard navigation.
**Two came back clean and needed no work**, which is worth recording so nobody re-audits them:

- **Backup/restore is lossless.** Export -> clear -> import, compared key by key: 35 of 39 keys
  byte-identical, 53 transactions in and out, net worth matching. The four that differ are all
  correct — `lastBackupDate` restamped, `helpBalance: 0` seeded by migration, and two *computed*
  rows recalculated to today.
- **Offline works.** The service worker registers and activates, 45 files reach the cache, and a
  reload with the network cut renders the full app with correct figures and no errors.

**Keyboard had the defects.**

1. **Eleven controls had no visible focus ring.** `all: unset` is used on 36 controls to strip the
   browser's button chrome, and it takes the focus outline with it — each rule has to put a ring
   back by hand, and eleven didn't: the entire mobile bottom nav (`.mobile-tab`), the toast's Undo
   button, every mobile More item, the per-row Log buttons, the Dashboard card links,
   `.row-breakdown-toggle`, `.qlog-amount`, `.notif-mark-all-btn`, `.home-setactive-btn`,
   `.calc-hint-link`. A keyboard user could not see where they were.
   Fixed at the root — `button` and `summary` joined the shared `:focus-visible` rule — rather than
   per class, which would have left the next `all: unset` control with the same hole. Specific
   rules still win on specificity: `.quick-fab:focus-visible` (0,2,0) keeps its combined
   ring-plus-shadow over this rule's (0,1,1).
2. **No skip link, 22 tab stops before content.** The whole sidebar nav then the toolbar, on every
   page, every time. The link moves *focus*, not just scroll: an `href="#id"` alone scrolls a
   `<div>` into view and leaves focus where it was, so the next Tab returns to the nav — exactly
   what the user was trying to skip. `tabindex="-1"` makes the container focusable without joining
   the tab order, and `preventDefault` keeps `#appContent` out of the URL where nav.js's route
   parsing would have to reason about it.

**Also, found while verifying the round trip:** `recalcComputedItems()` rewrites the derived rows
(a vehicle's declining-balance value, the synthetic net-income rows) against today on every render,
and the result was never persisted. On the reference data the Income page showed **$11,740.30/mo**
while localStorage still held **$11,986.29** for the same row. The screen was right and the stored
copy was behind it — harmless day to day, since it self-corrects on the next edit, but it meant an
exported backup and the browser's own copy could disagree, which is a bad property for the one file
standing between this app and losing everything. Now persisted, but only when the recalc actually
changed something: `persist()` on every render would write on every page switch for nothing.

**How to verify.** Tab once: the skip link is the first stop and slides into view. Enter: focus
lands on `#appContent`, the URL stays clean, and the next Tab is inside the content rather than back
in the nav. Then tab 30 stops and assert none has `boxShadow: none` with `outline: none`.

---

## 17. `[x]` A bar on the irregular rows too — shipped v3.7.0

Asked why "Work Related Costs", "Trips" and "Tolls" had no progress bar when every other budget row
does. They are all flagged **"no fixed timing (irregular)"**, and `budgetRowProgressHtml()` opened
with `if(item.irregular) return ""`.

The reasoning was sound as far as it went: a row bar compares spend against *that line's billing
cycle*, and an irregular line has no billing cycle — that is what the flag means. Judging $20,000 of
annual travel against "this month" would render an on-plan holiday as several hundred percent over.

But "no *monthly* comparison is honest" is not "no comparison is". Every one of these lines has a
reserve year the app already resolves (`reserveYearWindowFor` — calendar, financial, or the
household default), and "how much of this year's travel budget is left" has a real answer. Seven of
this household's 34 lines had a silent gap where every other row has a bar, with the figure
available only in the "Irregular / reserve budgets" panel further down and nothing on the row saying
where it had gone.

**What shipped.** `reserveCycleFor()` in `calc/ledger.js` — the same shape `budgetCycleFor` returns,
but over the line's reserve year, with the amount annualised (`periodsOf().yearly`, so "$300 a
fortnight, no fixed timing" is a $7,800 reserve rather than being compared against $300). Kept
separate from `budgetCycleFor` rather than folded in, because two of that function's callers —
`billedThisMonth()` and the Actual vs. planned row list — depend on it meaning *this month's bills*,
and a reserve year is not that. `dueThisMonth: false` for the same reason.

**Measured on the household's own data:**

| Line | Before | After |
|---|---|---|
| Trips | *(no bar)* | $0 of $20,000 this year |
| Work Related Costs | *(no bar)* | $170 of $1,000 FY26/27 |
| Tolls | *(no bar)* | $47 of $300 FY26/27 |
| Misc. | *(no bar)* | $631 of $1,000 this year |
| Car Maintenance | *(no bar)* | $0 of $1,000 this year |
| Bootcamp | *(no bar)* | $80 of $3,120 FY26/27 |
| Date Night | *(no bar)* | $0 of $7,800 FY26/27 |

Regular rows are untouched — Internet still reads "$0 of $99 this month", Gas "$230 of $230
Aug-Oct", Groceries "$947 of $1,720 this month x4". The grouped panel stays as the overview.

**How to verify.** Expenses -> Budget, expand every group, and read `.budget-progress-text` on each
row: the seven irregular lines should name a year window, the rest a billing cycle. Note that a
barless "Groceries" also matches a naive row query — that one is a *transaction* on the hidden
Spending subtab, not a budget row.

---

## 18. `[x]` The app scrolled sideways on a 360px phone — shipped v3.7.1

Not from the audit — found by sweeping every page at 300/320/360/375/390/412/430/768/1280px and
measuring `documentElement.scrollWidth` against `clientWidth`, rather than looking at screenshots.
At 320px the document laid out **368px wide inside a 320px viewport**: every Dashboard tile was
clipped and every page scrolled horizontally.

Three separate causes, two of which were hiding the third.

**1. The topbar metrics pill had a hard minimum that grew with your net worth.** `.global-metrics`
is a nowrap flex row whose `b` values are `white-space:nowrap`, so its intrinsic width is both
figures side by side: 352px at $559,431 / +$6,293/mo, **371px at seven figures**. So the breakpoint
was not fixed — it moved as someone's net worth grew. Broken at ≤360px on the household's real
data; at seven figures it also breaks a 375px iPhone SE. Now wraps onto two lines below 420px, and
the divider goes with it (a vertical rule between two *stacked* items is a stray tick, and CSS
cannot show it only when they sit side by side).

**2. Three of the eight pages were unreachable on a 360px Android phone.** `.mobile-tab` is
`flex:1 1 0`, but a flex item's `min-width` defaults to `auto` — its *min-content* width — so the
six tabs never shrank, they overflowed their own `position:fixed` bar. "More" was clipped to "Mor"
at 360px and gone entirely at 320px, and because the bar is fixed **you cannot scroll to it**.
Scenarios, Projections and Accounts are reachable only through that menu.

The fix is `min-width:44px` (not `0`) plus `flex:1 1 auto` (not `1 1 0`), and both halves matter:

| | Result |
|---|---|
| `flex:1 1 0` + `min-width:0` | equal widths, so the longest label sets the requirement 6× over — 6 × 69px = 414px, truncating "Dashboard" at 412px, a width with room to spare |
| `flex:1 1 auto` + `min-width:0` | full labels, but "More" sized to its own short word = a **34px** tap target, under item 12's 44px floor |
| `flex:1 1 auto` + `min-width:44px` | full labels at every real phone width, every tab ≥44px |

**3. The stat grid, which only became visible once (1) stopped masking it.** `#dashboardStats` uses
`repeat(2, minmax(150px,1fr))` — a *fixed* two columns with a 150px floor, so it does not collapse
the way an auto-fit track would. Two 150px tiles plus the 14px gap need 314px; a 320px phone has
288px between the gutters. Dropping the floor to `minmax(0,1fr)` keeps the two-column bento at
360px rather than doubling how far you scroll, and it goes single-column at ≤340px where a
seven-figure number at 21px genuinely stops fitting beside its own padding.

**The trap in (3):** `.stat-tile:first-child` carries `grid-column: span 2`. On a one-column grid
`span 2` asks for a column that isn't there and the grid creates an **implicit** one — putting the
overflow straight back. It has to be reset to `1 / -1`.

**Measured, `scrollWidth - clientWidth` across all eight pages, at both the real figures and a
seven-figure net worth:**

| Width | Before | After |
|---|---:|---:|
| 300 | 30px | 0 |
| 320 | 48px (67px at 7 figures) | 0 |
| 360 | 8px (27px) | 0 |
| 375 | 0 (12px) | 0 |
| 390 – 1280 | 0 | 0 |

Every width ≥421px is untouched: tile padding still `16px 18px`, the metrics pill still one row
with its divider, the same tile column counts.

**How to verify.** Measure, do not eyeball — this is exactly the class of bug a screenshot at 390px
never shows. Load a backup, then at each width read `documentElement.scrollWidth` against
`clientWidth` on all eight pages, and read each `.mobile-tab`'s rect plus whether its label's
`scrollWidth` exceeds its `clientWidth`. Below 320px labels truncate with an ellipsis by design —
that is the safety net, and every tab stays reachable and ≥44px.

---

## 19. `[x]` Drill into an irregular row too — shipped v3.8.0

The follow-up to item 17, reported the same way: *"Actual vs. planned — same issue, irregular
expenses does not allow me to see all transactions underneath it."*

Every regular row in that panel is tappable, expanding in place to list the transactions making up
its "actual" figure. `irregularBudgetSectionHtml()` built its rows by hand and gave them none of
it — no `data-budget-row-toggle`, no `role`/`tabindex`/`aria-expanded`, no caret, no list. The
click handler in `app.js` was already fully generic (it keys off `data-budget-row-toggle` alone),
so nothing was wrong with the wiring; those rows simply never carried the attributes.

**The part that isn't just copying the regular row.** A regular row's "actual" is this month's
spend, so its drill-down used `monthTransactionsForExpense()`. An irregular row's actual is
measured over its **reserve year** (`reserveYearWindowFor`). Listing this month's transactions
under a row whose figure covers twelve months would show a list that doesn't add up to the number
directly above it — which is worse than showing nothing. So `monthTransactionsForExpense()` is now
a thin wrapper over a range-based `rangeTransactionsForExpense(id, start, end)`, and each row
passes its own window.

That is also why these rows need the drill-down *more* than the regular ones: a regular line's
transactions are all in the current month, so the Transactions list below is a workable fallback
for finding them. An irregular line's actual can be one receipt from eleven months ago, and
nothing else on the page will tell you which.

**Measured on the household's own data** — listed transactions against the figure on the row:

| Line | Row reads | Expanded |
|---|---|---|
| Work Related Costs | $170 actual, FY26/27 | 3 txns, $170.37 |
| Misc. | $631 actual, this year | 7 txns, $631.49 |
| Bootcamp | $80 actual, FY26/27 | 4 txns, $80.00 |
| Tolls | $47 actual, FY26/27 | 1 txn, $46.83 |
| Trips / Car Maintenance / Date Night / Property Maintenance | $0 actual | no caret — nothing to open |

A `$0 actual` row stays plain and non-interactive, the same rule the regular rows already use.

**How to verify.** Expenses → Spending → Actual vs. planned, scroll to "Irregular / reserve
budgets", tap a line with spend against it. The transactions listed must sum to the row's own
"actual" figure — if they sum to something smaller, the window has regressed to the calendar month.
`irregularBudgetSectionHtml` is exported purely so `tests/render-smoke.test.js` can pin this;
those four tests fail if the toggle attributes or the year window come off.

---

## 20. `[x]` Accounts were a foreign key nothing maintained — shipped v3.8.1

From a full-app assessment (all 8 pages driven at 390px and 1280px with a real backup, plus the
brand-new empty state, junk-data injection, and all three of the household's backups spanning two
weeks of schema change). Almost everything came back clean — **zero** console or page errors
anywhere, no `NaN`/`undefined`/`[object Object]` in any rendered page, and no breakage from
negative amounts, `1e12`, zero, a missing `freq`, a future-dated transaction or a negative asset.

What it did find was one root cause with two faces. **An account name is a foreign key by string** —
nothing in the app stores an account *id* — so every rename or delete has to walk every array that
carries one. `everyCategorisableArray()` does exactly that for categories, `state.home` included.
The account side had no equivalent: it hand-listed its arrays, and both helpers missed the same one.

### a. Renaming an account skipped every housing row

`renameAccountEverywhere()` retargeted `state.income`, `state.shared`, the properties' income and
expenses, and `state.transactions` — but not `state.home`, which is one array per scenario whose
rows carry accounts just like shared expenses do.

Measured by renaming "Macquarie" → "Macquarie Bank" through the UI on the real backup:

| | Before | After (buggy) |
|---|---|---|
| shared rows | Macquarie ×4 | Macquarie Bank ×4 |
| transactions | Macquarie ×4 | Macquarie Bank ×4 |
| **housing rows** | **Macquarie ×10** | **Macquarie ×10 — dangling** |

Ten rows across Buy Sydney and Buy Melbourne left pointing at a name that no longer existed, with
no error and nothing on screen to show it.

### b. Deleting an account orphaned everything, silently

`deleteAccount()` spliced the account out and did nothing else — no reference sweep, and a toast
reading only "Deleted account", which did not even name it. Deleting "Credit Card" on the real
backup: **93 rows and transactions left dangling**, 64 of them transactions still claiming an
account that was gone.

The visible casualty is the statement-cycle panel, which keys off the credit account's own
statement day — so with the account deleted it renders *nothing at all*:

| | Before | After (buggy) |
|---|---|---|
| "This bill so far — by statement cycle" | Credit Card · 2026-09-08 – 2026-10-07 · 21 charges · **$1,370** | **section absent** |

Now it clears those references the way `deleteCategory()` already did, and the toast names both
the account and the blast radius: *Deleted "Credit Card" — 93 lines and transactions now have no
account*. Undo restores every one of them.

**What shipped.** `everyAccountBearingArray()` — the account-side twin of
`everyCategorisableArray()` — used by both helpers, so the two can no longer drift apart.
Dangling references after a delete went 93 → **0**.

**How to verify.** `tests/account-refs.test.js` pins the rename (remove `state.home` from the
helper and two tests go red — checked). `deleteAccount` can't be unit-tested: it re-renders three
panels and raises a toast, so it needs the browser. Drive it, delete an account with references,
and read `state` back: nothing should still carry the deleted name, and the toast should say how
many rows moved.

**Still open from the same assessment, not fixed here:**
- The bell can show the same budget line twice — once inside the grouped "N budget lines need a
  fresh entry" and again as its own "Due" item. On the real backup that was Transport NSW and
  Extras, so 2 of 7 notifications were repeats.
- Irregular budget rows are still rendered by a hand-built path separate from the regular rows
  (`irregularBudgetSectionHtml` vs the main row builder). That split has now produced two
  user-reported gaps in a row — items 17 and 19. Converging the two builders is the fix that stops
  a third.
- `CLAUDE.md` says `src/app.js` is "~1,275 lines". It is **3,437**.

---

## 21. `[x]` The three loose ends from item 20's assessment — shipped v3.9.0

All three were listed as "left open" on item 20 and then asked for together.

### a. One line, one notification

The bell showed the same budget line twice — inside "N budget lines need a fresh entry" *and* as
its own "Due 2026-09-22 · $50". On the household's real data that was 2 of 7 notifications being
repeats.

They were never independent facts: not having logged the last one is *why* `nextDueDate()` has
come around again. `dueBillPairs()` is now split out of `dueBillNotifications()` so the id set can
be shared, and `reviewDueNotifications(alreadyBilled)` stays quiet about any line already spoken
for. Two copies of "is this due soon" would have been how the two sources drifted back into
disagreeing, so the predicate is not duplicated.

**The trap, and why suppression alone would have been a regression:** dropping the line from the
review group loses the "you are behind on logging" signal, which was the only thing carrying it.
So it does not travel alone — the surviving due-bill notification now carries that fact:

> Transport NSW — Due 2026-09-22 · $50 **— the one before this still isn't logged**

with `severity: "bad"`. 7 notifications → 6, each line exactly once, and strictly *more*
information than before.

**A dead branch found on the way.** `dueBillNotifications()` computed `overdue = x.days < 0`, but
`nextDueDate()` loops forward until it is on or after today, so `days` is never negative — the
`"bad"` severity and the `"Overdue — was due …"` wording could not fire at all. The `behind` flag
is measured with `isOverdue()` instead, which is what that branch was always reaching for.

### b. One row builder for both kinds of budget line

Regular and irregular rows in Actual vs. planned were two hand-written builders drifting side by
side, and that split had produced two reported gaps in a row — no progress bar on irregular rows
until item 17, no drill-down until item 19 — each time because a change landed on one builder and
not the other.

Nothing about the *markup* ever depended on the kind of line. The only real difference is which
window it is judged over, and the calc layer already solved that: `budgetCycleFor()` and
`reserveCycleFor()` return the same `{start, end, label, target}` shape. So `cycle` is the entire
branch, and `budgetComparisonRowHtml(item)` serves both. The one deliberate difference is kept but
now keys off data (`cycle.reserve`) rather than which function built the row: a reserve line gets
no green for being under budget, because spending less than a *whole year's* travel allowance in
February is the normal state of affairs, not an achievement.

**This fixed a third, latent bug nobody had reported.** The drill-down now reads
`cycle.start`–`cycle.end` instead of the calendar month, so a multi-month cycle finally adds up.
Measured on a quarterly Gas line (cycle "Aug–Oct") carrying an August charge:

| | Row says | Drill-down lists |
|---|---|---|
| before | $347 actual | 1 txn, **$230.01** — does not add up |
| after | $347 actual | 2 txns, **$347.01** — reconciles |

All 26 rows on the real backup were re-checked: every expandable row's listed transactions sum to
its own "actual" figure. 0 mismatches.

### c. CLAUDE.md had drifted

It described an app that no longer exists. `src/lib/uimode.js` is **deleted**, and `state.uiMode`,
`buildTable`/`rowHtml`, `refreshAllUiModePages()` and `syncUiModeToggle()` all went with Classic
mode — yet the module map still listed `uimode` and the *first* entry under "A few things that
will bite you" was a `state.uiMode` gotcha. Also corrected: `app.js` "~1,275 lines" (it is 3,437),
"seven pages" (eight), and the `components/`, `calc/` and `lib/` lists, which were each missing
several modules. The retired `state.uiMode` bullet is replaced with the account-name-as-foreign-key
rule that item 20 turned up, which is a live hazard rather than a dead one.

**How to verify.** `npm test` (380). The notification dedupe is pinned three ways — both due and
behind → one notification carrying both; due but logged on time → no "behind" wording; behind but
not yet due → still in the group. The row convergence is pinned by a quarterly line whose charge
sits in the cycle but outside this month, and by the reserve-line green rule.

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
