import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { demoHousehold } from "../src/calc/demo.js";
import { computeNetWorthSeries, scenarioTotals, recalcComputedItems } from "../src/calc/engine.js";
import { compareAll, verdict } from "../src/calc/compare.js";

test("side by side reads the same figures as the projection and the cards", function(){
  var keep = state;
  try {
    var s = migrateState(demoHousehold("2026-10-15"));
    s.scenarioChanges["Rentvest"] = [{ id: "r", kind: "rent", what: "Rent", amount: 760, freq: "Weekly", fromYear: 0 },
      { id: "i", kind: "ip", what: "Unit", price: 600000, depositPct: 20, rate: 6, termYears: 30, repaymentType: "IO", state: "NSW", rentWeekly: 600, vacancyWeeks: 2, mgmtPct: 7, costsYearly: 4000, depreciationYearly: 5000, growthPct: "", owner: "", fromYear: 0 }];
    s.scenarios.push("Rentvest"); s.home.Rentvest = []; s.purchase.Rentvest = { enabled: false }; s.invest.Rentvest = { enabled: false };
    setState(s);
    recalcComputedItems();
    var rows = compareAll();
    assert.equal(rows.length, 4);
    var base = rows.find(function(r){ return r.isBaseline; });
    assert.equal(base.scenario, "Renting");
    rows.forEach(function(r){
      var series = computeNetWorthSeries(r.scenario, 20), t = scenarioTotals(r.scenario);
      assert.equal(r.netWorth[0].value, Math.round(series[5].y), r.scenario + " in 5 years");
      assert.equal(r.netWorth[2].value, Math.round(series[20].y), r.scenario + " in 20 years");
      assert.equal(r.lowestCash, Math.round(Math.min.apply(null, series.map(function(p){ return p.investments; }))));
      assert.equal(r.monthAfterTax, Math.round(t.regularNetMonthly));
    });
    var rv = rows.find(function(r){ return r.scenario === "Rentvest"; });
    assert.ok(rv.upfront > 120000, "deposit, stamp duty and costs");
    assert.ok(rv.monthBeforeTax < rv.monthAfterTax, "a loss comes back at tax time");
    assert.ok(rv.monthUnderStress < rv.monthAfterTax, "stress costs something");
    assert.equal(rv.netWorth[0].vsBase, rv.netWorth[0].value - base.netWorth[0].value);
    assert.match(rv.verdict, /staying put/);
  } finally { setState(keep); }
});

test("the verdict puts the deal-breakers first", function(){
  var c = { isBaseline: false, short: 30000, monthAfterTax: 200, monthUnderStress: -150, lowestCash: 5000, aheadFrom: 9, netWorth: [{ year: 20 }] };
  assert.equal(verdict(c), "Ahead of staying put from year 9 — but needs $30,000 more cash at settlement than there is, runs $150 a month short under stress.");
  assert.equal(verdict({ isBaseline: false, short: 0, monthAfterTax: 900, monthUnderStress: 400, lowestCash: 1, aheadFrom: 1, netWorth: [{ year: 20 }] }),
    "Ahead of staying put from the first year, affordable on the figures here, and holds up under stress.");
  assert.match(verdict({ isBaseline: false, short: 0, monthAfterTax: 900, monthUnderStress: 400, lowestCash: 1, aheadFrom: null, netWorth: [{ year: 20 }] }), /^Behind staying put for the whole 20 years/);
});

test("ahead for a while and then behind again is said as such", function(){
  assert.equal(verdict({ isBaseline: false, short: 0, monthAfterTax: 900, monthUnderStress: 400, lowestCash: 1, aheadFrom: null, aheadForAWhile: 9, netWorth: [{ year: 20 }] }),
    "Ahead of staying put for a while from year 9, behind again by year 20, affordable on the figures here, and holds up under stress.");
});
