import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  valueOn, trackedOn, observationDates, categorySeries, trimUntracked,
  allocationSeries, contributionsVsGrowth, monthsBetween, monthlyCashFlow,
  fullCoverageFrom, spendCoverage
} from "../src/calc/history.js";

// The whole module exists to enforce one rule: never draw a value that wasn't logged. Most of these
// tests are that rule seen from a different angle, because it is the difference between a chart
// that tells you something and one that invents something.

var SUPER = [
  { date: "2025-07-31", value: 100000 },
  { date: "2026-01-31", value: 120000 },
  { date: "2026-08-31", value: 140000 }
];

test("valueOn carries the last logged value forward, not the next one backward", function(){
  // A holding logged in July and again in January was not worth its January value in October.
  assert.equal(valueOn(SUPER, "2025-10-01"), 100000);
  assert.equal(valueOn(SUPER, "2026-01-31"), 120000, "on the day itself, that day's value");
  assert.equal(valueOn(SUPER, "2026-12-01"), 140000, "after the last snapshot, the last snapshot");
});

test("valueOn returns null before the first snapshot — not zero", function(){
  // These are different claims. "I don't know what this was worth" must not be drawn as "it was
  // worth nothing", which is a portfolio dip that never happened.
  assert.equal(valueOn(SUPER, "2025-01-01"), null);
  assert.equal(valueOn([], "2026-01-01"), null);
  assert.equal(valueOn(null, "2026-01-01"), null);
  assert.equal(trackedOn(SUPER, "2025-01-01"), false);
  assert.equal(trackedOn(SUPER, "2025-07-31"), true);
});

test("observationDates uses the dates things were actually logged", function(){
  // Real observation dates, not a synthetic monthly grid — a grid implies readings that never
  // happened, at values nobody recorded.
  var dates = observationDates([SUPER, [{ date: "2026-03-15", value: 5 }]], ["2026-09-12"]);
  assert.deepEqual(dates, ["2025-07-31", "2026-01-31", "2026-03-15", "2026-08-31", "2026-09-12"]);
  assert.deepEqual(observationDates([], []), []);
});

test("a holding contributes nothing before its first snapshot, rather than zero", function(){
  // The bug this prevents: a category total that visibly dips on the day a *second* holding was
  // first logged, because the first chart point silently counted it as $0.
  var records = [
    { history: SUPER, current: 140000 },
    { history: [{ date: "2026-08-31", value: 60000 }], current: 60000 }
  ];
  var dates = ["2025-07-31", "2026-01-31", "2026-08-31"];
  var series = categorySeries(records, dates);
  assert.deepEqual(series.map(function(p){ return p.y; }), [100000, 120000, 200000]);
  assert.deepEqual(series.map(function(p){ return p.tracked; }), [1, 1, 2],
    "the second holding only starts counting once it has been logged");
});

test("today counts what's typed in the app, even if Log was never pressed", function(){
  // The one place a value with no snapshot is legitimate: the amount currently on screen is a real
  // present-day figure. Anywhere earlier, the same inference would be fiction.
  var records = [{ history: [], current: 8000 }];
  var withToday = categorySeries(records, ["2026-01-01", "2026-09-12"], { today: "2026-09-12" });
  assert.equal(withToday[0].y, 0);
  assert.equal(withToday[0].tracked, 0, "January is untracked, not zero");
  assert.equal(withToday[1].y, 8000);
  assert.equal(withToday[1].tracked, 1);
});

test("trimUntracked drops the leading run where nothing was known yet", function(){
  // Without this the chart opens with a flat line at $0 climbing out of nothing, which reads as a
  // portfolio that started from zero on a date it did not.
  var points = [
    { y: 0, tracked: 0 }, { y: 0, tracked: 0 }, { y: 100, tracked: 1 }, { y: 120, tracked: 1 }
  ];
  assert.equal(trimUntracked(points).length, 2);
  assert.deepEqual(trimUntracked([{ y: 0, tracked: 0 }]), [], "all-untracked yields no line at all");
  assert.deepEqual(trimUntracked([]), []);
});

test("allocation keeps each bucket's colour with the bucket, not its position", function(){
  // Colour follows the entity, never its rank: a bucket that empties must not hand its colour to
  // the next one along, or the chart repaints itself when a filter changes.
  var buckets = [
    { key: "Super", colorClass: "series-color-0", records: [{ history: SUPER }] },
    { key: "Cash", colorClass: "series-color-2", records: [] }
  ];
  var series = allocationSeries(buckets, ["2026-08-31"]);
  assert.deepEqual(series.map(function(s){ return s.key + ":" + s.colorClass; }),
    ["Super:series-color-0", "Cash:series-color-2"]);
  assert.equal(series[1].points[0].y, 0, "an empty bucket is a flat zero, not a missing series");
});

