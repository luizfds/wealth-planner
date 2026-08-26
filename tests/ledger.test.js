import test from "node:test";
import assert from "node:assert/strict";
import { toWeekly, periodsOf, sumField, sumByClassification, safeDiv, sumByAccount, resolveSharedAmount, sumFieldForScenario } from "../src/calc/ledger.js";

test("toWeekly converts every frequency to a weekly figure", function(){
  assert.equal(toWeekly(100, "Weekly"), 100);
  assert.equal(toWeekly(100, "Fortnightly"), 50);
  assert.equal(toWeekly(100, "Yearly"), 100 / 52);
  assert.equal(toWeekly(100, "Unknown"), 0);
  assert.equal(toWeekly("not a number", "Weekly"), 0);
});

test("periodsOf derives every period from the weekly figure consistently", function(){
  var p = periodsOf(100, "Weekly");
  assert.equal(p.weekly, 100);
  assert.equal(p.fortnightly, 200);
  assert.ok(Math.abs(p.monthly - (100 * 52 / 12)) < 1e-9);
  assert.ok(Math.abs(p.yearly - 5200) < 1e-9);
});

test("sumField sums a list of ledger rows in the requested period", function(){
  var items = [
    { amount: 100, freq: "Weekly" },
    { amount: 50, freq: "Fortnightly" }
  ];
  // 100/wk + 25/wk (50 fortnightly) = 125/wk
  assert.ok(Math.abs(sumField(items, "weekly") - 125) < 1e-9);
});

test("sumByClassification only totals rows matching the given classification", function(){
  var items = [
    { amount: 100, freq: "Weekly", classification: "Needs" },
    { amount: 50, freq: "Weekly", classification: "Wants" }
  ];
  assert.equal(sumByClassification(items, "Needs", "weekly"), 100);
  assert.equal(sumByClassification(items, "Wants", "weekly"), 50);
  assert.equal(sumByClassification(items, "Savings", "weekly"), 0);
});

test("safeDiv guards against division by zero", function(){
  assert.equal(safeDiv(10, 2), 5);
  assert.equal(safeDiv(10, 0), 0);
});

test("resolveSharedAmount falls back to the plain amount with no override for this scenario", function(){
  var item = { amount: 100, freq: "Weekly" };
  assert.equal(resolveSharedAmount(item, "Renting"), 100);
  item.scenarioOverrides = {};
  assert.equal(resolveSharedAmount(item, "Renting"), 100);
});

test("resolveSharedAmount uses the scenario-specific override when one is set", function(){
  var item = { amount: 100, freq: "Weekly", scenarioOverrides: { "Buy Brisbane": 40 } };
  assert.equal(resolveSharedAmount(item, "Buy Brisbane"), 40);
  assert.equal(resolveSharedAmount(item, "Renting"), 100);
});

test("resolveSharedAmount treats an explicit 0 override as a real value, not 'unset'", function(){
  var item = { amount: 100, freq: "Weekly", scenarioOverrides: { "Buy Brisbane": 0 } };
  assert.equal(resolveSharedAmount(item, "Buy Brisbane"), 0);
});

test("sumFieldForScenario sums each item's resolved (possibly overridden) amount for that scenario", function(){
  var items = [
    { amount: 100, freq: "Weekly" },
    { amount: 100, freq: "Weekly", scenarioOverrides: { "Buy Brisbane": 40 } }
  ];
  assert.equal(sumFieldForScenario(items, "Renting", "weekly"), 200);
  assert.equal(sumFieldForScenario(items, "Buy Brisbane", "weekly"), 140);
});

test("sumByAccount groups by trimmed account name, defaulting blanks to Unassigned", function(){
  var items = [
    { amount: 100, freq: "Weekly", account: "Everyday" },
    { amount: 50, freq: "Weekly", account: "  Everyday  " },
    { amount: 25, freq: "Weekly", account: "" }
  ];
  var map = sumByAccount(items, "weekly");
  assert.equal(map.Everyday, 150);
  assert.equal(map.Unassigned, 25);
});
