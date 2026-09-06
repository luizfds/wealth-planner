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
