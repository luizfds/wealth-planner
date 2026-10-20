import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { catchAllSuggestions, isCatchAllLine } from "../src/calc/recurring.js";
import { recurringHtml } from "../src/components/recurring.js";

// What's hiding in a catch-all line (v3.90.0), invented payees.
test("catch-all lines are recognised by name", function(){
  assert.ok(isCatchAllLine({ what: "Misc." }));
  assert.ok(isCatchAllLine({ what: "Extras (gifts etc)" }));
  assert.ok(isCatchAllLine({ what: "Other spending" }));
  assert.ok(!isCatchAllLine({ what: "Groceries" }));
  assert.ok(!isCatchAllLine({ what: "Mother's day" }), "a word, not a substring");
});

test("repeating payees inside one are offered as their own line; one kind grouped together", function(){
  var lines = [{ id: "m", what: "Misc." }, { id: "g", what: "Groceries" }, { id: "hg", what: "Home & garden" }];
  var tx = [];
  function add(what, amount, date){ tx.push({ linkedExpenseId: "m", what: what, amount: amount, date: date }); }
  add("BWS 0412 SOMEWHERE", 31, "2026-02-03"); add("LIQUORLAND 77", 18.5, "2026-04-11"); add("DAN MURPHY'S 12", 64, "2026-07-30");
  add("BUNNINGS 9921", 140, "2026-01-09"); add("BUNNINGS 9921", 62, "2026-05-02"); add("BUNNINGS 1102", 88, "2026-08-20");
  add("FERN CAFE", 9, "2026-03-01"); add("FERN CAFE", 11, "2026-03-08"); add("FERN CAFE", 10, "2026-03-15");
  add("PAPER STOP", 300, "2026-06-01");
  add("BWS 0412 SOMEWHERE", 500, "2024-12-01");
  var s = catchAllSuggestions(lines, tx, "2026-10-18");
  var byName = {}; s.forEach(function(x){ byName[x.name] = x; });
  assert.equal(byName.Alcohol.count, 3, "three bottle shops, one line; the 2024 one is too old");
  assert.equal(byName.Alcohol.keys.length, 3);
  assert.equal(byName.Alcohol.total, 113.5);
  assert.equal(byName["Home & garden"].existingLineId, "hg", "a line with that name already exists");
  assert.equal(byName["Fern Cafe"], undefined, "under the $100 floor");
  assert.equal(byName["Paper Stop"], undefined, "once is not a pattern");
  var html = recurringHtml([], [], s);
  assert.match(html, /Hiding in a catch-all line \(2\)/);
  assert.match(html, /Move to Home &amp; garden|Move to Home & garden/);
  assert.match(html, /data-rc-split="m\|kind:Alcohol">Make it a line/);
});
