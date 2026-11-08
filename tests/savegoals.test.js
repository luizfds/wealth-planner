import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, migrateState } from "../src/state.js";
import { goalStatus, goalsOverview, addSavingsGoal } from "../src/calc/savegoals.js";
import { goalsSectionHtml, goalOpen } from "../src/components/savegoals.js";

function withState(fn){
  var keep = { accounts: state.accounts, assets: state.assets, debts: state.debts, properties: state.properties, savingsGoals: state.savingsGoals };
  try {
    state.assets = [{ id: "c1", what: "Pot", category: "Cash", amount: 12000, history: [{ date: "2026-05-01", value: 6000 }, { date: "2026-08-01", value: 9000 }, { date: "2026-10-01", value: 12000 }] }];
    state.debts = []; state.properties = [];
    state.accounts = [{ name: "Bank One Saver", type: "savings", link: "asset:c1" }, { name: "Spare", type: "everyday", link: "" }];
    state.savingsGoals = [];
    fn();
  } finally { Object.assign(state, keep); }
}

test("a goal counts its accounts' balances, what's needed per month, and the real pace", function(){
  withState(function(){
    var g = addSavingsGoal({ name: "Deposit", target: 30000, by: "2027-10-01", accounts: ["Bank One Saver", "Spare"] });
    var s = goalStatus(g, "2026-10-01", {});
    assert.equal(s.current, 12000);
    assert.equal(s.left, 18000);
    assert.equal(s.months, 12);
    assert.equal(s.neededMonthly, 1500);
    assert.equal(s.pace, 1200, "6,000 over five months");
    assert.equal(s.status, "behind");
    assert.equal(s.projected, "2028-01", "15 more months at that pace");
    assert.deepEqual(s.missing, ["Spare"]);
  });
});

test("the overview totals what goals need against the plan's surplus", function(){
  withState(function(){
    addSavingsGoal({ name: "Deposit", target: 30000, by: "2027-10-01", accounts: ["Bank One Saver"] });
    addSavingsGoal({ name: "Done one", target: 5000, accounts: ["Bank One Saver"] });
    var ov = goalsOverview("2026-10-01", 1000);
    assert.equal(ov.neededMonthly, 1500);
    assert.equal(ov.covered, false);
    assert.equal(ov.goals[1].status, "done");
    var html = goalsSectionHtml("2026-10-01", 1000);
    assert.match(html, /need <b>\$1,500\/mo<\/b> together; the plan leaves <b>\$1,000\/mo<\/b>/);
    assert.match(html, /\$500\/mo short/);
    assert.match(html, /Reached/);
  });
});

test("migration gives every goal an id and an account list", function(){
  var s = migrateState({ savingsGoals: [{ name: "Old", target: "200" }, null] });
  assert.equal(s.savingsGoals.length, 1);
  assert.ok(s.savingsGoals[0].id);
  assert.deepEqual(s.savingsGoals[0].accounts, []);
  assert.equal(s.savingsGoals[0].target, 200);
});

test("a goal past its target says by how much, and where the surplus could go", function(){
  withState(function(){
    state.assets.push({ id: "c2", what: "Deposit pot", category: "Cash", amount: 7000, history: [] });
    state.accounts.push({ name: "Deposit saver", type: "savings", link: "asset:c2" }, { name: "Loan offset", type: "offset", link: "" });
    addSavingsGoal({ name: "Emergency", target: 5000, accounts: ["Bank One Saver"] });
    addSavingsGoal({ name: "Deposit", target: 10000, by: "2027-10-01", accounts: ["Deposit saver"] });
    var ov = goalsOverview("2026-10-01", 1000);
    var em = ov.goals[0];
    assert.equal(em.over, 7000);
    assert.equal(em.times, 2.4);
    assert.deepEqual(em.surplusTo, { kind: "goal", name: "Deposit", amount: 3000, finishes: true });
    var html = goalsSectionHtml("2026-10-01", 1000);
    assert.match(html, /2\.4× the target/);
    assert.match(html, /\$7,000 over\. Moving \$3,000 of it would finish Deposit\./);
    // Nothing left to finish: the offset.
    state.savingsGoals = state.savingsGoals.slice(0, 1);
    assert.deepEqual(goalsOverview("2026-10-01", 1000).goals[0].surplusTo, { kind: "offset", name: "Loan offset", amount: 7000 });
  });
});

// #254 / #261: an open goal's editor is shared fields — each label tied to its own goal's control, help described,
// and a typed name escaped.
test("an open goal's editor labels its own fields, describes its help, and escapes the name", function(){
  withState(function(){
    var a = addSavingsGoal({ name: 'Deposit <img src=x onerror=alert(1)>', target: 30000, by: "2027-10-01", accounts: ["Bank One Saver"] });
    var b = addSavingsGoal({ name: "Car", target: 8000, accounts: ["Bank One Saver"] });
    goalOpen[a.id] = true; goalOpen[b.id] = true;
    try {
      var html = goalsSectionHtml("2026-10-01", 1000);
      assert.ok(!/<img/.test(html), "a goal's name went into the editor unescaped");
      var ids = [...html.matchAll(/<label class="field-label" for="([^"]+)">([^<]+)/g)].map(m => m[1] + "=" + m[2]);
      assert.equal(ids.length, 6, "three labelled fields per open goal: " + ids.join(", "));
      assert.equal(new Set(ids.map(x => x.split("=")[0])).size, 6, "two goals' fields share an id");
      for(const m of html.matchAll(/for="([^"]+)"/g)) assert.ok(html.includes('id="' + m[1] + '"'), "a label points at no control: " + m[1]);
      assert.match(html, /aria-describedby="[^"]*-target-help[^"]*"/);
    } finally { delete goalOpen[a.id]; delete goalOpen[b.id]; }
  });
});
