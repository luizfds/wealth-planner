# Records before tools (#306, #259)

Status: navigation shipped v3.245.0 (PR #320). List toolbars shipped v3.246.0 (PR #321).
Roadmap: Simplify and finish, step 3; also #255 step 5.

## Proposed interaction

- Each affected list has one toolbar: title and total, Filters (with an active count), and a labelled actions menu (⋯).
- Applied filters remain readable beside the summary, with Clear; the default state adds no extra row.
- Shares: keep the price-change period beside gain/loss for quick checks; put person, winners/losers and sort in Filters. Move prices and trade import into actions.
- Super: put person selection in Filters and keep its summary to one line.
- Spending: keep Search directly accessible; move period, transaction type and advanced filters into Filters. Move bulk selection and transfer creation into actions. Keep In/Out/Net in one summary line. Saved views and deep links still populate the same filters.
- Property: retain step 2's cash-rate dialog and quiet rate line; align its list toolbar with the other lists.
- On phones, Investments has the already-agreed “‹ Net worth” back link and only its own section navigation.

## Choices for review

1. Agreed: replace a rail that cannot fit with one labelled section picker showing the current section. Keep tabs where they fit. Apply to section rails, property editor tabs and range controls; no sideways swipe and no reduced touch targets.
2. Agreed: Spending keeps Search plus Filters, with transaction type and period inside Filters. Search opens its field directly from the toolbar. This step moves the existing period control without changing its meaning (#307 remains separate).

## Delivery and verification

Implement in coherent PRs: shared responsive navigation first, then list toolbars. Reuse current overlay, focus and navigation infrastructure. No financial or stored-data changes.

- Measure current default demo layouts before implementation and capture before/after screenshots at 320, 390 and 1280px, both themes.
- First records on Shares, Super, Spending and Property must begin above y=422 at 390×844 and y=400 at 1280×800. Add explicit first-record smoke checks using these half-screen thresholds.
- Preserve every tool, selected destination, browser back/forward, saved Spending view and filtered deep link. Check touch and keyboard access, focus return and selected-state announcements.
- Run unit/static checks, smoke, relevant journeys and accessibility scans. Check for local navigation overflow as well as document overflow.

## Navigation measurements

Chromium, synthetic demo household, 390px viewport. Widths are the content and the available space within each rail.

| Control | Before | After |
|---|---|---|
| Investments sections | 486px in 358px | Picker, 358px in 358px |
| Shares price range | 374px in 322px | Picker, 322px in 322px |
| Property sections | 450px in 309px | Picker, 309px in 309px |

At 320px the same controls fit their available space; at 1280px they retain tabs. Before/after screenshots captured
at 320, 390 and 1280px in both themes. The smoke run now checks local navigation overflow, not just document overflow.
The section-picker journey covers keyboard selection, Back, resize, property panels and focus after a range redraw.
Testing found that Offsets had no URL slug: it displayed but wrote `/assets/summary`. It now uses `/assets/offsets`
so restoring history selects the same section.

## List toolbar implementation

Shares and Super have one header with title, total, Filters and tools. Person selection is inside Filters on those
two views; Shares also keeps gain and sort there. Its price-change period stays beside gain/loss. Counts and a readable applied-filter line remain
outside the panel. Prices and broker import open from the tools menu. The gain breakdown and contributions are
retained below the records. Property's cards now precede the statistics, equity bar and history chart, and its
loan export is in the list's toolbar.

Spending has Search, Filters and tools in its header. Search opens its field directly; Filters holds type, scope,
saved views and the existing advanced controls. The menu holds bulk selection, transfer creation and list/table
choice. Active filters stay visible. Clear also restores the default Month scope. The date scope's meaning,
saved-view format, calculations and stored data are unchanged. The existing transaction explanation moved to
the page's About text.

First record positions on the synthetic demo household, unchanged main v3.245.0 versus this implementation:

| List | 390×844 before → after | 1280×800 before → after |
|---|---|---|
| Shares | 860 → 362px | 750 → 349px |
| Super | 700 → 335px | 658 → 322px |
| Spending | 597 → 402px | 461 → 382px |
| Property | 1148 → 360px | 908 → 339px |

The smoke run enforces the half-screen limits (422px and 400px) before opening disclosures for its expanded-state
checks. Screenshots were also captured at 320px and in both themes. The new `recordtools` journey covers keyboard
menu access, applied filters, clearing, price/import panels, unchanged holdings after reading trades, Super's
person selection, saved-view save/cancel/restore, `data-sv`, search, bulk selection and transfer focus.

### Accessibility coverage and existing findings

The existing whole-page/editor scan remains, with Property added. New checks explicitly scan the Shares toolbar,
its open filters and price/import panels, Super filters, and Spending filters/search. These scoped Shares checks
do not certify the whole Shares page.

A broader exploratory Shares scan found existing problems on unchanged main too: the performance table's ARIA
rows lack cell roles, holding rows contain nested Details buttons, and holding-avatar initials have insufficient
contrast. Small Details targets are also flagged at 320px. These are recorded as follow-up work rather than
changing holding-row interactions or the financial table in this toolbar change.

## Shares quick price-change review

The owner reviewed and approved bringing Change out of Filters: always visible beside gain/loss, with the
shared native picker on narrow screens and range buttons where they fit. Implementation on
`codex/shares-change-review`. Person, gain and sort stay in Filters; the period is excluded from the active
count/applied-filter line, and Clear preserves it. Keep all eight ranges, price-history rules, year basis,
missing-history behavior and session-only state unchanged.

Place the existing time-range control beside `#sharesGlance`, so live quantity/price edits patch only the
summary and retain the period control. A compact native picker uses a 75px rail and 44px target, with no
second track border. No horizontal navigation or reduced targets. The first holding remains above the
half-screen limits at 390×844 and 1280×800. At 320px the summary wraps while both controls remain visible.

The `sharesquickperiod` touch journey checks every range without opening Filters, gain/loss refresh, focus
after redraw, Clear independence, filter count, idle picker stability, responsive bounds/first-record
position, desktop buttons and unchanged saved holdings. Existing `sectionpickers`, `recordtools` and
`mobileinvestments` journeys pass. Screenshots cover 320/390/768/1024/1280px in both themes; review artifacts
are under `/tmp/shares-period-final/` (not committed).
