import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, returnPath, percentile, retirementOdds, ageForOdds } from "../src/calc/outcomes.js";
import { simulateRetirementAt } from "../src/calc/fire.js";

test("drawn returns average the set rate with the set spread, the same every time from one seed", () => {
  const a = returnPath(seeded(1), 20000, 0.07, 0.12, true), b = returnPath(seeded(1), 5, 0.07, 0.12, true);
  assert.deepEqual(a.slice(0, 6), b);
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length);
  assert.ok(Math.abs(mean - 0.07) < 0.004, String(mean)); assert.ok(Math.abs(sd - 0.12) < 0.005, String(sd));
  assert.equal(returnPath(seeded(1), 3, 0.07, 0.12)[0], undefined);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3); assert.equal(percentile([0, 10], 0.1), 1);
});

// An invented household: 40, $300k outside super, $200k in super, spending $60k.
const inputs = { currentAge: 40, preservationAge: 60, realReturn: 0.04, annualExpenses: 60000, annualSavings: 30000, superContributions: 15000,
  split: { accessible: 300000, superValue: 200000 } };

test("a steady path gives the steady answer; a run is judged by lasting to 95", () => {
  const steady = simulateRetirementAt(55, Object.assign({ toAge: 95 }, inputs));
  const flat = simulateRetirementAt(55, Object.assign({ toAge: 95, returns: Array(60).fill(0.04) }, inputs));
  assert.equal(Math.round(flat.potAtPreservation), Math.round(steady.potAtPreservation));
  const crash = simulateRetirementAt(55, Object.assign({ toAge: 95, returns: Array(15).fill(0.04).concat(Array(10).fill(-0.15)).concat(Array(40).fill(0.04)) }, inputs));
  assert.ok(crash.lastsTo < flat.lastsTo || !crash.bridgeSurvives);
});

test("the odds rise with the retirement age, and the age for 9 in 10 comes no sooner than for half", () => {
  const early = retirementOdds(48, inputs, { runs: 400 }), late = retirementOdds(62, inputs, { runs: 400 });
  assert.ok(early.chance < late.chance, early.chance + " " + late.chance);
  assert.ok(late.chance > 0.8);
  const half = ageForOdds(inputs, 0.5), nine = ageForOdds(inputs, 0.9);
  assert.ok(half != null && nine != null && nine >= half);
});
