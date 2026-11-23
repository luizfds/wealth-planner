import { test } from "node:test";
import assert from "node:assert/strict";
import { strays, strayCountByLine, lineMerchants, mixedLines, merchantIdentity, moveTransactions, setTransactionsClass, undoChanges, teachRules, newLineFor, markTidyOk, tidyMove } from "../src/calc/tidy.js";
import { transactionClass } from "../src/calc/ledger.js";
import { matchRule } from "../src/calc/import-rules.js";
import { integrityChecks } from "../src/calc/integrity.js";

const TODAY = "2026-11-15";
const LINES = [
  { id: "pet", what: "Biscuit", category: "Pets", classification: "Needs", amount: 100, freq: "Monthly" },
  { id: "groc", what: "Groceries", category: "Groceries", classification: "Needs", amount: 600, freq: "Monthly" },
  { id: "drinks", what: "Drinks", category: "Eating out", classification: "Wants", amount: 60, freq: "Monthly" },
  { id: "home", what: "Home & garden", category: "Home", classification: "Wants", amount: 50, freq: "Monthly" },
  { id: "trip", what: "Trips", category: "Travel", classification: "Wants", amount: 200, freq: "Monthly" },
  { id: "club", what: "Shop One membership", category: "Shopping", classification: "Wants", amount: 5, freq: "Monthly" }
];
let n = 0;
const tx = (line, what, amount, date, extra) => Object.assign({ id: "t" + (++n), date: date || "2026-10-0" + (1 + (n % 9)), what, amount, linkedExpenseId: line }, extra || {});
function household(){
  n = 0;
  return [
    ...["PETSHOP ONE EXAMPLE TOWN", "Petshop One", "PETSHOP ONE NORTHSIDE", "Petshop One"].map(w => tx("pet", w, 40)),
    tx("pet", "HARDWARE CO EXAMPLE TOWN", 30),
    ...[1, 2, 3, 4, 5].map(() => tx("home", "HARDWARE CO EXAMPLE TOWN", 25)),
    ...[1, 2, 3, 4, 5, 6].map(() => tx("drinks", "BOTTLE SHOP 1234 EXAMPLE TOWN", 20)),
    tx("groc", "BOTTLE SHOP 1234 EXAMPLE TOWN", 35),
    ...[1, 2, 3, 4, 5, 6].map(() => tx("groc", "Shop One", 80)),
    tx("club", "Shop One", 5)
  ];
}

test("merchantIdentity: the bank's words over a typed note, branches of one shop agree", () => {
  assert.equal(merchantIdentity({ what: "Toys for the dog", bankWhat: "PETSHOP ONE EXAMPLE TOWN" }).key.split(" ")[0], "petshop");
  assert.equal(merchantIdentity({ what: "Fern Café" }).key, "fern cafe");
  assert.equal(merchantIdentity({ what: "  " }), null);
});

test("strays: one or two purchases off the line a shop is nearly always on", () => {
  const list = strays(household(), LINES, { today: TODAY });
  const said = list.map(s => [s.fromLineId, s.toLineId, s.count]).sort();
  assert.deepEqual(said, [["groc", "drinks", 1], ["pet", "home", 1]]);
  const hw = list.find(s => s.fromLineId === "pet");
  assert.equal(hw.mainCount, 5);
  assert.equal(hw.total, 30);
  assert.deepEqual(strayCountByLine(list), { groc: 1, pet: 1 });
});

test("strays: never a line named for the shop, a split part, a trip's own spending, or a pair someone kept", () => {
  const base = household();
  // "Shop One membership" beside the Shop One groceries is on purpose.
  assert.ok(!strays(base, LINES, { today: TODAY }).some(s => s.fromLineId === "club"));
  const split = base.map(t => t.linkedExpenseId === "pet" && /HARDWARE/.test(t.what) ? Object.assign({}, t, { splitGroup: "s1" }) : t);
  assert.ok(!strays(split, LINES, { today: TODAY }).some(s => s.fromLineId === "pet"));
  const onTrip = base.concat([tx("trip", "BOTTLE SHOP 1234 EXAMPLE TOWN", 15, "2026-10-20")]);
  assert.ok(strays(onTrip, LINES, { today: TODAY }).some(s => s.fromLineId === "trip"));
  assert.ok(!strays(onTrip, LINES, { today: TODAY, trips: [{ from: "2026-10-19", to: "2026-10-22", lineId: "trip" }] }).some(s => s.fromLineId === "trip"));
  const first = strays(base, LINES, { today: TODAY })[0];
  const ok = {}; ok[first.id] = true;
  assert.ok(!strays(base, LINES, { today: TODAY, ok }).some(s => s.id === first.id));
});

test("strays: a shop split across lines is not a slip, and nothing outside the last year counts", () => {
  n = 100;
  const even = [1, 2, 3].map(() => tx("groc", "Shop One", 50)).concat([1, 2].map(() => tx("drinks", "Shop One", 20)));
  assert.deepEqual(strays(even, LINES, { today: TODAY }), []);
  const old = household().map(t => Object.assign({}, t, { date: "2024-01-05" }));
  assert.deepEqual(strays(old, LINES, { today: TODAY }), []);
});

