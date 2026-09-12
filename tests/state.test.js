import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, migrateState } from "../src/state.js";
import { DEFAULT_CATEGORIES } from "../src/constants.js";

test("defaultState seeds a single 'Current situation' scenario marked as the baseline", function(){
  var s = defaultState();
  assert.deepEqual(s.scenarios, ["Current situation"]);
  assert.equal(s.baselineScenario, "Current situation");
  assert.equal(s.activeScenario, "Current situation");
  assert.ok(s.home["Current situation"]);
  assert.ok(s.purchase["Current situation"]);
});

test("migrateState designates the active scenario as baseline when the field is missing", function(){
  var legacy = {
    activeScenario: "Buy Brisbane",
    scenarios: ["Renting", "Buy Brisbane", "Buy Perth"],
    home: { "Renting": [], "Buy Brisbane": [], "Buy Perth": [] },
    purchase: {}
  };
  var s = migrateState(legacy);
  assert.equal(s.baselineScenario, "Buy Brisbane");
  // Pinned to index 0 so every renderer that just iterates state.scenarios shows it first,
  // with no separate sort-for-display logic needed anywhere.
  assert.deepEqual(s.scenarios, ["Buy Brisbane", "Renting", "Buy Perth"]);
  // Only the array order changed — the per-scenario dictionaries are untouched.
  assert.deepEqual(Object.keys(s.home).sort(), ["Buy Brisbane", "Buy Perth", "Renting"]);
});

test("migrateState is idempotent once a baseline is set", function(){
  var s = migrateState({
    activeScenario: "Renting",
    scenarios: ["Renting", "Buy Brisbane"],
    home: { "Renting": [], "Buy Brisbane": [] },
    purchase: {}
  });
  assert.equal(s.baselineScenario, "Renting");
  var before = s.scenarios.slice();
  var again = migrateState(s);
  assert.equal(again.baselineScenario, "Renting");
  assert.deepEqual(again.scenarios, before);
});

test("migrateState re-designates a baseline if the stored one no longer exists", function(){
  var s = migrateState({
    activeScenario: "Buy Perth",
    baselineScenario: "Some Deleted Scenario",
    scenarios: ["Buy Perth", "Buy Brisbane"],
    home: { "Buy Perth": [], "Buy Brisbane": [] },
    purchase: {}
  });
  assert.equal(s.baselineScenario, "Buy Perth");
  assert.equal(s.scenarios[0], "Buy Perth");
});

test("migrateState leaves the baseline's own name untouched", function(){
  var s = migrateState({
    activeScenario: "My custom scenario name",
    scenarios: ["My custom scenario name"],
    home: { "My custom scenario name": [] },
    purchase: {}
  });
  assert.equal(s.baselineScenario, "My custom scenario name");
  assert.deepEqual(s.scenarios, ["My custom scenario name"]);
});

test("migrateState converts a property's legacy lump-sum acquisitionCosts into one itemized row, not dropping the value", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [] },
    purchase: {},
    properties: [{ id: "p1", what: "1 Test St", acquisitionCosts: 27500 }]
  });
  assert.equal(s.properties[0].acquisitionCosts.length, 1);
  assert.equal(s.properties[0].acquisitionCosts[0].amount, 27500);
  assert.ok(s.properties[0].acquisitionCosts[0].id);
});

test("migrateState turns a legacy $0 acquisitionCosts into an empty array, not a zero-amount row", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [] },
    purchase: {},
    properties: [{ id: "p1", what: "1 Test St", acquisitionCosts: 0 }]
  });
  assert.deepEqual(s.properties[0].acquisitionCosts, []);
});

test("migrateState defaults a property's sectionsCollapsed to acquisition/loans/income/expenses collapsed, value left open", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [] },
    purchase: {},
    properties: [{ id: "p1", what: "1 Test St" }]
  });
  assert.deepEqual(s.properties[0].sectionsCollapsed, { acquisition: true, ownership: true, loans: true, income: true, expenses: true });
});

test("migrateState leaves an already-set sectionsCollapsed's own keys alone, but backfills a newly-added section", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [] },
    purchase: {},
    properties: [{ id: "p1", what: "1 Test St", sectionsCollapsed: { acquisition: false, loans: true, income: false, expenses: true } }]
  });
  // Every key the user had set is untouched. `ownership` is the one section that didn't exist
  // when this save was written, and it backfills collapsed for the same reason the whole default
  // is collapsed: a card shouldn't get taller on its own across an upgrade.
  assert.deepEqual(s.properties[0].sectionsCollapsed, { acquisition: false, ownership: true, loans: true, income: false, expenses: true });
});

test("migrateState backfills irregular:false/dueMonth:null onto every ledger array's items", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [{ what: "Home Insurance", amount: 1200, freq: "Yearly" }] },
    purchase: {},
    income: [{ what: "Salary", amount: 5000, freq: "Monthly" }],
    shared: [{ what: "Extras", amount: 100, freq: "Monthly" }],
    properties: [{ id: "p1", what: "1 Test St", income: [{ what: "Rent", amount: 400, freq: "Weekly" }], expenses: [{ what: "Maintenance", amount: 2000, freq: "Yearly" }] }]
  });
  [s.home["Current situation"][0], s.income[0], s.shared[0], s.properties[0].income[0], s.properties[0].expenses[0]].forEach(function(item){
    assert.equal(item.irregular, false);
    assert.equal(item.dueMonth, null);
  });
});

