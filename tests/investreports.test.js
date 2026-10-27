import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { holdingReturns, distributionYears, cgtParcels, netCapitalGain } from "../src/calc/investreports.js";

// Invented holdings: Fund A bought in two lots, part sold; Fund B in USD.
const fundA = () => ({ category: "Shares", what: "Fund A", symbol: "AAA", market: "ASX", quantity: 150, price: 12,
  lots: [{ id: "l1", date: "2023-08-01", units: 100, price: 10, brokerage: 10, soldUnits: 50 }, { id: "l2", date: "2026-03-01", units: 100, price: 11, brokerage: 10, soldUnits: 0 }],
  sales: [{ date: "2025-09-01", units: 50, proceeds: 600, costBase: 505, parcels: [{ lotId: "l1", acquired: "2023-08-01", units: 50, costBase: 505 }] }],
  payouts: [{ date: "2025-03-31", cash: 70, credit: 30 }, { date: "2025-09-30", cash: 50, credit: 20 }, { date: "2026-03-31", cash: 80, credit: 0 }] });
const fundB = () => ({ category: "Shares", what: "Fund B", market: "US", quantity: 10, price: 100, lots: [{ id: "b1", date: "2026-01-10", units: 10, price: 90, brokerage: 0 }], payouts: [] });
const usd = (a, v) => a.market === "US" ? v * 1.5 : v;

test("each holding: cost still held, value, gains, income, a yearly rate and the benchmark", () => {
  const h = holdingReturns([fundA(), fundB(), { category: "Cash", amount: 5 }], { today: "2026-10-01", toAud: usd, benchmark: { symbol: "IOZ", fixedRate: 7, prices: {} } });
  assert.equal(h.rows.length, 2);
  const a = h.rows.find(r => r.name === "Fund A");
  assert.equal(a.cost, 505 + 1110); assert.equal(a.value, 1800); assert.equal(a.gain, 185);
  assert.equal(a.income, 250); assert.equal(a.realised, 95); assert.equal(a.total, 530);
  assert.ok(a.annual > a.priceOnly && a.priceOnly > 0);
  assert.equal(a.bench, 0.07); assert.equal(a.benchKind, "fixed");
  const b = h.rows.find(r => r.name === "Fund B");
  assert.equal(b.currency, "USD"); assert.equal(b.cost, 1350); assert.equal(b.value, 1500);
  assert.equal(h.total.value, 3300); assert.ok(h.total.annual > 0);
});

test("distributions by financial year, cash and franking, holding by holding", () => {
  const y = distributionYears([fundA()]);
  assert.deepEqual(y.map(x => x.label), ["FY25/26", "FY24/25"]);
  assert.deepEqual([y[0].cash, y[0].credit, y[0].total], [130, 20, 150]);
  assert.equal(y[1].holdings[0].total, 100);
});

test("capital gains: sold parcels with the discount and the net gain; held parcels and when their discount starts", () => {
  const c = cgtParcels([fundA()], { today: "2026-10-01" });
  assert.equal(c.realised.length, 1);
  const p = c.realised[0].parcels[0];
  assert.deepEqual([p.proceeds, p.cost, p.gain, p.discount, p.taxable], [600, 505, 95, true, 47.5]);
  assert.equal(c.realised[0].net.net, 47.5);
  assert.equal(c.unrealised.length, 2);
  assert.equal(c.unrealised[0].acquired, "2023-08-01"); assert.ok(c.unrealised[0].discount);
  assert.equal(c.unrealised[0].gain, 600 - 505); assert.equal(c.unrealised[0].taxable, 47.5);
  const young = c.unrealised[1];
  assert.equal(young.discount, false); assert.equal(young.discountFrom, "2027-03-02"); assert.equal(young.taxable, 1200 - 1110);
});

test("the net capital gain takes losses off undiscounted gains first, then halves what's left of the rest", () => {
  const n = netCapitalGain([{ gain: 1000, discount: true }, { gain: 300, discount: false }, { gain: -500 }]);
  assert.deepEqual(n, { gains: 1300, losses: 500, net: 400, carriedLoss: 0 });
  assert.equal(netCapitalGain([{ gain: 100, discount: true }, { gain: -300 }]).carriedLoss, 200);
});
