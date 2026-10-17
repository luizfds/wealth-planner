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
    { what: "Luiz salary", person: "Luiz", incomeType: "Gross", amount: 170000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" },
    { what: "Mariana salary", person: "Mariana", incomeType: "Gross", amount: 118000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" }
  ];
  state.tax = { sgRate: 12, settings: { Luiz: { wfhHours: { 2025: 1712 } }, Mariana: { wfhHours: { 2025: 707.2 } } },
    privateHospitalCover: true, familyThresholds: true, phiPremiums: 2594, phiTierClaimed: 1 };
  state.properties = [{ id: "henty", kind: "IP", what: "48 Henty Dr", income: [], expenses: [], loans: [], ownership: { Luiz: 70, Mariana: 30 } }];
  state.assets = [
    { category: "Shares", what: "IVV", person: "Luiz", quantity: 156, taxStatements: [
      { fy: 2025, u13: 0.04, c13: 0, q13: 0, h18: 52.48, discount18: 26.24, other18: 0, m20: 122.71, o20: 18.53, units: 156 }] },
    { category: "Shares", what: "IHD", person: "Luiz", quantity: 313, taxStatements: [
      { fy: 2025, u13: 27.38, c13: 246.11, q13: 76.54, h18: 0, discount18: 0, other18: 0, m20: 8.71, o20: 0.47, units: 313 }] },
    { category: "Shares", what: "DRO", person: "Luiz", quantity: 0, sales: [
      { date: "2025-10-07", units: 1315, proceeds: 8413.00, costBase: 1721.44, parcels: [
        { acquired: "2024-07-23", units: 780, costBase: 1142.30 }, { acquired: "2024-08-09", units: 493, costBase: 523.12 }, { acquired: "2024-09-04", units: 42, costBase: 56.02 }] },
      { date: "2025-11-19", units: 1315, proceeds: 2628.04, costBase: 1531.18, parcels: [
        { acquired: "2024-09-04", units: 758, costBase: 1010.98 }, { acquired: "2024-10-23", units: 22, costBase: 25.00 }, { acquired: "2024-10-30", units: 535, costBase: 495.20 }] }] },
    { category: "Shares", what: "IVV (Mariana)", person: "Mariana", quantity: 30, taxStatements: [
      { fy: 2025, h18: 10.76, discount18: 5.38, other18: 0, m20: 8.63, o20: 1.30, units: 30 }] },
    { category: "Shares", what: "WOW", person: "Mariana", quantity: 20, taxStatements: [
      { fy: 2025, c13: 17.10, q13: 7.33, units: 20 }] }
  ];
  state.taxYears = {};
  var luiz = personYear(2025, "Luiz", true);
  luiz.incomeStatements = [
    { payer: "Woolworths Group", gross: 130687, allowances: 66, withheld: 37034 },
    { payer: "E-Com (Aus)", gross: 42854, allowances: 0, withheld: 12060 }];
  luiz.interest = [{ account: "Macquarie joint", gross: 8.42, sharePct: 50 }, { account: "ATO interest", gross: 0.90, sharePct: 100 }];
  luiz.deductions = [
    { label: "D2", what: "Work travel", amount: 2388 }, { label: "D5", what: "Home office rent Jul-Sep", amount: 603.96 },
    { label: "D5", what: "Webcam", amount: 98 }, { label: "D5", what: "Depreciation", amount: 90.19 }, { label: "D10", what: "Tax agent", amount: 275 }];
  var mari = personYear(2025, "Mariana", true);
  mari.incomeStatements = [{ payer: "Macquarie Group", gross: 118861, allowances: 0, withheld: 28860 }];
  mari.interest = [{ account: "Macquarie savings", gross: 47.03 }, { account: "Macquarie joint", gross: 8.42, sharePct: 50 }, { account: "Macquarie", gross: 4.52 }, { account: "ATO interest", gross: 7.49 }];
  mari.deductions = [{ label: "D5", what: "Depreciation", amount: 231.44 }];
  var lines = { rent: 32250, otherIncome: 710.03, borrowing: 2663.71, councilRates: 2736, insurance: 1765.94,
    interest: 30508.53, pestControl: 420, agentFees: 2006.5, repairs: 485, capitalWorks: 3379, water: 1633.64, other: 299,
    advertising: 0, bodyCorporate: 0, cleaning: 0, capitalAllowances: 0, gardening: 0, landTax: 0, legal: 0, stationery: 0, travel: 0 };
  Object.keys(lines).forEach(function(k){ setRentalActual(2025, "henty", k, lines[k]); });
}

