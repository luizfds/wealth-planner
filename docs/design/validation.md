# Reading a field before it's saved (#263)

**Status: the contract has shipped. Families using it: the budget and income row editors, goals, debts, category names, Investments and Property.** Every other
family follows in its own PR. Part of #253; builds on the shared field from #254 ([fields.md](fields.md)).

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

## What's left: every other place a number is read the same way

`parseFloat(…value) || 0` (or `Number(…) || 0`), which turns blank and unreadable input into `0`. Counted on main at
v3.229.0:

| Where | Reads |
|---|---|
| ~~`propertieswiring.js`, `properties.js`~~ | ~~29~~ done (Property, above) |
| ~~`assetswiring.js`, `assets.js`~~ | ~~19~~ done (Investments, above) |
| `taxwiring.js`, `taxyear.js`, `people.js` | 15 |
| `calcwiring.js` (calculators) | 11 |
| `planwiring.js` | 6 |
| `spendingwiring.js`, `cashflowwiring.js` | 5 |
| `dashboard.js`, `accountswiring.js`, `accounts.js`, `benchmarks.js`, `investreturn.js`, `detail.js` | 8 |

There are also 7 `Math.max(0, Math.min(100, …))` clamps in `components/`. Some of these are display or filter readings
rather than saves; each family's PR sorts them, sets the field's rules in the table above, and reproduces the problem
before changing it.

## Open questions

1. **Negative amounts on budget and income lines:** allowed (as now), or an error with a way to record an offset?
2. **Long forms:** the row editor is short enough that the message beside the field is the summary. Longer forms
   (property purchase, the tax year) will want an error count at the top that links to each field. That comes with
   those families.
3. **Blank meaning "unknown":** for some fields (a property's purchase cost, a date of birth), blank is a real answer.
   Those rules leave `empty` out, so blank saves as `null`, and the calculation must already handle `null`. Each
   family checks that before using it.