test("lineMerchants: a line's last year by shop, parts adding up to the line, own Needs/Wants counted", () => {
  const txs = household();
  txs.push(tx("pet", "", 12));
  txs[1].classification = "Wants";
  const g = lineMerchants(txs, "pet", { today: TODAY });
  assert.equal(g[0].count, 4);
  assert.equal(g[0].wants, 1);
  assert.equal(g[g.length - 1].key, "");
  const total = txs.filter(t => t.linkedExpenseId === "pet").reduce((s, t) => s + t.amount, 0);
  assert.equal(g.reduce((s, x) => s + x.total, 0), total);
  assert.deepEqual(mixedLines(txs, LINES, { today: TODAY }), []);
});

test("transactionClass: the purchase's own Needs or Wants wins, else its line's", () => {
  assert.equal(transactionClass({ classification: "Wants" }, LINES[0]), "Wants");
  assert.equal(transactionClass({}, LINES[0]), "Needs");
  assert.equal(transactionClass({ classification: "Savings" }, LINES[2]), "Wants");
  assert.equal(transactionClass({}, null), "Other");
  assert.equal(transactionClass({}, { classification: "N/A" }), "Other");
});

test("move, Needs/Wants and undo put everything back as it was", () => {
  const txs = household();
  const ids = [txs[0].id, txs[1].id];
  txs[0].reviewed = false;
  const u1 = moveTransactions(txs, ids, "home");
  assert.deepEqual([txs[0].linkedExpenseId, txs[0].reviewed, txs[1].linkedExpenseId], ["home", true, "home"]);
  const u2 = setTransactionsClass(txs, ids, "Wants");
  assert.equal(txs[0].classification, "Wants");
  undoChanges(u2); undoChanges(u1);
  assert.deepEqual([txs[0].linkedExpenseId, txs[0].reviewed, "classification" in txs[0]], ["pet", false, false]);
  setTransactionsClass(txs, ids, "Wants");
  setTransactionsClass(txs, ids, "");
  assert.ok(!("classification" in txs[0]));
});

test("teachRules: the next statement files the shop on the new line", () => {
  const txs = household(), rules = [{ id: "r0", match: "hardware co example", linkedExpenseId: "home", category: "", account: "", hits: 4 }];
  const ids = txs.filter(t => t.linkedExpenseId === "pet" && /PETSHOP/i.test(t.what)).map(t => t.id);
  const k = teachRules(rules, txs, ids, "groc", () => "r" + rules.length);
  assert.ok(k >= 1);
  assert.equal(matchRule("PETSHOP ONE EXAMPLE TOWN", rules).linkedExpenseId, "groc");
  assert.equal(matchRule("HARDWARE CO EXAMPLE TOWN", rules).linkedExpenseId, "home");
});

test("tidyMove to a new line: planned at what moved a month, undo removes it and the rules taught", () => {
  const st = { transactions: household(), shared: LINES.map(l => Object.assign({}, l)), importRules: [] };
  const ids = st.transactions.filter(t => t.linkedExpenseId === "pet" && /PETSHOP/i.test(t.what)).map(t => t.id);
  const r = tidyMove(st, ids, null, { newLine: { source: st.shared[0], what: "Biscuit – treats", cls: "Wants", months: 12, id: "new1" }, teach: true, idFactory: () => "rx" });
  assert.equal(r.lineId, "new1");
  assert.deepEqual([r.made.what, r.made.classification, r.made.category, r.made.amount, r.made.freq], ["Biscuit – treats", "Wants", "Pets", 13, "Monthly"]);
  assert.equal(st.transactions.filter(t => t.linkedExpenseId === "new1").length, 4);
  assert.ok(st.importRules.length >= 1);
  r.undo();
  assert.ok(!st.shared.some(l => l.id === "new1"));
  assert.equal(st.importRules.length, 0);
  assert.equal(st.transactions.filter(t => t.linkedExpenseId === "pet").length, 5);
  assert.equal(newLineFor(null, "", "", 0, 12, "x").what, "New line");
});

test("markTidyOk keeps a pair quiet, and its undo brings it back", () => {
  const st = {};
  const undo = markTidyOk(st, "bottle shop|groc");
  assert.deepEqual(st.tidyOk, { "bottle shop|groc": true });
  undo();
  assert.deepEqual(st.tidyOk, {});
});

test("Checks: purchases that look misfiled, with a fix, gone once they're kept", () => {
  const st = { shared: LINES, transactions: household(), tidyOk: {} };
  const c = integrityChecks(st, TODAY).find(x => x.id === "int-misfiled");
  assert.ok(c && /2 purchases/.test(c.title) && c.fix.kind === "tidy-strays");
  strays(st.transactions, LINES, { today: TODAY }).forEach(s => { st.tidyOk[s.id] = true; });
  assert.ok(!integrityChecks(st, TODAY).some(x => x.id === "int-misfiled"));
});
