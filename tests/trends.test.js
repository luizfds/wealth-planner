import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  monthKeysBack, monthKeyLabel, spendByCategoryByMonth, risingStreak, fallingStreak,
  categoryTrend, monthProgressFor, spendingTrends, coveredMonthCount
} from "../src/calc/trends.js";

function txn(date, amount, category){
  return { date: date, amount: amount, category: category };
}
var CATEGORY_OF = function(t){ return t.category || ""; };

// ---------------- month keys ----------------

test("monthKeysBack returns oldest-first and ends with today's month", function(){
  assert.deepEqual(monthKeysBack(4, "2026-09-11"), ["2026-06", "2026-07", "2026-08", "2026-09"]);
});

test("monthKeysBack walks back across a year boundary", function(){
  assert.deepEqual(monthKeysBack(4, "2026-02-15"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("monthKeysBack from the 31st does not skip a 30-day month", function(){
  // Regression guard: stepping back from a Date still sitting on the 31st overflows a 30-day
  // month forward (31 Jan minus one month is 31 Feb = 3 March), which would silently drop a
  // month from the window. The day is pinned to 1 before stepping, so this stays contiguous.
  assert.deepEqual(monthKeysBack(4, "2026-08-31"), ["2026-05", "2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(monthKeysBack(3, "2026-03-31"), ["2026-01", "2026-02", "2026-03"]);
});

test("monthKeysBack of 1 is just this month, and count is floored at 1", function(){
  assert.deepEqual(monthKeysBack(1, "2026-09-11"), ["2026-09"]);
  assert.deepEqual(monthKeysBack(0, "2026-09-11"), ["2026-09"]);
});

test("monthKeyLabel adds the year only when it differs from the reference month", function(){
  assert.equal(monthKeyLabel("2026-09", "2026-09"), "Sep");
  assert.equal(monthKeyLabel("2025-12", "2026-09"), "Dec 25");
  assert.equal(monthKeyLabel("2026-01", null), "Jan");
});

// ---------------- category x month ----------------

test("spendByCategoryByMonth aligns each category to the month window and sorts by total", function(){
  var months = monthKeysBack(3, "2026-09-11");
  var rows = spendByCategoryByMonth([
    txn("2026-07-04", 100, "Groceries"),
    txn("2026-08-04", 150, "Groceries"),
    txn("2026-09-04", 200, "Groceries"),
    txn("2026-09-06", 40, "Fuel")
  ], months, CATEGORY_OF);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, "Groceries");
  assert.deepEqual(rows[0].values, [100, 150, 200]);
  assert.equal(rows[0].total, 450);
  assert.deepEqual(rows[1].values, [0, 0, 40]);
});

test("spendByCategoryByMonth ignores transactions outside the window", function(){
  var months = monthKeysBack(2, "2026-09-11");
  var rows = spendByCategoryByMonth([
    txn("2026-03-01", 999, "Groceries"),   // too old
    txn("2027-01-01", 999, "Groceries"),   // in the future
    txn("2026-09-01", 10, "Groceries")
  ], months, CATEGORY_OF);
  assert.deepEqual(rows[0].values, [0, 10]);
});

test("spendByCategoryByMonth buckets unnamed categories rather than dropping them", function(){
  // The rows have to still add up to what was actually spent, or the table quietly disagrees with
  // every other total on the page.
  var months = monthKeysBack(1, "2026-09-11");
  var rows = spendByCategoryByMonth([txn("2026-09-02", 25, ""), txn("2026-09-03", 5, null)], months, CATEGORY_OF, "Uncategorised");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, "Uncategorised");
  assert.equal(rows[0].total, 30);
});

test("spendByCategoryByMonth resolves the category through the caller's own resolver", function(){
  // Real transactions often carry no category of their own and inherit their linked budget
  // line's — that walk lives in components/expenses.js, so it's passed in.
  var months = monthKeysBack(1, "2026-09-11");
  var rows = spendByCategoryByMonth(
    [{ date: "2026-09-02", amount: 60, linkedExpenseId: "e1" }],
    months,
    function(t){ return t.linkedExpenseId === "e1" ? "Utilities" : ""; }
  );
  assert.equal(rows[0].category, "Utilities");
});

// ---------------- streaks ----------------

test("risingStreak counts increases back from the most recent month", function(){
  assert.equal(risingStreak([10, 20, 30, 40]), 3);
  assert.equal(risingStreak([50, 20, 30, 40]), 2);
  assert.equal(risingStreak([10, 20, 30, 5]), 0);
});

test("a flat month breaks the streak instead of extending it", function(){
  // "Climbing three months running" has to mean climbing, or an unchanged direct debit reads as
  // a trend every month forever.
  assert.equal(risingStreak([10, 20, 20, 30]), 1);
  assert.equal(risingStreak([10, 20, 30, 30]), 0);
});

test("fallingStreak is the mirror image", function(){
  assert.equal(fallingStreak([40, 30, 20, 10]), 3);
  assert.equal(fallingStreak([40, 30, 30, 10]), 1);
});

// ---------------- trend ----------------

test("categoryTrend averages the prior months and excludes the current one", function(){
  // Prior = 100/200/300 -> 200. Including the current month would drag the baseline to 250 and
  // halve the reported rise, which is most wrong exactly when the current month is the outlier.
  var t = categoryTrend([100, 200, 300, 400], { lookback: 3, monthProgress: 1 });
  assert.equal(t.average, 200);
  assert.equal(t.current, 400);
  assert.equal(t.delta, 200);
  assert.equal(t.deltaPct, 1);
  assert.equal(t.direction, "up");
  assert.equal(t.complete, true);
});

test("categoryTrend never extrapolates — it compares the series it is given", function(){
  // The caller feeds it a month-to-date series (every month truncated to the same day), so this
  // is already like-for-like and there is nothing to scale. Scaling was tried and was worse: see
  // the module comment and the bulk-logging test below.
  var t = categoryTrend([100, 100, 100, 100], { lookback: 3, complete: false });
  assert.equal(t.current, 100);
  assert.equal(t.average, 100);
  assert.equal(t.direction, "flat");
  assert.equal(t.complete, false, "complete drives wording only, never the arithmetic");
  assert.equal(t.projected, undefined, "there is no projection any more");
});

test("categoryTrend returns null when there is no prior spend to compare against", function(){
  // An honest "not enough history yet" beats a percentage against zero.
  assert.equal(categoryTrend([0, 0, 0, 500], { lookback: 3 }), null);
  assert.equal(categoryTrend([500], { lookback: 3 }), null);
  assert.equal(categoryTrend([], { lookback: 3 }), null);
});

test("categoryTrend clamps lookback to the history it actually has", function(){
  // Asking for a 3-month average with only two prior months must average those two, not read
  // off the front of the array or return null.
  var t = categoryTrend([100, 300, 400], { lookback: 3, monthProgress: 1 });
  assert.equal(t.lookback, 2);
  assert.equal(t.average, 200);
});

test("categoryTrend never divides by zero on deltaPct", function(){
  var t = categoryTrend([0, 100, 0, 50], { lookback: 3, monthProgress: 1 });
  assert.ok(Number.isFinite(t.deltaPct));
});

test("monthProgressFor is 1 on the last day of the month, and handles a leap February", function(){
  assert.equal(monthProgressFor("2026-09-30"), 1);
  assert.equal(monthProgressFor("2026-02-28"), 1);
  assert.equal(monthProgressFor("2028-02-29"), 1);  // leap year: the 28th is not the end
  assert.ok(Math.abs(monthProgressFor("2028-02-28") - 28 / 29) < 1e-9);
});

// ---------------- the whole view ----------------

test("spendingTrends assembles months, per-category series and column totals", function(){
  var txns = [
    txn("2026-07-04", 100, "Groceries"), txn("2026-08-04", 150, "Groceries"), txn("2026-09-04", 200, "Groceries"),
    txn("2026-07-10", 60, "Fuel"), txn("2026-08-10", 50, "Fuel"), txn("2026-09-10", 40, "Fuel")
  ];
  var out = spendingTrends(txns, { months: 3, todayStr: "2026-09-30", categoryFor: CATEGORY_OF, lookback: 2 });
  assert.deepEqual(out.months, ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(out.totals, [160, 200, 240]);
  assert.equal(out.rows[0].category, "Groceries");
  assert.equal(out.rows[0].risingStreak, 2);
  assert.equal(out.rows[1].fallingStreak, 2);
  assert.equal(out.rows[0].trend.direction, "up");
  assert.equal(out.rows[1].trend.direction, "down");
});

test("spendingTrends drops categories below minSpend on the window total, not on one month", function(){
  // A $4 category that doubled is a true statement and a useless one. But a lumpy category (car
  // rego once a year) has $0 months and must still survive on its window total — coverage is
  // judged on the household's total, not per category, so a quiet category isn't a gap.
  var txns = [
    txn("2026-07-04", 380, "Groceries"), txn("2026-08-04", 400, "Groceries"), txn("2026-09-04", 400, "Groceries"),
    txn("2026-07-06", 300, "Rego"),      // nothing in Aug or Sep
    txn("2026-09-05", 4, "Sweets")
  ];
  var out = spendingTrends(txns, { months: 3, todayStr: "2026-09-30", categoryFor: CATEGORY_OF, minSpend: 50 });
  var names = out.rows.map(function(r){ return r.category; });
  assert.deepEqual(names, ["Groceries", "Rego"]);
  // Dropped rows still count toward the column totals, which describe what was spent, not what
  // was worth listing.
  assert.equal(out.totals[2], 404);
});

test("a part-finished month is compared against the same days of prior months, not whole ones", function(){
  // $200 spent by the 4th in each of July and August; $100 by the 4th of September. Compared
  // against whole months that reads as a 50% collapse; compared like-for-like it is exactly the
  // 50% fall it really is — and the late-month spend in July/August is correctly excluded from
  // the comparison while still showing in the bars.
  var txns = [
    txn("2026-07-04", 200, "Groceries"), txn("2026-07-28", 500, "Groceries"),
    txn("2026-08-04", 200, "Groceries"), txn("2026-08-28", 500, "Groceries"),
    txn("2026-09-04", 100, "Groceries")
  ];
  var out = spendingTrends(txns, { months: 3, todayStr: "2026-09-15", categoryFor: CATEGORY_OF, lookback: 2 });
  var row = out.rows[0];
  assert.equal(out.complete, false);
  assert.deepEqual(row.values, [700, 700, 100], "the bars show whole months");
  assert.deepEqual(row.mtdValues, [200, 200, 100], "the comparison uses the same day of each month");
  assert.equal(row.trend.average, 200);
  assert.equal(row.trend.deltaPct, -0.5);
});

test("bulk-logging early in the month does not manufacture a rise", function(){
  // The real reference-data case that killed the previous approach. Eleven days in, big bills
  // already paid: scaling day-11 spend to a full month turned $3,067 into "on track for $8,366",
  // a 611% rise that never happened. Like-for-like compares it to the same eleven days.
  var txns = [
    txn("2026-08-01", 1200, "Rent"), txn("2026-08-03", 300, "Power"), txn("2026-08-25", 200, "Groceries"),
    txn("2026-09-01", 1200, "Rent"), txn("2026-09-03", 300, "Power")
  ];
  var out = spendingTrends(txns, { months: 2, todayStr: "2026-09-11", categoryFor: CATEGORY_OF, lookback: 1 });
  assert.deepEqual(out.mtdTotals, [1500, 1500]);
  assert.equal(out.totalsTrend.direction, "flat", "same bills, same days — not a 611% rise");
  assert.deepEqual(out.totals, [1700, 1500], "whole-month totals still show August's late groceries");
});


// ---------------- was this month actually being logged? ----------------
// The failure mode this exists to prevent: somebody who started logging in August has $0 across
// every earlier month, and a naive comparison reports groceries "up 3,124%" and "climbing 3
// months running". Both nonsense, both confident, on day one.

test("coveredMonthCount stops at the month before logging started", function(){
  assert.equal(coveredMonthCount([0, 0, 0, 0, 900, 1000]), 2);
  assert.equal(coveredMonthCount([0, 0, 1000, 900, 950, 1000]), 4);
});

test("coveredMonthCount treats a barely-logged month as a gap, not as thin history", function(){
  // $40 in a household whose typical month is $1,000 is somebody who logged one coffee and gave
  // up — averaging against it would understate the baseline by an order of magnitude.
  assert.equal(coveredMonthCount([1000, 40, 900, 1000]), 2);
});

test("coverage is judged month-to-date, so a part-finished month is not mistaken for a gap", function(){
  // Three days in, this household has logged $100 against $90-$110 by the third of each prior
  // month. On a month-to-date footing that is plainly a logged month; measured against whole
  // months it would read as a gap and the panel would blank out for the first week of every month.
  assert.equal(coveredMonthCount([110, 90, 100, 100]), 4);
});

test("coveredMonthCount is 0 when nothing has ever been logged", function(){
  assert.equal(coveredMonthCount([0, 0, 0]), 0);
  assert.equal(coveredMonthCount([]), 0);
});

test("coveredMonthCount uses the household's own scale, not a fixed dollar figure", function(){
  // Same shape at two very different incomes must give the same answer.
  assert.equal(coveredMonthCount([600, 650, 620]), 3);
  assert.equal(coveredMonthCount([60000, 65000, 62000]), 3);
});

test("spendingTrends trims the window to the covered months and says so", function(){
  var txns = [
    txn("2026-08-04", 900, "Groceries"),
    txn("2026-09-04", 1000, "Groceries")
  ];
  var out = spendingTrends(txns, { months: 6, todayStr: "2026-09-30", categoryFor: CATEGORY_OF });
  assert.equal(out.monthsCovered, 2);
  assert.equal(out.monthsRequested, 6);
  assert.deepEqual(out.months, ["2026-08", "2026-09"]);
  assert.deepEqual(out.rows[0].values, [900, 1000]);
});

test("no unlogged month can ever inflate a trend or a streak", function(){
  // The exact real-data case: four empty months, then two real ones. Without trimming this
  // reported groceries up thousands of percent and "climbing 2 months running".
  var txns = [
    txn("2026-08-04", 900, "Groceries"),
    txn("2026-09-04", 1000, "Groceries")
  ];
  var out = spendingTrends(txns, { months: 6, todayStr: "2026-09-30", categoryFor: CATEGORY_OF });
  var row = out.rows[0];
  assert.equal(row.risingStreak, 1, "one rise, not two — there is only one prior month");
  assert.equal(row.trend.average, 900, "the baseline is last month, not an average dragged to ~150 by empty months");
  assert.ok(Math.abs(row.trend.deltaPct - 1 / 9) < 1e-9, "+11%, not +3124%");
});

test("spendingTrends clamps lookback to the covered window", function(){
  // With two logged months the honest comparison is "vs last month", not "vs your 3-month
  // average" computed over two months that were never logged.
  var out = spendingTrends([txn("2026-08-04", 900, "Groceries"), txn("2026-09-04", 1000, "Groceries")],
    { months: 6, todayStr: "2026-09-30", categoryFor: CATEGORY_OF, lookback: 3 });
  assert.equal(out.lookback, 1);
  assert.equal(out.rows[0].trend.lookback, 1);
});

test("spendingTrends returns an empty, honest view when nothing is logged", function(){
  var out = spendingTrends([], { months: 6, todayStr: "2026-09-30", categoryFor: CATEGORY_OF });
  assert.equal(out.monthsCovered, 0);
  assert.deepEqual(out.months, []);
  assert.deepEqual(out.rows, []);
  assert.deepEqual(out.totals, []);
  assert.equal(out.totalsTrend, null);
});