test("migrateState leaves an already-set irregular/dueMonth alone", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [] },
    purchase: {},
    shared: [{ what: "Extras", amount: 100, freq: "Monthly", irregular: true, dueMonth: 5 }]
  });
  assert.equal(s.shared[0].irregular, true);
  assert.equal(s.shared[0].dueMonth, 5);
});

test("migrateState seeds the default categories into a save that predates them", function(){
  var s = migrateState({ shared: [{ id: "e1", what: "Gas", amount: 230, freq: "Quarterly" }] });
  assert.deepEqual(s.categories, DEFAULT_CATEGORIES);
  assert.equal(s.shared[0].category, "", "existing lines start uncategorised rather than guessed at");
});

test("migrateState leaves an existing category list alone, including a deliberately emptied one", function(){
  var trimmed = migrateState({ categories: ["Car", "Health"], shared: [] });
  assert.deepEqual(trimmed.categories, ["Car", "Health"], "the user's own list wins over the defaults");
  var emptied = migrateState({ categories: [], shared: [] });
  assert.deepEqual(emptied.categories, [], "an emptied list is a choice, not a missing key to re-seed");
});

test("migrateState picks up category names used by a row but missing from the registry", function(){
  // How a CSV import or a hand-edited backup can reference a category the manager never knew.
  var s = migrateState({
    categories: ["Car"],
    shared: [
      { id: "e1", what: "Rego", category: "Car" },
      { id: "e2", what: "Swim lessons", category: "Kids activities" },
      { id: "e3", what: "Gas", category: "  " },
      { id: "e4", what: "Netflix" }
    ]
  });
  assert.deepEqual(s.categories, ["Car", "Kids activities"]);
  assert.equal(s.shared[2].category, "  ", "a blank-ish value is left as-is on the row, just not registered");
  assert.equal(s.shared[3].category, "", "a missing category defaults to empty rather than undefined");
});

test("migrateState drops junk entries from a category list", function(){
  var s = migrateState({ categories: ["Car", "", "   ", null, 42, "Health"], shared: [] });
  assert.deepEqual(s.categories, ["Car", "Health"]);
});

test("migrateState gives every home row a stable id, unique per scenario", function(){
  var s = migrateState({
    scenarios: ["Renting", "Buy Sydney"],
    home: {
      "Renting": [{ what: "Rent", amount: 810, freq: "Weekly" }, { what: "Water", amount: 147, freq: "Quarterly" }],
      "Buy Sydney": [{ what: "Home Loan", amount: 6257, freq: "Monthly" }, { what: "Council Rates", amount: 185, freq: "Monthly" }]
    },
    shared: []
  });
  var allRows = s.scenarios.reduce(function(acc, name){ return acc.concat(s.home[name]); }, []);
  assert.ok(allRows.every(function(i){ return typeof i.id === "string" && i.id; }), "every home row is addressable by id");
  // Unique *within* a scenario, which is the scope anything resolves an id in — the Budget list
  // and its transactions only ever see the active scenario's housing.
  s.scenarios.forEach(function(name){
    var ids = s.home[name].map(function(i){ return i.id; });
    assert.equal(new Set(ids).size, ids.length, name + " has no duplicate ids");
  });
  // The loan row is the deliberate exception: every scenario's row 0 carries the same fixed
  // "homeLoanRow" id, because engine.js and the purchase calculator look it up by that name
  // within a given scenario's block. Sharing it across scenarios is what makes "the housing
  // payment" resolve to whichever one you're actually living in.
  assert.equal(s.home["Renting"][0].id, "homeLoanRow");
  assert.equal(s.home["Buy Sydney"][0].id, "homeLoanRow");
  assert.notEqual(s.home["Renting"][1].id, s.home["Buy Sydney"][1].id,
    "non-loan rows are per scenario — Renting's Water and Buy Sydney's Council Rates are different lines");
});

test("migrateState leaves home ids it has already assigned alone", function(){
  var first = migrateState({ scenarios: ["Renting"], home: { "Renting": [{ what: "Rent" }, { what: "Water" }] }, shared: [] });
  var waterId = first.home["Renting"][1].id;
  var second = migrateState(JSON.parse(JSON.stringify(first)));
  assert.equal(second.home["Renting"][1].id, waterId, "re-running migration must not orphan transactions linked to it");
});

test("migrateState gives an old save an empty importRules and drops rules that can't work", function(){
  var s = migrateState({
    activeScenario: "Current situation",
    scenarios: ["Current situation"],
    home: { "Current situation": [] },
    purchase: {},
    importRules: [
      { id: "r1", match: "woolworths", linkedExpenseId: "e1", category: "Groceries" },
      { id: "r2", match: "", linkedExpenseId: "e2", category: "Subs" },
      { id: "r3", match: "mystery", linkedExpenseId: null, category: "" },
      null
    ]
  });
  // A rule with no match string can never fire; one with neither a line nor a category fires and
  // files the row nowhere, which reads as the app forgetting rather than never having been told.
  assert.deepEqual(s.importRules.map(function(r){ return r.id; }), ["r1"]);

  var fresh = migrateState({
    activeScenario: "Current situation", scenarios: ["Current situation"],
    home: { "Current situation": [] }, purchase: {}
  });
  assert.deepEqual(fresh.importRules, []);
});
