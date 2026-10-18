import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { simulateRetirementAt, earliestWorkableRetirementAge } from "../src/calc/fire.js";

// The plan's lever arithmetic rests on fire.js's simulation, given explicit inputs here.
var inp = { currentAge: 40, preservationAge: 60, split: { accessible: 200000, superValue: 300000 }, realReturn: 0.04, annualExpenses: 60000, annualSavings: 40000, superContributions: 20000 };

test("more saving, lower spending, more super and a better return each bring the age forward or leave it", function(){
  var base = earliestWorkableRetirementAge(inp);
  assert.ok(base != null && base > 40 && base < 75);
  var age = function(x){ return earliestWorkableRetirementAge(Object.assign({}, inp, x)); };
  assert.ok(age({ annualSavings: 46000 }) <= base);
  assert.ok(age({ annualExpenses: 54000 }) <= base);
  assert.ok(age({ superContributions: 28500 }) <= base);
  assert.ok(age({ realReturn: 0.05 }) <= base);
  var run = simulateRetirementAt(base, inp);
  assert.equal(run.passes, true);
  assert.equal(simulateRetirementAt(base - 1, inp).passes, false);
});
