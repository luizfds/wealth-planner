import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { setupSteps, setupProgress, shouldShowSetup } from "../src/lib/setup.js";

// v3.162.0 (item 192): the first month, four steps — pay, a statement, the budget it suggests, what you
// own. The panel's job is to answer "what next" honestly: never a step called done while its page is
// empty, never nagging about one that's finished.

function stateWith(overrides){
  return Object.assign({ income: [], shared: [], assets: [], properties: [], transactions: [],
    scenarios: ["Renting"], activeScenario: "Renting", home: { Renting: [] } }, overrides || {});
}
var keys = function(s, opts){ var o = {}; setupSteps(s, opts).forEach(function(x){ o[x.key] = x.done; }); return o; };

test("a brand-new save has nothing done and points at pay first", function(){
  var p = setupProgress(stateWith());
  assert.equal(p.done, 0);
  assert.equal(p.total, 4);
  assert.equal(p.next.key, "income");
});

test("each step tracks its own data", function(){
  assert.deepEqual(keys(stateWith({ income: [{ amount: 100 }] })), { income: true, statement: false, budget: false, assets: false });
  assert.deepEqual(keys(stateWith({ transactions: [{ date: "2026-08-02", amount: 40 }] })), { income: false, statement: true, budget: false, assets: false });
  assert.equal(keys(stateWith({ assets: [{ amount: 1 }] })).assets, true);
  assert.equal(keys(stateWith({ properties: [{ value: 1 }] })).assets, true);
});

test("the budget step waits for three months, then for the suggestions to be dealt with", function(){
  var s = stateWith({ income: [{ amount: 1 }], transactions: [{ date: "2026-09-02", amount: 40 }] });
  var short = setupSteps(s, { budget: { ready: false, months: 1, proposals: [] } })[2];
  assert.equal(short.done, false);
  assert.match(short.hint, /Import 2 more months/);
  var pending = setupSteps(s, { budget: { ready: true, months: 3, proposals: [{}, {}] } })[2];
  assert.equal(pending.done, false);
  assert.match(pending.hint, /2 lines suggested/);
  assert.equal(setupSteps(s, { budget: { ready: true, months: 3, proposals: [] } })[2].done, true);
  assert.equal(setupSteps(stateWith(), { budget: { ready: true, months: 3, proposals: [] } })[2].done, false, "no statement, no budget from one");
});

test("each step says where to go, down to the card", function(){
  var st = setupSteps(stateWith());
  assert.deepEqual([st[1].page, st[1].sub, st[1].open], ["expenses", "spending", "bankImportCard"]);
  assert.deepEqual([st[2].page, st[2].sub, st[2].open], ["expenses", "budget", "historyBudgetCard"]);
});

test("the panel hides when there is nothing left to say, or when told to", function(){
  var full = stateWith({ income: [{ amount: 1 }], transactions: [{ date: "2026-09-02", amount: 1 }], assets: [{ amount: 1 }] });
  var opts = { budget: { ready: true, months: 3, proposals: [] } };
  assert.equal(setupProgress(full, opts).complete, true);
  assert.equal(setupProgress(full, opts).next, null);
  assert.equal(shouldShowSetup(full, opts), false);
  assert.equal(shouldShowSetup(stateWith()), true);
  assert.equal(shouldShowSetup(stateWith({ setupDismissed: true })), false);
  assert.equal(shouldShowSetup(null), false);
});

test("setupSteps survives a state missing every array it reads", function(){
  var bare = setupProgress({});
  assert.equal(bare.done, 0);
  assert.equal(bare.total, 4);
  assert.equal(typeof bare.next.label, "string");
});
