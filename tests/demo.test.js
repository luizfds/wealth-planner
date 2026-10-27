import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, setState, migrateState } from "../src/state.js";
import { demoHousehold, demoReceipts, DEMO_PEOPLE } from "../src/calc/demo.js";
import { recalcComputedItems, totalNetWorthValue } from "../src/calc/engine.js";
import { incomeTargets } from "../src/calc/received.js";
import { buildReport, REPORTS } from "../src/calc/reports.js";

// v3.104.0: the sample household is fixed, and full enough that nothing in the app reads $0.
var TODAY = "2026-10-27";
var WIN = { start: "2026-07-01", end: "2027-06-30", label: "FY26/27" };

function withDemo(fn){
  var keep = state;
  try {
    setState(migrateState(demoHousehold(TODAY)));
    recalcComputedItems();
    demoReceipts(state, TODAY, incomeTargets());
    fn();
  } finally { setState(keep); }
}

test("the demo is the same household on every load; only the dates follow today", function(){
  assert.deepEqual(demoHousehold(TODAY), demoHousehold(TODAY));
  var later = demoHousehold("2027-03-14");
  assert.equal(later.transactions.length > 0, true);
  assert.ok(later.transactions.every(function(t){ return t.date < "2027-03-14"; }), "nothing in the future");
  assert.deepEqual(later.income.map(function(i){ return i.amount; }), demoHousehold(TODAY).income.map(function(i){ return i.amount; }));
});

test("eighteen months of spending, pay and rent, each linked to a line that exists", function(){
  withDemo(function(){
    var months = {};
    state.transactions.forEach(function(t){ months[t.date.slice(0, 7)] = true; });
    assert.equal(Object.keys(months).length, 18);
    var lineIds = {};
    state.shared.concat(state.home.Renting, state.properties[0].expenses).forEach(function(l){ lineIds[l.id] = true; });
    assert.ok(state.transactions.every(function(t){ return lineIds[t.linkedExpenseId]; }), "every transaction is on a budget line");
    var targets = {};
    state.incomeLog.forEach(function(r){ targets[r.target.split(":")[0]] = true; });
    assert.deepEqual(Object.keys(targets).sort(), ["net", "oneoff", "rent"]);
    DEMO_PEOPLE.forEach(function(p){ assert.ok(state.incomeLog.some(function(r){ return r.target === "net:" + p; }), p + " is paid"); });
    assert.ok(state.transfers.some(function(x){ return x.to === "Credit Card"; }), "the card is repaid");
    assert.ok(state.netWorthLog.length >= 17);
    assert.ok(totalNetWorthValue() > 0);
  });
});

test("every report has something in it", function(){
  withDemo(function(){
    REPORTS.filter(function(r){ return ["cashflow", "categories", "networth", "property", "tax"].indexOf(r.key) !== -1; }).forEach(function(r){
      var rep = buildReport(r.key, { today: TODAY, win: WIN });
      var nums = [];
      rep.rows.forEach(function(row){ Object.keys(row.cells).forEach(function(k){ var v = row.cells[k]; if(typeof v === "number" && v !== 0) nums.push(v); }); });
      assert.ok(nums.length > 0, r.label + " has non-zero figures");
    });
  });
});
