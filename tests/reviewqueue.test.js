import { test } from "node:test";
import assert from "node:assert/strict";
import { toReview, keepTransaction, refileTransaction, applyRuleFromReview, keepAll, ruleOfferFor } from "../src/calc/reviewqueue.js";
import { matchRule } from "../src/calc/import-rules.js";

function rows(){
  return [
    { id: "t1", date: "2026-09-04", what: "FERN CAFE EXAMPLE TOWN", amount: 18.5, category: "Shopping", reviewed: false },
    { id: "t2", date: "2026-09-01", what: "CITY TRANSIT TOPUP", amount: 40, linkedExpenseId: "line-transport", reviewed: false },
    { id: "t3", date: "2026-09-11", what: "FERN CAFE EXAMPLE TOWN", amount: 22, category: "Shopping", reviewed: false },
    { id: "t0", date: "2026-08-20", what: "BANK ONE FEE", amount: 5 }   // saved before the queue: already reviewed
  ];
}

test("the queue is the imported rows nobody has looked at, oldest first", function(){
  assert.deepEqual(toReview(rows()).map(function(t){ return t.id; }), ["t2", "t1", "t3"]);
});

test("keep and refile take a row out of the queue; refiling to a line clears its own category", function(){
  var r = rows();
  keepTransaction(r[1]);
  refileTransaction(r[0], { linkedExpenseId: "line-eating-out", category: "" });
  assert.equal(r[0].linkedExpenseId, "line-eating-out");
  assert.equal(r[0].category, "");
  assert.deepEqual(toReview(r).map(function(t){ return t.id; }), ["t3"]);
});

test("'Always' teaches a rule the next import applies, and files the rest from that shop", function(){
  var r = rows(), rules = [];
  assert.ok(ruleOfferFor(r[0]));
  refileTransaction(r[0], { linkedExpenseId: null, category: "Eating out" });
  var also = applyRuleFromReview(rules, r, r[0], { linkedExpenseId: null, category: "Eating out" }, function(){ return "rule-1"; });
  assert.equal(also, 1, "the other Fern Cafe row waiting");
  assert.equal(r[2].category, "Eating out");
  assert.equal(r[2].reviewed, true);
  var hit = matchRule("FERN CAFE EXAMPLE TOWN 0412", rules);
  assert.ok(hit && hit.category === "Eating out", "next month's statement files it by itself");
});

test("keep all clears the queue", function(){
  var r = rows();
  assert.equal(keepAll(r), 3);
  assert.equal(toReview(r).length, 0);
});
