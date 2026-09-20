import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { merchantGroupKey, merchantGroups, worthShowingMerchants, recentMerchants } from "../src/calc/merchants.js";

// The fixtures are real descriptions from a real household's Expenses page, because the whole
// point of this module is that hand-typed text behaves nothing like a bank export string.

test("case and accents group together", () => {
  assert.equal(merchantGroupKey("Fern café"), merchantGroupKey("Fern Café"));
  assert.equal(merchantGroupKey("Fern café"), "fern cafe");
  assert.equal(merchantGroupKey("AMAZON"), merchantGroupKey("Amazon"));
});

test("a trailing bracket qualifies the purchase, it doesn't name the payee", () => {
  assert.equal(merchantGroupKey("Doordash (Chicken Shed)"), merchantGroupKey("Doordash"));
  assert.equal(merchantGroupKey("Running shoes (Big W)"), "running shoes");
});

test("a slash is two labels, not one name", () => {
  assert.equal(merchantGroupKey("Dinners Out / Eating Out"), "date night");
});

test("distinct merchants stay distinct", () => {
  // Under-grouping is a blemish; over-grouping reports a wrong number. These must not merge.
  const keys = ["Amazon", "Harbour Cafe", "Fern Café", "Doordash", "Chicken Shed", "Riverside Hotel", "D'Arcy's"]
    .map(merchantGroupKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("blank and punctuation-only descriptions are skipped, not grouped as one merchant", () => {
  assert.equal(merchantGroupKey(""), "");
  assert.equal(merchantGroupKey("   "), "");
  assert.equal(merchantGroupKey("---"), "");
  assert.equal(merchantGroupKey(null), "");
  const groups = merchantGroups([
    { what: "", amount: 10 }, { what: "   ", amount: 20 }, { what: null, amount: 30 }
  ]);
  assert.equal(groups.length, 0);
});

test("groups total correctly and are sorted biggest spend first", () => {
  const groups = merchantGroups([
    { what: "Amazon", amount: ***REMOVED*** },
    { what: "Amazon", amount: ***REMOVED*** },
    { what: "Doordash", amount: ***REMOVED*** },
    { what: "Doordash (Chicken Shed)", amount: ***REMOVED*** },
    { what: "Fern café", amount: ***REMOVED*** },
    { what: "Fern Café", amount: ***REMOVED*** }
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].label, "Amazon");
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].total, ***REMOVED***);
  // Fern ($***REMOVED*** + $***REMOVED*** = $***REMOVED***) outspends Doordash ($***REMOVED*** + $***REMOVED*** = $***REMOVED***).
  assert.equal(groups[1].label, "Fern café");
  assert.equal(groups[1].total, ***REMOVED***);
  assert.equal(groups[2].label, "Doordash");
  assert.equal(groups[2].total, ***REMOVED***);
  // Shares add to 1.
  assert.ok(Math.abs(groups.reduce((s, g) => s + g.share, 0) - 1) < 1e-9);
});

test("the label is the spelling the user used most, not a normalised one", () => {
  const groups = merchantGroups([
    { what: "Fern Café", amount: 10 },
    { what: "Fern Café", amount: 10 },
    { what: "fern cafe", amount: 10 }
  ]);
  assert.equal(groups[0].label, "Fern Café");
});

test("a breakdown is withheld when there is nothing to break down", () => {
  // One merchant is just the row you already clicked.
  assert.equal(worthShowingMerchants([{}], 5), false);
  // Two transactions with different names is not yet a pattern.
  assert.equal(worthShowingMerchants([{}, {}], 2), false);
  assert.equal(worthShowingMerchants([{}, {}], 3), true);
});

test("recent merchants are newest-first, de-duplicated, and scoped to their line", () => {
  const tx = [
    { date: "2026-09-19", what: "Amazon", linkedExpenseId: "misc" },
    { date: "2026-09-20", what: "Fern café", linkedExpenseId: "eat" },
    { date: "2026-09-13", what: "Fern Café", linkedExpenseId: "eat" },
    { date: "2026-09-17", what: "Doordash (Chicken Shed)", linkedExpenseId: "eat" },
    { date: "2026-09-07", what: "", linkedExpenseId: "eat" }
  ];
  const eat = recentMerchants(tx, "eat");
  assert.deepEqual(eat, ["Fern café", "Doordash (Chicken Shed)"]);  // the two Leaf spellings collapse
  assert.ok(!recentMerchants(tx, "eat").includes("Amazon"), "must not offer another line's merchants");
  assert.equal(recentMerchants(tx, null, 10).length, 3);
  assert.equal(recentMerchants(tx, "eat", 1).length, 1);
});
