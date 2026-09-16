import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { staleAssetNamesList, getLocalNotifications } from "../src/lib/notifications.js";

function findStaleAssetNotification(notifications){
  return notifications.find(function(n){ return n.type === "stale-asset"; });
}
function findReviewNotification(notifications){
  return notifications.find(function(n){ return n.type === "review"; });
}

test("staleAssetNamesList formats never-logged and days-ago entries and joins them", function(){
  var text = staleAssetNamesList([
    { what: "Cash Savings", days: null },
    { what: "Super", days: 45 }
  ]);
  assert.equal(text, "Cash Savings (never logged), Super (45d ago)");
});

test("getLocalNotifications emits one stale-asset notification per asset when there's just one", function(){
  var prevAssets = state.assets;
  state.assets = [{ what: "Cash Savings", category: "Cash", amount: 1000, history: [] }];
  var stale = findStaleAssetNotification(getLocalNotifications());
  assert.ok(stale);
  assert.equal(stale.title, "Cash Savings hasn't been logged recently");
  assert.equal(stale.detail, "Never logged a value");
  state.assets = prevAssets;
});

test("getLocalNotifications groups multiple stale assets into one notification, not one each", function(){
  var prevAssets = state.assets;
  state.assets = [
    { what: "Cash Savings", category: "Cash", amount: 1000, history: [] },
    { what: "Super", category: "Super", amount: 200000, history: [] },
    { what: "Toyota Corolla", category: "Vehicle", amount: 20000, history: [] }
  ];
  var notifications = getLocalNotifications();
  var staleOnes = notifications.filter(function(n){ return n.type === "stale-asset"; });
  assert.equal(staleOnes.length, 1);
  assert.equal(staleOnes[0].title, "3 assets haven't been logged recently");
  assert.ok(staleOnes[0].detail.indexOf("Cash Savings") !== -1);
  assert.ok(staleOnes[0].detail.indexOf("Toyota Corolla") !== -1);
  state.assets = prevAssets;
});

test("getLocalNotifications caps the grouped stale-asset detail at 3 names, plus a count of the rest", function(){
  var prevAssets = state.assets;
  state.assets = ["A", "B", "C", "D", "E"].map(function(name){
    return { what: name, category: "Other", amount: 100, history: [] };
  });
  var stale = findStaleAssetNotification(getLocalNotifications());
  assert.equal(stale.title, "5 assets haven't been logged recently");
  assert.ok(stale.detail.indexOf("and 2 more") !== -1);
  assert.equal(stale.detail.split(",").length, 3); // exactly A, B, C named before "and 2 more"
  state.assets = prevAssets;
});

test("getLocalNotifications skips the 'needs a fresh entry' review nudge for an item marked irregular", function(){
  var prevShared = state.shared, prevTx = state.transactions;
  state.shared = [{ id: "exp1", what: "Extras / Misc", amount: 100, freq: "Monthly", irregular: true }];
  state.transactions = [];
  assert.equal(findReviewNotification(getLocalNotifications()), undefined);
  state.shared = prevShared;
  state.transactions = prevTx;
});

test("getLocalNotifications still nudges a non-irregular item with the same never-logged shape", function(){
  var prevShared = state.shared, prevTx = state.transactions;
  state.shared = [{ id: "exp1", what: "Groceries", amount: 100, freq: "Monthly", irregular: false }];
  state.transactions = [];
  var review = findReviewNotification(getLocalNotifications());
  assert.ok(review);
  assert.equal(review.title, "Groceries needs a fresh entry");
  state.shared = prevShared;
  state.transactions = prevTx;
});

// ---------------- One line, one notification ----------------
// A recurring line that is both behind on logging and due within DUE_SOON_DAYS used to produce
// two notifications: its own "Due <date> · $X" and a seat in the grouped "N budget lines need a
// fresh entry". On the household's real data that was 2 of 7 notifications being repeats of lines
// already listed. They were never independent facts — not having logged the last one is *why* the
// next occurrence has come around — so the due-bill notification now carries both and the review
// group stays quiet about that line.
function daysAgo(n){
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}
function withShared(shared, transactions, fn){
  var prevShared = state.shared, prevTx = state.transactions, prevAssets = state.assets;
  state.shared = shared;
  state.transactions = transactions;
  state.assets = [];
  try { fn(); } finally {
    state.shared = prevShared; state.transactions = prevTx; state.assets = prevAssets;
  }
}

test("a line that is both due soon and behind gets one notification, not two", function(){
  withShared(
    [{ id: "exp1", what: "Transport", amount: 50, freq: "Weekly", irregular: false }],
    [{ id: "t1", date: daysAgo(13), amount: 50, linkedExpenseId: "exp1" }],
    function(){
      var all = getLocalNotifications();
      var bills = all.filter(function(n){ return n.type === "duebill"; });
      assert.equal(bills.length, 1);
      assert.equal(findReviewNotification(all), undefined, "must not also sit in the review group");
      // The fact the review group used to carry has to survive on the one that remains.
      assert.equal(bills[0].severity, "bad");
      assert.match(bills[0].detail, /still isn't logged/);
    });
});

test("a line due soon but logged on time says nothing about being behind", function(){
  withShared(
    [{ id: "exp1", what: "Transport", amount: 50, freq: "Weekly", irregular: false }],
    [{ id: "t1", date: daysAgo(3), amount: 50, linkedExpenseId: "exp1" }],
    function(){
      var bills = getLocalNotifications().filter(function(n){ return n.type === "duebill"; });
      assert.equal(bills.length, 1);
      assert.equal(bills[0].severity, "warn");
      assert.ok(!/still isn't logged/.test(bills[0].detail), bills[0].detail);
    });
});

test("a line behind but not yet due soon stays in the review group", function(){
  withShared(
    // Monthly, last logged 40 days ago: one occurrence already missed (so behind), but the next
    // lands ~20 days out, well past DUE_SOON_DAYS — so nothing speaks for it except the group.
    [{ id: "exp1", what: "Council Rates", amount: 300, freq: "Monthly", irregular: false }],
    [{ id: "t1", date: daysAgo(40), amount: 300, linkedExpenseId: "exp1" }],
    function(){
      var all = getLocalNotifications();
      assert.equal(all.filter(function(n){ return n.type === "duebill"; }).length, 0);
      var review = findReviewNotification(all);
      assert.ok(review, "the group is the only thing that can report this line");
      assert.match(review.title, /Council Rates/);
    });
});
