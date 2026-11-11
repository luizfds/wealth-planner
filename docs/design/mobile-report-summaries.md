# Mobile report summaries (#258)

Status: interaction proposed for owner review. Roadmap step 4; report chooser shipped v3.247.0 (PR #322).

## Proposed interaction

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
| Net worth check | Current balance, change; earlier dates in Details |
| Spending and budget | Actual, comparison, variance when available |

Use report-specific column priorities, never infer importance from a currency amount or position alone.
Every cell remains accessible, including blanks, percentages, totals and long labels. Reports with dynamic
property/date columns need explicit handling so their first column is not incorrectly treated as a metric.
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
