import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { flowsIrr, holdingFlows, moneyWeighted, benchmark, mixGaps, nextGoesTo, distributionsAhead, classOf } from "../src/calc/investreturn.js";
import { unitsOn } from "../src/calc/pricesheet.js";

// Worked by hand. The app's one IRR (calc/performance.js) counts years of 365.25 days, so the dates are
// four years apart: 1,461 days, exactly 4 of its years. Fern Index Fund: 10 units at $100 on 1 Jan 2021
// ($1,000 in); on 1 Jan 2025 a $100 distribution and 11 more units at $100 ($1,100 in, $1,000 net);
// on 1 Jan 2029 the 21 units are worth $3,607.69. At 10% a year, $1,000 for eight years and $1,000
// for four come to 1,000 × 1.1⁸ + 1,000 × 1.1⁴ = 2,143.59 + 1,464.10 = $3,607.69 — so the
// money-weighted return is 10%. The simple gain says 3,607.69 + 100 − 2,100 = $1,607.69 on $2,100,
// 76.6% — with no idea how long the money was in.
var fern = { category: "Shares", market: "ASX", what: "Fern Index Fund", symbol: "FRN", quantity: 21, price: 3607.69 / 21,
  lots: [{ date: "2021-01-01", units: 10, price: 100 }, { date: "2025-01-01", units: 11, price: 100 }],
  payouts: [{ date: "2025-01-01", cash: 100 }] };
var END = "2029-01-01";

test("a hand-worked holding's money-weighted return is 10%, to the cent", function(){
  var f = holdingFlows(fern, END);
  assert.deepEqual(f.map(function(x){ return [x.date, Math.round(x.amount * 100) / 100]; }), [["2021-01-01", -1000], ["2025-01-01", -1100], ["2025-01-01", 100], [END, 3607.69]]);
  var r = flowsIrr(f, END);
  assert.ok(Math.abs(r - 0.1) < 1e-5, String(r));
  // To the cent: the money grown at that rate is $3,607.69.
  assert.equal((1000 * Math.pow(1 + r, 8) + 1000 * Math.pow(1 + r, 4)).toFixed(2), "3607.69");
});

test("overall it's one IRR over every holding's flows, and a holding without dated lots is left out", function(){
  var cash = { category: "Shares", market: "ASX", what: "No-dates Co", quantity: 5, price: 20 };
  var m = moneyWeighted([fern, cash, { category: "Cash", amount: 500 }], END);
  assert.equal(m.rows.length, 1);
  assert.ok(Math.abs(m.irr - 0.1) < 1e-5);
  assert.equal(m.uncounted, 1);
  assert.equal(m.since, "2021-01-01");
});

test("flowsIrr: a doubling, a loss, and no answer when nothing went in", function(){
  assert.ok(Math.abs(flowsIrr([{ date: "2021-01-01", amount: -1000 }, { date: "2025-01-01", amount: 2000 }], "2025-01-01") - (Math.pow(2, 0.25) - 1)) < 1e-5);
  assert.ok(flowsIrr([{ date: "2021-01-01", amount: -1000 }, { date: "2025-01-01", amount: 800 }], "2025-01-01") < 0);
  assert.equal(flowsIrr([{ date: "2021-01-01", amount: -1000 }], "2025-01-01"), null);
  assert.equal(flowsIrr([{ date: "2025-01-01", amount: 1000 }], "2025-01-01"), null);
});

test("the same money in an index that also grew 10% a year ends level, to the cent", function(){
  // An index at $50, $73.205 and $107.1795…: 10% a year over each four-year stretch.
  var series = [{ date: "2021-01-01", close: 50 }, { date: "2023-01-01", close: 60 }, { date: "2025-01-01", close: 73.205 }, { date: END, close: 50 * Math.pow(1.1, 8) }];
  var b = benchmark(holdingFlows(fern, END), series, END);
  // 20 units for $1,000; $1,000 net more at $73.205 is 13.66…; 33.66… × $107.18 = $3,607.69.
  assert.equal(b.value, 3607.69);
  assert.equal(b.mine, 3607.69);
  assert.ok(Math.abs(b.irr - 0.1) < 1e-5);
  assert.deepEqual(b.points.map(function(p){ return p.date; }), ["2021-01-01", "2023-01-01", "2025-01-01", END]);
  assert.equal(b.points[1].index, 1200); // 20 units × $60
  // With dividends at 2% a year reinvested, the index does better than the holding.
  var withDiv = benchmark(holdingFlows(fern, END), series, END, { yieldPct: 2 });
  assert.ok(withDiv.value > 3607.69 && withDiv.irr > 0.1);
  assert.equal(benchmark(holdingFlows(fern, END), series.slice(2), END).coveredFrom, "2025-01-01");
});

test("a target mix: the gap in dollars and where the next $X goes", function(){
  var assets = [
    { category: "Shares", market: "ASX", amount: 60000 }, { category: "Shares", market: "US", amount: 20000 },
    { category: "Cash", amount: 20000 }, { category: "Super", amount: 90000 }
  ];
  assert.equal(classOf(assets[3]), null);
  var mix = mixGaps(assets, { "Australian shares": 50, "International shares": 40, "Cash": 10 });
  assert.equal(mix.total, 100000);
  assert.deepEqual(mix.rows.map(function(r){ return [r.cls, r.gap]; }), [["Australian shares", -10000], ["International shares", 20000], ["Cash", -10000]]);
  // $10,000 more: international is $24,000 short of 40% of $110,000 and gets all of it.
  assert.deepEqual(nextGoesTo(mix, 10000), [{ cls: "International shares", amount: 10000 }]);
  // $200,000 more fills every gap and splits the rest by target.
  var big = nextGoesTo(mix, 200000);
  assert.equal(Math.round(big.reduce(function(s, x){ return s + x.amount; }, 0)), 200000);
  assert.equal(big[0].cls, "International shares");
});

test("distributions in the year ahead, from the year before, scaled to the units held now", function(){
  var a = { category: "Shares", market: "ASX", what: "Fern Index Fund", quantity: 30,
    lots: [{ date: "2025-01-01", units: 20, price: 10 }, { date: "2026-03-01", units: 10, price: 10 }],
    payouts: [{ date: "2025-08-15", cash: 40 }, { date: "2026-02-15", cash: 44 }, { date: "2024-08-15", cash: 99 }] };
  var ahead = distributionsAhead([a], "2026-07-01", unitsOn);
  assert.deepEqual(ahead.map(function(m){ return [m.month, m.total]; }), [["2026-08", 60], ["2027-02", 66]]);
});
