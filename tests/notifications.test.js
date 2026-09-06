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
