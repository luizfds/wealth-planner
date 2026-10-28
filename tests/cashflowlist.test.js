import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { cashflowEntries, filterEntries, filterChoices, entryTotals, addTransfer, deleteTransfer, splitTransaction, unsplit, bulkEditTransactions, bulkDeleteTransactions } from "../src/calc/cashflowlist.js";
import { budgetPlanHtml } from "../src/components/cashflow.js";

function withState(fn){
  var keep = { transactions: state.transactions, incomeLog: state.incomeLog, transfers: state.transfers, income: state.income };
  try {
    state.income = [{ id: "r1", what: "Tutoring", incomeType: "Net", amount: 400, freq: "Monthly", person: "Sam" }];
    state.transactions = [
      { id: "t1", date: "2026-05-02", amount: 60, linkedExpenseId: "g", account: "Bank One", what: "" },
      { id: "t2", date: "2026-05-09", amount: 25, linkedExpenseId: null, account: "Card", what: "Fern Café", category: "Eating out" }
    ];
    state.incomeLog = [{ id: "i1", date: "2026-05-05", amount: 400, target: "income:r1", account: "Bank One", what: "" }];
    state.transfers = [{ id: "x1", date: "2026-05-10", amount: 200, from: "Bank One", to: "Card", what: "Card repayment" }];
    fn();
  } finally { Object.assign(state, keep); }
}
var lines = [{ id: "g", what: "Groceries", category: "Food", person: "Alex" }];
var opts = { lines: lines, categoryOf: function(t){ return t.category || (t.linkedExpenseId === "g" ? "Food" : ""); } };

test("one list of money in, out and transfers, newest first", function(){
  withState(function(){
    var e = cashflowEntries(opts);
    assert.deepEqual(e.map(function(x){ return x.kind + ":" + x.date; }), ["transfer:2026-05-10", "out:2026-05-09", "in:2026-05-05", "out:2026-05-02"]);
    var inn = e.find(function(x){ return x.kind === "in"; });
    assert.equal(inn.label, "Tutoring");
    assert.equal(inn.person, "Sam");
    assert.equal(e.find(function(x){ return x.ref === 0; }).person, "Alex");
    var t = entryTotals(e);
    assert.deepEqual(t, { in: 400, out: 85, net: 315 }, "transfers are never totalled");
  });
});

test("filters: direction, account (either side of a transfer), category, line, person, text", function(){
  withState(function(){
    var e = cashflowEntries(opts);
    assert.equal(filterEntries(e, { direction: "out" }).length, 2);
    assert.deepEqual(filterEntries(e, { account: "Card" }).map(function(x){ return x.kind; }), ["transfer", "out"]);
    assert.equal(filterEntries(e, { category: "Food" })[0].ref, 0);
    assert.equal(filterEntries(e, { line: "income:r1" })[0].kind, "in");
    assert.equal(filterEntries(e, { person: "Sam" }).length, 1);
    assert.equal(filterEntries(e, { text: "fern" })[0].label, "Fern Café");
    var ch = filterChoices(e);
    assert.deepEqual(ch.accounts, ["Bank One", "Card"]);
    assert.deepEqual(ch.people, ["Alex", "Sam"]);
  });
});

test("transfers add and delete without touching spending", function(){
  withState(function(){
    var r = addTransfer({ date: "2026-05-12", amount: "50.555", from: "Bank One", to: "Savings" });
    assert.equal(r.amount, 50.56);
    assert.equal(state.transactions.length, 2);
    assert.equal(deleteTransfer(r.id).record.id, r.id);
    assert.equal(deleteTransfer("nope"), null);
  });
});

test("a split becomes several ordinary transactions and merges back", function(){
  withState(function(){
    var made = splitTransaction(0, [{ linkedExpenseId: "g", amount: 40 }, { linkedExpenseId: "h", amount: 20 }]);
    assert.equal(made.length, 2);
    assert.equal(state.transactions.length, 3);
    assert.deepEqual(state.transactions.slice(0, 2).map(function(t){ return t.linkedExpenseId + "=" + t.amount; }), ["g=40", "h=20"]);
    assert.equal(state.transactions[0].splitGroup, state.transactions[1].splitGroup);
    assert.equal(state.transactions[1].date, "2026-05-02");
    assert.equal(splitTransaction(2, [{ amount: 25 }]), null, "one part is not a split");
    var merged = unsplit(state.transactions[0].splitGroup);
    assert.equal(merged.amount, 60);
    assert.equal(state.transactions.length, 2);
    assert.equal(state.transactions[0].splitGroup, undefined);
  });
});

test("bulk edit sets only what was asked; bulk delete returns what it removed in order", function(){
  withState(function(){
    assert.equal(bulkEditTransactions([0, 1], { account: "Bank Two" }), 2);
    assert.equal(state.transactions[1].account, "Bank Two");
    assert.equal(state.transactions[1].linkedExpenseId, null);
    bulkEditTransactions([1], { linkedExpenseId: "g" });
    assert.equal(state.transactions[1].linkedExpenseId, "g");
    var gone = bulkDeleteTransactions([0, 1]);
    assert.deepEqual(gone.map(function(x){ return x.index; }), [0, 1]);
    assert.equal(state.transactions.length, 0);
  });
});

test("the month planned runs income down through each group to what's left", function(){
  var html = budgetPlanHtml({ income: [{ label: "Pay", monthly: 5000 }], groups: [{ label: "Housing", monthly: 2000 }, { label: "Food", monthly: 800 }], other: 300, net: 1900 });
  assert.match(html, /Pay<\/span><b>\+\$5,000<\/b><em class="">\$5,000/);
  assert.match(html, /Food<\/span><b>−\$800<\/b><em class="">\$2,200/);
  assert.match(html, /Investment loan repayments<\/span><b>−\$300<\/b><em class="">\$1,900/);
  assert.match(html, /Left over each month<\/span><b><\/b><em class="pos">\$1,900/);
});

test("the month planned: a normal month first, then the year's bonuses averaged in", function(){
  // Invented: pay 5,000 a month, spending 3,100, a bonus worth 600 a month across the year.
  var html = budgetPlanHtml({ income: [{ label: "Pay", monthly: 5000 }, { label: "Bonus (after tax)", monthly: 600, oneOff: true }],
    groups: [{ label: "Housing", monthly: 2000 }, { label: "Food", monthly: 800 }], other: 300, net: 2500 });
  assert.match(html, /Left over in a normal month<\/span><b><\/b><em class="pos">\$1,900/);
  assert.match(html, /Once a year, averaged over twelve months/);
  assert.match(html, /Left over a month across the year<\/span><b><\/b><em class="pos">\$2,500/);
  assert.ok(html.indexOf("normal month") < html.indexOf("Bonus (after tax)"), "the bonus comes after the normal month");
});
