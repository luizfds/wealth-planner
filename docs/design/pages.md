# Page structure, actions, empty states and help (#255)

**Status: agreed, with the decisions at the end. Steps 1 and 2 (header and primaries; add and delete wording) are implemented; the rest is not yet**, as #255 asks: the specification is agreed first, then
pages migrate in the PRs listed at the end. Part of #253. It builds on [0010](../decisions/0010-one-design-system.md)
(tokens, buttons, cards), [fields.md](fields.md) (one field) and [validation.md](validation.md) (one way to say a field
is wrong), and covers what those don't: how a page is put together.

## How this was assessed

An audit script (`scripts/pages-audit.mjs`, to re-run after each migration) drove the app (main at v3.236.7, invented data only) through every view the smoke run covers. That is
51 views: 30 pages and subpages plus 21 reports. Each was visited three ways: the demo household at 390px and 1280px,
and an empty household at 390px. In each view it recorded:

- the page header;
- the visible primary buttons;
- every "Add" and delete control, with its wording and class;
- help left in `title` tooltips;
- tab rails, section headings and card types;
- every empty-state message, and whether a control near it offers the next step.

These are measurements, not a visual review of every combination. Screenshots of selected views were looked at to
check the numbers. CI's `screens` job captures every view at 390px and 1280px for comparison.

## What's already consistent: keep it

- **The header.** Every page has the page title, an ⓘ "About this page", a page-actions slot (Home's Arrange, the
  import/export menus) and the period chip. On a phone the title is the header and the five tabs sit at the bottom
  (0010).
- **Help, by default.** Help is off by default and shown through each section's ⓘ (`.help-btn`), so explanations don't
  push figures down the page. Fields follow fields.md: visible help, tied to the field.
- **Sections and cards.** A page is a stack of `details.ledger` sections titled `h2.section-title`, with a total in the
  summary where there is one. Records are `.m-row`s, which open into an editor.
- **Editing.** Opening a row is how a record is edited: Done closes it, Escape or tapping away cancels, and a draft
  that doesn't read is cancelled on close (validation.md).
- **Deleting.** Inside a row editor, Delete is `.btn-danger` and named for the record ("Delete Card one"), and an Undo
  toast follows.

## What isn't: confirmed findings

Counts are from the audit; "390" is the demo household at 390px.

1. **No single primary task per page.** 20 of the 30 pages and subpages have no primary button. Two have several:
   - Spending has "+ Log spend" and "Add trip";
   - Tax → Returns has three ("Open FY25/26" and "Mark as lodged" twice).

   Some primaries belong to a tool rather than the page:
   - Budget's always-open "Add recurring rule" form ends in a primary "Save rule";
   - Property's cash-rate panel has "Record on the loans ticked".

   So the most prominent button is often not the page's main job.
2. **"Add" reads and looks different everywhere.** There are four classes (`.btn.btn-sm`, `.btn-ghost`, `.m-add-row`,
   `.add-card`) and three wording patterns:
   - "+ Add Cash" and "+ Add Other": a category name, capitalised mid-sentence;
   - "+ Add a goal" against "+ Add account";
   - "Add rule" (primary, no "+") against "+ Add category".

   Income shows two "+ Add income" buttons at once.
3. **Empty states don't always offer the next step.** The empty household shows 42 empty-state messages. Classified by
   hand (the script only finds controls nearby, which are often unrelated: Pin, Print, a tab rail):
   - **18 have the control that fills them** beside them, e.g. "No accounts yet." with "+ Add account".
   - **3 need none.** They report that nothing needs doing: "Nothing to fix — every check passes", "Nothing to flag",
     "No changes logged yet".
   - **21 have no next step as a control.** Some name a step on another page with no way to get there: "Add a Gross
     income row with a Person to start a worksheet" (Tax → Returns, Tax → Documents), "add one in Net worth →
     Property" (Investments → Offsets). Some point at something on the page without naming a control: Budget's "No
     flexible lines yet — mark some below", Property's "add one below". Some say only that it's empty: "No expenses
     yet" on Insights, and "Nothing to report yet for this one" on five reports.

   14 of the 21 reports show no message at all for an empty household.
