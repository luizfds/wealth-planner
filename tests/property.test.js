import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  bracketDuty, standardStampDuty, calcStampDuty, calcLMI, calcRepaymentMonthly,
  loanRepaymentMonthly, propertyLoanRepaymentMonthly, propertyOffsetTotal,
  propertyIlliquidEquityToday, propertyEquityToday, propertyGearingAnnual,
  propertyCapitalGain, propertyYieldOnCost, propertyLVR, propertiesTotalValue,
  propertiesTotalMortgageBalance, propertiesNetCashFlowMonthly, propertiesWeightedGrossYield,
  scenarioInflatableHomeItems, scenarioInflatableMonthly,
  propertyOwnershipPct, propertyOwnershipTotal, ipOwnershipMismatches, personIpResultAnnual
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

test("propertyLVR is gross loan balance over value, not netted against offset, and null with no value set", function(){
  assert.equal(propertyLVR(makeProperty({ value: 0 })), null);
  // offsetBalance:20000 in the fixture must NOT reduce this — LVR is priced off the actual owed
  // balance, same basis as the Usable-equity tile, unlike propertyEquityToday which does net it.
  var p = makeProperty({ value: 800000, loans: [{ balance: 500000, offsetBalance: 20000 }] });
  assert.ok(Math.abs(propertyLVR(p) - (500000 / 800000)) < 1e-9);
});

