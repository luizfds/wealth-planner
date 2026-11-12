# One field: inventory and spec (#254)

**Status: foundation and the ledger/income/basic asset families shipped; investment transaction fields merged in PR #327; debt/offset/loan fields implemented, awaiting PR review.** The shared field exists (tokens, `.field` / `.field-control`, `lib/field.js`).
Benchmarks, generic ledger, income, basic asset, vehicle, holding and sale editors use it. Lots/distributions and statements now follow in this PR. The touch floors are fixed everywhere. Every other family moves onto it in its own PR,
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
| Investments: holdings/lots/distributions/statements (`.h-*`, `.lot-*`, `.po-*`, `.stmt-*`) | — | Shared field; lots/distributions → *compact* | Holding/sale fields were shared already; transaction controls shipped v3.252.0. Debt/offset/loan fields are documented below. |
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
2. **Desktop text:** migrated families retain the shipped shared standard, 13px (`--fs-sm`). The unclassed
   fallback and calculators remain for later family migrations; they currently use 14px (`--fs-md`).
3. **Compact cells:** the documented variant uses 4px horizontal padding with the shared height and state skin;
   lots/distributions adopt it below.
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

Holding/sale fields already use the adapter; investment transaction skin work is documented below. Debt/offset
forms are documented below; other families remain separate migrations. Actual screen-reader and physical-device
verification remains the pending manual task above.

## Step 5: investment transaction field skin (#254)

