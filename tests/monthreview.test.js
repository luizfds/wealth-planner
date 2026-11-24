import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { monthReview, reviewMonth, statementInMonth, setStatementAmount, markReviewed, shiftMonth } from "../src/calc/monthreview.js";

// Monthly review (v3.54.0), invented household.
function withState(fn){
  var keys = ["income", "incomeLog", "transactions", "accounts", "properties", "assets", "monthReviews", "taxYears", "tax"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.income = [{ syntheticNetFor: "Alex", computed: true, what: "Alex — net", incomeType: "Net", amount: 5000, freq: "Monthly" },
      { id: "t", what: "Tutoring", incomeType: "Net", amount: 300, freq: "Monthly" },
      { id: "p", what: "Pay", person: "Alex", incomeType: "Gross", amount: 1, freq: "Yearly" }];
    state.properties = []; state.assets = []; state.taxYears = {}; state.monthReviews = {};
    state.tax = Object.assign({}, state.tax, { settings: { Alex: { dateOfBirth: "1990-01-01" } } });
    state.accounts = [{ name: "Card One", type: "credit", statementStartDay: 15 }, { name: "Bank One", type: "debit" }];
    state.incomeLog = [{ id: "a", date: "2026-09-14", amount: 4950, target: "net:Alex" }];
    state.transactions = [
      { id: "1", date: "2026-08-20", amount: 120, linkedExpenseId: "g", account: "Card One" },
      { id: "2", date: "2026-09-05", amount: 300, linkedExpenseId: "g", account: "Card One" },
      { id: "3", date: "2026-09-16", amount: 40, linkedExpenseId: "f", account: "Card One" }
    ];
    fn([{ id: "g", what: "Groceries", amount: 400, freq: "Monthly", category: "Groceries", account: "Card One" },
        { id: "f", what: "Fuel", amount: 100, freq: "Monthly", category: "Car", account: "Card One" },
        { id: "trip", what: "Travel", amount: 6000, freq: "Yearly", irregular: true, category: "Travel", account: "Bank One" }]);
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}
var cat = function(items){ return function(t){ var i = items.find(function(x){ return x.id === t.linkedExpenseId; }); return i ? i.category : ""; }; };

test("money in, statements, and the month against the plan", function(){
  withState(function(items){
    var r = monthReview("2026-09", { items: items, categoryOf: cat(items), today: "2026-10-03" });
    assert.equal(r.label, "September 2026");
    assert.deepEqual(r.income.map(function(x){ return [x.key, x.received, x.planned]; }), [["net:Alex", 4950, 5000], ["income:t", 0, 300]]);
    assert.equal(r.missingIncome, 1);
    assert.equal(r.statements.length, 1);
    assert.deepEqual([r.statements[0].start, r.statements[0].end, r.statements[0].logged, r.statements[0].gap], ["2026-08-15", "2026-09-14", 420, null]);
    setStatementAmount("2026-09", "Card One", 455.5);
    assert.equal(monthReview("2026-09", { items: items, categoryOf: cat(items) }).statements[0].gap, 35.5);
    assert.equal(r.spent, 340);
    assert.equal(r.plannedSpend, 500, "the travel reserve stays out of a month's plan");
    assert.deepEqual(r.categories.map(function(c){ return c.category; }), ["Car", "Groceries"], "most over plan first");
  });
});

// The follow-up review (November 2026): a real household's Today planned $148 more than its Budget — two lines that had
// ended still counted in the month's plan. Budget's rule (calc/budgetsplit.js): a line runs in a month if it does on the 15th.
test("a line that has ended, or not started, isn't in the month's plan", function(){
  withState(function(items){
    var more = items.concat([
      { id: "old", what: "Old gym", amount: 60, freq: "Monthly", category: "Fun", endDate: "2026-09-02" },
      { id: "new", what: "New class", amount: 40, freq: "Monthly", category: "Fun", startDate: "2026-09-20" },
      { id: "late", what: "Ends late", amount: 25, freq: "Monthly", category: "Fun", endDate: "2026-09-30" }]);
    assert.equal(monthReview("2026-09", { items: more, categoryOf: cat(more), today: "2026-10-03" }).plannedSpend, 525);
  });
});

test("the review is for last month until it's marked done", function(){
  withState(function(){
    assert.equal(reviewMonth("2026-10-03"), "2026-09");
    markReviewed("2026-09", true, "2026-10-03");
    assert.equal(reviewMonth("2026-10-03"), "2026-10");
    markReviewed("2026-09", false);
    assert.equal(reviewMonth("2026-10-03"), "2026-09");
  });
});

test("statement in a month: the cycle that closed within it", function(){
  assert.deepEqual(statementInMonth(15, "2026-09"), { start: "2026-08-15", end: "2026-09-14" });
  assert.deepEqual(statementInMonth(1, "2026-09"), { start: "2026-09-01", end: "2026-09-30" });
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
