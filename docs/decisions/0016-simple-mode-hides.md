# 0016 — Simple mode hides parts; it never draws a page another way

**Decided:** step 5 of the simpler-navigation plan (#409, #414), approved by the owner.

**Context.** People found the app hard to find their way around: most pages carry tools a household uses a few times a
year beside what it uses every week. A Simple/Advanced switch was asked for. The app had a mode once before — Classic
and Modern, two renderings of every page under `state.uiMode` — and removed it because each change had to be made twice
and the two drifted apart.

**Decision.** A part used now and then — a tab, a link, a tile, a fold, a menu row — carries `data-level="advanced"`.
In Simple mode one rule in the `utilities` layer hides it (`html[data-mode="simple"] [data-level="advanced"]:not([data-shown])`).
No component reads the mode to draw itself differently; the exceptions are choices of *which* entries a list offers
first (the report chooser's everyday five, with "Show all") and which tab Plan opens on. What is marked is an entry
point or a secondary section, never a view, so a notice, a link or search that goes to an advanced view still opens
it. "Show more on this page" (`components/showmore.js`) brings a page's parts back until it is left. Calculations never
change: every total counts everything.

The mode is kept per device in `localStorage` (`wealthPlanner.mode`, `lib/mode.js`), like the tour: a partner on
another device can choose differently and sync doesn't carry it. The first time a version with the switch opens, a
household with something in it starts Advanced (nothing it used disappears) and a new one Simple.

**Consequences.** To put something away in Simple, add `data-level="advanced"` to its entry point — never a branch on
the mode. The smoke run checks Simple at 390px: nothing advanced shows, and where a page has some put away it offers
"Show more on this page", which brings every one back. The journeys, smoke and accessibility runs otherwise start in
Advanced, so they see everything.
