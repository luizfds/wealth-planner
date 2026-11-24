import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { purchaseFigures, settledProperty, purchaseFromPlan, purchasePlans, defaultPurchaseCosts, costAmount, purchaseStampDuty, costKind, costUnclassified, setCostPaid, payingAccounts } from "../src/calc/purchase.js";
import { state } from "../src/state.js";

// Invented figures throughout.
let seq = 0;
const genId = p => p + "-" + (++seq);

test("a home being bought: what's paid, what's still to pay, and the cash needed at settlement", function(){
  const p = { what: "1 Example St", price: 600000, deposit: 60000, loanAmount: 480000,
    costs: [{ what: "Conveyancer", amount: 1500, paid: true }, { what: "Building & pest", amount: 500, paid: true }, { what: "Loan fees", amount: 600, paid: false }],
    settlementDate: "2026-12-20" };
  const f = purchaseFigures(p, "2026-11-20", 50000);
  assert.equal(f.costsPaid, 2000);
  assert.equal(f.costsToPay, 600);
  // 600k less the 60k deposit and the 480k loan, plus the 600 still to pay.
  assert.equal(f.balanceAtSettlement, 60000);
  assert.equal(f.cashNeeded, 60600);
  assert.equal(f.short, 10600, "50k on hand is 10.6k short");
  assert.equal(f.paidSoFar, 62000);
  assert.equal(f.days, 30);
  assert.equal(Math.round(f.lvr * 100), 80);
  assert.equal(purchaseFigures(p, "2026-11-20", 100000).short, 0, "enough on hand is no shortfall");
  assert.equal(purchaseFigures({ price: "", costs: [] }, "2026-11-20", null).short, null, "no cash figure, no shortfall said");
  assert.equal(purchaseFigures({ price: 1, settlementDate: "" }, "2026-11-20").days, null);
});

test("stamp duty follows the price until one is typed", function(){
  const p = { price: 600000, stateCode: "NSW", costs: [] };
  const duty = purchaseStampDuty(p);
  assert.ok(duty > 0, "NSW duty on 600k");
  assert.equal(costAmount(p, { auto: true, amount: 0 }), duty);
  assert.equal(costAmount({ price: 600000, stateCode: "", costs: [] }, { auto: true, amount: 123 }), 123, "no state: what was typed");
  assert.equal(costAmount(p, { amount: -5 }), 0);
  assert.equal(defaultPurchaseCosts(genId).filter(c => c.auto).length, 1);
});

test("settled, it's an ordinary property: value and price the price, bought on settlement, costs and loan carried", function(){
  const p = { what: "1 Example St", kind: "PPOR", price: 600000, deposit: 60000, loanAmount: 480000, rate: 6, stateCode: "VIC", settlementDate: "2026-12-20",
    costs: [{ what: "Conveyancer", amount: 1500, paid: true }, { what: "Nothing yet", amount: 0, paid: false }] };
  const prop = settledProperty(p, "2026-12-21", genId);
  assert.equal(prop.kind, "PPOR");
  assert.equal(prop.value, 600000);
  assert.equal(prop.purchasePrice, 600000);
  assert.equal(prop.purchaseDate, "2026-12-20");
  assert.deepEqual(prop.acquisitionCosts.map(c => [c.what, c.amount]), [["Conveyancer", 1500]], "a cost of nothing isn't carried");
  assert.equal(prop.loans.length, 1);
  assert.deepEqual([prop.loans[0].balance, prop.loans[0].rate, prop.loans[0].settlementDate], [480000, 6, "2026-12-20"]);
  assert.deepEqual(prop.pmFee, { percent: 0, flat: 0 }, "a home has no property manager");
  assert.equal(settledProperty({ kind: "IP", price: 1 }, "2026-12-21", genId).kind, "IP");
  assert.equal(settledProperty({ price: 1 }, "2026-12-21", genId).purchaseDate, "2026-12-21", "no settlement date: the day it was marked");
  assert.equal(settledProperty({ price: 1 }, "2026-12-21", genId).loans.length, 0);
});

test("a scenario's purchase plan starts a purchase: price, deposit, loan, state and its cost estimates", function(){
  const plan = { enabled: true, price: 500000, depositPct: 10, rate: 6.2, state: "NSW", firstHomeBuyer: true,
    otherCosts: [{ what: "Conveyancing", amount: 1800 }, { what: "Nothing", amount: 0 }] };
  const f = purchaseFromPlan(plan, genId);
  assert.deepEqual([f.price, f.deposit, f.loanAmount, f.rate, f.stateCode, f.firstHome], [500000, 50000, 450000, 6.2, "NSW", true]);
  assert.deepEqual(f.costs.map(c => [c.what, c.amount, c.paid, !!c.auto]), [["Stamp duty", 0, false, true], ["Conveyancing", 1800, false, false]]);
  assert.deepEqual(purchasePlans({ purchase: { A: plan, B: { enabled: false, price: 1 }, C: { enabled: true, price: 0 } } }).map(x => x.name), ["A"]);
  assert.deepEqual(purchaseFromPlan(null, genId), {});
});

