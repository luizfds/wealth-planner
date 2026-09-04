import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  bracketDuty, standardStampDuty, calcStampDuty, calcLMI, calcRepaymentMonthly,
  loanRepaymentMonthly, propertyLoanRepaymentMonthly, propertyOffsetTotal,
  propertyIlliquidEquityToday, propertyEquityToday, propertyGearingAnnual,
  propertyCapitalGain, propertyYieldOnCost, propertiesTotalValue,
  propertiesTotalMortgageBalance, propertiesNetCashFlowMonthly, propertiesWeightedGrossYield
} from "../src/calc/property.js";
import { STAMP_DUTY_BRACKETS, FHB_RULES } from "../src/constants.js";
import { state } from "../src/state.js";

// Minimal fixture shared by the property-level tests below — just enough shape for each function
// under test (income/expenses/loans as plain {amount, freq} ledger items, same as the real app).
function makeProperty(overrides){
  var p = {
    value: 800000,
    purchasePrice: null,
    acquisitionCosts: [],
    income: [{ amount: 600, freq: "Weekly" }],
    expenses: [{ amount: 3000, freq: "Yearly" }],
    loans: [{ balance: 500000, rate: 6, termYears: 30, repaymentType: "PI", repaymentMode: "auto", offsetBalance: 20000 }]
  };
  return Object.assign(p, overrides);
}

test("bracketDuty is $0 at price $0, not a negative top-bracket extrapolation", function(){
  // Regression test: every bracket table's first row starts at from:0, so the original
  // "price > b.from" loop never matched at price===0 and fell through to the highest bracket's
  // formula, producing a large negative number instead of $0.
  assert.equal(bracketDuty(STAMP_DUTY_BRACKETS.NSW, 0), 0);
  assert.equal(bracketDuty(STAMP_DUTY_BRACKETS.VIC, 0), 0);
  assert.equal(standardStampDuty("NSW", 0), 0);
  assert.equal(standardStampDuty("VIC", 0), 0);
});

test("standardStampDuty NSW matches the bracket table at known price points", function(){
  assert.ok(Math.abs(standardStampDuty("NSW", 17000) - 212.5) < 1e-9);
  assert.ok(Math.abs(standardStampDuty("NSW", 500000) - 17029) < 1e-9);
  assert.ok(Math.abs(standardStampDuty("NSW", 700000) - 26029) < 1e-9);
});

test("standardStampDuty VIC switches to the flat-rate formulas above $960k", function(){
  assert.ok(Math.abs(standardStampDuty("VIC", 1500000) - 1500000 * 0.055) < 1e-9);
  assert.ok(Math.abs(standardStampDuty("VIC", 2500000) - (110000 + 500000 * 0.065)) < 1e-9);
});

test("standardStampDuty returns null for an unmodelled state (caller lets the user enter it manually)", function(){
  assert.equal(standardStampDuty("Other", 500000), null);
});

test("calcStampDuty applies the NSW first-home-buyer exemption/taper", function(){
  var rule = FHB_RULES.NSW;
  assert.equal(calcStampDuty("NSW", rule.exemptUpTo, true), 0);
  var standardAtConcessionCap = standardStampDuty("NSW", rule.concessionUpTo);
  assert.ok(Math.abs(calcStampDuty("NSW", rule.concessionUpTo, true) - standardAtConcessionCap) < 1e-9);
  // Halfway through the taper band should be roughly half the standard duty.
  var mid = (rule.exemptUpTo + rule.concessionUpTo) / 2;
  var standardAtMid = standardStampDuty("NSW", mid);
  assert.ok(Math.abs(calcStampDuty("NSW", mid, true) - standardAtMid / 2) < 1);
});

test("calcLMI is $0 at or under 80% LVR, and scales up with the loan amount above it", function(){
  assert.equal(calcLMI(400000, 0.8), 0);
  assert.equal(calcLMI(400000, 0.75), 0);
  var lmi85 = calcLMI(400000, 0.85);
  var lmi90 = calcLMI(400000, 0.90);
  assert.ok(lmi85 > 0);
  assert.ok(lmi90 > lmi85, "LMI should increase as LVR climbs into a higher band");
});

