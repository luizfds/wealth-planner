import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { bracketDuty, standardStampDuty, calcStampDuty, calcLMI, calcRepaymentMonthly } from "../src/calc/property.js";
import { STAMP_DUTY_BRACKETS, FHB_RULES } from "../src/constants.js";

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
