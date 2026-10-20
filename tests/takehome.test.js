import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { takeHomeDrift, setTakeHomeAdjust } from "../src/calc/takehome.js";
import { personOneOffSplit, scenarioIncomeRows, takeHomeAdjust } from "../src/calc/tax.js";
import { takeHomeHtml } from "../src/components/received.js";

// Pay received against the plan (v3.87.0), invented household.
function withPay(amounts, fn){
  var keys = ["income", "incomeLog", "tax"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.income = [{ id: "g1", person: "Alex", incomeType: "Gross", what: "Salary", amount: 7500, freq: "Monthly" }];
    state.tax = Object.assign({}, state.tax, { settings: {} });
    state.incomeLog = amounts.map(function(a, i){ return { id: "r" + i, date: "2026-0" + (6 + i) + "-15", amount: a, target: "net:Alex" }; });
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("three months clearly below the estimate: drift, and the adjustment that matches it", function(){
  withPay([4300, 4400, 4250], function(){
    var est = personOneOffSplit("Alex").regularNet / 12;
    var d = takeHomeDrift("Alex", "2026-09-20");
    assert.ok(d, "found");
    assert.ok(d.gap < 0);
    assert.equal(d.actual, Math.round((4300 + 4400 + 4250) / 3 * 100) / 100);
    assert.ok(Math.abs(d.suggestedAdjust - (d.actual - est)) < 0.01);
    assert.match(takeHomeHtml("2026-09-20"), /Alex's take-home has landed about \$[\d,]+\/mo below the plan/);
    setTakeHomeAdjust("Alex", d.suggestedAdjust);
    assert.equal(takeHomeAdjust("Alex"), d.suggestedAdjust);
    var row = scenarioIncomeRows({}).find(function(r){ return r.syntheticNetFor === "Alex"; });
    assert.ok(Math.abs(row.amount - d.actual) < 0.02, "the plan now carries what lands");
    assert.equal(takeHomeDrift("Alex", "2026-09-20"), null, "nothing left to flag");
    assert.match(takeHomeHtml("2026-09-20"), /Use the tax estimate/);
    setTakeHomeAdjust("Alex", 0);
    assert.equal(state.tax.settings.Alex.takeHomeAdjust, undefined);
  });
});

test("no drift: a month missing, or months that disagree", function(){
  withPay([4300, 4400], function(){ assert.equal(takeHomeDrift("Alex", "2026-09-20"), null, "only two months logged"); });
  withPay([4300, 9000, 4250], function(){ assert.equal(takeHomeDrift("Alex", "2026-09-20"), null, "one month above, two below"); });
});
