import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { rentalComparison, applyRentalComparison, budgetComparison, applyBudgetComparison, loggedMonths } from "../src/calc/closeyear.js";
import { dataHealthChecks } from "../src/calc/health.js";

// Close the year and data health (v3.48.0), on an invented household.
function prop(){
  return { id: "r1", what: "9 Sample Ave", kind: "IP", ownership: { Alex: 50, Sam: 50 },
    income: [{ what: "Rent", amount: 500, freq: "Weekly" }],
    expenses: [{ what: "Council rates", amount: 600, freq: "Quarterly" }, { what: "Water rates", amount: 200, freq: "Quarterly" },
      { id: "pmFee6", computed: true, what: "Agent fee", amount: 120, freq: "Monthly" }],
    loans: [], acquisitionCosts: [] };
}
function withState(extra, fn){
  var keys = ["properties", "taxYears", "transactions", "income", "tax", "accounts", "shared"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.properties = [prop()];
    state.taxYears = { 2025: { people: {}, evidence: {}, lodged: {}, properties: { r1: { lines: { rent: 27300, councilRates: 2500, water: 800, pestControl: 330, interest: 9000 } } } } };
    state.transactions = []; state.accounts = []; state.shared = [];
    state.income = [{ person: "Alex", incomeType: "Gross", amount: 1, freq: "Yearly" }, { person: "Sam", incomeType: "Gross", amount: 1, freq: "Yearly" }];
    state.tax = Object.assign({}, state.tax, { settings: { Alex: { dateOfBirth: "1990-01-01" }, Sam: { dateOfBirth: "1991-01-01" } } });
    Object.assign(state, extra || {});
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("rental: each typed line against its rows; derived lines compared but not applied", function(){
  withState(null, function(){
    var by = {}; rentalComparison(state.properties[0], 2025).forEach(function(r){ by[r.key] = r; });
    assert.equal(by.rent.planned, 26000); assert.equal(by.rent.actual, 27300); assert.equal(by.rent.action, "set");
    assert.equal(by.councilRates.action, "set");
    assert.equal(by.pestControl.action, "add", "nothing in the plan for it, so a new row");
    assert.equal(by.interest.action, null, "interest comes from the loans");
  });
});

test("applying sets rows to the actual (keeping the old amount in history) and adds missing lines", function(){
  withState(null, function(){
    var p = state.properties[0];
    var n = applyRentalComparison(p, 2025, ["rent", "councilRates", "pestControl", "interest"], "2026-10-18");
    assert.equal(n, 3);
    assert.equal(p.income[0].amount, 525, "27,300 a year as a weekly figure");
    assert.deepEqual(p.income[0].history, [{ date: "2025-07-01", value: 500 }, { date: "2026-10-18", value: 525 }]);
    assert.equal(p.expenses[0].amount, 625);
    var pest = p.expenses[p.expenses.length - 1];
    assert.equal(pest.what, "Pest control"); assert.equal(pest.amount, 330); assert.equal(pest.rentLine, "pestControl");
    assert.equal(p.expenses[1].amount, 200, "water wasn't picked");
  });
});

test("budget: logged spend scaled to a year when logging covered part of it", function(){
  var items = [{ id: "g", what: "Groceries", amount: 200, freq: "Weekly" }, { id: "s", what: "Streaming", amount: 20, freq: "Monthly" }];
  var tx = [{ date: "2026-01-10", amount: 900, linkedExpenseId: "g" }, { date: "2026-06-20", amount: 5100, linkedExpenseId: "g" }, { date: "2025-06-30", amount: 999, linkedExpenseId: "g" }];
  assert.equal(loggedMonths(tx, 2025, "2026-10-18"), 6);
  var b = budgetComparison(items, tx, 2025, "2026-10-18");
  assert.equal(b.rows.length, 1, "a line with nothing logged says nothing");
  assert.equal(b.rows[0].logged, 6000); assert.equal(b.rows[0].actual, 12000); assert.equal(b.rows[0].planned, 10400);
  assert.equal(applyBudgetComparison(items, tx, 2025, ["g"], "2026-10-18"), 1);
  assert.ok(Math.abs(items[0].amount - 12000 / 52) < 0.01);
});

test("health: unclaimed and double-claimed deductions, ownership, ghost accounts, duplicates, plan drift", function(){
  withState(null, function(){
    state.properties[0].ownership = { Alex: 50, Sam: 40 };
    state.properties[0].expenses[0].deductible = true;
    state.properties[0].acquisitionCosts = [{ what: "Registration", amount: 1234.5 }, { what: "Titles office", amount: 1234.5 }];
    state.accounts = [{ name: "Bank One" }];
    var items = [
      { id: "a", what: "Laptop", amount: 1200, freq: "Yearly", deductible: true, account: "Bank One", category: "Work" },
      { id: "b", what: "Old claim", amount: 100, freq: "Yearly", deductible: true, claimProperty: "zz", account: "Bank Two", category: "Work" },
      { id: "c", what: "Gym", amount: 50, freq: "Monthly", deductiblePerson: "Sam", account: "Bank One", category: "" },
      { id: "d", what: "Gym", amount: 50, freq: "Monthly", account: "Bank One", category: "Fitness" }
    ];
    var ids = dataHealthChecks({ items: items, today: "2026-10-18" }).map(function(c){ return c.id; });
    ["ded-noperson", "ded-noprop", "ded-noflag", "ded-propdouble", "own:r1", "rows-ghostacct", "rows-nocat", "dup-acq", "dup-lines", "plan-rent:r1:2025"].forEach(function(id){
      assert.ok(ids.indexOf(id) !== -1, id + " in " + ids.join(","));
    });
    assert.equal(ids.indexOf("people-dob"), -1);
    var checks = dataHealthChecks({ items: items, today: "2026-10-18" });
    assert.equal(checks[0].severity, "bad", "worst first");
  });
});

test("health: a clean household passes", function(){
  withState(null, function(){
    state.taxYears = {};
    assert.deepEqual(dataHealthChecks({ items: [{ id: "a", what: "Rent", amount: 1, freq: "Monthly", account: "", category: "Housing" }], today: "2026-10-18" }).map(function(c){ return c.id; }), ["rows-noaccount"]);
  });
});
