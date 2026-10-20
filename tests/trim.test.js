import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { trimReport, isFlexible, leanLevel, setLeanLevel, leanEffect } from "../src/calc/trim.js";
import { trimHtml } from "../src/components/trim.js";

// Trim (v3.100.0), invented household.
function withBudget(fn){
  var keys = ["shared", "transactions", "scenarios", "activeScenario", "home", "income", "properties", "purchase", "invest"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Now", "Buy"]; state.activeScenario = "Now";
    state.home = { Now: [], Buy: [] }; state.income = []; state.properties = []; state.purchase = {}; state.invest = {};
    state.shared = [
      { id: "tr", what: "Holidays", category: "Travel", classification: "Wants", irregular: true, amount: 6000, freq: "Yearly" },
      { id: "dn", what: "Dinners out", category: "Eating out", classification: "Wants", irregular: true, amount: 120, freq: "Fortnightly" },
      { id: "gr", what: "Groceries", category: "Groceries", classification: "Needs", amount: 200, freq: "Weekly" },
      { id: "st", what: "Stream One", category: "Subscriptions", classification: "Wants", amount: 12, freq: "Monthly" },
      { id: "s1", what: "iCloud", category: "Subscriptions", classification: "Wants", amount: 4.5, freq: "Monthly" },
      { id: "s2", what: "Google One", category: "Subscriptions", classification: "Wants", amount: 3, freq: "Monthly" }
    ];
    state.transactions = [];
    ["2025-10-25", "2025-11-11", "2025-12-11", "2026-01-11", "2026-02-11", "2026-03-11", "2026-04-11", "2026-05-11", "2026-06-11", "2026-07-11", "2026-08-11", "2026-09-11"].forEach(function(d){
      state.transactions.push({ linkedExpenseId: "gr", date: d, amount: 860 }, { linkedExpenseId: "dn", date: d, amount: 40 });
    });
    state.transactions.push({ linkedExpenseId: "tr", date: "2026-04-02", amount: 5800 });
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("budgeted above what's spent, flexible lines, similar subscriptions", function(){
  withBudget(function(){
    var r = trimReport({ today: "2026-10-21" });
    assert.deepEqual(r.over.map(function(x){ return x.what; }), ["Dinners out"], "planned $3,120, spent $480");
    assert.ok(r.months > 11.8, "a year logged");
    assert.ok(Math.abs(r.over[0].suggested - r.over[0].actual / 26) < 0.05, "the yearly actual, per fortnight");
    assert.ok(Math.abs(r.over[0].actual - 480) < 10);
    assert.deepEqual(r.flexible.map(function(f){ return f.what; }), ["Holidays", "Dinners out"]);
    assert.ok(!isFlexible(state.shared[2]) && !isFlexible(state.shared[3]), "needs and steady lines aren't flexible until marked");
    state.shared[3].flexible = true;
    assert.ok(isFlexible(state.shared[3]));
    state.shared[0].flexible = false;
    assert.ok(!isFlexible(state.shared[0]), "the person's mark wins");
    assert.deepEqual(r.duplicates.map(function(d){ return d.family; }), ["Cloud storage"]);
  });
});

test("a lean scenario: kept, halved or paused there only, and what it frees", function(){
  withBudget(function(){
    var hol = state.shared[0], din = state.shared[1];
    setLeanLevel(hol, "Buy", "half");
    setLeanLevel(din, "Buy", "pause");
    assert.equal(leanLevel(hol, "Buy"), "half");
    assert.equal(leanLevel(din, "Buy"), "pause");
    assert.equal(leanLevel(hol, "Now"), "keep", "the other scenario is untouched");
    assert.equal(hol.amount, 6000, "the budget itself is untouched");
    var e = leanEffect("Buy", { today: "2026-10-21" });
    assert.equal(e.freedMonthly, Math.round(3000 / 12 + 120 * 26 / 12));
    assert.equal(e.leanMonthly - e.fullMonthly, e.freedMonthly);
    setLeanLevel(hol, "Buy", "keep"); setLeanLevel(din, "Buy", "keep");
    assert.equal(hol.scenarioOverrides, undefined);
    var html = trimHtml(trimReport({ today: "2026-10-21" }), "Buy", "2026-10-21");
    assert.match(html, /Budgeted above what you spend/);
    assert.match(html, /data-trim-level="half" data-trim-line="tr"/);
    assert.match(html, /Similar subscriptions/);
    assert.match(html, /Which lines are flexible\?/);
  });
});
