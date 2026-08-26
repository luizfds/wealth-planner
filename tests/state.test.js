import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { defaultState, migrateState } from "../src/state.js";

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
