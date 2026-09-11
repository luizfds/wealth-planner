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

// ---------------- Per-scenario income (v2.79.0) ----------------
//
// An income row can carry the same sparse scenarioOverrides map a shared expense can. The reason
// this needs its own tests rather than reusing resolveSharedAmount's: a Gross row's amount is an
// *input to the tax engine*, so an override has to move the marginal rate, the Medicare levy and
// the SG with it — not just subtract from a total at the end.

import { state } from "../src/state.js";
import {
  scenarioIncomeMonthly, scenarioIncomeRows, computePersonTax, effectiveIncomeItems
} from "../src/calc/tax.js";

function withIncome(rows, body){
  var savedIncome = state.income, savedTax = state.tax, savedProps = state.properties;
  state.income = rows;
  state.tax = { sgRate: 12, ipOwnership: {}, settings: {} };
  state.properties = [];
  try { body(); }
  finally { state.income = savedIncome; state.tax = savedTax; state.properties = savedProps; }
}
function grossRow(person, amount, overrides){
  return {
    what: person + " salary", person: person, incomeType: "Gross", amount: amount, freq: "Yearly",
    superMode: "On top", sacrificeMode: "none", scenarioOverrides: overrides
  };
}

test("a Gross row's override moves the tax, not just the total", function(){
  withIncome([grossRow("Sam", 180000, { "Part time": 90000 })], function(){
    var full = computePersonTax("Sam");
    var part = computePersonTax("Sam", { scenario: "Part time" });
    assert.equal(full.gross, 180000);
    assert.equal(part.gross, 90000);
    // Halving the salary must more than halve the tax — that's the whole point of running it
    // through the brackets rather than scaling the net figure.
    assert.ok(part.totalTax < full.totalTax / 2,
      "progressive brackets: " + part.totalTax + " should be well under half of " + full.totalTax);
    assert.ok(part.netTakeHome > full.netTakeHome / 2, "and net take-home more than halves");
  });
});

test("employer super follows the override too", function(){
  withIncome([grossRow("Sam", 180000, { "Part time": 90000 })], function(){
    var full = computePersonTax("Sam");
    var part = computePersonTax("Sam", { scenario: "Part time" });
    assert.ok(Math.abs(part.sg - full.sg / 2) < 1e-6, "SG is a flat rate, so it halves exactly");
  });
});

test("a scenario with no override for a row falls back to its plain amount", function(){
  withIncome([grossRow("Sam", 180000, { "Part time": 90000 })], function(){
    assert.equal(computePersonTax("Sam", { scenario: "Renting" }).gross, 180000);
    assert.equal(computePersonTax("Sam", {}).gross, 180000);
    assert.equal(computePersonTax("Sam").gross, 180000, "no opts at all behaves as before");
  });
});

test("scenarioIncomeMonthly combines typed net rows with recomputed take-home", function(){
  withIncome([
    grossRow("Sam", 120000),
    { what: "Dividends", incomeType: "Net", amount: 500, freq: "Monthly", scenarioOverrides: { Lean: 0 } }
  ], function(){
    var base = scenarioIncomeMonthly({ scenario: "Renting" });
    var lean = scenarioIncomeMonthly({ scenario: "Lean" });
    assert.ok(Math.abs((base - lean) - 500) < 1e-6, "only the dividend row differs");
    // Cent tolerance, not 1e-6: the synthetic row is rounded to cents, same as the stored one
    // recalcComputedItems() writes — deliberately, so the two never disagree by a fraction.
    assert.ok(Math.abs(base - (computePersonTax("Sam").netTakeHome / 12 + 500)) < 0.01);
  });
});

test("scenarioIncomeRows never hands back a live state object it has altered", function(){
  // These are the user's own rows; a caller summing them must not be able to edit their data.
  withIncome([{ what: "Dividends", incomeType: "Net", amount: 500, freq: "Monthly", scenarioOverrides: { Lean: 0 } }], function(){
    var rows = scenarioIncomeRows({ scenario: "Lean" });
    var dividends = rows.find(function(r){ return r.what === "Dividends"; });
    assert.equal(dividends.amount, 0);
    assert.notEqual(dividends, state.income[0], "must be a copy when an override applies");
    assert.equal(state.income[0].amount, 500, "the stored row is untouched");
  });
});

test("scenarioIncomeRows skips state.income's own synthetic rows and emits its own", function(){
  // Otherwise the baseline synthetic row (computed from plain amounts) would be counted alongside
  // the per-scenario one derived from the same gross salary — double-counting an entire income.
  withIncome([
    grossRow("Sam", 120000),
    { what: "Sam — net income", amount: 7000, freq: "Monthly", computed: true, syntheticNetFor: "Sam" }
  ], function(){
    var rows = scenarioIncomeRows({ scenario: "Renting" });
    var forSam = rows.filter(function(r){ return r.syntheticNetFor === "Sam"; });
    assert.equal(forSam.length, 1);
    assert.notEqual(forSam[0].amount, 7000, "recomputed, not the stale stored figure");
  });
});

test("a person who stops working keeps a row, at $0", function(){
  // Dropping the row entirely would make "took the year off" indistinguishable from "this person
  // isn't in the plan", which are different answers.
  withIncome([grossRow("Sam", 120000, { "Year off": 0 })], function(){
    var rows = scenarioIncomeRows({ scenario: "Year off" });
    var sam = rows.find(function(r){ return r.syntheticNetFor === "Sam"; });
    assert.ok(sam, "row still present");
    assert.equal(sam.amount, 0);
    assert.equal(scenarioIncomeMonthly({ scenario: "Year off" }), 0);
  });
});

test("includeRow reaches inside the tax chain, not just its output", function(){
  // The projection uses this to honour endDate. Filtering afterwards would leave a salary that
  // has ended still paying tax, so the remaining income would come out too low.
  withIncome([grossRow("Sam", 120000), grossRow("Alex", 60000)], function(){
    var both = scenarioIncomeMonthly({});
    var samOnly = scenarioIncomeMonthly({ includeRow: function(r){ return r.person !== "Alex"; } });
    assert.ok(samOnly < both);
    assert.ok(Math.abs(samOnly - computePersonTax("Sam").netTakeHome / 12) < 0.01,
      "Alex's row is gone from the tax computation entirely, not netted off afterwards");
  });
});

test("effectiveIncomeItems stays the baseline view", function(){
  // Deliberately unchanged: it's what the Income page's own list and total show, and that page
  // has no scenario selector.
  withIncome([grossRow("Sam", 120000, { Lean: 1 }), { what: "Dividends", incomeType: "Net", amount: 500, freq: "Monthly" }], function(){
    var items = effectiveIncomeItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].what, "Dividends");
  });
});
