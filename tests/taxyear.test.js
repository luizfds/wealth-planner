import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { computePersonTax, personCapitalGains } from "../src/calc/tax.js";
import { taxYearRecord, personYear, rentalSchedule, rentLineForExpense, setRentalActual, incomeStatementTotals, interestIncome } from "../src/calc/taxyear.js";

// ---------------- A return, end to end (v3.26.0) ----------------
//
// Two people's FY25/26 returns rebuilt from the tax-year record: income statements, bank interest,
// two fund statements, a two-part share sale, a 60/40 investment property whose schedule is typed
// line by line, deductions by label, working from home, and a private health rebate. Every figure is
// invented. The engine was first checked against a lodged return label by label; the fixtures here
// are deliberately unrelated to it, and the taxable income is rebuilt by hand from its parts so the
// test doesn't just restate the engine.

function withState(fn){
  var keep = {};
  ["income", "properties", "assets", "taxYears", "tax", "shared", "home"].forEach(function(k){ keep[k] = state[k]; });
  try { fn(); } finally { Object.keys(keep).forEach(function(k){ state[k] = keep[k]; }); }
}
var RENT_LINES_EXAMPLE = { rent: 26520, otherIncome: 180, borrowing: 1958.93, councilRates: 1980, insurance: 1420.6,
  interest: 21840.25, pestControl: 260, agentFees: 1850.4, repairs: 610, capitalWorks: 2900, water: 1120.3, other: 145,
  advertising: 0, bodyCorporate: 0, cleaning: 0, capitalAllowances: 0, gardening: 0, landTax: 0, legal: 0, stationery: 0, travel: 0 };
