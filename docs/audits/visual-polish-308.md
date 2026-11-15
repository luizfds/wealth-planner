# Visual polish closeout — issue #308

The original review assessed v3.236.10 (`770b8a5`). The items below are resolved across the linked PRs and this final date-display pass. No financial calculation or saved schema changes are introduced by this closeout.

| Original finding | Resolution and regression evidence |
| --- | --- |
| Home and notification dates | #362 formats the recorded-balance date. This pass formats the remaining report, review, received-income, property-history, bank/loan and overdue-card date labels, including accessible names. `homedates`, `displaydates`, formatter/render tests and the page smoke date inventory cover them. |
| Stretched Home cards, one-goal wrapper, tall collapsed recap | #365 sizes cards to content, removes the redundant goal wrapper and compacts the collapsed recap. `homebalance` measures heights, expansion and unchanged financial data. |
| Debt shown as error red and bold-red surcharge note | #363 uses chart-palette debt and normal-weight warning ink, preserving amounts and warning wording. `financialcolours` checks normal and live-patched notices in both themes. |
| Repeated red category deletes | #364 keeps actions quiet at rest and uses danger colour on hover/focus. `categorycolours` and `categories` retain names, keyboard focus, deletion and Undo. |
| Sidebar paragraph and duplicate version/update actions | #366 leaves the local-storage/backup line, with the full privacy explanation and version/update actions in Preferences and the avatar menu. `sidebarfooter` checks the actual actions and preserved privacy wording. |
| Two names for notice strips/panel | Superseded by #305: the strips were removed in favour of one-line counts opening the bell. The remaining full panel is **What the app notices**. The smoke check rejects a reintroduced `.adv-strip`; there is no second strip heading to rename. |
| Oversized report-chart axis labels | #367 fits SVG text to measured CSS width and reduces crowded phone labels. `reportlabels` checks resizing, reopened views, shared Detail charts, print sizing and unchanged figures. |

## Date policy and explicit exceptions

System-generated calendar labels use `fmtDate`; historical dates include their year. Inputs, saved dates, calculation inputs, checklist identities and machine-readable exports retain ISO values. Literal source filenames/text and copied diagnostic records retain their original format. In particular, the device error log keeps its diagnostic timestamps: this is an explicit exception to a literal ban on every ISO string outside an input, so copied records can still be matched to their original log.

The default/expanded synthetic-demo smoke pass rejects visible raw display dates outside those source/technical exceptions. `displaydates` additionally exercises conditional histories, statements, receipts and review states at 320/390/768/1280px in both themes, with unchanged saved values, totals and projections. It fails on released v3.277.6. Report metadata exports and date inputs are checked independently; a literal ISO filename/note is preserved. The new bank-preview scan also caught a skipped heading level; its subsection headings now follow the card heading without changing their styling. Its closing-balance label also groups the explanatory text so dates and amounts wrap beside the native checkbox at 320px.

## Before and after photographs

`scripts/polish308-shots.mjs` photographs the same invented household on the original `770b8a5` baseline and the PR checkout, with a fixed 3 November 2026 clock, live prices/rates disabled, and one goal. It captures Home, the bell, Property, Tax, Categories, Preferences and the cash-flow report at **390×844 and 1280×800, light and dark**: 28 images per checkout. Each set includes a manifest. The old baseline predates other merged work; comparisons judge the named presentation findings rather than every intervening feature change.

The existing `screens` CI job generates and uploads these sets as `polish-308` when this audit report changes. Ordinary PRs keep their existing screenshot workflow. The expanded date-state images are separate accessibility artifacts under `display-dates`.

To reproduce locally after archiving the baseline checkout:

```sh
POLISH_ROOT=/tmp/wealth-polish-original POLISH_SHOTS=/tmp/polish308-before node scripts/polish308-shots.mjs
POLISH_SHOTS=/tmp/polish308-after node scripts/polish308-shots.mjs
```

Validation uses synthetic data only. Chromium emulation and axe do not certify physical devices or screen readers; that remains #299. The date-state and existing polish journeys, page smoke, unit/static checks and CI must pass before this PR is marked ready.
