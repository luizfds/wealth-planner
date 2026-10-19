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
  assert.deepEqual(t, { id: "x", name: "Trip", from: "2026-05-01", to: "2026-05-04", lineId: "trips" });
  assert.equal(normaliseTrip({ from: "2026-05-01" }).to, "2026-05-01");
});
