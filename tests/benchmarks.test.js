import { test } from "node:test";
import assert from "node:assert/strict";
import { bandFor, bandLabel, relativeText, superComparison, netWorthComparison, retirementComparison, housingComparison } from "../src/calc/benchmarks.js";
import { BENCHMARKS } from "../src/constants.js";

test("bands: inclusive edges, open top band, unknown age", () => {
  assert.equal(bandLabel(bandFor(BENCHMARKS.super.bands, 35)), "35–39");
  assert.equal(bandLabel(bandFor(BENCHMARKS.super.bands, 39)), "35–39");
  assert.equal(bandLabel(bandFor(BENCHMARKS.super.bands, 80)), "75+");
  assert.equal(bandFor(BENCHMARKS.super.bands, null), null);
  assert.equal(bandFor(BENCHMARKS.super.bands, 12), null);
});
test("super: against the ATO median and average for the age band", () => {
  const c = superComparison(140000, 37);
  assert.equal(c.median, 65491);
  assert.equal(c.aboveMedian, true);
  assert.equal(c.aboveAverage, true);
  assert.equal(relativeText(c.balance, c.median), "2.1× ");
  assert.equal(relativeText(40000, 65491), "61% of ");
});
test("net worth and retirement", () => {
  assert.equal(netWorthComparison(600000, 37).mean, 555000);
  const r = retirementComparison(365000, true);
  assert.equal(r.comfortable, 730000);
  assert.equal(r.share, 0.5);
  assert.equal(retirementComparison(100, false).comfortable, 630000);
});
test("housing: renters and mortgage reference shares", () => {
  assert.deepEqual(housingComparison(30000, 150000, false), { share: 0.2, ref: 0.199, tenure: "renters" });
  assert.equal(housingComparison(30000, 150000, true).ref, 0.155);
  assert.equal(housingComparison(1, 0, true), null);
});