test("contributions vs growth splits the change and can report negative growth", function(){
  // Negative growth is a real reading, not an error: the portfolio grew by less than was paid into
  // it, i.e. the market went backwards while you kept saving.
  var points = [
    { y: 100000, dateLabel: "2026-01-01" },
    { y: 130000, dateLabel: "2026-07-01" }
  ];
  var up = contributionsVsGrowth(points, 3000);
  assert.equal(up.months, 6);
  assert.equal(up.totalChange, 30000);
  assert.equal(up.contributed, 18000);
  assert.equal(up.growth, 12000);

  var down = contributionsVsGrowth(points, 6000);
  assert.equal(down.contributed, 36000);
  assert.equal(down.growth, -6000);
});

test("a part-month window counts proportionally, or the remainder lands in 'growth'", function(){
  // Over 45 days, calling it one month of contributions understates by half a month — and on this
  // arithmetic every dollar of that understatement is attributed to growth instead.
  assert.ok(Math.abs(monthsBetween("2026-01-01", "2026-02-15") - 1.4667) < 0.01);
  assert.equal(monthsBetween("2026-01-01", "2026-01-01"), 0);
  assert.equal(monthsBetween("", "2026-01-01"), 0);
  assert.equal(contributionsVsGrowth([{ y: 1, dateLabel: "2026-01-01" }], 100), null, "one point is not a change");
});

test("monthly cash flow marks a month nobody logged, rather than calling it heroic saving", function(){
  // An unlogged month has zero spending in the data and therefore looks like a month of perfect
  // restraint. `logged` is what lets the caller refuse to draw that.
  var rows = monthlyCashFlow(
    [{ date: "2026-08-04", amount: 500 }, { date: "2026-08-20", amount: 300 }],
    ["2026-07", "2026-08"], 5000
  );
  assert.equal(rows[0].spent, 0);
  assert.equal(rows[0].logged, false, "July had nothing logged");
  assert.equal(rows[1].spent, 800);
  assert.equal(rows[1].saved, 4200);
  assert.equal(rows[1].logged, true);
});

test("a refund reduces a month's spending rather than being ignored", function(){
  var rows = monthlyCashFlow(
    [{ date: "2026-08-04", amount: 500 }, { date: "2026-08-09", amount: -120 }],
    ["2026-08"], 5000
  );
  assert.equal(rows[0].spent, 380);
  assert.equal(rows[0].saved, 4620);
});

// ---------------- Two ways this module could have lied ----------------
// Both of these were live on the reference data before being caught by driving the app. They are
// here because the arithmetic was never wrong — the *framing* was, and only real data showed it.

test("the split only measures a span where the same assets were tracked at both ends", function(){
  // The real failure: super and cash logged from July 2025, shares and property added August 2026.
  // Measured from the earliest point, net worth "grew" $402,372 — about $385,000 of which was
  // assets that merely started being tracked. That is a fabrication, not a rounding error.
  var points = [
    { y: 170000, dateLabel: "2025-07-31", tracked: 3 },
    { y: 175000, dateLabel: "2026-01-31", tracked: 3 },
    { y: 560000, dateLabel: "2026-08-31", tracked: 5 },
    { y: 576000, dateLabel: "2026-09-12", tracked: 5 }
  ];
  assert.equal(fullCoverageFrom(points), 2, "coverage is only complete from the third point");
  var split = contributionsVsGrowth(points, 8339);
  assert.equal(split.from, "2026-08-31", "not 2025-07-31");
  assert.equal(split.totalChange, 16000, "the real like-for-like change, not $402,372");
  assert.equal(split.droppedPoints, 2, "and it says how much history it set aside");
  assert.equal(split.earliest, "2025-07-31", "so the panel can name what was left out");
});

test("a window that only reaches full coverage at the very last point reports tooShort", function(){
  // Better to say "not yet" than to compute a split across a single instant.
  var points = [
    { y: 100, dateLabel: "2026-01-01", tracked: 1 },
    { y: 900, dateLabel: "2026-09-01", tracked: 2 }
  ];
  var split = contributionsVsGrowth(points, 100);
  assert.equal(split.tooShort, true);
  assert.equal(split.coverageFrom, "2026-09-01");
});

test("spendCoverage refuses a savings claim when barely anything was logged", function(){
  // The real failure: logged spend averaged $777/mo against a $14,613/mo budget, and the panel
  // announced the household kept $21,713/mo. It keeps $8,339. "Income minus what you logged" was
  // measuring how little had been typed in, and calling it thrift.
  var thin = spendCoverage(777, 14613);
  assert.ok(thin.fraction < 0.06);
  assert.equal(thin.enough, false, "no savings claim may be made from this");

  var good = spendCoverage(13000, 14613);
  assert.equal(good.enough, true);
  // No budget at all can't be divided by — and must not read as perfect coverage.
  assert.equal(spendCoverage(500, 0).enough, false);
  assert.equal(spendCoverage(0, 14613).enough, false);
});
