import { test } from "node:test";
import assert from "node:assert/strict";
import { firstYearAtLeast, debtFreeYear, leadChanges, milestoneAmounts } from "../src/calc/milestones.js";

const pts = (ys, debts) => ys.map((y, x) => ({ x, y, debt: debts ? debts[x] : 0 }));

test("firstYearAtLeast: first year at or above, null when never", () => {
  const p = pts([300, 600, 1000, 1400]);
  assert.equal(firstYearAtLeast(p, 1000), 2);
  assert.equal(firstYearAtLeast(p, 300), 0);
  assert.equal(firstYearAtLeast(p, 5000), null);
});
test("debtFreeYear: needs debt today, and a year it reaches ~0", () => {
  assert.equal(debtFreeYear(pts([1, 2, 3], [500, 100, 0.4])), 2);
  assert.equal(debtFreeYear(pts([1, 2, 3], [0, 0, 0])), null);
  assert.equal(debtFreeYear(pts([1, 2, 3], [500, 400, 300])), null);
});
test("leadChanges: reports overtakes, not ties", () => {
  const a = { label: "Rent", points: pts([100, 200, 300, 400]) };
  const b = { label: "Buy", points: pts([90, 200.2, 350, 500]) };
  assert.deepEqual(leadChanges([a, b]), [{ year: 2, leader: "Buy", behind: "Rent" }]);
  assert.deepEqual(leadChanges([a]), []);
});
test("milestoneAmounts: the next round steps above today, at most three", () => {
  const s = [{ points: pts([320000, 900000, 1700000, 2600000]) }];
  assert.deepEqual(milestoneAmounts(s), [500000, 1000000, 1500000]);
  const big = [{ points: pts([3200000, 9000000]) }];
  assert.deepEqual(milestoneAmounts(big), [4000000, 5000000, 6000000]);
});