4. **Help still hidden in tooltips.** Visible elements with help only in a `title` (over 40 characters), at 390px:

   | View | Count |
   |---|---|
   | Spending | 27 |
   | Projections | 15 |
   | Tax → This year | 12 |
   | Reports → Month | 12 |
   | Property | 9 |
   | Investments → Summary | 7 |
   | Plan → Scenarios | 5 |

   A tooltip never reaches touch or keyboard (#261 removed these from form fields; these are on figures, chips and
   buttons).
5. **The period chip shows where no period applies.** It sits on Settings and Calculators, where nothing on the page
   follows it. (Accounts and Net worth show balances as of today, but their history charts may follow it. That is
   question 1 below.)
6. **Plan has no "About this page"**; every other page does.
7. **Deletes that aren't `.btn-danger`.** Tax → People's "Remove Alex from tax" is an `.icon-btn` ✕. It is destructive
   (the person's settings go with them) but styled like a dismiss.
8. **Two tab rails on Investments.** Net worth's rail (Overview · Accounts · Investments · Property) sits above
   Investments' own seven tabs. At 390px that is two scrolling rails before any figure. Property and Accounts have the
   outer rail only.

## The contract (proposed)

### 1. Page header

- **What's in it:** title, ⓘ About this page, then up to two page actions in the slot, then the period chip.
- **Page actions are about the page as a whole:** import/export, Arrange. A record's actions live on the record.
- **The period chip shows only where something on the page follows it.** Elsewhere it is hidden.
- **Every page has About this page**, Plan included.

### 2. One primary action per view

- **One `.btn-primary`, for the view's main task.** It is visible without scrolling at 390px: at the top of the page,
  or in the header slot when it's an "add".
- **Everything else is `.btn` or `.btn-ghost`.**
- **A form's submit is primary only inside a dialog or an open editor**, where it's the task in front of the person.
  On the page it's `.btn`.
- **Some views have no primary.** A report, or a view that's only for reading (Net worth's overview), doesn't need one.
- **The header's action button counts.** On a desktop it is the view's primary when it is the page's own add or log
  action and the page shows no primary of its own; otherwise it is a plain button (`lib/help.js`). A phone's round
  button is the same action and is not counted.

### 3. Add, edit, delete

