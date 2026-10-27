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

import { projectionBands } from "../src/calc/outcomes.js";
import { computeNetWorthSeries, currentScenario } from "../src/calc/engine.js";
test("the projection's range: the 10th–90th band holds the steady line, widening with the years", function(){
  withDemo(function(){
    var sc = currentScenario();
    var b = projectionBands(sc, 20, { runs: 120, realTerms: true, projection: state.projection });
    var steady = computeNetWorthSeries(sc, 20, { realTerms: true });
    assert.equal(b.lo.length, 21);
    assert.equal(Math.round(b.lo[0].y), Math.round(steady[0].y)); // today is known
    [5, 10, 20].forEach(function(y){ assert.ok(b.lo[y].y < steady[y].y && steady[y].y < b.hi[y].y, "year " + y); });
    assert.ok(b.hi[20].y - b.lo[20].y > b.hi[5].y - b.lo[5].y);
    // The cached runs leave the steady answer alone.
    assert.deepEqual(computeNetWorthSeries(sc, 20, { realTerms: true }), steady);
  });
});

test("life events move the projection by what they cost, inflated to their years", function(){
  withDemo(function(){
    var sc = currentScenario();
    var base = computeNetWorthSeries(sc, 10, { realTerms: false, events: [] });
    var inherit = computeNetWorthSeries(sc, 10, { realTerms: false, events: [{ kind: "lump", year: Number(TODAY_YEAR()) + 2, amount: 100000 }] });
    assert.equal(Math.round(inherit[2].y - base[2].y), 0); // not yet
    assert.ok(inherit[3].y - base[3].y > 100000); // landed at the start of year 3, inflated and grown a year
    var child = computeNetWorthSeries(sc, 10, { realTerms: false, events: [{ kind: "child", year: Number(TODAY_YEAR()), years: 18, amount: 12000 }] });
    assert.ok(base[10].y - child[10].y > 120000);
  });
});
function TODAY_YEAR(){ return new Date().getFullYear(); }
