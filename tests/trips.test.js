import test from "node:test";
import assert from "node:assert/strict";
import { tripOn, tripTakes, tripRefilePlan, applyTripRefile, tripSpend, normaliseTrip } from "../src/calc/trips.js";

var LINES = [
  { id: "trips", what: "Trips", freq: "Yearly", irregular: true },
  { id: "cafe", what: "Coffee", freq: "Weekly", irregular: true },
  { id: "groc", what: "Groceries", freq: "Weekly", irregular: false },
  { id: "music", what: "Music", freq: "Monthly", irregular: false },
  { id: "rent", what: "Rent", freq: "Fortnightly", irregular: false }
];
var TRIP = { id: "t1", name: "Coast", from: "2026-03-10", to: "2026-03-13", lineId: "trips" };

test("a date belongs to the trip covering it, the shorter one when two overlap", function(){
  var long = { id: "long", from: "2026-03-01", to: "2026-03-31" };
  assert.equal(tripOn("2026-03-11", [long, TRIP]).id, "t1");
  assert.equal(tripOn("2026-03-20", [long, TRIP]).id, "long");
  assert.equal(tripOn("2026-04-01", [long, TRIP]), null);
});

test("a trip takes everyday and irregular spending, not monthly bills or protected lines", function(){
  assert.equal(tripTakes(null), true);
  assert.equal(tripTakes(LINES[1]), true);
  assert.equal(tripTakes(LINES[2]), true);
  assert.equal(tripTakes(LINES[3]), false);
  assert.equal(tripTakes(LINES[4], { rent: true }), false);
});

test("moving a trip's spending: inside the dates, not bills, not already there", function(){
  var tx = [
    { id: "a", date: "2026-03-09", amount: 5, linkedExpenseId: "cafe" },
    { id: "b", date: "2026-03-10", amount: 6, linkedExpenseId: "cafe" },
    { id: "c", date: "2026-03-11", amount: 80, linkedExpenseId: "groc" },
    { id: "d", date: "2026-03-12", amount: 12, linkedExpenseId: "music" },
    { id: "e", date: "2026-03-12", amount: 900, linkedExpenseId: "rent" },
    { id: "f", date: "2026-03-13", amount: 300, linkedExpenseId: "trips" },
    { id: "g", date: "2026-03-13", amount: 40, linkedExpenseId: null, category: "Other" }
  ];
  assert.deepEqual(tripRefilePlan(TRIP, tx, LINES, { rent: true }).map(function(t){ return t.id; }), ["b", "c", "g"]);
  assert.equal(applyTripRefile(TRIP, tx, LINES, { rent: true }), 3);
  assert.equal(tx[6].linkedExpenseId, "trips");
  assert.equal(tx[6].category, "");
  assert.equal(tripSpend(TRIP, tx), 426);
  assert.equal(tripRefilePlan(TRIP, tx, LINES, { rent: true }).length, 0, "nothing left to move");
});

test("a trip entered backwards is put the right way round", function(){
  var t = normaliseTrip({ name: "  ", from: "2026-05-04", to: "2026-05-01", lineId: "trips" }, function(){ return "x"; });
  assert.deepEqual(t, { id: "x", name: "Trip", from: "2026-05-01", to: "2026-05-04", lineId: "trips", budget: 0 });
  assert.equal(normaliseTrip({ from: "2026-05-01" }).to, "2026-05-01");
});

// ---------------- November 2026: a budget per trip, and asking on its days ----------------
import { tripStatus, tripLeft, tripPending, answerTrip, tripLineSplit } from "../src/calc/trips.js";

test("a trip keeps a budget, and a month while its dates aren't set", function(){
  var t = normaliseTrip({ name: "Mountains", month: "2027-04", budget: "2400", lineId: "trips" }, function(){ return "x"; });
  assert.deepEqual([t.from, t.to, t.month, t.budget], ["", "", "2027-04", 2400]);
  var dated = normaliseTrip({ name: "Coast", from: "2026-03-13", to: "2026-03-10", month: "2026-03", budget: -5 });
  assert.deepEqual([dated.from, dated.to, dated.month, dated.budget], ["2026-03-10", "2026-03-13", undefined, 0]);
});

