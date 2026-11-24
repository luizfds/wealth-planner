import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { propertyTargets, propertyOf, isPropertyMoney, purchaseFromTransactions, linkTransaction, linkEffect, propertySuggestions, lineSuggestions,
  setLineProperty, moveToProperty, settlementCheck, costTransactions, propertyYear, spendingTransactions } from "../src/calc/propertymoney.js";

// Invented household: buying 1 Example St (a home), owning 2 Sample Rd (an investment).
function household(){
  return {
    purchases: [{ id: "buy1", what: "1 Example St", kind: "PPOR", price: 800000, deposit: 60000, contractDate: "2026-10-01", settlementDate: "2027-01-15",
      costs: [{ id: "bp", what: "Building & pest inspection", amount: 0, kind: "purchase" }, { id: "conv", what: "Conveyancer", amount: 0, kind: "purchase" },
        { id: "lf", what: "Loan fees", amount: 600, kind: "loan", financed: true }] }],
    properties: [{ id: "ip1", what: "2 Sample Rd", kind: "IP", expenses: [{ id: "rep", what: "Repairs", amount: 500, freq: "Yearly" }, { id: "rates", what: "Council rates", amount: 250, freq: "Quarterly" }] }],
    shared: [{ id: "groc", what: "Groceries", amount: 200, freq: "Weekly" }, { id: "hr", what: "Council rates", amount: 500, freq: "Quarterly" }, { id: "rent", what: "Rent", amount: 1800, freq: "Monthly" }],
    transactions: [
      { id: "t1", date: "2026-11-09", amount: 500, what: "Building & pest report", account: "Card A" },
      { id: "t2", date: "2026-11-18", amount: 58000, what: "House deposit", account: "Offset" },
      { id: "t3", date: "2026-11-20", amount: 600, what: "EXAMPLE LAWYERS TRUST", account: "Everyday" },
      { id: "t4", date: "2026-10-02", amount: 300, what: "FIXIT PLUMBING", linkedExpenseId: "rep" },
      { id: "t5", date: "2026-10-20", amount: 200, what: "FIXIT PLUMBING", linkedExpenseId: "rep" },
      { id: "t6", date: "2026-11-09", amount: 300, what: "FIXIT PLUMBING", linkedExpenseId: "groc" },
      { id: "t7", date: "2026-11-10", amount: 184, what: "Shop One", linkedExpenseId: "groc" }
    ],
    incomeLog: []
  };
}

test("every property a dollar can be for: a purchase in progress, a home, an investment", function(){
  var st = household();
  st.properties.push({ id: "home2", what: "3 Sold Ln", kind: "PPOR", soldDate: "2025-01-01" });
  var t = propertyTargets(st);
  assert.deepEqual(t.map(x => [x.id, x.kind, x.home]), [["buy1", "purchase", true], ["ip1", "investment", false]], "a sold property isn't offered");
  assert.match(t[0].sub, /Your home · buying, settles 15 Jan/);
});

test("linking a purchase's cost: it reads as the property's, its cost is paid from the transaction, and undo puts it back", function(){
  var st = household(), t = st.transactions[0];
  var undo = linkTransaction(st, t, { type: "purchase", id: "buy1", cost: "bp" });
  assert.deepEqual([t.forProperty, t.forCost, t.linkedExpenseId], ["buy1", "bp", null]);
  var o = propertyOf(t, st);
  assert.deepEqual([o.name, o.kind, o.what, o.capital], ["1 Example St", "purchase", "Building & pest inspection", true]);
  assert.ok(isPropertyMoney(t, st), "kept out of spending");
  var f = purchaseFromTransactions(st, st.purchases[0]);
  var bp = f.purchase.costs.find(c => c.id === "bp");
  assert.deepEqual([bp.paid, bp.amount, bp.byTx, f.count, f.paidByTx], [true, 500, 1, 1, 500]);
  assert.equal(st.purchases[0].costs[0].paid, undefined, "the stored cost isn't changed");
  undo();
  assert.ok(!("forProperty" in t) && !("forCost" in t));
  assert.equal(propertyOf(t, st), null);
});

