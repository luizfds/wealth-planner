# Assessment follow-up — November 2026

The app review identified data-loss paths, conflicting settlement figures, misleading labels and usability friction.
This change addresses those findings together, with invented data throughout. It does not merge or deploy the PR.

## Behaviour and regression evidence

| Finding | Change | Regression |
| --- | --- | --- |
| Reload drops an edit during the 300 ms debounce | Save synchronously before returning; notify sync and activity listeners only after successful storage writes. | Fresh-device unit test reads storage immediately; browser edits and reloads in the same task. |
| A stale tab overwrites a newer household | Check the saved revision before every write and on storage events. Stop stale writes; retain the in-memory copy and show a persistent download/reload recovery banner. No silent last-writer choice or automatic merge. | Unit cases cover stale saves before event delivery, storage clearing, quota errors and listener behaviour. Two-tab browser journey verifies the newer save, the unsaved recovery file, and reload. |
| A sample-data URL overwrites existing data | Confirm replacement, including households containing only accounts, income received, transfers, goals or recurring rules. Remove the sample query even after cancellation. Recheck setup eligibility when its delayed opener runs. | Browser journey declines and accepts replacement, checks sparse households, and confirms sample data does not open empty setup. |
| Settlement warning and comparison disagree | Plan, Can we buy and Investments use `drawFor` cash and offsets, excluding unsold shares. Show funding status, remaining cash and the funding assumption; unfunded comparisons withhold cash-survival odds. | Synthetic calculation regression compares against Can we buy and changes a share valuation without changing available settlement cash. Render and browser checks cover status, disclosures and the legacy Investments table. |
| Failed backup clears the reminder | Stamp the prepared file but update the saved household only after download handoff or successful sharing. Cancellation and encryption failure do not count. Recovery files never mark the saved household backed up. | Six unit cases include cancellation, declined download, successful plain/encrypted export, encryption failure and unsaved-copy recovery. Browser adds native-share cancellation and success. |
| Tax so far contains annual estimates | Name annual tax or estimated tax return explicitly; keep the seasonal lodgement tile. | Browser verifies the annual-tax label on the fixed-date household. |
| Interrupted view transitions reject their promises | Handle expected AbortError on ready/finished, preserving newest-navigation-wins and logging other failures. | Existing onboarding/keyboard journeys, all-view smoke and rapid-navigation flows complete without browser errors. |
| Accessibility and small controls | Give notification counts an accessible name; enlarge recurring disclosures and stress inputs. Label the main action and give its white text a stable contrasting fill. | Full smoke measures phone targets; axe 4.14.0 checks both themes and widths, plus 320px reflow. |
| Home puts the recap before current finances | Current cash flow first; keep monthly surplus and essential cash coverage near actuals. Add logged-period and recorded/stale-value context; collapse the weekly recap. Preserve saved card arrangements. | Render coverage and browser assertions check order, labels, disclosure and the Log spending action. Phone/desktop screenshots inspected. |
| Dense scenarios imply lending certainty | Put funding and monthly feasibility first; move long-term results into a keyboard-operable disclosure. Rename lending language to indicative serviceability. | Render and browser regressions; both comparison regions remain named and keyboard-scrollable. |
| Download CSV may open a share sheet | Download always downloads; offer Share CSV only when supported. A failed share falls back to download. | Browser exercises download with native sharing available, explicit share payload and failed-share fallback; CSV values/metadata still match the report calculations. |

The existing transaction review queue, reconciliation tools, saved filters and money-weighted investment explanations
are retained. The review's professional-app references inform hierarchy and clarity; this is not an expansion into
bank feeds, a new budgeting model or a different investment-return calculation.

## Validation

- 1,258 unit tests, including 12 added regression tests, pass.
- ESLint, custom rule self-tests, TypeScript checking and stylelint pass.
- Full page smoke: all views/subtabs, 390px and 1280px, light and dark, plus the empty household and scenario editor.
- 18 end-to-end journeys pass, including the three new safety/backup/UX journeys.
- Performance budget passes on 3,186 synthetic transactions at 4x CPU slowdown: startup 322 ms (8,000 ms budget),
  transfer 80 ms (2,000 ms), scenario change 312 ms (1,500 ms); transfer is 28% of a full redraw (60% ceiling).
- Axe 4.14.0: 64 states at 390/1280px in both themes, and 16 additional 320px light states: zero violations,
  measured contrast failures or page overflow. CI's pinned axe version is updated to match this run.
- Coverage is measured, not represented as 100%: Node's whole-source report is about 76% line coverage; browser
  journeys cover DOM/event/OS-boundary behaviours that this Node metric does not execute.

## Limits

Storage uses an optimistic revision guard rather than automatic cross-tab merging. A stale tab requires an explicit
recovery download and reload; its writes do not resume until reload. localStorage does not offer atomic compare-and-swap.
If writes race, storage events expose the divergence and each tab retains its in-memory copy for recovery.

A browser download can confirm handoff, not whether the user kept the file or their disk subsequently failed.
Actual native sharing, Safari/iOS, physical-device touch and screen-reader use still need device validation; native
share outcomes are simulated in regression journeys. Tests and screenshots are evidence for the exercised behaviours,
not a guarantee against all regressions or a WCAG certification. No real personal backup was opened.

CI screenshot review also caught a desktop header wrap from the longer planned-surplus label. The header now uses
a compact “Planned /mo” label with the full meaning in its title; a 1280px Investments journey measures title/actions
alignment. The same review found and corrected the remaining Investments purchase-funding table, with a pure HTML
builder regression and cross-page numeric assertions. These follow-ups are included in the same PR.
