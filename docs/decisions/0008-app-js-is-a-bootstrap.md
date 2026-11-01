# 0008 — app.js is a bootstrap; each page wires itself; sections are a registry

**Decided:** v3.206.1 (item 237a), v3.207 (item 237b).

**Context.** `app.js` had grown back to ~6,950 lines of event wiring for every page, plus helpers that dispatched by a
section name (`"income"`, `"home:<scenario>"`, `"propexp:<id>"`…) across all of them.

**Decision.** `app.js` (~260 lines) only starts the app: theme, providers, the starting route and Back, then each page's
`wire…()` in the order its listeners have always been added, `renderAll()` and the first page. Every listener lives in
a page's wiring module (`components/*wiring.js`, `rows.js`, `redraw.js`, `overlays.js`, `notifpanel.js`, `updates.js`).
Nothing imports `app.js`, and it holds nothing a module needs. A row's `data-section` is registered by its page
(`defineSection(kind, { rows, redraw, inBudget, editor, … })`, `lib/sections.js`); `rows.js` asks the registry and
names no page. A page's own buttons inside rows are `defineRowAction(selector, fn)`.

**Consequences.**
- A new listener goes in its page's wiring module; a new list of editable rows registers its kind.
- Listener order matters where several handlers listen on `document` — a module's `wire…()` keeps its place.
- A lost name in moved code is a `ReferenceError` only when its handler runs; ESLint's `no-undef` catches it. The split
  was checked by recording every `addEventListener` at startup on main and the branch: the same 360, in order.
