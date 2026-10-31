import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";
import { whatIfDefaults, whatIfMoved, whatIfChanges, previewSeries, keepWhatIf, whatIfName } from "../src/calc/whatif.js";

function household(){
  return migrateState({
    scenarios: ["Today"], baselineScenario: "Today", activeScenario: "Today", scenarioModel: 2,
    fire: { currentAge: 40 },
    projection: { horizonYears: 25, investReturnRate: 7, propertyAppreciationRate: 4, inflationRate: 3, incomeGrowthRate: 3, rateShockPct: 0, realTerms: true },
    income: [{ id: "pay", what: "Salary", person: "Alex", incomeType: "Gross", amount: 95000, freq: "Yearly" }],
    shared: [{ id: "r", what: "Rent", amount: 520, freq: "Weekly", category: "Housing", homeCost: true }, { id: "g", what: "Groceries", amount: 700, freq: "Monthly" }],
    assets: [{ id: "a1", what: "Savings", category: "Cash", amount: 40000 }]
  });
}
function withHousehold(fn){ var keep = state; try { setState(household()); recalcComputedItems(); fn(); } finally { setState(keep); } }

test("untouched sliders are the saved plan, and change nothing", function(){
  withHousehold(function(){
    var w = whatIfDefaults();
    assert.equal(whatIfMoved(w), false);
    assert.deepEqual(whatIfChanges(w), []);
    var saved = computeNetWorthSeries("Today", 25), preview = previewSeries("Today", w, 25);
    assert.deepEqual(preview.map(function(p){ return Math.round(p.y); }), saved.map(function(p){ return Math.round(p.y); }));
    assert.equal(state.scenarioChanges["\u0000what-if"], undefined, "the scratch scenario is gone again");
  });
});

test("each slider moves the line the way it should", function(){
  withHousehold(function(){
    var end = function(w){ return previewSeries("Today", Object.assign(whatIfDefaults(), w), 25)[25].y; };
    var saved = end({});
    assert.ok(end({ extraMonthly: 500 }) > saved, "saving more ends higher");
    assert.ok(end({ investReturnRate: 9 }) > saved, "a better return ends higher");
    assert.ok(end({ retireAge: 55 }) < saved, "retiring at 55 ends lower than working on");
    var at = previewSeries("Today", Object.assign(whatIfDefaults(), { retireAge: 55 }), 25);
    assert.ok(at[20].y < at[16].y, "after retiring at 55 (year 16) savings are drawn on");
  });
});

test("Keep this makes a scenario that projects exactly as previewed", function(){
  withHousehold(function(){
    var w = Object.assign(whatIfDefaults(), { retireAge: 60, investReturnRate: 6, inflationRate: 2.5, extraMonthly: 300, rateShockPct: 1 });
    var preview = previewSeries("Today", w, 25);
    var name = keepWhatIf("Today", w);
    assert.equal(name, whatIfName(w));
    assert.match(name, /^Retire at 60, Save \$300 more, 6% return, 2.5% inflation, rates \+1$/);
    assert.ok(state.scenarios.indexOf(name) !== -1);
    var kept = computeNetWorthSeries(name, 25);
    assert.deepEqual(kept.map(function(p){ return Math.round(p.y); }), preview.map(function(p){ return Math.round(p.y); }));
    assert.equal(computeNetWorthSeries("Today", 25)[25].y > 0, true);
    assert.equal(state.projection.investReturnRate, 7, "the household's own assumptions are untouched");
  });
});
