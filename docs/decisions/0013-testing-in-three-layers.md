# 0013 — Testing in three layers, and what each can't see

**Context.** A fully green suite twice sat on top of a page that did not render at all — a function imported from the
wrong module, a variable out of scope. Both passed `node --check` and every test; both were found by opening a browser.

**Decision.** No test framework, no dependencies (`node --test`). Three layers, each knowing what it can't see:
1. `tests/*.test.js` over `calc/` — the arithmetic, deep, no DOM.
2. `tests/render-smoke.test.js` — the pure HTML builders called with fixtures. A new function that builds HTML from
   data is added here.
3. Driving the app (Playwright) — the only layer that sees event wiring, the cascade, layout and anything reached
   through `document`. In CI: `scripts/smoke.mjs` opens every page and subtab at 390/1280px, light and dark, and an
   empty household, failing on errors, empty pages, sideways scroll, NaN, a 0-width bar or a tap target under 44px;
   `scripts/journeys.mjs` does what people do (bills, a transfer with Undo, an automatic payment, a scenario, CSV and
   PDF imports) and times startup and edits against a full redraw; the `screens` job lists what changed visually.

**Consequences.** A change to a component, a template or a stylesheet is driven before it's called done. Prefer
measuring (`getComputedStyle`, `getBoundingClientRect`) to eyeballing. A new page, subtab or report goes in the smoke
script's `VIEWS`; a new flow people rely on gets a journey.