test("a new cost from a transaction; a hand-ticked cost's account balance given back", function(){
  var st = household(), t = st.transactions[2];
  var undo = linkTransaction(st, t, { type: "purchase", id: "buy1", cost: "new" }, { genId: () => "pcNew" });
  assert.equal(st.purchases[0].costs.at(-1).what, "EXAMPLE LAWYERS TRUST");
  assert.equal(t.forCost, "pcNew");
  undo();
  assert.equal(st.purchases[0].costs.length, 3);
  // Ticked Paid by hand from an account earlier: the bank's transaction says it now, so the balance goes back.
  st.purchases[0].costs[1].paid = true; st.purchases[0].costs[1].paidTaken = 600; st.purchases[0].costs[1].paidFrom = "acc1";
  var gave = [];
  linkTransaction(st, t, { type: "purchase", id: "buy1", cost: "conv" }, { giveBack: (p, c) => { gave.push(c.id); delete c.paidTaken; } });
  assert.deepEqual(gave, ["conv"]);
  assert.match(linkEffect(st, st.transactions[0], { type: "purchase", id: "buy1", cost: "conv" }).lines[0][1], /Conveyancer already has 1 transaction \(20 Nov\)/);
});

test("an investment's line or none; a household line for a home stays spending", function(){
  var st = household();
  var o = propertyOf(st.transactions[3], st);
  assert.deepEqual([o.name, o.kind, o.what, o.capital], ["2 Sample Rd", "investment", "Repairs", true]);
  linkTransaction(st, st.transactions[6], { type: "property", id: "ip1" });
  assert.equal(propertyOf(st.transactions[6], st).what, "Other cost");
  st.properties.push({ id: "home1", what: "1 Home Rd", kind: "PPOR" });
  setLineProperty(st, st.shared[1], "home1");
  var rates = { id: "r", date: "2026-11-01", amount: 500, linkedExpenseId: "hr" };
  st.transactions.push(rates);
  assert.deepEqual([propertyOf(rates, st).name, isPropertyMoney(rates, st)], ["1 Home Rd", false], "a home's rates are household spending");
});

test("a line for an investment is the property's and claimable; for a home, it isn't; undo restores", function(){
  var st = household(), line = st.shared[1];
  var undo = setLineProperty(st, line, "ip1");
  assert.deepEqual([line.propertyId, line.claimProperty, line.deductible], ["ip1", "ip1", true]);
  undo();
  assert.ok(!("propertyId" in line) && !("claimProperty" in line));
  setLineProperty(st, line, "buy1");
  assert.deepEqual([line.propertyId, line.claimProperty], ["buy1", undefined]);
  setLineProperty(st, line, "");
  assert.ok(!("propertyId" in line));
});

test("the app suggests a link: a purchase word in the purchase's dates, the address, a shop seen at an investment", function(){
  var st = household();
  var s = propertySuggestions(st, "2026-11-23", {});
  var by = {}; s.forEach(x => { by[x.t.id] = x; });
  assert.deepEqual([by.t1.to.id, by.t1.cost], ["buy1", "bp"]);
  assert.deepEqual([by.t2.to.id, by.t2.cost], ["buy1", "deposit"]);
  assert.deepEqual([by.t3.to.id, by.t3.cost], ["buy1", "conv"]);
  assert.deepEqual([by.t6.to.id, by.t6.lineId, by.t6.now], ["ip1", "rep", "Groceries line"], "the plumber's third visit, filed on Groceries");
  assert.match(by.t6.why, /linked to 2 Sample Rd 2 times before/);
  assert.equal(by.t7, undefined, "an ordinary shop isn't asked about");
  assert.equal(by.t4, undefined, "already an investment's");
  assert.equal(propertySuggestions(st, "2026-11-23", { "inbox:prop|t1": true }).some(x => x.t.id === "t1"), false, "a no is remembered");
  // Outside the purchase's dates, a "deposit" is just a word.
  st.transactions.push({ id: "old", date: "2026-03-01", amount: 100, what: "Bond deposit" });
  assert.equal(propertySuggestions(st, "2026-11-23", {}).some(x => x.t.id === "old"), false);
});

