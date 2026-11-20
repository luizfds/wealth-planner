// Adding one question at a time (November 2026): the order of the questions, the line under a figure, and the record
// the answers make. calc/addflow.js — no DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { flowSteps, stepNeeds, stepSkippable, liveLine, repaymentEstimate, suggestedLoan, propertyFromAnswers,
  addPropertyFromAnswers, addPurchaseFromAnswers, addAccountFromAnswers } from "../src/calc/addflow.js";

var n = 0;
var genId = function(p){ return p + "-" + (++n); };
var fmt = function(x){ return "$" + Math.round(x).toLocaleString("en-AU"); };

test("a property's questions: the loan's three only when there is one; buying its own", function(){
  assert.deepEqual(flowSteps("property", {}), ["kind", "name", "bought", "value", "hasLoan", "check"]);
  assert.deepEqual(flowSteps("property", { kind: "PPOR", hasLoan: true }),
    ["kind", "name", "bought", "value", "hasLoan", "loanBalance", "loanRate", "loanRepay", "check"]);
  assert.deepEqual(flowSteps("property", { kind: "IP", hasLoan: false }), ["kind", "name", "bought", "value", "hasLoan", "check"]);
  assert.deepEqual(flowSteps("property", { kind: "buying" }), ["kind", "name", "use", "priceDeposit", "settlement", "buyLoan", "check"]);
});

test("an account's questions: an offset asks which loan", function(){
  assert.deepEqual(flowSteps("account", { kind: "savings" }), ["kind", "name", "balance"]);
  assert.deepEqual(flowSteps("account", { kind: "offset" }), ["kind", "name", "loan", "balance"]);
});

test("only a kind and a name have to be answered (and an offset's loan, and yes or no to a loan)", function(){
  assert.match(stepNeeds("property", "kind", {}), /Choose/);
  assert.equal(stepNeeds("property", "kind", { kind: "IP" }), "");
  assert.match(stepNeeds("property", "name", { name: "  " }), /name/);
  assert.equal(stepNeeds("property", "name", { name: "1 Example St" }), "");
  assert.match(stepNeeds("account", "loan", {}), /loan/);
  assert.match(stepNeeds("property", "hasLoan", {}), /Yes or No/);
  assert.equal(stepNeeds("property", "hasLoan", { hasLoan: false }), "");
  assert.equal(stepNeeds("property", "value", {}), "");
  assert.ok(stepSkippable("bought") && stepSkippable("value") && !stepSkippable("name") && !stepSkippable("kind"));
});

test("the line under a figure says what it means", function(){
  assert.equal(liveLine("value", { price: "500,000", value: "600000" }, fmt), "Worth $100,000 more than you paid — 20%.");
  assert.equal(liveLine("value", { price: 500000, value: 450000 }, fmt), "Worth $50,000 less than you paid — 10%.");
  assert.equal(liveLine("value", { value: 450000 }, fmt), "", "nothing paid, nothing to compare");
  assert.equal(liveLine("loanBalance", { balance: "$300,000", value: 500000 }, fmt), "60% of what it's worth.");
  assert.equal(liveLine("priceDeposit", { price: 640000, deposit: 64000 }, fmt), "10% down — a loan of about $576,000.");
  assert.equal(liveLine("buyLoan", { price: 640000, loanAmount: 576000 }, fmt), "90% of the price.");
  assert.match(liveLine("loanRepay", { balance: 300000, rate: 6, termYears: 30 }, fmt), /^About \$1,799 a month\.$/);
  assert.match(liveLine("loanRepay", { balance: 300000, rate: 6, repaymentType: "IO" }, fmt), /^About \$1,500 a month, all interest\.$/);
  assert.equal(repaymentEstimate({ balance: 300000 }), 0, "no rate, no estimate");
  assert.equal(suggestedLoan({ price: 640000, deposit: 64000 }), 576000);
});

