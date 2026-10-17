import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { computePersonTax, personCapitalGains } from "../src/calc/tax.js";
import { taxYearRecord, personYear, rentalSchedule, rentLineForExpense, setRentalActual, incomeStatementTotals, interestIncome } from "../src/calc/taxyear.js";

// ---------------- A real return, end to end (v3.26.0) ----------------
//
// Two people's FY25/26 returns as lodged in October 2026, rebuilt from the tax-year record: income
// statements, bank interest, two ETF statements, a two-part share sale, a 70/30 investment property
// whose schedule was typed from the agent's summary and the loan statements, deductions by label,
// working from home, and a private health rebate clawback. Every expectation below is a figure
// that went into myTax.

function withState(fn){
  var keep = {};
  ["income", "properties", "assets", "taxYears", "tax", "shared", "home"].forEach(function(k){ keep[k] = state[k]; });
  try { fn(); } finally { Object.keys(keep).forEach(function(k){ state[k] = keep[k]; }); }
}
function realHousehold(){
  state.shared = []; state.home = {};
  state.income = [
    { what: "Alex salary", person: "Alex", incomeType: "Gross", amount: 170000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" },
    { what: "Sam salary", person: "Sam", incomeType: "Gross", amount: 118000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" }
  ];
  state.tax = { sgRate: 12, settings: { Alex: { wfhHours: { 2025: ***REMOVED*** } }, Sam: { wfhHours: { 2025: ***REMOVED*** } } },
    privateHospitalCover: true, familyThresholds: true, phiPremiums: 2594, phiTierClaimed: 1 };
  state.properties = [{ id: "ip1", kind: "IP", what: "1 Example St", income: [], expenses: [], loans: [], ownership: { Alex: 70, Sam: 30 } }];
  state.assets = [
    { category: "Shares", what: "IVV", person: "Alex", quantity: 156, taxStatements: [
      { fy: 2025, u13: 0.04, c13: 0, q13: 0, h18: ***REMOVED***, discount18: ***REMOVED***, other18: 0, m20: ***REMOVED***, o20: ***REMOVED***, units: 156 }] },
    { category: "Shares", what: "ETFB", person: "Alex", quantity: 313, taxStatements: [
      { fy: 2025, u13: ***REMOVED***, c13: ***REMOVED***, q13: ***REMOVED***, h18: 0, discount18: 0, other18: 0, m20: 8.71, o20: ***REMOVED***, units: 313 }] },
    { category: "Shares", what: "ABC", person: "Alex", quantity: 0, sales: [
      { date: "2025-01-01", units: ***REMOVED***, proceeds: ***REMOVED***, costBase: ***REMOVED***, parcels: [
        { acquired: "2024-01-01", units: 780, costBase: ***REMOVED*** }, { acquired: "2024-01-01", units: 493, costBase: ***REMOVED*** }, { acquired: "2024-01-01", units: 42, costBase: ***REMOVED*** }] },
      { date: "2025-01-01", units: ***REMOVED***, proceeds: ***REMOVED***, costBase: ***REMOVED***, parcels: [
        { acquired: "2024-01-01", units: 758, costBase: ***REMOVED*** }, { acquired: "2024-01-01", units: 22, costBase: ***REMOVED*** }, { acquired: "2024-01-01", units: 535, costBase: ***REMOVED*** }] }] },
    { category: "Shares", what: "IVV (Sam)", person: "Sam", quantity: 30, taxStatements: [
      { fy: 2025, h18: ***REMOVED***, discount18: ***REMOVED***, other18: 0, m20: ***REMOVED***, o20: ***REMOVED***, units: 30 }] },
    { category: "Shares", what: "WOW", person: "Sam", quantity: 20, taxStatements: [
      { fy: 2025, c13: ***REMOVED***, q13: ***REMOVED***, units: 20 }] }
  ];
  state.taxYears = {};
  var alex = personYear(2025, "Alex", true);
  alex.incomeStatements = [
    { payer: "Employer A", gross: ***REMOVED***, allowances: 66, withheld: ***REMOVED*** },
    { payer: "Employer B", gross: ***REMOVED***, allowances: 0, withheld: ***REMOVED*** }];
  alex.interest = [{ account: "Bank One joint", gross: ***REMOVED***, sharePct: 50 }, { account: "ATO interest", gross: 0.90, sharePct: 100 }];
  alex.deductions = [
    { label: "D2", what: "Work travel", amount: ***REMOVED*** }, { label: "D5", what: "Home office rent Jul-Sep", amount: ***REMOVED*** },
    { label: "D5", what: "Webcam", amount: 98 }, { label: "D5", what: "Depreciation", amount: ***REMOVED*** }, { label: "D10", what: "Tax agent", amount: 275 }];
  var sam = personYear(2025, "Sam", true);
  sam.incomeStatements = [{ payer: "Employer C", gross: ***REMOVED***, allowances: 0, withheld: ***REMOVED*** }];
  sam.interest = [{ account: "Bank One savings", gross: ***REMOVED*** }, { account: "Bank One joint", gross: ***REMOVED***, sharePct: 50 }, { account: "Bank One", gross: ***REMOVED*** }, { account: "ATO interest", gross: ***REMOVED*** }];
  sam.deductions = [{ label: "D5", what: "Depreciation", amount: ***REMOVED*** }];
  var lines = { rent: ***REMOVED***, otherIncome: ***REMOVED***, borrowing: ***REMOVED***, councilRates: ***REMOVED***, insurance: ***REMOVED***,
    interest: ***REMOVED***, pestControl: 420, agentFees: ***REMOVED***, repairs: 485, capitalWorks: ***REMOVED***, water: ***REMOVED***, other: 299,
    advertising: 0, bodyCorporate: 0, cleaning: 0, capitalAllowances: 0, gardening: 0, landTax: 0, legal: 0, stationery: 0, travel: 0 };
  Object.keys(lines).forEach(function(k){ setRentalActual(2025, "ip1", k, lines[k]); });
}

test("the rental schedule: actuals typed from the year's documents, net -$***REMOVED***", function(){
  withState(function(){
    realHousehold();
    var sch = rentalSchedule(state.properties[0], 2025);
    assert.equal(sch.income, ***REMOVED***);
    assert.equal(sch.expenses, ***REMOVED***);
    assert.equal(sch.net, -***REMOVED***);
    assert.equal(sch.actualCount, 21);
  });
});

test("Alex FY25/26: every label as lodged", function(){
  withState(function(){
    realHousehold();
    assert.deepEqual(incomeStatementTotals(2025, "Alex"), { gross: ***REMOVED***, withheld: ***REMOVED*** });
    assert.equal(interestIncome(2025, "Alex"), ***REMOVED***);
    var r = computePersonTax("Alex", { fy: 2025 });
    assert.equal(Math.round(r.ipShareForYear * 100) / 100, -***REMOVED***);                 // Rent, 70%
    assert.equal(Math.floor(r.capitalGainsTotal), ***REMOVED***);                                // 18H
    assert.equal(Math.floor(r.capitalGains), ***REMOVED***);                                     // 18A
    assert.equal(r.deductionsByLabel.D2, ***REMOVED***);
    assert.equal(Math.round(r.deductionsByLabel.D5 * 100) / 100, ***REMOVED***);              // incl. WFH $***REMOVED***
    assert.equal(r.deductionsByLabel.D10, 275);
    assert.equal(r.fito, 19);                                                           // 20O
    assert.equal(Math.round(r.phiAdjustment), 105);
    // Taxable income: every label summed under the law, franking credits grossed up. (myTax's
    // on-screen estimate showed $***REMOVED*** — $*** lower, about the size of the $***REMOVED*** ETFB franking
    // credit; the assessment, not the estimate, is what counts.)
    assert.equal(Math.round(r.taxable), ***REMOVED***);
    assert.ok(r.refund > 3600 && r.refund < ***REMOVED***, "refund " + r.refund);
  });
});

test("Sam FY25/26: rent 30% -$***REMOVED***, IVV gain $***REMOVED*** / $***REMOVED***", function(){
  withState(function(){
    realHousehold();
    var r = computePersonTax("Sam", { fy: 2025 });
    assert.equal(Math.round(r.ipShareForYear * 100) / 100, -***REMOVED***);
    assert.equal(r.capitalGainsTotal, ***REMOVED***);
    assert.equal(r.capitalGains, ***REMOVED***);
    assert.equal(r.interestIncome, Math.round((***REMOVED*** + ***REMOVED*** + ***REMOVED*** + ***REMOVED***) * 100) / 100);
    // $***REMOVED*** + $***REMOVED*** interest + $***REMOVED*** franked + $***REMOVED*** foreign + $***REMOVED*** - $***REMOVED*** - $***REMOVED***
    assert.equal(Math.round(r.taxable), ***REMOVED***);
  });
});

test("a blank line falls back to the model, and expenses map to their labels by name", function(){
  withState(function(){
    realHousehold();
    state.properties[0].expenses = [{ what: "Water & Wastewater", amount: 100, freq: "Monthly" }, { what: "Council Rates", amount: 600, freq: "Quarterly" }, { what: "Land Tax", amount: 50, freq: "Monthly" }];
    setRentalActual(2025, "ip1", "water", "");
    var sch = rentalSchedule(state.properties[0], 2025);
    var water = sch.lines.find(function(l){ return l.key === "water"; });
    assert.equal(water.actual, null);
    assert.ok(Math.abs(water.value - 1200) < 0.01);
  });
  assert.equal(rentLineForExpense("Water rates"), "water");
  assert.equal(rentLineForExpense("Council Rates"), "councilRates");
  assert.equal(rentLineForExpense("Land Tax"), "landTax");
  assert.equal(rentLineForExpense("Property Manager fee"), "agentFees");
  assert.equal(rentLineForExpense("Something else"), "other");
});

test("without a record, a named year is the model", function(){
  withState(function(){
    realHousehold();
    state.taxYears = {};
    var r = computePersonTax("Alex", { fy: 2025 });
    assert.equal(r.incomeStatements, null);
    assert.equal(r.refund, null);
    assert.equal(r.interestIncome, 0);
  });
});
