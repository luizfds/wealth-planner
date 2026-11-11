# Mobile report summaries (#258)

Status: recommended interaction approved by the owner; shared Reports implementation complete; awaiting PR review. Roadmap step 4; report chooser shipped v3.247.0 (PR #322).

## Approved interaction

Below 768px, replace the default report table with compact, labelled rows. Each row shows its name and
up to three important figures. A Details disclosure reveals remaining fields vertically; values and labels
wrap within the available width. Preserve section headings, totals, comparison context and existing links
into month detail and spending transactions. Do not make the whole row a conflicting nested button.

Show a Summary / Full table control on phones. Full table is an explicit comparison mode with its title,
a visible horizontal-scroll instruction and a focusable, labelled scroll region. Desktop keeps the table.
Changing this display mode is session UI only and does not change stored data, the report frame or pins.
CSV and print retain the complete existing table. Assumptions and data-quality notes stay available in both modes.

Priority examples (use the exact existing column labels and formatting):

| Report | Figures shown before Details |
| --- | --- |
| Investment returns | Value, Total return, A year with income |
| Loans and debts | Owed now, monthly repayment, payoff outcome |
| Super | Concessional, remaining cap, balance |
| Capital gains | Gain, taxable gain; parcel dates in Details |
| Net worth check | Expected change, actual change, gap; components in Details |
| Spending and budget | Actual, comparison, variance when available |

Use report-specific column priorities, never infer importance from a currency amount or position alone.
Every cell remains accessible, including blanks, percentages, totals and long labels. Property P&L, property
returns and tax summary offer a property/person selector so each entity reads vertically. Date columns stay
in Details after the report’s totals/comparison figures.
Month in detail and the year-end checklist already have specialised renderers: review them separately rather
than forcing the common table pattern onto them.

## Scope and validation

First PR: common Reports renderer and its drilldowns. Keep #258 open for scenario comparison, projection
milestones/tables, spending heatmap and investment-summary comparison; migrate those in separate PRs.

Use synthetic data only. Test 320/390/768/1280px, both themes, long labels and empty reports. Assert no
horizontal scrolling in default summaries, all original cells in expanded detail, matching currency/percentage
formatting, retained month/group actions, keyboard operation and no hidden duplicate focus targets.
Measure both default and full-table layouts in a real browser. Check complete print/CSV output and relevant
journeys, static checks and accessibility; let CI run the full suite once.

## Verified implementation

- All 19 reports using the shared renderer have phone summaries below 768px. Month in detail and the
  year-end checklist retain their specialised renderers for follow-up review. The spending transaction
  drilldown wraps its existing three columns within the phone width.
- Browser cell-parity checks cover all 19 reports and each property/person option. Percentage, zero,
  negative and blank values share the same formatter as the table; empty values read as an em dash.
- Pinned frames, month and spending actions, Details keyboard/focus restoration through redraw, entity
  selection focus and the keyboard-scrollable Full table are covered by focused journeys.
- Measured with long synthetic holding labels: investment summary client/scroll widths are 254/254px
  at 320px and 324/324px at 390px. The optional full table retains its complete 1392px width. Desktop
  keeps the table at 768/1280px. No document overflow in either theme at all four widths.
- 24 focused axe scans (default, expanded Details, full table; four widths and both themes) found no
  violations. Long property labels and multiple property options were also inspected in all eight layouts.
  Screenshots and measurements are session artifacts under `/tmp/mobile-report-review/`.
- Local static checks, unit tests, full page smoke and reportsummary/reportchooser/reportaudit/assessmentux
  journeys pass. CI accessibility now includes investment/property reports and expanded/full-table states.

Remaining #258 work: specialised Reports layouts, scenario comparisons, projection milestones/tables,
spending heatmap and investment-summary comparison. This PR does not close the issue or complete roadmap step 4.
