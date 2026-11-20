// A household that already has a computed row twice (a sync merge kept both before calc/syncmerge.js matched them by
// what they're for): one recalculation leaves one, kept up to date, and the stale copy is no longer counted.
// Invented figures.
import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, setState, defaultState } from "../src/state.js";
import { recalcComputedItems, scenarioTotals, currentScenario } from "../src/calc/engine.js";

test("a computed rent row twice: one recalculation leaves one, at the current rent", function(){
  const keep = JSON.parse(JSON.stringify(state));
  try {
    const s = defaultState();
    s.income = [];
    s.properties = [{ id: "p1", what: "1 Example St", kind: "IP", value: 500000, loans: [], acquisitionCosts: [], history: [], ownership: {},
      income: [{ what: "Rent", amount: 600, freq: "Weekly" }], expenses: [], pmFee: { percent: 0, flat: 0 } }];
    setState(s);
    recalcComputedItems();
    const rentRows = () => state.income.filter(r => r.syntheticRentForProperty === "p1");
    assert.equal(rentRows().length, 1);
    const current = rentRows()[0].amount;
    const before = scenarioTotals(currentScenario()).incomeMonthly;
    // What a merge used to leave: the same row again, at an old amount.
    state.income.push(Object.assign({}, rentRows()[0], { amount: 1000 }));
    recalcComputedItems();
    assert.equal(rentRows().length, 1, "the stale copy is gone");
    assert.equal(rentRows()[0].amount, current);
    assert.equal(scenarioTotals(currentScenario()).incomeMonthly, before, "and isn't counted");
  } finally { setState(keep); }
});
