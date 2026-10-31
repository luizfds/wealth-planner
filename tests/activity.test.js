import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffForLog, entriesFor, pruneActivity, undoEntry, whoText, MAX_CHARS, MAX_ENTRIES } from "../src/calc/activity.js";

// Invented household, before and after a few edits.
function household(){
  return {
    shared: [{ id: "l1", what: "Groceries", amount: 600, freq: "Monthly" }, { id: "l2", what: "Fern Cafe", amount: 80, freq: "Monthly" }],
    transactions: [{ id: "t1", date: "2026-10-03", amount: 84.5, what: "Fern Grocer" }],
    income: [{ id: "i1", what: "Salary", amount: 90000, person: "Alex", syntheticNetFor: null }, { id: "i2", what: "Alex net", amount: 6000, syntheticNetFor: "i1" }],
    tax: { settings: { Alex: { wfhHours: { 2026: 200 } } } },
    projection: { horizonYears: 20 },
    activeScenario: "Renting", savedAt: "x", activity: []
  };
}
var by = { by: "Alex", device: "devA", at: "2026-10-30T09:00:00.000Z", idFactory: (function(){ var n = 0; return function(){ return "e" + (++n); }; })() };

test("a field edit, an addition and a removal are each one entry, with what changed", function(){
  var a = household(), b = household();
  b.shared[0].amount = 650;
  b.transactions.push({ id: "t2", date: "2026-10-04", amount: 12, what: "Fern Cafe" });
  b.shared.splice(1, 1);
  b.projection.horizonYears = 25;
  b.activeScenario = "Buy a house"; b.savedAt = "y"; // how this device shows things: not logged
  b.income[1].amount = 6100;                        // a computed row: not logged
  var e = entriesFor(diffForLog(a, b), by);
  var whats = e.map(function(x){ return x.what; }).sort();
  assert.deepEqual(whats, ["Added Fern Cafe", "Groceries: amount 600 → 650", "Removed Fern Cafe", "horizon years: 20 → 25"].sort());
  assert.ok(e.every(function(x){ return x.by === "Alex" && x.device === "devA" && x.undo; }));
  assert.equal(e.find(function(x){ return /Groceries/.test(x.what); }).section, "Budget");
});

test("a burst — an import of many rows — is one entry, not one per row", function(){
  var a = household(), b = household();
  for(var i = 0; i < 30; i++) b.transactions.push({ id: "n" + i, date: "2026-10-05", amount: i + 1, what: "Row " + i });
  var e = entriesFor(diffForLog(a, b), by);
  assert.equal(e.length, 1);
  assert.equal(e[0].what, "Added 30 rows");
  assert.equal(e[0].section, "Spending");
});

test("each kind of entry can be undone, and says so when it no longer can", function(){
  var a = household(), b = household();
  b.shared[0].amount = 650;
  b.transactions.push({ id: "t2", date: "2026-10-04", amount: 12, what: "Fern Cafe" });
  b.shared.splice(1, 1);
  b.projection.horizonYears = 25;
  var e = entriesFor(diffForLog(a, b), by);
  var live = JSON.parse(JSON.stringify(b));
  e.forEach(function(x){ assert.ok(undoEntry(live, x), x.what); });
  assert.equal(live.shared.find(function(l){ return l.id === "l1"; }).amount, 600);
  assert.ok(live.shared.some(function(l){ return l.id === "l2"; }), "the removed line is back");
  assert.ok(!live.transactions.some(function(t){ return t.id === "t2"; }), "the added transaction is gone");
  assert.equal(live.projection.horizonYears, 20);
  // Already undone: the restore can't happen twice, the removal finds nothing.
  assert.equal(undoEntry(live, e.find(function(x){ return /^Added/.test(x.what); })), false);
});

test("the log keeps 90 days, newest first, and stays under its size cap", function(){
  var list = [];
  for(var i = 0; i < 1000; i++) list.push({ id: "x" + i, at: new Date(Date.UTC(2026, 9, 30) - i * 3600000).toISOString(), what: "Edit " + i + " " + "x".repeat(200), section: "Budget" });
  list.push({ id: "old", at: "2026-01-01T00:00:00.000Z", what: "Long ago" });
  var kept = pruneActivity(list, "2026-10-30");
  assert.ok(kept.length <= MAX_ENTRIES);
  assert.ok(JSON.stringify(kept).length <= MAX_CHARS);
  assert.ok(!kept.some(function(e){ return e.id === "old"; }));
  assert.ok(kept[0].at > kept[kept.length - 1].at);
});

test("names: the person, else this device or another", function(){
  assert.equal(whoText({ by: "Sam", device: "devB" }, "devA"), "Sam");
  assert.equal(whoText({ by: "", device: "devA" }, "devA"), "This device");
  assert.equal(whoText({ by: "", device: "devB" }, "devA"), "Another device");
});

test("an edit on device A reaches device B with A's name, merged with B's own", async function(){
  var { mergeStates } = await import("../src/calc/syncmerge.js");
  var base = household();
  var A = household(); A.shared[0].amount = 650;
  A.activity = entriesFor(diffForLog(base, A), { by: "Alex", device: "devA", at: "2026-10-30T09:00:00.000Z", idFactory: function(){ return "fromA"; } });
  A.savedByName = "Alex";
  var B = household(); B.projection.horizonYears = 30;
  B.activity = entriesFor(diffForLog(base, B), { by: "Sam", device: "devB", at: "2026-10-30T09:05:00.000Z", idFactory: function(){ return "fromB"; } });
  var r = mergeStates(base, B, A);
  assert.equal(r.conflicts.length, 0);
  var log = pruneActivity(r.merged.activity, "2026-10-30");
  assert.deepEqual(log.map(function(e){ return e.by + ": " + e.what; }), ["Sam: horizon years: 20 → 30", "Alex: Groceries: amount 600 → 650"]);
  assert.equal(r.merged.shared[0].amount, 650);
});
