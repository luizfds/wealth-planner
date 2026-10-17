import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, monthFraction } from "../src/calc/goals.js";

const ctx = { savingsRate: 0.2, netWorth: 500000, runwayMonths: 4, superTotal: 300000,
  categoryMonthToDate: { Groceries: 600, Dining: 900 }, monthFraction: 0.5,
  projectedNetWorthAt: d => d === "2030-06-30" ? 1100000 : 700000 };

test("goals: higher-is-better kinds", () => {
  assert.equal(goalProgress({ kind: "savingsRate", target: 0.25 }, ctx).status, "behind");
  assert.equal(goalProgress({ kind: "savingsRate", target: 0.2 }, ctx).status, "met");
  assert.equal(goalProgress({ kind: "emergencyFund", target: 3 }, ctx).status, "met");
  assert.equal(goalProgress({ kind: "superBalance", target: 600000 }, ctx).pct, 0.5);
});
test("goals: net worth by a date uses the projection", () => {
  assert.equal(goalProgress({ kind: "netWorth", target: 1000000, by: "2030-06-30" }, ctx).status, "on-track");
  assert.equal(goalProgress({ kind: "netWorth", target: 1000000, by: "2028-06-30" }, ctx).status, "behind");
  assert.equal(goalProgress({ kind: "netWorth", target: 1000000 }, ctx).status, "behind");
  assert.equal(goalProgress({ kind: "netWorth", target: 400000 }, ctx).status, "met");
});
test("goals: a spending cap is paced through the month", () => {
  assert.equal(goalProgress({ kind: "categorySpend", category: "Groceries", target: 1000 }, ctx).status, "ahead-of-pace");
  assert.equal(goalProgress({ kind: "categorySpend", category: "Groceries", target: 1400 }, ctx).status, "within");
  assert.equal(goalProgress({ kind: "categorySpend", category: "Dining", target: 800 }, ctx).status, "over");
  assert.equal(goalProgress({ kind: "categorySpend", category: "Nothing", target: 100 }, ctx).current, 0);
});
test("goals: unset and unknown", () => {
  assert.equal(goalProgress({ kind: "savingsRate", target: "" }, ctx).status, "unset");
  assert.equal(goalProgress({ kind: "savingsRate", target: 0.1 }, Object.assign({}, ctx, { savingsRate: null })).status, "unknown");
});
test("monthFraction", () => {
  assert.equal(monthFraction("2026-06-15"), 0.5);
  assert.equal(monthFraction("2026-02-28"), 1);
});
