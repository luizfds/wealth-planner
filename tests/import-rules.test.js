import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  merchantKey, matchRule, matchBudgetLineByName, suggestFor, applySuggestions,
  learnRule, pruneRules, coverageOf,
  suggestedLineName, monthlyRateFrom, proposedLineFor
} from "../src/calc/import-rules.js";

var LINES = [
  { id: "e1", what: "Groceries", category: "Groceries", account: "Everyday" },
  { id: "e2", what: "Spotify", category: "Subscriptions", account: "Credit Card" },
  { id: "e3", what: "Gas", category: "Utilities", account: "Everyday" }
];

test("a merchant key drops the store number and the suburb", function(){
  // Without this every Woolworths store is its own rule and the learning is worthless.
  assert.equal(merchantKey("WOOLWORTHS 1234 SYDNEY NS"), "woolworths");
  assert.equal(merchantKey("WOOLWORTHS 5567 NEWTOWN NSW AU"), "woolworths");
  assert.equal(merchantKey("COLES EXPRESS 5521"), "coles express");
});

test("a merchant key drops a leading payment rail, which names the pipe not the payee", function(){
  assert.equal(merchantKey("EFTPOS DEBIT WOOLWORTHS 1234"), "woolworths");
  assert.equal(merchantKey("VISA PURCHASE CAFE MILANO"), "cafe milano");
  // ...but never all of them: "DIRECT DEBIT" alone is the best name that row has.
  assert.equal(merchantKey("DIRECT DEBIT"), "debit");
  assert.notEqual(merchantKey("DIRECT DEBIT"), "");
});

test("a merchant key caps at three tokens — past that it's describing, not naming", function(){
  assert.equal(merchantKey("SALARY WOOLWORTHS GROUP LIMITED PAYROLL"), "salary woolworths group");
});

test("a description that is all reference codes still gets a key", function(){
  // Falling through to "" would leave the row unmatchable and unlearnable forever.
  assert.equal(merchantKey("X4402ZK 99120"), "x4402zk");
  assert.equal(merchantKey(""), "");
});

test("a taught rule places the same merchant next month", function(){
  // The whole point of the feature: the second import, not the first.
  var rules = [];
  learnRule(rules, "WOOLWORTHS 1234 SYDNEY NS", { linkedExpenseId: "e1", category: "Groceries" });
  assert.equal(rules.length, 1);
  assert.equal(rules[0].match, "woolworths");
  var next = suggestFor("WOOLWORTHS 5567 NEWTOWN NSW AU", rules, LINES);
  assert.equal(next.source, "rule");
  assert.equal(next.linkedExpenseId, "e1");
});

test("the longer rule wins, so a correction can override a rough earlier answer", function(){
  // There is no rule editor — overriding from the review screen is the only way to fix a mistake,
  // so specificity has to beat recency.
  var rules = [];
  learnRule(rules, "WOOLWORTHS 1234", { linkedExpenseId: "e1", category: "Groceries" });
  learnRule(rules, "WOOLWORTHS PETROL SYDNEY", { linkedExpenseId: "e3", category: "Car" });
  assert.equal(matchRule("WOOLWORTHS PETROL SYDNEY 99", rules).linkedExpenseId, "e3");
  assert.equal(matchRule("WOOLWORTHS 8899 BONDI", rules).linkedExpenseId, "e1");
});

test("re-teaching an existing merchant updates it rather than stacking a second rule", function(){
  var rules = [];
  learnRule(rules, "SPOTIFY P2B3C4", { linkedExpenseId: "e2", category: "Subscriptions" });
  learnRule(rules, "SPOTIFY AB99", { linkedExpenseId: "e1", category: "Groceries" });
  assert.equal(rules.length, 1, "one merchant, one rule");
  assert.equal(rules[0].linkedExpenseId, "e1", "the correction wins");
  assert.equal(rules[0].hits, 2);
});

test("an unassigned row teaches nothing", function(){
  // An empty rule would sit there matching future rows and filing them nowhere, which reads as the
  // app forgetting rather than as the app never having been told.
  var rules = [];
  learnRule(rules, "MYSTERY SHOP", { linkedExpenseId: null, category: "" });
  assert.equal(rules.length, 0);
});

test("budget line names carry the FIRST import, before any rule exists", function(){
  var hit = matchBudgetLineByName("SPOTIFY P2B3C4", LINES);
  assert.equal(hit.id, "e2");
  assert.equal(suggestFor("SPOTIFY P2B3C4", [], LINES).source, "name");
});

test("a short budget line name does not swallow unrelated merchants", function(){
  // "Gas" must not claim GASTRONOMY — a wrong suggestion accepted in bulk is worse than none. It's
  // whole-word matching that prevents it, not a length floor, which is why a 3-character line name
  // is still allowed to match the merchant it really does identify.
  assert.equal(matchBudgetLineByName("GASTRONOMY BAR SYDNEY", LINES), null);
  assert.equal(matchBudgetLineByName("ORIGIN GAS BILL", LINES).id, "e3");
  // Two characters is noise even as a whole word — "AU" appears in half the merchant strings in a
  // real export.
  assert.equal(matchBudgetLineByName("WOOLWORTHS SYDNEY AU", [{ id: "x", what: "AU" }]), null);
});

