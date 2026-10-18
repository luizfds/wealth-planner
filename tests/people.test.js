import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { personReferences, renamePersonEverywhere, removePersonFromTax, ageOn } from "../src/calc/people.js";
import { getTaxPeople } from "../src/calc/tax.js";

// People (v3.44.0). An invented two-person household where one name is on every kind of row that
// can carry it, so a rename that misses any of them shows up as a stray "Alex".
function household(){
  return {
    income: [
      { what: "Pay", person: "Alex", incomeType: "Gross", amount: 90000, freq: "Yearly" },
      { what: "Pay", person: "Sam", incomeType: "Gross", amount: 70000, freq: "Yearly" },
      { what: "Freelance", person: "Alex", incomeType: "Gross", amount: 5000, freq: "Yearly" }
    ],
    assets: [{ what: "ETF", category: "Shares", person: "Alex" }, { what: "Cash", category: "Cash", person: "Sam" }],
    shared: [{ what: "Laptop", deductible: true, deductiblePerson: "Alex" }, { what: "Union fees", deductible: false, deductiblePerson: "Alex" }],
    home: { Base: [{ what: "Rent", deductible: true, deductiblePerson: "Alex", deductiblePct: 5 }] },
    properties: [{ id: "p1", what: "1 Example St", kind: "IP", ownership: { Alex: 60, Sam: 40 }, expenses: [{ what: "Rates", deductiblePerson: "Alex" }], income: [] }],
    tax: { settings: { Alex: { dateOfBirth: "1988-03-14", helpBalance: 4000 }, Sam: {} } },
    taxYears: { 2024: { people: { Alex: { incomeStatements: [] } }, lodged: { Alex: { taxable: 1 } } }, 2025: { people: { Sam: {} }, lodged: {} } }
  };
}
function withState(fn){
  var keys = ["income", "assets", "shared", "home", "properties", "tax", "taxYears"];
  var keep = {};
  keys.forEach(function(k){ keep[k] = state[k]; });
  try { Object.assign(state, household()); fn(); } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("personReferences counts every place a name is used", function(){
  withState(function(){
    var r = personReferences("Alex");
    assert.equal(r.incomeRows, 2);
    assert.equal(r.assets, 1);
    assert.deepEqual(r.properties, [{ id: "p1", what: "1 Example St", pct: 60 }]);
    assert.equal(r.deductibleLines, 2, "the flagged laptop and rent, not the unflagged union fees");
    assert.deepEqual(r.taxYears, [2024]);
  });
});

test("renaming walks income, holdings, budget lines, ownership, settings and tax years", function(){
  withState(function(){
    var res = renamePersonEverywhere("Alex", "  Jordan ");
    assert.equal(res.error, undefined);
    assert.ok(res.changed >= 10);
    var all = JSON.stringify({ i: state.income, a: state.assets, s: state.shared, h: state.home, p: state.properties, t: state.tax, y: state.taxYears });
    assert.doesNotMatch(all, /Alex/);
    assert.deepEqual(getTaxPeople(), ["Jordan", "Sam"]);
    assert.equal(state.properties[0].ownership.Jordan, 60);
    assert.equal(state.tax.settings.Jordan.helpBalance, 4000);
    assert.ok(state.taxYears[2024].people.Jordan && state.taxYears[2024].lodged.Jordan);
    assert.equal(state.shared[1].deductiblePerson, "Jordan", "an unflagged line keeps its person too");
  });
});

test("a rename to a blank or an existing name is refused and changes nothing", function(){
  withState(function(){
    assert.match(renamePersonEverywhere("Alex", "Sam").error, /already exists/);
    assert.match(renamePersonEverywhere("Alex", "   ").error, /needs a name/);
    assert.equal(state.income[0].person, "Alex");
    assert.deepEqual(renamePersonEverywhere("Alex", "Alex"), { changed: 0 });
  });
});

test("removing someone from tax turns their rows to Net and drops settings and shares only", function(){
  withState(function(){
    removePersonFromTax("Alex");
    assert.deepEqual(getTaxPeople(), ["Sam"]);
    assert.equal(state.income[0].incomeType, "Net");
    assert.equal(state.tax.settings.Alex, undefined);
    assert.deepEqual(state.properties[0].ownership, { Sam: 40 });
    assert.equal(state.assets[0].person, "Alex", "what happened stays recorded");
    assert.ok(state.taxYears[2024].lodged.Alex);
  });
});

test("ageOn counts whole years, turning on the birthday", function(){
  assert.equal(ageOn("1988-03-14", "2026-03-13"), 37);
  assert.equal(ageOn("1988-03-14", "2026-03-14"), 38);
  assert.equal(ageOn("", "2026-03-14"), null);
  assert.equal(ageOn("2030-01-01", "2026-03-14"), null);
});
