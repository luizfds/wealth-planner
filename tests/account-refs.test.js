import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { renameAccountEverywhere } from "../src/components/expenses.js";

// An account name is a foreign key by string: nothing in the app holds an account *id*, so a
// rename has to walk every array that carries one. The array that got missed was state.home —
// one per scenario, its rows carrying accounts exactly like shared expenses do. On a real
// three-scenario household that was ten housing rows (Rent, Council Rates, Home Insurance, …)
// left pointing at a name that no longer existed, with no error and nothing on screen to show it.
//
// renameAccountEverywhere is pure state mutation with no DOM, so it tests directly. Its sibling
// deleteAccount cannot — it re-renders three panels and raises a toast — so that one is covered
// by driving the app.

function seed(){
  state.income = [{ id: "i1", what: "Salary", account: "Macquarie" }];
  state.shared = [{ id: "e1", what: "Groceries", account: "Macquarie" },
                  { id: "e2", what: "Power", account: "ING" }];
  state.transactions = [{ id: "t1", date: "2026-09-01", amount: 10, account: "Macquarie" },
                        { id: "t2", date: "2026-09-02", amount: 20, account: "ING" }];
  state.home = {
    "Renting":   [{ id: "h1", what: "Rent", account: "ING" }],
    "Buy Sydney":[{ id: "h2", what: "Rent / Home Loan", account: "Macquarie" },
                  { id: "h3", what: "Council Rates", account: "Macquarie" }]
  };
  state.properties = [{ name: "IP1",
    income:   [{ id: "pi1", what: "Rent received", account: "Macquarie" }],
    expenses: [{ id: "pe1", what: "Strata", account: "Macquarie" }] }];
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
  assert.equal(countOf("Macquarie"), 7);
  renameAccountEverywhere("Macquarie", "Macquarie Bank");
  assert.equal(countOf("Macquarie"), 0, "no row may still point at the old name");
  assert.equal(countOf("Macquarie Bank"), 7);
  // The specific rows that used to be missed.
  assert.equal(state.home["Buy Sydney"][0].account, "Macquarie Bank");
  assert.equal(state.home["Buy Sydney"][1].account, "Macquarie Bank");
});

test("renaming an account leaves other accounts alone", () => {
  seed();
  renameAccountEverywhere("Macquarie", "Macquarie Bank");
  assert.equal(countOf("ING"), 3);
  assert.equal(state.home["Renting"][0].account, "ING");
});

test("renaming to the same name, or from nothing, is a no-op", () => {
  seed();
  renameAccountEverywhere("Macquarie", "Macquarie");
  assert.equal(countOf("Macquarie"), 7);
  renameAccountEverywhere("", "Whatever");
  assert.equal(countOf("Macquarie"), 7);
});

test("renaming copes with a scenario that has no housing rows", () => {
  seed();
  state.home["Empty"] = [];
  assert.doesNotThrow(() => renameAccountEverywhere("Macquarie", "Macquarie Bank"));
  assert.equal(countOf("Macquarie Bank"), 7);
});