| | Control | Wording | Where |
|---|---|---|---|
| Add | `.btn.btn-sm` with "+" | "+ Add" and the thing, lower case: "+ Add cash account", "+ Add holding", "+ Add goal" | At the end of the list it adds to; the view's primary when adding is the main task |
| Edit | The row itself opens its editor | (the record's name) | In place |
| Delete | `.btn.btn-sm.btn-danger` | "Delete", named for the record ("Delete Groceries") | Inside the editor, last, after Done |
| Remove from | `.btn.btn-sm.btn-danger` if anything is lost, otherwise `.btn-ghost` | "Remove Alex from tax" | Inside the record |

- **Each person's card on Income names its person:** "+ Add income for Alex", beside the page's own "+ Add income".
- **Dense grids may use an icon-only ✕:** a purchase lot, a category, a statement line. It is still `.btn-danger`,
  with an accessible name identifying what it deletes. Category deletes stay visible in quiet ink at rest,
  showing danger ink on hover and keyboard focus; the focus indicator and touch target remain.
- **Every delete is followed by an Undo toast.** Where Undo can't restore everything, the confirm dialog (#256) says
  what will be lost.

### 4. Empty and no-results states

An empty section says three things in one line: what it holds, why it's empty, and the next step **as a control**. That
means a button, or a link to the place the step is done:

> No properties yet. **+ Add property**

> Tax returns start from a pay row with a person. **Go to Income →**

- **No results** (a filter or search that matches nothing) is different from empty. It says what was searched and
  offers to clear the filter.
- **Waiting** (prices being read) and **failed** (a read that didn't work) use the same line, with Retry for a failure.
- **A report with nothing to show** says what it needs ("Log or import a month of spending to see this") instead of
  drawing empty charts.

### 5. Help, data quality, units and dates

- **Explanations:** a section's ⓘ, never a `title`. A figure that needs explaining has it in the section's
  help panel, reachable by touch and keyboard. Exact chart values may retain native hover titles when the same
  figures label the chart for screen readers. These native values remain hover-only on touch; full line and stacked
  charts keep their existing tap tooltip (`wireChartTooltip`).
- **Property portfolio summary:** equity, net cash flow and weighted gross yield explanations live behind
  its heading’s ⓘ. Opening help survives a totals redraw; an empty portfolio hides the summary. Equity/debt
  chart segments expose the same exact value and percentage as their native hover titles to assistive technology.
- **Property-card figures:** one ⓘ beside Figures opens the badge and tile explanations. It includes only
  applicable LVR, gearing, yield and capital-gain explanations, retaining the existing risk wording. Live edits
  update that panel with the figures; an open panel, More detail and focus survive a card redraw. The show-help
  preference applies here too.
- **Property actions:** Record today's value and move-to-loan explanations use local ⓘ controls with linked
  descriptions on the action buttons. Move-to-loan help appears only for an investment property with a loan.
  Open action help survives a redraw; the page's ⓘ explains that loan CSV export covers every property.
- **Property schedules and charts:** the quantity surveyor's schedule explains Division 43/40 behind its ⓘ
  and describes each amount field, including validation errors. Loan and acquisition-cost segments expose the same
  exact name, value and share as their hover title. The depreciation year's basis remains in the visible summary.
- **Income:** the section's ⓘ explains hourly figures for shared income and zero working hours, and hourly
  dashes describe that explanation to assistive technology. Composition segments always name their monthly value
  and share, independent of Show as. The page's ⓘ explains the CSV actions, whose buttons describe those lines.
- **Investments → Summary:** summary-figure and purchase-funding definitions use shared ⓘ controls.
  Funding headers describe their full definitions, including the existing shortfall options, even when help is
  folded. Allocation and today's mix segments expose their exact hover values as accessible names. Portfolio
  liquidity includes Shares; purchase funding uses cash and offsets without assuming investment sales.
- **Basic investments:** recording buttons describe their existing visible field help. A Super row keeps
  its visible estimate qualifier and describes the full method from the page's ⓘ; open method help survives
  list redraws. Vehicle's existing ⓘ explains adding and estimating a vehicle, including its valuation warning.
  Cash, Super, Vehicle and Other composition segments expose their exact hover values as accessible names.
- **Data quality** (estimated, stale, from a statement, missing a figure): a short tag beside the figure, the same
  wording everywhere ("estimate", "as of 3 Nov", "from statement"), in `--ink-soft`. Warnings use `--warn-ink`.
- **Units and basis:** "/mo", "/yr" and "a year" follow the figure. Today's dollars or future dollars, and "FY26/27",
  are said once per section, in its summary line.

### 6. Tab rails

- **One rail per page on a phone.** Investments' seven tabs become the only rail when Investments is open, and Net
  worth's rail moves into the header's back link ("‹ Net worth"), as a record's details page already does.
- **Reports use a searchable chooser.** The 21-report menu has group headings and descriptions; pinned
  shortcuts remain on the page. See [Report picker](report-picker.md) (#260).

## Migration matrix

Proposed primary task and changes per view. "Add" is the item 3 wording; "Empty" the item 4 fix; "Tips" the help left in
`title` tooltips (finding 4).

| View | Primary task (proposed) | Changes |
|---|---|---|
| Home → Overview | — (reading) | Empty: "Add your pay →" stays the next step |
| Home → Insights | — | Empty "No expenses yet" gets a next step; 4 tips; Copy for any AI becomes `.btn` |
| Home → Benchmarks | — | "+ Add target" → "+ Add goal target" |
| Home → Review | Start the review | — |
| Cash flow → Budget | + Add expense | "Save rule" stops being primary (folded form); "mark some below" becomes a control |
| Cash flow → Income | + Add income | Hourly basis and current scenario guidance behind ⓘ; labelled composition values; described CSV actions |
| Cash flow → Spending | + Log spend | "Add trip" stops being primary; 27 tips |
| Cash flow → Bills | — | Empty states link to Spending |
| Net worth | — (reading) | Period chip: see question 1 |
| Accounts | + Add account | Period chip: see question 1 |
| Investments (7 tabs) | + Add … per tab ("+ Add cash account", "+ Add holding", "+ Add super fund") | One rail (item 6); Offsets' empty state links to Property; Summary figures and purchase-funding definitions use ⓘ; allocation/mix values have accessible names |
| Property | + Add property | Portfolio, card figures, actions and depreciation schedule use ⓘ; composition charts have exact accessible labels |
| Tax → This year | — | 12 tips |
| Tax → Returns | The open year's next step: open its worksheet, then Mark as lodged | One primary at a time; empty state links to Income |
| Tax → Documents | — | Empty state links to Income |
| Tax → People | + Add person | Remove from tax → `.btn-danger`, named |
| Plan (all) | — | Gains About this page |
| Plan → Scenarios | + Add scenario | 5 tips |
| Plan → Projections | — | "Keep this as a scenario" stays primary only while a what-if is moved; 15 tips |
| Plan → Goals | + Add goal | "+ Add a goal" → "+ Add goal" |
| Plan → Retirement | — | Empty state when ages aren't set |
| Calculators | — | No period chip |
| Reports (21) | — | The 14 with no message for an empty household, and the 5 that say only "Nothing to report yet", say what they need; Month's 12 tips |
| Settings → Categories | + Add category | — |
| Settings → Preferences | — | No period chip |
| Settings → Rules | + Add rule | "Add rule" → "+ Add rule", `.btn.btn-sm` |

## How it would ship

Each step is its own PR, with the smoke run, journeys, accessibility scan and screenshots at 320, 390 and 1280px.

1. **Header and primaries:**
   - About on Plan;
   - the period chip only where it applies;
   - one primary per view;
   - a test that fails a view with two visible `.btn-primary` buttons (the smoke run).
2. **Add, edit and delete wording and classes,** with a test over the rendered labels (no "+ Add" followed by a
   capital, no delete without `.btn-danger`).
3. **Empty, no-results and report-empty states,** with each next step a control, and a test that every empty state in
   the empty household has one. *Shipped:* every empty state is `emptyStateHtml()` (`lib/empty.js`) — a link to the
   page and tab where the step is done (`go`), the page's own add button (`add`), a scroll to the part of the page it
   means (`scroll`), a button the page already handles (`attrs`), controls that follow it (`beside`), or nothing to do
   (`done`). A report with every figure nothing says what it needs, with a link, in place of its table of $0
   (`REPORT_NEEDS` in components/reports.js). The smoke run sweeps every view of the empty household and fails an empty
   state without its step, or a sentence that reads as one but wasn't made with the builder.
4. **Tooltip help to ⓘ,** view by view, with a test that no visible non-field element carries help in a `title` over
   40 characters. *In progress:* Spending shipped in v3.267.0 (PR #351); Projections shipped v3.268.0 (PR #352), moving basis, source,
   assumptions, range and export explanations to its section ⓘ. Assumption fields describe their help to screen
   readers. Native chart figures retain exact hover values with screen-reader labels; the smoke run checks the
   migrated views. Tax → This year shipped v3.269.0 (PR #353), moving cap, warning and household-setting
   explanations behind ⓘ, preserving visible warnings and labelling waterfall figures for screen readers, including live updates. Reports → Month
   now names its native month buttons with the exact figures and selected state. Separate 44px targets scroll
   locally on phones, with the selected month visible after redraws. Property now uses ⓘ for portfolio/card figures,
   actions and the depreciation schedule, with described schedule fields and labelled composition charts. The
   Property-wide smoke ratchet also checks field titles. Cash flow → Income now explains hourly dashes and
   CSV actions, labels composition values, and points to Plan → Scenarios instead of the removed Vary button.
   Investments → Summary now explains liquidity, property equity and purchase funding through ⓘ, describes
   funding headers and labels allocation/mix values. Cash, Super, Vehicle and Other now link recording actions
   to visible help, explain estimates without hover and name their composition values. The remaining views follow.
5. **One rail on Investments.**

No calculation, stored data or wording of risk information changes. Where a step moves text, the text stays the same.

## Decisions from review (9 November 2026)

The owner answered the four questions this document was waiting on.

1. **The period chip is hidden where nothing follows it**, not kept with a note: Settings, Calculators, and also Net
   worth and Accounts. Checked by driving the app: with the period moved two years back, neither page's text changes,
   and neither module reads the period.
2. **Investments' rail: Net worth's rail becomes a back link** ("‹ Net worth") on a phone, and Investments' seven tabs
   are the only rail (item 6, as written).
3. **Tax → Returns' primary is the open year's next step.** One primary button that follows the year's state: open the
   worksheet while it is being filled in, then "Mark as lodged" when it is ready. Never two at once.
4. **"+ Add" always names the thing,** lower case: "+ Add holding", "+ Add goal", "+ Add cash account" (item 3, as
   written).
