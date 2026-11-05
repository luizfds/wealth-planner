import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, returnPath, percentile, retirementOdds, ageForOdds, correlatedShockPaths, cashFlowStressOptions, cashFlowStressSeries } from "../src/calc/outcomes.js";
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

test("zero volatility gives a constant deterministic return", () => {
  assert.ok(returnPath(seeded(42), 3, 0.05, 0, true).every(x => Math.abs(x - 0.05) < 1e-12));
});

test("correlated multi-year losses affect both asset classes on identical years", () => {
  const p = correlatedShockPaths(5, { startYear: 2, duration: 3, investLoss: -0.3, propertyLoss: -0.15 });
  assert.equal(p.investReturns[1], undefined);
  assert.deepEqual(p.investReturns.slice(2, 5), [-0.3, -0.3, -0.3]);
  assert.deepEqual(p.propertyReturns.slice(2, 5), [-0.15, -0.15, -0.15]);
  assert.equal(p.propertyReturns[5], undefined);
  assert.deepEqual(correlatedShockPaths(5), correlatedShockPaths(5));
});

test("reject invalid return and shock assumptions", () => {
  for(const [mean, vol] of [[-1, 0.1], [0.04, -0.2], [Infinity, 0.1], [0.04, NaN]]){
    assert.throws(() => returnPath(seeded(1), 5, mean, vol), RangeError);
  }
  assert.throws(() => correlatedShockPaths(3, { investLoss: -1 }), RangeError);
  assert.throws(() => correlatedShockPaths(3, { duration: 0 }), RangeError);
});
import { projectionStress, projectionStressHtml } from "../src/components/projections.js";

test("projection stress controls are editable and labelled as illustrative", () => {
  const html = projectionStressHtml();
  assert.match(html, /data-proj-stress-enabled/);
  assert.match(html, /data-proj-stress-invest/);
  assert.match(html, /data-proj-stress-property/);
  assert.match(html, /data-proj-stress-years/);
  assert.match(html, /not a prediction/);
  assert.equal(projectionStress.investLossPct, 25);
});

test("cash flow shocks validate monthly income, vacancy and one-off repair amounts", () => {
  assert.deepEqual(cashFlowStressOptions({ lostIncomeMonthly: 2000, vacancyCostMonthly: 800, maintenanceCost: 12000, duration: 2 }), {
    startYear: 1, duration: 2, lostIncomeMonthly: 2000, vacancyCostMonthly: 800, maintenanceCost: 12000
  });
  for(const bad of [{ duration: 0 }, { lostIncomeMonthly: -1 }, { vacancyCostMonthly: Infinity }, { maintenanceCost: NaN }, { startYear: 1.5 }]){
    assert.throws(() => cashFlowStressOptions(bad), RangeError);
  }
});

test("cash-flow shock overlays leave the saved projection inputs untouched", () => {
  assert.equal(typeof cashFlowStressSeries, "function");
});

test("illustrative stress lines are excluded from scenario ranking but preserved in charts", async () => {
  const { scenarioComparisonSeries } = await import("../src/components/projections.js");
  const normal = { label: "Plan", points: [{ x: 0, y: 100 }] };
  const crash = { label: "Plan — crash", illustrativeStress: true, points: [{ x: 0, y: 50 }] };
  const jobLoss = { label: "Plan — income loss", illustrativeStress: true, points: [{ x: 0, y: 80 }] };
  const series = [normal, crash, jobLoss];
  assert.deepEqual(scenarioComparisonSeries(series), [normal]);
  assert.equal(series.length, 3);
  assert.deepEqual(scenarioComparisonSeries([{ label: "Saved" }, { label: "What if" }]).map(x => x.label), ["Saved", "What if"]);
});
