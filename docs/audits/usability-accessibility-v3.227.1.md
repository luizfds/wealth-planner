# Usability and accessibility follow-up for v3.227.1

Date: 2026-11-06. Baseline: main `3629ae8a74a5b9858a1579b114f65fd801969170`.
Only invented profiles and the repository's synthetic demo household were used. No private backup or real financial account was accessed, imported or uploaded. No merge or deployment was performed for this follow-up.

## Findings and fixes

| Finding | Evidence | Change and regression coverage |
| --- | --- | --- |
| Guided setup allows Tab to escape its modal | The new `keyboardaudit` journey failed on v3.227.1: `Tab escaped the setup dialog`. | Keep forward/backward Tab inside setup; make background siblings inert while open and restore their previous availability on close. |
| Setup can lose focus after a type change or closing | Changing a select rebuilds its DOM. Background redraws can replace the button that opened setup. | Preserve the focused field through rebuilds, return focus to the opener or its visible replacement after closing, and expose progress as a live status. Browser regression verifies type edits, Escape and restored background interactivity. |
| Account type text is clipped in the compact phone row | Inspected the 390px setup screenshot: selected labels such as Everyday and Savings were truncated. | Place the name on its own row below 480px so type, balance and delete retain useful widths. Browser test measures picker width; inspected the revised 320px screenshot with full labels. |
| Wide comparison/report tables are inaccessible to keyboard scrolling | axe reported `scrollable-region-focusable` at phone width; first column headers were empty. | Add named, focusable scroll regions and nonempty headers. Browser regression actually scrolls both tables using ArrowRight. Financial calculations and CSV values are unchanged. |
| Entry pages have no main landmark; Insights skips heading levels; toasts are not announced | Baseline axe reported landmark, region and heading-order findings. | Add main landmarks, correct heading levels and give the toast container a polite live status. |
| Single-character notification badge misses text contrast | axe marked this undecided. Supplemental measurement found white on `rgb(239,68,68)` at **3.763:1**. | Use a stable dark-red badge token in both themes (white contrast **6.47:1**). The scan explicitly measures short-text badges, glyph controls and SVG chart labels so this failure cannot hide among axe's incomplete findings. |

The initial axe scan covered 40 states and found violations in 24 of them: 64 affected nodes across five rule types. This complements the existing page smoke tests: rendering correctly and fitting the viewport did not prove correct landmarks or keyboard behavior.

## Walkthrough and repeatable evidence

- Onboarding: cancellation and finishing partial profiles, all five setup steps, progress/name semantics, focus containment, focused select rebuild, Escape and focus restoration.
- Dashboard: Overview and Insights on the synthetic household; no invalid figures, correct progressive disclosure and risk information. The prior report/calculation consistency tests remain in place.
- Scenarios: shared calculations retained; table naming and actual keyboard horizontal navigation verified.
- Recurring rules: explicit approval/cancellation, duplicate prevention, type/category changes, pause/delete, history preservation and local persistence remain covered by journeys.
- Reports: cash-flow and net-worth views, keyboard disclosure and scrolling, actual CSV download, CSV values matching the report builder, and visible print disclosures remain covered by journeys.
- Layouts: 390px phone and 1280px desktop, both light and dark; additional 320 CSS-pixel reflow check. Phone contexts in the accessibility script enable touch/mobile emulation. The full page smoke suite also measures control sizes, overflow, invalid numbers and browser errors across all app views.

`node scripts/accessibility.mjs` scans **60 states**: ten key views/forms plus the five setup steps, across two widths and two themes. It runs WCAG 2/2.1/2.2 A/AA axe tags and best-practice checks, measures page overflow, and checks contrast for short text/glyph/SVG cases. `A11Y_WIDTHS=320 A11Y_SCHEMES=light` runs 15 additional narrow states. `A11Y_DIR` writes detailed JSON, browser accessibility-tree snapshots and representative screenshots. The new CI accessibility job installs pinned Playwright 1.56.0 and axe-core 4.10.3 as check tools only and uploads these artifacts; no application dependency was added.

Local verification during development: the expanded 60-state axe scan passed with zero violations and no page overflow; the 320px scan passed all 15 states. The badge contrast probe separately reproduced the 3.763:1 failure and the final token was changed. Final contrast-inclusive scan and CI results are recorded in the draft PR so they refer to its final commit. Lint/types/styles and 1,246 unit tests passed; the 15-journey suite including the performance budget passed. Focus/keyboard regression passed after the final mobile layout adjustment.

## Limits and next priorities

This is browser and accessibility-tree testing, **not an actual screen-reader or physical-device session**. No VoiceOver, TalkBack, NVDA or Orca is available in this environment, and no physical iOS/Android device is connected. A WebKit download was attempted, but the host lacks its required shared libraries; no WebKit/Safari pass is claimed.

Axe's incomplete results are preserved, not silently treated as passes. The period picker references an existing hidden `periodMenu` dialog; its incomplete ARIA reference was checked against the markup. Other incomplete contrast findings include gradients, obscured/offscreen content, glyphs and SVG labels. Supplemental opaque-background measurements cover the short-text/glyph/SVG cases; gradient/overlap findings still need visual/assistive-technology review. Zero violations is not WCAG certification.

Recommended next work, in priority order:

1. Review this patch and the visual/accessibility artifacts, then repeat onboarding, scenario-table navigation and report export on an actual phone with VoiceOver/TalkBack and desktop NVDA. Verify spoken progress, labels, focus return, native account-type pickers and zoom/reflow.
2. Check undecided gradient/overlap contrast and actual touch target comfort on those devices; record any remaining defects separately rather than assuming automated scans cover them.
3. Use observed task completion and friction from these walkthroughs to choose the next product improvement before expanding feature scope.

Keep the implementation in a draft PR for review. Merge and deployment require explicit owner approval; this repository automatically releases and requests a Pages rebuild on merge.
