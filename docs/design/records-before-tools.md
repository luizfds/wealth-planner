# Records before tools (#306, #259)

Status: navigation choice implemented for review; Spending choice pending. List toolbars are the next PR.
Roadmap: Simplify and finish, step 3; also #255 step 5.

## Proposed interaction

- Each affected list has one toolbar: title and total, Filters (with an active count), and a labelled actions menu (⋯).
- Applied filters remain readable beside the summary, with Clear; the default state adds no extra row.
- Shares: move person, winners/losers, sort and price range into Filters. Move prices and trade import into actions. Keep the day's gain in a short summary.
- Super: put person selection in Filters and keep its summary to one line.
- Spending: keep Search directly accessible; move period, transaction type and advanced filters into Filters. Move bulk selection and transfer creation into actions. Keep In/Out/Net in one summary line. Saved views and deep links still populate the same filters.
- Property: retain step 2's cash-rate dialog and quiet rate line; align its list toolbar with the other lists.
- On phones, Investments has the already-agreed “‹ Net worth” back link and only its own section navigation.

## Choices for review

1. Agreed: replace a rail that cannot fit with one labelled section picker showing the current section. Keep tabs where they fit. Apply to section rails, property editor tabs and range controls; no sideways swipe and no reduced touch targets.
2. Spending's quick controls: recommend Search plus Filters, with transaction type and period inside Filters. Alternative: keep All / Spending / Money in / Transfers directly visible as an additional segmented row; put period and other filters inside Filters. This step moves the existing period control without changing its meaning (#307 remains separate).

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