Shipped v3.252.0 (PR #327). Reuse the shipped field contract: 13px desktop text,
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

### Investment field verification

| Control | Before at 1280px | After at 1280px | Before → after at 1024px touch |
| --- | --- | --- | --- |
| Lot price | 32px high; 6px radius; 6×4px padding | 36px; 6px; 6×4px | 37 → 44px high |
| Statement amount | 40px high; 7px radius; 6×8px padding | 36px; 6px; 6×8px | 40 → 44px high |
| Statement year | 32px high; 6px radius; 5×6px padding | 36px; 6px; 6×8px | 32 → 44px high |

Desktop text remains 13px. Text-entry fields on coarse-pointer screens measure 17px (above the 16px floor);
native selects retain the documented picker exception. The shared `--field-h` token now becomes 44px on coarse
pointers, fixing the gap above the 880px phone breakpoint for all shared controls without changing mouse desktop
sizing. Textareas retain their larger minimum. Compact cells override only `--field-px` to 4px; their state skin
comes from `.field-control`. Statement units/help span two grid columns so the explanation has room.

Before/after screenshots and measurements use synthetic data at 320/390/768/1024/1280px, both themes; touch
emulation includes both tablet widths. 30 focused axe states (expanded, invalid statement, disabled/read-only)
pass in the editor content. Local static/unit/render checks, full page smoke and investmentfields/holdings/
investvalidation journeys pass. Tests verify saves, blank rejection, signed statements, zero distributions,
statement years, lot add/delete/sold protection, linked labels, unique error ids and focus through redraw.
Artifacts: `/tmp/investment-field-review/`.

The unchanged holding-row header’s nested Details link is an existing finding recorded in
`records-before-tools.md`; editor scans cover `.m-row-edit-pad` and do not certify that header or the Shares
performance table. The whole Shares page remains covered by smoke and existing scoped accessibility checks.
#254 stays open; the debt/offset/loan migration follows below, with Property, Tax, calculator, setup and fallback families still to finish.

## Debt, offset and property-loan fields (#254)

Implemented on `codex/debt-offset-fields`, awaiting PR review, reusing the shipped shared tokens and state contract. Debt balances
and Investments’ offset balances become bordered shared controls, retaining their compact 110px record-value
layout, linked visible labels and context-based accessible names. Debt names remain the documented inline-rename variant. Give record
balances stable ids and reserved errors without changing their values, limits, steps or save handlers.

Property-loan controls (including manual repayment, rate-change date/new rate and optional borrowing/fixed-rate
fields) use `.field-control`; native loan dates span two columns so their year remains readable on touch screens. They retain the existing `labelFields` compatibility adapter. That adapter
already supplies linked visible labels, stable per-card ids and described help; existing numeric validation
keeps its messages and update rules. This is a skin migration, not a new set of loan rules or persisted fields.

Keep the two offset surfaces synchronized, without double-counting cash or changing interest/equity. Preserve
empty states, loan add/delete, debt balance history, rate recording, auto/manual modes, fixed/variable inputs
and blank/zero/negative handling. Verify selectors, actual saves, rejected values, name changes, focus through
redraw, both directions of offset mirroring and all rate-history fields. Inspect before/after at
320/390/768/1024/1280px, both themes, including coarse-pointer tablets and expanded/error states.

The remaining Property, Tax, calculator, setup and fallback families stay under #254. The compatible loan
adapter and compact record balances are explicit shared-control variants; they do not introduce another skin.

### Debt/offset/loan verification

| Control | Before at 1280px | After at 1280px | Before → after at 1024px touch |
| --- | --- | --- | --- |
| Debt balance | 40px; 6px radius; 5×6px padding | 36px; 6px; 6×8px | 40 → 44px high |
| Investments offset | 40px; 6px radius; 5×6px padding | 36px; 6px; 6×8px | 40 → 44px high |
| Property-loan balance | 40px; 7px radius; 6×8px padding | 36px; 6px; 6×8px | 40 → 44px high |

Shared controls keep 13px desktop text; touch text entry remains 17px. Debt names retain the transparent
inline-rename variant (40px desktop, 44px touch) and visible keyboard focus. Debt/offset controls now have
linked visible labels, retaining debt-specific accessible names after renaming. Existing and new error
messages remain attached to their field; debt/offset messages reuse reserved ids.

The debtoffsetfields journey checks debt blank/zero/negative rules and history; offset blank/negative rejection;
mirroring in both directions; labels/help; manual repayment and rate recording; shared dimensions at five
widths; and focus through direct redraw and repayment-mode changes. Existing debts/property/propvalidation
journeys pass. Render, unit and static checks and full page smoke pass.

Before/after screenshots and measurements cover 320/390/768/1024/1280px and both themes with long loan/property
names. Focused scans cover normal balances, invalid fields and manual loan mode in the editor content. The
accessibility script now includes Offsets plus populated debt normal/error states and expanded loan/error/manual
states. Artifacts: `/tmp/debt-offset-review/`. Financial calculations, stored data and save handlers are unchanged.

Final scoped checks pass at all five widths and both themes, including the wider native date fields on phones,
touch tablets and desktop. Whole-form review starts at the dialog’s stable initial scroll position; the CI
accessibility script checks every loan field with its label/help fully in view, avoiding contrast sampling of
fragments clipped at the modal/backdrop boundary. No accessibility rule is disabled. Local accessibility runs pass at 390px/light and 1280px/light; the 85-state desktop run includes all 16 loan
field groups plus error and manual-repayment checks. Normal whole-page coverage remains in place.

## Property acquisition costs and depreciation (#254)

Shipped v3.253.0 (PR #330). Acquisition descriptions/amounts and the quantity surveyor's
financial year/capital works/plant cells use the shared compact control (4px horizontal padding). Construction
cost, completion date, plant value and effective life use the standard control. Keep the second-hand checkbox
as the documented native toggle. Other Property fields remain separate migrations.

Remove the independent cost/schedule skins and exclude shared controls from the old calculator fallback.
Keep existing labels, help, validation, sorting, calculations, schemas and save handlers. In particular,
acquisition amounts retain their existing signed-value policy; blank amounts remain invalid.

Desktop measurements: construction cost changes from 40px/7px corners to 36px/6px; schedule amounts change
from 28px to 36px and the financial-year select from 30px to 36px. Standard padding is 6px × 8px; compact
padding is 6px × 4px. Phone fields retain 44px targets and 17px text entry. The native select retains its
existing text-size exception. Coarse-pointer tablets retain the shared 44px floor. At ≤480px the schedule
puts year/delete above its two amount cells, avoiding the previous 30px-wide amounts; the journey requires
at least 90px per amount on narrow phones.

Verification: `propertycostfields` checks actual acquisition/construction/date/schedule saves, blank-value
errors and bounds/height/radius at 320/390/768/1024/1280px with touch. Existing `property` and `propvalidation`
journeys pass; render/property unit checks pass. Before/after screenshots and computed styles in both themes
are under `/tmp/property-field-review/` (review artifacts, not committed).

## Property overview fields (#254)

Merged in PR #331. Current value, purchase price/date, land-tax state/value
and per-person ownership percentages now use `.field-control`. The shared fallback exclusion introduced in
PR #330 already lets these controls inherit the common background, border, radius, padding and states.
Keep the header's property-name and kind controls as the documented inline-rename and badge-select variants.
Other Property tools and income/fee controls remain separate migrations.

Keep the label/help compatibility adapter, existing constraints and validation, purchase-date handling,
land-tax aggregation, ownership defaults/warnings, calculations and save handlers. Keep native calendar icons
on the calculator date fields’ existing light/dark color scheme. No schema changes.
Standard desktop controls use 36px height, 6px corners and 6px × 8px padding; phones and coarse-pointer
tablets retain 44px targets and touch text-entry typography. Native selects retain their documented exception.

Verification: `propertyoverviewfields` exercises actual value/date/state saves and focus through a redraw,
then checks shared styling, sizes and bounds at 320/390/768/1024/1280px in both themes with touch.
Existing `property` and `propvalidation` journeys, property/render unit checks and static checks pass.
Before/after screenshots and computed styles are under `/tmp/property-overview-review/` (not committed).

## Property income controls (#254)

Shipped v3.255.0 (PR #332). The manager's percentage/flat fees, receipt frequency,
next review date, new rent and vacancy start/end dates use `.field-control`. Fallback projection/filter
skins exclude shared controls; manager fees retain their 110px layout, and rent controls keep the panel's
responsive layout. Vacancy dates get visible linked labels, including the optional end date. Their labels
wrap with the inputs; native calendar icons support light/dark rendering. Statement/import forms remain
separate work, as do loan/sale tools and the documented property-name/kind variants.

Preserve existing fee validation, receipt-frequency semantics, rent-review history/Undo and vacancy save
handlers, calculations and schemas. The new `propertyincomefields` touch journey verifies fee rejection,
fee/frequency/date saves, a recorded rent change and vacancy dates, linked labels, shared dimensions,
readable date widths and bounds at 320/390/768/1024/1280px in both themes. Existing Property, validation and
rent-statement journeys and property/render/static checks pass. Before/after screenshots and measurements
are in `/tmp/property-income-review/` (not committed). Standard desktop fields use 36px height, 6px corners
and 6px × 8px padding; phone/touch-tablet targets remain 44px with touch text-entry typography. Native selects
retain the documented text-size exception.

## Property what-if controls (#254)

Shipped v3.256.0 (PR #333). Loan strategies' six assumptions and loan picker, the fixed-rate
rollover input and the four sale-estimate fields use `.field-control`. Remove their independent skins,
keeping layout widths, amount alignment and the sale labels' normal input typography. Constrain the loan
picker to its container so long loan names cannot overflow a phone; verify bounds against the requested
viewport width rather than the mobile layout's potentially expanded innerWidth. Native sale dates
support light/dark calendar icons. Statements/imports remain separate work; property name/kind keep their
existing documented variants.

Keep validation, blank/default meanings, saved strategy/sale assumptions and the session-only fixed-rate
what-if map. No changes to actual loan/property figures, calculations, schemas or save handlers.

`propertytoolsfields` uses an invented second loan with a long name and a fixed-rate fixture. It verifies
loan selection, all six strategy saves, negative rejection, cleared defaults, fixed-rate updates/focus,
all sale inputs, invalid agent-fee rejection and blank sale-price estimates. Actual balances/rates/value
must remain unchanged. Shared styling, linked labels, touch targets, text sizing, date theme support and
bounds are checked at 320/390/768/1024/1280px in both themes. Existing `property` and `propvalidation`
journeys pass. Before/after screenshots and measurements for phone/desktop and both themes are in
`/tmp/property-tools-review/` (not committed). Desktop controls use 36px height/6px corners; phones and
coarse-pointer tablets retain 44px targets and the documented touch typography/select exception.

## Property record-entry forms (#254)

Implemented on `codex/property-statement-fields`. The eight property-manager statement controls, Activity's
cost-line selector and manual loan-interest form use `.field-control`. Activity controls now have visible
linked labels; the single-loan hidden input and statement PDF file trigger keep their native variants.
Remove independent Activity skins and keep legacy setup height floors off shared statement controls.
The statement grid's minimum column is 160px so native dates remain readable. On phones ≤480px, each
Activity record's date sits above its content/actions, allowing at least 120px for the cost-line picker
instead of the previous 93px at 320px. Native dates support light/dark calendar icons.

Keep the original blank-to-zero statement handling, net preview, duplicate-payment check, PDF fill, logging,
removal/Undo, cost-line reassignment and manual-interest validation. No financial, schema or save-handler changes.

`propertyrecordfields` verifies the eight statement controls, expected net/receipt account/bills, Activity
reassignment, rejection of negative interest, selected-loan logging, and statement removal with its receipt
and bills. It checks linked labels, shared styling, touch targets, date/select readability and actual viewport
bounds at 320/390/768/1024/1280px in both themes. Existing `property` and `rentstatement` journeys and
agent-statement/property-actual/render/static checks pass. Before/after phone/desktop screenshots and
measurements in both themes are under `/tmp/property-record-review/` (not committed). Desktop shared controls
use 36px height/6px corners; phones and coarse-pointer tablets retain 44px targets and touch typography.
Other page families remain under #254.

## Tax → People (#254)

Implemented on `codex/tax-people-fields`. Date of birth, HELP balance, concessional cap/carry-forward,
capital losses, weekly hours and four annual WFH hour controls use the shared field skin. Names use the
shared inline-rename variant, keeping their headline typography; the withholding-variation checkbox stays
native. Preserve linked labels/help and all numeric, blank/default, reference and tax rules.

The People grid uses 160px minimum columns so native dates stay readable. Standard controls use 36px
height/6px corners/6px × 8px padding on desktop, retaining 44px targets and touch typography on phones and
coarse-pointer tablets. Inline names keep the 40px desktop/44px touch variant. Native dates follow the
chosen app theme, including when it differs from the OS theme.

Verified an existing focus loss on direct People redraw, then applied `keepUi` to retain the active field.
No schema, calculation or save-handler changes. `peoplefields` exercises all scalar settings, rejected
negative caps, clearing hours to defaults, focus through redraw and rename propagation/settings retention.
It checks shared dimensions, labels, readable dates and viewport bounds at 320/390/768/1024/1280px in both
explicit app themes with the opposite OS preference. Existing `taxlabels` and `taxvalidation` journeys,
People/tax/render tests and static checks pass. Before/after screenshots and measurements are under
`/tmp/people-field-review/` (not committed). Other Tax and remaining page families stay under #254.

## Tax → Returns (#254)

Income statements, interest, deductions and rental overrides use the shared compact field skin.
Existing accessible names, right-aligned figures, numeric validation and blank/default rules remain.
Statement, interest and deduction rows reflow by the person card's width so amount fields stay readable
on phones and beside the desktop sidebar. Native checkboxes retain their existing behavior.

A direct redraw previously dropped the active field. `keepUi` now preserves focus and unfinished input;
stable worksheet field IDs, scoped to the financial year, also retain the validation message when an invalid field is redrawn. Existing
open/closed disclosure restoration remains. No financial calculations, state schema or save handlers change.

The `taxreturnfields` touch journey edits all three row families, rejects invalid gross income, checks
focus/input/message through redraw and isolation across financial years, restores blank interest shares and modeled rental estimates, and
measures shared skins, 44px targets, accessible names, readable numeric widths and viewport bounds at
320/390/768/1024/1280px in both themes. Existing Tax validation/label journeys and tax-year/render tests
also pass. Review screenshots and measurements are under `/tmp/returns-field-review/` (not committed).

## Tax → This year (#254)

SG rate, premium source/amount/tier, manual sacrifice, personal super top-up and payslip date/figures/text
use the shared standard control skin. Native hospital-cover/family checkboxes and the PDF picker stay as
before. Existing accessible labels/help, premium source groups/deleted-line fallback, disabled modeled
premiums, validation, calculations and save handlers remain unchanged.

The payslip grid uses 160px minimum columns so native dates are readable; dates follow the explicit app
theme even when the OS preference differs. Controls keep 36px desktop height, 6px corners and 6px × 8px
padding, with 44px touch targets. Numeric alignment and the paste box's monospace face remain page layout
choices; their independent skins are removed.

The `taxplanningfields` touch journey checks household saves/toggles, premium source switching and typed
amount retention, sacrifice/top-up saves and negative rejection, payslip scalar saves and paste-draft
retention during recalculation. It measures shared skins, linked labels, date readability, touch targets
and viewport bounds at 320/390/768/1024/1280px in both explicit app themes with the opposite OS preference.
Existing Tax validation/label journeys, tax/withholding/top-up/render tests and static checks pass.
Before/after screenshots and measurements are under `/tmp/tax-planning-review/` (not committed).

## Standalone calculators (#254)

The 16 stamp-duty, LMI, repayment and borrowing-power controls use the shared standard skin via their
existing field builder. Labels, options, decimal input modes, step sizes and all calculations stay the
same. The repayment type selector spans the card's field grid so “Principal & interest” stays readable
on narrow phones. Existing field/card layout rules otherwise remain unchanged.

Browser verification exercises every input and select, the interest-only repayment and 20% deposit
estimates, and reload behavior. Standalone figures remain session-only; dependants retain their existing
household save behavior. Measurements and before/after screenshots cover 320/390/768/1024/1280px in both
themes, including touch tablets. Shared fields have 6px corners and 6px × 8px padding, 36px desktop
height and 44px touch targets. Calculator/render tests and static checks pass. Review artifacts are
under `/tmp/calculator-fields-review/` (not committed). Scenario purchase/investment fields remain a
separate family under #254.

## Scenarios: the editor, its changes, templates and calculators (#254)

The last page family. Inventoried in the browser by adding one change of every kind to a draft, opening every
"What are you weighing?" template and both calculators, then reading every visible control: 72 distinct fields, none of
them on the shared skin.

| Where | Controls | Was |
|---|---|---|
| A change's fields (`field()` in `scenariochanges.js`, every kind: rent elsewhere, investment property, cost, sell, extra repayment, one-off, include) | 25 kinds of field | `.scf` skin, 7px / 40px |
| An amount change, the quick-add row | 3 | 7px / 40px |
| Template questions (`scenariotemplates.js`) | 15 | `.fr-field`, 6px / 38px, no skin |
| The note | 1 | dashed, 10px corners |
| The cash-draw picker | 2 | 6px / 36px, no skin |
| The name | 1 | its own 8px rename skin, 35px |
| Purchase calculator | 20 | 7px / 40px; five bare browser fields (22px at 1280px); the typed stamp duty had an inline skin |
| Invest calculator | 5 | 7px / 40px |

All of them are now on the shared standard skin. The name uses the documented inline-name variant (ledger.css) at a
heading's size. The calculator's cost rows and LMI quote use the compact variant, as Property's acquisition-cost
list does. A change's *changed* and *unusual* states still tint the border (brass, `--warn-ink`) over the skin. The
note keeps its autosize, starting one field tall. Classes, wiring, drafts, the leave guard, validation and every
figure are unchanged.

Each calculator grid field's visible label is now tied to it (`for`/`id`, from the scenario's place among the
purchase configs), so a click on the label focuses the field and it is the field's name. A change's fields and the
template questions were labelled already, by their wrapping `<label>` and by `for`. The calculators' `title` tooltips
stay as they are: `labelFields()` would turn them into visible help lines, a larger change to these long panels than
a skin, so that is left for #255's tooltip-help step. The typed stamp duty gains the name "Stamp duty", which it had
lacked. The LMI quote now wraps under "Your quote" when there's no room beside it: "blank: estimate" was cut off at
390 and 1280px on main (a 95px field), and is read whole at every width, for 22px more on the settlement card.

Browser verification drives the real paths (a buying scenario's editor, its add-change sheet, its calculators, and
Add scenario's templates) at 320/390/768/1024/1280px in both themes, touch below desktop. It checks 36px desktop /
44px touch, 6px corners, 16px+ text entry on touch, and every field inside the viewport and named. It also checks
behaviour: a price change moves the loan, an out-of-range deposit is marked with its message and not saved, an
unusual change deposit is tinted and saved as typed, an amount change saves, the note grows, and the manual
contribution saves. Two journeys keep it: `scenariofields` (the editor with a change of every kind, an amount change,
and a template's questions) and `scenariocalcfields` (both calculators, label focus, the LMI placeholder). Each fails
on main. `calcvalidation` still covers the calculators' saves and errors. With this family, every page's fields are
on the shared skin; what remains under #254 is the first-run setup sheet and the unclassed fallback controls.
