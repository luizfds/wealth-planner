import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { stampDutyFigures, lmiFigures, repaymentFigures, borrowingPower } from "../src/calc/calculators.js";
import { calcStampDuty } from "../src/calc/property.js";

test("stamp duty is the purchase calculator's, and a first home buyer's saving is the difference", function(){
  var f = stampDutyFigures("VIC", 600000, true);
  assert.equal(f.duty, Math.round(calcStampDuty("VIC", 600000, true) * 100) / 100);
  assert.equal(f.saving, Math.round((calcStampDuty("VIC", 600000, false) - calcStampDuty("VIC", 600000, true)) * 100) / 100);
});

test("LMI: none at 20% down; the deposit still needed to avoid it", function(){
  assert.equal(lmiFigures(800000, 20).lmi, 0);
  var f = lmiFigures(800000, 10);
  assert.equal(f.loan, 720000);
  assert.equal(f.lvr, 0.9);
  assert.ok(f.lmi > 0);
  assert.equal(f.depositFor80, 80000);
});

test("repayments: $600,000 over 30 years at 6% is $3,597.30 a month", function(){
  var f = repaymentFigures(600000, 6, 30, "PI");
  assert.equal(f.monthly, 3597.3);
  assert.ok(Math.abs(f.totalInterest - (3597.3 * 360 - 600000)) < 5, "about $695,028 of interest over the term");
  assert.equal(repaymentFigures(600000, 6, 30, "IO").monthly, 3000);
});

test("what a lender might lend: the loan whose repayments at the rate + 3 take exactly what's spare", function(){
  // $7,827.74 take-home less $3,000 living = $4,827.74 spare — the repayment on $600,000 at 9% over 30 years.
  var f = borrowingPower(7827.74, 3000, 0, 6, 30);
  assert.equal(f.assessedRate, 9);
  assert.equal(f.spare, 4827.74);
  assert.equal(f.maxLoan, 600000);
  assert.equal(borrowingPower(3000, 3500, 0, 6, 30).maxLoan, 0, "nothing spare, nothing lent");
});
