# Mobile report summaries (#258)

Status: recommended interaction approved by the owner; shared Reports shipped v3.248.0 (PR #323); scenario comparison shipped v3.249.0 (PR #324); projection tables implemented; awaiting PR review. Roadmap step 4; report chooser shipped v3.247.0 (PR #322).

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

## Scenario comparison follow-up

Use the approved summary/Details/Full table pattern below 768px. A labelled scenario selector defaults to
the current household. Funding status, cash left after settlement, after-tax monthly cash and stressed monthly
cash lead. Details reveals settlement costs, pre-tax cash and lender checks with the existing assumptions.
Long-term results retain their existing disclosure, funding qualifications, simulation assumptions, year labels
and deltas against the current household. Display the selected scenario’s verdict beside its figures.

The optional full table retains every scenario and the existing comparisons on desktop and phone. Selection
and mode are session UI only. Use the same metric markup for both views and calculate survival odds once per
scenario, updating both representations together. Redraw preserves selection, disclosure and keyboard focus;
removing a selected scenario falls back to the current household.

Month in detail and the year-end checklist use specialised lists/disclosures, with no table markup to replace.
Their layout still receives ordinary page smoke coverage. Projection tables, heatmap and investment-summary
comparison follow in separate changes; keep #258 open.

### Scenario comparison verification

- Shared metric markup preserves every table value, help text, warning, year label and baseline delta.
  The browser journey checks each scenario field against the complete table after odds are filled in.
- Selection and Details focus survive redraw; missing selections fall back to the household. Display controls
  do not change stored data. The table remains available for keyboard horizontal scrolling and desktop use.
- At 320px the summary client/scroll widths are 254/254px; at 390px they are 324/324px. The optional
  table keeps its 520px comparison width. At 768/1280px the table fills 694/966px respectively.
- Default and expanded states, long names and full-table mode were reviewed at all four widths in both
  themes. 24 focused axe scans found no violations. Session screenshots and measurements are under
  `/tmp/mobile-compare-review/`.
- Focused scenariosummary/assessmentux/keyboardaudit/replacedhousehold journeys pass. The accessibility
  CI script now covers selected scenarios, expanded details and full-table mode.

## Projection tables follow-up

Apply the approved pattern below 768px to the milestones grid and the selected-year net-worth table.
One scenario selector includes all currently charted series, including labelled illustrative stress lines and
what-if previews. Show net worth today, at the horizon and when loans are gone. Details includes every other
table year and the first year each milestone is reached. Keep dollar basis, overtaking commentary and stress
qualifications available. Full table shows both complete comparisons; desktop and print retain the tables.

Use the chart’s existing points and milestone calculations, with no new financial maths or stored settings.
Scenario selection and display mode are session UI. Preserve selection and Details focus through output
redraw; if a scenario disappears (including disabling a stress line), fall back to the current household or
first available series. Short horizons must not duplicate the current/final year. Empty series must render
without a selector or broken table. CSV still exports every year of every plotted series with its components.

Verify phone summaries against the table cells and milestone outputs, including short/long horizons,
real/future dollars, stress lines, what-if previews, long names, redraw, keyboard and CSV. Review default,
expanded and Full table at 320/390/768/1280px in both themes. Projections’ existing chart, headline, assumptions,
sliders and calculation behavior stay unchanged.

### Projection verification

- Phone summaries match every selected-year table cell, milestone target and loan-payoff label for each
  plotted scenario. The journey covers 1/7/50-year horizons, today’s/future dollars, illustrative stress and
  what-if series, disabled-selection fallback, keyboard selection/scrolling and focus through redraw.
- CSV download is checked against every charted series/year and all six exported columns. Print keeps the
  full tables. Display controls do not change saved data; horizon/basis edits retain their existing behavior.
- At 320/390px, summary client/scroll widths are 254/254 and 324/324px. The optional year table retains
  519px and milestones 384px inside their bounded scroll regions. Desktop tables fill 692/964px at
  768/1280px. No page overflow in either theme with long scenario names.
- 24 focused axe scans cover default, expanded Details and Full table at four widths in both themes, with
  zero violations. Session screenshots/measurements: `/tmp/mobile-projection-review/`.
- Static checks, unit/render tests and projection/plan-validation/scenario journeys pass. Accessibility CI
  now includes Projections with expanded Details and full tables. Empty short-horizon disclosures are omitted.

Remaining #258 surfaces after the projection PR: spending heatmap and investment-summary comparison.
The issue and roadmap step 4 remain open until those are reviewed and migrated.
