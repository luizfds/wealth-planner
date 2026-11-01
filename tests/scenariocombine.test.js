import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { demoHousehold } from "../src/calc/demo.js";
import { scenarioTotals, computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";
import { effectiveChanges, includedNames, includeCandidates, renameScenarioChanges, deleteScenarioChanges, livesElsewhere } from "../src/calc/scenariochanges.js";
import { lenderCheck } from "../src/calc/compare.js";

// The invented sample household, with three scenarios of its own: two to combine and the same changes
// made by hand in a third, to check against.
function household(){
  var s = migrateState(demoHousehold("2026-10-15"));
  var groceries = s.shared.find(function(l){ return /grocer/i.test(l.what); });
  var add = function(name, changes){
    s.scenarios.push(name); s.home[name] = []; s.purchase[name] = Object.assign({}, s.purchase[s.baselineScenario], { enabled: false });
    s.invest[name] = Object.assign({}, s.invest[s.baselineScenario] || {}, { enabled: false }); s.scenarioChanges[name] = changes;
  };
  add("Rentvest", [{ id: "r1", kind: "rent", what: "Rent", amount: 700, freq: "Weekly", fromYear: 0 },
    { id: "r2", kind: "ip", what: "Investment property", price: 600000, depositPct: 20, rate: 6.2, termYears: 30, repaymentType: "IO", state: "QLD", rentWeekly: 560, vacancyWeeks: 2, mgmtPct: 7, costsYearly: 4200, growthPct: "", depreciationYearly: 3500, owner: "", fromYear: 1 }]);
  add("Second car", [{ id: "c1", kind: "cost", what: "Car loan and running", amount: 650, freq: "Monthly", fromYear: 0 },
    { id: "c2", kind: "amount", rowId: groceries.id, amount: Number(groceries.amount) + 40 }]);
  add("Both", [{ id: "b1", kind: "include", scenario: "Rentvest" }, { id: "b2", kind: "include", scenario: "Second car" }]);
  add("By hand", JSON.parse(JSON.stringify(s.scenarioChanges.Rentvest.concat(s.scenarioChanges["Second car"]))));
  return s;
}
function figures(name){
  recalcComputedItems();
  var t = scenarioTotals(name), series = computeNetWorthSeries(name, 20);
  return { income: t.incomeMonthly.toFixed(2), expenses: t.expensesMonthly.toFixed(2), home: t.homeMonthly.toFixed(2), net: t.netMonthly.toFixed(2),
    nw: series.map(function(p){ return p.y.toFixed(0); }).join(","), lender: JSON.stringify(lenderCheck(name, state.baselineScenario)) };
}
function withState(s, fn){ var keep = state; try { setState(s); return fn(); } finally { setState(keep); } }

test("a combination counts exactly what the same changes made by hand do — the month, the projection, a lender", function(){
  withState(household(), function(){
    assert.deepEqual(figures("Both"), figures("By hand"));
    assert.notDeepEqual(figures("Both"), figures("Rentvest"));
    assert.ok(livesElsewhere("Both"), "the rent somewhere new comes with it");
    assert.deepEqual(includedNames("Both"), ["Rentvest", "Second car"]);
  });
});

test("a change to an included scenario flows through, nothing copied", function(){
  withState(household(), function(){
    state.scenarioChanges["Second car"][0].amount = 900;
    state.scenarioChanges["By hand"].find(function(c){ return c.id === "c1"; }).amount = 900;
    assert.deepEqual(figures("Both"), figures("By hand"));
    assert.equal(state.scenarioChanges.Both.length, 2, "still just the two includes");
  });
});

test("its own change wins over an included one about the same line; once each, and a loop stops", function(){
  withState(household(), function(){
    var groceries = state.shared.find(function(l){ return /grocer/i.test(l.what); });
    state.scenarioChanges.Both.push({ id: "b3", kind: "amount", rowId: groceries.id, amount: 1 });
    var amounts = effectiveChanges("Both").filter(function(c){ return c.kind === "amount"; });
    assert.equal(amounts.length, 1); assert.equal(amounts[0].amount, 1);
    // Rentvest includes Second car too: still counted once.
    state.scenarioChanges.Rentvest.push({ id: "r3", kind: "include", scenario: "Second car" });
    assert.equal(effectiveChanges("Both").filter(function(c){ return c.id === "c1"; }).length, 1);
    // A loop: Second car includes Both. Each is reached once, and nothing includes itself.
    state.scenarioChanges["Second car"].push({ id: "c3", kind: "include", scenario: "Both" });
    assert.deepEqual(includedNames("Second car").sort(), ["Both", "Rentvest"]);
    assert.ok(isFinite(scenarioTotals("Both").netMonthly));
    // What can be included: not itself, not the household, not one that already includes it.
    assert.equal(includeCandidates("Rentvest").indexOf("Rentvest"), -1);
    assert.equal(includeCandidates("Rentvest").indexOf(state.baselineScenario), -1);
    assert.equal(includeCandidates("Rentvest").indexOf("Both"), -1);
    assert.equal(includeCandidates("Draft · Rentvest").indexOf("Rentvest"), -1);
  });
});

test("renaming an included scenario follows it; deleting it takes the include out", function(){
  var s = household();
  renameScenarioChanges("Second car", "Two cars", s);
  assert.equal(s.scenarioChanges.Both[1].scenario, "Two cars");
  deleteScenarioChanges("Rentvest", s);
  assert.deepEqual(s.scenarioChanges.Both.map(function(c){ return c.scenario; }), ["Two cars"]);
});
