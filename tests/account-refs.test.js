import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { renameAccountEverywhere } from "../src/components/expenses.js";

// v3.206.0 (item 235b): rows link accounts by id now (calc/accountlinks.js) and a rename reaches them
// through that link. These tests began when an account was a name only and a rename walked every array
// by hand — and the array that got missed was state.home —
// one per scenario, its rows carrying accounts exactly like shared expenses do. On a real
// three-scenario household that was ten housing rows (Rent, Council Rates, Home Insurance, …)
// left pointing at a name that no longer existed, with no error and nothing on screen to show it.
//
// renameAccountEverywhere is pure state mutation with no DOM, so it tests directly. Its sibling
// deleteAccount cannot — it re-renders three panels and raises a toast — so that one is covered
// by driving the app.

function seed(){
  state.accounts = [{ id: "b1", name: "Bank One", type: "everyday" }, { id: "b2", name: "Bank Two", type: "everyday" }];
  state.transfers = []; state.autoPayments = []; state.importRules = []; state.incomeLog = []; state.savingsGoals = [];
  state.income = [{ id: "i1", what: "Salary", account: "Bank One" }];
  state.shared = [{ id: "e1", what: "Groceries", account: "Bank One" },
                  { id: "e2", what: "Power", account: "Bank Two" }];
  state.transactions = [{ id: "t1", date: "2026-09-01", amount: 10, account: "Bank One" },
                        { id: "t2", date: "2026-09-02", amount: 20, account: "Bank Two" }];
  state.home = {
    "Renting":   [{ id: "h1", what: "Rent", account: "Bank Two" }],
    "Buy Sydney":[{ id: "h2", what: "Rent / Home Loan", account: "Bank One" },
                  { id: "h3", what: "Council Rates", account: "Bank One" }]
  };
  state.properties = [{ name: "IP1",
    income:   [{ id: "pi1", what: "Rent received", account: "Bank One" }],
    expenses: [{ id: "pe1", what: "Strata", account: "Bank One" }] }];
}
function countOf(name){
  var n = 0;
  [state.income, state.shared, state.transactions].forEach(a => a.forEach(r => { if(r.account === name) n++; }));
  Object.values(state.home).forEach(rows => rows.forEach(r => { if(r.account === name) n++; }));
  state.properties.forEach(p => [p.income, p.expenses].forEach(a => a.forEach(r => { if(r.account === name) n++; })));
  return n;
}

test("renaming an account retargets housing rows in every scenario", () => {
  seed();
  assert.equal(countOf("Bank One"), 7);
  renameAccountEverywhere(state.accounts[0], "Bank One Savings");
  assert.equal(countOf("Bank One"), 0, "no row may still point at the old name");
  assert.equal(countOf("Bank One Savings"), 7);
  // The specific rows that used to be missed.
  assert.equal(state.home["Buy Sydney"][0].account, "Bank One Savings");
  assert.equal(state.home["Buy Sydney"][1].account, "Bank One Savings");
});

test("renaming an account leaves other accounts alone", () => {
  seed();
  renameAccountEverywhere(state.accounts[0], "Bank One Savings");
  assert.equal(countOf("Bank Two"), 3);
  assert.equal(state.home["Renting"][0].account, "Bank Two");
});

test("renaming to the same name, or from nothing, is a no-op", () => {
  seed();
  renameAccountEverywhere(state.accounts[0], "Bank One");
  assert.equal(countOf("Bank One"), 7);
  state.accounts.push({ id: "b3", name: "", type: "everyday" });
  renameAccountEverywhere(state.accounts[2], "Whatever");
  assert.equal(countOf("Bank One"), 7);
});

test("renaming copes with a scenario that has no housing rows", () => {
  seed();
  state.home["Empty"] = [];
  assert.doesNotThrow(() => renameAccountEverywhere(state.accounts[0], "Bank One Savings"));
  assert.equal(countOf("Bank One Savings"), 7);
});