test("propertyLVR sums every loan's balance against the one property value", function(){
  var p = makeProperty({ value: 1000000, loans: [{ balance: 400000 }, { balance: 200000 }] });
  assert.ok(Math.abs(propertyLVR(p) - 0.6) < 1e-9);
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


// ---------------- Which housing rows inflate in the projection ----------------
// The homeLoanRow is the one row whose meaning flips with the scenario's purchase leg, and
// getting that wrong is silent and large — see the function's own comment for the real case.
function withScenario(name, homeRows, purchase, invest, body){
  var savedHome = state.home, savedPurchase = state.purchase, savedInvest = state.invest, savedShared = state.shared;
  state.home = {}; state.home[name] = homeRows;
  state.purchase = {}; state.purchase[name] = purchase;
  state.invest = {}; state.invest[name] = invest;
  state.shared = [];
  try { body(); }
  finally { state.home = savedHome; state.purchase = savedPurchase; state.invest = savedInvest; state.shared = savedShared; }
}
var RENT_ROW = { id: "homeLoanRow", what: "Rent / Home Loan", amount: 810, freq: "Weekly" };
var RATES_ROW = { id: "x1", what: "Council Rates", amount: 600, freq: "Quarterly" };

test("purchase leg off: the homeLoanRow is rent, and it counts", function(){
  // The bug this covers: nothing else in the model paid this row, so a renting scenario's largest
  // expense vanished from the projection entirely.
  withScenario("Renting", [RENT_ROW, RATES_ROW], { enabled: false }, { enabled: false }, function(){
    var items = scenarioInflatableHomeItems("Renting");
    assert.equal(items.length, 2);
    assert.ok(items.some(function(i){ return i.id === "homeLoanRow"; }), "rent must be in the inflatable set");
    assert.ok(Math.abs(scenarioInflatableMonthly("Renting") - (810 * 52 / 12 + 600 * 4 / 12)) < 1e-9);
  });
});

test("purchase leg on: the homeLoanRow is the mortgage, paid by the purchase calculator instead", function(){
  withScenario("Buy", [RENT_ROW, RATES_ROW], { enabled: true }, { enabled: false }, function(){
    var items = scenarioInflatableHomeItems("Buy");
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "x1");
    // Excluded here because computeNetWorthSeries() adds its own amortised repayment — counting
    // both would charge the same housing cost twice.
    assert.ok(Math.abs(scenarioInflatableMonthly("Buy") - 600 * 4 / 12) < 1e-9);
  });
});

test("invest leg beats the purchase leg, so the row counts again", function(){
  // Matches computeNetWorthSeries()'s own precedence: with the invest leg on there is no
  // purchase repayment, so nothing else is paying this row.
  withScenario("Invest", [RENT_ROW], { enabled: true }, { enabled: true }, function(){
    assert.equal(scenarioInflatableHomeItems("Invest").length, 1);
  });
});

test("scenarioInflatableHomeItems never hands back the live array", function(){
  // It's filtered in one branch and not the other — a caller mutating the result must not be
  // able to edit state.home through the unfiltered path.
  withScenario("Renting", [RENT_ROW], { enabled: false }, { enabled: false }, function(){
    var items = scenarioInflatableHomeItems("Renting");
    items.pop();
    assert.equal(state.home.Renting.length, 1);
  });
});

// ---------------- Depreciation (v2.86.0) ----------------

import {
  capitalWorksAnnual, plantDepreciationAnnual, propertyDepreciationAnnual,
  propertyTaxDeductibleResultAnnual, propertyCashResultAnnual, CAPITAL_WORKS_RATE,
  ipNetResultAnnual
} from "../src/calc/property.js";

test("capital works is 2.5% of CONSTRUCTION cost, not the purchase price", function(){
  // Land isn't depreciable. Conflating build cost with purchase price is the commonest way this
  // gets overstated, which is why they're separate fields rather than a percentage of the price.
  assert.equal(CAPITAL_WORKS_RATE, 0.025);
  assert.equal(capitalWorksAnnual({ constructionCost: 400000 }, "2026-09-11"), 10000);
  assert.equal(capitalWorksAnnual({ constructionCost: 0, purchasePrice: 900000 }, "2026-09-11"), 0,
    "no construction cost means no claim, whatever the property is worth");
});

test("the capital works clock stops after 40 years", function(){
  assert.equal(capitalWorksAnnual({ constructionCost: 400000, constructionDate: "2000-01-01" }, "2026-09-11"), 10000);
  assert.equal(capitalWorksAnnual({ constructionCost: 400000, constructionDate: "1980-01-01" }, "2026-09-11"), 0);
  // Right on the boundary.
  assert.equal(capitalWorksAnnual({ constructionCost: 400000, constructionDate: "1986-09-12" }, "2026-09-11"), 10000);
  assert.equal(capitalWorksAnnual({ constructionCost: 400000, constructionDate: "1986-09-10" }, "2026-09-11"), 0);
});

test("an unknown construction date claims the full year", function(){
  // A blank date on a property someone has bothered to enter a construction cost for almost always
  // means "haven't filled this in", not "it's 41 years old".
  assert.equal(capitalWorksAnnual({ constructionCost: 400000, constructionDate: "" }, "2026-09-11"), 10000);
});

test("plant is straight-line over its effective life, defaulting to 10 years", function(){
  assert.equal(plantDepreciationAnnual({ plantValue: 30000, plantEffectiveLife: 10 }), 3000);
  assert.equal(plantDepreciationAnnual({ plantValue: 30000, plantEffectiveLife: 5 }), 6000);
  assert.equal(plantDepreciationAnnual({ plantValue: 30000 }), 3000, "default life");
  assert.equal(plantDepreciationAnnual({ plantValue: 0 }), 0);
  // A zero or missing life would divide by zero; floored at 1.
  assert.equal(plantDepreciationAnnual({ plantValue: 30000, plantEffectiveLife: 0 }), 3000);
});

test("depreciation reduces the TAX result but never the cash result", function(){
  // The whole reason it matters: it's the difference between what a property costs you and what it
  // costs you after tax, and the reason one can be cash-flow negative and still worth holding.
  var property = {
    kind: "IP",
    income: [{ amount: 600, freq: "Weekly" }],
    expenses: [{ amount: 4000, freq: "Yearly" }],
    loans: [{ balance: 500000, rate: 6, offsetBalance: 0, termYears: 30, repaymentType: "PI", repaymentMode: "auto" }],
    constructionCost: 400000,
    plantValue: 30000,
    plantEffectiveLife: 10
  };
  var cash = propertyCashResultAnnual(property);
  var taxed = propertyTaxDeductibleResultAnnual(property);
  assert.equal(propertyDepreciationAnnual(property, "2026-09-11"), 13000);
  assert.ok(Math.abs((cash - taxed) - 13000) < 0.01, "the tax result is lower by exactly the depreciation");
  assert.ok(taxed < cash);
});

test("a property with no depreciation entered behaves exactly as before", function(){
  var property = {
    kind: "IP",
    income: [{ amount: 600, freq: "Weekly" }],
    expenses: [{ amount: 4000, freq: "Yearly" }],
    loans: [{ balance: 500000, rate: 6, offsetBalance: 0, termYears: 30, repaymentType: "PI", repaymentMode: "auto" }]
  };
  assert.equal(propertyDepreciationAnnual(property, "2026-09-11"), 0);
  assert.equal(propertyTaxDeductibleResultAnnual(property), propertyCashResultAnnual(property));
});

// ---------------- Per-property ownership ----------------
// The model this replaced was one percentage per person in state.tax.ipOwnership, multiplied by
// the whole portfolio's result. These tests pin the two things it structurally could not do.

function withProperties(props, body){
  var saved = state.properties;
  state.properties = props;
  try { body(); } finally { state.properties = saved; }
}
function ipWithResult(ownership, rentWeekly){
  return makeProperty({
    kind: "IP", what: "IP", ownership: ownership || {},
    income: [{ amount: rentWeekly == null ? 600 : rentWeekly, freq: "Weekly" }],
    loans: []
  });
}

test("an unset ownership map still means an even split, exactly as the old global default did", function(){
  var p = ipWithResult(null);
  assert.equal(propertyOwnershipPct(p, "Sam", ["Sam", "Alex"]), 50);
  assert.equal(propertyOwnershipPct(p, "Alex", ["Sam", "Alex"]), 50);
  assert.equal(propertyOwnershipTotal(p), null, "null, not 100 — 'not told' is not the same answer as 'told, and it adds up'");
});

test("a person absent from a set map owns none of that property", function(){
  // The case the single global percentage could not express: one spouse's property.
  var p = ipWithResult({ Sam: 100 });
  assert.equal(propertyOwnershipPct(p, "Sam", ["Sam", "Alex"]), 100);
  assert.equal(propertyOwnershipPct(p, "Alex", ["Sam", "Alex"]), 0);
});

test("two properties can be owned differently, and each person's share adds up across them", function(){
  var solo = ipWithResult({ Sam: 100 }, 600);
  var joint = ipWithResult({ Sam: 50, Alex: 50 }, 400);
  withProperties([solo, joint], function(){
    var people = ["Sam", "Alex"];
    var soloResult = propertyTaxDeductibleResultAnnual(solo);
    var jointResult = propertyTaxDeductibleResultAnnual(joint);
    assert.ok(Math.abs(personIpResultAnnual("Sam", people) - (soloResult + jointResult * 0.5)) < 1e-9);
    assert.ok(Math.abs(personIpResultAnnual("Alex", people) - (jointResult * 0.5)) < 1e-9);
    // And the two shares still reconstruct the portfolio total, which is the invariant the old
    // model broke the moment anyone touched a percentage.
    assert.ok(Math.abs(personIpResultAnnual("Sam", people) + personIpResultAnnual("Alex", people) - ipNetResultAnnual()) < 1e-9);
  });
});

test("shares that don't add to 100% are reported, not silently rescaled", function(){
  // The old model's worst failure: both people at 100% deducted the same loss twice with no
  // warning anywhere. The result here is still double-counted — that's the honest consequence of
  // what was entered — but ipOwnershipMismatches() names the property so the UI can say so.
  var p = ipWithResult({ Sam: 100, Alex: 100 });
  withProperties([p], function(){
    assert.equal(propertyOwnershipTotal(p), 200);
    assert.deepEqual(ipOwnershipMismatches(), [p]);
    var people = ["Sam", "Alex"];
    assert.ok(Math.abs(personIpResultAnnual("Sam", people) + personIpResultAnnual("Alex", people) - ipNetResultAnnual() * 2) < 1e-9);
  });
});

test("an even-split property is never flagged as a mismatch", function(){
  withProperties([ipWithResult(null)], function(){
    assert.deepEqual(ipOwnershipMismatches(), [], "'not told' is not the same as 'wrong'");
  });
});

test("a PPOR never reaches the ownership split — it has no taxable result to share", function(){
  var ppor = makeProperty({ kind: "PPOR", ownership: { Sam: 100, Alex: 100 } });
  withProperties([ppor], function(){
    assert.deepEqual(ipOwnershipMismatches(), []);
    assert.equal(personIpResultAnnual("Sam", ["Sam", "Alex"]), 0);
  });
});
