import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { merchantGroupKey, merchantGroups, worthShowingMerchants, recentMerchants, UNLABELLED } from "../src/calc/merchants.js";

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

test("blank and punctuation-only descriptions have no merchant key", () => {
  assert.equal(merchantGroupKey(""), "");
  assert.equal(merchantGroupKey("   "), "");
  assert.equal(merchantGroupKey("---"), "");
  assert.equal(merchantGroupKey(null), "");
});

test("undescribed transactions collapse into one bucket that still carries their money", () => {
  // They are not merchants and must not be listed as three separate ones - but they are also not
  // nothing, so the money stays in the breakdown rather than quietly leaving it.
  const groups = merchantGroups([
    { what: "", amount: 10 }, { what: "   ", amount: 20 }, { what: null, amount: 30 }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, UNLABELLED);
  assert.equal(groups[0].total, 60);
  assert.equal(groups[0].count, 3);
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

// ---------------- Transactions with no description ----------------
// They still spent money. Dropping them silently made the breakdown's parts stop adding up to the
// line's own total, with nothing on screen saying a slice was missing.
test("an undescribed transaction gets its own bucket instead of vanishing", () => {
  const groups = merchantGroups([
    { what: "Amazon", amount: 100 },
    { what: "", amount: 60 },
    { what: "   ", amount: 40 }
  ]);
  const total = groups.reduce((s, g) => s + g.total, 0);
  assert.equal(total, 200, "the parts must add up to what was spent");
  const unlabelled = groups.find(g => g.label === UNLABELLED);
  assert.ok(unlabelled);
  assert.equal(unlabelled.total, 100);
  assert.equal(unlabelled.count, 2);
});

test("a description that normalises away to nothing lands in the same bucket", () => {
  const groups = merchantGroups([{ what: "Amazon", amount: 10 }, { what: "---", amount: 5 }]);
  assert.equal(groups.length, 2);
  assert.ok(groups.some(g => g.label === UNLABELLED));
});

test("the unlabelled bucket does not count as a merchant for the show/hide decision", () => {
  // One real merchant plus two unnamed transactions is not a breakdown worth opening.
  const groups = merchantGroups([
    { what: "Amazon", amount: 100 }, { what: "", amount: 60 }, { what: "", amount: 40 }
  ]);
  assert.equal(groups.length, 2);
  assert.equal(worthShowingMerchants(groups, 3), false);
  // Add a second real merchant and it becomes worth showing.
  const two = merchantGroups([
    { what: "Amazon", amount: 100 }, { what: "Doordash", amount: 60 }, { what: "", amount: 40 }
  ]);
  assert.equal(worthShowingMerchants(two, 3), true);
});

// ---------------- Refunds ----------------
// A refund is a negative transaction (the quick-log amount field says so), which means a merchant
// can net out below zero: the shoes went back this cycle and were bought in the last one.
test("an ordinary refund just reduces that merchant's total", () => {
  const g = merchantGroups([
    { what: "Amazon", amount: 100 }, { what: "Amazon", amount: -30 }, { what: "Doordash", amount: 50 }
  ]);
  const amazon = g.find(x => x.label === "Amazon");
  assert.equal(amazon.total, 70);
  assert.equal(amazon.count, 2, "the refund is still a transaction that happened");
});

test("shares stay within 0-100% however the refunds fall", () => {
  // Measured against net total these were 10,000% and -9,900%, rendering width:10000% on the bar.
  const cases = [
    [{ what: "Amazon", amount: 100 }, { what: "Doordash", amount: -99 }],
    [{ what: "Amazon", amount: -50 }, { what: "Hoka", amount: 297 }],
    [{ what: "Amazon", amount: -10 }, { what: "Hoka", amount: -20 }],
    [{ what: "Amazon", amount: 0 }, { what: "Hoka", amount: 0 }]
  ];
  cases.forEach((tx, i) => {
    merchantGroups(tx).forEach(g => {
      assert.ok(g.share >= 0 && g.share <= 1, `case ${i}: share ${g.share} out of range for ${g.label}`);
      assert.ok(Number.isFinite(g.share), `case ${i}: share not finite for ${g.label}`);
    });
  });
});

test("a merchant that net refunded gets no bar but keeps its real total", () => {
  const g = merchantGroups([{ what: "Amazon", amount: -50 }, { what: "Hoka", amount: 297 }]);
  const amazon = g.find(x => x.label === "Amazon");
  assert.equal(amazon.share, 0, "handing money back is not eating the line");
  assert.equal(amazon.total, -50, "but the money is real and still reported");
  assert.equal(g.find(x => x.label === "Hoka").share, 1);
});
