import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { merchantGroupKey, merchantGroups, worthShowingMerchants, recentMerchants } from "../src/calc/merchants.js";

// The fixtures are real descriptions from a real household's Expenses page, because the whole
// point of this module is that hand-typed text behaves nothing like a bank export string.

test("case and accents group together", () => {
  assert.equal(merchantGroupKey("Leaf café"), merchantGroupKey("Leaf Café"));
  assert.equal(merchantGroupKey("Leaf café"), "leaf cafe");
  assert.equal(merchantGroupKey("AMAZON"), merchantGroupKey("Amazon"));
});

test("a trailing bracket qualifies the purchase, it doesn't name the payee", () => {
  assert.equal(merchantGroupKey("Doordash (El Jannah)"), merchantGroupKey("Doordash"));
  assert.equal(merchantGroupKey("Hoka shoes (Big W)"), "hoka shoes");
});

test("a slash is two labels, not one name", () => {
  assert.equal(merchantGroupKey("Date Night / Eating Out"), "date night");
});

test("distinct merchants stay distinct", () => {
  // Under-grouping is a blemish; over-grouping reports a wrong number. These must not merge.
  const keys = ["Amazon", "Marina Cafe", "Leaf Café", "Doordash", "El Jannah", "Willowdale Hotel", "De'Assis"]
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
    { what: "Amazon", amount: 22.50 },
    { what: "Amazon", amount: 168.49 },
    { what: "Doordash", amount: 54.50 },
    { what: "Doordash (El Jannah)", amount: 85.24 },
    { what: "Leaf café", amount: 71.96 },
    { what: "Leaf Café", amount: 73.28 }
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].label, "Amazon");
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].total, 190.99);
  // Leaf ($71.96 + $73.28 = $145.24) outspends Doordash ($54.50 + $85.24 = $139.74).
  assert.equal(groups[1].label, "Leaf café");
  assert.equal(groups[1].total, 145.24);
  assert.equal(groups[2].label, "Doordash");
  assert.equal(groups[2].total, 139.74);
  // Shares add to 1.
  assert.ok(Math.abs(groups.reduce((s, g) => s + g.share, 0) - 1) < 1e-9);
});

test("the label is the spelling the user used most, not a normalised one", () => {
  const groups = merchantGroups([
    { what: "Leaf Café", amount: 10 },
    { what: "Leaf Café", amount: 10 },
    { what: "leaf cafe", amount: 10 }
  ]);
  assert.equal(groups[0].label, "Leaf Café");
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
    { date: "2026-09-20", what: "Leaf café", linkedExpenseId: "eat" },
    { date: "2026-09-13", what: "Leaf Café", linkedExpenseId: "eat" },
    { date: "2026-09-17", what: "Doordash (El Jannah)", linkedExpenseId: "eat" },
    { date: "2026-09-07", what: "", linkedExpenseId: "eat" }
  ];
  const eat = recentMerchants(tx, "eat");
  assert.deepEqual(eat, ["Leaf café", "Doordash (El Jannah)"]);  // the two Leaf spellings collapse
  assert.ok(!recentMerchants(tx, "eat").includes("Amazon"), "must not offer another line's merchants");
  assert.equal(recentMerchants(tx, null, 10).length, 3);
  assert.equal(recentMerchants(tx, "eat", 1).length, 1);
});
