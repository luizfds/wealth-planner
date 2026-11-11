# Records before tools (#306, #259)

Status: navigation choice agreed; shared navigation implementation in progress. Spending choice pending.
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
