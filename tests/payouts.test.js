import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { state } = await import("../src/state.js");
const { personDividends, payoutsBetween } = await import("../src/calc/tax.js");

function withAssets(assets, fn){
  const keep = { assets: state.assets, income: state.income };
  try { state.assets = assets; state.income = [{ what: "Pay", person: "Sam", incomeType: "Gross", amount: 100000, freq: "Yearly" }]; return fn(); }
  finally { Object.assign(state, keep); }
}
const fy = { start: "2025-07-01", end: "2026-06-30" };

test("payoutsBetween: inclusive window", () => {
  const a = { payouts: [{ date: "2025-07-01", cash: 10, credit: 4 }, { date: "2026-07-01", cash: 99, credit: 0 }] };
  assert.deepEqual(payoutsBetween(a, fy.start, fy.end), { cash: 10, credit: 4, count: 1 });
});
test("personDividends: a named year uses what was received over the per-unit estimate", () => {
  const h = { category: "Shares", quantity: 100, dividendPerUnit: 1, frankedPct: 100,
    payouts: [{ date: "2025-09-15", cash: 60, credit: 25.71 }, { date: "2026-03-15", cash: 55, credit: 23.57 }] };
  const y = withAssets([h], () => personDividends("Sam", fy, { yearMode: true }));
  assert.equal(y.cash, 115); assert.ok(Math.abs(y.credit - 49.28) < 1e-9); assert.equal(y.actualCount, 2);
  const r = withAssets([h], () => personDividends("Sam", fy, { yearMode: false }));
  assert.equal(r.cash, 100);
});
test("personDividends: no per-unit figure falls back to the last twelve months received", () => {
  const h = { category: "Shares", quantity: 100, payouts: [{ date: "2026-01-10", cash: 40, credit: 0 }, { date: "2024-01-10", cash: 999, credit: 0 }] };
  const r = withAssets([h], () => personDividends("Sam", fy, { today: "2026-10-18" }));
  assert.equal(r.cash, 40);
});
