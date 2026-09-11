import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  householdYearBasis, householdYearWindow, householdYearToDate, householdYearProgress,
  reserveYearWindowFor, reserveYearWindow, HOUSEHOLD_YEAR_BASES
} from "../src/calc/ledger.js";
import { state } from "../src/state.js";

function withBasis(basis, body){
  var saved = state.yearBasis;
  state.yearBasis = basis;
  try { body(); } finally { state.yearBasis = saved; }
}

test("the household year defaults to the financial year", function(){
  // An Australian app whose whole point is a tax return shouldn't default to Jan-Dec.
  withBasis(undefined, function(){ assert.equal(householdYearBasis(), "financial"); });
  withBasis("nonsense", function(){ assert.equal(householdYearBasis(), "financial"); });
  withBasis("", function(){ assert.equal(householdYearBasis(), "financial"); });
});

test("only the two real calendars are household bases", function(){
  // rolling12 stays a per-line choice: it's a way of budgeting one lumpy line, not a year anyone
  // else — least of all the ATO — recognises.
  assert.deepEqual(HOUSEHOLD_YEAR_BASES, ["financial", "calendar"]);
  withBasis("rolling12", function(){ assert.equal(householdYearBasis(), "financial"); });
});

test("the financial year runs Jul-Jun and is labelled the way a statement writes it", function(){
  withBasis("financial", function(){
    assert.deepEqual(householdYearWindow("2026-09-11"), { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" });
    // Before July you're still in the year that opened last July.
    assert.deepEqual(householdYearWindow("2026-06-30"), { start: "2025-07-01", end: "2026-06-30", label: "FY25/26" });
    assert.deepEqual(householdYearWindow("2026-07-01"), { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" });
  });
});

test("the calendar basis is Jan-Dec", function(){
  withBasis("calendar", function(){
    var w = householdYearWindow("2026-09-11");
    assert.equal(w.start, "2026-01-01");
    assert.equal(w.end, "2026-12-31");
  });
});

test("year-to-date stops at today and says the year isn't over", function(){
  // Comparing a part-finished year against a whole year's budget without saying so is the same
  // mistake the spending-trends panel exists to avoid.
  withBasis("financial", function(){
    var ytd = householdYearToDate("2026-09-11");
    assert.equal(ytd.start, "2026-07-01");
    assert.equal(ytd.end, "2026-09-11", "cut off at today, not the year's end");
    assert.equal(ytd.complete, false);
    assert.equal(ytd.displayLabel, "FY26/27 so far");
  });
});

test("year-to-date on the last day of the year is the whole year", function(){
  withBasis("financial", function(){
    var ytd = householdYearToDate("2027-06-30");
    assert.equal(ytd.end, "2027-06-30");
    assert.equal(ytd.complete, true);
    assert.equal(ytd.displayLabel, "FY26/27", 'a finished year does not say "so far"');
  });
});

test("householdYearProgress is a fraction of the year, inclusive of today", function(){
  withBasis("financial", function(){
    assert.equal(householdYearProgress("2027-06-30"), 1);
    // 1 July is day one of 365 — a fraction, not zero, because the day has started.
    var firstDay = householdYearProgress("2026-07-01");
    assert.ok(firstDay > 0 && firstDay < 0.01, "day one is a sliver, not 0: " + firstDay);
    // 11 Sep is 73 days into a 365-day FY.
    assert.ok(Math.abs(householdYearProgress("2026-09-11") - 73 / 365) < 1e-9);
  });
});

test("householdYearProgress handles a leap year in the calendar basis", function(){
  withBasis("calendar", function(){
    assert.equal(householdYearProgress("2028-12-31"), 1);
    assert.ok(Math.abs(householdYearProgress("2028-03-01") - 61 / 366) < 1e-9, "Jan 31 + Feb 29 + Mar 1");
  });
});

test("a reserve line with no explicit basis follows the household", function(){
  // Before this, the fallback was a hard "calendar" — wrong for this app, and invisible on the row.
  withBasis("financial", function(){
    assert.equal(reserveYearWindowFor({ reserveYear: "" }).label, "FY26/27".slice(0, 2) + reserveYearWindowFor({ reserveYear: "" }).label.slice(2));
    assert.equal(reserveYearWindowFor({ reserveYear: "" }).start, householdYearWindow().start);
    assert.equal(reserveYearWindowFor({}).start, householdYearWindow().start);
    assert.equal(reserveYearWindowFor(null).start, householdYearWindow().start);
  });
  withBasis("calendar", function(){
    assert.equal(reserveYearWindowFor({ reserveYear: "" }).start, householdYearWindow().start);
  });
});

test("a reserve line with an explicit basis keeps it, whatever the household uses", function(){
  // Someone who deliberately set a travel budget to roll over twelve months shouldn't have that
  // quietly replaced when the household preference changes.
  withBasis("financial", function(){
    assert.equal(reserveYearWindowFor({ reserveYear: "calendar" }, "2026-09-11").start, "2026-01-01");
    assert.equal(reserveYearWindowFor({ reserveYear: "rolling12" }, "2026-09-11").label, "last 12 months");
  });
});

test("reserveYearWindow itself is unchanged and still takes an explicit basis", function(){
  // It's the primitive; only the *fallback* moved to the household preference.
  assert.equal(reserveYearWindow("financial", "2026-09-11").label, "FY26/27");
  assert.equal(reserveYearWindow("calendar", "2026-09-11").start, "2026-01-01");
});

test("the calendar household year is labelled with the year, not \"this year\"", function(){
  // reserveYearWindow's "this year" reads correctly in the sentence it was written for — a row's
  // "$X actual / $Y planned this year". As a household year it lands in "$4,953 logged in ___"
  // and in an export filename, where it's clumsy and useless respectively.
  withBasis("calendar", function(){
    assert.equal(householdYearWindow("2026-09-11").label, "2026");
    assert.equal(householdYearToDate("2026-09-11").displayLabel, "2026 so far");
  });
  withBasis("financial", function(){
    assert.equal(householdYearWindow("2026-09-11").label, "FY26/27", "already a noun, left alone");
  });
});

test("the per-line reserve label is not affected by the household relabel", function(){
  // A reserve row explicitly set to the calendar year still reads "this year" in its own sentence.
  assert.equal(reserveYearWindow("calendar", "2026-09-11").label, "this year");
});
