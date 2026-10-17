import { test } from "node:test";
import assert from "node:assert/strict";
import { shareFlows, xirr, fixedRateValue, indexValue, priceDatesNeeded } from "../src/calc/performance.js";

const id = (a, x) => x;
const holding = {
  category: "Shares", what: "IVV", amount: 12100,
  lots: [{ date: "2024-01-01", units: 100, price: 100, brokerage: 0 }],
  sales: []
};

test("shareFlows: lots become buys, sales become proceeds; holdings without lots are listed", () => {
  const r = shareFlows([holding, { category: "Shares", what: "Old", amount: 500, lots: [] }, { category: "Cash", amount: 9 }], id);
  assert.deepEqual(r.flows, [{ date: "2024-01-01", amount: -10000 }]);
  assert.equal(r.value, 12100);
  assert.deepEqual(r.excluded, ["Old"]);
});
test("xirr: one buy, two years, 10% a year", () => {
  const r = xirr([{ date: "2024-01-01", amount: -10000 }], 12100, "2026-01-01");
  assert.ok(Math.abs(r - 0.1) < 0.002, String(r));
  assert.equal(xirr([], 0, "2026-01-01"), null);
  assert.equal(xirr([{ date: "2026-01-01", amount: -1 }], 1, "2026-01-10"), null);
});
test("fixedRateValue: the same flows at 7%", () => {
  const v = fixedRateValue([{ date: "2024-01-01", amount: -10000 }], 0.07, "2026-01-01");
  assert.ok(Math.abs(v - 10000 * Math.pow(1.07, 2.0007)) < 5, String(v));
});
test("indexValue: same dollars into the index, sales sell index units", () => {
  const prices = { "2024-01-01": 50, "2025-01-01": 80 };
  const flows = [{ date: "2024-01-01", amount: -10000 }, { date: "2025-01-01", amount: 4000 }];
  const r = indexValue(flows, d => prices[d], 100);
  assert.equal(r.units, 150);
  assert.equal(r.value, 15000);
  assert.deepEqual(indexValue(flows, d => null, 0).missing, ["2024-01-01", "2025-01-01", "today"]);
  assert.deepEqual(priceDatesNeeded([...flows, { date: "2024-01-01", amount: -1 }]), ["2024-01-01", "2025-01-01"]);
});

import { parseBenchmarkSymbol, setBenchmarkPrice, benchmarkPriceOn, benchmarkFormula } from "../src/calc/performance.js";
test("benchmark prices: paste symbols, store, read back, formulas", () => {
  assert.deepEqual(parseBenchmarkSymbol("ioz@2024-03-01"), { symbol: "IOZ", date: "2024-03-01" });
  assert.deepEqual(parseBenchmarkSymbol("IOZ@NOW"), { symbol: "IOZ", date: "now" });
  assert.equal(parseBenchmarkSymbol("IOZ"), null);
  const b = { prices: {} };
  setBenchmarkPrice(b, "IOZ", "2024-03-01", "31.5", "2026-10-18");
  setBenchmarkPrice(b, "IOZ", "now", 34, "2026-10-18");
  assert.equal(benchmarkPriceOn(b, "IOZ", "2024-03-01"), 31.5);
  assert.equal(b.prices.IOZ.nowDate, "2026-10-18");
  setBenchmarkPrice(b, "IOZ", "2024-03-01", "", "2026-10-18");
  assert.equal(benchmarkPriceOn(b, "IOZ", "2024-03-01"), null);
  assert.equal(benchmarkFormula("IOZ", "now"), '=GOOGLEFINANCE("ASX:IOZ","price")');
  assert.match(benchmarkFormula("IOZ", "2024-03-01"), /^=INDEX\(GOOGLEFINANCE\("ASX:IOZ","close",DATE\(2024,3,1\)-7,DATE\(2024,3,1\)\+1\),ROWS\(/);
});
