import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";
import { cashLastsOdds, badStartSeries } from "../src/calc/outcomes.js";
import { compareScenario } from "../src/calc/compare.js";

function household(){
  return migrateState({
    scenarios: ["Today", "Stretched"], baselineScenario: "Today", activeScenario: "Today", scenarioModel: 2,
    projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 4, inflationRate: 2.5, incomeGrowthRate: 2.5, realTerms: false, investVolatility: 15 },
    income: [{ id: "pay", what: "Salary", person: "Alex", incomeType: "Gross", amount: 100000, freq: "Yearly" }],
    shared: [{ id: "r", what: "Rent", amount: 550, freq: "Weekly", category: "Housing", homeCost: true }],
    assets: [{ id: "a1", what: "Bank One saver", category: "Cash", amount: 20000 }, { id: "a2", what: "Fern Index Fund", category: "Shares", amount: 30000 }],
    home: { Today: [], Stretched: [] }, purchase: { Today: { enabled: false }, Stretched: { enabled: false } }, invest: { Today: { enabled: false }, Stretched: { enabled: false } },
    // $4,300 a month more: a little short each month, living on what the savings earn — a bad run drains them.
    scenarioChanges: { Stretched: [{ id: "c", kind: "cost", what: "Everything else", amount: 4300, freq: "Monthly", fromYear: 0 }] }
  });
}
function run(fn){ var keep = state; try { setState(household()); recalcComputedItems(); fn(); } finally { setState(keep); } }

test("a scenario with no slack keeps its cash in fewer runs than one with plenty", function(){
  run(function(){
    var plenty = cashLastsOdds("Today", 20), tight = cashLastsOdds("Stretched", 20);
    assert.equal(plenty.ofTen, 10);
    assert.ok(tight.lasted < plenty.lasted, tight.lasted + " < " + plenty.lasted);
    assert.equal(plenty.runs, 60);
    assert.deepEqual(cashLastsOdds("Stretched", 20), tight, "the same seed, the same answer");
  });
});

test("a bad first year lowers year 10, and the steady return comes back after it", function(){
  run(function(){
    var usual = computeNetWorthSeries("Today", 20), bad = badStartSeries("Today", 20);
    assert.ok(bad[1].y < usual[1].y && bad[10].y < usual[10].y);
    // From year 2 the same return: the gap grows only with what the loss would have earned, not by another fall.
    var gap1 = usual[1].y - bad[1].y, gap10 = usual[10].y - bad[10].y;
    assert.ok(gap10 > gap1 && gap10 < gap1 * Math.pow(1.07, 9) * 1.01, gap1 + " → " + gap10);
    var c = compareScenario("Today");
    assert.equal(c.badStart.vsUsual, Math.round(bad[10].y) - Math.round(usual[10].y));
  });
});
