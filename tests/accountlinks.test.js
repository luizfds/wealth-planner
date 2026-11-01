import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { accountFor, linkedName, isLinkedTo, link, linkAllByName, renameAccount, goalAccounts, everyAccountLink } from "../src/calc/accountlinks.js";

// v3.204.0 (item 235b): account links by id. Invented accounts and rows.
function household(){
  return linkAllByName({
    accounts: [{ id: "a1", name: "Bank One Everyday", type: "everyday" }, { id: "a2", name: "Card A", type: "credit", autoPayFrom: "Bank One Everyday" }],
    shared: [{ id: "l1", what: "Groceries", account: "Card A" }], income: [{ id: "i1", what: "Pay", account: "Bank One Everyday" }],
    transactions: [{ id: "t1", account: "Card A", amount: 12 }], incomeLog: [], home: { Today: [{ id: "h1", account: "Bank One Everyday" }] },
    properties: [{ income: [{ account: "Bank One Everyday" }], expenses: [] }],
    transfers: [{ id: "x1", from: "Bank One Everyday", to: "Card A", amount: 50, date: "2026-10-01" }],
    autoPayments: [{ id: "ap1", from: "Bank One Everyday", to: "Card A" }], importRules: [{ match: "fern", account: "Card A", transferAccount: "" }],
    savingsGoals: [{ name: "Trip", accounts: ["Bank One Everyday"] }], txViews: [{ name: "Card", filter: { account: "Card A" } }],
    monthReviews: { "2026-10": { statements: { "Card A": 420 } } }
  });
}

test("a rename reaches every link by id: rows, home and property rows, transfers, payments, the card's direct debit, rules, goals, views, statements", function(){
  const st = household();
  renameAccount(st, st.accounts[0], "Bank One Main");
  renameAccount(st, st.accounts[1], "Card B");
  assert.equal(st.income[0].account, "Bank One Main");
  assert.equal(st.home.Today[0].account, "Bank One Main");
  assert.equal(st.properties[0].income[0].account, "Bank One Main");
  assert.deepEqual([st.transfers[0].from, st.transfers[0].to], ["Bank One Main", "Card B"]);
  assert.deepEqual([st.autoPayments[0].from, st.autoPayments[0].to], ["Bank One Main", "Card B"]);
  assert.equal(st.accounts[1].autoPayFrom, "Bank One Main");
  assert.equal(st.importRules[0].account, "Card B");
  assert.deepEqual(st.savingsGoals[0].accounts, ["Bank One Main"]);
  assert.equal(st.txViews[0].filter.account, "Card B");
  assert.deepEqual(st.monthReviews["2026-10"].statements, { "Card B": 420 });
  // And the next load finds it all consistent.
  const again = JSON.parse(JSON.stringify(st));
  assert.deepEqual(linkAllByName(again), st);
});

test("an edit by name (an account picked from a list) moves the link; a rename after it doesn't undo it", function(){
  const st = household();
  st.transactions[0].account = "Bank One Everyday";   // the row's account changed by its name only
  assert.equal(accountFor(st.transactions[0], "account", st).id, "a1");
  renameAccount(st, st.accounts[1], "Card B");
  assert.equal(st.transactions[0].account, "Bank One Everyday");
  assert.equal(st.transactions[0].accountId, "a1");
});

test("a deleted account's rows keep its name; adding one of that name again picks them back up", function(){
  const st = household();
  st.accounts.splice(1, 1);
  linkAllByName(st);
  assert.equal(st.shared[0].account, "Card A");
  assert.equal(st.shared[0].accountId, undefined);
  assert.equal(accountFor(st.shared[0], "account", st), null);
  st.accounts.push({ id: "a9", name: "Card A", type: "credit" });
  assert.ok(isLinkedTo(st.transactions[0], "account", "a9", st));
  linkAllByName(st);
  assert.equal(st.shared[0].accountId, "a9");
});

test("link writes the id and the name; a name with no account stays a plain name", function(){
  const st = household(), row = {};
  link(row, "account", "Card A", st);
  assert.deepEqual(row, { account: "Card A", accountId: "a2" });
  link(row, "account", "a1", st);
  assert.deepEqual(row, { account: "Bank One Everyday", accountId: "a1" });
  link(row, "account", "Somewhere else", st);
  assert.deepEqual(row, { account: "Somewhere else" });
  assert.equal(linkedName(row, "account", st), "Somewhere else");
});

test("every link is found, and goals read their accounts by id", function(){
  const st = household();
  const fields = everyAccountLink(st).map(x => x.field);
  assert.equal(fields.filter(f => f === "account").length, 6);
  assert.equal(fields.filter(f => f === "from").length, 2);
  assert.equal(fields.filter(f => f === "autoPayFrom").length, 2);
  assert.deepEqual(goalAccounts(st.savingsGoals[0], st).map(a => a.id), ["a1"]);
});
