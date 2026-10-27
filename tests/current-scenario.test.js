import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { currentScenario, scenarioTotals } from "../src/calc/engine.js";
import { emergencyFund } from "../src/calc/emergency.js";

// v3.102.0: selecting a scenario to look at it must not change figures about today. Invented household.
function withScenarios(fn){
  var keys = ["shared", "home", "properties", "assets", "transactions", "income", "scenarios", "activeScenario", "baselineScenario", "emergency"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Buy"]; state.baselineScenario = "Renting"; state.activeScenario = "Buy";
    state.shared = [{ id: "g", what: "Groceries", category: "Groceries", classification: "Needs", amount: 600, freq: "Monthly" }];
    state.home = { Renting: [{ id: "r", what: "Rent", amount: 2000, freq: "Monthly" }], Buy: [{ id: "m", what: "Mortgage", amount: 3500, freq: "Monthly" }] };
    state.properties = []; state.assets = [{ category: "Cash", what: "Everyday", amount: 9000 }];
    state.transactions = []; state.income = [];
    delete state.emergency;
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("currentScenario is the Current situation, whichever scenario is selected", function(){
  withScenarios(function(){
    assert.equal(currentScenario(), "Renting");
    state.baselineScenario = "Gone";
    assert.equal(currentScenario(), "Buy", "falls back to the selected one when the baseline no longer exists");
  });
});

test("the emergency fund sizes on the home you live in, not the one you're looking at", function(){
  withScenarios(function(){
    assert.equal(emergencyFund({ today: "2026-10-20" }).monthly, 2600);
    assert.equal(emergencyFund({ today: "2026-10-20", scenario: "Buy" }).monthly, 4100, "a scenario can still be asked for");
    assert.equal(scenarioTotals("Buy").homeMonthly, 3500);
  });
});
