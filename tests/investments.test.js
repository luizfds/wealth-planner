import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { portfolioPerformance, distributionHistory } from "../src/calc/investments.js";
import { performanceCardHtml, distributionsCardHtml, superContributionsCardHtml } from "../src/components/investments.js";

var assets = [
  { what: "Fund A", symbol: "AAA", category: "Shares", market: "ASX", quantity: 100, avgCost: 10, price: 12,
    payouts: [{ date: "2025-08-15", cash: 30, credit: 5 }, { date: "2026-02-15", cash: 40, credit: 0 }],
    sales: [{ date: "2026-03-01", units: 10, proceeds: 130, costBase: 100 }] },
  { what: "Fund B", symbol: "BBB", category: "Shares", market: "ASX", quantity: 50, avgCost: 20, price: 18, payouts: [{ date: "2026-08-20", cash: 25, credit: 10 }] },
  { what: "No cost", category: "Shares", market: "ASX", quantity: 5, price: 4 },
  { what: "Savings", category: "Cash", amount: 900 }
];

test("performance: cost, value, gain, distributions in the window and all time, realised, total return", function(){
  var p = portfolioPerformance(assets, { start: "2026-07-01", end: "2027-06-30" });
  assert.equal(p.rows.length, 3);
  var a = p.rows.find(function(r){ return r.symbol === "AAA"; });
  assert.equal(a.cost, 1000); assert.equal(a.value, 1200); assert.equal(a.gain, 200);
  assert.equal(a.incomeAll, 75); assert.equal(a.incomeWindow, 0); assert.equal(a.realised, 30);
  assert.equal(a.totalReturn, 305);
  assert.equal(p.cost, 2000); assert.equal(p.gain, 100, "a holding with no cost is left out of the gain");
  assert.equal(p.incomeWindow, 35);
  assert.equal(p.uncosted, 1);
  var html = performanceCardHtml(p, "FY26/27");
  assert.match(html, /Total return <b>\+\$/);
  assert.match(html, /no cost recorded/);
});

test("distributions grouped by financial year, newest first", function(){
  var h = distributionHistory(assets);
  assert.deepEqual(h.map(function(y){ return y.label + "=" + y.total; }), ["FY26/27=35", "FY25/26=75"]);
  assert.equal(h[1].credit, 5);
  assert.match(distributionsCardHtml(h), /FY25\/26<\/span>/);
});

test("super contributions card shows room or the amount over", function(){
  var html = superContributionsCardHtml([
    { person: "Alex", sg: 12000, other: 3000, total: 15000, cap: 30000, room: 15000, over: 0, used: 0.5, div293: 0 },
    { person: "Sam", sg: 26000, other: 8000, total: 34000, cap: 30000, room: 0, over: 4000, used: 1, div293: 500 }
  ], "FY26/27");
  assert.match(html, /\$15,000 of room left/);
  assert.match(html, /\$4,000 over the cap/);
  assert.match(html, /Division 293 \$500/);
  assert.match(html, /inv-super-bar over/);
});
