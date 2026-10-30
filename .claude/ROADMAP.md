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
| Super | $142,300 | Not until preservation age (60) |
| Vehicle | $8,540 | No |
| Shares + Cash | $19,840 | Yes |
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

**Measured on a test backup:**

| | Old panel | Now |
|---|---:|---:|
| Figure driving the headline | $446,200 (total net worth) | $294,800 accessible |
| Super | counted in it | $142,300, shown separately as locked until 60 |
| Vehicle + home equity | counted in it | $8,530, shown as excluded |

At 41 targeting 52: passes, with an 8-year bridge costing $880,400. At 41 targeting 44: fails the
bridge, and the panel names 52 as the earliest age that works.

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
expenses inflated. Real data: income $18,600/mo at 0%/yr against expenses $11,580/mo at 3%/yr —
the model had the $7,020/mo surplus **going negative around year 16**, then spent four years of a
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
the rent, and nothing else was paying it. On a test backup the projection assumed **$2,780/mo
more savings** than the Dashboard's own net-savings tile showed for the same scenario.

The decision now lives in one place, `scenarioInflatableHomeItems()` in `calc/property.js`, with
the invest-leg-beats-purchase-leg precedence `computeNetWorthSeries` uses. **If you touch the
homeLoanRow, this is the trap** — the row's meaning depends on the scenario's purchase leg.

**Measured at year 20 on a test backup** (20-year horizon, 7% / 5% / 3% / 3%). Only Renting
has an uncharged `homeLoanRow`, so only Renting moves:

| today's dollars | before rent fix | after |
|---|---:|---:|
| Renting | $5,081,200 | $4,061,700 |
| Buy Sydney | $4,243,300 | $4,243,300 |
| Buy Melbourne | $4,444,900 | $4,444,900 |

That **changes the headline's winner** from Renting to Buy Melbourne. "Renting comes out ahead"
was an artefact of not charging it rent.

On Renting, what v2.76.0 showed against what this ships: $6,379,600 (nominal, income flat) against
$4,061,700 (today's dollars, income growing 3%, rent counted) — the same figure in future dollars
is $7,335,800. 2a is optimistic and 2b pessimistic, so they partly cancel; the rent fix is what
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

Both were only visible by running the panel against a test backup. Neither would have shown up
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
Eleven days into September on the test data, that projection turned **$2,440 actually spent** into
a confident **"on track for $6,655"** — a 611% rise that never happened.

Every comparison now runs on a **month-to-date** series: this month so far against the *same days*
of earlier months. It never extrapolates, so there's no model of how spending is distributed to
get wrong. Whole months still drive the bars and the table.

### The limit that survived both fixes — read this before extending it

**The app cannot tell "spent more" from "logged more thoroughly."** Nothing short of a bank feed
can. On a test backup August was logged mostly in its last week and September mostly in its
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
a test backup all three scenarios differed only in housing rows (2 vs 5) and zero shared
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

Measured: halving a $11,583.33/mo gross salary drops that scenario's income by **$3,620/mo, not the
naive $5,792** — the brackets doing their job, which a net-side override could not have expressed.

`scenarioIncomeRows()` is the single definition of "what does this scenario earn", used by
`scenarioTotals`, `computeNetWorthSeries` and `calc/cashflow.js` alike. Storing a synthetic net row
per person *per scenario* in `state.income` was rejected — N×M computed rows in the Income list, and
those rows are a display artifact, not the source of truth for any total.

`opts.includeRow` exists because `computeNetWorthSeries` honours `item.endDate` year by year and the
filter has to reach **inside** the tax chain: a salary that ends in three years must stop being
taxed, not just stop being counted.

Verified byte-identical output (totals, 20-year series, 12-month cash flow, all three scenarios)
against the previous implementation on a test backup with no overrides set.

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

A collapsed row that varies carries a **"⇄ $5,791.67 in Buy Sydney"** pill naming the active
scenario's own figure. The list shows the *default* amount, so without it the Income page could read
$11,583 while the scenario on screen used half that.

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
  actual / $Y planned this year") but as a household year it lands in "$3,950 logged in ___" and in
  an export filename. The per-line label is untouched.
- **A reserve line's explicit basis is never overwritten.** Migration blanks only lines stamped with
  the old *implicit* `calendar` default, so a deliberate choice survives a household change.

**Measured on a test backup:** FY26/27 so far is $3,385 across 47 transactions (20% through);
the same data on a calendar basis is $3,950 across 50.

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
| `[x]` HECS / HELP | **Shipped v2.81.0.** Per-person balance on the Tax & super card; a flat-rate (not marginal) repayment withheld from take-home, with the next threshold and what crossing it costs. Repayment income adds back salary sacrifice and any rental loss, so neither reduces it. On a test backup a $38k balance cuts household net savings **$7,020 → $5,660/mo**. |
| `[x]` Deductions | **Shipped v2.83.0.** Any budget line can be flagged work-related, with a **share** (a phone bill is rarely 100%) and a person. Reduces taxable income, so it cascades into the levy and the MLS tier — but *not* HELP, which is worked out on gross. The panel leads with what the deduction is **worth** at the marginal rate, not what it cost. The year's transactions CSV carries the flag, share and claimant. |
| `[x]` Dividends & franking | **Shipped v2.84.0.** Dividend **per unit** (so it follows the holding when units change) + franked %. Declared **grossed up**, credit as a **refundable** offset — so above a 30% marginal rate a fully franked dividend still costs a top-up, and at a low rate it pays more than the company distributed. Both stated on the card. |
| `[x]` Capital gains | **Shipped v2.85.0.** A sale event per holding (`asset.sales[]`) that reduces the units held, with the **12-month discount** — "more than" 12 months, exactly: 366 days, so a sale one day early costs half the discount. Losses are never discounted. Bounded to the household year, since a sale is a one-off rather than a rate. |
| `[x]` Medicare levy surcharge | **Shipped v2.82.0.** Household toggles for private hospital cover and family thresholds; flat-rate (not marginal) tiers, with the next tier and its step cost. Always states both directions — with cover it names what the cover is saving, so "is a policy worth it" is answerable. Family tiers are set by **combined** household income, then charged on each person's own. |
| `[x]` Property depreciation | **Shipped v2.86.0.** Capital works (2.5% of **construction** cost — not the purchase price; land isn't depreciable — for 40 years) and plant & equipment (straight-line over an effective life). Reduces the **taxable** result only; `propertyCashResultAnnual()` is the untouched cash figure. On a test backup $10,600/yr, taking the IP result from −$6,480 to −$17,080 and household net savings from $6,610 to $6,990/mo. |

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

**Measured, driving a 12-row headerless CommBank-shaped file against a test backup:**

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
below it), and the Expenses page is **4,852px**. Both measured at 390px against a test backup.

**How to verify.** Same as item 7: drive it. For (a), a genuinely empty app — the case that
motivated it. For (b), a statement containing a real refund, checking the category totals and the
month rollup both move *down*. For (c), re-measure the same two numbers rather than eyeballing.

**What shipped, measured at 390px against a test backup:**

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

Measured from a test backup, the app captures far more history than it shows:

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
run against a test backup, found to be lying, and rebuilt. The arithmetic was never wrong.

1. **"Kept $17,240/mo"** — the cash-flow panel subtracted *logged* spending from income. Logged
   averaged $615/mo against a $11,580/mo budget (5%), so it was measuring how little had been
   typed in and calling it thrift. The household keeps $6,610. `spendCoverage()` now gates the
   savings claim at 80% coverage; below that the panel says what it has.
2. **"$231,900 of growth"** — super and cash were logged from July 2025, shares and the property
   only from August 2026, so ~$301,000 of that was assets that merely began being tracked.
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

Found by driving v2.99.0's four charts against a test backup, in **both** colour schemes — the
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
   both label their total *net worth* while omitting `state.debts` — $459,800 against the
   $446,200 in the page header, a $13,600 credit-card limit apart.
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
2. **It interpolates straight across gaps nobody logged.** On a test household's data the observations
   are Jul 2025, Aug 2025, then nothing until Aug 2026 — and the line draws net worth climbing
   smoothly from $132k to $517k across that year. What happened was flat super for twelve months
   and a jump in one week, when the property and shares were first entered. This is the same
   fabrication stepped geometry was introduced to stop in the stacked chart, and it is the same
   class of error as the "$231,900 of growth" and "kept $17,240/mo" claims already gated: the app
   asserting a shape that is an artifact of when logging started.
   Stepping is right for *logged history* and wrong for *projections*, which are a continuous
   model — so it is per-call, not global.
3. **No time-range control**, so the same 95%-empty framing with no escape hatch.

Plus, on the panel item 10 touched: **"Markets took $72,800"** is, on a test household's data, the
household's own revaluation of the house from $720k to $647k, over 0.4 months. The arithmetic is
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

- *"The header shows $446,201 on one page and $446,200 on another."* It reads **$446,201 on all
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
and the result was never persisted. On a test household's data the Income page showed **$9,415.20/mo**
while localStorage still held **$9,612.75** for the same row. The screen was right and the stored
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
| Trips | *(no bar)* | $0 of $12,000 this year |
| Work Related Costs | *(no bar)* | $140 of $800 FY26/27 |
| Tolls | *(no bar)* | $38 of $250 FY26/27 |
| Misc. | *(no bar)* | $505 of $900 this year |
| Car Maintenance | *(no bar)* | $0 of $900 this year |
| Gym classes | *(no bar)* | $60 of $2,400 FY26/27 |
| Dinners out | *(no bar)* | $0 of $6,200 FY26/27 |

Regular rows are untouched — Internet still reads "$0 of $85 this month", Gas "$230 of $230
Aug-Oct", Groceries "$760 of $1,400 this month x4". The grouped panel stays as the overview.

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
figures side by side: 352px at $446,100 / +$5,030/mo, **371px at seven figures**. So the breakpoint
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
| Work Related Costs | $140 actual, FY26/27 | 3 txns, $140.20 |
| Misc. | $505 actual, this year | 7 txns, $505.10 |
| Gym classes | $60 actual, FY26/27 | 4 txns, $60.00 |
| Tolls | $38 actual, FY26/27 | 1 txn, $38.10 |
| Trips / Car Maintenance / Dinners out / Property Maintenance | $0 actual | no caret — nothing to open |

A `$0 actual` row stays plain and non-interactive, the same rule the regular rows already use.

**How to verify.** Expenses → Spending → Actual vs. planned, scroll to "Irregular / reserve
budgets", tap a line with spend against it. The transactions listed must sum to the row's own
"actual" figure — if they sum to something smaller, the window has regressed to the calendar month.
`irregularBudgetSectionHtml` is exported purely so `tests/render-smoke.test.js` can pin this;
those four tests fail if the toggle attributes or the year window come off.

---

## 20. `[x]` Accounts were a foreign key nothing maintained — shipped v3.8.1

From a full-app assessment (all 8 pages driven at 390px and 1280px with a test backup, plus the
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

Measured by renaming "Bank One" → "Bank One Savings" through the UI on a test backup:

| | Before | After (buggy) |
|---|---|---|
| shared rows | Bank One ×4 | Bank One Savings ×4 |
| transactions | Bank One ×4 | Bank One Savings ×4 |
| **housing rows** | **Bank One ×10** | **Bank One ×10 — dangling** |

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
| "This bill so far — by statement cycle" | Credit Card · 2026-09-08 – 2026-10-07 · 21 charges · **$1,095** | **section absent** |

The toast now names both the account and the blast radius, and the references are **kept, not
cleared** — see item 22, which revised this.

**What shipped.** `everyAccountBearingArray()` — the account-side twin of
`everyCategorisableArray()` — used by both helpers, so the two can no longer drift apart.

**How to verify.** `tests/account-refs.test.js` pins the rename (remove `state.home` from the
helper and two tests go red — checked). `deleteAccount` can't be unit-tested: it re-renders three
panels and raises a toast, so it needs the browser. Drive it, delete an account with references,
and read `state` back: nothing should still carry the deleted name, and the toast should say how
many rows moved.

**Still open from the same assessment, not fixed here:**
- The bell can show the same budget line twice — once inside the grouped "N budget lines need a
  fresh entry" and again as its own "Due" item. On a test backup that was Tolls and
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
its own "Due 2026-09-22 · $50". On a test household's data that was 2 of 7 notifications being
repeats.

They were never independent facts: not having logged the last one is *why* `nextDueDate()` has
come around again. `dueBillPairs()` is now split out of `dueBillNotifications()` so the id set can
be shared, and `reviewDueNotifications(alreadyBilled)` stays quiet about any line already spoken
for. Two copies of "is this due soon" would have been how the two sources drifted back into
disagreeing, so the predicate is not duplicated.

**The trap, and why suppression alone would have been a regression:** dropping the line from the
review group loses the "you are behind on logging" signal, which was the only thing carrying it.
So it does not travel alone — the surviving due-bill notification now carries that fact:

> Tolls — Due 2026-09-22 · $50 **— the one before this still isn't logged**

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
| before | $278 actual | 1 txn, **$184.01** — does not add up |
| after | $278 actual | 2 txns, **$278.01** — reconciles |

All 26 rows on a test backup were re-checked: every expandable row's listed transactions sum to
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

## 22. `[x]` A deleted account keeps its name on the rows that used it — shipped v3.9.1

Item 20 made `deleteAccount()` clear every `row.account` that named the deleted account, mirroring
`deleteCategory()`. That was raised as a judgement call at the time and the call went the other
way: **keep the name**.

The two links are not the same kind of thing. A category is a label the row owns — drop the label
and nothing true is lost. An account is a statement of fact about *where money actually moved*, so
blanking it destroys something the app cannot recover, and leaves the row claiming "no account"
long after the mistake. And because the link is by name rather than id, keeping it costs nothing
and buys the undo of last resort: re-add an account spelled the same way and everything re-attaches
by itself — in a later session, after a reload, long past the undo toast.

The toast says so rather than leaving it to be discovered:

> Deleted "Credit Card" — 93 lines still name it; re-add an account called "Credit Card" to relink them

### The part that makes it true rather than merely intended

Keeping the name means a row can name an account that is not in `state.accounts`, and every control
that offers accounts has to cope. The ledger rows' own `f-account` fields already did — they are
free-text inputs backed by a datalist. The transactions `<select>` could not: **a `<select>` whose
value matches none of its options does not render empty, it shows the first option**. So every
transaction on the deleted account would have silently read "— No account —", and the next edit to
any other field on that row would have saved that over a real fact — the very data loss this change
exists to avoid. `transactionAccountOptionsHtml()` now emits an explicit `Credit Card (deleted)`
option for an unrecognised name.

### Measured, full round trip on a test backup

| Step | Rows naming "Credit Card" | Statement-cycle panel |
|---|---:|---|
| before | 93 | Credit Card · 2026-09-08 – 2026-10-07 · 21 charges · **$1,095** |
| after delete | **93 — kept** | gone |
| after re-adding an account named "Credit Card" | **93** | still gone |
| after setting it back to credit, statement day 8 | **93** | **21 charges · $1,095 — identical** |

**The one thing a re-add does not restore** is the account's *own* settings — `type` and
`statementStartDay` lived on the deleted record, so a re-added account comes back as a debit
account and the statement panel stays away until it is set to credit again. The row links are what
relink for free; the toast promises those and nothing more.

**How to verify.** `transactionAccountOptionsHtml` is exported for `render-smoke` — three tests
cover a missing name (kept, selected, marked `(deleted)`, and the empty option *not* selected), a
known name (normal, no marker, credit still labelled), and nothing selected. `deleteAccount` still
needs the browser: delete an account with references and confirm `row.account` is untouched and the
toast names the count.

---

## 23. `[x]` Land tax for NSW, VIC and QLD — shipped v3.10.0

Asked whether the buy scenarios could simulate council rates, strata and land tax. The first two
already worked and needed nothing: housing rows are seeded from `HOME_CATEGORIES` but **`+ Add cost`
adds any row you like**, and those rows are inflated annually by the projection
(`scenarioInflatableHomeItems`). Council Rates ships as a default row; strata is just another one.

Land tax was the real gap, and the reason it could not be "add a row and type a number" is that it
is the one recurring property cost that is not a flat bill:

1. it is charged on **land value**, not market value;
2. it is assessed on your **aggregated** holdings per state — two $700k blocks in NSW are one
   $1.4m assessment;
3. there is a **tax-free threshold**, so most single holdings owe nothing;
4. your **principal home is exempt**, so it only ever bites investments.

A typed figure gets all four wrong, and drifts further every projection year as land value grows
while the number does not.

**What shipped.** `LAND_TAX_BRACKETS` in `constants.js` (NSW / VIC / QLD, general rates for an
individual resident, 2025 land tax year) plus `calcLandTax` / `landTaxByState` /
`landTaxDetailForProperty` / `totalLandTax` in `calc/property.js`, and a computed `Land Tax` expense
row per property built in `recalcComputedItems()` on the same footing as the Property Manager fee.
Properties gained `state` and `landValue`; both default to unset, and a property missing either is
left out rather than guessed at.

### Three things worth knowing before touching this

**Aggregation is the feature, not an implementation detail.** Two NSW properties at $700k of land
each owe **$0 apiece standing alone** and **$5,300 together**. `landTaxByState()` groups by state
and taxes the sum; each property's row carries an apportioned share (by land value) that adds back
to exactly the real assessment. A share is deliberately *not* what that property would pay alone —
the liability is genuinely joint and genuinely non-linear.

**Which is why the row's caption changes shape.** Captioning an aggregated share with the
property's own land value would name a figure that, by that description, is $0 — the first version
did exactly that and read "auto: NSW land tax on $700,000 land value" above $2,650. It now says
"share of NSW land tax on $1,400,000 combined land value across 2 properties" whenever more than
one property is assessed together. `landTaxDetailForProperty()` exists only to make that sentence
truthful.

**`calcLandTax` returns `null`, not `0`, for a state with no table.** "We don't have Tasmania's
scale" and "you owe nothing" are different answers and must not render the same.

**Measured:** NSW $1,575,000 → $8,100/yr ( = $100 + 1.6% × $500,000), matching by hand and in the
browser. PPOR with $2m of land → exempt, no row, and not aggregated with the investments. The row
reaches the Budget page as a real line ($220.83/mo at a $2,650/yr share).

**Deliberately out of scope:** absentee/foreign surcharges, trusts and companies (QLD companies use
a different threshold and scale entirely), and NSW's special-trust premium treatment. All of them
need an ownership-structure field the app does not have, and a subtly wrong number is worse than
plainly not offering one.

**These rates go stale every year** — same standing hazard as `STAMP_DUTY_BRACKETS`. The tests in
`tests/land-tax.test.js` are worked from the published scales by hand, so they double as the record
of what each bracket is meant to say: when a state revises its rates, they fail and name the
bracket that moved.

---

## 24. `[x]` Where the money in a line actually went — shipped v3.11.0

Asked: *"I don't have a way of knowing how much I'm spending on things like Amazon, Uber Eats,
DoorDash, cafés."* Measured on the household's own September logging, that was 14% of everything
they had logged, invisible:

| | | currently inside |
|---|---:|---|
| Amazon, 5 purchases in 13 days | $265.10 | *Misc.* |
| Running shoes (Kmart) | $237.70 | *Misc.* |
| Cafés — Harbour, Fern ×2 | $198.50 | *Eating Out* |
| DoorDash, 3 orders in 7 days | $163.00 | *Eating Out* |

**An earlier read of this said merchant tracking wasn't worth building.** That was measured against
an older export where 75% of descriptions merely restated the budget line they were linked to
("Groceries" logged against *Groceries*). The newer data is genuinely different — real merchant
names throughout — and the conclusion flipped. Worth remembering that the answer here is a property
of how a household logs, not of the feature.

**What shipped.** `calc/merchants.js` (`merchantGroupKey`, `merchantGroups`, `worthShowingMerchants`,
`recentMerchants`), a "Where it went" breakdown inside an expanded budget row, and tap-to-fill
recent-merchant chips in the quick-log sheet.

### Why this is NOT import-rules.js's merchantKey()

That function is tuned for bank export strings — it drops leading payment rails, stops at the first
token containing a digit, caps at three tokens. Aggression that is right for
`EFTPOS WOOLWORTHS 1234 SYDNEY NS` and wrong for anything a person typed: it turns
`"Dinners Out / Takeaway"` into `"out takeaway"`. Hand-typed text is already close to the
merchant name, so `merchantGroupKey` only folds case and accents, drops a trailing `(...)`, and
cuts at a slash. Nothing more: **under-grouping shows two rows where one would do, over-grouping
reports a number that is wrong.** The first is a blemish, the second is a lie.

### Why it lives inside a budget row, not as a page-wide chart

On a well-named line like "Internet" every transaction is the same bill, and a merchant chart there
would only restate the line's own name — which is exactly what made the page-wide version
worthless on the older data. It earns its place on a *catch-all*: five Amazon orders and a pair of
shoes inside one "Misc." row, with nothing anywhere saying so. Hence
`worthShowingMerchants()` — at least 2 merchants and 3 transactions, or no panel.

**Measured in the browser:** *Misc.* → Amazon $265 ×5 (41%), running shoes $238 (37%), Misc. $138 ×2.
*Eating Out* → DoorDash $163 ×3, Fern café $116 ×2, Dinners out $103 ×3, Harbour Cafe $82,
D'Arcy's $71, "3 others" $104. *Internet* → no panel, as intended. The capped list folds the
remainder into one "N others" row rather than dropping it, because a breakdown whose parts don't
add up to the line total is worse than no breakdown.

### Follow-up (v3.11.1): an undescribed transaction was silently dropped

`merchantGroups()` skipped any transaction with a blank description, so a line's breakdown could
quietly stop adding up to the line's own total — the exact failure this module elsewhere goes out
of its way to avoid, and invisible, since nothing on screen said a slice was missing. Found while
clearing a misleading label off four real transactions, which would have made $250 of a $424 line
disappear from its own breakdown.

They get an explicit `(no description)` bucket now, which is also the honest label: the app does
not know where that money went. The bucket does **not** count toward `worthShowingMerchants()` —
one real merchant plus two unnamed transactions is not a breakdown, it is the line's total with a
label on part of it. Verified across a real 40-line file: every breakdown's parts sum to its line.

### The chips are a data-quality feature, not just a speed one

Typed by hand the same merchant arrives as "Fern café", "Fern Cafe" and "fern cafe". Every spelling
`merchantGroupKey` has to fold is a guess it could get wrong; a chip reuses the exact string, so
there is nothing to fold. They fill the note and return focus to the amount rather than submitting
— a chip that logged on one tap would be an easy way to record a $0 spend by accident. Scoped to
the chosen line, so "Eating Out" offers places you eat. Capped at 150px: a real recent description
was "Booking.com (Trip to buy house in Melbourne)", which uncapped takes a whole phone row.

---

## 25. `[x]` Alphabetical budget lists, and refunds that don't break the bars — shipped v3.11.2

Two questions in one turn: *"Can we order the needs, wants etc alphabetically?"* and *"How should
I handle returns/refunds?"* The second turned out to be a bug report.

### Alphabetical — but only where it means anything

Budget lines within a group and the category list both arrived in **insertion order**: the sequence
things happened to be created in, which carries no meaning and drifts further from useful with every
addition. A real Subscriptions group of eleven rows took genuine scanning to find "Spotify". Both
are sorted by name now (`localeCompare`, `sensitivity: "base"`, `numeric: true`, so "Café" sorts
beside "Cafe" and "Car 2" precedes "Car 10").

**The Needs / Wants / Savings / N/A sequence is deliberately left alone.** That order *is*
meaningful — needs before wants — and alphabetising it would open the list with "N/A". The existing
comment on `sharedGroupOrder()` warned against ordering by *amount* because cards would jump around
as you type into them; sorting by name is safe in a way sorting by amount is not, since a card only
moves when you rename it.

### Refunds: supported all along, but they broke the merchant bars

A refund is a negative transaction — the quick-log amount field says so, and bank import treats
"money in" assigned to a line as a refund. But `merchantGroups()` computed each merchant's share
against the group's **net** total, so a merchant that netted below zero (returned this cycle,
bought last cycle) produced nonsense:

| Line contents | Old share | Rendered |
|---|---:|---|
| Amazon +$100, Doordash −$99 | **10,000%** / −9,900% | `width:10000%` |
| Amazon −$50, Sneakers +$180 | 138% / −38% | `width:-38%` |

Share is measured against **positive spend only** now, so every share lands in [0, 1] whatever the
refunds do. A net-negative merchant gets a share of 0 — right for what the bar means, since it
shows which merchants are *eating* the line and one that handed money back is not eating any of it
— while its real negative total still shows in the amount column, because that money is real.

**How to verify.** `tests/merchants.test.js` covers an ordinary refund, a net-negative merchant, a
both-negative line and an all-zero line, asserting every share is finite and within range. The
ordering is verified by driving the app: Subscriptions should read Costco → Crunchyroll → GMAIL →
Google Play Storage → iCloud → Microsoft 365 → Prime → Prime Ad Free → Ring → Spotify → YouTube
Premium (note iCloud sorting case-insensitively between Google and Microsoft).

---

## 26. `[x]` Collapsed ledger rows were handing the keyboard their whole editor — shipped v3.11.3

From an assessment of the Expenses page. Most of it came back clean: no horizontal overflow at
390px or 1280px on either subtab, no `NaN`/`undefined` anywhere, no console or page errors, a
tidy empty state on both subtabs for a brand-new user, and no layout damage from a 120-character
budget line name. Two things were wrong, one of them badly.

### a. Every collapsed row exposed its hidden edit form to the keyboard

`.m-row-edit` collapses with the `grid-template-rows: 0fr → 1fr` technique and clips its content
with `overflow:hidden`. That hides the form perfectly well **to the eye**. What it does not do is
take it out of the tab order — a clipped form is still a focusable form.

So every collapsed row handed the keyboard its entire editor: name, classification, category,
amount, frequency, account, "More options", "⇄ Vary", **Done** and **Delete**. Roughly ten
invisible tab stops per row, each set ending in a Delete button for a row the user cannot see.

Measured by walking real `Tab` presses, then counting reachable controls inside collapsed rows
across the app:

| Page | Before | After |
|---|---:|---:|
| Expenses | **695** | 0 |
| Income | 116 | 0 |
| Scenarios | 24 | 0 |
| Assets, Properties | 0 | 0 |
| **Total** | **835** | **0** |

The fix is `visibility:hidden` on `.m-row-edit-inner`, flipped to `visible` when the row opens.
`visibility` is the right tool because it removes descendants from the tab order *and* the
accessibility tree; `display:none` would too, but it cannot be transitioned and would kill the
open/close animation. The `transition: visibility 0s linear .22s` with `transition-delay:0s` on
the open state is what preserves it: opening reveals immediately, closing holds visibility until
the height animation has finished so the content does not blink out early.

One CSS rule, five pages — Income, Expenses, Assets, Properties and Scenarios all share
`modernRowShellHtml`.

**This is exactly the gap item 16 ("Reachable by keyboard", v3.6.0) could not see.** That pass
checked that things *could* be reached. It never asked whether anything reachable *shouldn't* be.

### b. The one tappable row that was 18px tall

Rows in Actual vs. planned become tappable once they have transactions to drill into, and nearly
all are comfortably tall because they carry a progress bar under the figures. "Uncategorized
(one-off)" has no budget and therefore no bar: **18px tall on a phone, and still tappable** — a
quarter of the 44px minimum, with no visual hint it was smaller than its neighbours.
`min-height:44px` on `.budget-row.is-expandable` only ever grows the short one; the other 27 rows
already cleared it. Shortest tappable row is now 44px, none under.

**How to verify.** Neither is unit-testable — both are pure CSS cascade, which layers 1 and 2
cannot see by construction. Drive it: press `Tab` repeatedly from the first budget group and
confirm every stop is a `.m-row-summary` and never a field inside a closed row; then open a row
and confirm its name field still takes focus, its Delete is still visible, and an edit still
persists across a reload (it does — checked name and amount).

---

## 27. `[x]` Make picking a budget line a search, not a scroll — shipped v3.12.0

A household a year in has forty-odd budget lines, and every place that asks "which line is this?"
listed all of them flat and in creation order — which after a year is no order at all. Finding
"Spotify" meant reading the list.

**What shipped.** Three surfaces, one shape each: the transaction row's "Linked to" select and the
bank-import screen's per-merchant select now emit `<optgroup>`s, grouped by category and
alphabetical inside each group, built by the same `computeSharedGroups()` that builds the Budget
tab's cards — deliberately the *category* axis regardless of the Budget tab's own Group-by toggle,
since a Needs/Wants-grouped dropdown leaves the run under "Wants" as long as the flat list was.
Both selects also repeat the five lines logged against most recently in a "Recently used" group at
the top (suppressed on a budget short enough to fit on one screen). The quick-log sheet gets a
search box above its chips, shown once the lines outgrow the eight-chip cap — filtering matches a
line's name, category and type, and everything ever typed into a transaction logged against it, so
"uber" finds a line called "Rideshare & Taxi". Enter in the box picks the top match. Also:
categories are now offered alphabetically everywhere one is *picked* (state.categories is
insertion order).

**How to verify.** `tests/render-smoke.test.js` covers the optgroup grouping, alphabetical sort
within a group, the single-`selected`-even-when-listed-twice rule, and the short-budget suppression.
Drive the quick-log search box in the browser to confirm filtering patches in place without
dropping the caret or the typed amount.

---

## 28. `[x]` Make logging a refund possible on a phone — shipped v3.13.0

Reported from the Android install: the keyboard offers no way to type a negative amount, and
pasting one in doesn't save. Two separate bugs sitting on top of each other.

1. The quick-log sheet refused every negative amount outright (`amount <= 0` rejected a correctly
   pasted `-129.99` with "Enter an amount first."). A refund is a real transaction with a negative
   amount — every sum downstream already reads `s + (Number(t.amount) || 0)` rather than clamping —
   so the guard now only rejects zero.
2. There was no way to *enter* one: `inputmode="decimal"` gets the decimal keypad, which has no
   minus key on Android or iOS. The quick-log sheet gained a Spend/Refund toggle under the amount,
   and a transaction row gained a −/+ button beside its own Amount field; the toggle owns the sign,
   the field owns the magnitude, so typing "-45.50" on a keyboard that has a minus flips the toggle
   rather than disagreeing with it.
3. Pasting was broken for a third reason: `<input type="number">` silently reads back an empty
   string for anything that isn't a bare number literal (a leading "$", a thousands comma, the
   Unicode minus a bank app copies) — no error, no `badInput` flag, just a stored zero.
   `parseAmountInput()` (`lib/format.js`) normalises clipboard text before it reaches the field,
   including accounting notation `(24.99)`.