test("a rates line with a home and an investment is asked about once", function(){
  var st = household();
  var s = lineSuggestions(st, {});
  assert.deepEqual(s.map(x => [x.line.id, x.home.id, x.investment.id]), [["hr", "buy1", "ip1"]]);
  assert.deepEqual(lineSuggestions(st, { "inbox:propline|hr": true }), []);
  assert.deepEqual(lineSuggestions({ shared: st.shared, purchases: st.purchases }, {}), [], "one property: nothing to choose between");
});

test("settlement: the costs as the transactions say, and the transactions move to the new property", function(){
  var st = household();
  linkTransaction(st, st.transactions[0], { type: "purchase", id: "buy1", cost: "bp" });
  linkTransaction(st, st.transactions[1], { type: "purchase", id: "buy1", cost: "deposit" });
  var c = settlementCheck(st, st.purchases[0]);
  assert.deepEqual(c.rows.map(r => [r.what, r.amount, r.note]), [["Building & pest inspection", 500, "1 transaction · 9 Nov"], ["Conveyancer", null, "no transaction yet"]]);
  assert.equal(c.txs.length, 2);
  setLineProperty(st, st.shared[1], "buy1");
  var undo = moveToProperty(st, "buy1", "newp");
  assert.deepEqual(st.transactions.slice(0, 2).map(t => [t.forProperty, t.forWhat]), [["newp", "Building & pest inspection"], ["newp", "Deposit"]]);
  assert.equal(st.shared[1].propertyId, "newp");
  st.properties.push({ id: "newp", what: "1 Example St", kind: "PPOR" });
  assert.deepEqual([propertyOf(st.transactions[1], st).what, isPropertyMoney(st.transactions[1], st)], ["Deposit", true], "a deposit stays the property's after it settles");
  undo();
  assert.deepEqual([st.transactions[1].forProperty, "forWhat" in st.transactions[1]], ["buy1", false]);
  assert.equal(costTransactions(st, "buy1", "deposit").length, 1);
});

test("a property's year: its transactions and lines", function(){
  var st = household();
  var y = propertyYear(st, "ip1", { start: "2026-07-01", end: "2027-06-30" }, { planOf: l => l.id === "rep" ? 500 : 1000 });
  assert.equal(y.txs.length, 2);
  assert.equal(y.spent, 500);
  assert.deepEqual(y.lines.map(l => [l.what, l.planYear, l.spent]), [["Repairs", 500, 500], ["Council rates", 1000, 0]]);
});

test("a house deposit isn't the month's spending: spendingTransactions leaves a purchase's money out, Today's month too", async function(){
  const st = household();
  const deposit = st.transactions.find(t => t.id === "t2");
  deposit.forProperty = "buy1"; deposit.forCost = "deposit";
  const ids = spendingTransactions(st).map(t => t.id);
  assert.ok(!ids.includes("t2"), "the deposit is the purchase's");
  assert.ok(ids.includes("t6") && ids.includes("t7"), "groceries are still spending");
  assert.ok(!ids.includes("t4"), "an investment's line is the property's too");
  // Today's month (calc/monthreview.js): November's spending is the groceries, not the deposit.
  const { state } = await import("../src/state.js");
  const { monthReview } = await import("../src/calc/monthreview.js");
  const keep = {};
  ["transactions", "purchases", "properties", "shared", "incomeLog"].forEach(k => { keep[k] = state[k]; state[k] = st[k]; });
  try {
    const r = monthReview("2026-11", { items: st.shared, today: "2026-11-24" });
    assert.equal(r.spent, 500 + 600 + 300 + 184, "the report and the lawyer's trust account, not linked, still count; the deposit doesn't");
  } finally { Object.assign(state, keep); }
});