test("the deposit is held as an asset while it's being bought, and goes when it settles or is removed", async function(){
  const { addPurchase, syncDepositAsset, settlePurchase, removePurchase } = await import("../src/calc/purchase.js");
  const st = { assets: [{ id: "cash", what: "Everyday", category: "Cash", amount: 1000 }], properties: [], purchases: [] };
  const p = addPurchase(st, { what: "1 Example St", price: 600000, deposit: 60000, loanAmount: 480000 }, genId);
  assert.equal(st.purchases.length, 1);
  assert.ok(p.costs.length >= 3, "a new purchase starts with the usual costs");
  const held = st.assets.find(a => a.id === p.depositAssetId);
  assert.deepEqual([held.what, held.category, held.amount], ["Deposit held — 1 Example St", "Other", 60000]);
  p.deposit = 65000; p.what = "2 Sample Rd"; syncDepositAsset(st, p, genId);
  assert.deepEqual([st.assets.length, held.amount, held.what], [2, 65000, "Deposit held — 2 Sample Rd"], "kept in step, not added twice");
  p.deposit = ""; syncDepositAsset(st, p, genId);
  assert.equal(st.assets.length, 1, "no deposit, nothing held");
  p.deposit = 60000; syncDepositAsset(st, p, genId);
  const prop = settlePurchase(st, p, "2026-12-20", genId);
  assert.deepEqual([st.purchases.length, st.properties.length, st.assets.length], [0, 1, 1], "settled: a property, and the deposit's part of it now");
  assert.equal(prop.value, 600000);
  const q = addPurchase(st, { deposit: 1000 }, genId);
  removePurchase(st, q);
  assert.deepEqual([st.purchases.length, st.assets.length], [0, 1]);
});

test("a loan cost added to the loan is borrowed, not cash at settlement; at settlement it's in the balance and the borrowing costs", async function(){
  const { purchaseFigures, settledProperty, commonCostsToAdd, costKind } = await import("../src/calc/purchase.js");
  // Invented: a 10% deposit, its low-deposit fee added to the loan, a documentation fee in cash, one fee still to come.
  const p = { what: "1 Example St", price: 500000, deposit: 50000, loanAmount: 450000, settlementDate: "2026-12-20",
    costs: [{ what: "Conveyancer", amount: 1500, paid: true, kind: "purchase" },
      { what: "Low deposit fee / LMI", amount: 9000, kind: "loan", financed: true },
      { what: "Loan documentation fee", amount: 400, kind: "loan" },
      { what: "Settlement fee", amount: 0, kind: "loan", tbc: true }] };
  const f = purchaseFigures(p, "2026-11-20", 100000);
  assert.equal(f.financed, 9000);
  assert.equal(f.borrowed, 459000);
  assert.equal(f.costsToPay, 400, "the fee added to the loan isn't cash to find");
  assert.equal(f.cashNeeded, 400);
  assert.equal(f.toConfirm, 1);
  assert.equal(f.totalCost, 500000 + 1500 + 9000 + 400);
  assert.equal(Math.round(f.lvr * 1000) / 10, 91.8, "the loan-to-value counts what's added");
  let n = 0; const prop = settledProperty(p, "2026-12-21", k => k + (++n));
  assert.equal(prop.loans[0].balance, 459000);
  assert.equal(prop.loans[0].borrowingCosts, 9400);
  assert.deepEqual(prop.acquisitionCosts.map(c => c.what), ["Conveyancer"], "the loan's costs aren't acquisition costs");
  assert.deepEqual(commonCostsToAdd(p).map(c => c.what).slice(0, 2), ["Stamp duty", "Building & pest inspection"]);
  // November 2026: a suggestion isn't offered beside the same cost under another name.
  const named = { costs: [{ what: "Conveyancing / Legal Fees" }, { what: "Mortgage, transfer and discharge registration" }, { what: "Low Deposit Fee (LDF or LMI)" }] };
  const offered = commonCostsToAdd(named).map(c => c.what);
  ["Conveyancer", "Transfer registration", "Mortgage registration", "Low deposit fee / LMI"].forEach(w => assert.ok(!offered.includes(w), w + " offered beside its other name"));
  assert.ok(offered.includes("Stamp duty") && offered.includes("Loan documentation fee"));
  assert.equal(costKind({ what: "Mortgage registration" }), "loan");
  assert.equal(costKind({ what: "Building & pest inspection" }), "purchase");
});