**What shipped.** The sign toggle (hidden on a fine pointer — a desktop keyboard already has a
minus key), `parseAmountInput()`, a global paste handler for the quick-log and transaction amount
fields, and a fix to the collapsed transaction row's own header figure on an amount edit (it was
never patched, so flipping a spend to a refund left the header showing the old sign).

**How to verify.** Verified in Chrome under Pixel 5 emulation: a refund logged entirely by thumb,
no keyboard minus anywhere, moves a budget line's actual spend and its "left" figure by the right
amount. 78 new `render-smoke` tests cover the toggle, the paste normalisation and the header patch.

---

## 29. Full app assessment (September 2026, post-v3.13.0) — nothing found

Requested as an open-ended "assess for bugs and improvements." Recorded here, with nothing shipped,
so the next session doesn't re-cover the same ground.

**What was checked.**

- **Every page and every subtab** (`.subnav-item` within each), at 390px and 1280px, against real
  generated sample data (income, expenses, assets, properties, three scenarios): zero console
  errors, zero page errors, zero `documentElement.scrollWidth` overflow, zero `NaN`/`undefined`/
  `[object Object]`/`Infinity` anywhere in rendered text.
- **The two most recently shipped features** (items 27 and 28, both under a week old at the time
  and the least likely to have had a follow-up audit pass): drove the quick-log sheet end to end —
  typed an amount, filtered chips by search, toggled Spend/Refund, picked a chip, submitted — and
  confirmed the resulting `state.transactions` row was correctly signed, correctly linked, and
  produced no console errors. Confirmed the amount and caret survive the sheet's in-place
  re-renders (More, filter, sign toggle) exactly as the shipping commits claimed.
- **Dark mode**, spot-checking the item-10 legend-swatch regression class (`getComputedStyle`
  against real elements, not eyeballing): every swatch sampled on Assets → Summary had a real
  computed background colour, none transparent.
- **Backup export → clear → import round trip**, via the real UI (not a direct function call): the
  only two `localStorage` keys that differed afterward were `lastBackupDate` (deliberately
  restamped) and two synthetic/computed income rows gaining default field values `migrateState()`
  fills in on import — the same class of harmless, self-correcting diff `PROJECT_KNOWLEDGE.md`
  already documented from item 16's version of this test, just with more fields now that
  Division 293, HECS, deductions and reserve-year scheduling all exist. No data loss, nothing a
  user would see.
- **Financial-math code review** of the areas with the most room for a subtle off-by-one: the FIRE
  bridge simulation (`calc/fire.js`) — contribution/withdrawal ordering, the terminal bankruptcy
  clamp, and the accessible/debt double-counting boundary with property equity; the capital-gains
  discount's "more than 12 months" boundary (`CGT_DISCOUNT_MIN_DAYS = 366`, i.e. day 366 qualifies,
  day 365 doesn't — correct); and land tax's per-property aggregation share. No defects found in
  any of them.
- **Keyboard/focus-visible** on the newest `all:unset` buttons (`.tx-sign`, `.qlog-sign-option`):
  both carry their own explicit `:focus-visible` rule, so item 16's root-level fix wasn't
  bypassed by anything shipped since.

**The one documentation gap found and fixed here:** items 27 and 28 (v3.12.0, v3.13.0) had shipped
without being added to this file — the exact kind of drift item 21c fixed once already. Recorded
above.

**Not re-covered:** anything already itemised 1-26 above, on the standing assumption that a shipped
and verified fix stays fixed unless a later item says otherwise.

---

## 30. `[x]` Let a refund point at the purchase it undoes — shipped v3.14.0

Raised against item 28/29: a refund being a negative transaction against a budget *line* is
enough for every total in the app to net out correctly, but doesn't say which purchase on that
line actually came back — worth having once a line carries more than one similarly-priced thing
(which pair of shoes, which Amazon order).

**What shipped.** Toggling Refund with a budget line already picked offers that line's recent
positive-amount transactions as tap-to-fill chips ("Refunding which purchase?"), the same shape as
the existing merchant-name chips. Tapping one prefills the amount with what was actually paid and
tags the new transaction with `refundOf`; the collapsed row then reads that back as "refund of
`<date>`'s `<amount>`" — a live lookup against the original transaction, not a snapshot, so
correcting the original's own date or amount later keeps the label honest rather than going stale.
`refundableTransactions()` (`calc/ledger.js`) is the pure piece behind the chip list: newest-first,
scoped to the one line, with refunds themselves excluded so a refund can never be offered as
something to refund.

**Deliberately just a pointer, never required or enforced** — the same restraint item 22 used for
a deleted account's rows: a refund for something never logged (a gift, a bank correction) still
works with nothing selected; the amount can still be hand-edited away from the matched figure
after picking a candidate (a partial refund is a real refund); and the candidate list is only
offered once a line is picked at all — a one-off has no bounded history to guess from, and
guessing wrong would be worse than not offering a list. Tapping the same chip twice clears the
link, same as changing the line or the sign back to Spend; `submitQuickLog` only ever attaches
`refundOf` in Refund mode regardless of what `quickLog.refundOf` happens to be holding, rather
than trusting every path that reaches it to have cleared it first.

**How to verify.** `tests/ledger.test.js` pins `refundableTransactions()` (order, the line
boundary, refunds excluded from their own candidate list, the limit). `tests/render-smoke.test.js`
covers the chip HTML (Spend mode renders nothing, a one-off renders nothing, an unlogged line
renders nothing), `submitQuickLog` tagging a refund and never a plain spend, and
`transactionSummaryText` staying silent when `refundOf` points at nothing (never set, or its
target since deleted). Driven end to end in Chrome at 390px: logging a spend, then a refund against
it — the chip appears only in Refund mode, tapping it overwrites a hand-typed amount with the
original's, tapping it again clears the link and leaves the field alone, and the submitted
transaction carries `refundOf` with no console errors.

---

## 31. `[x]` An accidental "+ Add" tap no longer sticks — shipped v3.14.1

Reported: tapping "+ Add" (an asset, an expense, a loan, …) by mistake and then just navigating
away left a "New item"/$0 record behind. Every "+Add" button pushed straight into state and
persisted immediately, before the row's modal even opened.

**What shipped.** Every one of these flows already routes through one function to open the row as
a modal (`openModernRow`) and one to close it (`closeActiveModernRowUI` — the single entry point
for Done, Escape, a backdrop tap, the back button, and switching straight to another row).
`openModernRow` now optionally takes the just-created item and snapshots it; `closeActiveModernRowUI`
compares the live object against that snapshot on the way out and — only for a row opened via
"+Add" — splices it back out, unpersisted, if nothing about it changed. Comparing against the
*current* object rather than a "was anything typed" flag means typing something and undoing it
back to the same defaults still discards, correctly — nothing about the row differs from one
nobody touched.

Covers assets, share holdings, vehicles, income, shared/housing/property expenses, property loans,
and the Transactions page's "Add with full details". **Deliberately not covered:** debts and a
property's acquisition costs, which use a simpler always-visible-row pattern with no open/close
step to hook — a smaller, lower-risk gap left for later if it turns out to matter.

**The trap, if you touch this again:** guarded by object identity, not just the row's index — if
the user instead taps the row's own Delete button (which doesn't close the modal), the array has
already shifted, and a later Escape/backdrop-close must not splice out whatever now happens to sit
at the old index.

**How to verify.** Not unit-testable — pure DOM/event wiring. Driven in Chrome across 10 scenarios:
add + abandon via Done/Escape/backdrop for assets, expenses, income, a manual transaction and a
property loan (all discarded); add + edit + Done (saved); an *existing* row opened and closed
untouched (must survive — the one regression this could plausibly cause); explicit Delete on a
fresh row followed by a further close (single removal, no double-splice, no crash).

---

## 32. `[x]` Manage property offset accounts from an Assets tab — shipped v3.15.0

Asked: offset balances already count as liquid wealth everywhere in the app's math
(`liquidAssetsValue()` adds them in alongside Cash and Shares), but the only place to see or change
one lived three levels deep on the Properties tab — a property, its Loans section, one specific
loan's editor. The loan editor's own Offset field tooltip already warned "Don't also add it as a
separate Cash asset on the Assets tab, or it'll be counted twice", a sign this number needed
somewhere more visible than it had.

**What shipped.** A new "Offsets" tab on the Assets page, listing every property loan with its
current offset balance and which property it belongs to. **Not** a sixth `ASSET_CATEGORIES` entry
— an offset balance isn't a thing you add or delete, it's a number that already lives on a loan the
Properties tab owns, so this list has no "+Add" and no Delete. Every row is a second window onto
`property.loans[i].offsetBalance`, not a copy of it: editing here writes straight back to the same
field, and a "View on Properties" button jumps to the loan's own card for anything beyond the
balance (rate, term, repayment type).

**The trap, if you touch this again:** both directions of the edit have to stay in sync without a
page switch, and the two patch functions involved cover different halves of the same page.
`patchPropertyCardComputed()` (existing) only patches *derived* figures on the Properties card —
badges, sub-lines, headline amounts — never the raw `.loan-offset` input itself, since that field is
normally the source of truth on that page and nothing else there ever needs to overwrite it. Editing
from the new Offsets tab is the one case that does, so it patches `.loan-offset`'s value directly as
well. The reverse direction needed the mirror: the existing `.loan-offset` handler now also patches
this tab's row and running total (`patchOffsetsRow`), which `patchPropertyCardComputed` doesn't
reach either. Both patches are guarded by `document.activeElement` so neither can fight someone
actively typing into the other copy of the same field.

**Also caught by measuring rather than eyeballing:** the row's fixed-width input and icon button
(110px and 40px) shrank under flex layout on a 390px phone once nothing protected them — the same
trap `.m-cost-row .row-del`'s own `flex:none` already exists to avoid. Fixed by giving both the same
treatment; confirmed 40×40 via `getBoundingClientRect()`, not by looking at it.

**Reused rather than special-cased:** the quick-action FAB's existing "no single obvious action on
this page" fallback (already relied on by Projections) covers a tab with nothing to add, so no FAB
changes were needed.

