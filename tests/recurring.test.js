import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { cadenceOf, unbudgetedRecurring, risingLines } from "../src/calc/recurring.js";
import { recurringHtml } from "../src/components/recurring.js";

test("cadence from dates: monthly, fortnightly, or none when irregular", function(){
  assert.equal(cadenceOf(["2026-06-03", "2026-07-03", "2026-08-04", "2026-09-03"]), "Monthly");
  assert.equal(cadenceOf(["2026-09-01", "2026-09-15", "2026-09-29"]), "Fortnightly");
  assert.equal(cadenceOf(["2026-09-01", "2026-09-04", "2026-09-30", "2026-10-02"]), null);
  assert.equal(cadenceOf(["2026-09-01", "2026-10-01"]), null, "two charges aren't a pattern");
});

test("repeating payees with no line; groceries-like and stopped ones are left out", function(){
  var tx = [
    { date: "2026-07-05", amount: 15.99, what: "STREAMCO SUBSCRIPTION 001" }, { date: "2026-08-05", amount: 15.99, what: "STREAMCO SUBSCRIPTION 002" },
    { date: "2026-09-05", amount: 15.99, what: "STREAMCO SUBSCRIPTION 003" }, { date: "2026-10-05", amount: 17.99, what: "STREAMCO SUBSCRIPTION 004" },
    { date: "2026-07-01", amount: 80, what: "FERN GROCER" }, { date: "2026-08-01", amount: 210, what: "FERN GROCER" }, { date: "2026-09-01", amount: 35, what: "FERN GROCER" },
    { date: "2026-01-10", amount: 9, what: "OLD APP" }, { date: "2026-02-10", amount: 9, what: "OLD APP" }, { date: "2026-03-10", amount: 9, what: "OLD APP" },
    { date: "2026-07-07", amount: 40, what: "GYM CO", linkedExpenseId: "g" }
  ];
  var r = unbudgetedRecurring(tx, "2026-10-18");
  assert.deepEqual(r.map(function(x){ return x.key; }), ["streamco subscription"]);
  assert.equal(r[0].freq, "Monthly");
  assert.equal(r[0].amount, 15.99);
  assert.deepEqual(r[0].indices, [0, 1, 2, 3]);
  assert.match(recurringHtml(r, []), /data-rc-add="streamco subscription">Add to budget/);
});

test("a line whose recent charges run above its budget", function(){
  var lines = [{ id: "p", what: "Phone", amount: 40, freq: "Monthly" }, { id: "q", what: "Gas", amount: 100, freq: "Monthly" }];
  var tx = [
    { linkedExpenseId: "p", date: "2026-06-02", amount: 40 }, { linkedExpenseId: "p", date: "2026-07-02", amount: 40 },
    { linkedExpenseId: "p", date: "2026-08-02", amount: 45 }, { linkedExpenseId: "p", date: "2026-09-02", amount: 45 }, { linkedExpenseId: "p", date: "2026-10-02", amount: 45 },
    { linkedExpenseId: "q", date: "2026-09-02", amount: 101 }, { linkedExpenseId: "q", date: "2026-10-02", amount: 99 }
  ];
  var r = risingLines(lines, tx);
  assert.equal(r.length, 1);
  assert.equal(r[0].recent, 45);
  assert.equal(r[0].earlier, 40);
  assert.equal(r[0].extraMonthly, 5);
  assert.match(recurringHtml([], r), /Update to \$45\.00/);
});
