import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { categorySpendingChanges } from "../src/calc/spendinginsights.js";
import { categoryInsightsHtml } from "../src/components/recurringrules.js";

test("spending changes distinguish categories, missing months and unexpected amounts", () => {
  const tx = [
    { date: "2026-09-10", amount: 40, category: "Food" },
    { date: "2026-10-10", amount: 140, category: "Food" },
    { date: "2026-09-12", amount: 20, category: "Transport" },
    { date: "2026-10-11", amount: 10 },
    { date: "2026-10-12", amount: -50, category: "Food" }
  ];
  const rows = categorySpendingChanges(tx, "2026-10");
  const food = rows.find(r => r.category === "Food");
  assert.equal(food.delta, 100);
  assert.equal(food.changePct, 250);
  const transport = rows.find(r => r.category === "Transport");
  assert.equal(transport.currentCount, 0);
  assert.equal(transport.changePct, -100);
  const html = categoryInsightsHtml(tx, "2026-10-20");
  assert.match(html, /current month may be incomplete/);
  assert.match(html, /no transactions recorded this month/);
  assert.doesNotMatch(html, /because of inflation|likely due to/);
});

test("category labels are escaped and missing observations are explicit", () => {
  assert.match(categoryInsightsHtml([], "2026-10-20"), /No category spending comparisons/);
  const html = categoryInsightsHtml([{ date: "2026-10-01", amount: 5, category: "<img src=x>" }], "2026-10-20");
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