test("the rental schedule: actuals typed from the year's documents, net -$12,937.29", function(){
  withState(function(){
    realHousehold();
    var sch = rentalSchedule(state.properties[0], 2025);
    assert.equal(sch.income, 32960.03);
    assert.equal(sch.expenses, 45897.32);
    assert.equal(sch.net, -12937.29);
    assert.equal(sch.actualCount, 21);
  });
});

test("Luiz FY25/26: every label as lodged", function(){
  withState(function(){
    realHousehold();
    assert.deepEqual(incomeStatementTotals(2025, "Luiz"), { gross: 173607, withheld: 49094 });
    assert.equal(interestIncome(2025, "Luiz"), 5.11);
    var r = computePersonTax("Luiz", { fy: 2025 });
    assert.equal(Math.round(r.ipShareForYear * 100) / 100, -9056.1);                 // Rent, 70%
    assert.equal(Math.floor(r.capitalGainsTotal), 7840);                                // 18H
    assert.equal(Math.floor(r.capitalGains), 3920);                                     // 18A
    assert.equal(r.deductionsByLabel.D2, 2388);
    assert.equal(Math.round(r.deductionsByLabel.D5 * 100) / 100, 1990.55);              // incl. WFH $1,198.40
    assert.equal(r.deductionsByLabel.D10, 275);
    assert.equal(r.fito, 19);                                                           // 20O
    assert.equal(Math.round(r.phiAdjustment), 105);
    // Taxable income: every label summed under the law, franking credits grossed up. (myTax's
    // on-screen estimate showed $164,229 — $75 lower, about the size of the $76.54 IHD franking
    // credit; the assessment, not the estimate, is what counts.)
    assert.equal(Math.round(r.taxable), 164304);
    assert.ok(r.refund > 3600 && r.refund < 3700, "refund " + r.refund);
  });
});

test("Mariana FY25/26: rent 30% -$3,881.19, IVV gain $10.76 / $5.38", function(){
  withState(function(){
    realHousehold();
    var r = computePersonTax("Mariana", { fy: 2025 });
    assert.equal(Math.round(r.ipShareForYear * 100) / 100, -3881.19);
    assert.equal(r.capitalGainsTotal, 10.76);
    assert.equal(r.capitalGains, 5.38);
    assert.equal(r.interestIncome, Math.round((47.03 + 4.21 + 4.52 + 7.49) * 100) / 100);
    // $118,861 + $63.25 interest + $24.43 franked + $8.63 foreign + $5.38 - $3,881.19 - $726.48
    assert.equal(Math.round(r.taxable), 114355);
  });
});

test("a blank line falls back to the model, and expenses map to their labels by name", function(){
  withState(function(){
    realHousehold();
    state.properties[0].expenses = [{ what: "Water & Wastewater", amount: 100, freq: "Monthly" }, { what: "Council Rates", amount: 600, freq: "Quarterly" }, { what: "Land Tax", amount: 50, freq: "Monthly" }];
    setRentalActual(2025, "henty", "water", "");
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
    var r = computePersonTax("Luiz", { fy: 2025 });
    assert.equal(r.incomeStatements, null);
    assert.equal(r.refund, null);
    assert.equal(r.interestIncome, 0);
  });
});
