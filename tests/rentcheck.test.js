import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { rentCheck } from "../src/calc/rentcheck.js";

// v3.153.0: the plan's rent against the agent's statements. Invented.
function prop(weekly, rents, review){
  return { id: "p1", what: "9 Sample Ave", kind: "IP", income: [{ what: "Rent", amount: weekly, freq: "Weekly" }],
    rentReviews: review ? [{ date: review, from: 450, to: 480 }] : [],
    agentStatements: rents.map(function(r, i){ return { id: "s" + i, date: "2026-0" + (i + 3) + "-01", rent: r }; }) };
}

test("statements that are whole weeks of the plan's rent: nothing to say", function(){
  assert.equal(rentCheck(prop(480, [1920, 2400, 1920])), null);
});

test("a plan's rent the statements don't add up to names the one they do", function(){
  var r = rentCheck(prop(486.67, [2400, 1920, 2400]));
  assert.ok(r);
  assert.equal(r.fromStatements, 480);
  assert.equal(r.planned, 486.67);
});

test("only statements since the last rent review count", function(){
  var p = prop(480, [1800, 2400, 1920], "2026-03-15");
  assert.equal(rentCheck(p), null, "the 450-a-week statement is before the review");
});

test("too far off to be the same rent, or too few statements: no guess", function(){
  assert.equal(rentCheck(prop(900, [2400, 1920])), null);
  assert.equal(rentCheck(prop(486.67, [2400])), null);
});
