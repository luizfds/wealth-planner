import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDraft, draftKey, hasDraft, draftChanged, saveDraft, discardDraft, renameDraft } from "../src/calc/scenariodraft.js";
import { diffForLog } from "../src/calc/activity.js";

function household(){
  return { scenarios: ["Today", "Rentvest"],
    purchase: { Today: { enabled: false }, Rentvest: { enabled: false, price: 0 } },
    invest: { Today: { enabled: false }, Rentvest: { enabled: false } },
    home: { Today: [], Rentvest: [{ id: "h1", what: "Contents insurance", amount: 30, freq: "Monthly" }] },
    scenarioChanges: { Rentvest: [{ id: "c1", kind: "rent", amount: 700, freq: "Weekly", fromYear: 0 }] } };
}

test("a draft is a copy beside the scenario, not in the scenario list, and edits stay in it until saved", function(){
  var st = household();
  var key = openDraft("Rentvest", st);
  assert.equal(key, draftKey("Rentvest"));
  assert.deepEqual(st.scenarios, ["Today", "Rentvest"]);
  assert.equal(draftChanged("Rentvest", st), false);
  st.scenarioChanges[key][0].amount = 820;
  st.home[key].push({ id: "h2", what: "Parking", amount: 120, freq: "Monthly" });
  assert.equal(st.scenarioChanges.Rentvest[0].amount, 700, "the saved scenario is untouched");
  assert.equal(draftChanged("Rentvest", st), true);
  // Opening again picks the same draft up.
  openDraft("Rentvest", st);
  assert.equal(st.scenarioChanges[key][0].amount, 820);
  assert.ok(saveDraft("Rentvest", st));
  assert.equal(st.scenarioChanges.Rentvest[0].amount, 820);
  assert.equal(st.home.Rentvest.length, 2);
  assert.equal(hasDraft("Rentvest", st), false);
});

test("cancel drops the draft; a rename carries it", function(){
  var st = household();
  var key = openDraft("Rentvest", st);
  st.purchase[key].price = 999;
  discardDraft("Rentvest", st);
  assert.equal(hasDraft("Rentvest", st), false);
  assert.equal(st.purchase.Rentvest.price, 0);
  openDraft("Rentvest", st);
  renameDraft("Rentvest", "Rent and invest", st);
  assert.equal(hasDraft("Rentvest", st), false);
  assert.equal(hasDraft("Rent and invest", st), true);
});

test("editing a draft isn't somebody's change in the activity log", function(){
  var before = household(), after = household();
  var key = openDraft("Rentvest", after);
  after.scenarioChanges[key][0].amount = 900;
  assert.deepEqual(diffForLog(before, after), []);
});