test("calcRepaymentMonthly at 0% interest is a straight-line division of principal by term", function(){
  assert.equal(calcRepaymentMonthly(360000, 0, 30, "PI"), 1000);
});

test("calcRepaymentMonthly interest-only is exactly one month's simple interest", function(){
  assert.equal(calcRepaymentMonthly(500000, 6, 30, "IO"), 500000 * 0.06 / 12);
});

test("calcRepaymentMonthly P&I matches the standard amortization formula", function(){
  var principal = 500000, annualRatePct = 6, termYears = 30;
  var r = annualRatePct / 100 / 12;
  var n = termYears * 12;
  var expected = principal * r / (1 - Math.pow(1 + r, -n));
  assert.ok(Math.abs(calcRepaymentMonthly(principal, annualRatePct, termYears, "PI") - expected) < 1e-6);
});

test("calcRepaymentMonthly P&I increases monotonically with the interest rate", function(){
  var low = calcRepaymentMonthly(500000, 4, 30, "PI");
  var high = calcRepaymentMonthly(500000, 8, 30, "PI");
  assert.ok(high > low);
});

test("loanRepaymentMonthly in manual mode ignores balance/rate and just converts the entered amount", function(){
  var loan = { repaymentMode: "manual", manualRepaymentAmount: 1000, manualRepaymentFreq: "Monthly", balance: 999999, rate: 99 };
  assert.equal(loanRepaymentMonthly(loan), 1000);
});

test("loanRepaymentMonthly interest-only nets the offset balance off the interest-charged balance", function(){
  var loan = { repaymentType: "IO", repaymentMode: "auto", balance: 500000, rate: 6, offsetBalance: 100000 };
  // (500000 - 100000) * 6% / 12
  assert.ok(Math.abs(loanRepaymentMonthly(loan) - 400000 * 0.06 / 12) < 1e-9);
});

test("loanRepaymentMonthly P&I is unaffected by offset — the bank's fixed repayment doesn't change, only how much of it is interest vs. principal", function(){
  var withoutOffset = loanRepaymentMonthly({ repaymentType: "PI", repaymentMode: "auto", balance: 500000, rate: 6, termYears: 30, offsetBalance: 0 });
  var withOffset = loanRepaymentMonthly({ repaymentType: "PI", repaymentMode: "auto", balance: 500000, rate: 6, termYears: 30, offsetBalance: 100000 });
  assert.equal(withoutOffset, withOffset);
});

test("propertyLoanRepaymentMonthly sums every loan on the property", function(){
  var p = makeProperty({ loans: [
    { repaymentMode: "manual", manualRepaymentAmount: 500, manualRepaymentFreq: "Monthly" },
    { repaymentMode: "manual", manualRepaymentAmount: 700, manualRepaymentFreq: "Monthly" }
  ]});
  assert.equal(propertyLoanRepaymentMonthly(p), 1200);
});

test("propertyOffsetTotal/propertyIlliquidEquityToday/propertyEquityToday split liquid vs. illiquid equity correctly", function(){
  var p = makeProperty();
  assert.equal(propertyOffsetTotal(p), 20000);
  assert.equal(propertyIlliquidEquityToday(p), 800000 - 500000); // value minus FULL balance, offset not netted here
  assert.equal(propertyEquityToday(p), (800000 - 500000) + 20000); // illiquid + offset
});

test("propertyGearingAnnual is annual rent minus annual expenses minus annual loan repayments", function(){
  var p = makeProperty({
    income: [{ amount: 600, freq: "Weekly" }],   // $31,200/yr
    expenses: [{ amount: 3000, freq: "Yearly" }], // $3,000/yr
    loans: [{ repaymentMode: "manual", manualRepaymentAmount: 2000, manualRepaymentFreq: "Monthly" }] // $24,000/yr
  });
  assert.ok(Math.abs(propertyGearingAnnual(p) - (31200 - 3000 - 24000)) < 1e-9);
});