test("nothing matched means nothing suggested, not a guess", function(){
  var s = suggestFor("ZZQ TRADING 4421", [], LINES);
  assert.equal(s.source, null);
  assert.equal(s.linkedExpenseId, null);
});

test("a rule beats a name match, because the user taught it and the name is inference", function(){
  var rules = [];
  learnRule(rules, "SPOTIFY P2B3C4", { linkedExpenseId: "e1", category: "Groceries" });
  var s = suggestFor("SPOTIFY AB99", rules, LINES);
  assert.equal(s.source, "rule");
  assert.equal(s.linkedExpenseId, "e1", "not e2, which is what the line name alone would have said");
});

test("deleting a budget line doesn't leave rules filing spend against nothing", function(){
  var rules = [
    { id: "r1", match: "woolworths", linkedExpenseId: "e1", category: "Groceries" },
    { id: "r2", match: "spotify", linkedExpenseId: "deleted", category: "Subscriptions" },
    { id: "r3", match: "mystery", linkedExpenseId: "deleted", category: "" }
  ];
  var kept = pruneRules(rules, LINES);
  assert.equal(kept.length, 2);
  // The Spotify rule survives without its line, because the category half still works.
  var spotify = kept.find(function(r){ return r.match === "spotify"; });
  assert.equal(spotify.linkedExpenseId, null);
  assert.equal(spotify.category, "Subscriptions");
  // The one that carried nothing else is gone entirely.
  assert.equal(kept.find(function(r){ return r.match === "mystery"; }), undefined);
});

test("coverage counts what the import placed without asking", function(){
  var rules = [];
  learnRule(rules, "WOOLWORTHS 1234", { linkedExpenseId: "e1", category: "Groceries" });
  var rows = applySuggestions([
    { description: "WOOLWORTHS 5567 NEWTOWN" },
    { description: "SPOTIFY P2B3C4" },
    { description: "ZZQ TRADING 4421" },
    { description: "QQX 9910" }
  ], rules, LINES);
  var c = coverageOf(rows);
  assert.equal(c.total, 4);
  assert.equal(c.byRule, 1);
  assert.equal(c.byName, 1);
  assert.equal(c.placed, 2);
  assert.equal(c.fraction, 0.5);
});

test("coverage of an empty import is 0, not NaN", function(){
  assert.equal(coverageOf([]).fraction, 0);
  assert.equal(coverageOf(null).fraction, 0);
});

// ---------------- Proposing a budget line from an import ----------------

test("a merchant key becomes a readable budget line name", function(){
  assert.equal(suggestedLineName("woolworths"), "Woolworths");
  assert.equal(suggestedLineName("coles express"), "Coles Express");
  assert.equal(suggestedLineName(""), "");
});

test("the monthly rate divides by the months the IMPORT covers, not the months the merchant does", function(){
  // Shopping at Woolworths in two of the three months you imported is still a three-month average.
  // Dividing by two would overstate it by half — and this figure becomes a budget line the user
  // then plans against.
  var mine = [
    { date: "2026-07-04", amount: 100 },
    { date: "2026-09-02", amount: 200 }
  ];
  var allRows = mine.concat([{ date: "2026-08-15", amount: 50 }]);
  var rate = monthlyRateFrom(mine, allRows);
  assert.equal(rate.months, 3);
  assert.equal(rate.total, 300);
  assert.equal(rate.amount, 100);
  assert.equal(rate.transactions, 2);
});

test("a single-month import returns that month's spend, not a divide by zero", function(){
  var rows = [{ date: "2026-09-02", amount: 45.20 }, { date: "2026-09-15", amount: 31.40 }];
  var rate = monthlyRateFrom(rows, rows);
  assert.equal(rate.months, 1);
  assert.equal(rate.amount, 76.60);
});

test("an empty group proposes nothing rather than NaN", function(){
  var rate = monthlyRateFrom([], []);
  assert.equal(rate.amount, 0);
  assert.equal(rate.months, 0);
});

test("a proposed line carries the basis, so the screen can show its working", function(){
  // The amount is derived, not typed, so the user has to be able to see where it came from before
  // accepting it as a budget they'll plan against.
  var group = { key: "coles express", rows: [{ date: "2026-08-01", amount: 88.40 }], choice: { category: "Groceries" } };
  var line = proposedLineFor(group, group.rows);
  assert.equal(line.what, "Coles Express");
  assert.equal(line.amount, 88.40);
  assert.equal(line.freq, "Monthly");
  assert.equal(line.category, "Groceries");
  assert.equal(line.basis.transactions, 1);
  assert.equal(line.basis.months, 1);
});

test("trailing bookkeeping words are dropped, so a created line isn't called 'Rent Payment Ref'", function(){
  // Same reason leading rails are dropped: they name the paperwork, not the payee. This string
  // becomes a budget line the user reads in a list, so it has to survive being looked at.
  assert.equal(merchantKey("RENT PAYMENT REF 88213"), "rent payment");
  assert.equal(merchantKey("WOOLWORTHS SYDNEY NSW"), "woolworths sydney");
  assert.equal(suggestedLineName(merchantKey("RENT PAYMENT REF 88213")), "Rent Payment");
  // Never the last one standing — a row whose whole description is one noise word still needs a key.
  assert.equal(merchantKey("REF"), "ref");
});
