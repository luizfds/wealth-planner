import test from "node:test";
import assert from "node:assert/strict";
import { monthDetail, monthFigures, baselineMonths, median, moneyIn, monthTrend, shiftMonth } from "../src/calc/monthdetail.js";

// Invented household: ten cafe visits and a grocery shop every month, rent twice, pay once.
function month(ym, extra){
  var tx = [];
  for(var i = 1; i <= 10; i++) tx.push({ id: ym + "c" + i, date: ym + "-" + String(i + 1).padStart(2, "0"), amount: 10, what: "Fern Cafe", linkedExpenseId: "cafe" });
  tx.push({ id: ym + "g", date: ym + "-15", amount: 300, what: "Bank One Grocer", linkedExpenseId: "groc" });
  tx.push({ id: ym + "r1", date: ym + "-03", amount: 1000, what: "Rent", linkedExpenseId: "rent" });
  tx.push({ id: ym + "r2", date: ym + "-17", amount: 1000, what: "Rent", linkedExpenseId: "rent" });
  tx.push({ id: ym + "m", date: ym + "-20", amount: 15, what: "Music", linkedExpenseId: "music" });
  return tx.concat(extra || []);
}
var LINES = { cafe: { id: "cafe", what: "Coffee", category: "Eating out", irregular: true }, groc: { id: "groc", what: "Groceries", category: "Groceries", freq: "Weekly" },
  rent: { id: "rent", what: "Rent", category: "Housing", freq: "Fortnightly" }, music: { id: "music", what: "Music", category: "Subscriptions", freq: "Monthly", amount: 15 },
  trip: { id: "trip", what: "Trips", category: "Travel", irregular: true } };
var OPTS = { categoryOf: function(t){ return (LINES[t.linkedExpenseId] || {}).category || ""; }, lineOf: function(t){ return LINES[t.linkedExpenseId] || null; }, monthlyBills: [LINES.music] };
function household(){
  var tx = [], log = [];
  ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].forEach(function(ym){ tx = tx.concat(month(ym)); log.push({ date: ym + "-25", amount: 5000, target: "net:Alex" }); });
  // July: a trip, a new place, no music bill, and a bonus.
  tx = tx.concat(month("2026-07", [{ id: "big", date: "2026-07-10", amount: 900, what: "Coast Lodge", linkedExpenseId: "trip" }])).filter(function(t){ return t.id !== "2026-07m"; });
  log.push({ date: "2026-07-25", amount: 5000, target: "net:Alex" }, { date: "2026-07-26", amount: 3000, target: "oneoff:b1", what: "Bonus" });
  return { transactions: tx, incomeLog: log, assets: [{ what: "Fern Fund", payouts: [{ date: "2026-07-15", cash: 40 }] }],
    trips: [{ id: "t1", name: "Coast", from: "2026-07-09", to: "2026-07-12", lineId: "trip" }] };
}

test("the median, and months shifted across a year end", function(){
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 10]), 2.5);
  assert.equal(median([]), 0);
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2025-12", 2), "2026-02");
});

test("money in by kind, distributions included", function(){
  var m = moneyIn(household(), "2026-07");
  assert.deepEqual(m.by, { pay: 5000, rent: 0, oneOff: 3000, other: 0, payouts: 40 });
  assert.equal(monthFigures(household(), "2026-07").regularIn, 5040);
});

test("a month against its usual: what moved, what was new, what was missing", function(){
  var st = household();
  assert.deepEqual(baselineMonths(st, "2026-07", 6), ["2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"]);
  var d = monthDetail(st, "2026-07", OPTS);
  assert.equal(d.usual.out, 2415);
  assert.equal(d.figures.out, 3300);
  var texts = d.findings.map(function(f){ return f.text; });
  assert.ok(texts.some(function(t){ return /^Travel \$900 more than usual/.test(t); }), texts.join(" | "));
  assert.ok(texts.some(function(t){ return /Coast Lodge \$900 — your largest one-off spend in 6 months/.test(t); }));
  assert.ok(!texts.some(function(t){ return /^New: Coast Lodge/.test(t); }), "said once, not twice");
  assert.ok(texts.some(function(t){ return t === "One-off in: Bonus $3000"; }));
  assert.ok(texts.some(function(t){ return t === "Trip: Coast $900"; }));
  assert.ok(texts.some(function(t){ return /Music usually comes every month/.test(t); }));
  assert.ok(!texts.some(function(t){ return /Rent/.test(t); }), "rent is never news by itself");
});

test("a barely-logged month isn't part of anyone's usual, and is flagged when shown", function(){
  var st = household();
  st.transactions = st.transactions.filter(function(t){ return t.date.slice(0, 7) !== "2026-03" || /c[1-3]$/.test(t.id); });
  assert.equal(baselineMonths(st, "2026-07", 6).indexOf("2026-03"), -1);
  assert.equal(monthDetail(st, "2026-03", OPTS).partial, true);
  assert.equal(monthTrend(st, "2026-07", 3).map(function(m){ return m.ym; }).join(","), "2026-05,2026-06,2026-07");
});

test("the month still running is compared with a usual month up to the same day", function(){
  var st = household();
  var d = monthDetail(st, "2026-07", Object.assign({ today: "2026-07-15" }, OPTS));
  assert.equal(d.inProgress, true);
  assert.ok(Math.abs(d.usual.out - 2415 * 15 / 31) < 0.01);
  assert.ok(!d.findings.some(function(f){ return /usually comes every month|less than usual/.test(f.text); }), "nothing is missing or low yet");
});