test("propertyCapitalGain is null (not $0 or a misleading 100%) when no purchase price is set", function(){
  assert.equal(propertyCapitalGain(makeProperty({ purchasePrice: null })), null);
  assert.equal(propertyCapitalGain(makeProperty({ purchasePrice: 0 })), null);
});

test("propertyCapitalGain is current value minus purchase price + every itemized acquisition cost, as both $ and %", function(){
  var costs = [{ id: "ac1", what: "Stamp duty", amount: 20000 }, { id: "ac2", what: "Legal", amount: 5000 }];
  var gain = propertyCapitalGain(makeProperty({ value: 800000, purchasePrice: 500000, acquisitionCosts: costs }));
  assert.ok(gain);
  assert.equal(gain.gain, 800000 - 525000);
  assert.ok(Math.abs(gain.pct - (275000 / 525000)) < 1e-9);
});

test("propertyCapitalGain can be negative when the property has lost value", function(){
  var gain = propertyCapitalGain(makeProperty({ value: 400000, purchasePrice: 500000, acquisitionCosts: [] }));
  assert.equal(gain.gain, -100000);
  assert.ok(gain.pct < 0);
});

test("propertyYieldOnCost is null with no purchase price, and annual rent / (price + acquisition costs) once set", function(){
  assert.equal(propertyYieldOnCost(makeProperty({ purchasePrice: null })), null);
  var costs = [{ id: "ac1", what: "Stamp duty", amount: 25000 }];
  var p = makeProperty({ income: [{ amount: 600, freq: "Weekly" }], purchasePrice: 500000, acquisitionCosts: costs });
  assert.ok(Math.abs(propertyYieldOnCost(p) - (31200 / 525000)) < 1e-9);
});

// ---- Portfolio-wide aggregates (Properties page's overview panel) — these read state.properties
// directly rather than taking a property argument, so each test sets it up and restores it after.
test("propertiesTotalValue and propertiesTotalMortgageBalance sum across every property, IP and PPOR alike", function(){
  var prev = state.properties;
  state.properties = [
    makeProperty({ kind: "IP", value: 800000, loans: [{ balance: 500000 }] }),
    makeProperty({ kind: "PPOR", value: 900000, loans: [{ balance: 300000 }, { balance: 100000 }] })
  ];
  assert.equal(propertiesTotalValue(), 1700000);
  assert.equal(propertiesTotalMortgageBalance(), 900000);
  state.properties = prev;
});

test("propertiesNetCashFlowMonthly only counts IPs (a PPOR has no rent to be cash flow)", function(){
  var prev = state.properties;
  state.properties = [
    makeProperty({ kind: "IP", income: [{ amount: 600, freq: "Weekly" }], expenses: [{ amount: 3000, freq: "Yearly" }], loans: [] }),
    makeProperty({ kind: "PPOR", income: [{ amount: 10000, freq: "Weekly" }], expenses: [], loans: [] })
  ];
  assert.ok(Math.abs(propertiesNetCashFlowMonthly() - ((31200 - 3000) / 12)) < 1e-9);
  state.properties = prev;
});

test("propertiesWeightedGrossYield is null with no IPs, and value-weighted (not a simple average) across several", function(){
  var prev = state.properties;
  state.properties = [makeProperty({ kind: "PPOR", income: [], value: 900000 })];
  assert.equal(propertiesWeightedGrossYield(), null);
  // Property A: $1,000/wk ($52,000/yr) on $500k = 10.4% yield. Property B: $200/wk ($10,400/yr)
  // on $1,000,000 = 1.04% yield. A simple average would be ~5.7%; weighted by value it should sit
  // much closer to B's low yield, since B's value dominates the pool.
  state.properties = [
    makeProperty({ kind: "IP", value: 500000, income: [{ amount: 1000, freq: "Weekly" }] }),
    makeProperty({ kind: "IP", value: 1000000, income: [{ amount: 200, freq: "Weekly" }] })
  ];
  var expected = (52000 + 10400) / 1500000;
  assert.ok(Math.abs(propertiesWeightedGrossYield() - expected) < 1e-9);
  assert.ok(propertiesWeightedGrossYield() < 0.057);
  state.properties = prev;
});
