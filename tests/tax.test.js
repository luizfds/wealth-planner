import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { incomeTaxAU, marginalRateAU, medicareLevyAU } from "../src/calc/tax.js";

// Expected figures pinned to the AU_TAX_BRACKETS table in src/constants.js — update alongside
// it if the brackets are re-indexed for a new financial year.

test("incomeTaxAU is $0 up to the tax-free threshold", function(){
  assert.equal(incomeTaxAU(0), 0);
  assert.equal(incomeTaxAU(18200), 0);
});

test("incomeTaxAU applies each bracket's base + marginal rate at its boundaries", function(){
  assert.ok(Math.abs(incomeTaxAU(45000) - 4288) < 1e-9);
  assert.ok(Math.abs(incomeTaxAU(135000) - 31288) < 1e-9);
  assert.ok(Math.abs(incomeTaxAU(190000) - 51638) < 1e-9);
  assert.ok(Math.abs(incomeTaxAU(200000) - 56138) < 1e-9);
});

test("incomeTaxAU treats negative/non-numeric input as $0 taxable income", function(){
  assert.equal(incomeTaxAU(-500), 0);
  assert.equal(incomeTaxAU("not a number"), 0);
});

test("marginalRateAU returns the rate for the bracket the income falls in", function(){
  assert.equal(marginalRateAU(10000), 0);
  assert.equal(marginalRateAU(30000), 0.16);
  assert.equal(marginalRateAU(100000), 0.30);
  assert.equal(marginalRateAU(160000), 0.37);
  assert.equal(marginalRateAU(300000), 0.45);
});

test("medicareLevyAU shades in between the low-income thresholds, then flat 2%", function(){
  assert.equal(medicareLevyAU(20000), 0);
  assert.ok(Math.abs(medicareLevyAU(30000) - 400) < 1e-9);
  assert.ok(Math.abs(medicareLevyAU(40000) - 800) < 1e-9);
});
