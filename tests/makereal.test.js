import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { scenarioTotals, recalcComputedItems } from "../src/calc/engine.js";
import { makeRealPlan, applyMakeReal } from "../src/calc/makereal.js";
import { localDateStr } from "../src/lib/format.js";

function household(){
  return migrateState({
    scenarios: ["Today", "Rentvest"], baselineScenario: "Today", activeScenario: "Today", scenarioModel: 2,
    home: { Today: [], Rentvest: [] },
    income: [{ id: "pay", what: "Salary", person: "Alex", incomeType: "Gross", amount: 110000, freq: "Yearly" }],
    shared: [{ id: "homeLoanRow", what: "Rent", amount: 550, freq: "Weekly", account: "Bank One", category: "Housing", homeCost: true },
      { id: "g", what: "Groceries", amount: 800, freq: "Monthly" }],
    transactions: [{ id: "t1", date: "2026-10-01", amount: 550, what: "Rent", linkedExpenseId: "homeLoanRow" }],
    scenarioChanges: { Rentvest: [
      { id: "r", kind: "rent", what: "Rent", amount: 700, freq: "Weekly", fromYear: 0 },
      { id: "i", kind: "ip", what: "Example unit", price: 600000, depositPct: 20, rate: 6, termYears: 30, repaymentType: "IO", state: "NSW", rentWeekly: 600, vacancyWeeks: 2, mgmtPct: 7, costsYearly: 4000, depreciationYearly: 5000, growthPct: "", owner: "", fromYear: 0 },
      { id: "g2", kind: "amount", rowId: "g", amount: 900 },
      { id: "s", kind: "cost", what: "Second car", amount: 200, freq: "Monthly", fromYear: 2 }
    ] }
  });
}

test("the plan says what will be added, changed and ended, and what waits", function(){
  var keep = state;
  try {
    setState(household());
    var plan = makeRealPlan(state, "Rentvest", "2026-11-01");
    assert.ok(plan.actions.some(function(a){ return /End today's home lines \(Rent\)/.test(a); }));
    assert.ok(plan.actions.some(function(a){ return /Add Rent to Budget as where you live: \$700 weekly/.test(a); }));
    assert.ok(plan.actions.some(function(a){ return /Example unit to Net worth → Property: \$600,000, a \$480,000 loan, rent \$600 a week/.test(a); }));
    assert.ok(plan.actions.some(function(a){ return /Groceries: \$800 → \$900/.test(a); }));
    assert.deepEqual(plan.skipped.map(function(s){ return s.text; }), ["Second car"]);
    assert.equal(state.properties.length, 0, "a plan changes nothing");
  } finally { setState(keep); }
});

test("made real, the household's month equals the scenario's", function(){
  var keep = state;
  try {
    setState(household());
    // The month a scenario shows is once everything in it has happened; a cost from year 3 isn't made
    // real today, so it's left out of the comparison.
    state.scenarioChanges.Rentvest = state.scenarioChanges.Rentvest.filter(function(c){ return !c.fromYear; });
    recalcComputedItems();
    var scenario = scenarioTotals("Rentvest");
    var today = localDateStr();
    applyMakeReal(state, "Rentvest", today, (function(){ var n = 0; return function(p){ return p + (++n); }; })());
    state.scenarioChanges.Rentvest = [];
    recalcComputedItems();
    var real = scenarioTotals("Today");
    // Rent, groceries, the property's rent less management and costs, its loan and its tax effect —
    // both work the tax out in full (the levy surcharge the property's loss takes away included).
    assert.ok(Math.abs(real.netMonthly - scenario.netMonthly) < 5, "within a few dollars: " + real.netMonthly.toFixed(2) + " vs " + scenario.netMonthly.toFixed(2));
    var oldRent = state.shared.find(function(l){ return l.id === "homeLoanRow"; });
    assert.ok(oldRent.endDate && oldRent.endDate < today, "the old rent is ended the day before, not deleted — its payments stay linked");
    assert.ok(!oldRent.homeCost);
    assert.equal(state.shared.find(function(l){ return l.homeCost; }).amount, 700);
    var ip = state.properties.find(function(p){ return p.kind === "IP"; });
    assert.equal(ip.loans[0].balance, 480000);
    assert.equal(ip.depreciationSchedule[0].fy, Number(today.slice(5, 7)) >= 7 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1);
  } finally { setState(keep); }
});