// #452: the lender's figures. Invented figures (never a real offer's): a gross approved loan with a low deposit fee added
// to it, two charges the lender keeps out of the money it releases, a cost still to pay and one paid.
test("settlement against the lender: gross less what it keeps is what it releases; a fee added to the loan is in it once", function(){
  var p = { price: 1000000, deposit: 100000, loanAmount: 885000, grossLoan: 900000, lenderSource: "offer", costs: [
    { id: "a", what: "Low deposit fee", amount: 15000, kind: "loan", financed: true },
    { id: "b", what: "Mortgage registration", amount: 210.40, kind: "loan", withheld: true },
    { id: "c", what: "Settlement fee", amount: 3040, kind: "loan", withheld: true },
    { id: "d", what: "Transfer registration", amount: 2000, kind: "purchase" },
    { id: "e", what: "Conveyancer", amount: 1500, kind: "purchase", paid: true }
  ] };
  var f = purchaseFigures(p, "2026-11-20", null);
  assert.equal(f.borrowed, 900000, "the lender's gross, the fee not added a second time");
  assert.equal(Math.round(f.withheld * 100) / 100, 18250.40);
  assert.equal(Math.round(f.released * 100) / 100, 881749.60);
  // Price − deposit − what's released + costs still to pay; the paid one isn't in it.
  assert.equal(Math.round(f.cashNeeded * 100) / 100, 20250.40);
  assert.equal(f.costsToPay, 2000);
  assert.deepEqual(f.lender, { gross: 900000, own: 900000, variance: 0, source: "offer" });
  // The same fee paid in cash instead: the lender's gross no longer matches the loan and what's added — said.
  var cash = purchaseFigures(Object.assign({}, p, { costs: p.costs.map(function(c){ return c.id === "a" ? Object.assign({}, c, { financed: false }) : c; }) }), "2026-11-20", null);
  assert.equal(cash.lender.variance, 15000);
  assert.equal(cash.costsToPay, 17000, "paid in cash, it's cash to bring");
  // The property it becomes owes the gross, once.
  var prop = settledProperty(p, "2026-11-20", function(x){ return x; });
  assert.equal(prop.loans[0].balance, 900000);
});

test("an old purchase, with no lender figure and nothing withheld, adds up as it always did", function(){
  var f = purchaseFigures({ price: 600000, deposit: 60000, loanAmount: 480000, costs: [{ id: "c1", what: "Conveyancer", amount: 1500, paid: true }, { id: "c2", what: "Loan fees", amount: 600 }] }, "2026-11-20", null);
  assert.equal(f.cashNeeded, 60600);
  assert.equal(f.borrowed, 480000);
  assert.equal(f.released, 480000);
  assert.equal(f.lender, null);
});

test("each charge says what it's for; one whose name doesn't say is flagged until it's chosen", function(){
  assert.equal(costKind({ what: "Discharge fee" }), "loan");
  assert.equal(costKind({ what: "Transfer registration" }), "purchase");
  assert.equal(costUnclassified({ what: "Discharge fee" }), false);
  assert.equal(costUnclassified({ what: "Transfer registration" }), false);
  assert.equal(costUnclassified({ what: "Sundry charge" }), true);
  assert.equal(costUnclassified({ what: "Sundry charge", kind: "purchase" }), false, "chosen");
  assert.equal(purchaseFigures({ price: 1, costs: [{ id: "x", what: "Sundry charge", amount: 50 }] }, "2026-11-20", null).unclassified, 1);
});

test("a cost paid from an account comes off its balance, and goes back if it's unticked or paid from another", function(){
  var keep = { accounts: state.accounts, assets: state.assets };
  try {
    state.assets = [{ id: "s1", what: "Saver", category: "Cash", amount: 50000, history: [] }, { id: "s2", what: "Everyday", category: "Cash", amount: 4000, history: [] }];
    state.accounts = [{ id: "a1", name: "Saver", type: "savings", link: "asset:s1" }, { id: "a2", name: "Everyday", type: "everyday", link: "asset:s2" }];
    var p = { costs: [] }, c = { id: "c", what: "Conveyancer", amount: 1500 };
    setCostPaid(state, p, c, true, "a1", "2026-11-20");
    assert.equal(state.assets[0].amount, 48500);
    assert.equal(c.paidTaken, 1500);
    setCostPaid(state, p, c, true, "a2", "2026-11-20");
    assert.deepEqual([state.assets[0].amount, state.assets[1].amount], [50000, 2500], "moved to the other account");
    setCostPaid(state, p, c, false, undefined, "2026-11-20");
    assert.deepEqual([state.assets[0].amount, state.assets[1].amount, c.paid, c.paidTaken], [50000, 4000, false, undefined]);
    assert.deepEqual(payingAccounts(state).map(function(a){ return [a.name, a.balance]; }), [["Saver", 50000], ["Everyday", 4000]]);
  } finally { Object.assign(state, keep); }
});
