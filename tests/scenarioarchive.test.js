import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { archiveScenario, restoreScenario, deleteArchived, archiveBlocker, restoredName } from "../src/calc/scenarioarchive.js";
import { everyAccountLink } from "../src/calc/accountlinks.js";

// Invented households.
function household(){
  return {
    scenarios: ["Current situation", "Buy a house", "Move north"], baselineScenario: "Current situation", activeScenario: "Buy a house",
    home: { "Current situation": [], "Buy a house": [{ id: "homeLoanRow", what: "Home loan", amount: 2500, account: "Everyday" }], "Move north": [] },
    purchase: { "Buy a house": { enabled: true, price: 600000 } }, invest: { "Buy a house": { enabled: false } },
    scenarioChanges: { "Buy a house": [{ id: "c1", kind: "amount", line: "s1", amount: 50 }], "Move north": [{ id: "c2", kind: "include", scenario: "Buy a house" }] },
    scenarioNotes: { "Buy a house": "The one near the park" },
    shared: [{ id: "s1", what: "Groceries", amount: 200, scenarioOverrides: { "Buy a house": 250 } }],
    income: [{ id: "i1", what: "Pay", amount: 3000, scenarioOverrides: {} }]
  };
}

test("archiving takes a scenario off every list and keeps all of it; restoring brings it back as it was", function(){
  const st = household();
  const before = JSON.parse(JSON.stringify(st));
  const e = archiveScenario(st, "Buy a house", "2026-11-20");
  assert.ok(e);
  assert.deepEqual(st.scenarios, ["Current situation", "Move north"]);
  assert.equal(st.activeScenario, "Current situation", "showing it: the household shows instead");
  assert.ok(!("Buy a house" in st.home) && !("Buy a house" in st.purchase) && !("Buy a house" in st.scenarioChanges) && !("Buy a house" in st.scenarioNotes));
  assert.ok(!("Buy a house" in st.shared[0].scenarioOverrides), "a line varied for it isn't, while it's put away");
  assert.deepEqual(st.scenarioChanges["Move north"], [], "a scenario that included it doesn't, while it's put away");
  assert.equal(st.scenarioArchive.length, 1);
  assert.equal(st.scenarioArchive[0].archivedOn, "2026-11-20");
  // An account rename reaches its home rows while it's archived.
  assert.ok(everyAccountLink(st).some(x => x.row.id === "homeLoanRow"));

  assert.equal(restoreScenario(st, 0), "Buy a house");
  assert.equal(st.scenarioArchive.length, 0);
  assert.deepEqual(st.scenarios, ["Current situation", "Move north", "Buy a house"]);
  assert.deepEqual(st.home["Buy a house"], before.home["Buy a house"]);
  assert.deepEqual(st.purchase["Buy a house"], before.purchase["Buy a house"]);
  assert.deepEqual(st.scenarioChanges["Buy a house"], before.scenarioChanges["Buy a house"]);
  assert.equal(st.scenarioNotes["Buy a house"], "The one near the park");
  assert.equal(st.shared[0].scenarioOverrides["Buy a house"], 250);
  assert.deepEqual(st.scenarioChanges["Move north"].map(c => c.scenario), ["Buy a house"]);
});

test("the current situation and the last scenario stay; a taken name comes back numbered; gone is gone", function(){
  const st = household();
  assert.match(archiveBlocker(st, "Current situation"), /current situation stays/);
  assert.equal(archiveScenario(st, "Current situation", "2026-11-20"), null);
  assert.equal(archiveBlocker(st, "Nope"), "There's no scenario called that.");
  archiveScenario(st, "Buy a house", "2026-11-20");
  st.scenarios.push("buy a house");
  assert.equal(restoredName(st, "Buy a house"), "Buy a house (2)");
  st.shared = [];   // the line it varied, deleted since
  assert.equal(restoreScenario(st, 0), "Buy a house (2)");
  assert.equal(st.home["Buy a house (2)"].length, 1);
  archiveScenario(st, "Move north", "2026-11-21");
  deleteArchived(st, 0);
  assert.equal(st.scenarioArchive.length, 0);
  assert.equal(restoreScenario(st, 0), null);
  const one = { scenarios: ["Only"], baselineScenario: "Other" };
  assert.match(archiveBlocker(one, "Only"), /at least one/);
});
