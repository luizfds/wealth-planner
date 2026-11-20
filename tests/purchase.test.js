import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { purchaseFigures, settledProperty, purchaseFromPlan, purchasePlans, defaultPurchaseCosts, costAmount, purchaseStampDuty } from "../src/calc/purchase.js";

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
