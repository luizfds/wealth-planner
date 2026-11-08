# Reading a field before it's saved (#263)

**Status: the contract has shipped, and the first family uses it: the budget and income row editors.** Every other
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

**Negative amounts** are left as they were. The field has `min="0"`, which never stopped a save, and `-40` saves today.
Whether a negative budget or income line is ever meant (an offset, a reimbursement) is a rules decision, and #263 says
not to blanket-ban negatives. It's an open question below, not a change made here.

## What's left: every other place a number is read the same way

`parseFloat(…value) || 0` (or `Number(…) || 0`), which turns blank and unreadable input into `0`. Counted on main at
v3.229.0:

| Where | Reads |
|---|---|
| `propertieswiring.js`, `properties.js` | 29 |
| `assetswiring.js`, `assets.js` | 19 |
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
