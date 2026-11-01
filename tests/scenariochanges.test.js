import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { demoHousehold } from "../src/calc/demo.js";
import { scenarioTotals, computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";
import { migrateScenarios, changesFor, livesElsewhere, scenarioSharedItems, setAmountChange, removeChange, renameScenarioChanges, cloneScenarioChanges, deleteScenarioChanges, homeRowsFromBudget } from "../src/calc/scenariochanges.js";

// The invented sample household, with per-scenario amounts on a budget line and on income as the
// old model kept them — on the rows themselves.
function oldHousehold(){
  var s = demoHousehold("2026-10-15");
  var groceries = s.shared.find(function(l){ return /grocer/i.test(l.what); });
  groceries.scenarioOverrides = { "Buy a house": 900, "Buy an apartment": 1000 };
  var pay = s.income.find(function(i){ return i.incomeType === "Gross"; });
  pay.scenarioOverrides = { "Buy an apartment": Math.round(pay.amount * 0.8) };
  s.scenarioModel = 1;
  return s;
}
function figures(){
  recalcComputedItems();
  var out = {};
  state.scenarios.forEach(function(name){
    var t = scenarioTotals(name);
    var series = computeNetWorthSeries(name, 20);
    out[name] = { income: t.incomeMonthly.toFixed(2), home: t.homeMonthly.toFixed(2), expenses: t.expensesMonthly.toFixed(2), net: t.netMonthly.toFixed(2), in20: series[series.length - 1].y.toFixed(0) };
  });
  return out;
}

test("converting to sealed scenarios leaves every scenario's month and projection exactly where they were", function(){
  var keep = state;
  try {
    var old = oldHousehold();
    // Before: every default filled in but the conversion held back — the old model, overrides on rows.
    var unconverted = JSON.parse(JSON.stringify(old));
    unconverted.scenarioModel = 2;
    setState(migrateState(unconverted));
    var before = figures();
    var raw = JSON.parse(JSON.stringify(old));
    raw.scenarioModel = 2;
    var converted = migrateState(raw);
    converted.scenarioModel = 1;
    var moved = migrateScenarios(converted, (function(){ var n = 0; return function(p){ return p + (++n); }; })());
    assert.equal(moved.amounts, 3);
    assert.ok(moved.homeLines >= 2);
    assert.equal(moved.homeChanges, 2);
    setState(converted);
    var after = figures();
    assert.deepEqual(after, before);
    // And the shape: nothing per-scenario left on the household's rows; today's home in Budget.
    assert.ok(!state.shared.concat(state.income).some(function(r){ return r.scenarioOverrides; }));
    assert.deepEqual(state.home.Renting, []);
    assert.ok(state.shared.some(function(l){ return l.homeCost && /rent/i.test(l.what); }));
    assert.ok(livesElsewhere("Buy a house") && livesElsewhere("Buy an apartment") && !livesElsewhere("Renting"));
    assert.equal(changesFor("Buy a house").filter(function(c){ return c.kind === "amount"; }).length, 1);
    // Converting twice changes nothing.
    var again = JSON.parse(JSON.stringify(converted));
    assert.deepEqual(migrateScenarios(again), { amounts: 0, homeLines: 0, homeChanges: 0 });
  } finally { setState(keep); }
});

test("a scenario that lives elsewhere leaves today's home lines out; one that doesn't keeps them", function(){
  var st = { shared: [{ id: "r", what: "Rent", amount: 2500, freq: "Monthly", homeCost: true }, { id: "g", what: "Groceries", amount: 800, freq: "Monthly" }],
    scenarioChanges: { Move: [{ id: "c1", kind: "home" }] } };
  assert.deepEqual(scenarioSharedItems("Move", st).map(function(l){ return l.id; }), ["g"]);
  assert.deepEqual(scenarioSharedItems("Stay", st).map(function(l){ return l.id; }), ["r", "g"]);
  assert.deepEqual(homeRowsFromBudget(st).map(function(l){ return [l.what, l.homeCost]; }), [["Rent", undefined]]);
});

test("a scenario's changes are its own: set, clear, rename, copy and delete carry them", function(){
  var st = { scenarioChanges: {} };
  var n = 0, id = function(){ return "c" + (++n); };
  setAmountChange("A", "g", 950, id, st);
  setAmountChange("A", "g", 990, id, st);
  assert.deepEqual(changesFor("A", st), [{ id: "c1", kind: "amount", rowId: "g", amount: 990 }]);
  renameScenarioChanges("A", "B", st);
  assert.equal(changesFor("A", st).length, 0);
  cloneScenarioChanges("B", "C", id, st);
  assert.equal(changesFor("C", st)[0].amount, 990);
  assert.notEqual(changesFor("C", st)[0].id, changesFor("B", st)[0].id);
  setAmountChange("C", "g", null, id, st);
  assert.equal(changesFor("C", st).length, 0);
  assert.equal(removeChange("B", "c1", st).rowId, "g");
  deleteScenarioChanges("B", st);
  assert.equal(st.scenarioChanges.B, undefined);
});
