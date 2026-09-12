import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { searchApp } from "../src/lib/search.js";

function withState(overrides, fn){
  var saved = {};
  Object.keys(overrides).forEach(function(key){ saved[key] = state[key]; state[key] = overrides[key]; });
  try{ fn(); } finally { Object.keys(overrides).forEach(function(key){ state[key] = saved[key]; }); }
}

test("searchApp returns nothing for an empty or blank query", function(){
  withState({ shared: [{ id: "s1", what: "Netflix", amount: 20, freq: "Monthly" }] }, function(){
    assert.deepEqual(searchApp(""), []);
    assert.deepEqual(searchApp("   "), []);
  });
});

test("searchApp matches case-insensitively and by substring, across record types", function(){
  withState({
    shared: [{ id: "s1", what: "Netflix Subscription", amount: 20, freq: "Monthly" }],
    transactions: [{ id: "t1", what: "Netflix charge", amount: 19.99, date: "2026-01-01" }],
    assets: [{ what: "Vanguard ETF", category: "Shares", amount: 5000 }]
  }, function(){
    var results = searchApp("netflix");
    assert.equal(results.length, 2);
    var types = results.map(function(r){ return r.type; }).sort();
    assert.deepEqual(types, ["Expense", "Transaction"]);
    assert.equal(searchApp("vanguard").length, 1);
    assert.equal(searchApp("VANGUARD").length, 1);
    assert.equal(searchApp("doesnotexist").length, 0);
  });
});

test("searchApp points a property result at its own card via scrollToId", function(){
  withState({ properties: [{ id: "p1", what: "45 Example St", kind: "IP", value: 800000 }] }, function(){
    var results = searchApp("example");
    assert.equal(results.length, 1);
    assert.equal(results[0].type, "Property");
    assert.equal(results[0].page, "properties");
    assert.equal(results[0].extra.scrollToId, "property-card-p1");
  });
});

test("searchApp points an asset result at its own category subpage", function(){
  withState({ assets: [{ what: "CBA Savings", category: "Cash", amount: 10000 }] }, function(){
    var results = searchApp("cba");
    assert.equal(results.length, 1);
    assert.equal(results[0].page, "assets");
    assert.equal(results[0].extra.sub, "Cash");
  });
});

test("searchApp covers income, debts and accounts too", function(){
  withState({
    income: [{ what: "Sam's Salary", person: "Sam", amount: 5000, freq: "Monthly" }],
    debts: [{ what: "Credit Card Debt", balance: 2000 }],
    accounts: [{ name: "Everyday Account", type: "debit" }]
  }, function(){
    assert.equal(searchApp("salary")[0].page, "income");
    var debtResult = searchApp("credit card debt")[0];
    assert.equal(debtResult.page, "assets");
    assert.equal(debtResult.extra.sub, "summary");
    assert.equal(searchApp("everyday")[0].page, "accounts");
  });
});

test("searchApp finds a description-less transaction by its linked budget line's name", function(){
  withState({
    shared: [{ id: "s1", what: "Groceries", amount: 200, freq: "Monthly" }],
    transactions: [{ id: "t1", date: "2026-03-04", amount: 87.4, what: "", linkedExpenseId: "s1" }]
  }, function(){
    var hit = searchApp("grocer").find(function(r){ return r.type === "Transaction"; });
    assert.ok(hit, "a transaction with no description of its own should still match its budget line's name");
    assert.equal(hit.label, "Groceries");
  });
});

// ---------------- A result has to be a destination, not just a page ----------------
// "expenses" alone stopped being an answer once that page grew two subtabs and its budget groups
// started collapsed: landing there without saying which subtab, and without opening the card the
// row sits in, leaves the thing you searched for off-screen with nothing saying where it went.

test("an Expense result names the Budget subtab and the line to reveal", function(){
  withState({
    shared: [{ id: "s1", what: "Groceries", amount: 430, freq: "Weekly" }],
    home: {}, properties: [], transactions: [], income: [], assets: [], debts: [], accounts: []
  }, function(){
    var hit = searchApp("groceries").find(function(r){ return r.type === "Expense"; });
    assert.ok(hit, "the budget line is found");
    assert.equal(hit.page, "expenses");
    assert.equal(hit.extra.sub, "budget");
    assert.equal(hit.extra.lineId, "s1", "without the id there is no way to open the card it's in");
  });
});

test("a Transaction result names the Spending subtab, which is where transactions are listed", function(){
  withState({
    shared: [{ id: "s1", what: "Groceries", amount: 430, freq: "Weekly" }],
    home: {}, properties: [], income: [], assets: [], debts: [], accounts: [],
    transactions: [{ id: "t1", date: "2026-08-31", amount: 119, what: "", linkedExpenseId: "s1" }]
  }, function(){
    var hit = searchApp("groceries").find(function(r){ return r.type === "Transaction"; });
    assert.ok(hit, "the transaction is found by its linked line's name");
    assert.equal(hit.extra.sub, "spending", "Budget doesn't list transactions at all");
  });
});

test("an Asset result still routes by category — the shared `sub` key means two things", function(){
  // `sub` is an Assets category on that page and an Expenses subtab on this one. A regression here
  // would send someone searching for super to a subtab that doesn't exist.
  withState({
    shared: [], home: {}, properties: [], transactions: [], income: [], debts: [], accounts: [],
    assets: [{ what: "Mariana's Super", category: "Super", amount: 63000 }]
  }, function(){
    var hit = searchApp("super").find(function(r){ return r.type === "Asset"; });
    assert.equal(hit.page, "assets");
    assert.equal(hit.extra.sub, "Super");
  });
});
