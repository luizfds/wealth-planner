// #453: records that disagree with each other (calc/integrity.js). Invented fixtures only.
import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { integrityChecks } from "../src/calc/integrity.js";

const TODAY = "2026-11-20";
function withState(fields, fn){
  const keys = ["income", "properties", "purchases", "purchase", "accounts", "assets", "debts", "tax"];
  const keep = {};
  keys.forEach(k => { keep[k] = state[k]; });
  try { keys.forEach(k => { state[k] = fields[k] !== undefined ? fields[k] : (k === "tax" || k === "purchase" ? {} : []); }); return fn(); }
  finally { Object.assign(state, keep); }
}
const ids = list => list.map(c => c.id.split(":")[0]).sort();

test("a tidy household: nothing flagged", function(){
  withState({
    income: [{ what: "Alex — Net income", amount: 5000, freq: "Monthly", computed: true, syntheticNetFor: "Alex" }, { what: "Side work", amount: 300, freq: "Monthly" }],
    properties: [{ id: "p1", what: "1 Example St", purchaseDate: "2020-05-01", income: [{ what: "Rent", amount: 500, freq: "Weekly" }, { what: "Granny flat rent", amount: 500, freq: "Weekly" }], loans: [] }],
    accounts: [{ id: "a1", name: "Bank One Everyday", type: "everyday", link: "asset:c1" }],
    assets: [{ id: "c1", what: "Bank One Everyday", category: "Cash", amount: 4000, history: [{ date: "2026-11-01", value: 4000 }] }],
    tax: { settings: { Alex: { dateOfBirth: "1990-01-01" } } }
  }, function(){
    assert.deepEqual(integrityChecks(state, TODAY), [], "two rents with different names, and the worked-out net pay, are not duplicates");
  });
});

test("income entered twice, a pay line beside the worked-out net pay, the same rent twice on a property", function(){
  withState({
    income: [{ what: "Alex — Net income", amount: 5000, freq: "Monthly", computed: true, syntheticNetFor: "Alex" },
      { what: "Alex pay", amount: 5010, freq: "Monthly" }, { what: "Dividends", amount: 100, freq: "Monthly" }, { what: "Dividends", amount: 100, freq: "Monthly" }],
    properties: [{ id: "p1", what: "1 Example St", income: [{ what: "Rent", amount: 500, freq: "Weekly" }, { what: "Rent", amount: 500, freq: "Weekly" }], loans: [] }]
  }, function(){
    const c = integrityChecks(state, TODAY);
    assert.deepEqual(ids(c), ["int-dup-income", "int-dup-rent", "int-net-twin"]);
    assert.equal(c.find(x => x.id === "int-dup-income").confidence, "likely");
    assert.equal(c.find(x => x.id === "int-net-twin:Alex").confidence, "possible");
    assert.match(c.find(x => x.id === "int-dup-rent:p1").detail, /“Rent”/);
  });
});

test("a scenario's plan and the home being bought: the differences said, neither changed", function(){
  const plan = { enabled: true, price: 600000, depositPct: 10, rate: 6 };
  const purchase = { id: "b1", what: "3 Example Ave", price: 640000, deposit: 64000, rate: 5.89, loanAmount: 576000, costs: [], depositAssetId: "d1" };
  withState({ purchase: { "Buy a house": plan }, purchases: [purchase], assets: [{ id: "d1", what: "Deposit held — 3 Example Ave", category: "Other", amount: 64000, depositFor: "b1" }] }, function(){
    const c = integrityChecks(state, TODAY).find(x => x.id.startsWith("int-plan-buy"));
    assert.ok(c);
    assert.equal(c.confidence, "certain");
    assert.match(c.detail, /price \$600,000 planned, \$640,000 agreed; deposit \$60,000 planned, \$64,000 paid; rate 6% planned, 5\.89% offered/);
    assert.equal(plan.price, 600000, "the plan is not changed");
    assert.equal(purchase.price, 640000, "the purchase is not changed");
  });
});

test("balances stale or never recorded; two accounts on one balance; a cash asset counted twice", function(){
  withState({
    accounts: [{ id: "a1", name: "Saver", type: "savings", link: "asset:c1" }, { id: "a2", name: "Saver copy", type: "savings", link: "asset:c1" },
      { id: "a3", name: "Everyday", type: "everyday", link: "" }, { id: "a4", name: "Agent", type: "agent", link: "" }],
    assets: [{ id: "c1", what: "Saver", category: "Cash", amount: 9000, history: [{ date: "2026-05-01", value: 9000 }] }, { id: "c2", what: "Saver", category: "Cash", amount: 9000, history: [] }]
  }, function(){
    const c = integrityChecks(state, TODAY);
    assert.deepEqual(ids(c), ["int-no-balance", "int-shared-source", "int-stale", "int-twin-cash"]);
    assert.match(c.find(x => x.id === "int-stale").detail, /Saver \(203 days\)/);
    assert.match(c.find(x => x.id === "int-no-balance").detail, /“Everyday”/);
    assert.doesNotMatch(c.find(x => x.id === "int-no-balance").detail, /Agent/, "a property manager holds no balance");
  });
});

test("dates that can't be: bought in the future, settling before the contract, a birthday after today", function(){
  withState({
    properties: [{ id: "p1", what: "1 Example St", purchaseDate: "2027-01-01", loans: [] }],
    purchases: [{ id: "b1", what: "3 Example Ave", contractDate: "2026-10-01", settlementDate: "2026-09-01", costs: [] }],
    tax: { settings: { Sam: { dateOfBirth: "2030-01-01" } } }
  }, function(){
    const c = integrityChecks(state, TODAY);
    assert.match(c.find(x => x.id === "int-dates").detail, /bought on 2027-01-01, after today; 3 Example Ave settles \(2026-09-01\) before its contract/);
    assert.deepEqual(c.find(x => x.id === "int-dob").where, { page: "tax", sub: "people" });
  });
});

test("a purchase whose figures don't agree: its deposit held, the lender's loan, a loan over the price", function(){
  withState({
    purchases: [{ id: "b1", what: "3 Example Ave", price: 500000, deposit: 50000, loanAmount: 520000, grossLoan: 530000, costs: [], depositAssetId: "d1" }],
    assets: [{ id: "d1", what: "Deposit held — 3 Example Ave", category: "Other", amount: 40000, depositFor: "b1" }]
  }, function(){
    const c = integrityChecks(state, TODAY).find(x => x.id === "int-purchase:b1");
    assert.equal(c.confidence, "certain");
    assert.match(c.detail, /deposit held in net worth is \$40,000, not the \$50,000 paid; the lender's loan is \$530,000, the loan and fees added to it \$520,000; the deposit and loan \(\$570,000\) come to well over the price; the loan is more than the price/);
  });
});

test("the same line at two amounts — one line edited on two devices — is flagged, not two rents with their own names", function(){
  withState({ properties: [{ id: "p1", what: "1 Example St", loans: [], income: [{ what: "Rent", amount: 600, freq: "Weekly" }, { what: "Rent", amount: 610, freq: "Weekly" }, { what: "Granny flat", amount: 200, freq: "Weekly" }] }] }, function(){
    const c = integrityChecks(state, TODAY).find(x => x.id === "int-split-rows");
    assert.ok(c);
    assert.equal(c.confidence, "possible");
    assert.match(c.detail, /“Rent” \$600 and \$610 weekly/);
    assert.deepEqual(c.where, { page: "properties" });
  });
});
