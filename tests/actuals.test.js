import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { actualRatios, projectionRatios } from "../src/calc/actuals.js";

// v3.52.0, invented household: a $5,000/month take-home and a Net side income; groceries and a
// streaming line, plus a direct-debit rent that's never logged.
function withState(fn){
  var keys = ["income", "incomeLog", "transactions", "properties", "assets", "projection"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.income = [
      { syntheticNetFor: "Alex", computed: true, what: "Alex — net", incomeType: "Net", amount: 5000, freq: "Monthly" },
      { id: "i2", what: "Tutoring", incomeType: "Net", amount: 400, freq: "Monthly" }
    ];
    state.income.push({ id: "p", what: "Pay", person: "Alex", incomeType: "Gross", amount: 1, freq: "Yearly" });
    state.properties = []; state.assets = [];
    state.incomeLog = []; state.transactions = [];
    state.projection = Object.assign({}, state.projection, { source: "actuals" });
    ["2026-05", "2026-06", "2026-07", "2026-08"].forEach(function(m){
      state.incomeLog.push({ id: m, date: m + "-15", amount: 4800, target: "net:Alex" });
      state.transactions.push({ id: "g" + m, date: m + "-10", amount: 900, linkedExpenseId: "g" });
    });
    state.transactions.push({ id: "x", date: "2026-07-03", amount: 200 });
    fn([{ id: "g", what: "Groceries", amount: 1000, freq: "Monthly" }, { id: "rent", what: "Rent", amount: 2000, freq: "Monthly" }]);
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("ratios use only the lines with evidence, over complete months", function(){
  withState(function(items){
    var a = actualRatios("2026-09-12", items);
    assert.equal(a.months, 4);
    assert.equal(a.from, "2026-05-01"); assert.equal(a.to, "2026-08-31");
    assert.equal(a.incomeRatio, 0.96, "take-home only — tutoring had nothing logged");
    assert.equal(a.spendRatio, Math.round((3600 + 200) / 4000 * 1000) / 1000, "groceries plus the one-off; unlogged rent is left out, not read as $0");
    assert.equal(a.available, true);
  });
});

test("fewer than three months isn't enough, and Plan always means 1", function(){
  withState(function(items){
    assert.equal(actualRatios("2026-07-20", items).available, false);
    state.projection.source = "plan";
    assert.deepEqual(projectionRatios(), { incomeDelta: 0, spendDelta: 0, actuals: false });
    state.projection.source = "actuals";
    var r = projectionRatios({ ratios: actualRatios("2026-09-12", items) });
    assert.equal(r.incomeDelta, -200, "4,800 received against 5,000 planned");
    assert.equal(r.spendDelta, -50, "900 + 50 of one-offs a month against 1,000");
  });
});

test("the window is at most six months back from last month", function(){
  withState(function(items){
    var a = actualRatios("2027-03-01", items);
    assert.equal(a.from, "2026-09-01");
    assert.equal(a.months, 6);
    assert.equal(a.incomeLines, 0);
    assert.equal(a.available, false, "nothing logged in that window");
  });
});

test("lumpy lines are left out of the spending comparison", function(){
  withState(function(items){
    items.push({ id: "trip", what: "Travel", amount: 20000, freq: "Yearly", irregular: true });
    state.transactions.push({ id: "t1", date: "2026-06-02", amount: 300, linkedExpenseId: "trip" });
    var a = actualRatios("2026-09-12", items);
    assert.equal(a.spendLines, 1);
    assert.equal(a.spendDeltaMonthly, -50);
  });
});
