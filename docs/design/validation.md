# Reading a field before it's saved (#263)

**Status: every family is done** — the budget and income row editors, goals, debts, category names, Investments,
Property, Tax and people, the calculators, Plan, Cash flow and the rest (below). What's left is the open questions at
the end. Part of #253; builds on the shared field from #254 ([fields.md](fields.md)).

## The contract

A number field is saved only when it **reads** as a value its rule allows. Until then:

- the field keeps what was typed (the draft);
- it's marked `aria-invalid="true"` with a message beside it in `.field-error`, tied by `aria-describedby`;
- the saved figure, and everything drawn from it (the row's headline, totals, projections), doesn't move;
- **closing the editor cancels the draft**: the field shows its saved value again and the message goes.

Nothing blank or half-typed becomes `0`, and nothing out of range is quietly clamped into range.

`lib/validate.js`:

| | |
|---|---|
| `readNumberField(raw, rule)` | `{ ok: true, value }` or `{ ok: false, message }`. Pure; covered by `tests/validate.test.js`. |
| rule `empty` | The message when it's blank. Without one, blank is allowed and reads as `null` (unknown). |
| rule `min`, `max`, `range` | A range, and the message for outside it. |
| rule `badInput` | The input's `validity.badInput`: `""` because the browser couldn't read it, not because it's empty. |
| `markField(input, result)` | Shows or clears the message and `aria-invalid`; returns `result.ok`. |

Every invalid field has the same red border, whichever family styles it (`utilities.css`), and the message uses the
shared `.field-error`.

**Commas:** Chrome drops a comma typed into a number field, so "1,5" reads as `15`. A comma can't be read as a decimal
here, because "1,250" is a thousands separator in Australia. Instead, while the field has focus, it says "Commas are
left out — for a decimal, use a full stop (1.5)", and the figure it became is there to see.

## Rules, field by field (this PR)

Each was reproduced in the browser before the change, against what's saved in storage.

| Field | Blank | 0 | Negative | Range | Before #263 |
|---|---|---|---|---|---|
| Amount (`.f-amount`, budget and income rows) | Error: "Enter an amount — 0 if there isn't one." | Saved | **Saved, as before** (see below) | — | Blank saved `0`, and the headline showed $0.00/mo |
| Salary sacrifice (`.f-sacrificevalue`) | Error: "Enter how much — 0 for none." | Saved | Saved, as before | — | Blank saved `0` |
| Claimable share (`.f-deductpct`) | Error: "Enter the claimable share, from 0 to 100%." | Saved (claims nothing) | Error | 0–100, error outside it | 150 saved `100`, −10 saved `0`, blank saved `0` |

**Negative amounts** are left as they were. The original fields had `min="0"`, which never stopped a save, and `-40` saves today. The generic shared ledger editor and primary income Amount now omit that contradictory native minimum. Pay-change and sacrifice controls keep their existing native constraints and save handlers.
Whether a negative budget or income line is ever meant (an offset, a reimbursement) is a rules decision, and #263 says
not to blanket-ban negatives. It's an open question below, not a change made here.

## Investments (Net worth → Investments)

Each was reproduced in the browser on main before the change (the `investvalidation` journey fails there: a cleared
quantity saved 0 units). A field inside a list (a lot, a payout, a statement) gets its own message; in a lot's or
payout's grid the message spans the row under its fields. Closing the holding's editor cancels a draft
(`defineSavedValue` in `rows.js` tells the shared close code each field's saved value).

| Field | Blank | Negative | Range | Before #263 |
|---|---|---|---|---|
| Asset value (`.a-amount`) | Error: "0 if there's none" | Saved, as for budget amounts | — | Blank saved `0` |
| Units (`.h-qty`), price (`.h-price`) | Error | Error | — | Blank saved `0` (the holding's value fell to $0) |
| Average cost (`.h-avgcost`) | Saved as unknown (`null`), as before | Error | — | Unreadable saved `0` |
| Dividend per unit (`.h-dividend`) | Error: "0 if it pays none" | Error | — | Blank saved `0`; negative clamped to `0` |
| Franked % (`.h-franked`) | Error | Error | 0–100, error outside it | 150 saved `100`, blank saved `0` |
| Payout cash and franking credit (`.po-cash`, `.po-credit`) | Error: "0 if none" | Error | — | Blank saved `0`; negative clamped to `0` |
| Lot units (`.lot-units`) | Error | Error | Not below the units sold from it | Blank or too few quietly raised to the sold count |
| Lot price, brokerage (`.lot-price`, `.lot-brokerage`) | Error | Error | — | Blank saved `0`; negative clamped |
| Tax statement figures (`.stmt-field`) | Error: "0 if it isn't on the statement" | Saved (a statement can carry a negative adjustment) | — | Blank saved `0` |
| Vehicle purchase price (`.v-purchaseprice`) | Error | Error | — | Blank saved `0` |
| Vehicle depreciation (`.v-deprate`) | Saved as `null` (none), as before | Error | 0–100 | Over 100 saved |
| Offset balance (`.offset-balance-input`) | Error: "0 if it's empty" | Error | — | Blank saved `0` |
| Target mix share (`[data-mix-target]`) | No target for that kind, as before | Error | 0–100 | 150 saved `100`; unreadable deleted the target |

Not changed: the target mix's "next amount" (`bench.nextAmount`) is a what-if reading that's never saved, and the two
reads in `assets.js` are chart calculations, not input.

## Property (Net worth → Property)

Reproduced on main before the change (the `propvalidation` journey fails there: a cleared value saved $0). A loan is a
row editor, so closing it cancels a draft, as with a holding. Fields saved on `change` (land value, purchase price,
ownership, depreciation) redraw the card only once they read, so the message stays until then.

| Field | Blank | Negative | Range | Before #263 |
|---|---|---|---|---|
| Current value (`.prop-value`) | Error | Error | — | Blank saved `0` |
| Land value (`.prop-land-value`) | Error: "0 if you don't have it" | Error | — | Blank saved `0` |
| Purchase price (`.prop-purchase-price`) | Unknown (`null`), as before | Error | — | Negative saved |
| Purchase costs (`.cc-amount`) | Error: "0 if there isn't one" | Saved (a settlement credit) | — | Blank saved `0` |
| Ownership share (`.prop-ownership`) | `0`, as before (owned by the others) | Error | 0–100 | 150 saved `100` |
| Loan balance, rate, term, manual repayment | Error | Error | — | Blank saved `0` |
| Rate after the fixed period (`.loan-revert-rate`) | Keeps today's (`null`), as before | Error | — | — |
| Used to invest % (`.loan-invest-pct`) | All of it (no value), as before | Error | 0–100 | 150 saved `100` |
| Borrowing costs (`.loan-borrowing`) | Error: "0 if none" | Error | — | Blank saved `0`; negative clamped |
| Borrowing-cost term (`.loan-borrowing-term`) | Five years (`0`), as before | Error | — | Negative clamped |
| Offset (`.loan-offset`) | Error: "0 if it's empty" | Error | — | Blank saved `0` |
| Manager's fee % and flat (`.prop-pmfee-*`) | Error: "0 if none" | Error | % is 0–100 | Blank saved `0` |
| Depreciation schedule, construction cost, plant value | Error: "0 if none" | Error | — | Blank saved `0`; negative clamped |
| Plant effective life (`.prop-plant-life`) | Error | — | At least 1 year | Blank saved `10`, below 1 raised to `1` |

Not changed: the fixed-rate what-if (never saved); "Record change" and "Add interest charge" already refuse a missing
figure with a message; the reads in `properties.js` are display calculations.

## Tax and people (Tax → People, Tax → This year, Tax → Returns)

Reproduced on main before the change (the `taxvalidation` journey fails there: a cleared HELP balance saved 0). The
Tax panel's handler also read date of birth, HELP, caps, losses and home hours — dead since v3.44.0 moved those fields
to Tax → People; those branches are removed rather than validated.

| Field | Blank | Negative | Range | Before #263 |
|---|---|---|---|---|
| HELP owing, carry-forward, capital losses (`.pp-help`, `.pp-carry`, `.pp-losses`) | Error: "0 if none" | Error | — | Blank saved `0`; negative clamped |
| Concessional cap (`.pp-cap`) | Error | Error | — | Blank saved a $0 cap |
| Hours worked a week (`.pp-week`) | Counts as 38, as before | Error | 0–168 | 200 saved `168` |
| Hours from home in a year (`.pp-wfh`) | None, as before | Error | — | Negative clamped |
| Manual sacrifice (`.tax-sacrifice`) | Error: "0 for none" | Error | — | Blank saved `0`; negative saved |
| Super top-up (`.tax-topup-amt`) | None (`0`, the cap room is shown), as before | Error | — | Negative clamped |
| Payslip gross and withheld so far (`.tax-ytd-*`) | None (`0`), as before — shown blank | Error | — | Negative clamped |
| Super guarantee % (`#taxSgRate`) | Error | Error | 0–30 | Blank saved `0` |
| Health premiums (`#taxPhiPremiums`) | Error: "0 if none" | Error | — | Blank saved `0` |
| A return's figures (gross, allowances, withheld, RESC, RFBA, a deduction's amount) | Error: "0 if none" | Error | — | Blank saved `0` |
| An interest account's share (`sharePct`) | All of it (100%), as its placeholder says | Error | 0–100 | **Blank saved 0%** — the account's interest left out |

In a return's grid the message spans the row under its fields, like a lot's. Not changed: the rental schedule's
actuals (blank already means "use the plan's figure").

## Calculators (a scenario's purchase and invest calculators)

Reproduced on main before the change (the `calcvalidation` journey fails there: a cleared price became $0). The
calculators edit a scenario's draft; a field that doesn't read leaves the draft as it was.

| Field | Blank | Negative | Range | Before #263 |
|---|---|---|---|---|
| Property price (`.calc-price`) | Error | Error | — | Blank saved `0` |
| Deposit % (`.calc-depositPct`) | Error | Error | 0–100 | 150 saved `100` |
| Rate, interest-only rate (`.calc-rate`, `.calc-iorate`) | Error: "0 if it's interest-free" | Error | — | Blank saved `0` |
| Loan term (`.calc-term`) | Error | — | At least 1 year | 0 or blank saved `1` |
| Stamp duty typed in (`.calc-manual-stampduty`) | Error: "0 if none" | Error | — | Blank saved `0` |
| LMI quote (`.calc-lmi-quote`) | The estimate (`null`), as before | Error | — | Negative clamped |
| Property growth (`.calc-growth-override`) | The plan's rate (`null`), as before | Saved (prices can fall) | — | Unreadable saved `0` |
| A purchase cost (`.cc-amount`) | Error: "0 if there isn't one" | Saved (a credit), as for a property's costs | — | Blank saved `0` |
| Invest: starting amount, monthly amount | Error: "0 if none" | Error | — | Blank saved `0`; negative clamped |
| Invest: growth % (`.invest-growth`) | Error: "0 for none" | Saved (a fall) | — | Blank saved `0` |

`markField` now puts the message in the whole `.calc-field` / `.proj-field`, not in a "$" prefix wrapper inside it,
which pushed the prefix down. A cost row's message gets its own line under the row (`.m-cost-row`, on Property too).
Found while checking that at 320px: a cost row's amount had no width of its own, so it took an input's natural width
(259px) and overflowed its 165px column past the row's left edge, on main too. It now fills its column.

## Plan (Plan → Projections)

Reproduced on main before the change (the `planvalidation` journey fails there: a cleared return saved 0%, redrawing
the whole plan on it). Each assumption's slider follows only a saved figure; the message goes straight under the field,
above its slider.

| Field | Blank | Negative | Range | Before #263 |
|---|---|---|---|---|
| Horizon (`#projHorizon`) | Error | — | 1–50 years | 80 saved `50`; blank saved `1` |
| Investment return, property growth, inflation, income growth | Error: "0 for none" | Saved (a fall, deflation) | — | Blank saved `0%` |
| Rate shock (`#projRateShock`) | Error: "0 for none" | Error | — | Blank saved `0`; negative clamped |
| Investment and property ups and downs (`#projInvestVol`, `#projPropertyVol`) | Error: "0 for none" | Error | — | Blank saved `0`; negative clamped |
| A life event's year | Error | — | — | Blank saved `null`, counted as this year |
| A life event's length in years | Error | — | At least 1 | Blank saved `null`, counted as 1 year |
| A life event's amount | Error: "0 if none" | Saved (money coming in) | — | Blank saved `0` |

## Cash flow (Cash flow → Spending)

Reproduced on main before the change (the `cashvalidation` journey fails there: a cleared amount saved $0).

| Field | Blank | Negative | Range | Before #263 |
|---|---|---|---|---|
| A transaction's amount (`.tx-amount`) | Error: "negative for a refund" | Saved (a refund) | — | Blank saved `$0` |

Closing a transaction cancels a draft amount; the refund toggle and picking a budget line (which fills a blank amount)
write the saved figure back and clear the message.

Not changed, each for a reason:
- **Quick log, a pay change, a new row typed straight into the grid**: already refuse a blank amount with a message (or,
  for the grid, take the linked line's amount, or a $0 note when it has a description).
- **Bills to confirm**: a blank or 0 amount confirms at the bill's own amount — the field's purpose.
- **"Vary by scenario"** (`.scen-override-input`): reads with `|| 0` too, but nothing has opened its panel since item 207
  replaced per-row Vary with Plan's "Changes from today" — dead code, for a separate cleanup.

**A redraw while someone is typing** (the app's own price or cash-rate read can land then) used to replace the field
with one drawn from what's saved — the last valid value, no message, the caret at the start. `keepUi` now carries the
typed text, the message and the caret to the replacement (found by the categories journey on CI; that journey now
forces a redraw mid-typing to check it).

`rows.js`'s table of saved values is made on first use: `spendingwiring.js` registers into it while loading, before
`rows.js` has run in the import cycle.

## The rest (Accounts, Home → Insights and Benchmarks, a property's suburb figures, strategy and sale)

These already took blank as "none". What they did with a figure out of range was the problem: drop it, ignore it, or
clamp it, without a word. Reproduced on main (the `restvalidation` journey fails there: a cycle day of 31 saved 28).
`readNumberField` gained `whole` for a day of the month or an age.

| Field | Blank | Out of range | Before #263 |
|---|---|---|---|
| A card's cycle start day (`.acct-mgmt-day`) | Error | Not 1–28, or a fraction: said | 31 saved `28`; blank saved `1` |
| A card's repayment day (`.acct-mgmt-payday`) | None, as before | Not 1–31: said | 40 removed the day that was set |
| A card's limit (`.acct-mgmt-limit`) | None, as before | Negative: said | Negative removed the limit that was set |
| Retirement ages (`#fireCurrentAge`, `#fireRetireAge`) | Not set, as before | Not 16–99, or a fraction: said | 120 saved `99`, 10 saved `16` |
| Benchmark's fixed rate (`[data-bm-rate]`) | Error | Not 0–30: said | Ignored: the field showed it, the comparison didn't use it |
| A goal's target (Home → Benchmarks) | No target, as before | Negative, or a share over 100%: said | Negative erased the target |
| A suburb's yield and weekly rent | Cleared, as before | Negative: said (growth may be negative) | Saved |
| A loan's strategy figures | None, as before | Negative: said | Saved, and ran the what-if backwards |
| "If you sold": price, agent %, other costs | The estimate, as before | Negative, or a fee over 10%: said | Saved |

## Checked and left: the reads that aren't input

The inventory at v3.229.0 counted 93 `parseFloat(…) || 0` / `Number(…) || 0` reads in `components/`, and 7
`Math.max(0, Math.min(100, …))` clamps. Every one that reads a field someone types into is in a table above. The rest are
display and chart calculations (a history point's value, a progress bar's width), a session-only what-if that's never
saved (Plan's stress test, the fixed-rate what-if, the target mix's next amount), or a form that already refuses a
blank with a message (Quick log, a pay change, Record a rate change). "Vary by scenario" is unreachable since item 207
and is left for a cleanup.

## Open questions

1. **Negative amounts on budget and income lines:** allowed (as now), or an error with a way to record an offset?
2. **Long forms:** the row editor is short enough that the message beside the field is the summary. Longer forms
   (property purchase, the tax year) will want an error count at the top that links to each field. That comes with
   those families.
3. **Blank meaning "unknown":** for some fields (a property's purchase cost, a date of birth), blank is a real answer.
   Those rules leave `empty` out, so blank saves as `null`, and the calculation must already handle `null`. Each
   family checks that before using it.
