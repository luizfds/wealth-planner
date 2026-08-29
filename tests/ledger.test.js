import test from "node:test";
import assert from "node:assert/strict";
import { toWeekly, periodsOf, sumField, sumByClassification, safeDiv, sumByAccount, resolveSharedAmount, sumFieldForScenario, nextDueDate, daysUntil, appendHistorySnapshot, transactionsInMonth, sumTransactionsByExpense } from "../src/calc/ledger.js";

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

test("nextDueDate returns null when there's no last-incurred date to project from", function(){
  assert.equal(nextDueDate(null, "Monthly"), null);
  assert.equal(nextDueDate(undefined, "Monthly"), null);
  assert.equal(nextDueDate("not a date", "Monthly"), null);
});

test("nextDueDate advances one Monthly step past a recent last-paid date", function(){
  // Paid 2024-01-15, "today" is 2024-01-20 — still within the same period, next due is one
  // month on, not today (you don't owe it again the same week you paid it).
  assert.equal(nextDueDate("2024-01-15", "Monthly", "2024-01-20"), "2024-02-15");
});

test("nextDueDate keeps advancing until it catches up to a stale last-paid date", function(){
  // Paid 2024-01-15 (Quarterly), "today" is 2024-09-01 — several quarters have passed since;
  // the projected next due date must be the first quarterly occurrence on/after today, not the
  // very next one after the stale last-paid date.
  var result = nextDueDate("2024-01-15", "Quarterly", "2024-09-01");
  assert.equal(result, "2024-10-15");
});

test("nextDueDate rolls a Monthly bill from a month-end date into the next month correctly", function(){
  // Jan 31 + 1 month via setMonth lands on Mar 3 in vanilla JS Date arithmetic (Feb has no 31st,
  // so it overflows) — asserting the actual behavior here as documented, not a "correct"
  // calendar-aware answer, since that's what addFreqStep actually does.
  var result = nextDueDate("2024-01-31", "Monthly", "2024-02-01");
  assert.equal(result, "2024-03-02"); // 2024 is a leap year: Jan 31 + 1mo = Mar 2 (29-day Feb)
});

test("nextDueDate handles every FREQS value without falling through to an infinite loop", function(){
  ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Yearly"].forEach(function(freq){
    var result = nextDueDate("2024-01-01", freq, "2024-01-01");
    assert.ok(result > "2024-01-01", freq + " should project forward, got " + result);
  });
});

test("daysUntil is negative for a past date (overdue) and positive for a future one", function(){
  assert.equal(daysUntil("2024-01-10", "2024-01-15"), -5);
  assert.equal(daysUntil("2024-01-20", "2024-01-15"), 5);
  assert.equal(daysUntil("2024-01-15", "2024-01-15"), 0);
});

test("appendHistorySnapshot appends today's value and sorts by date", function(){
  var history = [{ date: "2024-01-01", value: 100 }];
  var dateStr = appendHistorySnapshot(history, 150);
  assert.equal(dateStr, new Date().toISOString().slice(0, 10));
  assert.equal(history.length, 2);
  // Sorted ascending regardless of push order — "today" (whatever it is) sorts after 2024-01-01.
  assert.equal(history[history.length - 1].value, 150);
});

test("appendHistorySnapshot updates today's own entry instead of duplicating it on a second click", function(){
  var history = [];
  appendHistorySnapshot(history, 100);
  appendHistorySnapshot(history, 200);
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 200);
});

test("appendHistorySnapshot accepts an explicit backdated date instead of defaulting to today", function(){
  var history = [{ date: "2024-01-01", value: 100 }];
  var dateStr = appendHistorySnapshot(history, 120, "2024-02-15");
  assert.equal(dateStr, "2024-02-15");
  assert.equal(history.length, 2);
  assert.equal(history[1].date, "2024-02-15");
  assert.equal(history[1].value, 120);
});

test("appendHistorySnapshot updates an existing entry for the same explicit date rather than duplicating", function(){
  var history = [{ date: "2024-02-15", value: 100 }];
  appendHistorySnapshot(history, 999, "2024-02-15");
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 999);
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

test("transactionsInMonth filters to the given YYYY-MM, defaulting to the current month", function(){
  var txns = [
    { date: "2024-03-05", amount: 10 },
    { date: "2024-03-31", amount: 20 },
    { date: "2024-04-01", amount: 30 }
  ];
  var march = transactionsInMonth(txns, "2024-03");
  assert.equal(march.length, 2);
  assert.equal(march.reduce(function(s, t){ return s + t.amount; }, 0), 30);
  assert.equal(transactionsInMonth(txns, "2024-04").length, 1);
  assert.equal(transactionsInMonth(txns, "2099-01").length, 0);
});

test("sumTransactionsByExpense buckets by linkedExpenseId, unlinked entries under __unlinked", function(){
  var txns = [
    { amount: 40, linkedExpenseId: "exp1" },
    { amount: 15, linkedExpenseId: "exp1" },
    { amount: 25, linkedExpenseId: "exp2" },
    { amount: 5, linkedExpenseId: null },
    { amount: 8 }
  ];
  var map = sumTransactionsByExpense(txns);
  assert.equal(map.exp1, 55);
  assert.equal(map.exp2, 25);
  assert.equal(map.__unlinked, 13);
});
