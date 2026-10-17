import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { superTopUp } = await import("../src/calc/supertopup.js");
const { incomeTaxAU, medicareLevyAU } = await import("../src/calc/tax.js");

test("superTopUp: deduction at the marginal rate, 15% in the fund, capped at the room", () => {
  const r = { taxable: 150000, capAvailable: 30000, totalConcessional: 18000, div293Income: 168000 };
  const t = superTopUp(r, 20000, 2026);
  assert.equal(t.room, 12000);
  assert.equal(t.amount, 12000);
  assert.equal(t.overRoom, 8000);
  const saved = (incomeTaxAU(150000, 2026) + medicareLevyAU(150000, 2026)) - (incomeTaxAU(138000, 2026) + medicareLevyAU(138000, 2026));
  assert.equal(t.taxSaved, Math.round(saved));
  assert.equal(t.contributionsTax, 1800);
  assert.equal(t.div293, 0);
  assert.equal(t.superAdded, 10200);
  assert.equal(t.outOfPocket, 12000 - Math.round(saved));
  assert.ok(t.netGain > 2000);
});
test("superTopUp: Division 293 adds 15% on the part over the threshold", () => {
  const r = { taxable: 260000, capAvailable: 30000, totalConcessional: 20000, div293Income: 280000 };
  const t = superTopUp(r, 10000, 2026);
  // $30k over; $20k already in contributions is caught first, leaving $10k for the top-up.
  assert.equal(t.div293, 1500);
});
test("superTopUp: no room, nothing to do", () => {
  const t = superTopUp({ taxable: 90000, capAvailable: 30000, totalConcessional: 30000, div293Income: 0 }, 5000, 2026);
  assert.equal(t.amount, 0); assert.equal(t.taxSaved, 0); assert.equal(t.room, 0);
});
