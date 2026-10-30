import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyFilter, filterOf, sameFilter, saveView, deleteView, applyView, viewMatching, effectiveFilter, hasOwnDates, describeFilter } from "../src/calc/txviews.js";
import { filterEntries, entryTotals } from "../src/calc/cashflowlist.js";

// Invented entries, shaped as calc/cashflowlist.js cashflowEntries makes them.
var E = [
  { kind: "out", date: "2026-09-02", amount: 84.5, label: "Fern Grocer", account: "Card A", category: "Groceries", lineId: "l1", person: "" },
  { kind: "out", date: "2026-09-14", amount: 12, label: "Fern Cafe", account: "Card A", category: "Eating out", lineId: "l2", person: "" },
  { kind: "out", date: "2026-10-03", amount: 140, label: "Fern Grocer", account: "Everyday", category: "Groceries", lineId: "l1", person: "" },
  { kind: "out", date: "2026-10-05", amount: -30, label: "Fern Grocer refund", account: "Card A", category: "Groceries", lineId: "l1", person: "" },
  { kind: "in", date: "2026-10-01", amount: 2500, label: "Pay", account: "Everyday", category: "Income", lineId: "net:Alex", person: "Alex" },
  { kind: "transfer", date: "2026-10-02", amount: 500, label: "To savings", account: "Everyday", toAccount: "Saver", category: "", lineId: "", person: "" }
];

test("only what's set is stored, and two filter sets compare by it", function(){
  var f = Object.assign(emptyFilter(), { category: "Groceries", text: "  fern ", min: "" });
  assert.deepEqual(filterOf(f), { category: "Groceries", text: "fern" });
  assert.ok(sameFilter(f, { category: "Groceries", text: "fern", direction: "all" }));
  assert.ok(!sameFilter(f, { category: "Groceries" }));
});

test("amounts and dates filter the list; an amount is its size, so a refund counts by it", function(){
  assert.deepEqual(filterEntries(E, { min: "50" }).map(function(e){ return e.label; }), ["Fern Grocer", "Fern Grocer", "Pay", "To savings"]);
  assert.deepEqual(filterEntries(E, { max: "30", direction: "out" }).map(function(e){ return e.amount; }), [12, -30]);
  assert.equal(filterEntries(E, { from: "2026-10-01", to: "2026-10-03" }).length, 3);
});

test("a saved view's total is the same filter set by hand", function(){
  var views = [];
  var f = Object.assign(emptyFilter(), { direction: "out", category: "Groceries", from: "2026-09-01", to: "2026-10-31" });
  var v = saveView(views, "Groceries, spring", f, function(){ return "v1"; });
  assert.equal(views.length, 1);
  var byHand = entryTotals(filterEntries(E, { direction: "out", category: "Groceries", from: "2026-09-01", to: "2026-10-31" }));
  var viaView = entryTotals(filterEntries(E, effectiveFilter(applyView(v), [])));
  assert.deepEqual(viaView, byHand);
  assert.equal(viaView.out, 194.5);
  assert.equal(viewMatching(views, f).id, "v1");
  // Saving under the same name replaces; an empty name or filter saves nothing.
  saveView(views, "groceries, SPRING", { category: "Groceries" }, function(){ return "v2"; });
  assert.equal(views.length, 1);
  assert.deepEqual(views[0].filter, { category: "Groceries" });
  assert.equal(saveView(views, "", f), null);
  assert.equal(saveView(views, "Nothing", emptyFilter()), null);
  assert.equal(deleteView(views, "v1").id, "v1");
  assert.equal(views.length, 0);
});

test("a trip is its dates, narrowed further by the filter's own", function(){
  var trips = [{ id: "t1", name: "Coast", from: "2026-10-02", to: "2026-10-06" }];
  var e = effectiveFilter({ trip: "t1" }, trips);
  assert.equal(e.from, "2026-10-02"); assert.equal(e.to, "2026-10-06");
  assert.equal(effectiveFilter({ trip: "t1", to: "2026-10-04" }, trips).to, "2026-10-04");
  assert.equal(filterEntries(E, effectiveFilter({ trip: "gone" }, trips)).length, 0);
  assert.ok(hasOwnDates({ trip: "t1" }));
  assert.ok(!hasOwnDates({ category: "Groceries" }));
});

test("chips say what each filter is", function(){
  assert.equal(describeFilter("min", "30").text, "At least $30");
  assert.equal(describeFilter("category", "Groceries").text, "Category: Groceries");
  assert.equal(describeFilter("trip", "t1", { tripName: function(){ return "Coast"; } }).text, "Trip: Coast");
});

test("views travel through a sync merge", async function(){
  var { mergeStates } = await import("../src/calc/syncmerge.js");
  var base = { txViews: [] };
  var phone = { txViews: [{ id: "v1", name: "Cafes", filter: { category: "Eating out" } }] };
  var laptop = { txViews: [{ id: "v2", name: "Big ones", filter: { min: "500" } }] };
  var r = mergeStates(base, laptop, phone);
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(r.merged.txViews.map(function(v){ return v.name; }).sort(), ["Big ones", "Cafes"]);
});
