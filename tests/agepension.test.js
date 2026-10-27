import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { agePension, deemedIncome, minDrawdownRate, drawdownPlan } from "../src/calc/agepension.js";

test("minimum drawdown rates by age", () => {
  assert.deepEqual([60, 65, 74, 75, 80, 85, 90, 95].map(minDrawdownRate), [0.04, 0.05, 0.05, 0.06, 0.07, 0.09, 0.11, 0.14]);
});

test("the Age Pension: full under both tests, cut by the assets test, cut by deemed income, nothing past the cut-off", () => {
  const full = agePension({ couple: true, homeowner: true, assets: 200000, financial: 100000 });
  assert.equal(full.yearly, Math.round(1777 * 26)); assert.equal(full.test, "neither");
  // A couple who own their home with $681,500: $200,000 over → $600 a fortnight less.
  const cut = agePension({ couple: true, homeowner: true, assets: 681500, financial: 681500 });
  assert.equal(cut.byAssets, Math.round((1777 - 600) * 26)); assert.equal(cut.test, "assets");
  assert.equal(deemedIncome(106200, true), 106200 * 0.0075);
  assert.equal(Math.round(deemedIncome(206200, true)), Math.round(106200 * 0.0075 + 100000 * 0.0275));
  // Income: $30,000 of rent a year is well past the free area.
  const inc = agePension({ couple: false, homeowner: false, assets: 0, financial: 0, otherIncome: 30000 });
  assert.equal(inc.test, "income"); assert.ok(inc.yearly < 1178.7 * 26);
  assert.equal(agePension({ couple: false, homeowner: true, assets: 2000000, financial: 2000000 }).yearly, 0);
});

const plan = (extra) => Object.assign({ retireAge: 60, preservationAge: 60, accessible: 50000, superBalance: 600000, realReturn: 0.04,
  annualExpenses: 60000, couple: true, homeowner: true, otherAssets: 20000, otherIncome: 0 }, extra);

test("drawdown: super pays at least its minimum, the pension tops up from 67, and the money lasts", () => {
  const d = drawdownPlan(plan());
  assert.equal(d.rows[0].age, 60); assert.equal(d.rows[d.rows.length - 1].age, 95);
  assert.equal(d.pensionFrom, 67);
  const at67 = d.rows.find(r => r.age === 67), at66 = d.rows.find(r => r.age === 66);
  assert.equal(at66.pension, 0); assert.ok(at67.pension > 0);
  d.rows.filter(r => r.age >= 60).forEach(r => assert.ok(r.drawn >= r.minimum - 1 || r.pot === 0));
  assert.equal(d.lastsTo, 95);
  assert.ok(d.pensionShare > 0.3);
  // Without enough, it runs short — and says when.
  const thin = drawdownPlan(plan({ superBalance: 100000, accessible: 0, homeowner: false, annualExpenses: 90000 }));
  assert.ok(thin.lastsTo < 95);
  assert.ok(thin.rows.find(r => r.age === thin.lastsTo).short > 0);
});
