import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { computePersonTax, rentalRefundFor, personTakeHomeParts, scenarioIncomeRows, REFUND_MONTH_DEFAULT } from "../src/calc/tax.js";
import { recalcComputedItems } from "../src/calc/engine.js";

// v3.145.0: a rental's tax loss comes back in the refund, not the payslip. An invented household.
var SALARY = { id: "s1", what: "Salary", person: "Alex", incomeType: "Gross", amount: 9000, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 };
function lossMaker(){
  return { id: "r1", what: "9 Sample Ave", kind: "IP", ownership: { Alex: 100 },
    income: [{ what: "Rent", amount: 400, freq: "Weekly" }],
    expenses: [{ what: "Council rates", amount: 900, freq: "Quarterly" }, { what: "Interest", amount: 2600, freq: "Monthly" }],
    loans: [], acquisitionCosts: [], pmFee: { percent: 0, flat: 0 } };
}
function withHousehold(extra, fn){
  var keys = ["income", "properties", "tax", "incomeLog"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.income = [Object.assign({}, SALARY)];
    state.properties = [lossMaker()];
    state.incomeLog = [];
    state.tax = Object.assign({}, state.tax, { settings: { Alex: { dateOfBirth: "1990-01-01" } } });
    if(extra) extra();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); recalcComputedItems(); }
}

test("the rental's tax saving comes out of the monthly take-home and lands as a refund; the year adds up", function(){
  withHousehold(null, function(){
    var tax = computePersonTax("Alex");
    assert.ok(tax.ipTaxEffect > 0, "a loss-making rental saves tax");
    var parts = personTakeHomeParts("Alex");
    assert.ok(parts.refund && Math.abs(parts.refund.amount - tax.ipTaxEffect) < 0.01);
    assert.equal(parts.refund.dueMonth, REFUND_MONTH_DEFAULT);
    assert.ok(Math.abs(parts.regularMonthly * 12 - tax.payslipTakeHome) < 1, "monthly is what a payslip pays");
    assert.ok(Math.abs(parts.regularMonthly * 12 + parts.refund.amount - tax.netTakeHome) < 1, "the year still adds up");
    recalcComputedItems();
    var net = state.income.find(function(i){ return i.syntheticNetFor === "Alex"; });
    var refund = state.income.find(function(i){ return i.syntheticRefundFor === "Alex"; });
    assert.equal(net.amount, parts.regularMonthly);
    assert.ok(refund && refund.freq === "Yearly" && refund.irregular && refund.computed && refund.incomeType === "Net");
    var rows = scenarioIncomeRows({ scenario: state.activeScenario });
    assert.equal(rows.filter(function(r){ return r.syntheticRefundFor === "Alex"; }).length, 1, "once per scenario, not twice");
  });
});

test("the refund lands in the month the last one was logged", function(){
  withHousehold(function(){ state.incomeLog = [{ id: "l1", target: "refund:Alex", date: "2025-08-14", amount: 2000 }]; }, function(){
    assert.equal(rentalRefundFor("Alex").dueMonth, 8);
  });
});

test("a PAYG withholding variation keeps it in the pay, and the refund row goes", function(){
  withHousehold(function(){ state.tax.settings.Alex.withholdingVariation = true; }, function(){
    assert.equal(rentalRefundFor("Alex"), null);
    recalcComputedItems();
    assert.equal(state.income.filter(function(i){ return i.syntheticRefundFor; }).length, 0);
    var tax = computePersonTax("Alex");
    assert.ok(Math.abs(personTakeHomeParts("Alex").regularMonthly * 12 - tax.netTakeHome) < 1);
  });
});

test("no rental, or one making a profit: nothing split", function(){
  withHousehold(function(){ state.properties = []; }, function(){ assert.equal(rentalRefundFor("Alex"), null); });
  withHousehold(function(){ state.properties[0].expenses = []; }, function(){ assert.equal(rentalRefundFor("Alex"), null); });
});

test("Tax → People offers the withholding-variation tick only to someone a rental's loss saves tax for", async function(){
  const { peopleHtml } = await import("../src/components/people.js");
  withHousehold(null, function(){ assert.match(peopleHtml("2026-10-29"), /class="pp-in pp-var" data-pp-person="Alex">/); });
  withHousehold(function(){ state.tax.settings.Alex.withholdingVariation = true; }, function(){ assert.match(peopleHtml("2026-10-29"), /pp-var" data-pp-person="Alex" checked>/); });
  withHousehold(function(){ state.properties = []; }, function(){ assert.doesNotMatch(peopleHtml("2026-10-29"), /pp-var/); });
});