**How to verify.** Not unit-testable — DOM rendering plus two-way live patching. Driven in Chrome at
390px, light and dark: renders with real loans and with none; no horizontal overflow, including a
synthetic long property/loan name; editing from either page updates both pages' figures and both
running totals; the jump button reaches the right property card; Tab-key focus (not `page.focus()`,
which doesn't reliably trigger `:focus-visible` the same way) shows a real ring on both the input and
the jump button.

---

## 33. `[x]` Skip the Google Fonts request when offline — shipped v3.15.1

Asked: could the app check for internet before trying to download anything, given it's otherwise
fully static/offline-capable? The one thing it still reached out for unconditionally was Google
Fonts — a static `<link rel="stylesheet">` in `<head>`, fired on every load including fully offline
ones, where it's guaranteed to fail. The service worker's network-first fetch handler still had to
attempt it (and time out, which on a flaky-but-connected network can take real seconds) before
falling back to nothing, since this request was never cached to begin with.

**What shipped.** The stylesheet link and its two preconnect hints are now injected from an inline
script, only when `navigator.onLine` is true, in the same document position as the static tags they
replace — so the online path behaves exactly as before (same request, same timing) and the offline
path makes zero network attempts. Costs nothing visually either way: every font-family stack in
`base.css` already ends in `system-ui`/`sans-serif` (or `ui-monospace`/`monospace`).

**Deliberately not built:** a re-check mid-session (e.g. an `online` event listener that loads fonts
once a connection returns). Swapping the font under content already rendered with the fallback would
be a worse surprise than just keeping it for that visit — checked once, at load, and that's it.

**The honest limit, stated up front rather than found later:** `navigator.onLine` is a coarse signal
— a captive portal can report "online" with no real internet reaching `fonts.googleapis.com` — so
this is a best-effort skip for the common fully-offline case (an installed PWA used on a plane or
train), not a guarantee, and errs toward attempting the request whenever it isn't certain there's no
network.

**How to verify.** Not unit-testable — inline `<head>` script, no exported function. Driven in
Chrome: online, the font link and both preconnects still inject and the same request fires; offline
(`navigator.onLine` stubbed false via `addInitScript`), zero font-related requests fire, the app
still renders correctly on the system-font fallback, and load finishes faster with nothing to wait
on.

---

## 34. `[x]` Quick-log amount field was collapsing to ~17px on phones — shipped v3.15.2

Reported: "Adding expenses - the money input looks odd, too narrow in height." Confirmed via
`getComputedStyle`: `.qlog-amount` (the quick-log sheet's headline amount field) declares
`font-size:34px`, but at phone widths base.css's iOS-zoom-prevention rule —
`input[type="number"]{ font-size:16px !important }` — always won over it regardless of specificity,
since `!important` beats a plain declaration outright. With no padding on this field, font-size is
most of its box height, so losing that fight collapsed it from a 37px headline input to a ~17.6px
sliver, not just smaller text.

**What shipped.** `#quickLogAmount{ font-size:34px !important }`, in its own rule rather than folded
into `.qlog-amount`: an id selector is specific enough to out-rank the attribute selector once both
carry `!important` (id beats attribute+element on specificity alone), and this input's id is unique
to it, unlike its class.

**Checked while fixing it, worth knowing before adding another large phone-width input:** every other
font-size above 16px in the stylesheets belongs to a `h1`/`b`/`span`/`div` — display text, never an
`<input>` or `<textarea>` — so `.qlog-amount` was the only field the base.css rule was silently
fighting. A future field that deliberately wants a phone-width font above 16px will hit the exact
same collision and needs the same id-selector treatment (a class alone won't out-rank the attribute
selector even with `!important`, since `input[type="number"]` is more specific than a bare class).

**How to verify.** Not unit-testable — pure CSS cascade. Verified via `getComputedStyle` at 390px and
1280px, light and dark, Spend and Refund mode: field height restored from 17.6px to 37.4px
(font-size 34px), matching the intended design.

---

## 35. `[x]` Clone a scenario — shipped v3.16.0

Asked for directly: a way to copy a scenario rather than rebuilding its home costs, purchase
calculator and invest leg by hand every time a what-if is a small variation on one already set up
("what if Buy Sydney but with a 15% deposit instead of 20%").

**What shipped.** `cloneScenario(sourceName)` in `scenarios.js` prompts for the copy's name
(defaulting to "`<source>` copy"), then deep-copies `state.home`/`purchase`/`invest` for that
scenario under the new name via `deepClone()` — a helper that already existed in `state.js` but had
no caller until now. "Near-identical" has to include anything that currently makes the source
scenario behave the way it does: a shared/income row varied specifically for it via the "⇄ Vary"
panel is as much a part of that as its own home-cost rows, so any `scenarioOverrides` entry keyed to
the source carries into the clone too — the same reasoning `renameScenario`/`deleteScenario` already
use `overridableRows()` for.

A "Clone" icon button sits next to Rename on both surfaces that already have it — the Scenarios
page's own home-block header and the Dashboard's scenario cards — reusing the shared `icon-btn`
class and the existing `onScenarioControlClick` handler both already route through, so no new
click-wiring pattern was needed.

**The trap, if you touch this again:** ids inside the copied home rows are left exactly as they
were, not regenerated. `state.home` is keyed *by scenario name*, so every scenario already has its
own `"homeLoanRow"` by design — that sentinel id is what lets `patchHomeLoanRowIfSynced()` find it
regardless of which scenario it's looking at — and an id is only ever compared within one scenario's
own array, never across scenarios. Regenerating ids on clone would have been the bug, not the fix.

**Also decided:** the clone is inserted right after its source in `state.scenarios` (not appended to
the end) and becomes the active scenario, matching `addScenario()`'s own "a newly-created scenario is
what you want to look at next" call.

**How to verify.** Not unit-testable — DOM wiring plus state mutation across several maps. Driven in
Chrome: the clone's home/purchase/invest deep-equal the source but are separate objects (mutating the
clone's home row left the source untouched); a `scenarioOverrides` entry on a shared-expense row
carried to the clone while staying on the source; the clone lands immediately after its source and
becomes active; both the Scenarios-page and Dashboard-card buttons work; no horizontal overflow at
390px in light or dark; touch targets measured at 40×40; Tab-key focus shows a real ring.

---

## Tax return accuracy (October 2026 review)

Found by lodging a real FY25/26 return (two owners of one QLD investment property, an ASX share
sale, two iShares ETFs, crypto, a mid-year change of employer) and then reading this app against
every figure that went into myTax. The app's tax engine estimates a **rate** — "what does this cost
per year, right now" — while a return needs **the year's actuals, each on its ATO label**. The items
below close that gap, quiet wrong numbers first. Every fixture quoted is from the real return, so
each doubles as a test case with a known right answer.

## 36. `[x]` Deductions that stop or start partway through a tax year — shipped v3.16.1

`rowDeductionAnnual()` returned $0 for any row whose `endDate` had passed — including for the tax
year it ended in, which is the year anyone lodging is looking at — and had no way to say "the
expense carries on but stopped being claimable" (home-office rent once an employer office became
available on 1 Oct 2025). Fix: pro-rate by days within the household year, and add
`deductibleFrom`/`deductibleUntil`, separate from `endDate`. Fixture: $610/wk x 8% claimable to
30 Nov 2025 = **$1,063.71** for FY25/26.

**What shipped.** `deductionYearFraction(item, win)` in `calc/tax.js` — the days the claim covers
within the window over the window's days, where the claim ends at the earlier of `endDate` and
`deductibleUntil` — and `rowDeductionAnnual(item, win)` multiplies it in. `computePersonTax` passes
the same household-year window it already used for capital gains. "Claim from"/"Claim until" sit
with the other deduction fields under a row's More options. Day counts go through two new UTC
helpers in `calc/ledger.js` (`isoDayNumber`, `overlapDaysInclusive`) so a daylight-saving change
can't lose a day.

**Still open:** budget rows have no start date, so a line *added* mid-year with no "Claim from"
counts the whole year. **Measured:** in Chrome at 390px, light and dark, a $8,750 claim limited to
1 Jul–30 Sep became $2,205 on the Income card (92/365); no overflow; fields 158×40.

## 37. `[x]` Borrowing costs on investment loans (the 5-year rule) — shipped v3.17.0

LMI, the lender's establishment/settlement fee and mortgage registration had nowhere to go. Typed
into `acquisitionCosts` they inflated the CGT cost base *and* were never deducted. Fix:
`loan.settlementDate` + `loan.borrowingCosts`, apportioned by days over 5 years or the loan term if
shorter, exactly as the ATO's deductible borrowing expenses calculator does; $100 or less is
deductible in full in the year incurred. Fixture (invented): $9,800 settled
15/11/2024 → FY24/25 $1,223.66 · FY25/26 $1,958.93 · FY26/27 $1,958.93 · FY27/28 $1,964.29 ·
FY28/29 $1,958.93 · FY29/30 $735.26 (1,826 days). Out of scope for now: writing off the remaining
balance when a loan is refinanced or paid out early.

**What shipped.** `borrowingCostsSchedule(loan)` / `borrowingCostsDeduction(loan, win)` in
`calc/property.js`, following the ATO calculator (v1.04) line for line — including its rounding:
each year rounded on its own, the residual cent into the first year (hence $1,223.66, not
$1,223.65). `propertyTaxDeductibleResultAnnual` subtracts the year's share; the cash result is
untouched. Loan editor: Settled on, Borrowing costs (one total), Original term (only consulted
under five years — `termYears` is what's *left*), and a live note: "Deductible FY26/27: $1,958.93 of
$9,800 — spread to FY29/30." **Measured:** on sample data each 50% owner's taxable income fell
$1,332; persisted across reload; no overflow at 390px in light or dark.

**Not done:** moving costs already typed into Acquisition costs. Nothing distinguishes an LMI row
there from a stamp-duty row, and guessing would move someone's cost base; the field's tooltip says
where each kind goes.

## 38. `[x]` Second-hand plant & equipment isn't claimable — shipped v3.18.0

`plantDepreciationAnnual()` claims `plantValue / life` unconditionally. For residential property
bought second-hand under a contract after 9 May 2017 the claim is **$0** — the fixture's QS report
values $12,600 of plant the owner may not claim, which this app would have deducted at ~$1,260/yr.
Add a "bought new / second-hand" flag; keep the values (they become a capital loss on scrapping and
feed CGT on sale).

**What shipped.** `plantSecondHand` per property and `plantIsClaimable()`; a checkbox in the Depreciation section with the 9 May 2017 rule spelled out. The value stays for capital losses and CGT. Default false, so no existing figure moves.

## 39. `[x]` Capital works by component, from the QS schedule — shipped v3.19.0 (+ v3.20.1 layout fix)

One `constructionCost` + `constructionDate` can't represent the fixture: original 1993 building
($2,150/yr, ends FY33/34) plus a later renovation ($750/yr), and the first year pro-rated from the
purchase date (FY24/25 $1,810, not $2,900). Simplest correct shape: let the user enter the quantity
surveyor's year-by-year table (`depreciationSchedule: [{fy, capitalWorks, plant}]`), with the
formula as the fallback when there's no report.

**What shipped.** `depreciationSchedule` rows (FY select, capital works, plant) under the Depreciation section; `propertyDepreciationForFy()` takes a listed year verbatim and otherwise pro-rates the formula by days from the purchase date and to the day before the 40th anniversary of completion; `propertyDepreciationForWindow()` weights financial years across a calendar-year window. The section now shows this year's claim, not a full-year rate. **v3.20.1:** the phone-width `.m-cost-row` grid squeezed the row's second amount to 14px — schedule rows stay flex (80/72/72px measured at 390px).

## 40. `[x]` Property CGT cost base — shipped v3.20.0

`propertyCostBase()` must subtract capital works deductions claimed (property acquired after
13 May 1997) and must not include borrowing costs (item 37 gives them a home). Today it overstates
the cost base, so the gain on sale is understated.

**What shipped.** `capitalWorksClaimedToDate()` (whole years from purchase plus the elapsed share of this one; nothing before 13 May 1997 or without a purchase date) comes off `propertyCapitalGain()`'s cost base. The tile's title states the cost base and the reduction; the growth % stays against what was paid. Borrowing costs never enter `acquisitionCosts` now that item 37 gives them a field.

## 41. `[x]` Share lots (parcels), and the discount per parcel — shipped v3.21.0

A sale takes `avgCost x units` and one acquisition date. The fixture sold 3,000 units in two sales
from **six** purchase lots; discount eligibility is per lot. Store `asset.lots[] = {date, units,
price, brokerage}`, match sales FIFO by default (specific-ID optional). Fixture: FIFO gives cost
bases $2,947.78 / $2,681.72, gains $1,432.22 / $578.78 = $2,011.00, all discounted.

**What shipped.** A "Purchase lots" section per holding (date, units, price, brokerage). A sale with no typed cost base or date uses `fifoParcels()`, stores `sale.parcels` and marks `lot.soldUnits`; deleting the sale gives them back. `saleCapitalGain()` works parcel by parcel and reports discountable / other / loss splits. Avg cost follows the unsold lots. Adding a lot swaps only that section's markup — `renderAssets()` would close the editor mid-entry.

## 42. `[x]` ETF / managed fund annual tax statements (AMIT) — shipped v3.22.0

ETFs are modelled as dividend-per-unit + franked %. IVV's FY25/26 return was foreign income
($205.30), a foreign income tax offset ($30.80), a fund-discounted capital gain (18H $88.40 /
18A $44.20) and a cost base increase ($61.20). Add a per-fund, per-year statement record holding
13U/13C/13Q/18H/18A/20E/20M/20O and the AMIT cost base adjustment, applied to the holding.

**What shipped.** `asset.taxStatements[]` edited under "Annual tax statements" on a holding; `personFundStatements()` feeds taxable income (13U+13C+13Q+20M), refundable franking credits, a non-refundable FITO (20O) and fund gains into CGT; a statement year drops that holding's dividend estimate. AMIT adjustments (per unit held at 30 June) are added to a later sale's cost base. An unowned holding in a two-person household warns that it's on nobody's return.

## 43. `[x]` Capital losses: before the discount, and carried forward — shipped v3.23.0

`personCapitalGains()` discounts per sale (documented simplification). Real order: losses against
non-discount gains, then discount gains, then the 50%. Add `capitalLossCarriedForward` per person.

**What shipped.** `personCapitalGains()` rewritten in the CGT schedule's order; returns 18H (`totalGains`), the net gain, losses applied (current and brought forward) and `lossCarriedForward`. "Capital losses b/f" per person on the tax card. Note the old per-sale approach *understated* gains when a loss met a discounted gain (it took the loss at full value against a half-taxed gain).

## 44. `[x]` Deductions on their ATO labels, and the working-from-home method — shipped v3.24.0

Tag each deductible line D1/D2/D3/D4/D5/D10; add the fixed-rate method as an hours log x the
year's rate (70c in FY25/26) and warn when internet/phone/electricity lines are *also* flagged,
since the rate covers them. Fixture (invented): D2 $1,450, D5 $140 + a $1,063.71 rent share, D10 $330; working from home
1,240 h × 70c = $868.

**What shipped.** `deductionLabel` per line (D1-D5, D9, D10, D15; blank = D5); `deductionsByLabel()`; `WFH_FIXED_RATES` and per-person, per-FY `wfhHours`; `wfhOverlapRows()` names internet/phone/energy/stationery lines also claimed. The deduction checkbox now says "Tax deduction" (D9/D10/D15 aren't work-related). The transactions CSV gains a Return label column.

## 45. `[x]` Tax tables per financial year — shipped v3.25.0

`AU_TAX_BRACKETS`, `HELP_REPAYMENT_RATES`, `MLS_TIERS` are all labelled 2024-25; FY26/27 has the
16% rate at 15%. Key every table by FY and pick by the year being computed, so last year's return
and next year's projection both work. Add the private health insurance rebate tier by combined
family income — the fixture's $126-each clawback was predictable.

**What shipped.** `TAX_YEARS` in constants.js for FY24/25-FY26/27, every figure read off ato.gov.au in October 2026; `taxTablesFor(fy)` with `assumed`/`borrowedFrom` past the newest year (the tax card warns). HELP is marginal from FY25/26; surcharge tiers start a dollar above each published threshold ("$101,000 or less" is base). The old Medicare shade-in thresholds were approximate ($26,000/$32,500) — FY24/25's are $27,222/$34,027. Household premiums + the tier claimed with the insurer give `phiRebateAdjustment()`, split evenly across the two returns. **Every rate table goes stale each July** — add the next year's row when the ATO publishes it; the tests name the year they check.

## 46. `[x]` A tax-year record and a myTax worksheet — shipped v3.26.0

Per person, per FY, **actuals**: income statements and PAYG withheld, interest per account with
ownership share, the fund statements (42), the rental schedule split into rent / other rental
income / each expense line with total and own share, actual loan interest from the statement
(overriding the balance x rate estimate), CGT events, deductions by label. Output: one page per
person laid out in myTax's order, an evidence checklist, a refund estimate (withheld − tax), and a
"why it moved since last year" breakdown.

**What shipped.** `calc/taxyear.js` (`state.taxYears[fy]`: income statements, interest with share, recorded deductions, per-property rental actuals, evidence ticks, lodged snapshots) and `components/taxyear.js` (the "Tax return worksheet" ledger on the Income page). `computePersonTax(person, {fy})` uses that year's record and rates, line by line falling back to the model, and returns `refund`. The engine was checked label by label against a lodged return (myTax's on-screen estimate appeared not to gross up one trust franking credit; the engine follows the law and grosses it up). `tests/taxyear.test.js` now rebuilds two invented returns end to end, with taxable income rebuilt by hand from its parts. **Still open:** per-employer reportable super contributions, ages for the rebate (under-65 rates only), and a PDF/print layout.

## 47. `[x]` Borrowing costs: write off the rest on refinance or payout — shipped v3.27.0

A loan paid out or refinanced inside its five-year spread makes the undeducted balance deductible
in that year. Add `loan.endedOn`; the schedule stops there and that financial year takes the rest.
The replacement loan's own costs start their own schedule on the new loan.

**What shipped.** "Paid out on" per loan; `borrowingCostsSchedule()` gives the payout year everything not yet claimed (flagged `writtenOff`) and stops. Fixture: refinanced 1 Mar 2027 → FY26/27 deducts $6,617.41. A payout date after the spread ends changes nothing. Interest and repayments on a paid-out loan are not stopped by this date — set the balance to 0 or delete the loan.

## 48. `[x]` Reportable employer super and fringe benefits on income statements — shipped v3.29.0

Income statements carry reportable employer super contributions (RESC) and reportable fringe
benefits (RFBA). Neither is taxable income, but both count for the surcharge/rebate tiers, the
HELP repayment income and Division 293. Add both fields to the worksheet's income statements and
route them into those three figures for that year.

**What shipped.** RESC and RFBA columns on worksheet income statements. With statements entered, HELP repayment income, surcharge/rebate income and Division 293 income are taxable income + RFBA + RESC + any net investment loss — the ATO's definition, and the first time the app adds a rental loss back for the surcharge. Model mode (no statements) keeps its simpler forms. Phone layout: payer / three amounts + delete / RESC · RFBA.

## 49. `[x]` Print the worksheet — shipped v3.31.0

A print stylesheet and a "Print / save as PDF" button: one person per page, every section expanded,
no app chrome.

**What shipped.** `taxYearPrintHtml()` builds a static copy into a top-level `#printRoot` only while printing; the print stylesheet hides every other body child. Verified by printing to PDF and rasterising: the first attempt was near-invisible from a dark-mode browser (table cells inherit the theme's light `--ink`) — every descendant is forced black.

## 50. `[x]` Move borrowing costs out of Acquisition costs — shipped v3.28.0

Costs typed into Acquisition costs before item 37 existed can't be told apart by the app. A
"Move to loan's borrowing costs" button on each row, with rows whose names look like loan costs
(LMI, mortgage registration, loan/application/establishment fee, valuation, broker) highlighted —
nothing moves without a click, because moving one changes the CGT cost base.

**What shipped.** `looksLikeLoanCost()` and `moveAcquisitionCostToLoan()` (adds to the earliest-settled loan, dates an undated loan from the purchase date, undo restores all three fields). Suggested rows: tinted, labelled button; others: a 32px ↪ icon with an aria-label, so stamp duty doesn't carry an invitation to move it.

## 51. `[x]` Age-based private health rebate — shipped v3.30.0

The rebate is higher when the oldest person on the policy is 65-69 or 70+. Add a date of birth per
person; the rebate uses the oldest person's age at 1 July of the year. Rates from ato.gov.au for
FY24/25-FY26/27.

**What shipped.** `dateOfBirth` per person (tax card, Adjust); `phiAgeBand(fy)` from the oldest person's age at 1 July; `TAX_YEARS[fy].phi` rates per band (`u65`/`a65`/`a70`). With no dates the note says under-65 is assumed. Simplification: everyone with a tax card is taken to be on the policy, and the age is fixed for the year rather than switching on the birthday.

## 52. `[x]` Budget lines in financial years — shipped v3.32.0

Three gaps found auditing budget lines against the household year: a line can end but not START
(so a cost beginning next month counts from today, everywhere); a reserve ("no fixed timing")
line that starts or ends inside its reserve year still targets the full yearly amount; and the
"this year so far" panel has actuals but nothing planned to compare them to. Add `startDate`,
honoured everywhere `endDate` is (totals, projection, cash-flow forecast, deductions); pro-rate a
reserve's target by its active days in the window; and show planned-to-date against actual per
category for the household year.

**What shipped.** `startDate` on every ledger row ("Starts (optional)" beside "Ends"), honoured by `isActiveOn`, `isActiveInYear` (same anchor date as the end), the cash-flow forecast (counts the month it starts in) and `deductionYearFraction` (the later of the line's start and the claim's); the row says "Starts …" until then. `activeShareOfWindow()` pro-rates a reserve line's target. `plannedToDateByCategory()` gives each category's planned spend for the year so far (share of the WHOLE year each line ran, so a yearly bill isn't front-loaded), shown against actual in This year so far, over-plan in --bad, with a note that lumpy bills are smoothed. **Not changed:** a non-reserve line's month target (`budgetCycleFor`) still ignores dates, and the projection's year 0 counts a line starting later in the year as not running (symmetry with end dates).

---

## App assessment (October 2026, post-v3.32.0)

An open request after PR #83: "a full app assessment — all current features and the layout/UX/UI
improved, new features welcome". Every page and subtab was driven at 390px and 1280px, light and
dark, against generated sample data. There were zero page errors and zero sideways overflow, so
everything below came from looking at the result rather than from the console.

### Wrong or misleading

## 53. `[x]` Net worth over time started from a partial total — shipped v3.32.1
The Assets chart summed whatever had a value on each date. Before 17 Oct only three Shares holdings
had history, so the line read ~$12k for six weeks and then leapt to $625k — a "growth" that was
just the day logging began.

## 54. `[x]` USD holdings were added as AUD with no rate set — shipped v3.32.1
`toAudAmount()` passes USD through unconverted when `state.fx.usdAud` is empty (deliberately, so
nothing is zeroed). Nothing said so: the Shares total, the 1D gain glance and net worth silently
added US$2,170 as A$2,170.

## 55. `[x]` "Property equity" meant two things — shipped v3.32.1
Assets' tile excludes the offset (it's already in Liquid), Properties' tile includes it. Both were
captioned "net of offset" and differed by exactly the offset balance.

## 56. `[x]` Scenario names cut to "Buy …" on the Dashboard — shipped v3.32.1
At 1280px each card spent its header on three icon buttons, leaving the name ~40px. The edit
pencil also sat on top of the Current situation badge.

## 57. `[x]` The floating buttons covered figures — shipped v3.32.1
The + and back-to-top buttons are fixed over the content column's right edge, covering monthly
totals and the FI card's values on both widths.

## 58. `[x]` The stale-assets banner couldn't tell two people's super apart — shipped v3.32.1
"Superannuation (never logged), Superannuation (never logged)".

### Layout and UX

## 53–58: what shipped (v3.32.1)

- **53.** `coverageStart()` (`calc/history.js`) finds the first date every asset, property and debt
  held today had a value; the net worth line and the mix chart start there and say what started
  late. A record never logged pushes the start to today, and the empty state names what to log.
  A blank row (no amount, no history) doesn't hold the chart back.
- **54.** A red note above the Shares list, with a `1 USD = [ ] AUD` field (`setUsdAudRate()`), the
  same two fields the price-sheet paste sets. The pass-through itself is unchanged, by design.
- **55.** Assets: "N properties · offset counted in Liquid". Properties: "incl. $X in offset".
- **56.** Rename / Clone / Delete behind a ⋯ on each card (the page-overflow pattern). Enter on the
  card only selects it when the card itself has focus, so Enter on the ⋯ reaches the ⋯.
- **57.** A 92px right gutter on `.app-content` above 880px. The secondary fab used an up-chevron,
  which read as scroll-to-top; it is three dots now.
- **58.** `staleAssets()` adds a `label` with the person; the banner lists three and "N more".

## 59. `[x]` Explanations behind an ⓘ, not in front of the content — shipped v3.33.0
Explanatory paragraphs carry class `help`. `lib/help.js` hides them (body class `help-hidden`)
and puts an ⓘ in the nearest `<details>` summary, or inline before the paragraph when there is
none, via a MutationObserver — renderers don't have to know. Accounts → Preferences →
Explanations turns them all back on (per device, `wealthPlanner.showHelp`). Tag new explanations
with `help`; leave dynamic notes and empty states untagged, they are content.

## 60. `[x]` A consistent header toolbar; Sample data and Reset in a menu — shipped v3.33.0
Search, notifications, status, Theme, Export backup, then a ⋯ with Share, Import backup, Load
sample data and Reset everything… (red). Ids unchanged, so every handler and the mobile mirrors
work as before. `.page-overflow-menu .btn[hidden]` needed its own rule (the CLAUDE.md gotcha).

## 61. `[x]` Summary tiles that fit the screen — shipped v3.33.0
Every `.stat-row` is two-up under 700px, an odd last tile spanning the row. The Dashboard gains a
Financial independence tile (accessible money against 25× spending, super left out) that opens
Insights.

## 62. `[x]` Insights cards sized to their content; steady forecast months collapsed — shipped v3.33.0
`.detail-grid{align-items:start}`. The forecast groups runs of item-free months with the same net
into one row. **Found on the way:** the Monthly expenses by account bars had never drawn — the
fill was an inline `<span>`, so its `width` did nothing. A whole-app scan for a %-width element
measuring 0 inside a non-zero parent found no other case.

## 63. `[x]` Smaller polish — shipped v3.33.0 / v3.34.1
Asset classes keep one colour across Allocation and Where your wealth sits. The property Log
button is a real button ("Log today's value"). More detail and Expand/Collapse all share a row on
each property card (v3.34.1). The empty-looking "N/A $0" budget group was left alone: it holds real
$0 rows (scenario housing lines not filled in).

## 64. `[x]` A "This tax year" card on the Dashboard — shipped v3.34.0
`lodgementStatus(today)` (`calc/taxyear.js`): Jul–Oct it is the year just ended (days to 31 Oct,
the worksheet's refund estimate, documents ticked, "Lodged" once every person is); otherwise this
year's running estimate. The tile opens the worksheet on that year.

## 65. `[x]` Projection milestones and a year-by-year table — shipped v3.34.0
`calc/milestones.js`: the first year each scenario reaches the next three round amounts above
today, when its loans are gone, and who overtakes whom. A CSV of every year with investments,
property equity and loans owed (points from `computeNetWorthSeries` now carry those parts).
**Found on the way:** the existing milestone table under the chart was never visible — the chart
redraws when its hidden page is first shown, and the redraw emptied the container the table had
been appended to. The chart has its own host now.

## 66. `[x]` Tax-time reminders — shipped v3.34.0
`taxCalendarReminders(today, opts)` (`lib/notifications.js`): super cap room per person in May and
June (over $1,000), "start the worksheet" in July until an income statement is entered, and the
31 October countdown (warn, then bad in the last week) until the year is marked lodged.

---

## Benchmarks (October 2026)

Asked for after PR #84: "what about adding benchmarks features?" — all four kinds offered were
wanted. They share one place, Dashboard → Benchmarks (`components/benchmarks.js`), each section an
HTML builder over a plain data object plus a gather function, registered in page order.

## 67. `[x]` How you compare — shipped v3.35.0
Super per person against the ATO median and average for their age band (30 June 2023, via ASFA's
October 2025 paper); combined super against the ASFA Retirement Standard lump sums at 67 (March
2026: comfortable $630k single / $730k couple, modest $110k / $120k); household net worth against
the ABS 2019-20 mean for the oldest person's band (still the latest — no wealth outputs from the
2023-24 survey); savings rate against the ABS household saving ratio (6.5%, June quarter 2026);
housing cost share against ABS Housing Occupancy and Costs 2019-20 (renters 19.9%, mortgage
15.5%). Tables in `constants.js` `BENCHMARKS`, each with source and period, printed under every
row. **Refresh yearly** — the ASFA balances paper and Retirement Standard, and the national
accounts saving ratio, all update; the ABS wealth table won't until a new survey.

## 68. `[x]` Your shares against the market — shipped v3.35.0
Lots and sales become dated cash flows (`calc/performance.js`). The same flows go into an
ASX-listed ETF (IOZ default; VAS, IVV, VGS, NDQ, VDHG or any ASX code) and compound at a fixed
rate (7% default); money-weighted returns (bisection XIRR) for all three. Index prices are per
date, typed or pasted: `IOZ@2024-03-01` / `IOZ@NOW` rows, with GOOGLEFINANCE formulas in both the
Shares price template and the tab's own copy button, routed by both paste boxes to
`state.benchmark.prices[symbol]`. Price only on both sides — distributions aren't logged.
Holdings without lots are listed as left out.

## 69. `[x]` Your own targets — shipped v3.36.0
`state.goals`, `calc/goals.js`: savings rate, emergency fund (months), super combined, net worth
(optionally by a date — on track when the active scenario's projection reaches it), and a monthly
cap per spending category paced through the month.

## 70. `[x]` Each property against its suburb — shipped v3.37.0
Growth a year since purchase (`cagr()`), gross yield and weekly rent against suburb medians typed
in with source and month, on `property.market`. Nothing fetched.

---

## Money tools (October 2026)

"Do all" of the six offered after PR #85.

## 71. `[x]` Distributions received, as cash flows — shipped v3.38.0
`asset.payouts[] = {date, cash, credit}` on each share holding. In a named tax year they replace
the per-unit estimate (a tax statement still wins); with no per-unit figure, the last twelve months
of payments are the rate (`payoutsBetween()`, `personDividends(person, win, {yearMode})`). The
Benchmarks tab adds a with-income return beside the price-only comparison.

## 72. `[x]` If you sold — shipped v3.39.0
`calc/sale.js` `saleScenario()`: sale price (or today's value grown at the Projections rate),
agent % and other costs, loans paid out at their scheduled balance, cost base less capital works
claimed to the sale, the discount over twelve months, and each owner's share taxed as the extra
tax and Medicare on today's taxable income in the sale year. Collapsed section on IP cards;
inputs on `property.saleWhatIf`.

## 73. `[x]` Load the real FY25/26 return — shipped v3.40.0
A tax year file (`kind: "wealth-planner-tax-year"`) merges one year — income statements,
interest, deductions, WFH hours, the rental schedule (matched by property name, ownership if
unset), fund statements and sales (matched by symbol and person; a sold-out holding is added) —
and can mark the year lodged. Worksheet → Import a year, or the main Import. `mergeTaxYearFile()`.
The household's own FY25/26 file was handed over, not committed. Because the repo is public, the
tests that rebuild that return now use placeholder names, employers and address (git history still
has the originals).

## 74. `[x]` Loan strategy, and paid-out loans that stop — shipped v3.41.0
`loanPaidOut()` / `loanBalance()`: past its Paid out on date a loan has no balance, interest or
repayments anywhere (equity, LVR, mortgage total, cash flow, projection from that year; a past
year's model interest apportioned to the date). `calc/loanstrategy.js` runs the loan month by
month for extra repayments, more offset, a rate change and a refinance break-even.

## 75. `[x]` Super top-up calculator — shipped v3.42.0
`calc/supertopup.js`: cap room (cap + carry-forward − SG − sacrifice), tax back at the marginal
rate and Medicare, 15% contributions tax and any Division 293, out-of-pocket and net gain. On each
tax card while there's room.

## 76. `[x]` Checks on every pull request
`.github/workflows/checks.yml`: `npm test`, and `scripts/smoke.mjs` — every page and subtab
headless at 390/1280, light and dark; fails on page/console errors, an empty page, sideways scroll,
NaN/undefined text, zero-width %-bars. Verified against a deliberately re-broken account bar.

## Tax page, people and linked data (October 2026)

"Do it all" after a review of how budget lines, income, transactions and the tax worksheet relate.
One PR for the set — they share the new Tax page and the links between them.

## 77. `[x]` Tax gets its own page — shipped v3.43.0
Income keeps the income rows; a Tax page has This year (the estimate, super, sacrifice, top-up),
Returns (the worksheet) and Documents (checklist, Import a year), at `/tax/<year|returns|documents>`.
Opens on Returns 1 July–31 October, This year otherwise (`defaultTaxSub()`). Phone: under More.
(The seasonal swap into the tab bar in place of Assets was taken back out in v3.54.2 — Assets is
opened far more often than Tax, even in lodgement season.)

## 78. `[x]` People, in one place — shipped v3.44.0
Accounts → People: name, date of birth (age), HELP, concessional cap, carry-forward, capital losses
b/f, WFH hours for four years, and where each person is used. `calc/people.js`
`renamePersonEverywhere()` now also moves holdings, every budget line's `deductiblePerson` and each
tax year's records and lodged snapshots. + Add person makes a Gross income row. The tax card keeps
only manual sacrifice and the top-up.

## 79. `[x]` A budget line can belong to a property — shipped v3.45.0
Claimed by lists investment properties (`item.claimProperty`). The line goes on that property's
rental schedule and comes off its tax result (split by ownership) but stays in the household
budget's cash flow, where it's paid from — not a personal deduction as well. `calc/claims.js`;
the property card lists what's claimed against it.

## 80. `[x]` Rental schedule line chosen, not guessed — shipped v3.45.0
`item.rentLine` on property costs (Return line) and property claims; `rentLineFor()` falls back to
the name guess. Property costs no longer offer the personal Tax deduction tick.

## 81. `[x]` Income received — shipped v3.46.0
`state.incomeLog` (`calc/received.js`), kept out of `state.transactions` so it can't count as
negative spending. Targets: take-home per person (against their net row), Net rows, rent (less the
computed agent fee), and holdings (written to `asset.payouts`). Income → Received shows actual vs
planned (irregular lines over the year). Logged from the panel, the Log income quick action, or a
bank import's money-in groups.

## 82. `[x]` The worksheet pre-filled from the plan — shipped v3.47.0
An income statement can name its Gross row; `expectedGrossForYear()` follows pay history, start/end
dates and super-included rows, and the worksheet says how far the statement is from it. Fill from
income rows. Deductions merge line by line (`yearDeductions()`): flagged lines listed with a tick
each, typed claims added; a year typed before this keeps "typed only" (`usesBudgetLines()`). The
mid-year withholding check was left out: without year-to-date payslip figures the refund line
already is that check.

## 83. `[x]` Private health premiums from the budget line — shipped v3.47.0
`state.tax.phiLineId`; `phiPremiumsAnnual()` grosses the line (what you pay, after the insurer's
rebate) back up at the claimed tier.

## 84. `[x]` Close the year — shipped v3.48.0
`calc/closeyear.js`. Tax → Returns, for a finished year: typed rental lines and logged budget lines
against the plan; ticked lines set the rows (old amount kept in history), missing rental lines get
a row, derived lines (interest, borrowing, depreciation, a computed fee) are shown only. Budget
actuals scaled to a year only for weekly/fortnightly/monthly lines. Property costs are closed through
the rental schedule, not as budget lines (`householdBudgetLines()`).

## 85. `[x]` Data health — shipped v3.48.0
`calc/health.js` `dataHealthChecks()` → Accounts → Checks, worst first, each with a way there; one
bell notification while anything needs fixing.

## Keeping itself up to date (October 2026)

"Do all of them" after PR #87. One PR: each builds on the Received/Checks/Close-the-year work.

## 86. `[x]` A monthly review — shipped v3.54.0
Dashboard → Review (`calc/monthreview.js`): money in (Log into that month), card statements closed
in the month against the typed statement total, Checks, and the month against the plan (reserve
lines kept out and reported separately). `state.monthReviews[ym]`; a bell notification days 1–10
until last month is marked reviewed.

## 87. `[x]` Bank import learns income — shipped v3.49.0
Rules carry `incomeTarget`; credits only take income rules, debits only spending rules
(`suggestFor(…, direction)`); a learned group shows "learned · money in".

## 88. `[x]` Projections from actuals — shipped v3.52.0
Plan / Actuals on Projections (`state.projection.source`). `calc/actuals.js`: the plan plus the
monthly differences measured on regular lines with evidence, each from its first logged month;
lumpy lines left out; three months of each needed. The FI date uses the same corrections.

## 89. `[x]` Before 30 June — shipped v3.51.0
Tax → This year (`calc/junemoves.js`): super room, losses against this year's gains (re-run with
the loss as a prior loss), prepaying deductible lines and investment-loan interest; real savings
before timing ones; open by itself in May–June.

## 90. `[x]` Mid-year withholding check — shipped v3.50.0
Payslip date, gross and withheld so far on each tax card (`tax.settings[p].ytd`,
`calc/withholding.js`): the rest of the year at the average rate so far, against the year's tax and
HELP.

## 91. `[x]` Interest rate changes on property loans — shipped v3.53.0
`loan.rateHistory` [{date, rate}] via Record change; `loanRateOn()`, `loanInterestForWindow()` (the
rental schedule's interest model runs across the rates that applied); history and the last change's
effect on the loan; one notification per change in the last 60 days.

## Professional structure (October 2026)

From a full assessment: the features work but each page grew its own controls and its own copy of
related data. "Let's do all of them" — one PR, a version per step.

## 92. `[x]` One period selector, in the header — shipped v3.55.0
Replaces six separate period controls (Preferences year basis, Transactions 1M–All, Shares range,
the Tax year dropdown, Received's fixed month, Review's month stepper). Every page reads it. Plus a
check for a debt that is a credit limit rather than an amount owed.
Shipped as: a year (and optional month) button beside the page title; `calc/ledger.js` owns the
selection (`selectedYearWindow`, `selectedMonth`, `periodAnchorDate`), and `householdYearWindow()`,
the month defaults, reserve windows, Received, Returns/Documents, the transaction list
(Month / Year / All) and the Review follow it. Session-only, so the app always opens on today. The
share-price and chart ranges stayed — they're zoom levels on a chart, not the period being reported.

## 93. `[x]` Accounts with balances — shipped v3.56.0
Each account has a type (everyday, savings, credit card, offset, loan) and a balance with history.
Cash assets, offsets and debts become account balances; an offset links to its loan.
Shipped as: `account.link` points at the record that already holds the money ("asset:<id>",
"debt:<id>", "offset:<loanId>", "loan:<loanId>") so net worth and the engine are untouched —
`calc/accounts.js` reads and writes through it, `components/accounts.js` groups the page (bank
accounts / cards / loans, plus "balances with no account yet"). A card's `limit` lives on the
account and is never counted. Migration (state.js `migrateAccounts`) maps "debit" → "everyday",
gives Cash assets and debts ids, and links by name once (`accountsLinked`).

## 94. `[x]` Navigation by job — shipped v3.57.0
Home, Cash flow, Accounts, Investments, Property, Tax, Plan, Reports, Settings.
Shipped as: page ids kept where a page carried on (dashboard = Home, expenses = Cash flow, assets =
Investments, properties = Property); Income moved into Cash flow as a subpage, Scenarios and
Projections into a new Plan page, People/Categories/Preferences/Checks into a new Settings page.
`nav.js` ALIASES send the old ids (and old URLs/remembered pages) to their new subpage, and
showPage's deferred apply drops a navigation superseded in the same tick. Phone bar: Home, Cash
flow, Accounts, Investments, More (Property, Tax, Plan, Settings). Reports lands with item 98.

## 95. `[x]` Home, and Review as a guided flow — shipped v3.58.0
Home: net worth, the period's money in and out, bills due, a to-do list. Review: one step at a
time with progress, plain questions, first-time explanation, the summary last.
Shipped as: `components/home.js` — four cards above the tabs (net worth with change and trend, the
selected month's money in / out / kept, bills in the next two weeks, a to-do list linking to where
each is done). The scenario comparison became the "Scenarios" tab. The Review is a five-step
stepper (money in, card statements, balances, checks, the month against the plan) with step dots
showing done / to do / nothing to do, Back / Next / Skip, and an explanation before the first one.


## 96. `[x]` Cash flow — shipped v3.59.0–v3.60.0
One budget (income and expenses), one transaction list (money in and out) with filters, transfers
between own accounts, splits, bulk edit, an import-rules editor, a bills calendar.
Shipped as: v3.59.0 — "Your month, planned" (income in, spending groups out, running total), the
Spending list joins state.transactions, state.incomeLog and the new state.transfers
(`calc/cashflowlist.js`; transfers are never spending) with direction/account/category/line/person/
search filters and In/Out/Net totals; splits are ordinary transactions sharing `splitGroup`;
Select → bulk re-link/re-account/delete. v3.60.0 — Settings → Import rules (`components/rules.js`:
edit, add, delete, test a description) and Cash flow → Bills (`calc/bills.js`: each regular line's
dates in the month from its last payment, paid/overdue, never-logged lines listed apart).


## 97. `[x]` Property as tabs; investments additions — shipped v3.61.0
A summary header and tabbed sections per property; portfolio performance, distribution history,
super contributions per year.
Shipped as: each property card keeps its summary tiles and gets tabs (Overview, Loans, Income &
costs, and for an IP Tax and Sale) — every panel rendered, switching toggles `hidden`. The Tax tab
leads with `propertyTaxResultBreakdown()` (the year's rental result line by line) and each owner's
share with its rough tax effect. `calc/investments.js`: portfolio performance (cost, value, gain,
distributions, realised, total return) and distributions by financial year on Investments → Shares;
concessional contributions against each person's cap for the period's year on Investments → Super.


## 98. `[x]` Reports — shipped v3.62.0
Monthly cash flow, category trends, net worth statement, property P&L, tax summary — following the
period selector, printable and exportable.
Shipped as: a Reports page (nav between Plan and Settings) — `calc/reports.js` builds five
same-shaped tables (monthly cash flow, spending by category × month, net worth statement that
reconciles to `totalNetWorthValue()`, property P&L per IP, tax summary per person) over the
header's period; `components/reports.js` renders them, prints through the shared #printRoot and
downloads CSV via `exportTableCsv`.


## 99. `[x]` Polish — shipped v3.63.0
One meaning per verb, one number format, empty states that say what's next, nav badges, backup
reminders and folder export, optional passcode.

---
Shipped as: "Log" kept for money (spend, money received); values and balances say "Record value",
"Update balance", "Record change". A Checks count on Settings (sidebar, More tab, More item).
Settings → Preferences → Keeping your data safe (`lib/safekeeping.js`): last backup and Back up
now, weekly automatic backups into a chosen folder (File System Access API, Chrome/Edge desktop;
the handle kept in IndexedDB), and an optional passcode lock (salted SHA-256 in localStorage, per
device, never in a backup — a lock screen, not encryption, and it says so). Migrations for items
92–98 run in `migrateState` with no action needed (account types and links, transfers,
lastFolderBackup).


## 100. `[x]` Bank import that understands accounts — shipped v3.64.0
The import picks which account the statement is for, recognises payments between the household's
own accounts as transfers (a card repayment, a top-up to savings) instead of spending, and can set
that account's balance from the statement's closing balance.
Shipped as: `bankImport.account` (guessed from the file name, else asked), `detectTransfer()` and
transfer rules (`transferAccount` + `transferDirection`) in calc/import-rules.js, transfers written
to `state.transfers` on import, `closingBalance()` from the parsed `balance` column (headerless files
too) set through `setAccountBalance` with undo restoring the previous balance.

## 101. `[x]` Savings goals tied to accounts — shipped v3.65.0
A goal (house deposit, emergency fund) follows real account balances, shows progress, what's needed
per month to hit its date and whether the month's surplus covers it.
Shipped as: `state.savingsGoals` (separate from the benchmark `state.goals`), `calc/savegoals.js`
(balance from linked accounts, needed per month, pace from balance history over ~6 months,
projected month, status), a Savings goals card on Accounts and a strip on Home. Account renames
update goal accounts.

## 102. `[x]` Recurring payments and subscriptions — shipped v3.66.0
From logged/imported spending: payments that repeat but have no budget line (offer to add one), and
lines whose real charge has risen (offer to update).
Shipped as: `calc/recurring.js` — `cadenceOf()` (median gap within 25% of weekly…yearly, 70% of
gaps agreeing), `unbudgetedRecurring()` (unlinked charges by merchant key, steady amounts, still
active) and `risingLines()` (last three charges' median >5% and $2 over the line). A "Recurring
payments" card on Cash flow → Budget with Add to budget (creates the line and links the charges) /
Update to $X, both undoable; "Not now" hides one for the session.

## 103. `[x]` Account and net worth history — shipped v3.67.0
A chart per account from its recorded balances; net worth over time from the snapshots; the net
worth report compares with a month and a year earlier.
Shipped as: an open account card draws its balance history (`accountChartPoints`); `calc/nwhistory.js`
`netWorthOn(date)` (same rules as the Investments chart, loans from their recorded balances where
present) feeds Today / A month ago / A year ago on the net worth statement, leaving a column's total
blank when something held today wasn't recorded yet. Home's net worth card links to the chart.

## 104. `[x]` Year-end pack — shipped v3.68.0
One place at 30 June: close the year, print the tax summary and property P&L together, and export
the year's transactions and the documents checklist for an accountant.
Shipped as: Reports → Year-end pack (`components/yearend.js`) for the period's financial year —
steps (year over, months reviewed, close the year, documents kept, returns lodged) each linking to
where it's done, and Print the pack (five statements, one per page), the year's transactions CSV
and the documents checklist CSV.

## 105. `[x]` One number format — shipped v3.69.0
Money looks the same everywhere: one font, whole dollars in summaries, cents only on individual
transactions and tax figures.
Shipped as: a `--font-num` token (Inter) replacing every IBM Plex Mono figure in the stylesheets and
inline styles (a paste-in textarea keeps it), tabular figures on body, and the Income and Budget
page totals moved to whole dollars. Rule recorded in base.css: whole dollars for totals and
summaries, cents for single items (a transaction, a budget line, a tax figure).

## 106. `[x]` Using it on two devices — shipped v3.71.0
Restore from the backup folder as well as write to it: open the newest backup there, with a warning
when this device's copy is newer, so a phone and a laptop stay in step without emailing files.
Shipped as: `state.savedAt`/`savedBy` stamped on every save (device id in localStorage); folder
backups named with time and device so two devices never overwrite each other; `newestFolderBackup()`
reads the folder (newest by savedAt) — on load it offers a newer copy from another device and holds
the automatic backup; "Open the newest from the folder" and "Open a backup file" (phones, via the
Files app); every restore says which copy changed last, and warns loudly before an older one
replaces a newer.

## 107. `[x]` Property beyond the numbers — shipped v3.72.0
Rent reviews and vacancy weeks (planned against actual), fixed-rate expiry dates with a "what if it
rolls to X%" view, and insurance/strata/rates renewal dates feeding the bills calendar.
Shipped as: `calc/propertylife.js` — `fixedRateView()` (balance at expiry, repayments at the rate
after or a what-if), `rentSummary()` (expected with vacancies vs logged rent), `recordRentReview()`.
Loans get Fixed until / Rate after; the Loans tab shows "When fixed rates end" with a what-if; the
Income & costs tab a Rent panel (next review, record a review, vacancies). Budget lines get a Due
day, so a renewal with a due month lands on the bills calendar before its first payment. Home
to-dos for a rent review within 30 days and a fixed rate ending within 90.

## 108. `[x]` Retirement plan — shipped v3.73.0
One Plan page joining financial independence, super against the cap, savings goals and
projections: when can we stop working, and what changes it, with a few sliders.
Shipped as: Plan → Retirement. `calc/retirement.js` puts levers (age, retirement spending, extra
saving, extra super after contributions tax) on calc/fire.js's bridge-then-4% simulation and works
out each lever's worth in years; `components/retirement.js` shows the earliest workable age, the
bridge and pot tests at the chosen age, "what changes it", and links to super cap room and goals.

## 109. `[x]` First-run setup
A guided setup for a new person: accounts, income, budget, first bank import.

Shipped as v3.74.0: a five-step sheet offered once to an empty app (and from Home's setup card as "Guided setup") — people and age, accounts with balances (through the accounts model, so cards owe), pay before tax, rent or loan plus common monthly costs, then Finish or Finish and import a statement. Nothing is written until Finish; closing it marks it skipped. `calc/firstrun.js` (`applyFirstRun`, `shouldOfferFirstRun`), `components/firstrun.js`.

## 110. `[x]` Check-up on real data
Go through a real backup page by page outside the repo; fix what's wrong in the app, hand data
fixes back as a file.

Done outside the repo against a real backup: every page and subtab at 390/1280px, no console errors, no NaN/undefined, no sideways scroll. One fix shipped as v3.74.1 — Plan → Retirement's check rows stack on a phone, since seven-figure amounts squeezed the label into a one-word column. The rest were data, not app, and went back to the owner directly.

## 111. `[x]` Share prices from a published Google Sheet, with backfill
Pasting prices is the only way they move, so a holding's history only grows when someone remembers.
Read the price sheet's published link on load instead (prices, USD → AUD, benchmarks), and give the
template a weekly-close block per holding so history before the first logged price is filled in.

Shipped as v3.75.0: Investments → Shares → Prices from Google Sheets. The template adds a weekly-close block per holding (from its first lot, or a chosen date); a sheet shared as "anyone with the link" (or a Publish-to-web CSV link) is read once a day on open. Backfill only fills weeks before a holding's first recorded price and never overwrites one. The service worker leaves Google Sheets requests alone so an offline copy can't be applied as today's prices. `calc/pricesheet.js`, `components/pricesheet.js`.

## 112. `[x]` Updates never mix old and new script files
A page can load new while one module is still an old cached copy (seen with the price template).

Shipped as v3.76.0: `npm run stamp` writes an import map into index.html (every module → `?v=<version>`) and versions the stylesheet imports; tests/stamp.test.js fails if a bump forgets it.

## 113. `[x]` Statement import flags what was logged by hand
Same amount within a few days on the same account, whatever the description.

Shipped as v3.77.0: any transaction with the same amount within 4 days (same account when both say) is a possible duplicate; the review lists what each matched.

## 114. `[x]` Card repayments as transfers
Payments to a card, on either statement, suggested as a transfer between the two accounts.

Shipped as v3.77.0: card payments recognised on both statements (the card's own "payment thank you", the bank's "… Cards" BPAY), payer from earlier transfers or the one card; BPAY/Pay Anyone receipts no longer collapse every bill into one merchant.

## 115. `[x]` Trips as date ranges
Spending inside a trip's dates files to the trip's line, on import and for what's already logged.

Shipped as v3.78.0: Cash flow → Spending → Trips. Import files trip-window spending to the trip's line (bills, home and property lines excepted; no rule learned); "Move N here" re-files what's logged.

## 116. `[x]` A property manager's statement in one step
Rent, fees, water and other costs from one statement entered together.

Shipped as v3.79.0: Property → Income & costs → Log a property manager statement. Writes rent received (net) and bills paid from rent, keeps the statement, sums the year; warns if that rent was already logged.

## 117. `[x]` Bonuses and tax refunds land in their month
A yearly bonus was folded into each person's monthly take-home, so pay looked short every month and
far over in the bonus month, and the forecast spread it evenly. Split each irregular gross row's
after-tax amount out of the monthly net; place it in its month; give refunds somewhere to be logged.

Shipped as v3.80.0: `personOneOffSplit()` (tax.js) — each irregular Gross row's after-tax amount is take-home with it less take-home without it; the parts sum to the year's take-home, so yearly figures don't move. A synthetic yearly row per bonus (`syntheticOneOffFor`), "oneoff:<rowId>" and "refund:<person>" received targets (the refund planned at last finished year's estimate), the forecast places bonuses in their month, the header's Monthly cash shows a normal month (average in its tooltip), and Income vs spending puts each bonus in its month.

## 118. `[x]` Month in detail
Pick any past month: money in against money out, set against your own usual month (the median of
the six before it), with what was different — categories that moved, one-off spends, new payees,
one-off income, trips, bills that didn't come — and the transactions behind each.

Shipped as v3.81.0: Reports → Month in detail (and every month in Monthly cash flow links to it). `calc/monthdetail.js`: baseline = median of up to 6 earlier months with at least 10 transactions; findings ranked by dollars; regular-bill lines are never news by themselves; the running month is compared with a usual month up to the same day. `components/monthdetail.js`.

## 119. `[x]` Did net worth add up?
Each month, what you kept (money in − out), plus value changes that aren't saving (investments,
super, property and other assets), less loan interest, against how much net worth actually moved;
the gap is what the logging or the balances don't explain.

Shipped as v3.82.0: `calc/nwcheck.js` — compared like for like (only records held at both month ends; anything first recorded mid-month is listed, not counted), interest from what was owed less the offset at the rate then, "adds up" within 5% of money in (at least $500), and the cash-side balances with no record within a week of either end listed. Month in detail gains "Did net worth add up?"; Reports gains Net worth check (12 months, each linking to its month).

## 120. `[x]` Bills calendar: bills, not spending; card bills on the card payment
The calendar treated every regular line as a bill, so a weekly groceries budget showed four times
a month. A line is a bill when its payments come about once a period; a spending budget is many
varying purchases — told apart from what's logged, with a per-line override. Bills charged to a
credit card are grouped under the card repayment, which is what actually leaves the bank.

Shipped as v3.83.0: `calc/bills.js` `inferredLineKind` (last 12 months of payments: ≥2.5 a period of varying size, or a spread ≥35% with >1.3 a period or an uneven rhythm, is spending; quarterly-and-longer lines need ≥2 a period) with `line.billKind` overriding; a bill's card is the account of its latest payment; `cardRepaymentDay` is the median day of the last six transfers to the card; `cycleFor`/`repaymentFor` from `statementStartDay`; `cardPaymentsForMonth` is the logged repayment or, until then, the closed cycle's charges. Cash flow → Bills: what leaves the accounts, card bills under the card, spending budgets as bars, and a per-line Auto/Bill/Spending select.

## 121. `[x]` Bills calendar: ended and stopped bills; what the card payment pays for
A line's end date was ignored, so a cancelled membership showed as overdue every week. A bill with
no payment for a while is asked about once instead. The card payment says what it covers.

Shipped as v3.84.0: `billsForMonth` skips lines ended before the month or not yet started, and drops dates outside `isActiveOn`; a line with no end date whose last payment is more than 2.5 periods + 7 days before today drops its later dates and is listed under "Stopped?" with "It ended then" (sets `endDate` to the last payment). `cardPaymentsForMonth` takes `kindOf` and splits the cycle's charges into bills, spending budgets and other.

## 122. `[x]` Loan purpose: claim only the deductible share
What a loan's money was used for decides whether its interest is deductible, not the property that secures it. Each loan records the share used to invest; Tax claims only that share of the interest, and a split drawn for your own home stops counting.

Shipped as v3.85.0: `loan.investPct` (blank = 100), `loanInvestShare`/`loanDeductibleInterestMonthly` in `calc/property.js`; the tax result, its breakdown, a past year's rental schedule (`taxyear.js`) and Before 30 June claim only that share; the cash result still pays all of it. Loan editor: "Used to invest %".

## 123. `[x]` Checks for missing deductions
Settings → Checks flags deductions the data says are being missed: a post-1987 build with no construction cost and no depreciation schedule, borrowing costs not entered, a split with no purpose.

Shipped as v3.86.0 in `calc/health.js`: `dep-missing:<property>` (no schedule rows, no construction cost, built after 15 Sep 1987 or date unknown), `loan-purpose:<property>:<loan>` (settled after the purchase, `investPct` unset), `loan-borrowing:<property>:<loan>` (info; loans from the purchase with no borrowing costs). All dismissable as usual.

## 124. `[x]` Update the plan from pay received
When the pay logged for a person has sat clearly above or below the plan for three months, offer to set the plan to what's actually arriving.

Shipped as v3.87.0: `calc/takehome.js` `takeHomeDrift` (the last three whole months all logged and all beyond max($150, 4%) the same way); `tax.settings[person].takeHomeAdjust` ($/mo) is added to the regular take-home row (engine recalc and `scenarioIncomeRows`), the tax figures untouched. Cash flow → Income shows the card with "Plan take-home at $X/mo", and "Use the tax estimate" to undo; Checks lists it.

## 125. `[x]` Can we buy?
For each Buy scenario: the deposit taken from the offsets, stamp duty (no first-home concessions once a property is owned), the investment-loan interest that rises when the offset empties, and the new monthly position.

Shipped as v3.88.0: `calc/canbuy.js` — cash drawn from Cash assets, then own-savings offsets (cheapest loan first), then an offset on a loan settled after the purchase ("borrowed money": its extra interest isn't deductible if spent on a home); tax back at each owner's marginal rate + Medicare on the deductible part; a normal month from `scenarioTotals().regularNetMonthly` against the first non-buying scenario; flags first home buyer ticked while owning. Plan → Scenarios → Can we buy?.

## 126. `[x]` Card payment reminder
A notification a few days before a card's repayment, with the amount from the closed statement cycle.

Shipped as v3.89.0: `lib/notifications.js` `cardPaymentReminders` — 0–5 days ahead (warn from a day out), and up to 7 days after with nothing logged; opens Cash flow → Bills.

## 127. `[x]` Rule suggestions for catch-all lines
Payees that repeat inside Misc-type lines are suggested as an import rule or their own line.

Shipped as v3.90.0: `calc/recurring.js` `catchAllSuggestions` — lines named misc/extras/other/sundry/general; payees of one kind grouped (alcohol, home & garden, household, pharmacy, kids & play); ≥3 purchases and ≥$100 in the last year. Cash flow → Budget → Recurring payments: "Make it a line" (or "Move to" an existing line of that name) moves the purchases and learns an import rule per payee; undoable.

## 128. `[x]` Broker trade import
A broker's trade history CSV (CommSec, Stake, or any file with date, code, buy/sell, units and price) into each holding's purchase lots and sales.

Shipped as v3.91.0: `calc/brokertrades.js` — `parseTrades` (CommSec Details "B 100 IVV @ 41.25" with brokerage from Debit/Credit; otherwise header-matched columns, a negative quantity reads as a sell), `planTrades` (per code: which holding — a choice when several share a symbol, or leave out; skips trades already there; says when the lots won't match the units held), `applyTrades` (buys → lots; sells → FIFO sales by date, units held untouched). Investments → Shares → Import trades from your broker; undoable.

v3.96.0: `lib/xlsx.js` reads an .xlsx (zip directory + DecompressionStream, every sheet) so Stake's Investment Activity reports import directly, several files at once; a GST column is added to brokerage; a sale already recorded whose parcels aren't tied to a lot uses up the lots the file brings (its recorded cost base stands) instead of being counted twice; avg cost follows the lots only when they cover every unit held.

## 129. `[x]` PDF statement import
Bank, card and property manager statements read from the PDF in the browser, into the same import flow as a CSV.

Shipped as v3.92.0: pdf.js vendored under `vendor/pdfjs/` (Apache-2.0, loaded only when a PDF is chosen); `lib/pdftext.js` rebuilds positioned lines; `calc/pdfstatement.js` `statementFromLines` (header columns matched by right edge; a transaction starts with a date in the date column and takes up to three lines below; yearless dates from a month heading or the statement's range, nearest the previous row; opening/closing/brought-forward lines skipped; a margin note glued to the date is split off) → `statementCsv` → the normal bank import. `agentStatementFromLines` fills Property → Log a property manager statement from the manager's PDF (Money In/Money Out columns; the form is filled, not logged). Checked outside the repo against real bank, card and property-manager statements: every running balance chains, and a card listing matched an earlier parse row for row.

## 130. `[x]` Share a statement to the app
Installed on a phone, the app is a share target: a statement shared from a banking app opens in the import screen.

Shipped as v3.93.0: `manifest.webmanifest` `share_target` (POST multipart, file field `statement`: CSV, PDF, text) → `sw.js` parks the file in the `wealth-planner-share` cache (kept across activations) and redirects to `./?shared=1` → `app.js` picks it up once into `importBankFile()` (the same path as choosing a file: PDF or CSV) on Cash flow → Spending. Supported where the platform has share targets for installed web apps (Android Chrome, ChromeOS); not iOS.

## 131. `[x]` Emergency fund
How much to keep aside for 3, 6 or 12 months without pay, sized on essentials only (Needs lines,
the home, what the investment property costs beyond its rent), against cash and offsets.

Shipped as v3.94.0: `calc/emergency.js` `emergencyFund` — Needs lines (scenario-resolved) + the active scenario's home lines not marked Wants + each IP's costs and repayments beyond its rent; a line counts at max(plan, the last 12 months' actual) once 6+ months are logged; available = Cash assets + offsets (shares left out); per person, what the others' take-home leaves to find if that one's pay stopped. `state.emergency.months` (3/6/12, default 6). Accounts → Emergency fund, with "Track it as a savings goal".

## 132. `[x]` What the app notices, and Ask Claude
The analysis an adviser would do, from the app's own data: rules that read purchases, loan structure, tax, super, spending and investments and say what they found with a dollar figure, on the page each belongs to and together on Home → Insights; plus an optional written review from Claude using the person's own API key, with the household anonymised and the text previewable before anything is sent.

Shipped as v3.98.0: `calc/advice.js` `adviceFor` — rules for a purchase that leaves little room (with pay as it lands and rates +2 points), borrowed money in a deposit, moving cash to a home loan's offset after buying, a PAYG withholding variation for the rental's loss, concessional super room, concentration in property, tiny holdings, the savings rate, Wants share of spending, the emergency fund and pay off the plan; each {area, kind, impactYearly, go}. `components/advice.js`: Home → Insights "What the app notices" and a strip on Scenarios, Budget, Income, Tax, Investments and Accounts. `calc/aisummary.js` builds the anonymised summary (people → Partner A/B, property, loans, scenarios and accounts → labels, holdings → tickers) and maps labels back for display; `components/askclaude.js` keeps the key in localStorage only (never in state or backups), previews the exact text, and calls the Messages API from the browser.

v3.99.0: Copy for any AI — `copyPrompt` puts the instructions, a standard answer layout (`REVIEW_FORMAT`: In short, Priorities, Buying, Tax and super, Debt and cash, Spending, Investments, Protection, Questions) and the anonymised summary in one paste for any assistant; the answer is pasted back, saved on the device and shown like a Claude review, labels mapped back to names. No key needed.

## 133. `[x]` Trim: padding in the plan, flexible lines, lean scenarios
Lines budgeted well above what's spent (they make every scenario look worse), the lines that could be paused or cut, and a scenario run lean to see what that does to a purchase.

Shipped as v3.100.0: `calc/trim.js` — `trimReport` (lines ≥$300/yr and 25% over their last-12-months actual once 6 months are logged; flexible lines — `line.flexible`, else irregular Wants; similar subscriptions by family), `setLeanLevel`/`leanLevel` (keep/half/pause per scenario through `scenarioOverrides`, the budget untouched), `leanEffect`. Cash flow → Budget → Trim; What the app notices gains plan-padding and buy-lean findings.

## 134. `[x]` Property manager accounts
Bills the agent pays out of the rent (water rates, repairs) were logged with no account, so nothing could tell them from a direct debit: the bills calendar listed them under "From your accounts" and could flag them overdue.

Shipped as v3.101.0: account type `agent` ("Property manager") linked `property:<id>`, no balance (`accountBalance` returns null,
`setAccountBalance` refuses). `logAgentStatement` tags statement bills with `agentAccountFor(st, propId)`; `fillAgentAccount`
backfills blank ones when the account is set up. `billsForMonth` marks a line whose latest payment is on an agent account
`agent` — its own calendar group, never overdue, out of `upcomingBills` and `directTotal`.

## Professional grade (late October 2026 assessment)

From [`ASSESSMENT-2026-10.md`](ASSESSMENT-2026-10.md) — every page driven at v3.101.0 and compared with
PocketSmith, Frollo, Sharesight, Monarch, ProjectionLab and Copilot. The calculations are ahead of all of
them on AU tax, super and property; what's behind is the first impression, how much has to be typed, one
thing living in several places, and reports. Phases are in order; items inside a phase can go in any order.
Nothing here may send data off the device — "type less" comes from deriving, estimating and importing, not
bank feeds.

### Phase A — first impression

## 135. `[x]` The headline follows the current situation
The header's Monthly cash (every page) is `scenarioTotals(state.activeScenario)` — whichever scenario is
*selected*, so picking a Buy scenario to look at it changes the household's headline to a what-if. Found on
a real backup where the selected scenario wasn't the current one. It is also a different figure from the
same scenario's card (a normal month vs averaged with bonuses) with nothing on screen saying so. Header,
Home and goal dates read the current-situation scenario; the selected one is labelled as a what-if
wherever it's shown; one definition of "monthly", the other in a tooltip.

Shipped as v3.102.0: `calc/engine.js` `currentScenario()` (the baseline, else the selected one). The header's
Monthly cash, Home's This month (planned) and bills, goal dates (Home, Accounts, Retirement) and the emergency
fund read it; `budgetLineItems(scenario)`/`loggableBudgetLineItems(scenario)` take one. The header tooltip names
the selected scenario and what it would leave when it isn't the current one, and is redrawn on selection.
Scenario cards and the Scenarios net-savings tile show a normal month (as the header does), the year carrying
bonuses ("incl. $X bonuses"); the tile says "(what-if)" when it isn't the current situation. Left as is on
purpose: the Budget page and Insights still follow the selected scenario and say so. **Still open:** tax
deductions read `budgetLineItems()` (the selected scenario's home lines) through `setDeductibleItemsProvider`,
so a deductible home line can differ by which scenario is selected.


## 136. `[x]` Trend lines that agree with their numbers
Home's net worth card says "+X since <date>" (today's live figure against the last log) beside a sparkline
of logged points only, which can fall — green text, red falling line. Value histories logged by hand a few
times (property, super) draw as steps and zoom in to the range, so one revaluation looks like a crash. Add
today's figure as the last point; draw sparse logs as marked points; zoom with a visible baseline.

Shipped as v3.103.0: `calc/history.js` `trendToToday(log, current, today, max)` — the last logs before today
plus today's figure; Home's net worth card draws that and prints the change from its first point, so the
text and the line always agree. `renderLineChart`: a stepped series of ≤24 points marks each reading
(`.series-pt`); the `baseline: "auto"` zoom spans at least 10% of the top value, centred on the data, so a
3% move uses about a fifth of the height instead of all of it; the legend toggle hides every element of a
series. Correction to the problem above: on re-check, the real backup's property chart showed a fall of more
than 10% across its readings — the chart was honest; the 10% floor matters for genuinely small moves.
Round axis ticks are still item 138.


## 137. `[x]` A full, fixed demo household
`loadSampleData()` is random (a property 60% of the time) and has no transactions, balances or money
received, so the demo shows `$0` almost everywhere and Reports are empty. Build one deterministic,
invented household: two people, a home loan and an investment property with a statement history, 18 months
of transactions and income received, account balances with history, holdings with lots, a closed tax year.
Every page and report should look in use. Test: every Reports table has a non-zero total on sample data.

Shipped as v3.104.0: `calc/demo.js` — `demoHousehold(today)` (a seeded generator; same household on every load,
dates counted back from today) and `demoReceipts(state, today, incomeTargets())` (pay, a September bonus and
rent received, run after recalc has made the take-home rows). Alex and Sam (Employer A/B), renting with two
Buy scenarios, 18 budget lines with invented merchants, eighteen months of spending, card repayments and
monthly savings transfers, five accounts linked to their balances, two ETFs in lots, two super funds, a car,
1 Example St (IO loan with offset, borrowing costs, quarterly revaluations) and a net worth log from the same
figures. Settings → Checks is all clear on it. The random generator and its pools (which used real employer
names) are gone from `app.js`. Not included: a lodged tax year — the FY return still shows as to do.


## 138. `[x]` Polish pass
Round axis ticks (`$3M`, not `$2,911,689`); one date format in the UI (no ISO dates); Checks' "Looks right"
button laid out beside its text; the net worth statement leaves a column's total blank when not every item
has a value then; no "N/A" budget group card; Theme and Export backup off the header into the ⋯ menu.
Measure with `getBoundingClientRect`, per the usual rule.

Shipped as v3.105.0: `lib/charts.js` `niceScale()` — gridlines on 1/2/2.5/5 × 10ⁿ steps, line and stacked charts.
`lib/format.js` `fmtDate()` ("26 Oct", the year when it isn't this one) on every date shown as text; checked by
scanning every page's rendered text for YYYY-MM-DD with the demo and with a real backup (outside the repo) —
none left (date inputs keep the browser's own format). Checks: both buttons in one `.hc-actions` cell (they
were two children of a three-column grid, so "Looks right" wrapped into the dot column); measured 84×40 beside
its partner at 1280px, below the text at 390px. Net worth statement: an earlier column's Total owned/owed is
blank when the snapshot is partial. Budget: the N/A group is labelled "Other" and $0 groups leave the bar's
legend. Export backup and Theme moved into the header's ⋯ menu.


## 139. `[x]` Less prose, clearer hierarchy
Page intros and card paragraphs behind ⓘ (item 59's pattern); each page gets a fixed layout — headline
figures, one main chart, one main list — with secondary panels collapsed or moved to detail pages (item
151). Empty states become one line and one button. A simple logo mark. Things you own read as a summary
first, with an Edit button — today a property's Overview is a wall of input fields.

Shipped as v3.106.0 (everything but the last sentence, which is now 139b): the 20 static page intros carry
`.help` (behind an ⓘ, or shown with Settings → Preferences → Explanations); Home's stays visible while the app
is empty, where it is the instruction. Seventeen card notes that explain how a figure is worked out rather than
state one also went behind the ⓘ. Measured on the demo at 390px, visible paragraph text across every page and
subtab: 16,948 → 10,226 characters (−40%); on an empty app 8,741 → 7,909. Empty cards: a "nothing yet"
paragraph carries `.section-empty` and `details.ledger:has(.section-empty)` hides the card, so an empty
Property page is one line and one button. Sidebar: the app icon's mark beside the name instead of a coloured W.

## 139b. `[x]` Things you own as a summary, with Edit
A property's Overview opens as a wall of input fields. Show the property as a read-only summary first (value,
purchase, loans, rent, costs, yield) with an Edit button that opens today's fields; same for a holding and an
account when item 151's detail pages land.

Shipped as v3.107.0 for properties: `propertySummaryHtml(p)` — value (and its last recorded change), bought,
land, loans (balance, rate, type, offset, repayments), rent and gross yield, costs, owners — on the Overview tab
with "Edit details"; the header shows the name and an Investment/Home pill. Both views are rendered and the
card's `is-editing` class picks one (`propertyEditing`, session-only), so nothing typed is lost; Done
re-renders so the summary shows the edit; a new property opens in editing. Holdings and accounts wait for
item 151's detail pages.


## 140. `[x]` Render edit forms on open
Collapsed rows stop pre-rendering their editor (936 controls on Cash flow with sample data; well over 1,500
with a real year of data). Build the form the first time a row opens.

Shipped as v3.108.0: `lib/ledger-table.js` `rowEditSlot(isOpen, editHtml)` puts a closed row's form in a
`<template class="m-row-edit-tpl">` (inert: not laid out, focusable or matched by querySelectorAll, gone with
the row); `materializeRowEdit(row)` unpacks it at the top of `openModernRow`. Used by the shared row shell
(budget lines, transactions) and the income, asset (three kinds) and loan rows. The string is still built —
the saving is DOM, not CPU. One caller patched closed rows' fields (`patchLinkedTransactionNames`); it now
reaches into the template. Form controls across every page: demo 1,859 → 616 (−67%); a real backup (outside
the repo) 3,524 → 970 (−72%). Driven: budget line, transaction, income, holding and loan rows open with every
field and close; "+ Add" opens the new row with focus in it.


## 141. `[x]` Long lists show the top, not everything
With a real year of data, Cash flow → Spending runs to several screen-heights on a desktop (Actual vs
planned and This year so far list every line), and Settings → Import rules is one unsearchable list
tens of thousands of pixels tall on a phone. Show the lines that matter (over, under, biggest) with
"Show all"; give rules search, sort by last used and paging.

Shipped as v3.109.0: `components/expenses.js` `capList(entries, n, showAll)` — over-plan first (most over
first), then by size; 8 shown, "Show all (N more)" / "Show fewer" (session-only `listsShowAll`), no button when
it would hide two or fewer. Applied to Actual vs. planned, its irregular/reserve list, This year so far and
Spending over time. Import rules: `rulesShown()` finds by words, line, category or account; sorts Most used /
Newest first / A–Z (rules don't record when they were last used — newest stands in); pages 25 at a time.
Measured on a real backup (outside the repo): Spending 6,724 → 5,112px at 1280 and 10,134 → 7,158px at 390;
Import rules 9,646 → 2,804px and 29,165 → 7,636px. The transaction list keeps its 25 most recent.

### Phase B — type less

## 142. `[x]` Balances from statements
An imported statement's closing balance sets the account's balance on that date; imported transactions
roll it forward until the next one. Manual "Update" stays for accounts with no statements.

Shipped as v3.112.0. The first half was already there: v3.64.0 sets an account's balance from a statement's
closing balance (`closingBalance`), and PDF statements carry their Balance column through `statementCsv`. New:
`calc/accounts.js` `rolledBalance(account, { today, accountOf })` — the last recorded balance plus what's been
logged against the account since (spending and refunds, money received, transfers in and out; a card or debt
owes, so spending adds and a repayment subtracts). Loans and property-manager accounts stay as recorded. The
Accounts page shows it ("18 Oct balance + 19 since"), prefills Update with it, works "available" on a card from
it, and `accountsOverview` totals use it. Net worth still reads the recorded balances — rolling those forward
changes a headline figure and is left for a decision. Checked on a real backup (outside the repo): a card with
19 purchases since its statement and an everyday account with 2 now show today's figure.


## 143. `[x]` Bills post themselves
A planned bill on its due date becomes a pending transaction; an import that matches it replaces it;
otherwise one tap (or "Confirm all") makes it real. "Catch up on 17 overdue" becomes "17 to confirm".
Pending rows count in forecasts, not in spending totals.

Shipped as v3.113.0, not as pending transactions: a pending row would have had to be kept out of every spending
total in the app, and the import already flags a hand-logged entry when a statement brings the same payment (item
113). Instead: `calc/bills.js` `billsToConfirm(items, transactions, today, { accounts, transfers })` — the bills
calendar's own unpaid occurrences from up to 62 days ago to today, paid from an account (a card's or the
manager's come with their statements), never before the line's first logged payment, once per missed month.
"Catch up on N overdue" (every line overdue against its frequency, groceries included, one card at a time with
an amount and date to type) became "N bills to confirm": one list, each ticked at its expected date and planned
amount, editable, Confirm all. On a real backup (outside the repo) and the demo nothing is outstanding, so the
button is hidden where it used to show a count. **Still open:** `lib/notifications.js` `reviewDueNotifications`
still groups "lines that need a fresh entry" on the old per-frequency test.


## 144. `[x]` Estimates between logs
Super = last balance + SG from pay + assumed return; property = last value indexed by growth (or the suburb
benchmark); vehicle = depreciation. Shown dated and tagged "estimated" until a real figure is logged. The
stale-assets banner only asks when an estimate is old *and* a real figure is due (a super statement period).

Shipped as v3.114.0: `calc/estimates.js` — `superEstimate` (last statement + employer super since, after the 15%
contributions tax, + growth at the projection's return), `propertyEstimate` (last recorded value grown at the
projection's rate, to the thousand), `dueAfterDays` (Super 190, Cash/Shares 35, Other 120 days; never for a
computed vehicle or shares priced from the sheet in the last week). `staleAssets` uses it, and the banner reads
"due a fresh value". Super rows show "≈ $X today, estimated from $Y on <date>" once a statement is a month old;
a property's summary adds the estimate once its value is 90+ days old. Net worth still uses recorded values
(same open decision as item 142). On a real backup (outside the repo) the banner, which had flagged a super fund
and a car, is gone.

## 145. `[x]` Share prices with no setup
A scheduled GitHub Action writes a daily price file for a fixed broad list (ASX 200, common ETFs, a short
US list) to the Pages site; the app reads it before falling back to the user's own Sheet. **Never a list
built from anyone's holdings** — the repo is public.

Shipped as v3.132.0 and v3.133.0. Once a day on open (`components/autoprices.js`, `calc/autoprices.js`, on by
default, each source can be turned off on Investments → Shares → Prices): ASX and US holdings from the app's own
`prices/latest.json` (weekly closes from `prices/weekly.json` fill in history before the first recorded value),
crypto from CoinGecko (only the coins' ids are sent; common tickers mapped, or the CoinGecko id as the symbol) and
USD → AUD from Frankfurter (ECB rates; only the pair is sent). The person's own Google Sheet, when set, is read
afterwards and wins; it's now "for anything the above doesn't cover". The file is written each weekday at 22:31 UTC
by `.github/workflows/prices.yml` running `scripts/prices/fetch.mjs` over `prices/universe.json` (315 ASX shares and
ETFs, 90 US): Stooq weekly CSV for US, Twelve Data weekly series for ASX (needs the `TWELVE_DATA_KEY` secret; free
plan, paced at 8 a minute), five years kept, a failed ticker keeping its last price for up to ten days. The push
checks ignore `prices/**`. Not verified against the live services from the build environment (they're unreachable
there); the parsers are tested on their documented formats and the whole run on mocked answers.


## 146. `[x]` A budget from history
After 3+ months imported, propose budget lines (amount, frequency, Needs/Wants, account) from what was
spent, using `calc/recurring.js`; accept all, or line by line.

## 147. `[x]` Common Australian merchants pre-categorised, and clean names
A built-in map of large public brands (supermarkets, fuel, telcos, utilities, insurers, transport) to
categories, applied before learnt rules, so a first import is mostly categorised. Lists show a cleaned
merchant name (store numbers, suburbs and card refs stripped, as `import-rules.js` already does for
matching) with the bank's text underneath — on real data about one transaction in seven still shows raw
bank text.

Shipped as v3.111.0: `calc/merchantbook.js` — `KNOWN_MERCHANTS` (about 120 large public brands → a default
category; short keys only where the merchant starts, longest key wins), `knownMerchant()`, `cleanMerchantName()`
(a known brand by its name; bank text — all capitals, a 4+ digit run or a `*` — cut to its merchant words in title
case; typed names untouched). `suggestFor` falls back to a known brand after rules and line names: your one line
in that category, else the category itself if you have it, else nothing; source "known", badge "known shop",
counted in coverage. Lists show the clean name (transactions, money in, the import review with the bank's text
underneath; the row's tooltip and its Description field keep the bank's text). Measured on a real backup (outside
the repo): a first import with no rules leaves 931 rows unsuggested instead of 1,355; of the 424 newly suggested,
364 match where they were actually filed (86%) — the rest are the household's own category choices (a "Home"
category for hardware and homewares). Bank-text names shown: 972 → 37. (The assessment's "one in seven" used a
narrower test for raw text.)


## 148. `[x]` Rules that generalise
On a real backup most learnt import rules had matched exactly once: a rule is learnt per exact
description, so each new store of the same chain teaches another. Match on the cleaned merchant key, offer
"all <merchant>" when a second variant appears, and merge duplicate rules.

Shipped as v3.110.0 in `calc/import-rules.js`. Measured on a real backup first (outside the repo): the store
number was never the problem — 85 of 109 keys were three words, the third usually the suburb, and payment
processors (Square, PayPal) put many shops under one key. So: processors join the dropped leaders
(`merchantKey`); `commonMerchant(a, b)` — shared leading words, never one common or short (<5) word;
`learnRule` merges the new rule into one filing to the same place under the same merchant;
`mergeSimilarRules(rules)` does the same for existing rules (Settings → Import rules → "Merge similar rules",
undoable). A merged rule is `starts: true` — it only claims a description whose merchant (or the description
itself) starts with it; without that, one rule that had shrunk to a common word misfiled 55 rows in replay.
Measured: merging the backup's rules 109 → 97, no past transaction changes line, 15 more filed by a rule.
Replaying the whole history from no rules: 412 asks vs 438 before, 975 filed right vs 959, but 66 filed wrong
vs 56 — fewer questions, slightly more to correct. Offering "all <merchant>" as a choice wasn't built: merging
happens only when both answers already agree.

Shipped as v3.115.0: `calc/budgetfromhistory.js` `proposeBudget(transactions, lines, today)` — spending of the
last 12 months on no live line, once 3 months are logged: subscription-steady payees (`cadenceOf`, within 5% or
$2 four times in five) get their own line at their usual amount and rhythm; everyday spending is grouped by
category (the known-merchant category from item 147, else the transaction's) into one monthly-average line per
category not already budgeted; an uncategorised merchant costing $300+ a year gets its own; the rest is summarised
as left out. `applyBudgetProposals` adds the lines and links their transactions (undoable). Budget tab → "Build
from what you've spent" (hidden when there's nothing to propose). Simulated on a real backup (outside the repo) as
a household with no budget: 35 lines (12 steady, 18 categories, 5 merchants) covering its actual spending, against
the 46 it built by hand; 3 small one-offs left out.


## 149. `[x]` Payslip import
A payslip PDF → gross, tax withheld, super, sacrifice and YTD, into income lines and the withholding check.

Shipped as v3.116.0: `calc/payslip.js` `parsePayslip(lines)` — each line matched by the label that comes first on
it (Gross, Tax/PAYG, Net, Super, Salary sacrifice); of its amounts the first is this pay and the last, when there
are two or more, year to date; period and pay dates read from the text after their own labels (several on one
line); anything not found stays null. `payFrequency` from the period's length. Tax → This year → each person's
"Refund or bill?" panel: Read a payslip (PDF, through the same `pdfLines` as statements) or paste its text; shows
what was read; "Use the year-to-date figures" fills the withholding check; when this pay differs from the plan's
salary row by more than 2%, "Set <row> to $X <frequency>" (undoable). Driven with an invented payslip pasted as
text. The PDF path is the statement import's, not separately exercised with a real payslip PDF.


## 150. `[x]` A transaction grid
Keyboard-first entry and multi-select editing in a table layout on wide screens; cards stay on phones.
First run offers "drop in three statements and a payslip" as the main path.

Shipped as v3.117.0: `components/cashflow.js` `txGridHtml` — Cash flow → Spending gets a List / Table switch
(remembered on the device; hidden at ≤720px, where the list is always used, re-rendered on crossing that width).
The table has every spending row's date, description, line, account and amount editable in place, with the same
`tx-*` classes and `data-tx-index` as the row form, so the existing handlers save them; money in and transfers sit
read-only beside them; Enter moves down a column; an entry row at the top adds a transaction on Enter (amount from
the line when only a line is picked) and returns focus to itself; select mode adds the checkbox column for the
existing bulk bar. First-run's last step leads with "Finish and import statements". Driven on the demo: an edit
saves, Enter moves down, a new row is added, the table fits, phone width falls back to the list.

### Phase C — one thing, one place

## 151. `[x]` A detail page for every thing
Account, holding, property, loan, budget line, merchant, person: one route each, with history chart,
transactions, related items and the edit form. Every list links to it; search lands on it.

Shipped as v3.128.0: a Details page (`components/detail.js`, route `/detail/<kind>/<id>`, in no menu) for an account,
a holding (any asset), a property, a loan, a debt, a budget line, a merchant and a person: what it is as a row of
figures, its value or balance history drawn (stepped, from what's been logged), and what's behind it — an account's
spending month by month, its transactions and transfers, and the record its balance comes from; a holding's returns,
purchase lots, distributions by year and sales; a property's yields, growth, loans and owners; a loan's interest by
year, deductible share and payoff; a budget line's plan against the last 12 months, month by month, with its
transactions; a merchant's spending, the categories and lines it's filed under; a person's tax, income, super and
property shares. Each links on to the others, and "Edit on …" goes to its edit form where it lives (page, subtab,
row scrolled to). Search lands on it for holdings, properties, loans, debts, accounts, budget lines and people (new
in search); accounts (a Details button), property cards and holding names link to it; a merchant in any detail
page's transactions links to the merchant. Every asset now has an id (migrated). Deep links work through the 404
redirect. Checked at 390 and 1280px on the demo and a real backup (outside the repo); a refund-heavy month no longer
draws a negative column. The edit forms themselves stay where they are rather than being duplicated here.


## 152. `[x]` Navigation by what you own
Accounts + Investments + Property become **Net worth** (one list grouped Cash · Investments · Super ·
Property · Debts, each to its detail page); debts in one place (cards, personal loans, property loans);
Scenarios only in Plan (Home links to it); a **Goals** tab in Plan for savings goals, emergency fund, FI and
Can we buy?; person tax settings move from Settings → People to Tax; Checks moves to Home's to-do and
Review. Old ids keep working through `nav.js` ALIASES.

Shipped as v3.129.0. **Net worth** replaces Accounts, Investments and Property in the menu: an overview
(`calc/networthlist.js`, `components/networth.js`) lists everything owned and owed in one place — Cash (offsets
included) · Investments · Super · Property · Other things · Debts (cards, personal loans and property loans
together) — with group totals, a bar of what makes up what you own, and every row opening its detail page; its total
is the header's net worth. One rail of tabs (Overview · Accounts · Investments · Property) sits on all four pages, and
the menu entry stays lit on each. On a phone the bar is Home · Cash flow · Net worth · Plan · More (Tax, Reports,
Settings). Home's first tab is Overview; the scenario cards moved to Plan → Scenarios, with a link from Home. Plan
gains **Goals**: the emergency fund and savings goals (from Accounts), Can we buy? — which had no place on the page
and so had never rendered — and where financial independence stands, linking to Retirement. People (the facts the
tax estimate runs on) moved from Settings to Tax → People; Checks moved to Home → Review, and its badge to Home.
Every old name still lands: `showAccountsSubpage("people"|"checks")`, `/settings/people`, `/settings/checks`. The
smoke check covers the new pages and tabs and every report. Checked at 390 and 1280px on the demo and a real backup
(outside the repo).

### Phase D — reports

## 153. `[x]` One report frame
Range (month, quarter, FY, calendar year, last 12 months, custom), compare to (previous period, same period
last year, budget), group by (category, group, merchant, account, person, property), a chart over every
table, and any figure clicks through to its transactions. Existing eight reports move onto it. Today a
report can only show the header's FY, so a household with over a year of data can't see its last 12 months
in one view.

Shipped as v3.118.0: `calc/reportframe.js` — `RANGES` (the header's year, last 12 months, calendar year, quarter,
month, custom dates), `COMPARES` (the period before, the same dates a year earlier, the budget), `GROUPS`
(category, Needs/Wants, budget line, merchant, account, person), `rangeWindow`, `compareWindow`, `monthsIn` (any
window, not only twelve months), `spendingByGroup`, `change`. `lib/reportcharts.js` `reportChartHtml` — inline SVG
"bars" (one per group, a tick for the comparison) and "columns" (in/out per month), so charts print. Reports gain a
frame bar (`components/reports.js` `reportFrame`, session-only): Monthly cash flow (range + compare row + columns
chart), Spending (range, compare incl. budget for category/needs-wants/line/account, group by, bars chart; a row
opens its transactions), Net worth statement (as at the window's end). Property P&L, Tax summary, Net worth check,
Month in detail and Year-end pack keep their own periods. Driven on a real backup (outside the repo): last 12 months
across two financial years, every grouping, budget and year-earlier comparisons, drill-down, no errors.


## 154. `[x]` Cash flow Sankey and household income statement
Gross pay → tax / super / take-home → Needs / Wants / saved / invested, for a month or a year; and the
year month by month with a budget column and savings rate.

Shipped as v3.119.0: two reports on the frame. Income statement (`incomeStatementReport`) — pay received, rent and
other money in (by the income log's target), spending by its line's Needs / Wants / other, total in and out, kept
and the savings rate, month by month with a Total and a Plan column (expected income + the budget for the same
months), in/out columns chart. Where the money goes (`moneyFlowReport`) — a Sankey (`lib/reportcharts.js`
`sankeyHtml`, inline SVG): pay with the employer's super into tax, super and take-home (tax and super from the plan,
scaled to the pay actually logged as received), then take-home, other money in and anything drawn from savings into
Needs, Wants, other spending and kept, each source shared across the uses in proportion. Checked on the demo and a
real backup (outside the repo) for the last 12 months: both draw, no NaN, no errors.


## 155. `[x]` Budget vs actual and spending trends
Lines × months variance heat map; 12/24-month trends with year-on-year per category and merchant.

Shipped as v3.120.0: two reports on the frame. Budget vs actual (`budgetActualReport`) — every budget line against
its plan month by month, each cell spent less planned and shaded red over / green under (heat −3..3, against the
larger of the monthly plan and $20); lines billed quarterly, half-yearly or yearly, or with no fixed timing, show what
was spent each month unshaded and are judged on their total; Spent, Planned and Over columns, biggest differences
first. Year on year (`trendsReport`) — the last 12 months against the 12 before by the frame's grouping (category,
merchant, account…), with a bars chart and the prior year's marks; the percentage is left out when fewer than 10 of
the earlier 12 months were logged, since it would mostly measure when logging began. Checked on the demo and a real
backup (outside the repo): both draw, no NaN, no sideways scroll, no errors.


## 156. `[x]` Investment performance, income and CGT
Per holding and total: capital gain, income, currency, annualised return, against a benchmark;
distributions and franking by FY; realised and unrealised CGT by parcel with the discount.

Shipped as v3.121.0: three reports from `calc/investreports.js`. Investment returns (`holdingReturns`) — per holding
and in total: cost still held (lots with brokerage), value, unrealised, income (distributions with franking),
realised, total return, a money-weighted yearly rate with cash income and a price-only one, beside the benchmark on
the same dollars and dates (the index from Investments → Performance when its prices are loaded, else the fixed
rate) and how far ahead; USD holdings shown as such and converted. Distributions (`distributionYears`) — cash and
franking credits by financial year, holding by holding, with a columns chart. Capital gains (`cgtParcels`) — every
parcel sold, by financial year, with the 12-month discount and the year's net capital gain (losses off undiscounted
gains first, then halved; any loss carried); every parcel still held with what it would make if sold today and the
date its discount starts. The demo's ETFs now pay distributions. Checked on the demo and a real backup (outside the
repo): all three draw, no NaN, no errors.


## 157. `[x]` Property, debt and super reports
Property: gross/net yield, after-tax cash flow, equity growth, total return per property per year. Debt:
balances, interest by year, deductible share, payoff dates. Super: contributions against caps by year,
carry-forward room, balance history.

Shipped as v3.122.0: three reports from `calc/assetreports.js`. Property returns (`propertyReturns`) — per property:
value, paid with costs, loans, equity with offsets, LVR; a year at today's rates (rent, expenses, gross and net
yield, cash after interest, after repayments, the tax effect at the owners' marginal rates, cash after repayments
and tax); the last 12 months' value and equity growth and total return (growth + cash after interest + tax); growth a
year since purchase; value at each 30 June from the logged history. Loans and debts (`debtSchedule`) — each loan and
debt: owed now and a year ago (logged balances), rate, repayment, interest this year so far and last year across the
recorded rate changes, the deductible share, and the month it's paid off at today's repayment and offset
(`loanPayoff`; "Interest only" or "Not at this rate" otherwise). Super — per person, concessional contributions
(employer, sacrifice and personal) against the cap, room left or over, balance at each 30 June; earlier years only
while the balance was tracked (before that the tax model would replay today's plan), and the unused room in the
years shown, blank once the balance passed $500,000. Checked on the demo and a real backup (outside the repo): all
three draw, no NaN, no errors.


## 158. `[x]` Lender pack and year in review
A printable one-page 12-month summary of income, spending, assets and liabilities for a refinance or
purchase; a narrative one-pager each 30 June.

Shipped as v3.123.0: two reports. Lender pack (`lenderPackReport`) — one page for a refinance or purchase: the last
12 whole months' income (salary before tax from the plan, and every kind of money received), living expenses split
into essentials and discretionary, loan repayments as commitments, then assets and liabilities today and the net
position (which matches the header's net worth); a year and a month column. Year in review (`yearInReviewReport`) —
the last finished financial year (or the header's year, once it's over) in sentences: net worth start to end, money
in, spent and the share kept, the three biggest categories and the biggest rise and fall on the year before (only
when that year was logged for 10+ months), distributions and franking, net capital gain, concessional super against
the cap, each property's revaluation and its loan's paydown; with the figures beside the year before. A report can
now lead with sentences (`rep.narrative`, `.rp-story`), on screen and printed. Checked on the demo and a real backup
(outside the repo): both draw, no NaN, no errors.


## 159. `[x]` Saved reports and a proper printout
Pin a report with its settings; print with a title block, household, period, page breaks and charts.

Shipped as v3.124.0: the picker of twenty reports is in three labelled groups (Money in and out / What you own and
owe / Tax and the year). Pin keeps the report on screen with its frame (period, custom dates, comparison, grouping)
as a chip above the picker, named for what it shows ("Spending · Last 12 months · by merchant"), stored in
`state.savedReports` (in backups; old saves migrate to an empty list); a pinned chip opens it with those settings, ×
unpins, pinning the same view twice says so. The printout opens with a title block — the household, the report, its
period, the date printed and the app version — repeats the table header on every page, keeps charts and sentences
whole, prints the heat map's shading, and shrinks wide month-by-month tables to fit. Checked by pinning, reloading,
opening, unpinning and printing to PDF in a headless browser.

### Phase E — planning depth

## 160. `[x]` A range of outcomes
Historical-sequence (or Monte Carlo) runs: a 10th–90th band on the projection and a probability on the FI
and retirement answers.

Shipped as v3.125.0: Monte Carlo runs (`calc/outcomes.js`), from a fixed seed so the result doesn't shift on every
redraw. Returns are lognormal around the rates on Plan → Projections with a spread set beside them ("Investment ups
and downs", default 12%; "Property ups and downs", default 6% — `state.projection.investVolatility` /
`propertyVolatility`, migrated in). Projections: 300 runs of the scenario being looked at
(`computeNetWorthSeries` now takes a per-year `investReturns` / `propertyReturns` path and a `cache` of the per-year
income and costs, so a run costs little), the 10th–90th percentile shaded behind the lines (`renderLineChart`
`opts.band`), and a sentence under the headline: 8 in 10 runs end between $X and $Y, half above $Z. Retirement:
`simulateRetirementAt` takes a real-return path and an age to spend down to; 1,000 runs give the share in which
stopping at the chosen age bridges to preservation and lasts to 95, where the worst tenth runs out, and the age for 9
in 10 (`retirementOdds`, `ageForOdds`). On the demo, the steady plan says 50 works; the runs give it about even odds
and put 9 in 10 at 56. Checked on the demo and a real backup (outside the repo): band drawn, odds shown, no errors.


## 161. `[x]` Life events on a timeline
Children, career breaks, a sale, a downsizer contribution — dated events that change income, spending or
assets, shown on the projection; an age axis instead of "Yr 7".

Shipped as v3.126.0: `state.lifeEvents` (`calc/lifeevents.js`) — a child (a yearly cost for some years), a career
break (income down by a yearly amount), a cost for some years (or, negative, a saving), and a one-off amount in or out
(a sale's proceeds, an inheritance, a downsizer, a big purchase), each dated by calendar year, in today's dollars, for
every scenario. `computeNetWorthSeries` takes them off (or adds them to) each year's savings inflated to that year,
and adds a one-off at the start of its year; the range of outcomes carries them too. Plan → Projections gets a Life
events card (add by kind, edit what / from / for years / amount, remove; the age each starts at once your age is
known); the chart marks each with a dashed line and its name, and its axis reads "Age 45" instead of "Yr 7" when the
Retirement page has your age. Checked in a headless browser at 390 and 1280px: events change the headline, markers
and ages draw, saved, removable, no errors.


## 162. `[x]` Retirement drawdown and the Age Pension
Account-based pension drawdown with minimum rates and tax, and the Age Pension under the assets and income
tests, in Plan → Retirement.

Shipped as v3.127.0: Plan → Retirement gains "After you stop" (`calc/agepension.js`), year by year in today's dollars
from the chosen age to 95: money outside super is spent first while super is locked; from preservation age super is
an account-based pension paying at least its minimum by age (4% under 65, 5%, 6%, 7%, 9%, 11%, 14% from 95), tax-free,
with anything not needed saved again outside super; from 67 the Age Pension pays first, for a couple or a single
person, homeowner or not, under the assets test ($3 a fortnight per $1,000 over the free area, the home excluded) and
the income test (financial assets deemed at 0.75% / 2.75%, 50c per dollar over the free area), whichever pays less —
rates from 20 September 2025, thresholds from 1 July 2025, held flat in today's dollars. A table at the ages that
matter (stopping, preservation, 67, then every five years) shows the pot, the super minimum, the Age Pension and the
income; a sentence says whether spending lasts to 95, when the pension starts and what share of spending it carries;
super above the $2m transfer balance cap is flagged. Checked on the demo and a real backup (outside the repo).

### Phase F — platform

## 163. `[x]` Optional encrypted sync to your own drive
Client-side-encrypted state to the user's own cloud drive, building on item 106's folder backups, so a
cleared browser is no longer data loss. Off by default; nothing readable leaves the device.

First way shipped as v3.134.0 — sync through a synced folder (`calc/syncfile.js`, `lib/foldersync.js`, Settings →
Preferences → Keep your computers in sync): one `wealth-planner-sync.json` in the backup folder, always AES-GCM
encrypted with a key from the passphrase (PBKDF2, the file's own salt, so the same passphrase opens it on every
computer; the key is kept per device in IndexedDB as a non-extractable CryptoKey, the passphrase nowhere). Only the
revision, time and device are readable. Rewritten 8 seconds after a change and when the tab is hidden; read on
opening, before the day's price check. One copy is the truth: same revision and no change here → nothing; a newer
file and no change here → loaded; a change here → written as the next revision; both changed (or a computer that has
never synced meeting a file) → the person chooses which to keep. "Changed" is the content, not every save (a hash
leaving out save stamps and price-check bookkeeping), so opening the app doesn't count. With sync on, the
unencrypted weekly folder backup stops. Checked by two headless browsers passing the file between them: encrypted
at rest, loaded on the other, a change there carried back, a wrong passphrase refused. Computers only (Chrome, Edge).
Second way shipped as v3.136.0 — through Dropbox (`lib/dropbox.js`), for phones as well as computers: sign-in
with OAuth PKCE (no secret, no server), access to the app's own folder only, the same encrypted file (the sync core
in `lib/foldersync.js` now writes through a "transport": the folder or Dropbox). Writes use Dropbox's own revision,
so a write that lost a race to another device fails and the round reads again. Tokens are per device in
localStorage and revoked on Turn off. The app key isn't secret: `DROPBOX_APP_KEY` in `lib/dropbox.js` is the one to
set once the site is registered; until then Settings takes a key pasted per device. (Set in v3.136.1: the site's registered key is built in, so devices just Connect.) Checked against a mocked Dropbox
with two browsers (one at phone width): connect, passphrase, encrypted upload, loaded on the other, a change carried
back, and a lost race retried.

## 164. `[x]` Screenshot comparison in CI
`scripts/smoke.mjs` saves each page and subtab; a PR shows what changed visually.

Shipped as v3.130.0: `scripts/smoke.mjs` takes `SHOTS_DIR` (save a full-page screenshot of every view, light, at
390 and 1280px, with the clock fixed so the same code takes the same pictures — two runs of this branch compared
98 views and found 0 changed) and `SMOKE_ROOT` (serve another checkout); in that mode a view the checkout lacks is
skipped and failures are noted rather than fatal. `scripts/shotdiff.mjs` compares two folders of screenshots pixel by
pixel in headless Chromium (no image library), and writes a `summary.md` (views changed, by share of pixels, new and
gone) and an `index.html` with base, PR and the difference marked in red side by side. The Checks workflow gains a
`screens` job on pull requests: base and head photographed with the PR's script, compared, the summary added to the
job summary and the pictures uploaded as the "screens" artifact. Informational — it never fails the check.


## 165. `[x]` CLAUDE.md and PROJECT_KNOWLEDGE.md brought up to date
`app.js` is 5,801 lines, not ~3,400; the page list and IA change with item 152.

Done alongside v3.131.0 (docs only, no version of its own): CLAUDE.md's page map is the one after item 152 (Net
worth over four pages, Plan → Goals, Tax → People, Checks in Home → Review, the Details page and the moved-settings
redirects), app.js is ~5,800 lines, the new calc modules are listed, and the screenshot job is described along with
"a new view goes in the smoke script's VIEWS". PROJECT_KNOWLEDGE.md gains a section on what items 135–165 leave for
the next person: the report frame contract, projection paths and life events, detail pages and `goToPlace()`, the
Net worth group, the Can we buy? container that never existed, the Age Pension rates' date, and the local-only tags.

## 166. `[x]` Net worth on what's been logged since
The headline net worth reads each account's balance rolled forward by the transactions logged since it
was recorded (item 142's `rolledBalance`), and shows "about $X including estimates" (item 144's super and
property estimates) as a second line rather than folding guesses into the headline.

Shipped as v3.135.0. `loggedSinceRecorded()` (calc/accounts.js) is, for every account, what's been logged
against it since its balance was recorded — spending, money received, transfers, with a line's default account
counting (the app registers `transactionAccount`) — signed as it moves net worth, by the record it belongs to.
`totalNetWorthValue()` adds it, so the header, Home and the Net worth overview (whose rows carry it too) all read
the rolled-forward figure, and the projection starts from it. Nothing is written back: the records keep the recorded
balance. `estimatesUplift()` (calc/estimates.js) gives super a month or more past its figure and a property 90 days
or more past its value; the Net worth overview shows "about $X with estimates for …" under the headline, never in
it. On the demo the headline moved by a couple of dollars (its balances are recorded today); on a real backup
(outside the repo) the header, the Home tile and the overview agree, the groups add up to it, and the estimates
line appears.


## 167. `[x]` Price history thinned as it ages
A holding's history gains a point every day the prices update. Nothing needs that detail for long: the charts'
1D and 1W read recent days, everything else reads weeks or months. Automatic price points (those that carry a
`price`) are kept daily for 90 days, then the last of each week to two years, then the last of each month; values
someone logged by hand are never touched.

Shipped as v3.137.0. `thinPriceHistory(history, today)` (calc/pricesheet.js) runs inside `applyPrices` for every holding
it prices and after `applyBackfill` (which now takes `today`), so the daily update, a paste, a Google Sheet and the
weekly backfill all leave a thinned history, and a save made before this is thinned on its first price update. It keeps
the last point of each week or month, so a value read on a week-end or month-end date is unchanged. On the demo, a
holding seeded with 1,246 daily points came out with 201 and its typed value intact; on a real backup (outside the
repo) history is already mostly weekly, so few points went, with no week-end value or chart range start changed.


## 168. `[x]` A polish pass
What made the app look less finished than it is, from a look at every page at 390 and 1280px:
- **Words that are no longer true:** the sidebar's "nothing is sent anywhere" (sync and prices now do, by choice),
  and text still naming pages by their old names (Dashboard for Home, …).
- **Layout:** a lone ⓘ on its own row at the top of most pages; Home showing net worth three times and its cards
  again under Overview; the floating buttons covering content on a phone; names cut short with room to spare;
  the net worth bar with no labels.
- **Spending:** three rows of toggles and five dropdowns before the first transaction; no day headers; a delete
  cross on some rows and not others.
- **Feel:** undo for deletes, empty pages that say what to do, a first-load splash, an accessibility pass and
  keyboard shortcuts.
- **Under the hood:** a lighter first load without a build step, and a warning before the browser's storage fills.

Shipped as v3.138.0, in one PR with the Income "Show as" switch the user asked for along the way. Words: the sidebar's
privacy note and page names in text. Layout: each page's ⓘ and ⋯ beside its title (lib/help.js moves them there),
empty intro rows folded away, Home's net worth once, the net worth bar's legend. Spending: one toolbar with a Filters
button, chips, rows by day, a bin for money-in and transfers. Undo in place of confirm() for scenario, trip, statement,
share-sale and bulk deletes (`withUndo` snapshots the state). Empty Investments says where to start. Accessibility:
standards mode (a doctype and lang — every view compared, tables a couple of pixels taller a row), a main landmark,
heading order, `--good-ink`/`--bad-ink`/`--warn-ink` for coloured text (axe-core's contrast failures 194 → the
white labels on coloured chart bars). Keyboard: / n g+letter ?. The saved chip is a dot from 881 to 1360px so the
header keeps one row. modulepreload for every module (2.0s → 1.3s first load at 200ms latency over HTTP/2). A storage
gauge and notification (lib/storageuse.js). Income: Show as year/month/fortnight/week/day/hour, per hour by each
person's hours a week (Tax → People, 38 until set; calc/showas.js). Not done: the ⓘ buttons inside <summary> are
still interactive-inside-interactive (axe "nested-interactive"); moving them out of the summary is its own change.


## 169. `[x]` Loose ends from the polish pass
- The ten ASX tickers Yahoo no longer knows (taken over, merged or renamed) out of the price list, renamed ones
  under their new codes.
- The ⓘ in a section's header out of its `<summary>` — a button inside the header's own toggle is one control
  inside another, which screen readers announce as one.
- The percentage labels inside coloured chart bars readable on every colour.

Shipped as v3.138.1. The ten ASX tickers: five gone (BKW, now in SOL, IFL, ITW, JLG, NSR), three renamed (IPL → DNL,
SLR → VAU, SQ2 → XYZ); QUB and SVW stay — the next run says whether that was a bad day or something more. The
section ⓘ lives after the <summary> (lib/help.js) and is drawn beside the title with CSS anchor positioning; it
shows while the section is open. The scenario cards' dot and the home blocks' caret became the real controls,
and the in-bar percentages sit on a chip. axe-core over 16 views, light and dark: no violations left.


### Phase G — from a review against a real household (October 2026)

Found by running the app on a real backup (outside the repo). One PR for all nine.

## 170. `[x]` A card paid by direct debit
A card whose repayments are never logged as transfers shows its payment overdue every month. A card can say it is
paid in full by direct debit from an account; the reminder then knows it's paid, and a bank statement's repayment
line can be recognised as that transfer.

Shipped as v3.139.0. A card carries `autoPayFrom` (Accounts → the card → Paid in full by direct debit from) and `payDay`; `cardPaymentsForMonth` takes a direct-debit card as paid once its day has come (`assumed`) until the real repayment is logged, so it is never overdue for want of logging. Renaming the paying account renames it here too. On the real backup the repayments were in fact being logged — October's simply hadn't been yet — so the review's first reading of this was wrong; the setting is for a card nobody logs.

## 171. `[x]` Net worth history that keeps itself
The net worth trend rested on a handful of points recorded by hand. Record net worth by itself (once a day at
most, when it changed), fill earlier weeks from what each record already knows, and say what moved it.

Shipped as v3.139.0. `calc/nwauto.js`: the day's net worth recorded after each save (`auto`), the weeks before rebuilt once on open from `netWorthOn` (`derived`) back to the first week some record has no value, thinned like price history but never a point recorded by hand. Home's net worth card says the biggest change since its line began. On the real backup: five weeks rebuilt, rebuilt and live net worth within 0.2% of each other today.

## 172. `[x]` One surplus, explained
"Left over each month" on the Budget tab spreads the year's bonuses over twelve months; the header and Home show a
normal month. Show both, labelled.

Shipped as v3.139.0. Your month, planned: regular income and spending to "Left over in a normal month" (the header's and Home's figure), then the bonuses "once a year, averaged over twelve months" to "Left over a month across the year".

## 173. `[x]` Retirement leads with the age that holds up
The headline age assumed steady returns; the page's own odds said later. Lead with the age that works in 9 runs
in 10, the steady-returns age beside it.

Shipped as v3.139.0. The headline is the age that lasts in 9 runs of 10, with the steady-returns age beside it; if 9 in 10 isn't reached by 75 the steady age is shown as that, on a neutral background.

## 174. `[x]` Sold holdings out of the way
A holding sold to nothing stays in Net worth and Investments at $0. Sold-out holdings move to a Sold list that
keeps their history for capital gains.

Shipped as v3.139.0. `isSoldOut` (calc/networthlist.js): no units and sales recorded. Out of Net worth and Shares' list and glance; under Shares → Sold, folded.

## 175. `[x]` Names that tell things apart
Two offsets on one property had the same name. Name an offset by its loan, and Checks flags two things sharing a name.

Shipped as v3.139.0. An offset is named by the account linked to it, else its loan. Checks: account names used twice (warn — they're how transactions find an account) and names shared by holdings, properties, loans or debts (info).

## 176. `[x]` LVR with the offset
The property card's LVR badge counts the full loan while its equity counts the offset. Show both.

Shipped as v3.139.0. `propertyNetLVR`: each loan less its offset, never below nothing. The badge reads "X% LVR · Y% net of offset" when they differ.

## 177. `[x]` Holdings first on Shares
The Prices panel opened above the holdings. Once automatic prices work it folds to one status line.

Shipped as v3.139.0. The Prices panel counts as settled when the automatic read worked and a Google Sheet that read fine covers the rest; its summary carries one status line.

## 178. `[x]` The last lone ⓘ
A card's own ⓘ (Insights → What the app notices) sat on a row of its own; it moves beside the card's heading.

Shipped as v3.139.0. lib/help.js: a help paragraph right under a heading gets its ⓘ in the heading. The inline ⓘs left are footnotes under a card's figures, not lone rows at the top.

## 179. `[x]` A phone header like an app's, and an avatar menu
On a phone the app spent about a quarter of the screen before any content: a "Wealth Planner" bar with its
icons, then the title, period and net worth pill. The page title becomes the header (large, shrinking to a slim
bar on scroll) with search, notifications and an avatar; the avatar's menu holds Settings, backup & sync,
import/export, theme, updates, Reports and the version — on desktop too, in place of the ⋯. The bottom bar is
Home · Cash flow · Net worth · Tax · Plan; More goes. The saved chip becomes a dot on the avatar when something
needs attention.

Shipped as v3.140.0 (with v3.139.2's field styling, in the same PR). The phone's sidebar bar and the More tab are
gone: the page header carries search, notifications and the avatar, and shrinks once the page scrolls (`is-compact`);
the period chip sits under the title and the net worth pill and saved chip stay off a phone. The avatar menu keeps
the old buttons' ids (exportBtn, importBtn, shareBtn, themeToggleBtn, mockDataBtn, resetBtn), so their wiring is
unchanged; `data-avatar-go` opens Reports, Settings, Settings → Preferences (backup & sync, with its on/off) and
Check for updates. Its initial is the first person's; its dot replaces the saved chip on a phone. The smoke script's
navigation step taps the Tax and Net worth tabs and avatar → Reports.


### Phase H — less to do by hand (October 2026)

## 180. `[x]` Pay a card from the + button
A card repayment is a transfer, but the quick-add menu had no way in: it was Spending → + Transfer, with both
accounts to pick. "Pay a card" opens the transfer form with the card (or the only card) as To, and From as the card's
direct-debit account or the everyday account.

Shipped as v3.141.0. Quick actions → Pay a card opens Cash flow → Spending with the transfer form filled in: To the first
credit card, From its direct-debit account (item 170) or the first everyday account, the amount the bills calendar
expects (the soonest unpaid repayment from last month on) and a note. `transferForm.preset` carries it for one render.


## 181. `[x]` Statements from the Dropbox folder
Drop a bank, card or property-manager statement (CSV or PDF) into the app's Dropbox folder, from any device; the
app picks it up on open, runs it through the importer and its rules, and asks only about rows it can't place.

Shipped as v3.142.0. A `Statements` folder — in the app's Dropbox folder (made the first time it's listed) and inside
the backup folder when the browser still has permission for it — is listed once the app has opened and synced
(`lib/inbox.js`, rules in `calc/inbox.js`). Anything waiting gets a toast and a note in Spending → Import from your
bank; each file, oldest first, goes through the same `importBankFile` as a chosen one (rules, transfers, duplicate
check), and moves to `Statements/Imported` once confirmed. Cancelling leaves it for next time. With nothing waiting,
the card says where to drop one.


## 182. `[x]` Merge, not choose, when two devices both changed
When two devices both edited since they last synced, the app made you keep one copy. Combine what doesn't
overlap — rows added, removed or changed on one side only — and ask only about a row changed on both.

Shipped as v3.143.0. Each write or load of the sync file keeps that copy in IndexedDB as the one both sides agreed on;
on a conflict, `lib/foldersync.js` hands back the file's copy and that one, and `calc/syncmerge.js` merges three ways:
rows by `id` (by `date` for the net worth log, by content for the few with neither), settings field by field. A change on
one side only is taken; the same thing changed both ways goes into one dialog, a choice each, this device's ticked. View
settings stay per device, the app's own bookkeeping (prices, automatic net worth points, computed rows) never asks,
and "last done" dates take the later one. A device whose last sync was before this version has no agreed copy yet, so
its first conflict is still the old choice. Checked on a real backup (outside the repo): nothing to ask when nothing
changed, separate edits combined, about 0.1s.


## 183. `[x]` A review on the new layout
The phone header, avatar menu and bottom bar, against a real household (outside the repo), at phone and desktop width.

Done as v3.144.1, on a real household's backup outside the repo, at 390 and 1280px: twelve views, the scrolled header
and the avatar menu, with sideways scroll, controls past the edge, small tap targets, clipped labels and NaN text
measured rather than eyeballed. No sideways scroll, no console errors; the avatar menu fits; the header goes slim once
scrolled. Fixed: on a phone the header's ⓘ, ⋯, period, bell and avatar were 28–34px targets — each now catches a tap
6px further out (an invisible `::after`), looking the same; and a rail of tabs with more past the edge (Investments,
Property) fades there, by scroll position (`lib/scroll-shadow.js` now watches `.subnav` too), since a tab ending right at
the edge looked like the end of the list. The same review found a card repayment logged from a loan — v3.144.0's
grouped account list, warning and Check.


## 184. `[x]` A simpler read, page by page
A default-state review of every page at phone width found the same things more than once: settled notices
("on track") as loud as the ones to act on, a panel shown on two pages, explanations printed in full, settings
above the figures they set, and headers squeezed onto three lines. Each fix keeps the feature; it moves or folds it.

Shipped as v3.154.0. Insights: what's on track folds into one "N things holding up" line under what to act on, and a
page's own strip leaves it out (on Budget it was half the strip); the Upcoming bills panel is gone — Home → Overview
heads with the same list and Bills has the month; Saved vs grown says how to read it in one line, the reasoning behind
its ⓘ. Tax → This year: the people come first and Household settings (super guarantee, hospital cover, rebate tier,
the rental's result) fold below them, open across re-renders; on each person the notes come before the top-up and
the payslip check, so a surcharge note no longer sits under the payslip fold. On a phone a section's title keeps its
line and the figure beside it moves under it ("Your month, planned" was three lines). This year so far drops its
stacked category bar — Actual vs. planned above draws the same one. Home dates from another year carry the year
("since 30 Nov 2025").


### Phase H — against the apps people compare it with (October 2026)

Compared with what people use instead: Monarch Money, Copilot Money, YNAB, PocketSmith, Frollo and WeMoney (AU),
Sharesight (AU shares) and ProjectionLab (planning). On depth this app is already ahead of all of them for an
Australian household: tax and super worked out per person, property with loans and the rental's schedule,
scenarios, a return worksheet, Age Pension. Where it falls behind is how it *feels*. Those apps look like one
product, explain themselves in a few words, and put the next thing to do first.

The default view of eleven pages, measured at 390px with the demo household at v3.154.0:

| | This app | What the others do |
|---|---|---|
| Text styles (size and weight) | **57**, from 9.5px up | about 8, nothing under 12px |
| Different-looking buttons | **32** | 4–5 (primary, secondary, ghost, link, danger) |
| Spending, default view | 7.5 screens, 724 words | one list, its filters and a chart |
| Tax → This year | 3.4 screens, 437 words | — (none of them go this deep) |
| Category colour or icon on a row | none | every row (Copilot, Monarch, PocketSmith) |
| New transactions to review | the import screen only | a standing review queue: swipe to approve (YNAB, Copilot) |
| Bank feeds | CSV / PDF import, Statements folder | open banking (all but YNAB in AU) |

The order is deliberate. Looking professional (185–190) is cheap and touches every page, so it comes first, and
it makes every later item look finished on arrival. Ease of use (191–198) is next. New capability (199–206) comes
last. Items are written so that one item is one PR. **Non-goals**, said once so nobody re-proposes them: credit
scores, bill negotiation, ads, and anything that sends the household's data to a server by default.

## 185. `[x]` One type scale
57 size and weight combinations are why pages look assembled rather than designed. Text as small as 9.5px fails
on a phone.

Do: about eight text styles as tokens in `base.css`: page title, section title, card figure, body, body strong,
label, caption and number. 12px is the smallest. Every `font-size` in `src/styles/` goes through a token, and so
do inline `style="font-size…"` in the components. Uppercase micro-labels (`11px/650`) become the one label style.

Done when: the audit script (scratchpad pattern: count computed size/weight pairs on each page's visible text)
finds ≤ 10 combinations across all pages and nothing under 12px; a test fails on a raw `font-size:` px value
outside `base.css`.

Shipped as v3.155.0. Seven sizes as tokens in `base.css` — 12 · 13 · 14 · 17 · 20 · 26 · 32px (`--fs-xs` … `--fs-3xl`) —
and two weights, 400 and 600; every `font-size` in the stylesheets, components and `index.html` goes through a token,
print sizes in pt aside. `b`, `strong`, `th` and headings are 600, so bold inside a semibold label no longer goes to 900.
Measured over eleven pages at 390px: 57 size/weight combinations before, 11 after (two of those are the ⋯ and + glyphs),
nothing under 12px. What the larger small text needed: chart date labels spaced by their own width (two "May 2025"s
had printed on top of each other), the Show-as switch's options sharing the track, a share row's trend line giving up
width below 420px and stepping aside below 380px so units · price keeps its digits, and the year's category names and
the take-home legend allowed a second line. Text clipped by an ellipsis, measured on every page at 360/390/1280px:
10 / 7 / 4 before, 11 / 9 / 4 after (one account name at 360px; the rest were already clipped). `tests/typescale.test.js`
fails on a raw px size or another weight.


## 186. `[x]` One button system
32 different-looking buttons: outlined, ghost, link-styled, pill, uppercase `<summary>`s acting as buttons, and
primary buttons in four sizes.

Do: `btn` (secondary), `btn-primary`, `btn-ghost`, `link-btn` and `btn-danger`, each in two sizes. One primary per
card at most. The `calc-hint-link`, `review-cta` and other one-offs map onto these. Folded sections inside a card
(`tax-advanced`, `ps-manual`) get one disclosure style: sentence case with a chevron, not uppercase text.

Done when: ≤ 6 computed button looks across the smoke views; screens diff reviewed page by page.

Shipped as v3.156.0. Five kinds of button, two sizes, one 8px radius: `.btn` (secondary), `.btn-primary`, `.btn-ghost`
(turns ink on hover, no longer red), `.btn-danger` (all 27 deletes, which had been ghosts that happened to hover red)
and `.link-btn` — which had no style at all, so "See the figures →", "Paste an answer back →", "1 more →" and
"Tax → People" were the browser's grey box; it's now the accent colour, underlined on hover and always inside a
sentence. The one-offs follow: Catch up is primary, Breakdown and Set active are small secondary buttons rather than
pills, "Max out cap", "Edit rent/home loan…" and Home's card links are links. Fold-outs inside a card
(`.tax-advanced`, `.row-more-options`) are sentence case in the body's colour, not uppercase grey. Measured over
18 views at 390px: the action buttons and fold-outs come in 8 looks (the five, the fold-out, a card-footer link and
an in-sentence link), and nothing shows the browser's default button. `tests/buttons.test.js` fails on a delete that
isn't `.btn-danger`.


## 187. `[x]` Colour and an icon for each category
Every competitor makes a list readable at a glance with a category colour and icon on each row. Here, a
transaction row, a budget line and a chart segment for the same category share nothing.

Do: each category gets a colour (from a fixed, contrast-checked palette) and an icon (a small hand-drawn SVG
set, no emoji, no icon font from a CDN). Settings → Categories picks them, with sensible defaults by name
(groceries, fuel, insurance…). They show on transaction rows, budget lines, Spending's charts and the Sankey.
A merchant shows as a round avatar: its initials on the category's colour.

Done when: the same category looks the same on Budget, Spending, Reports and Home; axe passes on every colour in
light and dark.

Shipped as v3.157.0. `calc/categorylook.js` gives each category a colour (twelve, `--cat` via `.cat-c-0`…`11`, light and
dark) and an icon (24 hand-drawn SVGs in `lib/caticons.js`, no font, no CDN), worked out from its name — groceries a
cart, fuel a pump, the investment property a building — unless the household picked its own: Settings → Categories,
tap a category's badge for twelve colours and 24 icons, "Back to the default" to undo. Picks live in
`state.categoryLooks` by name; a rename carries them, a delete drops them (and undo puts them back). Shown on every
transaction row, the Budget tab's cards when grouped by category, Actual vs. planned's lines and both category charts,
whose slices and swatches are now the category's colour rather than the next colour in the series. Merchant initials
avatars were left for later: the category badge already marks each row. Found on the way, not fixed here:
transactions that carry their own category (from a bank import) aren't reached by a category rename.


## 188. `[x]` Half the words on screen
Explanations were moved behind ⓘ once (v3.33.0), but the visible text kept growing: notes under figures, sentences
in summary lines, paragraphs in notices. The others say one short line and link to more.

Do: a copy pass, page by page. A visible note is one sentence. Anything longer goes behind the section's ⓘ or into
the item's detail page. Summaries say a figure, not a sentence. Start with Spending (724 words), Tax → This year
(437) and Plan → Projections (327).

Done when: the visible words on those three pages are down by at least 40%, and no visible paragraph runs over 30
words. Nothing explained before is unexplained after (each moved sentence is listed in the PR).

Shipped as v3.158.0. Visible words on the default view at 390px: Spending 718 → 428 (−40%), Tax → This year 437 → 258
(−41%), Projections 327 → 193 (−41%); the longest visible paragraph on them is now 28 words. What moved where:
Spending shows its 10 latest transactions before "Show all" (was 25) and six small trend charts (was eight), with one month
axis on the first; Actual vs. planned lines read "$1,095 of $1,200" (the left/over is the figure beside it; the full
sentence is the tooltip); the two headlines and the card-statement and "tap a line" notes are shorter. Tax: the super
top-up is one line of figures, how it works behind the section's ⓘ; the cap line, the surcharge note and the gross /
taxable line are shorter; "Check a payslip" replaces "Refund or bill? Check against your latest payslip"; each person's
details link is one line; and the Tax notices strip leaves out the super-room notices the cards' Top up boxes already
show. Projections: the assumptions and life events fold under one line that states them ("20 years · 7% return · …"),
so the chart comes first; the headline, the range line, the Actuals note (its line counts moved to the button's
tooltip) and the life-events notes are shorter, the life-events footnote behind the ⓘ.


## 189. `[x]` One card, one chart style
Cards differ in header layout (title left, figure right, or figure under), padding and how actions are placed.
Charts differ in axes, gridlines, legends and whether they have tooltips.

Do: one card anatomy: title, optional figure, optional ⋯ menu, body, footer actions. One chart style in
`lib/charts.js`: the same axis font, light gridlines, a legend under the chart, and a tap or hover tooltip on every
point. Loading shows a skeleton in the card's shape, not a blank.

Done when: every Home, Insights, Investments and Plan card uses the shared card markup (render-smoke asserts it);
every chart has a tooltip.

Shipped as v3.159.0. Cards: one set of tokens — `--card-radius` 14px, `--card-py`/`--card-px` 18/20px (16/16 under 700px),
`--inner-radius` 10px for a card inside a card — used by every top-level card (`.panel`, `details.ledger`, `.stat-tile`,
`.home-card`, `.home-goals`, the scenario `.card`, `.nw-group`) and the inner ones (`.m-card`, `.sgl`, `.cb-card`,
`.calc-panel`, `.home-block`). Measured before: six paddings (10–18px) and three radii on top-level cards. A card's title
(`.panel h3`) is now the section title's 17px, not 14; stat cards keep their small uppercase label over a figure — the
two kinds of card, each always the same. Charts: `wireChartTooltip` is the one crosshair-and-tooltip, used by the line
chart and now the stacked-area chart (each band's value at the nearest date and the total), on pointer events so a tap
works on a phone (it stays until a tap elsewhere; one page-wide listener, not one per redraw). Both charts already
shared the 12px axis labels and the recessive gridlines. Not done: the line chart's legend stays above it (it's the
series toggles), and there is no skeleton state — nothing on these pages loads late enough to need one.


## 190. `[x]` Figures that read at a glance
Long figures crowd small cards on a phone ("$4,499,450", "$1,889,000").

Do: compact figures in cards and charts ($4.5M, $1.89M, $673.8k), with the exact one in the tooltip and on the
detail page. Ledgers and tax keep whole dollars. Up and down always as arrow plus colour, never colour alone.

Done when: no card figure wraps or truncates at 360px (measured); a test pins the compact formatter.

Shipped as v3.160.0. `fmtCompact` (lib/format.js): whole dollars under $10,000, then $45.2k, $673.8k, $1.89M, $12.5M —
trailing zeros dropped, a minus sign, rolling over at the edges ($999,960 is $1M, not $1000k). It replaces four compact
formatters that each rounded differently (Benchmarks, Home's FI tile, Projections' milestones, report charts). Every chart
axis in dollars uses it ($2M, $575k — the gutter that held "$8,000,000" gives the plot the room back); tooltips keep the
exact figure. Home's Projected net worth tile reads $4.5M with the exact figure as its tooltip. Measured at 360 and
320px with the demo household: no card figure wraps or is cut off (it was already true at the default size; the card
figures that had room kept whole dollars). Up and down: the one figure shown in colour alone — a category over plan in
This year so far — now carries ▲ (and "Over plan" for a screen reader). `tests/compact.test.js` pins the rule.


## 191. `[x]` Only the parts you use
A renter with no shares still sees Property, Investments, Tax → Returns and a dozen cards about them. Monarch and
Copilot simply don't show what you don't have.

Do: Settings → Preferences → "What this household has": property, shares, super, a business, a partner. The
answers are worked out from the data by default and can be changed. Navigation, Home cards, notices and Checks
leave out what's off. Nothing is deleted, and turning a part on brings it back as it was.

Done when: the first-run answers set it; with property off, no page, card, notice or check mentions one (driven
in the browser); the smoke script runs both all-on and a minimal household.

Shipped as v3.161.0. Two parts, `calc/parts.js`: a property and shares (super is in every Australian household's
picture, a partner is a second person with nothing to hide, and there's nothing for a business yet). A part is on when
the household has one — a property, a holding filed under Shares — or as answered: Settings → Preferences → What this
household has (From my data / Yes / No, saying what "from my data" comes to now), and two ticks in the first-run setup's
home step (ticked turns it on; unticked leaves it to the data, so adding one later shows it). Off hides — the Property
tab on all four Net worth rails and Investments' Shares tab (`data-part`, `body.no-part-*`), the property and share
reports, the two Benchmarks sections, and the notices and Checks about them (`partAllows`, by id) — and deletes nothing;
anything there still counts in net worth. While a part is hidden, Net worth says "Own a property or shares too? Add a
property · Add shares", which turns it on and opens it. Driven with an empty household, the first-run tick, the Settings
switch and the demo household (everything on); the smoke script now runs an empty household too.


## 192. `[x]` A first ten minutes that ends somewhere
The first-run setup asks good questions, then leaves you on a full Home. Monarch and Copilot finish setup with
your own numbers on screen and one next step.

Do: setup ends on a "Your first month" Home. It shows the take-home it worked out, the budget it proposed (from
`budgetfromhistory.js` if a statement was imported), and one next step at a time: import a statement, check the
budget, add an account. The setup checklist becomes that one step, not a list. The demo household is offered
first, as a way to look around.

Done when: a new device can get from opening the app to a budget from a real statement in under ten steps,
counted in a driven run.

Shipped as v3.162.0. Home's "Set up your plan" checklist (five steps, the rest listed) is now "Your first month": the
month as set up so far — comes in, planned out, left a month — and one next step with one button that goes straight to
the place (the tab, and the card on it opened). Four steps, in the order a new household does them (`lib/setup.js`):
add your pay; import a bank statement; check the budget the spending suggests (`proposeBudget` — "import 2 more months"
until there are three, then "N lines suggested", done when none are left); add what you own. Housing left the list (the
first-run setup asks it) and so did a second scenario (planning, not setting up). The setup sheet's first step offers
"Start with a statement instead", and a first statement with three months in it and nothing budgeted goes straight on
to the budget it suggests. Counted in a driven run with an invented four-month CSV, from a new device opening the app:
Start from scratch → Start with a statement instead → choose the file → Import → Add the suggested lines — five steps
to six budget lines from 57 transactions; Home then shows step 3 of 4, Add your pay. The demo household was already the
intro page's first offer; the panel's own offer now reads "Look around with sample data".


## 193. `[x]` A review queue for new transactions
Imported rows are reviewed once, on the import screen, and anything waved through is never looked at again. YNAB
(Card Mode, 2026) and Copilot keep a standing "to review" queue.

Do: every imported or Statements-folder row lands as `reviewed: false`. Home and Spending show "N to review". The
queue is one row at a time: swipe right to keep, left to change the category, with the budget line it counts
against shown. Correcting a category offers "Always do this for Fern Café?", which writes an import rule.
Desktop gets the same with keyboard keys.

Done when: a statement import shows its rows in the queue; a correction made there creates a rule that the next
import applies; the swipe is driven on a phone width.

Shipped as v3.163.0. Every imported row (a statement chosen by hand, a PDF, or one from the Statements folder) lands
with `reviewed: false`; rows saved before this count as reviewed. Home's To do says "N new transactions to review" first,
and Spending's list has a banner with a Review button. The queue (`calc/reviewqueue.js`, `components/reviewqueue.js`)
goes one row at a time, oldest first: the shop, the bank's words, the amount, the date and account, and what it counts
against (its budget line, or its category, or "Not filed yet"). Keep — the button, → or K, or a swipe right — or Change
— ←, C, or a swipe left — to a budget line or a category; a change then asks "Always file <shop> under <that>?": Always
learns the import rule the way a confirmed import does (`learnRule`) and files every other row from that shop still
waiting; Just this once files this one. "Keep all N" clears what's left as filed; Esc closes. Driven at 390px with an
invented four-month statement and touch swipes: right kept (57 → 56 to go), left opened Change, Eating out + Always saved
a "fern cafe" rule and filed the other waiting Fern Cafe rows, and the next statement's Fern Cafe row arrived filed under
Eating out (and waiting in the queue). Driven at 1280px with the keys, from Home's To do.


## 194. `[~]` A flexible budget as well as a detailed one
Thirty budget lines is a lot to keep. Monarch's flex budgeting works with three numbers: fixed bills, one
flexible amount, and non-monthly costs set aside.

Do: Budget can be shown as Fixed / Flexible / Non-monthly, built from the same lines (a line's frequency and the
needs/wants type decide where it goes; you can override per line). Flexible shows one amount left for the month.
Each category can roll an unspent balance into next month. Nothing about the detailed lines changes.

Done when: both views total the same; rollover carries over the period picker's months; tests over `calc/`.

## 195. `[ ]` A Home you arrange
Home's cards come in a fixed order. Monarch lets you choose what's on the dashboard.

Do: Home → Overview gets "Edit" to reorder and hide its cards (net worth, this month, bills, goals, runway, FI, tax
return, scenarios) and to add any Insights panel. The arrangement is per device, like the theme.

Done when: the order survives a reload; a hidden card's notice still reaches the bell.

## 196. `[ ]` Your week, in one card
The app only speaks when opened. Copilot and Monarch send a weekly recap.

Do: once a week (the first open from Monday), a "Your week" card: spent against your usual week, the biggest
three, bills next week, rows to review, and one notice. It goes out as a local notification if notifications are
on. It can be dismissed and is kept for four weeks.

Done when: the figures match Spending for the same dates; it doesn't appear twice in a week across two devices
(synced dismissal).

## 197. `[ ]` Feels like an app on a phone
Editing a row opens a centred modal, and lists have no swipe actions. Totals scroll away.

Do: on a phone, row editors and pickers open as bottom sheets (drag to close). Rows get swipe actions (edit,
split, delete with undo). A list's total sticks under the header. Pull to refresh runs prices and sync. Tap
targets are at least 44px.

Done when: measured tap targets ≥ 44px on the smoke views at 390px; bottom sheets driven open and closed; no
change on desktop.

## 198. `[ ]` Saved views of your transactions
Search and filters exist but are lost when you leave. Monarch saves filtered views.

Do: a filter set on Spending (account, category, person, trip, amount, text, dates) can be saved and named, and
appears as a chip above the list. The views travel in the backup and sync. "Show me in Spending" from a report,
notice or budget line opens a filtered list.

Done when: a saved view's total equals the same filter set by hand; it survives a reload and a sync.

## 199. `[ ]` OFX, QFX and QIF, and how to get them
PocketSmith takes OFX, QFX, QIF and CSV. Here it's CSV or PDF, and finding a bank's export button is left to you.

Do: parse OFX/QFX (SGML and XML) and QIF in `calc/bank-import.js`, so they go through the same review, rules and
duplicate check. The import screen gets short "Where's the export?" steps for the major Australian banks and card
issuers, written generically (no account details), and says which formats each offers.

Done when: invented fixtures in each format import the same rows as the matching CSV; render-smoke covers the help.

## 200. `[ ]` Decide: bank feeds or not
Bank feeds are why people pick Frollo, WeMoney, PocketSmith or Monarch. Under Australia's Consumer Data Right they
come through an accredited aggregator, which needs a server, an agreement and the household's data passing
through someone else's hands. That runs against this app's first promise.

Do: write up the options and choose one: (a) stay import-only and make it as easy as possible (199, and 181's Statements
folder fed from a phone's share sheet); (b) let a household bring its own aggregator key and run a tiny proxy it controls; (c) an
optional hosted feed with plain consent screens. Each option says its cost, risk and what changes on the privacy
page. This item is the decision, not the build.

Done when: the decision is recorded here with its reasons, and the privacy copy is checked against it.

## 201. `[ ]` Receipts on a transaction
Monarch and Copilot attach a photo or PDF to a transaction. For an Australian return, a deduction needs its
receipt.

Do: attach images or PDFs to any transaction, budget line or tax-year document, stored in IndexedDB (not
localStorage) and included, encrypted, in the backup and sync file. Tax → Documents lists every deduction with or
without its receipt. A size cap per file, with images shrunk on the device.

Done when: a receipt survives backup → restore and a sync to a second browser; storage use counts it.

## 202. `[ ]` Who changed what
YNAB's "Who moved the money" (2026) shows each change with the person who made it. Two people syncing here can't
see what the other did.

Do: each device names its person (once, in Settings). Edits are written to a short activity log: what changed,
from what, by whom, when. Kept for 90 days and synced. Each entry can be undone where an undo exists. The sync
merge (182) names the other person in its question.

Done when: an edit on device A shows on device B with A's name after a sync; the log stays under a size cap.

## 203. `[ ]` Investments against a benchmark, and a target mix
Sharesight compares a portfolio with an index and gives a money-weighted return; Empower and Copilot show
allocation against a target and what to buy to rebalance.

Do: return per holding and overall, money-weighted (IRR over buys, sells and distributions), beside the simple
gain. "Against the ASX 200 / S&P 500" from the daily price file's index series. A target mix (by asset class,
optional) with the gap in dollars and "next $X goes to…". A distributions calendar for the year ahead from past
dates.

Done when: IRR matches a hand-worked invented portfolio to the cent in tests; the benchmark line is driven on
Investments.

## 204. `[ ]` What-ifs you can drag
ProjectionLab's plans move as you drag a slider. Here a what-if means editing a scenario's fields and switching
tabs.

Do: Plan → Projections gets a what-if strip: retire age, return, inflation, extra saved a month, a rate rise. Each
is a slider redrawing the chart live against the saved plan (dashed). "Keep this" writes it into a new scenario.

Done when: dragging redraws within a frame on a mid-range phone (measured); "Keep this" makes a scenario equal to
the preview.

## 205. `[ ]` Every subscription in one list
Rocket Money and Monarch list every subscription with what it costs a year. `recurring.js` already finds repeating
payees and rising charges, but only on Budget, mixed in with bills.

Do: Cash flow → Bills gets a Subscriptions view: each repeating charge with its yearly cost, last price rise,
next charge and a "cancel by" reminder you set. A charge that stops shows as stopped, not overdue.

Done when: the list agrees with `recurring.js` on an invented statement; a reminder reaches notifications.

## 206. `[ ]` Balance forecast by the day
PocketSmith's headline is an account's balance projected day by day, with each bill and pay landing on its date.
The 12-month forecast here is monthly and household-wide.

Do: for each everyday account, a 90-day balance line from today's balance, pay days and bills on their dates, and
the usual spending spread across the days. It warns when the lowest point falls below a buffer you set. It shows
on the account's detail page and as a Home card when a warning is due.

Done when: tests over an invented month land each bill and pay on its day; the warning shows in a driven run.


## Conventions for whoever picks this up

Read `CLAUDE.md` and `.claude/PROJECT_KNOWLEDGE.md` first — in particular the version-and-tag rule
and the one-PR-per-coherent-piece rule, both of which apply to every item here.

- **One item, one PR.** Sub-items (2a/2b/2c) may share a PR where they interact; say so in the body.
- **Verify by driving the app**, not by reasoning about the code. This project has no test framework
  for UI; `npm test` covers `calc/` only. Several findings in the audit were only visible because
  the app was run against realistic data.
- **Anything that changes a headline figure** gets the before-and-after in the PR body. These items
  move numbers the user has already read and formed expectations about.
