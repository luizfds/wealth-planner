import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, migrateState } from "../src/state.js";
import { accountBalance, setAccountBalance, accountSourceOptions, accountsOverview, resolveLink } from "../src/calc/accounts.js";

function withState(fn){
  var keep = { accounts: state.accounts, assets: state.assets, debts: state.debts, properties: state.properties };
  try {
    state.assets = [{ id: "as1", what: "Sam's savings (Bank One)", category: "Cash", amount: 5000, history: [{ date: "2026-01-10", value: 4000 }, { date: "2026-02-10", value: 5000 }] },
      { what: "Shares A", category: "Shares", amount: 900 }];
    state.debts = [{ id: "d1", what: "Card limit", balance: 6000, history: [] }];
    state.properties = [{ id: "p1", what: "1 Example St", loans: [{ id: "l1", what: "Main loan", balance: 300000, offsetBalance: 20000 }] }];
    state.accounts = [];
    fn();
  } finally { Object.assign(state, keep); }
}

test("an account's balance comes from the record it links to", function(){
  withState(function(){
    var a = { id: "a", name: "Bank One", type: "savings", link: "asset:as1" };
    var b = accountBalance(a);
    assert.equal(b.balance, 5000);
    assert.equal(b.owed, false);
    assert.equal(b.date, "2026-02-10");
    assert.equal(b.history.length, 2);
    var off = accountBalance({ id: "o", name: "Offset", type: "offset", link: "offset:l1" });
    assert.equal(off.balance, 20000);
    var card = accountBalance({ id: "c", name: "Card", type: "credit", link: "debt:d1" });
    assert.equal(card.balance, 6000);
    assert.equal(card.owed, true);
    assert.equal(accountBalance({ id: "x", type: "everyday", link: "asset:gone" }).balance, null);
  });
});

test("updating a balance writes the record and its history; with no record one is made", function(){
  withState(function(){
    var a = { id: "a", name: "Bank One", type: "savings", link: "asset:as1" };
    assert.ok(setAccountBalance(a, 5250.5, "2026-03-10"));
    assert.equal(state.assets[0].amount, 5250.5);
    assert.deepEqual(state.assets[0].history[2], { date: "2026-03-10", value: 5250.5 });
    var off = { id: "o", type: "offset", link: "offset:l1" };
    setAccountBalance(off, 21000, "2026-03-10");
    assert.equal(state.properties[0].loans[0].offsetBalance, 21000);
    assert.equal(state.properties[0].loans[0].offsetHistory.length, 1);
    var fresh = { id: "n", name: "Bank Two", type: "everyday", link: "" };
    setAccountBalance(fresh, 800, "2026-03-10");
    assert.match(fresh.link, /^asset:/);
    assert.equal(resolveLink(fresh.link).record.amount, 800);
    assert.equal(resolveLink(fresh.link).record.category, "Cash");
    var card = { id: "c2", name: "Card Two", type: "credit", link: "" };
    setAccountBalance(card, 120, "2026-03-10");
    assert.match(card.link, /^debt:/);
    assert.equal(state.debts.length, 2);
    assert.equal(setAccountBalance({ id: "o2", type: "offset", link: "" }, 5), false, "an offset needs a loan");
  });
});

test("source options follow the type and say which another account uses", function(){
  withState(function(){
    state.accounts = [{ id: "a", name: "Bank One", type: "savings", link: "asset:as1" }, { id: "b", name: "Other", type: "everyday", link: "" }];
    var opts = accountSourceOptions(state.accounts[1]);
    assert.deepEqual(opts.map(function(o){ return o.key; }), ["asset:as1"]);
    assert.equal(opts[0].usedBy, "Bank One");
    assert.deepEqual(accountSourceOptions({ type: "loan" }).map(function(o){ return o.key; }), ["loan:l1", "debt:d1"]);
  });
});

test("the overview totals every balance and lists the ones with no account", function(){
  withState(function(){
    state.accounts = [{ id: "a", name: "Bank One", type: "savings", link: "asset:as1" }];
    var ov = accountsOverview();
    assert.equal(ov.held, 25000);
    assert.equal(ov.owed, 306000);
    assert.deepEqual(ov.loose.map(function(l){ return l.link + ">" + l.suggest; }).sort(), ["debt:d1>credit", "loan:l1>loan", "offset:l1>offset"]);
  });
});

test("migration: old types become everyday, ids are added, and accounts link by name once", function(){
  var s = migrateState({
    accounts: [{ name: "Bank One", type: "debit" }, { name: "Card", type: "credit", statementStartDay: 5 }, { name: "Bank", type: "debit" }],
    assets: [{ what: "Sam's savings (Bank One)", category: "Cash", amount: 10 }, { what: "Bank Two", category: "Cash", amount: 3 }],
    debts: [{ what: "Card limit", balance: 7000 }]
  });
  var byName = {};
  s.accounts.forEach(function(a){ byName[a.name] = a; });
  assert.equal(byName["Bank One"].type, "everyday");
  assert.ok(s.assets[0].id && s.debts[0].id);
  assert.equal(byName["Bank One"].link, "asset:" + s.assets[0].id);
  assert.equal(byName["Card"].link, "debt:" + s.debts[0].id);
  // "Bank" is a whole word in both cash names, but Bank One already took the first
  assert.equal(byName["Bank"].link, "asset:" + s.assets[1].id);
  assert.equal(s.accountsLinked, true);
  var amb = migrateState({ accounts: [{ name: "Bank", type: "debit" }], assets: [{ what: "Bank savings", category: "Cash" }, { what: "Bank bills", category: "Cash" }] });
  assert.equal(amb.accounts[0].link || "", "", "two matches: left for the person to pick");
  byName["Bank One"].link = "";
  var again = migrateState(s);
  assert.equal(again.accounts.find(function(a){ return a.name === "Bank One"; }).link, "", "an unlink stays unlinked");
});
