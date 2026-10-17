import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { saleScenario } = await import("../src/calc/sale.js");
const { incomeTaxAU, medicareLevyAU } = await import("../src/calc/tax.js");

const prop = { value: 630000, purchasePrice: 437318, purchaseDate: "2015-03-01",
  acquisitionCosts: [{ amount: 20000 }], loans: [{ balance: 400000, rate: 6, termYears: 30, repaymentType: "PI" }] };

test("saleScenario: costs, payout, discounted gain split 70/30 and taxed at each owner's rates", () => {
  const r = saleScenario(prop, { today: "2026-10-18", saleDate: "2026-10-18", salePrice: 700000, agentPct: 2, otherCosts: 3000,
    owners: [{ name: "A", pct: 70, taxable: 150000 }, { name: "B", pct: 30, taxable: 110000 }] });
  assert.equal(r.sellingCosts, 17000);
  assert.equal(r.loanPayout, 400000);
  assert.equal(r.discount, true);
  assert.equal(r.paid, 457318);
  // No depreciation schedule on this fixture, so the cost base is what was paid.
  assert.equal(r.gain, 700000 - 17000 - 457318);
  const a = r.owners[0];
  assert.equal(a.assessable, Math.round(r.gain * 0.7 / 2));
  const expected = Math.round(incomeTaxAU(150000 + r.gain * 0.35, 2026) + medicareLevyAU(150000 + r.gain * 0.35, 2026) - incomeTaxAU(150000, 2026) - medicareLevyAU(150000, 2026));
  assert.ok(Math.abs(a.tax - expected) <= 1, a.tax + " vs " + expected);
  assert.equal(a.cash, Math.round((700000 - 17000 - 400000) * 0.7 - a.tax));
});
test("saleScenario: no discount inside twelve months; a loss is taxed at nothing", () => {
  const p = Object.assign({}, prop, { purchaseDate: "2026-01-01" });
  assert.equal(saleScenario(p, { today: "2026-10-18", saleDate: "2026-10-18", salePrice: 700000, owners: [] }).discount, false);
  const loss = saleScenario(prop, { today: "2026-10-18", saleDate: "2026-10-18", salePrice: 400000, owners: [{ name: "A", pct: 100, taxable: 100000 }] });
  assert.equal(loss.owners[0].tax, 0);
  assert.ok(loss.owners[0].loss > 0);
});
test("saleScenario: a later sale grows today's value and pays down the loan", () => {
  const r = saleScenario(prop, { today: "2026-10-18", saleDate: "2031-10-18", growthPct: 5, owners: [] });
  assert.ok(Math.abs(r.salePrice - Math.round(630000 * Math.pow(1.05, 5.0007))) < 200);
  assert.ok(r.loanPayout < 400000 && r.loanPayout > 350000, String(r.loanPayout));
  assert.equal(saleScenario(Object.assign({}, prop, { purchasePrice: null }), { today: "2026-10-18", saleDate: "2026-10-18", owners: [] }).gain, null);
});
