import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { setPeriod, periodSelection, selectedYearWindow, selectedMonth, monthAnchorDate, periodAnchorDate, periodLabel,
  periodYearOptions, isPeriodToday, householdYearWindow, householdYearToDate, transactionsInMonth, budgetCycleFor, monthPhrase, yearStartOf } from "../src/calc/ledger.js";

function withBasis(basis, fn){
  var keep = state.yearBasis;
  try { state.yearBasis = basis; fn(); } finally { state.yearBasis = keep; setPeriod(null, ""); }
}

test("nothing picked means the year and month containing today", function(){
  withBasis("financial", function(){
    setPeriod(null, "", "2025-03-10");
    assert.ok(isPeriodToday());
    assert.deepEqual(selectedYearWindow("2025-03-10"), { start: "2024-07-01", end: "2025-06-30", label: "FY24/25" });
    assert.equal(selectedMonth("2025-03-10"), "2025-03");
    assert.equal(periodAnchorDate("2025-03-10"), "2025-03-10");
  });
});

test("a past financial year: its window, its last month, and the year-to-date is complete", function(){
  withBasis("financial", function(){
    setPeriod(2022, "", "2025-03-10");
    assert.deepEqual(periodSelection(), { year: 2022, month: "" });
    assert.equal(selectedMonth("2025-03-10"), "2023-06");
    assert.equal(periodAnchorDate("2025-03-10"), "2023-06-30");
    assert.equal(periodLabel("2025-03-10"), "FY22/23");
    // householdYearWindow() with no date follows the selection
    var w = householdYearWindow();
    assert.equal(w.start, "2022-07-01");
    assert.equal(w.end, "2023-06-30");
    var ytd = householdYearToDate();
    assert.equal(ytd.complete, true);
    assert.equal(ytd.displayLabel, "FY22/23");
  });
});

test("a month inside the selected year; a month outside it is ignored", function(){
  withBasis("financial", function(){
    setPeriod(2022, "2022-11", "2025-03-10");
    assert.equal(selectedMonth("2025-03-10"), "2022-11");
    assert.equal(monthAnchorDate("2025-03-10"), "2022-11-30");
    assert.equal(periodLabel("2025-03-10"), "FY22/23 · Nov");
    setPeriod(2022, "2024-01", "2025-03-10");
    assert.equal(periodSelection().month, "");
  });
});

test("the current year collapses to 'today'; a future year or month is clamped", function(){
  withBasis("financial", function(){
    setPeriod(2024, "", "2025-03-10");
    assert.equal(periodSelection().year, null);
    setPeriod(2030, "", "2025-03-10");
    assert.equal(periodSelection().year, null);
    setPeriod(null, "2025-05", "2025-03-10");
    assert.equal(periodSelection().month, "");
    setPeriod(null, "2025-02", "2025-03-10");
    assert.equal(periodSelection().month, "2025-02");
    assert.equal(isPeriodToday(), false);
  });
});

test("calendar basis: years are January to December", function(){
  withBasis("calendar", function(){
    assert.equal(yearStartOf("calendar", "2025-03-10"), 2025);
    setPeriod(2023, "", "2025-03-10");
    assert.deepEqual(selectedYearWindow("2025-03-10"), { start: "2023-01-01", end: "2023-12-31", label: "2023" });
    assert.equal(selectedMonth("2025-03-10"), "2023-12");
  });
});

test("year options run from the earliest data to now, newest first", function(){
  withBasis("financial", function(){
    var o = periodYearOptions("2021-09-01", "2025-03-10");
    assert.deepEqual(o.map(function(x){ return x.label; }), ["FY24/25", "FY23/24", "FY22/23", "FY21/22"]);
    assert.equal(o[0].current, true);
    assert.equal(periodYearOptions(null, "2025-03-10").length, 3);
  });
});

test("month figures follow the selected month", function(){
  withBasis("financial", function(){
    var tx = [{ date: "2022-11-03", amount: 40 }, { date: "2022-12-01", amount: 9 }];
    setPeriod(2022, "2022-11", "2025-03-10");
    assert.deepEqual(transactionsInMonth(tx).map(function(t){ return t.amount; }), [40]);
    var c = budgetCycleFor({ amount: 100, freq: "Monthly" }, []);
    assert.equal(c.start, "2022-11-01");
    assert.equal(c.end, "2022-11-30");
    assert.equal(c.label, "in November 2022");
    // an explicit date from a caller still means that date's month, labelled "this month"
    assert.equal(budgetCycleFor({ amount: 100, freq: "Monthly" }, [], "2025-03-10").label, "this month");
    assert.equal(monthPhrase("2022-11"), "in November 2022");
  });
});
