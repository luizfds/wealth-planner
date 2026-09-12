import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { setupSteps, setupProgress, shouldShowSetup } from "../src/lib/setup.js";

// The panel's whole job is to answer "what next" honestly. Two ways it could lie: claiming a step
// is done when the page behind it is still empty, or nagging about one that is finished.

function stateWith(overrides){
  return Object.assign({
    income: [], shared: [], assets: [], properties: [],
    scenarios: ["Renting"], activeScenario: "Renting", home: { Renting: [] }
  }, overrides || {});
}

test("a brand-new save has nothing done and points at income first", function(){
  var p = setupProgress(stateWith());
  assert.equal(p.done, 0);
  assert.equal(p.total, 5);
  assert.equal(p.complete, false);
  assert.equal(p.next.key, "income", "the first thing to enter is the first thing suggested");
});

test("each step tracks its own page's data, not the others'", function(){
  var byKey = function(s){ var o = {}; setupSteps(s).forEach(function(x){ o[x.key] = x.done; }); return o; };
  assert.deepEqual(byKey(stateWith({ income: [{ amount: 100 }] })),
    { income: true, expenses: false, housing: false, assets: false, compare: false });
  assert.deepEqual(byKey(stateWith({ shared: [{ amount: 50 }] })),
    { income: false, expenses: true, housing: false, assets: false, compare: false });
  // Assets and properties are one step: either satisfies "add what you own".
  assert.equal(byKey(stateWith({ assets: [{ amount: 1 }] })).assets, true);
  assert.equal(byKey(stateWith({ properties: [{ value: 1 }] })).assets, true);
  assert.equal(byKey(stateWith({ scenarios: ["Renting", "Buying"] })).compare, true);
});

test("housing counts a row with a cost, not the block that always exists", function(){
  // migrateState seeds a home block for every scenario, so "the block exists" is true from the
  // first load and would mark this step done before the user has typed anything.
  assert.equal(setupSteps(stateWith({ home: { Renting: [] } }))[2].done, false);
  assert.equal(setupSteps(stateWith({ home: { Renting: [{ what: "Rent", amount: 0 }] } }))[2].done, false,
    "a seeded row with no amount is not a housing cost");
  assert.equal(setupSteps(stateWith({ home: { Renting: [{ what: "Rent", amount: 650 }] } }))[2].done, true);
  // Only the *active* scenario's block counts — that's the one the Dashboard's figures use.
  var other = stateWith({ activeScenario: "Renting", home: { Renting: [], Buying: [{ amount: 900 }] } });
  assert.equal(setupSteps(other)[2].done, false);
});

test("the panel hides when there is nothing left to say", function(){
  var full = stateWith({
    income: [{ amount: 1 }], shared: [{ amount: 1 }], assets: [{ amount: 1 }],
    scenarios: ["Renting", "Buying"], home: { Renting: [{ amount: 650 }] }
  });
  assert.equal(setupProgress(full).complete, true);
  assert.equal(setupProgress(full).next, null, "nothing to point at once it's all done");
  assert.equal(shouldShowSetup(full), false);
  assert.equal(shouldShowSetup(stateWith()), true);
  // Dismissal wins over an incomplete list, and survives being asked again.
  assert.equal(shouldShowSetup(stateWith({ setupDismissed: true })), false);
  assert.equal(shouldShowSetup(null), false);
});

test("setupSteps survives a state missing every array it reads", function(){
  // An old save, or a hand-edited backup. None of these keys are guaranteed.
  var bare = setupProgress({});
  assert.equal(bare.done, 0);
  assert.equal(bare.total, 5);
  assert.equal(typeof bare.next.label, "string");
  assert.equal(setupSteps({ home: null, scenarios: null }).length, 5);
});
