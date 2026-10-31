import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { saleCgt, serviceability } from "../src/calc/salecgt.js";

// Worked by hand: bought 1 Jan 2020 with a $500,000 cost base, sold 1 Jan 2030 for $800,000 with $20,000 of
// selling costs — a $280,000 gain. Tax at an invented flat 39% (37% + the 2% Medicare levy).
var base = { sale: 800000, sellingCosts: 20000, costBase: 500000, bought: "2020-01-01", sold: "2030-01-01", taxOf: function(g){ return g * 0.39; } };

test("an investment property: half the gain after a year, taxed", function(){
  var r = saleCgt(Object.assign({ use: "never" }, base));
  assert.equal(r.gain, 280000);
  assert.equal(r.taxable, 140000);
  assert.equal(r.tax, 54600);
  // Held under a year: no discount.
  assert.equal(saleCgt(Object.assign({}, base, { use: "never", bought: "2029-06-01" })).taxable, 280000);
});

test("the home lived in throughout: nothing", function(){
  assert.equal(saleCgt(Object.assign({ use: "home" }, base)).tax, 0);
});

test("a former home rented out: exempt for six years after moving out, then the share of time past them", function(){
  // Moved out 1 Jan 2026, sold four years later: exempt.
  assert.equal(saleCgt(Object.assign({ use: "former", movedOut: "2026-01-01" }, base)).tax, 0);
  // Moved out 1 Jan 2022, sold eight years later: exempt to 1 Jan 2028, taxed for the 731 days after,
  // out of the 3,653 days owned. 280,000 × 731 / 3,653 = 56,030.66; halved 28,015.33; at 39% 10,925.98.
  var r = saleCgt(Object.assign({ use: "former", movedOut: "2022-01-01" }, base));
  assert.equal(r.taxedShare, 731 / 3653);
  assert.equal(r.taxable, 28015.33);
  assert.equal(r.tax, 10925.98);
});

test("a lender's buffer: a loan that passes at its rate but not 3 points above it", function(){
  // $600,000 over 30 years: $3,597.30 a month at 6%, $4,827.74 at 9%. Take-home $7,500, living $3,000.
  var at = serviceability({ incomeMonthly: 7500, livingMonthly: 3000, loans: [{ balance: 600000, rate: 6, termYears: 30 }], buffer: 0 });
  var lender = serviceability({ incomeMonthly: 7500, livingMonthly: 3000, loans: [{ balance: 600000, rate: 6, termYears: 30 }] });
  assert.equal(at.assessedMonthly, 3597.3);
  assert.equal(at.ok, true);
  assert.equal(lender.assessedMonthly, 4827.74);
  assert.equal(lender.surplus, -327.74);
  assert.equal(lender.ok, false);
  // 80% of rent counts: $500 a month of rent covers $400 of the shortfall.
  assert.equal(serviceability({ incomeMonthly: 7500, rentMonthly: 500, livingMonthly: 3000, loans: [{ balance: 600000, rate: 6, termYears: 30 }] }).surplus, 72.26);
});

import { state, setState, migrateState } from "../src/state.js";
import { computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";
import { lenderCheck } from "../src/calc/compare.js";

function household(kind, sell, extra){
  return migrateState(Object.assign({
    scenarios: ["Today", "Sell"], baselineScenario: "Today", activeScenario: "Today", scenarioModel: 2,
    projection: { horizonYears: 10, investReturnRate: 5, propertyAppreciationRate: 5, inflationRate: 2.5, incomeGrowthRate: 2.5, realTerms: false },
    income: [{ id: "pay", what: "Salary", person: "Alex", incomeType: "Gross", amount: 130000, freq: "Yearly" }],
    shared: [{ id: "g", what: "Groceries", amount: 1200, freq: "Monthly" }],
    properties: [{ id: "p1", what: "1 Example St", kind: kind, value: 900000, purchasePrice: 500000, purchaseDate: "2016-03-01", acquisitionCosts: [], loans: [], income: [], expenses: [], history: [], ownership: {} }],
    home: { Today: [], Sell: [] }, purchase: { Today: { enabled: false }, Sell: { enabled: false } }, invest: { Today: { enabled: false }, Sell: { enabled: false } },
    scenarioChanges: { Sell: [Object.assign({ id: "s", kind: "sell", propertyId: "p1", fromYear: 1, sellingCostsPct: 2 }, sell || {})] }
  }, extra || {}));
}
function nwAt(h, y){ var keep = state; try { setState(h); recalcComputedItems(); return computeNetWorthSeries("Sell", 10)[y].y; } finally { setState(keep); } }

test("selling in a scenario: the home pays no CGT, the same place as an investment does, a former home within six years doesn't", function(){
  // The same property each time (land tax and all), only how it was used differs — so the gap is the tax.
  var home = nwAt(household("IP", { use: "home" }), 5), ip = nwAt(household("IP"), 5), former = nwAt(household("IP", { use: "former", movedOut: "2024-01-01" }), 5);
  assert.ok(home > ip + 50000, "CGT on a ~$470,000 gain, halved, at the owner's tax: " + Math.round(home - ip));
  assert.equal(Math.round(former), Math.round(home), "moved out in 2024, sold in year 2: still exempt");
});

test("a lender check: a modest loan passes, a large one fails at the rate plus 3", function(){
  var keep = state;
  try {
    var mk = function(price){ var h = household("PPOR"); h.purchase.Sell = { enabled: true, price: price, depositPct: 20, rate: 6, ioRate: 6, termYears: 30, state: "VIC", repaymentType: "PI", firstHomeBuyer: false };
      h.scenarioChanges.Sell = []; return h; };
    setState(mk(500000)); recalcComputedItems();
    var small = lenderCheck("Sell", "Today");
    setState(mk(2500000)); recalcComputedItems();
    var big = lenderCheck("Sell", "Today");
    assert.equal(small.ok, true);
    assert.equal(big.ok, false);
    assert.ok(big.assessedMonthly > small.assessedMonthly * 4);
    assert.equal(lenderCheck("Today", "Today"), null, "nothing new borrowed");
  } finally { setState(keep); }
});
