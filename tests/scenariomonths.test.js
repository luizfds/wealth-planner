import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig, defaultInvestConfig } from "../src/state.js";
import { legsInYear, legsMonthly, changeSummary, monthsFromNow, newChange } from "../src/calc/scenariolegs.js";
import { scenarioTimeline } from "../src/calc/scenariotimeline.js";
import { scenarioTotals, computeNetWorthSeries, scenarioLegChanges, recalcComputedItems } from "../src/calc/engine.js";
import { recalcPurchase } from "../src/calc/property.js";
import { localDateStr } from "../src/lib/format.js";

// Items 250 and 251: a one-off cost, and changes in a given month. Invented household; months are counted from
// whatever today is, so the tests don't age.
function monthAhead(n){
  var t = localDateStr(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)) - 1 + n;
  return (y + Math.floor(m / 12)) + "-" + String((m % 12) + 1).padStart(2, "0");
}

test("months from now: this month and gone-by months are 0; blank is none", () => {
  assert.equal(monthsFromNow("2027-05", "2026-11-05"), 6);
  assert.equal(monthsFromNow("2026-01", "2026-11-05"), 0);
  assert.equal(monthsFromNow("", "2026-11-05"), null);
});

test("rent that stops partway through a year counts for the months it runs; a one-off cost leaves cash once", () => {
  const rent = { kind: "rent", amount: 600, freq: "Weekly", startMonth: 0, endMonth: 6 };
  const m = 600 * 52 / 12;
  assert.ok(Math.abs(legsInYear([rent], 1, {}).savingsMonthly + m * 0.5) < 0.01, "half of the first year");
  assert.equal(legsInYear([rent], 2, {}).savingsMonthly, 0, "and none after it stops");
  const later = { kind: "cost", amount: 100, freq: "Monthly", startMonth: 9 };
  assert.ok(Math.abs(legsInYear([later], 1, {}).savingsMonthly + 25) < 0.01, "three months of the first year");
  assert.ok(Math.abs(legsInYear([later], 2, {}).savingsMonthly + 100) < 0.01);
  const once = { kind: "once", what: "Moving", amount: 8000, startMonth: 14 };
  assert.equal(legsInYear([once], 1, {}).lump, 0);
  assert.equal(legsInYear([once], 2, { inflationRate: 0 }).lump, -8000);
  assert.equal(legsInYear([once], 3, {}).lump, 0);
  const lm = legsMonthly([rent, once, { kind: "rent", amount: 500, freq: "Weekly" }]);
  assert.ok(Math.abs(lm.expensesMonthly - 500 * 52 / 12) < 0.01, "once everything's happened: rent that stopped isn't in the month");
  assert.equal(lm.upfront, 8000, "a one-off cost is cash out, not a monthly cost");
});

test("in words, and on the timeline", () => {
  assert.equal(changeSummary({ kind: "rent", amount: 660, freq: "Weekly", when: "month", fromMonth: "2026-12", untilMonth: "2027-06" }), "Rent $660 weekly · from Dec 2026 until Jun 2027");
  assert.equal(changeSummary({ kind: "once", what: "Moving", amount: 8000, when: "month", fromMonth: "2027-01" }), "Moving: $8,000 once · in Jan 2027");
  assert.equal(newChange("once", "c1").kind, "once");
  const tl = scenarioTimeline({ today: "2026-11-05", buying: true, buyMonth: "2028-02", changes: [{ kind: "once", what: "Moving", amount: 8000, when: "month", fromMonth: "2027-01" }] });
  assert.deepEqual(tl.map(e => [e.year, e.label]), [[0, "Moving $8,000"], [1, "Buy the home"]]);
});

function withHousehold(fn){
  var keys = ["properties", "assets", "purchase", "scenarios", "home", "invest", "income", "shared", "baselineScenario", "activeScenario", "scenarioChanges", "debts", "projection"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Buy now", "Buy later"];
    state.baselineScenario = "Renting"; state.activeScenario = "Renting";
    state.debts = []; state.properties = [];
    state.assets = [{ category: "Cash", what: "Savings", amount: 200000 }];
    state.home = { Renting: [], "Buy now": [], "Buy later": [] };
    state.invest = { Renting: defaultInvestConfig(), "Buy now": defaultInvestConfig(), "Buy later": defaultInvestConfig() };
    var buy = function(){ return Object.assign(defaultPurchaseConfig(700000, 20, 6, 30, "VIC", true), { otherCosts: [] }); };
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "VIC", false), "Buy now": buy(), "Buy later": Object.assign(buy(), { buyMonth: monthAhead(6) }) };
    state.scenarioChanges = { "Buy later": [{ id: "r", kind: "rent", what: "Rent", amount: 600, freq: "Weekly", untilMonth: monthAhead(6) }, { id: "m", kind: "once", what: "Moving", amount: 8000, when: "month", fromMonth: "" }] };
    state.income = [{ id: "i1", what: "Alex — pay", incomeType: "Net", amount: 12000, freq: "Monthly" }];
    state.shared = [{ id: "s1", what: "Groceries", amount: 1000, freq: "Monthly" }];
    state.projection = Object.assign({}, keep.projection, { investReturnRate: 0, propertyAppreciationRate: 0, inflationRate: 0, incomeGrowthRate: 0, rateShockPct: 0, realTerms: true, source: "plan" });
    recalcComputedItems();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("a home bought in six months: nothing owned or paid before, its cash leaves in that year; rent until then", () => {
  withHousehold(() => {
    const upfront = recalcPurchase("Buy later").upfrontCash;
    const now = computeNetWorthSeries("Buy now", 3), later = computeNetWorthSeries("Buy later", 3), base = computeNetWorthSeries("Renting", 3);
    assert.equal(later[0].propertyEquity, 0, "owns nothing yet");
    assert.ok(Math.abs(later[0].y - base[0].y) < 0.01, "and has spent nothing yet");
    assert.ok(Math.abs(now[0].y - (base[0].y - upfront + now[0].propertyEquity)) < 1, "buying now spends it at the start");
    assert.ok(later[1].propertyEquity > 0 && later[1].debt > 0, "owned and owed by the end of the first year");
    const legs = scenarioLegChanges("Buy later");
    assert.equal(legs.find(c => c.id === "r").endMonth, 6);
    const t = scenarioTotals("Buy later");
    assert.equal(t.cashOut, upfront + 8000, "the move is cash out too");
    assert.ok(Math.abs(t.expensesMonthly - scenarioTotals("Buy now").expensesMonthly) < 0.01, "once it's all happened: the same month as buying now");
  });
});
