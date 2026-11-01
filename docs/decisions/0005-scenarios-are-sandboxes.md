# 0005 — Scenarios are sandboxes: changes beside the household, never on it

**Decided:** v3.172 (item 207) onwards; Make it real v3.176, what-ifs v3.177, the editor v3.181–194, combined scenarios v3.199.

**Context.** Scenarios used to write overrides onto the household's own rows, so a what-if could leak into this
year's tax, the budget or the projection, and nobody could tell what was real.

**Decision.** Every page outside Plan → Scenarios shows the household (`currentScenario()`), never
`state.activeScenario`. A scenario's differences live in `state.scenarioChanges[name]` (`calc/scenariochanges.js`) —
amounts, legs, a purchase, a move, a retirement age, its own assumptions (`assume`, read through
`projectionFor(scenario)`) — never on the household's rows. Today's home costs are Budget lines with `homeCost: true`.

**Consequences.**
- Scenario maths reads `effectiveChanges(name)` (an `include` change counts another scenario's changes once, its own
  winning), `scenarioSharedItems(name)` and `scenarioLegChanges` — not `state.shared` or raw changes. The editor's own
  list is `changesFor(name)`.
- A change starts at `fromYear`, at an age (`whenAge`) or once cash allows (`whenCash`, on cash + shares + offsets,
  never super); `computeNetWorthSeries(...).triggers[id]` is the year it started.
- A scenario is edited as a draft (`calc/scenariodraft.js`, key `Draft · <name>`); anything looping `state.scenarios`
  skips drafts. A sale's CGT is worked out only in `calc/salecgt.js`.
- `calc/makereal.js` is the one way back: a dry-run plan, then the same changes as real rows; old home lines end the
  day before.
