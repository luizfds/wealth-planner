# One field: inventory and spec (#254)

**Status: foundation shipped (PR #272); shared ledger editors migrated in the current follow-up.** The shared field exists (tokens, `.field` / `.field-control`, `lib/field.js`).
Benchmarks, generic ledger, income, basic asset and vehicle editors use it. The touch floors are fixed everywhere. Every other family moves onto it in its own PR,
once this spec is agreed. Part of #253.

## How this was measured

Every page and subtab of the synthetic demo household was opened at 390, 768 and 1280px, with every disclosure open and
the first row editors on each list expanded. Every visible `input`, `select` and `textarea` was then read with
`getComputedStyle` and `getBoundingClientRect`: 810 controls, 708 of them text entry (text, number, date, url, month,
password, search, select, textarea), and 102 checkboxes and ranges. The script ran against main at v3.229.0.

| Property | What the app had (text entry, all widths) |
|---|---|
| Corner radius | 6px on 483, 7px on 156, 8px on 66, 100px (pill) on 3 |
| Vertical padding | 6px on 324, 5px on 255, 4px on 102, 3px on 18, 8px on 6, 2px on 3 |
| Horizontal padding | 8px on 426, 6px on 180, 4px on 93, 10px on 9 |
| Text size, 1280px | 13px on 163, 14px on 57, 12px on 13 |
| Height, 1280px | 36px on 86, 40 on 70, 30 on 42, 38 on 15, 32 on 9 (and 34, 39) |
| Border | 1px `--border` on 699; none on 9 |
| Background | `--paper` on 585, `--paper-raised` on 108, `--paper-sunken` on 6 |
| Under 16px, touch | **2** text-entry fields at 390px (the price Sheet link, a month picker) and **194 of 196** at 768 and 1024px |

59 distinct kinds of control (tag and class), skinned by about a dozen independent rules.

## The spec

### Tokens (`base.css`)

| Token | Value | Why |
|---|---|---|
| `--field-radius` | 6px | What 68% of fields already had |
| `--field-py` / `--field-px` | 6px / 8px | The most common padding each way |
| `--field-fs` | `var(--fs-sm)`, 13px | The most common desktop size |
| `--field-h` | 36px | The most common desktop height |
| `--field-bg` | `var(--paper)` | 83% of fields |
| `--field-border` | `var(--border)` | Every bordered field |
| `--field-border-hover` | `var(--ink-soft)` | A hover state, which no field had |
| `--field-focus` | `var(--brass)`, plus `--focus-ring` | The existing focus treatment |
| `--field-muted-bg` | `var(--paper-sunken)` | Disabled and read-only |

Every colour is another token, so both themes follow without a dark-mode block.

### States (`.field-control`)

| State | Look |
|---|---|
| Rest | 1px `--field-border`, `--field-bg` |
| Hover | border `--field-border-hover` (not when disabled or read-only) |
| Focus (`:focus-visible`) | border `--field-focus`, `--focus-ring` |
| Disabled | `--field-muted-bg`, `--ink-soft` text, not-allowed cursor |
| Read-only | `--field-muted-bg` |
| Required | `required` on the control; a `*` after the label (`aria-hidden`; the attribute is what's announced) |
| Error | `aria-invalid="true"`: border `--bad-ink`; message in `.field-error` (`aria-live="polite"`) |
| Success | `.is-valid`: border `--good-ink` |

### Structure (`lib/field.js`)

`fieldHtml({ id, label, type, value, options, unit, help, error, valid, required, disabled, readonly, placeholder,
className, attrs })` returns:

```
.field
  label.field-label[for=id]  (+ .field-req "*")
  .field-row  →  .field-control  +  .field-unit       (when there's a unit; else the control alone)
  p.field-help#id-help                                   (when there's help)
  p.field-error#id-error[aria-live=polite]               (always; hidden while empty)
```

The control's `aria-describedby` names the help and the error. Everything it's given goes through `escapeAttr`, and
`attrs` keys are checked against an attribute-name pattern.

### Touch floors (`phone.css`), changed in this PR

- **44px:** unchanged. Every field at ≤880px.
- **16px text:** every text-entry type is now covered (`url`, `month`, `time`, `week` and `datetime-local` were missing).
  It applies on any touch screen (`pointer: coarse`), not only ≤640px. Measured on touch emulation, text-entry fields
  under 16px went from 2 to 0 at 390px and from 194 to 0 at 768 and 1024px. No view started scrolling sideways, and no
  field began clipping its value. Desktops with a mouse are unchanged.

## Inventory: every control → shared field or variant

Counts are text-entry controls at 1280px (236 per width).

| Family | Controls | Maps to | Notes |
|---|---|---|---|
| Benchmarks (`.bm-controls`) | 2 | **Shared field (migrated in this PR)** | Was 8px corners, 4px padding |
| Cash flow budget editor (`.m-edit-field`, `.bc-kind`) | 37 | Shared field (generic row migrated) | The separate group picker remains; income controls are migrated below |
| Investments: holdings, lots, offsets (`.h-*`, `.lot-*`, `.po-*`, `.offset-*`) | 31 | Shared field; lots → *compact* | 7px corners on holdings |
| Tax: this year, returns (`.ty-*`, `.tax-*`) | 31 | Shared field; rent grid → *compact* | Mix of 6/7/8px |
| Tax: people (`.pp-*`) | 22 | Shared field | 7–8px corners |
| Calculators (`.cq-field`) | 16 | Shared field | 14px text |
| Settings: categories (`.cat-mgmt-*`) | 15 | *Inline rename* | Name typed in place in a list row |
| Setup wizard (`.fr-field`) | 4 | Shared field | |
| Price sheet (`.ps-*`) | 3 | Shared field | Was on the base fallback by name |
| Goals (`.goal-add`), imports (`.tr-text`) | 2 | Shared field | |
| No class of their own (Plan, Home, Cash flow dates, Reports selects…) | 73 | Shared field via the base fallback | The fallback reads the tokens now; it stays 14px/5px until its pages move |
| App dialogs (`.app-dialog-field`) | — | Shared field | Newest (#256); 10px corners, 8×10 padding today |

### Documented variants, kept on purpose

| Variant | Where | Why it differs |
|---|---|---|
| **Headline amount** | `#quickLogAmount` | The one big number you're typing; sized as a figure, not a field |
| **Badge select** | `.prop-kind` and similar | A select that reads as a tag (10.5px uppercase) |
| **Inline rename** | Category names (`.cat-mgmt-name`) | Text edited in place inside a list row |
| **Compact cell** | Purchase lots, the rental grid | Dense table cells: shared tokens, but 4px horizontal padding |
| **Search** | `.cf-search-input` | A search box (8px corners), wider and rounder than a form field |
| **Native toggles and ranges** | Checkbox, radio, range | Native controls; colour by `accent-color`, 44px via their label |

## Open questions for review

1. **Selects and the 16px floor.** `phone.css` leaves `select` out on purpose. Its comment says a select opens a native
   picker and never triggers iOS's zoom, and that 16px would break the badge selects. 48 selects are under 16px at
   390px. That claim needs checking on a real iPhone; this work used Chromium emulation only. If it's wrong, selects
   join the floor and badge selects stay an exception.
2. **Desktop text: 13px or 14px?** The spec takes 13px (`--fs-sm`, the majority). The unclassed fallback and the
   calculators use 14px (`--fs-md`), which is also the body size. Pick one before migrating.
3. **Compact cells:** a variant (4px padding, as now), or the full field with the grid allowed to scroll sideways?
4. **Migration order.** Proposed: the Cash flow budget editor (largest), then Investments, Tax, Calculators, and the
   fallback's pages. One family per PR, each with before/after measurements.

## Shared ledger migration (#261, first family)

The generic budget, scenario home-cost and property income/cost row now uses `fieldHtml`, including its shared
More options fields. Income inherits the shared timing/deduction fields; its main editor is covered by the income migration below.
Existing field classes and delegated edit handlers stay in place. Each surface has its own stable id scope, so the
same property cost can be opened from Budget and Property without duplicate control/help/error ids. Row sorting keeps
those ids stable. Grouped claim choices retain deleted-property recovery and escape names.

Labels use the shared label style and activate their controls. Timing, claim dates, claim ownership and reserve-year
explanations appear below their controls and are tied with aria-describedby; none requires hovering. Native date
controls take a full row below 640px so their year segment remains readable. Checkbox labels keep their existing
native toggle treatment. Receipt/log group headings are text rather than unattached labels.

Validation reuses the shared field's reserved error node instead of creating another with the same id. The amount's
native minimum now agrees with the existing rule allowing negative values; calculation and persistence rules do not change.

Browser coverage: `ledgerfields` checks label activation, conditional person/property claims, visible error association,
unique ids, focus through redraw, 320/390/1280px field sizing and reflow. The existing validation and two-tab journeys
remain. Accessibility adds expanded timing, personal claim, property claim and invalid amount states in both themes,
plus a 320px light pass. The #278 follow-up restores full-document scans for these editor states after adding modal semantics, background isolation and keyboard containment. Automated accessibility-tree checks do not replace actual screen-reader testing.

**Manual verification task (pending):** using VoiceOver/Safari and NVDA/Firefox, open a Budget row, expand More options,
read the date and tax help, switch person/property claim, clear/retype an amount and close/reopen the editor. Confirm
names, descriptions, error announcements and focus order, on a physical phone as well as desktop. Remaining families
under #261: holdings/lots, debt/offset forms, full property/loan editors, tax forms, scenario changes,
goals, calculators and Settings. The wider issue stays open.

## Income migration (#254 / #261)

Income now uses the same `ledgerFields` adapter as the generic row. It supplies stable ids and existing grid wrappers
around `fieldHtml`; the main fields and More options use the same income/record scope. Computed income rows remain
read-only summaries. Item name, Income type, Amount, Frequency, Super treatment, Salary sacrifice, Account and each
conditional pay-schedule control have linked visible labels. Super/sacrifice/date explanations are visible and described.

The sacrifice mode and its conditional percentage/amount have separate labels; percentage and dollar units remain visible.
Monthly income offers day-of-month/Last day, Weekly offers a weekday (including Sunday/0), and Fortnightly asks for a
recent actual pay date. The anchor date spans the row. Account spans the row too, matching the generic Budget editor
and giving account names room. The existing native sacrifice bounds/steps and all calculation/save rules are unchanged.
The main income Amount now omits the contradictory minimum, matching its existing support for negative values.

Record a pay change is a named fieldset. Its New amount and Effective from fields are drafts until Record change is
chosen, as before. The date help states the blank/today default, and recorded amounts remain in history. On phones the
fields stack and the native date has a full row. Pay-change validation continues to use its existing submit handler.

Income structural redraws use `keepUi`, retaining focus on Frequency/Salary sacrifice/Income type and open More options.
The browser journey checks labels, blank/retyped/negative Amount, sacrifice modes and blank error, super choices,
weekly/monthly/fortnightly schedules, draft-versus-recorded pay history, focus, unique ids, described help and field sizes
at 320/390/1280px. Full-document accessibility adds the collapsed Income view plus seven expanded/conditional states.
Actual screen-reader/physical-device checks remain the manual task above; the wider #261/#254 issues stay open.

## Basic asset and vehicle migration (#254 / #261)

Cash/Super/Other and Vehicle use the same shared adapter, with stable record-scoped ids and linked labels. Person and
vehicle purchase date span the row. Visible described help covers category grouping, snapshots, super estimates and
vehicle price/date/depreciation assumptions. Record value uses the standard secondary button styling. The separate
View details action is inside the editor; the row header edits the record and no longer nests a Details button.

The shared row controller writes open keys as `assets:<index>`, but all three asset renderers read bare indices.
They now agree, including the holding renderer, so redraw/snapshot does not close the editor. Snapshot redraws use
keepUi to retain keyboard focus. Category moves finish closing the original editor before rendering its destination,
then return focus to the active category tab and confirm a successful save. Changing a new asset's category counts as
an edit, preserving the new record instead of discarding it.

Blank vehicle depreciation already saves null and calculates as 0; the renderer previously substituted 15. It now
shows the stored blank. Explicit 0 stays 0, and new-vehicle defaults are unchanged. Current value keeps its label after
live updates. Calculations and numeric save rules are unchanged, including existing blank/zero/negative handling and
native constraints; numeric-policy migration remains under #263.

Browser checks cover real label activation, stored values/person, category movement for existing/new records, Details
routes, keyboard snapshots/history and focus (including holdings), Super assumptions, zero/positive/blank depreciation,
missing purchase date/price, add/discard and 320/390/1280px reflow. Initial label audits query the live DOM atomically so
a background redraw cannot make the assertion evaluate a detached node; no retries or error filters are added.
Full-document accessibility adds Cash/Super/Vehicle pages and five expanded/computed/blank/stored-value states.

Holdings/lots, debt/offset forms and other families remain separate migrations. Actual screen-reader and physical-device
verification remains the pending manual task above.

## Step 5: investment transaction field skin (#254)

In progress on `codex/investment-field-skin`. Reuse the shipped field contract: 13px desktop text,
6px radius, 36px desktop height, shared hover/focus/error/disabled/read-only states. Lots and distribution
rows use the documented compact-cell variant with 4px horizontal padding; standard statement fields use
8px. Preserve the existing 44px phone/touch floors and 16px touch text-entry typography.

The main holding and Record sale controls already use the shared adapter; verify them rather than rebuilding.
Migrate purchase lots, distributions and annual statements as one family. Retain selector hooks, constraints,
blank/zero/negative policies, sold-lot protection, saved data and financial calculations. Statement fields get
stable holding/statement-scoped ids, linked labels and reserved errors; units-at-year-end help becomes visible
and described. Keep compact row names and existing brokerage/franking/sold-unit descriptions.

Inventory for this PR: lot date/units/price/brokerage (compact); distribution date/cash/franking (compact);
statement financial year and the 12 statement amounts plus units held (standard). Existing holding/sale
fields are shared already. Debt/offset, Tax, calculators, setup and remaining fallback families follow separately.

Measure before/after and inspect normal/expanded/error states at 320/390/768/1024/1280px, both themes,
including coarse-pointer tablet emulation. Verify actual saves, rejection of blank/invalid amounts, labels,
focus, lot add/delete/protection, statement years, CSS tokens and unique described/error ids. Run the
existing holding/validation journeys, page smoke and accessibility checks. No new stored fields or maths.
