import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { xirr, holdingFlows, moneyWeighted, benchmark, mixGaps, nextGoesTo, distributionsAhead, classOf } from "../src/calc/investreturn.js";
import { unitsOn } from "../src/calc/pricesheet.js";

// Worked by hand. Fern Index Fund: 10 units at $100 on 1 Jan 2021 ($1,000 in); on 1 Jan 2022 a $100
// distribution and 11 more units at $100 ($1,100 in, so $1,000 net); on 1 Jan 2023, 21 units at $110
// are worth $2,310. Years of exactly 365 days, so 1,000(1+r)² + 1,000(1+r) = 2,310 → 1 + r = 1.1:
// a money-weighted return of exactly 10% a year. The simple gain says 2,310 + 100 − 2,100 = $310 on
// $2,100, 14.8% — with no idea how long the money was in.
var fern = { category: "Shares", market: "ASX", what: "Fern Index Fund", symbol: "FRN", quantity: 21, price: 110,
  lots: [{ date: "2021-01-01", units: 10, price: 100 }, { date: "2022-01-01", units: 11, price: 100 }],
  payouts: [{ date: "2022-01-01", cash: 100 }] };

test("a hand-worked holding's money-weighted return is exactly 10%", function(){
  var f = holdingFlows(fern, "2023-01-01");
  assert.deepEqual(f.map(function(x){ return [x.date, x.amount]; }), [["2021-01-01", -1000], ["2022-01-01", -1100], ["2022-01-01", 100], ["2023-01-01", 2310]]);
  var r = xirr(f);
  assert.ok(Math.abs(r - 0.1) < 1e-9, String(r));
  // To the cent: at that rate the flows are worth nothing, and the money grown at it is $2,310.00.
  assert.equal((1000 * Math.pow(1 + r, 2) + 1000 * (1 + r)).toFixed(2), "2310.00");
});

test("overall it's one IRR over every holding's flows, and a holding without dated lots is left out", function(){
  var cash = { category: "Shares", market: "ASX", what: "No-dates Co", quantity: 5, price: 20 };
  var m = moneyWeighted([fern, cash, { category: "Cash", amount: 500 }], "2023-01-01");
  assert.equal(m.rows.length, 1);
  assert.ok(Math.abs(m.irr - 0.1) < 1e-9);
  assert.equal(m.uncounted, 1);
  assert.equal(m.since, "2021-01-01");
});

test("xirr: a loss, a single-year doubling, and no answer when there's nothing to solve", function(){
  assert.ok(Math.abs(xirr([{ date: "2021-01-01", amount: -1000 }, { date: "2022-01-01", amount: 2000 }]) - 1) < 1e-9);
  assert.ok(Math.abs(xirr([{ date: "2021-01-01", amount: -1000 }, { date: "2022-01-01", amount: 800 }]) + 0.2) < 1e-9);
  assert.equal(xirr([{ date: "2021-01-01", amount: -1000 }]), null);
  assert.equal(xirr([{ date: "2021-01-01", amount: -1000 }, { date: "2022-01-01", amount: -5 }]), null);
});

test("the same money in an index that also grew 10% a year ends level, to the cent", function(){
  var series = [{ date: "2021-01-01", close: 50 }, { date: "2021-07-01", close: 52 }, { date: "2022-01-01", close: 55 }, { date: "2023-01-01", close: 60.5 }];
  var b = benchmark(holdingFlows(fern, "2023-01-01"), series, "2023-01-01");
  // 20 units for $1,000; $1,000 net more at $55 is 18.1818…; 38.1818… × $60.50 = $2,310.00.
  assert.equal(b.value, 2310);
  assert.equal(b.mine, 2310);
  assert.ok(Math.abs(b.irr - 0.1) < 1e-9);
  assert.deepEqual(b.points.map(function(p){ return p.date; }), ["2021-01-01", "2021-07-01", "2022-01-01", "2023-01-01"]);
  assert.equal(b.points[1].index, 1040); // 20 units × $52
  // With dividends at 2% a year reinvested, the index does better than the holding.
  var withDiv = benchmark(holdingFlows(fern, "2023-01-01"), series, "2023-01-01", { yieldPct: 2 });
  assert.ok(withDiv.value > 2310 && withDiv.irr > 0.1);
  assert.equal(benchmark(holdingFlows(fern, "2023-01-01"), series.slice(2), "2023-01-01").coveredFrom, "2022-01-01");
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
