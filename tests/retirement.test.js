import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { fireSettings, simulateRetirementAt, earliestWorkableRetirementAge } from "../src/calc/fire.js";
import { scenarioPlanningAge, setPlanningAge } from "../src/calc/people.js";
import { state } from "../src/state.js";

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

test("Retirement uses the selected person's birth date or their own saved age", function(){
  const keep = { income: state.income, tax: state.tax, fire: state.fire };
  try {
    state.income = [{ incomeType: "Gross", person: "Alex" }, { incomeType: "Gross", person: "Sam" }];
    state.tax = { settings: { Alex: { dateOfBirth: "1987-11-26" } } };
    state.fire = { person: "Alex", planningAges: { Alex: 41 }, scenarioAgePerson: "Alex" };
    assert.equal(fireSettings("2026-11-25").currentAge, 38);
    assert.equal(fireSettings("2026-11-26").currentAge, 39);
    state.fire.person = "Sam";
    assert.equal(fireSettings("2026-11-26").currentAge, null);
    assert.equal(scenarioPlanningAge(state), 41);
    setPlanningAge(state, "Sam", 43);
    assert.equal(fireSettings("2026-11-26").currentAge, 43);
    assert.equal(scenarioPlanningAge(state), 43);
    setPlanningAge(state, "Sam", null);
    assert.equal(fireSettings("2026-11-26").currentAge, null);
    state.fire.person = "Alex";
    delete state.tax.settings.Alex.dateOfBirth;
    assert.equal(fireSettings("2026-11-26").currentAge, 41);
  } finally { Object.assign(state, keep); }
});
