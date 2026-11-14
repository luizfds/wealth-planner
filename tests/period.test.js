import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodHeaderLabel } from "../src/components/period.js";
import { transactionDatesLabel } from "../src/components/expenses.js";
import { effectiveFilter } from "../src/calc/txviews.js";
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


test("monthly header labels state the effective month while annual views keep the year", function(){
  const home = {page:"dashboard",sub:"overview"}, budget = {page:"expenses",sub:"budget"};
  withBasis("financial", function(){
    setPeriod(null, "", "2026-11-03");
    assert.equal(periodHeaderLabel("2026-11-03", home), "Nov · FY26/27");
    setPeriod(2025, "", "2026-11-03");
    assert.equal(periodHeaderLabel("2026-11-03", budget), "Jun · FY25/26");
    setPeriod(2025, "2025-08", "2026-11-03");
    assert.equal(periodHeaderLabel("2026-11-03", {page:"expenses",sub:"income"}), "Aug · FY25/26");
    assert.equal(periodHeaderLabel("2026-11-03", {page:"tax",sub:"year"}), "FY25/26");
    assert.equal(periodHeaderLabel("2026-11-03", {page:"reports"}), "FY25/26");
    assert.equal(periodHeaderLabel("2026-11-03", {page:"expenses",sub:"spending"}), "Aug · FY25/26");
  });
  withBasis("calendar", function(){
    setPeriod(2025, "", "2026-11-03");
    assert.equal(periodHeaderLabel("2026-11-03", home), "Dec · 2025");
    setPeriod(null, "", "2026-11-03");
    assert.equal(periodHeaderLabel("2026-11-03", home), "Nov · 2026");
  });
});


test("Spending states local month/year/all windows and effective filter dates", function(){
  withBasis("financial", function(){
    setPeriod(null, "", "2026-11-03");
    assert.equal(transactionDatesLabel("month", null, "2026-11-03"), "Nov 2026");
    assert.equal(transactionDatesLabel("year", null, "2026-11-03"), "FY26/27");
    assert.equal(transactionDatesLabel("all", null, "2026-11-03"), "All dates");
    const filter = effectiveFilter({trip:"example",from:"2025-08-01",to:"2025-08-20"},[{id:"example",from:"2025-08-05",to:"2025-08-10"}]);
    assert.equal(transactionDatesLabel("month", filter, "2026-11-03"), "5 Aug 2025 – 10 Aug 2025");
    assert.equal(transactionDatesLabel("year", {from:"2025-08-01"}, "2026-11-03"), "From 1 Aug 2025");
    assert.equal(transactionDatesLabel("all", {to:"2025-08-20"}, "2026-11-03"), "Through 20 Aug 2025");
    assert.equal(transactionDatesLabel("month", effectiveFilter({trip:"missing"},[]), "2026-11-03"), "Trip unavailable");
  });
  withBasis("calendar", function(){
    setPeriod(2025, "", "2026-11-03");
    assert.equal(transactionDatesLabel("month", null, "2026-11-03"), "Dec 2025");
    assert.equal(transactionDatesLabel("year", null, "2026-11-03"), "2025");
  });
});
