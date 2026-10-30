import { test } from "node:test";
import assert from "node:assert/strict";
import { flexKindOf, flexTotals, flexMonth } from "../src/calc/flexbudget.js";

var L = function(item, monthly){ return { item: item, monthly: monthly }; };
var lines = [
  L({ id: "rent", what: "Rent", category: "Housing", classification: "Needs", freq: "Weekly", amount: 500 }, 2166.67),
  L({ id: "power", what: "Electricity", category: "Utilities", classification: "Needs", freq: "Monthly", amount: 160 }, 160),
  L({ id: "groc", what: "Groceries", category: "Groceries", classification: "Needs", freq: "Weekly", amount: 150 }, 650),
  L({ id: "cafe", what: "Fern Café", category: "Eating out", classification: "Wants", freq: "Monthly", amount: 200 }, 200),
  L({ id: "rego", what: "Car rego", category: "Car", classification: "Needs", freq: "Yearly", amount: 840 }, 70),
  L({ id: "trip", what: "Holidays", category: "Travel", classification: "Wants", freq: "Monthly", amount: 300, irregular: true }, 300)
];

test("each line lands where a household would put it, and can say otherwise", function(){
  var k = {}; lines.forEach(function(l){ k[l.item.id] = flexKindOf(l.item); });
  assert.deepEqual(k, { rent: "fixed", power: "fixed", groc: "flex", cafe: "flex", rego: "nonmonthly", trip: "nonmonthly" });
  assert.equal(flexKindOf(Object.assign({}, lines[2].item, { flexKind: "fixed" })), "fixed", "the line's own answer wins");
  assert.equal(flexKindOf(Object.assign({}, lines[2].item, { flexKind: "nonsense" })), "flex");
});

test("the three totals are the same money as the detailed view", function(){
  var t = flexTotals(lines);
  var all = lines.reduce(function(s, l){ return s + l.monthly; }, 0);
  assert.ok(Math.abs(t.fixed + t.flex + t.nonmonthly - all) < 0.001);
  assert.equal(Math.round(t.flex), 850);
});

var tx = [
  { date: "2026-09-06", amount: 170, linkedExpenseId: "groc" },
  { date: "2026-09-20", amount: 120, linkedExpenseId: "cafe" },
  { date: "2026-10-04", amount: 700, linkedExpenseId: "groc" },
  { date: "2026-10-09", amount: 60, linkedExpenseId: "cafe" },
  { date: "2026-10-11", amount: 2166.67, linkedExpenseId: "rent" },     // a fixed bill: not flexible spending
  { date: "2026-10-12", amount: 35, category: "Eating out" },          // a one-off: is
  { date: "2026-11-03", amount: 100, linkedExpenseId: "groc" }
];
var catOf = function(t){ var m = { groc: "Groceries", cafe: "Eating out", rent: "Housing" }; return t.linkedExpenseId ? m[t.linkedExpenseId] : t.category; };

test("the flexible month: planned, spent (one-offs in, fixed bills out), left", function(){
  var m = flexMonth(lines, tx, "2026-10", { categoryOf: catOf });
  assert.equal(Math.round(m.planned), 850);
  assert.equal(m.spent, 795);
  assert.equal(Math.round(m.left), 55);
  var eat = m.byCategory.find(function(c){ return c.category === "Eating out"; });
  assert.equal(eat.spent, 95);
  assert.equal(eat.left, 105);
});

test("rollover carries each month since it started, over the period picker's months", function(){
  var m = flexMonth(lines, tx, "2026-11", { categoryOf: catOf, rollover: { Groceries: "2026-09", "Eating out": "2026-11" } });
  var g = m.byCategory.find(function(c){ return c.category === "Groceries"; });
  // September: 650 − 170 = +480; October: 650 − 700 = −50 → +430 carried into November.
  assert.equal(Math.round(g.rolled), 430);
  assert.equal(Math.round(g.left), 650 + 430 - 100);
  var e = m.byCategory.find(function(c){ return c.category === "Eating out"; });
  assert.equal(e.rolled, 0, "started this month: nothing carried yet");
  var sept = flexMonth(lines, tx, "2026-09", { categoryOf: catOf, rollover: { Groceries: "2026-09" } });
  assert.equal(sept.byCategory.find(function(c){ return c.category === "Groceries"; }).rolled, 0);
});
