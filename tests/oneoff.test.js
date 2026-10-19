import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { personOneOffSplit, scenarioIncomeRows, computePersonTax, isOneOffIncome } from "../src/calc/tax.js";
import { recalcComputedItems, scenarioTotals } from "../src/calc/engine.js";
import { incomeTargets } from "../src/calc/received.js";
import { monthlyCashFlow } from "../src/calc/history.js";

function withIncome(rows, fn){
  var keep = state.income;
  try { state.income = rows; fn(); } finally { state.income = keep; recalcComputedItems(); }
}
var SALARY = { id: "s1", what: "Salary", person: "Alex", incomeType: "Gross", amount: 8000, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 };
var BONUS = { id: "b1", what: "Bonus", person: "Alex", incomeType: "Gross", amount: 12000, freq: "Yearly", irregular: true, dueMonth: 9, superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 };

test("a bonus's after-tax amount is what it adds; the parts add up to the year's take-home", function(){
  withIncome([SALARY, BONUS].map(function(r){ return Object.assign({}, r); }), function(){
    assert.equal(isOneOffIncome(state.income[1]), true);
    var split = personOneOffSplit("Alex");
    var total = computePersonTax("Alex").netTakeHome;
    assert.equal(split.oneOffs.length, 1);
    assert.ok(split.oneOffs[0].net > 0 && split.oneOffs[0].net < 12000, "taxed, at the top rate");
    assert.ok(Math.abs(split.regularNet + split.oneOffs[0].net - total) < 0.01);
    var rows = scenarioIncomeRows({ scenario: state.activeScenario });
    var bonus = rows.find(function(r){ return r.oneOff; });
    assert.equal(bonus.freq, "Yearly");
    assert.equal(bonus.dueMonth, 9);
    var net = rows.find(function(r){ return r.syntheticNetFor === "Alex"; });
    assert.ok(Math.abs(net.amount * 12 - split.regularNet) < 1);
  });
});

test("the synthetic rows, the targets and the headline follow", function(){
  withIncome([SALARY, BONUS].map(function(r){ return Object.assign({}, r); }), function(){
    recalcComputedItems();
    var one = state.income.find(function(i){ return i.syntheticOneOffFor === "b1"; });
    assert.ok(one && one.irregular && one.freq === "Yearly" && one.computed);
    var keys = incomeTargets().map(function(t){ return t.key; });
    assert.ok(keys.indexOf("oneoff:b1") !== -1);
    var t = scenarioTotals(state.activeScenario);
    assert.ok(Math.abs(t.oneOffYearly - one.amount) < 0.01);
    assert.ok(Math.abs(t.regularNetMonthly - (t.netMonthly - one.amount / 12)) < 0.01);
    // Removing the bonus removes its row.
    state.income.splice(state.income.findIndex(function(i){ return i.id === "b1"; }), 1);
    recalcComputedItems();
    assert.equal(state.income.some(function(i){ return i.syntheticOneOffFor; }), false);
  });
});

test("income by month can be a function, so a bonus lands in its month", function(){
  var rows = monthlyCashFlow([], ["2026-08", "2026-09"], function(k){ return k === "2026-09" ? 5000 : 1000; });
  assert.deepEqual(rows.map(function(r){ return r.income; }), [1000, 5000]);
});