test("a home owned, with its loan", function(){
  var p = propertyFromAnswers({ kind: "PPOR", name: " 1 Example St ", price: "720,000", bought: "2021-03-15", value: "850,000",
    hasLoan: true, balance: "512,000", rate: "6.04", repaymentType: "PI", termYears: "26", freq: "Fortnightly" }, genId);
  assert.equal(p.what, "1 Example St");
  assert.equal(p.kind, "PPOR");
  assert.deepEqual([p.value, p.purchasePrice, p.purchaseDate], [850000, 720000, "2021-03-15"]);
  assert.equal(p.loans.length, 1);
  var l = p.loans[0];
  assert.deepEqual([l.balance, l.rate, l.termYears, l.repaymentType, l.repaymentMode, l.manualRepaymentFreq, l.what], [512000, 6.04, 26, "PI", "auto", "Fortnightly", "Home loan"]);
  assert.deepEqual(p.pmFee, { percent: 0, flat: 0 });
});

test("an investment with no loan, its value left for later: what was paid", function(){
  var p = propertyFromAnswers({ kind: "IP", name: "2 Sample Rd", price: 400000, hasLoan: false }, genId);
  assert.equal(p.kind, "IP");
  assert.equal(p.value, 400000);
  assert.deepEqual(p.loans, []);
  assert.deepEqual(p.pmFee, { percent: 6, flat: 5.5 });
  var st = { properties: [] };
  assert.equal(addPropertyFromAnswers(st, { kind: "PPOR", name: "Home" }, genId), st.properties[0]);
  assert.equal(st.properties[0].purchasePrice, null);
});

test("a home being bought: a purchase, its loan the price less the deposit unless one's given, a plan underneath", function(){
  var st = { purchases: [], assets: [], purchase: { "Buy a house": { enabled: true, price: 500000, depositPct: 20, rate: 6, state: "VIC", otherCosts: [] } } };
  var p = addPurchaseFromAnswers(st, { kind: "buying", name: "3 Example Ave", use: "IP", price: "640,000", deposit: "64,000", settlementDate: "2027-02-12", rate: "5.89" }, genId);
  assert.deepEqual([p.what, p.kind, p.price, p.deposit, p.loanAmount, p.rate, p.settlementDate], ["3 Example Ave", "IP", 640000, 64000, 576000, 5.89, "2027-02-12"]);
  assert.ok(p.costs.length > 0, "the usual costs to start its list");
  assert.equal(st.assets.length, 1, "its deposit held");
  var q = addPurchaseFromAnswers(st, { kind: "buying", name: "Plan home", plan: "Buy a house", loanAmount: "390,000" }, genId);
  assert.deepEqual([q.price, q.deposit, q.loanAmount, q.rate, q.stateCode], [500000, 100000, 390000, 6, "VIC"]);
});

test("an account: its balance where it's kept — a savings account's Cash asset, a card's debt, an offset on its loan", function(){
  var keep = { accounts: state.accounts, assets: state.assets, debts: state.debts, properties: state.properties };
  try {
    state.accounts = []; state.assets = []; state.debts = [];
    state.properties = [{ id: "p1", what: "Home", loans: [{ id: "l1", balance: 400000, offsetBalance: 0 }] }];
    var s = addAccountFromAnswers(state, { kind: "savings", name: "Bank One Saver", balance: "12,500" }, genId, "2026-11-20");
    assert.equal(s.type, "savings");
    assert.match(s.link, /^asset:/);
    assert.equal(state.assets[0].amount, 12500);
    var c = addAccountFromAnswers(state, { kind: "credit", name: "Card", balance: "1,200.50" }, genId, "2026-11-20");
    assert.match(c.link, /^debt:/);
    assert.equal(state.debts[0].balance, 1200.5);
    var o = addAccountFromAnswers(state, { kind: "offset", name: "Offset", loanId: "l1", balance: "30000" }, genId, "2026-11-20");
    assert.equal(o.link, "offset:l1");
    assert.equal(state.properties[0].loans[0].offsetBalance, 30000);
    var e = addAccountFromAnswers(state, { kind: "everyday", name: "Bank One Everyday" }, genId, "2026-11-20");
    assert.equal(e.link, "", "no balance given, nothing made for it");
  } finally { Object.assign(state, keep); }
});