var RENT_INCOME = 26520 + 180;
var RENT_EXPENSES = Math.round((1958.93 + 1980 + 1420.6 + 21840.25 + 260 + 1850.4 + 610 + 2900 + 1120.3 + 145) * 100) / 100;
var RENT_NET = Math.round((RENT_INCOME - RENT_EXPENSES) * 100) / 100;
function exampleHousehold(){
  state.shared = []; state.home = {};
  state.income = [
    { what: "Alex salary", person: "Alex", incomeType: "Gross", amount: 112000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" },
    { what: "Sam salary", person: "Sam", incomeType: "Gross", amount: 86000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" }
  ];
  state.tax = { sgRate: 12, settings: { Alex: { wfhHours: { 2025: 900 } }, Sam: { wfhHours: { 2025: 400 } } },
    privateHospitalCover: true, familyThresholds: true, phiPremiums: 3120, phiTierClaimed: 1 };
  state.properties = [{ id: "ip1", kind: "IP", what: "1 Example St", income: [], expenses: [], loans: [], ownership: { Alex: 60, Sam: 40 } }];
  state.assets = [
    { category: "Shares", what: "ETFA", person: "Alex", quantity: 210, taxStatements: [
      { fy: 2025, u13: 0.10, c13: 0, q13: 0, h18: 88.40, discount18: 44.20, other18: 0, m20: 205.30, o20: 30.80, units: 210 }] },
    { category: "Shares", what: "ABC", person: "Alex", quantity: 0, sales: [
      { date: "2025-09-12", units: 2000, proceeds: 6200.00, costBase: 3100.00, parcels: [
        { acquired: "2024-05-02", units: 1200, costBase: 1900.00 }, { acquired: "2024-06-20", units: 800, costBase: 1200.00 }] },
      { date: "2025-12-03", units: 1000, proceeds: 2950.00, costBase: 1450.00, parcels: [
        { acquired: "2024-06-20", units: 1000, costBase: 1450.00 }] }] },
    { category: "Shares", what: "ETFA (Sam)", person: "Sam", quantity: 60, taxStatements: [
      { fy: 2025, h18: 25.20, discount18: 12.60, other18: 0, m20: 40.10, o20: 6.00, units: 60 }] },
    { category: "Shares", what: "DIV", person: "Sam", quantity: 120, taxStatements: [
      { fy: 2025, c13: 30.40, q13: 13.03, units: 120 }] }
  ];
  state.taxYears = {};
  var alex = personYear(2025, "Alex", true);
  alex.incomeStatements = [
    { payer: "Employer A", gross: 98400, allowances: 120, withheld: 22900 },
    { payer: "Employer B", gross: 15600, allowances: 0, withheld: 3950 }];
  alex.interest = [{ account: "Joint savings", gross: 310, sharePct: 50 }, { account: "ATO interest", gross: 2.15, sharePct: 100 }];
  alex.deductions = [
    { label: "D2", what: "Work travel", amount: 640 }, { label: "D5", what: "Laptop bag", amount: 85 },
    { label: "D5", what: "Depreciation", amount: 210.40 }, { label: "D10", what: "Tax agent", amount: 190 }];
  var sam = personYear(2025, "Sam", true);
  sam.incomeStatements = [{ payer: "Employer C", gross: 86200, allowances: 0, withheld: 18700 }];
  sam.interest = [{ account: "Savings account", gross: 120.50 }, { account: "Joint savings", gross: 310, sharePct: 50 }, { account: "Bank account", gross: 15.80 }, { account: "ATO interest", gross: 0.60 }];
  sam.deductions = [{ label: "D5", what: "Depreciation", amount: 95 }];
  Object.keys(RENT_LINES_EXAMPLE).forEach(function(k){ setRentalActual(2025, "ip1", k, RENT_LINES_EXAMPLE[k]); });
}

test("the rental schedule: actuals typed line by line", function(){
  withState(function(){
    exampleHousehold();
    var sch = rentalSchedule(state.properties[0], 2025);
    assert.equal(sch.income, RENT_INCOME);
    assert.equal(sch.expenses, RENT_EXPENSES);
    assert.equal(sch.net, RENT_NET);
    assert.equal(sch.actualCount, 21);
  });
});

test("Alex FY25/26: every label, and taxable income rebuilt from its parts", function(){
  withState(function(){
    exampleHousehold();
    assert.deepEqual(incomeStatementTotals(2025, "Alex"), { gross: 114120, withheld: 26850, resc: 0, rfba: 0 });
    assert.equal(interestIncome(2025, "Alex"), 157.15);
    var r = computePersonTax("Alex", { fy: 2025 });
    var rent = Math.round(RENT_NET * 0.6 * 100) / 100;
    assert.equal(Math.round(r.ipShareForYear * 100) / 100, rent);                     // Rent, 60%
    assert.equal(Math.round(r.capitalGainsTotal * 100) / 100, 4688.4);                 // 18H: 3,100 + 1,500 + 88.40
    assert.equal(Math.round(r.capitalGains * 100) / 100, 2344.2);                      // 18A
    assert.equal(r.deductionsByLabel.D2, 640);
    assert.equal(Math.round(r.deductionsByLabel.D5 * 100) / 100, 925.4);               // incl. WFH 900h x 70c
    assert.equal(r.deductionsByLabel.D10, 190);
    assert.equal(r.fito, 30.8);                                                         // 20O
    var expected = 114120 + 157.15 + (0.10 + 205.30) + 2344.2 + rent - (640 + 925.4 + 190);
    assert.ok(Math.abs(r.taxable - expected) < 0.01, r.taxable + " vs " + expected);
    assert.ok(Number.isFinite(r.refund));
  });
});

test("Sam FY25/26: rent 40%, a fund gain and franked distributions", function(){
  withState(function(){
    exampleHousehold();
    var r = computePersonTax("Sam", { fy: 2025 });
    var rent = Math.round(RENT_NET * 0.4 * 100) / 100;
    assert.equal(Math.round(r.ipShareForYear * 100) / 100, rent);
    assert.equal(r.capitalGainsTotal, 25.2);
    assert.equal(r.capitalGains, 12.6);
    assert.equal(r.interestIncome, Math.round((120.50 + 155 + 15.80 + 0.60) * 100) / 100);
    // salary + interest + franked distribution and its credit + foreign income + net gain + rent - deductions
    var expected = 86200 + 291.9 + 30.40 + 13.03 + 40.10 + 12.6 + rent - (95 + 280);
    assert.ok(Math.abs(r.taxable - expected) < 0.01, r.taxable + " vs " + expected);
  });
});

test("a blank line falls back to the model, and expenses map to their labels by name", function(){
  withState(function(){
    exampleHousehold();
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
    exampleHousehold();
    state.taxYears = {};
    var r = computePersonTax("Alex", { fy: 2025 });
    assert.equal(r.incomeStatements, null);
    assert.equal(r.refund, null);
    assert.equal(r.interestIncome, 0);
  });
});

test("income tests add back RESC, fringe benefits and a net investment loss (v3.29.0)", function(){
  withState(function(){
    exampleHousehold();
    var alex = personYear(2025, "Alex", false);
    alex.incomeStatements[0].resc = 10000;
    alex.incomeStatements[0].rfba = 2000;
    state.tax.settings.Alex.helpBalance = 50000;
    var r = computePersonTax("Alex", { fy: 2025 });
    // taxable + RFBA + RESC + the rental loss (60% of it)
    var expected = r.taxable + 2000 + 10000 + Math.max(0, -Math.round(RENT_NET * 0.6 * 100) / 100);
    assert.ok(Math.abs(r.repaymentIncome - expected) < 0.01, "HELP income " + r.repaymentIncome);
    assert.ok(Math.abs(r.surchargeIncome - expected) < 0.01, "surcharge income " + r.surchargeIncome);
    // Not taxable income: the same taxable figure as without them.
    alex.incomeStatements[0].resc = 0; alex.incomeStatements[0].rfba = 0;
    assert.equal(Math.round(computePersonTax("Alex", { fy: 2025 }).taxable), Math.round(r.taxable));
  });
});
