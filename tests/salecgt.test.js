import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { saleCgt, serviceability, livingFloor, assessedLiving } from "../src/calc/salecgt.js";

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

// v3.197.0 (item 228), worked by hand: bought 1 Jul 2010 for a $400,000 cost base, lived in until 1 Jul 2015, then
// rented out; sold 1 Jul 2025 for $1,000,000 with $20,000 of selling costs. Six years away ends 1 Jul 2021, so the
// 1,461 days from then to the sale are taxed.
var former = { sale: 1000000, sellingCosts: 20000, costBase: 400000, bought: "2010-07-01", sold: "2025-07-01", use: "former", movedOut: "2015-07-01", taxOf: function(g){ return g * 0.39; } };
test("a former home past six years: without its value when first rented, the original cost over all the years owned", function(){
  var r = saleCgt(former);
  // $580,000 gain × 1,461 of 5,479 days owned × ½ = $77,329.80.
  assert.equal(r.gain, 580000);
  assert.equal(r.taxedShare, 1461 / 5479);
  assert.equal(r.taxable, 77329.8);
  assert.equal(r.marketValue, false);
});
test("a former home past six years: with its value when first rented, that value and the years since moving out", function(){
  var r = saleCgt(Object.assign({}, former, { firstRentedValue: 600000 }));
  // $380,000 gain × 1,461 of 3,653 days since moving out × ½ = $75,989.60.
  assert.equal(r.gain, 380000);
  assert.equal(r.taxedShare, 1461 / 3653);
  assert.equal(r.taxable, 75989.6);
  assert.equal(r.tax, Math.round(75989.6 * 0.39 * 100) / 100);
  assert.equal(r.marketValue, true);
  assert.equal(r.discounted, true);
  // Within six years nothing's taxed either way; an investment property never had the reset.
  assert.equal(saleCgt(Object.assign({}, former, { firstRentedValue: 600000, sold: "2021-06-30" })).tax, 0);
  assert.equal(saleCgt(Object.assign({}, former, { firstRentedValue: 600000, sold: "2021-06-30" })).marketValue, false);
  var ip = saleCgt(Object.assign({}, former, { use: "never", firstRentedValue: 600000 }));
  assert.equal(ip.gain, 580000); assert.equal(ip.marketValue, false);
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

test("selling a former home in a scenario: its value when first rented lowers the tax past six years", function(){
  var plain = nwAt(household("IP", { use: "former", movedOut: "2017-01-01" }), 9);
  var valued = nwAt(household("IP", { use: "former", movedOut: "2017-01-01", firstRentedValue: 700000 }), 9);
  assert.ok(valued > plain + 1000, "a higher cost base, a smaller gain: " + Math.round(valued - plain));
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

// v3.198.0 (item 229): lenders' living-cost floor, worked by hand from its constants — one adult $1,500, two
// $2,300, $450 a dependant, plus 10% of take-home past $6,000 a month.
test("the living-cost floor: by adults, dependants and income", function(){
  assert.equal(livingFloor({ adults: 1, dependants: 0, incomeMonthly: 5000 }), 1500);
  assert.equal(livingFloor({ adults: 2, dependants: 2, incomeMonthly: 5000 }), 3200);
  // $10,000 take-home: 2,300 + 450 + 10% of 4,000.
  assert.equal(livingFloor({ adults: 2, dependants: 1, incomeMonthly: 10000 }), 3150);
  // Three adults count as two; a nonsense count as none.
  assert.equal(livingFloor({ adults: 3, dependants: -1, incomeMonthly: 0 }), 2300);
});
test("assessed living costs: a frugal household at the floor, a big spender at their own figure", function(){
  var floor = livingFloor({ adults: 2, dependants: 1, incomeMonthly: 10000 });
  assert.deepEqual(assessedLiving(2200, floor), { used: 3150, declared: 2200, floor: 3150, source: "floor" });
  assert.deepEqual(assessedLiving(5400, floor), { used: 5400, declared: 5400, floor: 3150, source: "yours" });
  // And what it does to a loan: the frugal household is assessed $950 a month worse than its own figure.
  var loan = { incomeMonthly: 10000, rentMonthly: 0, loans: [{ balance: 600000, rate: 6, termYears: 30 }] };
  var own = serviceability(Object.assign({ livingMonthly: 2200 }, loan)), atFloor = serviceability(Object.assign({ livingMonthly: assessedLiving(2200, floor).used }, loan));
  assert.equal(Math.round((own.surplus - atFloor.surplus) * 100) / 100, 950);
});
test("the lender check in Side by side says which living costs it used", function(){
  var keep = state;
  try {
    var mk = function(groceries, deps){ var h = household("PPOR"); h.purchase.Sell = { enabled: true, price: 600000, depositPct: 20, rate: 6, ioRate: 6, termYears: 30, state: "VIC", repaymentType: "PI", firstHomeBuyer: false };
      h.scenarioChanges.Sell = []; h.shared[0].amount = groceries; h.dependants = deps; return h; };
    setState(mk(1200, 2)); recalcComputedItems();
    var frugal = lenderCheck("Sell", "Today");
    assert.equal(frugal.livingSource, "floor");
    assert.equal(frugal.livingDeclared, 1200);
    assert.ok(frugal.living >= 1500 + 900, "one adult in this household, two dependants: at least 1,500 + 900, more for income: " + frugal.living);
    setState(mk(6000, 0)); recalcComputedItems();
    var spender = lenderCheck("Sell", "Today");
    assert.equal(spender.livingSource, "yours");
    assert.equal(spender.living, 6000);
  } finally { setState(keep); }
});
