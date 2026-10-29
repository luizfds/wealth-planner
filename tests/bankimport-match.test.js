import "./_env.js";
// commitBankImport persists, and the debounced save reports its status on the page: a page with nothing on it.
var el = function(){ return { style: {}, dataset: {}, classList: { add: function(){}, remove: function(){}, toggle: function(){}, contains: function(){ return false; } }, setAttribute: function(){}, removeAttribute: function(){}, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; } }; };
if(typeof globalThis.document === "undefined") globalThis.document = { getElementById: el, querySelector: el, querySelectorAll: function(){ return []; } };
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { startBankImport, commitBankImport, undoBankImport } from "../src/components/bank-import.js";
import * as BI from "../src/components/bank-import.js";

// v3.150.0: what was logged by hand is matched to its statement row — the bank's amount and date,
// its own line, category and words kept; undo puts it back. Invented.
function withLedger(fn){
  var keep = { transactions: state.transactions, transfers: state.transfers, accounts: state.accounts, importRules: state.importRules, shared: state.shared };
  try {
    state.accounts = [{ name: "Card A", type: "credit" }];
    state.transfers = []; state.importRules = []; state.shared = [{ id: "l1", what: "Software", amount: 20, freq: "Monthly" }];
    state.transactions = [
      { id: "h1", date: "2026-03-11", amount: 18.00, what: "Software plan", linkedExpenseId: "l1", account: "Card A" },
      { id: "h2", date: "2026-03-12", amount: 9.40, what: "", category: "Eating out", account: "" }
    ];
    fn();
  } finally { Object.assign(state, keep); }
}
var CSV = "Date,Description,Amount\n11/03/2026,EXAMPLE APP 12.00 USD+FOREIGN FEE AUD 0.54,-18.54\n13/03/2026,FERN CAFE,-9.40\n15/03/2026,BANK ONE SHOP,-30.00\n";

test("a hand-logged row takes the bank's amount and date, keeping its line and words", function(){
  withLedger(function(){
    startBankImport(CSV, "card-a.csv");
    assert.equal(BI.bankImport.possibleDuplicates.length, 2);
    assert.equal(BI.importableCount(), 3, "one new, two to match");
    var res = commitBankImport();
    var h1 = state.transactions.find(function(t){ return t.id === "h1"; }), h2 = state.transactions.find(function(t){ return t.id === "h2"; });
    assert.equal(h1.amount, 18.54); assert.equal(h1.what, "Software plan"); assert.equal(h1.linkedExpenseId, "l1"); assert.ok(h1.matched);
    assert.match(h1.bankWhat, /EXAMPLE APP/);
    assert.equal(h2.date, "2026-03-13"); assert.equal(h2.what, "FERN CAFE", "no words of its own: the bank's"); assert.equal(h2.category, "Eating out");
    assert.equal(res.reconciled.length, 2);
    assert.equal(state.transactions.length, 3, "only the new one added");
    // The same statement again: all three already logged.
    startBankImport(CSV, "card-a.csv");
    assert.equal(BI.bankImport.duplicates.length, 3);
    undoBankImport(res.ids, res.lineIds, res.receivedIds, res.transferIds, res.balanceSet, res.reconciled);
    h1 = state.transactions.find(function(t){ return t.id === "h1"; }); h2 = state.transactions.find(function(t){ return t.id === "h2"; });
    assert.deepEqual([h1.amount, h1.bankWhat, h1.matched, h2.date, h2.what, h2.account], [18, undefined, undefined, "2026-03-12", "", ""]);
  });
});

test("imported as new instead, nothing is matched", function(){
  withLedger(function(){
    startBankImport(CSV, "card-a.csv");
    BI.bankImport.includePossibleDuplicates = true;
    assert.equal(commitBankImport().reconciled.length, 0);
  });
});

test("what's logged on the account inside the statement's dates and not on it is named", function(){
  withLedger(function(){
    state.transactions.push({ id: "h3", date: "2026-03-14", amount: 25, what: "Logged twice?", account: "Card A" },
      { id: "h4", date: "2026-03-30", amount: 40, what: "After the statement", account: "Card A" },
      { id: "h5", date: "2026-03-14", amount: 15, what: "Other account", account: "Bank One" });
    startBankImport(CSV, "card-a.csv");
    BI.bankImport.account = "Card A";
    assert.deepEqual(BI.strayLogged().map(function(t){ return t.id; }), ["h3"], "inside the dates, on the card, matched by nothing");
    BI.bankImport.includePossibleDuplicates = true;
    assert.deepEqual(BI.strayLogged().map(function(t){ return t.id; }).sort(), ["h1", "h3"], "imported as new, the hand-logged one is left over");
  });
});
