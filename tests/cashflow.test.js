import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { monthlyCashFlowForecast } from "../src/calc/cashflow.js";

// monthlyCashFlowForecast() is a module-level singleton consumer (imports { state } directly),
// same as calc/engine.js — see engine.test.js's own resetState() for why this resets every field
// it touches rather than constructing a fresh state object.
function resetState(){
  state.scenarios = ["Test"];
  state.baselineScenario = "Test";
  state.activeScenario = "Test";
  state.income = [];
  state.shared = [];
  state.home = { Test: [] };
  state.properties = [];
  state.transactions = [];
}
// The due month one full period from now (1-12) — guaranteed to land inside the 12-month window
// monthlyCashFlowForecast(12) returns starting at the current month, regardless of what "today"
// actually is when the test suite runs.
function nextMonthNum(){
  return (new Date().getMonth() + 1) % 12 + 1;
}

test("monthlyCashFlowForecast smooths plain Monthly items evenly across every month", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  state.shared = [{ id: "s1", what: "Rent", amount: 1000, freq: "Monthly" }];
  var forecast = monthlyCashFlowForecast(12);
  assert.equal(forecast.baselineNet, 5000);
  assert.equal(forecast.months.length, 12);
  forecast.months.forEach(function(m){
    assert.equal(m.net, 5000);
    assert.equal(m.items.length, 0);
  });
});

test("monthlyCashFlowForecast places an explicit-dueMonth Yearly expense in that month only, full amount", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  var due = nextMonthNum();
  state.shared = [{ id: "s1", what: "House Insurance", amount: 1200, freq: "Yearly", dueMonth: due }];
  var forecast = monthlyCashFlowForecast(12);
  // Smoothed baseline excludes the lumpy item entirely — it's placed at full amount, not averaged.
  assert.equal(forecast.baselineNet, 6000);
  var hitMonths = forecast.months.filter(function(m){ return m.items.length > 0; });
  assert.equal(hitMonths.length, 1);
  assert.equal(hitMonths[0].month, due);
  assert.equal(hitMonths[0].net, 6000 - 1200);
  assert.equal(hitMonths[0].items[0].what, "House Insurance");
  assert.equal(hitMonths[0].items[0].side, "expense");
  // Every other month stays at the plain baseline, unaffected by the one-off.
  forecast.months.filter(function(m){ return m.month !== due; }).forEach(function(m){
    assert.equal(m.net, 6000);
  });
});

test("monthlyCashFlowForecast places a Quarterly item every third month from its due month", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  state.shared = [{ id: "s1", what: "Council Rates", amount: 400, freq: "Quarterly", dueMonth: 1 }];
  var forecast = monthlyCashFlowForecast(12);
  var hitMonths = forecast.months.filter(function(m){ return m.items.length > 0; }).map(function(m){ return m.month; });
  // Jan, Apr, Jul, Oct — every 12-month window contains exactly 4 occurrences regardless of
  // which month it starts on.
  assert.equal(hitMonths.length, 4);
  hitMonths.forEach(function(m){ assert.equal((m - 1) % 3, 0); });
});

test("monthlyCashFlowForecast smooths an irregular item into every month regardless of its own frequency", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  state.shared = [{ id: "s1", what: "Extras / Misc", amount: 1200, freq: "Yearly", irregular: true }];
  var forecast = monthlyCashFlowForecast(12);
  assert.equal(forecast.reserveExpense, 100); // 1200/yr smoothed to $100/mo
  assert.equal(forecast.baselineNet, 6000 - 100);
  forecast.months.forEach(function(m){
    assert.equal(m.net, 5900);
    assert.equal(m.items.length, 0); // reserve items never appear as a one-off in any month
  });
});

test("monthlyCashFlowForecast falls back to smoothing a Yearly item with no resolvable due month", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  // No dueMonth, no id/history/transactions to infer one from.
  state.shared = [{ what: "Something Yearly", amount: 1200, freq: "Yearly" }];
  var forecast = monthlyCashFlowForecast(12);
  assert.equal(forecast.baselineNet, 6000 - 100); // smoothed like any other baseline cost
  forecast.months.forEach(function(m){
    assert.equal(m.net, 5900);
    assert.equal(m.items.length, 0);
  });
});

test("monthlyCashFlowForecast infers a Yearly item's due month from its last linked transaction when unset", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  state.shared = [{ id: "s1", what: "Rego", amount: 600, freq: "Yearly" }];
  var due = nextMonthNum();
  var monthStr = (due < 10 ? "0" + due : "" + due);
  state.transactions = [{ date: "2024-" + monthStr + "-10", amount: 600, linkedExpenseId: "s1" }];
  var forecast = monthlyCashFlowForecast(12);
  var hitMonths = forecast.months.filter(function(m){ return m.items.length > 0; });
  assert.equal(hitMonths.length, 1);
  assert.equal(hitMonths[0].month, due);
});

test("monthlyCashFlowForecast doesn't double-count an investment property's rent via its raw income rows", function(){
  resetState();
  // No synthetic "<property> — Rent" row here (that's computed by calc/engine.js's
  // recalcComputedItems(), a separate side-effecting pass) — only the raw p.income row, so this
  // proves collectCashFlowEntries() doesn't also walk p.income directly.
  state.properties = [{ id: "p1", kind: "IP", loans: [], income: [{ what: "Rent", amount: 2000, freq: "Monthly" }], expenses: [] }];
  var forecast = monthlyCashFlowForecast(12);
  assert.equal(forecast.baselineNet, 0);
});

test("monthlyCashFlowForecast includes an investment property's lumpy expenses at their due month", function(){
  resetState();
  state.income = [{ what: "Salary", incomeType: "Net", amount: 6000, freq: "Monthly" }];
  var due = nextMonthNum();
  state.properties = [{
    id: "p1", kind: "IP", loans: [],
    income: [],
    expenses: [{ id: "e1", what: "Property Maintenance", amount: 2000, freq: "Yearly", dueMonth: due }]
  }];
  var forecast = monthlyCashFlowForecast(12);
  var hitMonths = forecast.months.filter(function(m){ return m.items.length > 0; });
  assert.equal(hitMonths.length, 1);
  assert.equal(hitMonths[0].month, due);
  assert.equal(hitMonths[0].items[0].what, "Property Maintenance");
});
