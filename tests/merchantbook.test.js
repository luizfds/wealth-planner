import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { knownMerchant, cleanMerchantName, looksLikeBankText } from "../src/calc/merchantbook.js";
import { suggestFor } from "../src/calc/import-rules.js";

// v3.111.0: well-known brands and clean names. Brand names are public; amounts and places invented.
test("knownMerchant finds a brand, short ones only where the merchant starts", () => {
  assert.equal(knownMerchant("WOOLWORTHS 1234 EXAMPLETOWN").category, "Groceries");
  assert.equal(knownMerchant("EFTPOS BP EXAMPLETOWN 4567").name, "BP");
  assert.equal(knownMerchant("SHELL COLES EXPRESS 1234").category, "Car", "the longer key wins");
  assert.equal(knownMerchant("UBER *EATS SYDNEY").name, "Uber Eats");
  assert.equal(knownMerchant("FERN CAFE BP STREET"), null, "a short brand mid-description isn't trusted");
  assert.equal(knownMerchant("Fern Grocer"), null);
});

test("cleanMerchantName tidies bank text and leaves typed names alone", () => {
  assert.equal(cleanMerchantName("SQ *FERN CAFE 4029 ULTIMO"), "Fern Cafe");
  assert.equal(cleanMerchantName("COLES 0712 EXAMPLETOWN NSW"), "Coles");
  assert.equal(cleanMerchantName("Fern Café"), "Fern Café", "typed by hand: as typed");
  assert.equal(cleanMerchantName("Rent"), "Rent");
  assert.ok(looksLikeBankText("NETFLIX.COM 866-579-7172") && !looksLikeBankText("Gym"));
});

test("a known brand files onto your one line in its category, else the category, after your own rules and names", () => {
  const lines = [{ id: "g", what: "Food shop", category: "Groceries" }, { id: "p", what: "Phone", category: "Utilities" }, { id: "e", what: "Power", category: "Utilities" }];
  const s1 = suggestFor("WOOLWORTHS 1234 EXAMPLETOWN", [], lines, "debit", { categories: ["Groceries", "Utilities"] });
  assert.deepEqual([s1.source, s1.linkedExpenseId], ["known", "g"]);
  const s2 = suggestFor("TELSTRA BILL 99887766", [], lines, "debit", { categories: ["Groceries", "Utilities"] });
  assert.deepEqual([s2.source, s2.linkedExpenseId, s2.category], ["known", null, "Utilities"], "two Utilities lines: the category, not a guess between them");
  const s3 = suggestFor("WOOLWORTHS 1234 EXAMPLETOWN", [{ match: "woolworths", linkedExpenseId: "p" }], lines, "debit", {});
  assert.equal(s3.source, "rule", "your own rule wins");
  assert.equal(suggestFor("NETFLIX.COM", [], [], "debit", { categories: [] }).source, null, "nothing to file it under: no guess");
  assert.equal(suggestFor("WOOLWORTHS REFUND", [], lines, "credit", { categories: ["Groceries"] }).source, null, "money in isn't spending");
});
