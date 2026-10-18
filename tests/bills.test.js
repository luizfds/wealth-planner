import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { occurrencesBetween, billsForMonth } from "../src/calc/bills.js";
import { billsCalendarHtml } from "../src/components/cashflow.js";
import { rulesPageHtml, setRuleField, ruleTest } from "../src/components/rules.js";

test("occurrences keep the anchor's day, clamped to short months", function(){
  assert.deepEqual(occurrencesBetween("2026-01-31", "Monthly", "2026-02-01", "2026-02-28"), ["2026-02-28"]);
  assert.deepEqual(occurrencesBetween("2026-01-31", "Monthly", "2026-03-01", "2026-03-31"), ["2026-03-31"]);
  assert.deepEqual(occurrencesBetween("2026-07-20", "Quarterly", "2026-10-01", "2026-10-31"), ["2026-10-20"]);
  assert.deepEqual(occurrencesBetween("2026-07-20", "Quarterly", "2026-09-01", "2026-09-30"), []);
  assert.deepEqual(occurrencesBetween("2026-09-28", "Fortnightly", "2026-10-01", "2026-10-31"), ["2026-10-12", "2026-10-26"]);
  assert.deepEqual(occurrencesBetween("2026-10-20", "Monthly", "2026-08-01", "2026-08-31"), ["2026-08-20"], "steps backwards too");
});

test("a month's bills: paid when logged near the date, overdue when past and not, undated when never logged", function(){
  var items = [
    { id: "a", what: "Phone", amount: 50, freq: "Monthly" },
    { id: "b", what: "Gym", amount: 20, freq: "Weekly" },
    { id: "c", what: "Rates", amount: 400, freq: "Quarterly" },
    { id: "d", what: "Travel", amount: 3000, freq: "Yearly", irregular: true }
  ];
  var tx = [{ linkedExpenseId: "a", date: "2026-09-03" }, { linkedExpenseId: "a", date: "2026-10-04" }, { linkedExpenseId: "b", date: "2026-10-02" }];
  var r = billsForMonth(items, tx, "2026-10", "2026-10-18");
  assert.equal(r.days["2026-10-04"][0].what, "Phone");
  assert.equal(r.days["2026-10-04"][0].paid, true);
  assert.equal(r.days["2026-10-09"][0].overdue, true);
  assert.equal(r.days["2026-10-23"][0].overdue, false);
  assert.deepEqual(r.undated.map(function(u){ return u.what; }), ["Rates"]);
  assert.equal(r.total, 50 + 20 * 5);
  var html = billsCalendarHtml(r, "2026-10", "2026-10-18");
  assert.match(html, /October 2026/);
  assert.match(html, /bc-bill paid" title="Phone \$50 — paid"/);
  assert.match(html, /1 regular line with no payment logged yet/);
  // 1 October 2026 is a Thursday: three blank cells before it
  assert.equal((html.match(/bc-cell is-blank/g) || []).length, 3);
});

test("import rules: list, test a description, edit a field", function(){
  var keep = { importRules: state.importRules, accounts: state.accounts, categories: state.categories };
  try {
    state.importRules = [{ id: "r1", match: "fern cafe", linkedExpenseId: "e1", category: "", account: "", hits: 3 }, { id: "r2", match: "bank one interest", incomeTarget: "income:x", account: "", hits: 1 }];
    state.accounts = [{ name: "Card" }];
    state.categories = ["Food"];
    ruleTest.text = "FERN CAFE 0042 NEWTOWN";
    var html = rulesPageHtml([{ id: "e1", what: "Coffee" }]);
    assert.match(html, /Matched by <b>“fern cafe”<\/b> → Coffee/);
    assert.match(html, /class="rl-row is-hit"/);
    assert.match(html, /3×/);
    assert.match(html, /data-rl-key="incomeTarget"/);
    assert.ok(setRuleField(0, "match", "  Fern Café North! "));
    assert.equal(state.importRules[0].match, "fern caf north");
    assert.equal(setRuleField(0, "match", "!!"), false);
    setRuleField(0, "category", "Food");
    setRuleField(0, "linkedExpenseId", "e2");
    assert.equal(state.importRules[0].category, "", "a line replaces a category");
  } finally { Object.assign(state, keep); ruleTest.text = ""; }
});
