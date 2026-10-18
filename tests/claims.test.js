import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { propertyClaimLines, propertyClaimsAnnual, setClaimItemsProvider } from "../src/calc/claims.js";
import { deductionRows, setDeductibleItemsProvider } from "../src/calc/tax.js";
import { propertyTaxDeductibleResultAnnual, propertyCashResultAnnual } from "../src/calc/property.js";
import { rentalSchedule, rentLineFor } from "../src/calc/taxyear.js";

// A budget line claimed against an investment property (v3.45.0). Invented household: one rental,
// a landlord insurance policy paid from the family budget, and a tax agent fee split off to it.
var FY = { start: "2025-07-01", end: "2026-06-30" };
function setup(){
  var lines = [
    { what: "Landlord insurance", amount: 900, freq: "Yearly", deductible: true, claimProperty: "r1" },
    { what: "Tax agent (rental share)", amount: 180, freq: "Yearly", deductible: true, claimProperty: "r1", rentLine: "other" },
    { what: "Laptop", amount: 1200, freq: "Yearly", deductible: true, deductiblePerson: "Alex" },
    { what: "Gym", amount: 600, freq: "Yearly", deductible: false, claimProperty: "r1" }
  ];
  var prop = { id: "r1", what: "9 Sample Ave", kind: "IP", income: [{ what: "Rent", amount: 500, freq: "Weekly" }],
    expenses: [{ what: "Pest inspection", amount: 240, freq: "Yearly" }, { what: "Strata levy", amount: 1000, freq: "Quarterly", rentLine: "bodyCorporate" }],
    loans: [], ownership: { Alex: 50, Sam: 50 } };
  return { lines: lines, prop: prop };
}
function withSetup(fn){
  var keep = { properties: state.properties, income: state.income, taxYears: state.taxYears };
  var d = setup();
  try {
    state.properties = [d.prop]; state.taxYears = {};
    state.income = [{ person: "Alex", incomeType: "Gross", amount: 1, freq: "Yearly" }, { person: "Sam", incomeType: "Gross", amount: 1, freq: "Yearly" }];
    setDeductibleItemsProvider(function(){ return d.lines; });
    fn(d);
  } finally { setDeductibleItemsProvider(null); Object.assign(state, keep); }
}

test("only flagged lines claimed against the property count, for the year", function(){
  withSetup(function(d){
    assert.deepEqual(propertyClaimLines("r1").map(function(i){ return i.what; }), ["Landlord insurance", "Tax agent (rental share)"]);
    assert.equal(propertyClaimsAnnual("r1", FY), 1080);
    assert.equal(propertyClaimsAnnual("nope", FY), 0);
  });
});

test("a property claim is not also a personal deduction", function(){
  withSetup(function(d){
    assert.deepEqual(deductionRows(d.lines, "Alex").map(function(i){ return i.what; }), ["Laptop"]);
    assert.deepEqual(deductionRows(d.lines, "Sam"), []);
  });
});

test("it comes off the property's tax result but not its cash result", function(){
  withSetup(function(d){
    var rent = 500 * 52, own = 240 + 4000;
    assert.equal(Math.round(propertyCashResultAnnual(d.prop)), rent - own);
    assert.equal(Math.round(propertyTaxDeductibleResultAnnual(d.prop)), rent - own - 1080);
  });
});

test("the rental schedule puts each line where it was told, or guesses from the name", function(){
  withSetup(function(d){
    var sch = rentalSchedule(d.prop, 2025);
    var line = function(k){ return sch.lines.find(function(l){ return l.key === k; }).model; };
    assert.equal(line("pestControl"), 240, "guessed from the name");
    assert.equal(line("bodyCorporate"), 4000, "chosen on the row");
    assert.equal(line("insurance"), 900, "a budget line claimed here, guessed");
    assert.equal(line("other"), 180, "a budget line claimed here, chosen");
    assert.equal(rentLineFor({ what: "Water rates", rentLine: "nonsense" }), "water", "an unknown choice falls back to the guess");
    assert.equal(rentLineFor({ what: "Rent", rentLine: "rent" }), "other", "an income line can't be chosen for a cost");
  });
});

test("a claim that started partway through the year counts only from then", function(){
  withSetup(function(d){
    d.lines[0].deductibleFrom = "2026-01-01";
    assert.ok(Math.abs(propertyClaimsAnnual("r1", FY) - (900 * 181 / 365 + 180)) < 1e-6);
  });
});
