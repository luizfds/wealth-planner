# 0007 — Pages drawn when seen; an edit redraws only what reads what it touched

**Decided:** v3.205 (item 236a), v3.206 (item 236b).

**Context.** A full redraw drew every page into its hidden section — about a second on a phone with a real household —
at startup and after most edits; saving a transfer took as long as a full redraw.

**Decision.** Every part of the full redraw is a *view*: `defineView(name, pages, draw, reads)` in `defineViews`
(`components/redraw.js`, registry `lib/views.js`). `renderAll()` draws the page on screen and what's on every page;
the rest is left stale and drawn by `drawStale(page)` just before nav.js shows that page. Each view says which pages it
draws into (measured, not guessed) and which top-level keys of `state` it reads (`"balances"` for money moved in an
account, loan or offset; `["*"]` for anything). `commit(touched)` redraws the views reading what it touched — on screen
now, the rest when opened.

**Consequences.**
- An edit's `commit` *is* its redraw: no hand-written list of render calls after it. An edit's own partial redraw
  uses `redraw([names])`, never the render functions directly.
- A new part of the full redraw is a new `defineView` with its pages (`null` = every page) and its reads.
- A scenario change redraws the scenario views once; the projection chart goes through `renderProjectionsWhenSeen()`.
- The bell and the Checks badge are `later` views: drawn once, just after the edit.

**Checked by:** the speed budget in `scripts/journeys.mjs` (a transfer under 60% of a full redraw, at 4× CPU), and
`tests/views.test.js`.
