# 0009 — CSS in explicit cascade layers

**Decided:** v3.207.1 (item 238).

**Context.** The stylesheets were one monolith split into eight `@import`s, and which rule won between files depended
on the import order and on specificity. Moving one `@import` line could silently flip an override; a phone-only rule
lost to a page's rule because it came earlier (the bills-to-confirm bug, v3.200.1).

**Decision.** `styles.css` declares `@layer base, layout, components, pages, utilities, phone` (pages one per file,
`pages.dashboard`, `pages.income`…) and imports each stylesheet into its layer. Between files the declared order
decides; inside a file it's specificity, then source order. `utilities.css` holds overrides meant to win over any page
(the room a section header makes for its ⓘ); `phone.css` the ≤880px floors (44px tap targets, bottom sheets, a list's
sticky total, swipe, pull to refresh, 16px text fields).

**Consequences.**
- A rule that adjusts another file's rule goes in that file, after it, or in a later layer — not a more specific
  selector.
- `!important` reverses layers: an earlier layer's `!important` beats a later one's. The phone floors are
  `!important`, so no page sets `min-height`/`min-width` `!important`; the quick log's headline size wins over the
  16px floor that way on purpose.
- Unlayered CSS beats every layer — only `index.html`'s loading screen is unlayered.
- Inside one file, a `@media` override still has to come after the rule it overrides: same layer, same specificity,
  source order decides.

**Checked by:** `tests/layers.test.js`. The move itself was checked element by element: every computed style matched
main across 200 views, 64 open states and printing, and again with the imports reversed.
