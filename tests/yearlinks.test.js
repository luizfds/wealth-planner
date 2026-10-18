import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { yearDeductions, budgetLineDeductions, usesBudgetLines, setUseBudgetLines, setLineExcluded, expectedGrossForYear, personYear } from "../src/calc/taxyear.js";
import { computePersonTax, setDeductibleItemsProvider, phiPremiumsAnnual, phiRebateRate } from "../src/calc/tax.js";

// v3.47.0, on invented figures: deductions merged line by line, a statement's expected gross from
// pay history, and private health premiums read from a budget line.
var lines = [
  { id: "l1", what: "Union fees", amount: 520, freq: "Yearly", deductible: true, deductiblePerson: "Alex", deductionLabel: "D5" },
  { id: "l2", what: "Car (work share)", amount: 300, freq: "Monthly", deductible: true, deductiblePerson: "Alex", deductiblePct: 25, deductionLabel: "D1" },
  { id: "l3", what: "Hospital cover", amount: 150, freq: "Monthly" }
];
function withState(fn){
  var keep = { income: state.income, taxYears: state.taxYears, properties: state.properties, assets: state.assets, tax: state.tax };
  try {
    state.income = [{ id: "p1", what: "Pay", person: "Alex", incomeType: "Gross", amount: 100000, freq: "Yearly", superMode: "On top" }];
    state.taxYears = {}; state.properties = []; state.assets = [];
    state.tax = Object.assign({}, state.tax, { settings: { Alex: {} }, phiPremiums: 0, phiLineId: "", phiTierClaimed: 0 });
    setDeductibleItemsProvider(function(){ return lines; });
    fn();
  } finally { setDeductibleItemsProvider(null); Object.assign(state, keep); }
}

test("no record: the model's budget lines; a record without typed claims: the same lines", function(){
  withState(function(){
    assert.equal(yearDeductions(2025, "Alex", []), null);
    var py = personYear(2025, "Alex", true);
    assert.equal(usesBudgetLines(py), true);
    var rows = lines.slice(0, 2);
    var d = yearDeductions(2025, "Alex", rows);
    assert.deepEqual(d.byLabel, { D5: 520, D1: 900 });
    assert.equal(computePersonTax("Alex", { fy: 2025 }).deductions, 1420);
  });
});

test("a year typed before v3.47.0 keeps meaning 'typed claims only'", function(){
  withState(function(){
    personYear(2025, "Alex", true).deductions = [{ label: "D10", what: "Tax agent", amount: 275 }];
    assert.equal(usesBudgetLines(personYear(2025, "Alex")), false);
    assert.deepEqual(yearDeductions(2025, "Alex", lines.slice(0, 2)).byLabel, { D10: 275 });
  });
});

test("opting in merges typed claims with the lines, and one line can be left out", function(){
  withState(function(){
    personYear(2025, "Alex", true).deductions = [{ label: "D5", what: "Webcam", amount: 80 }];
    setUseBudgetLines(2025, "Alex", true);
    setLineExcluded(2025, "Alex", "l2", true);
    var d = yearDeductions(2025, "Alex", lines.slice(0, 2));
    assert.deepEqual(d.byLabel, { D5: 600 });
    assert.equal(budgetLineDeductions(2025, "Alex", lines.slice(0, 2)).find(function(l){ return l.id === "l2"; }).excluded, true);
    setLineExcluded(2025, "Alex", "l2", false);
    assert.deepEqual(yearDeductions(2025, "Alex", lines.slice(0, 2)).byLabel, { D5: 600, D1: 900 });
  });
});

test("expected gross follows pay changes and start dates, and takes super out of an Included row", function(){
  var row = { amount: 104000, freq: "Yearly", history: [{ date: "2025-06-01", value: 91250 }, { date: "2026-01-01", value: 104000 }] };
  // Jul–Dec at 91,250 (184 days), Jan–Jun at 104,000 (181 days).
  var exp = 91250 * 184 / 365 + 104000 * 181 / 365;
  assert.ok(Math.abs(expectedGrossForYear(row, 2025, 12) - Math.round(exp * 100) / 100) < 0.01);
  assert.equal(expectedGrossForYear({ amount: 73000, freq: "Yearly", startDate: "2026-04-01" }, 2025, 12), Math.round(73000 * 91 / 365 * 100) / 100);
  assert.equal(expectedGrossForYear({ amount: 112000, freq: "Yearly", superMode: "Included" }, 2025, 12), 100000);
  assert.equal(expectedGrossForYear({ amount: 5000, freq: "Yearly", irregular: true }, 2025, 12), 5000);
  assert.equal(expectedGrossForYear({ amount: 50000, freq: "Yearly", endDate: "2025-06-30" }, 2025, 12), 0);
});

test("premiums from a budget line are grossed back up at the tier claimed", function(){
  withState(function(){
    state.tax.phiPremiums = 999;
    assert.equal(phiPremiumsAnnual(2025), 999, "typed when no line is chosen");
    state.tax.phiLineId = "l3";
    var rate = phiRebateRate(0, 2025, "u65");
    assert.equal(phiPremiumsAnnual(2025), Math.round(1800 / (1 - rate) * 100) / 100);
    state.tax.phiTierClaimed = -1;
    assert.equal(phiPremiumsAnnual(2025), 1800, "no rebate taken: what you pay is the premium");
    state.tax.phiLineId = "gone";
    assert.equal(phiPremiumsAnnual(2025), 999, "a deleted line falls back to the typed figure");
  });
});
