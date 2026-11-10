import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { getLocalNotifications } from "../src/lib/notifications.js";
import { todoItems, knowItems, homeTodoItems, ATTENTION_LABEL } from "../src/lib/attention.js";

// #305 (docs/design/attention.md): the bell and Home's To do are one list. Each fact makes one item.
function withState(patch, fn){
  var keep = {};
  Object.keys(patch).forEach(function(k){ keep[k] = state[k]; state[k] = patch[k]; });
  try { return fn(); } finally { Object.assign(state, keep); }
}
var HOUSE = { income: [{ id: "i1", what: "Salary", amount: 90000, freq: "Yearly", person: "Alex" }], lastBackupDate: "", monthReviews: {} };

test("a household with data has one review item and one backup item, in one wording", function(){
  withState(HOUSE, function(){
    var all = getLocalNotifications();
    var review = all.filter(function(n){ return /^review:\d{4}-\d{2}$/.test(n.id); });
    assert.equal(review.length, 1);
    assert.match(review[0].title, /^Review [A-Z][a-z]+ \d{4}$/);
    assert.deepEqual([review[0].page, review[0].sub], ["dashboard", "review"]);
    var backup = all.filter(function(n){ return n.type === "backup"; });
    assert.equal(backup.length, 1);
    assert.equal(backup[0].action, "backup");
  });
});

test("an empty household is asked for nothing: no review, no backup", function(){
  withState({ income: [], shared: [], assets: [], properties: [], transactions: [], debts: [], accounts: [], lastBackupDate: "", monthReviews: {} }, function(){
    var ids = getLocalNotifications().map(function(n){ return n.type; });
    assert.ok(ids.indexOf("review") === -1 && ids.indexOf("backup") === -1, ids.join(","));
    assert.deepEqual(homeTodoItems(), []);
  });
});

test("the to-dos only Home had are items like the rest: transactions to review, a stale balance, a rent review, a fixed rate ending", function(){
  var soon = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), old = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  withState(Object.assign({}, HOUSE, {
    transactions: [{ id: "t1", date: old, amount: 12, description: "Fern Café", review: true }],
    accounts: [{ id: "a1", name: "Everyday", type: "everyday", balance: 500, balanceDate: old, balances: [{ date: old, balance: 500 }] }],
    properties: [{ id: "p1", what: "1 Example St", kind: "IP", nextRentReview: soon, loans: [{ id: "l1", what: "Loan one", balance: 100000, fixedUntil: soon }] }]
  }), function(){
    var types = getLocalNotifications().map(function(n){ return n.id.split(":")[0]; });
    ["rentreview", "fixedend"].forEach(function(t){ assert.equal(types.filter(function(x){ return x === t; }).length, 1, t); });
    var rent = getLocalNotifications().find(function(n){ return /^rentreview:/.test(n.id); });
    assert.match(rent.title, /^1 Example St: rent review in \d+ days$/);
    assert.equal(rent.page, "properties");
  });
});

test("every item has a group and a label from the one vocabulary; Home's To do skips bills and the week, most pressing first", function(){
  withState(HOUSE, function(){
    var todo = todoItems();
    assert.ok(todo.length > 0);
    todo.forEach(function(n){ assert.equal(n.group, "todo"); assert.equal(n.label, n.severity === "bad" ? ATTENTION_LABEL.urgent : n.severity === "warn" ? ATTENTION_LABEL.todo : ATTENTION_LABEL.reminder); });
    var home = homeTodoItems();
    assert.ok(home.every(function(n){ return ["duebill", "bill", "week"].indexOf(n.type) === -1; }));
    var rank = { bad: 0, warn: 1, info: 2 };
    for(var i = 1; i < home.length; i++) assert.ok(rank[home[i - 1].severity] <= rank[home[i].severity]);
    knowItems("2026-10-27").forEach(function(a){ assert.equal(a.group, "know"); assert.notEqual(a.kind, "good"); assert.ok(a.label); });
  });
});