test("where a trip stands, and what's left a day while away", function(){
  assert.equal(tripStatus({ month: "2027-04" }, "2026-03-11"), "planning");
  assert.equal(tripStatus(TRIP, "2026-03-01"), "coming");
  assert.equal(tripStatus(TRIP, "2026-03-11"), "away");
  assert.equal(tripStatus(TRIP, "2026-03-14"), "past");
  var away = tripLeft(Object.assign({}, TRIP, { budget: 900 }), 286, "2026-03-11");
  assert.deepEqual([away.left, away.daysLeft, away.perDay, away.over], [614, 3, 204, false]);
  var past = tripLeft(Object.assign({}, TRIP, { budget: 100 }), 150, "2026-03-20");
  assert.deepEqual([past.left, past.perDay, past.over], [-50, null, true]);
});

test("the purchases still to answer: on its days, not bills, not answered, not another trip's", function(){
  var tx = [
    { id: "b", date: "2026-03-10", amount: 6, linkedExpenseId: "cafe" },
    { id: "c", date: "2026-03-11", amount: 80, linkedExpenseId: "groc", tripNo: "t1" },
    { id: "d", date: "2026-03-12", amount: 12, linkedExpenseId: "music" },
    { id: "e", date: "2026-03-12", amount: 50, linkedExpenseId: "cafe", trip: "other" },
    { id: "f", date: "2026-03-13", amount: 300, linkedExpenseId: "trips" },
    { id: "g", date: "2026-03-13", amount: 40, linkedExpenseId: null, category: "Other" },
    { id: "h", date: "2026-03-13", amount: -5, linkedExpenseId: "cafe" }
  ];
  assert.deepEqual(tripPending(TRIP, tx, LINES).map(function(t){ return t.id; }), ["b", "g"]);
  assert.deepEqual(tripPending({ id: "p", name: "Later", lineId: "trips" }, tx, LINES), [], "no dates, nothing to ask");
});

test("an answer files it to the trip, or remembers it isn't", function(){
  var t = { id: "b", date: "2026-03-10", amount: 6, linkedExpenseId: "cafe", category: "Eating out" };
  answerTrip(t, TRIP, true);
  assert.deepEqual([t.linkedExpenseId, t.category, t.trip, t.tripNo], ["trips", "", "t1", undefined]);
  answerTrip(t, TRIP, false);
  assert.deepEqual([t.trip, t.tripNo], [undefined, "t1"]);
});

test("a trip's spend: its answered purchases, and older spending on its line in its dates", function(){
  var tx = [
    { date: "2026-03-10", amount: 20, linkedExpenseId: "cafe", trip: "t1" },
    { date: "2026-03-11", amount: 100, linkedExpenseId: "trips" },
    { date: "2026-03-11", amount: 7, linkedExpenseId: "trips", tripNo: "t1" },
    { date: "2026-03-20", amount: 50, linkedExpenseId: "trips" }
  ];
  assert.equal(tripSpend(TRIP, tx), 120);
});

test("a line's year shared between its trips, and what no trip has yet", function(){
  var trips = [
    { id: "a", lineId: "trips", from: "2026-12-12", budget: 1800 },
    { id: "b", lineId: "trips", month: "2027-04", budget: 2400 },
    { id: "c", lineId: "trips", from: "2027-09-01", budget: 500 },
    { id: "d", lineId: "other", from: "2026-12-01", budget: 900 },
    { id: "e", lineId: "trips", budget: 900 }
  ];
  var s = tripLineSplit(trips, "trips", 6000, "2026-07-01", "2027-06-30");
  assert.deepEqual(s.trips.map(function(t){ return t.id; }), ["a", "b", "e"]);
  assert.deepEqual([s.given, s.unallocated], [5100, 900]);
});
