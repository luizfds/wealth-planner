import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { computeNetWorthSeries, recalcComputedItems, scenarioLegChanges } from "../src/calc/engine.js";

function household(changes){
  return migrateState({
    scenarios: ["Today", "Wait"], baselineScenario: "Today", activeScenario: "Today", scenarioModel: 2,
    fire: { currentAge: 35 },
    projection: { horizonYears: 20, investReturnRate: 5, propertyAppreciationRate: 4, inflationRate: 2.5, incomeGrowthRate: 2.5, realTerms: false },
    income: [{ id: "pay", what: "Salary", person: "Alex", incomeType: "Gross", amount: 120000, freq: "Yearly" }],
    shared: [{ id: "r", what: "Rent", amount: 600, freq: "Weekly", category: "Housing", homeCost: true }, { id: "g", what: "Groceries", amount: 900, freq: "Monthly" }],
    assets: [{ id: "a1", what: "Bank One saver", category: "Cash", amount: 30000 }],
    home: { Today: [], Wait: [] }, purchase: { Today: { enabled: false }, Wait: { enabled: false } }, invest: { Today: { enabled: false }, Wait: { enabled: false } },
    scenarioChanges: { Wait: changes }
  });
}
var unit = function(extra){ return Object.assign({ id: "ip", kind: "ip", what: "Example unit", price: 500000, depositPct: 20, rate: 6, termYears: 30, repaymentType: "IO", state: "VIC",
  rentWeekly: 500, vacancyWeeks: 2, mgmtPct: 7, costsYearly: 3500, depreciationYearly: 4000, growthPct: "", owner: "", fromYear: 0 }, extra); };
function run(changes, fn){ var keep = state; try { setState(household(changes)); recalcComputedItems(); fn(); } finally { setState(keep); } }

test("bought when cash reaches the deposit: the first year cash starts at $150,000 or more", function(){
  run([unit({ when: "cash", whenCash: 150000 })], function(){
    var today = computeNetWorthSeries("Today", 20), wait = computeNetWorthSeries("Wait", 20);
    // Cash at the start of year y is the end of year y − 1 in a household that hasn't bought yet — here
    // all of it cash (no super, no shares), so the projection's investments are the cash.
    var expected = null;
    for(var y = 1; y <= 20; y++){ if(today[y - 1].investments >= 150000){ expected = y; break; } }
    assert.ok(expected > 1 && expected < 15, "the fixture saves its way to the deposit: year " + expected);
    assert.equal(wait.triggers.ip, expected);
    for(var k = 0; k < expected; k++) assert.equal(Math.round(wait[k].y), Math.round(today[k].y), "the same as today until it's bought (year " + k + ")");
    assert.ok(wait[expected].debt > today[expected].debt + 300000, "the loan is there from the year it's bought");
  });
});

test("a target cash never reaches leaves the change out, and says so", function(){
  run([unit({ when: "cash", whenCash: 50000000 })], function(){
    var today = computeNetWorthSeries("Today", 20), wait = computeNetWorthSeries("Wait", 20);
    assert.equal(wait.triggers.ip, null);
    assert.equal(Math.round(wait[20].y), Math.round(today[20].y));
  });
});

test("super doesn't count toward a deposit: cash alone has to reach it", function(){
  var keep = state;
  try {
    var h = household([unit({ when: "cash", whenCash: 150000 })]);
    h.assets.push({ id: "s1", what: "Super", category: "Super", amount: 400000 });
    setState(h); recalcComputedItems();
    var withSuper = computeNetWorthSeries("Wait", 20).triggers.ip;
    setState(household([unit({ when: "cash", whenCash: 150000 })])); recalcComputedItems();
    assert.equal(withSuper, computeNetWorthSeries("Wait", 20).triggers.ip, "the same year with $400,000 in super");
    assert.ok(withSuper > 1);
  } finally { setState(keep); }
});

test("at an age: the year that age is reached; with no age known, never", function(){
  run([unit({ when: "age", whenAge: 40 })], function(){
    assert.equal(scenarioLegChanges("Wait")[0].fromYear, 5);
    state.fire.currentAge = "";
    assert.equal(scenarioLegChanges("Wait").length, 0);
  });
});
