import { test } from "node:test";
import assert from "node:assert/strict";
import { mondayOf, recapWeek, weekRecap, usualWeek, showWeekRecap, dismissWeekRecap, transactionsBetween } from "../src/calc/weekrecap.js";

// Wednesday 28 October 2026; the week just finished is Mon 19 – Sun 25 October.
var TODAY = "2026-10-28";
function tx(date, amount, what){ return { id: date + what, date: date, amount: amount, what: what }; }
var TXS = [
  tx("2026-10-19", 84.5, "Fern Grocer"), tx("2026-10-21", 12, "Fern Cafe"), tx("2026-10-25", 310, "Peak Fitness"),
  tx("2026-10-23", -20, "Fern Grocer refund"), tx("2026-10-26", 999, "This week, not last"), tx("2026-10-18", 40, "The week before"),
  // Earlier weeks: 100, 200, 300, 400 → usual 250
  tx("2026-10-13", 100, "A"), tx("2026-10-06", 200, "B"), tx("2026-09-29", 300, "C"), tx("2026-09-22", 400, "D")
];

test("the week is the last whole Monday to Sunday", function(){
  assert.equal(mondayOf("2026-10-28"), "2026-10-26");
  assert.equal(mondayOf("2026-10-26"), "2026-10-26");
  assert.equal(mondayOf("2026-11-01"), "2026-10-26"); // a Sunday
  assert.deepEqual(recapWeek(TODAY), { start: "2026-10-19", end: "2026-10-25" });
  assert.deepEqual(recapWeek(TODAY, 1), { start: "2026-10-12", end: "2026-10-18" });
});

test("spent is Spending's rows for those days, refunds netted", function(){
  var w = weekRecap(TXS, TODAY);
  var rows = transactionsBetween(TXS, "2026-10-19", "2026-10-25");
  assert.equal(w.count, rows.length);
  assert.equal(w.spent, 386.5);
  assert.deepEqual(w.biggest.map(function(t){ return t.what; }), ["Peak Fitness", "Fern Grocer", "Fern Cafe"]);
});

test("the usual week is the median of earlier weeks, once there are three", function(){
  // The week of 12 Oct holds 100 + 40.
  assert.equal(usualWeek(TXS, "2026-10-19").amount, 250);
  assert.equal(weekRecap(TXS, TODAY).vsUsual, 136.5);
  assert.equal(usualWeek(TXS.slice(0, 7), "2026-10-19"), null);
});

test("bills are the week ahead only, and an earlier week has none", function(){
  var bills = [{ what: "Power", due: "2026-10-29", amount: 120 }, { what: "Rent", due: "2026-11-04", amount: 900 },
    { what: "Late", due: "2026-10-20", amount: 50, overdue: true }];
  var w = weekRecap(TXS, TODAY, { bills: bills, toReview: 2, notice: { title: "Something" } });
  assert.deepEqual(w.bills.map(function(b){ return b.what; }), ["Power"]);
  assert.equal(w.billsTotal, 120);
  var old = weekRecap(TXS, TODAY, { back: 1, bills: bills, toReview: 2, notice: { title: "x" } });
  assert.equal(old.start, "2026-10-12");
  assert.deepEqual(old.bills, []); assert.equal(old.toReview, 0); assert.equal(old.notice, null);
});

test("shown once a week until dismissed, and the dismissal is kept in state for four weeks", function(){
  var st = { transactions: TXS, weekRecaps: { "2026-08-03": "dismissed" } };
  assert.equal(showWeekRecap(st, TODAY), true);
  dismissWeekRecap(st, TODAY);
  assert.equal(st.weekRecaps["2026-10-19"], "dismissed");
  assert.equal(st.weekRecaps["2026-08-03"], undefined);
  assert.equal(showWeekRecap(st, TODAY), false);
  assert.equal(showWeekRecap(st, "2026-11-01"), false); // still the same week
  assert.equal(showWeekRecap(st, "2026-11-02"), true);  // next Monday
  // A household that logs no spending isn't shown one.
  assert.equal(showWeekRecap({ transactions: [] }, TODAY), false);
});

test("a week put away on one device stays put away on the other after a sync", async function(){
  var { mergeStates } = await import("../src/calc/syncmerge.js");
  var base = { transactions: TXS, weekRecaps: {} };
  var phone = { transactions: TXS, weekRecaps: { "2026-10-19": "dismissed" } };
  var laptop = { transactions: TXS, weekRecaps: { "2026-10-12": "dismissed" } };
  var r = mergeStates(base, laptop, phone);
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(r.merged.weekRecaps, { "2026-10-12": "dismissed", "2026-10-19": "dismissed" });
  assert.equal(showWeekRecap(r.merged, TODAY), false);
});
