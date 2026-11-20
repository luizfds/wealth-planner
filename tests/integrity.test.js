// #453: records that disagree with each other (calc/integrity.js). Invented fixtures only.
import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { integrityChecks, planForPurchase } from "../src/calc/integrity.js";
import { loanHoldsFees, planFromPurchase } from "../src/calc/purchase.js";
import { trimReport, setLinesToSpending, spendingDrift } from "../src/calc/trim.js";
import { makeAgentAccount, looksLikeAgentAccount } from "../src/calc/agentstatement.js";

const TODAY = "2026-11-20";
function withState(fields, fn){
  const keys = ["income", "properties", "purchases", "purchase", "accounts", "assets", "debts", "tax", "shared", "transactions"];
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

test("a loan amount that already holds a fee added to the loan: said, with the loan before fees; not when the lender's figure is typed or the loan is round", function(){
  const fees = [{ id: "c1", what: "Lenders mortgage insurance", kind: "loan", amount: 8250, financed: true }, { id: "c2", what: "Loan application fee", kind: "loan", amount: 600, financed: true }];
  const p = { id: "b1", what: "3 Example Ave", price: 500000, deposit: 50000, loanAmount: 458250, costs: fees };
  assert.deepEqual(loanHoldsFees(p), { base: 450000, amount: 8250, fees: ["Lenders mortgage insurance"] }, "one fee taken off leaves a round loan");
  assert.deepEqual(loanHoldsFees(Object.assign({}, p, { loanAmount: 458850 })).fees, ["Lenders mortgage insurance", "Loan application fee"], "or all of them");
  assert.equal(loanHoldsFees(Object.assign({}, p, { loanAmount: 450000 })), null, "a round loan is before fees");
  assert.equal(loanHoldsFees(Object.assign({}, p, { grossLoan: 458850 })), null, "the lender's figure typed: its own check");
  assert.equal(loanHoldsFees(Object.assign({}, p, { costs: fees.map(c => Object.assign({}, c, { financed: false })) })), null, "nothing added to the loan");
  withState({ purchases: [p] }, function(){
    const c = integrityChecks(state, TODAY).find(x => x.id === "int-loan-fees:b1");
    assert.equal(c.confidence, "likely");
    assert.match(c.detail, /\$458,250, is \$450,000 and “Lenders mortgage insurance” \(\$8,250\)/);
    assert.deepEqual(c.fix, { label: "Move it to the lender's figure", kind: "loan-holds-fees", arg: "b1" });
  });
});

test("a plan well behind the purchase is a warning, with a fix that sets price, deposit and rate and nothing else", function(){
  const plan = { enabled: true, price: 600000, depositPct: 20, rate: 6, termYears: 30 };
  const purchase = { id: "b1", what: "3 Example Ave", price: 600000, deposit: 60000, rate: 5.5, costs: [], depositAssetId: "d1" };
  withState({ purchase: { "Buy a house": plan }, purchases: [purchase], assets: [{ id: "d1", what: "Deposit held", category: "Other", amount: 60000, depositFor: "b1" }] }, function(){
    const c = integrityChecks(state, TODAY).find(x => x.id.startsWith("int-plan-buy"));
    assert.equal(c.severity, "warn", "the plan counts on twice the deposit paid");
    assert.equal(c.fix.kind, "plan-from-purchase");
    assert.equal(planForPurchase(state, purchase), "Buy a house");
    planFromPurchase(plan, purchase);
    assert.deepEqual(plan, { enabled: true, price: 600000, depositPct: 10, rate: 5.5, termYears: 30 });
    assert.equal(integrityChecks(state, TODAY).find(x => x.id.startsWith("int-plan-buy")), undefined, "nothing left to say");
  });
});

test("budget lines far from what's spent, both ways: Trim finds them, Checks says so, and setting them to spending clears it", function(){
  const tx = [];
  for(let m = 0; m < 12; m++){
    const d = "2026-" + String(m + 1).padStart(2, "0") + "-05";
    if(d > TODAY) continue;
    tx.push({ id: "g" + m, date: d, amount: 900, linkedExpenseId: "groc" }, { id: "f" + m, date: d, amount: 20, linkedExpenseId: "fun" });
  }
  tx.push({ id: "g12", date: "2025-12-05", amount: 900, linkedExpenseId: "groc" }, { id: "f12", date: "2025-12-05", amount: 20, linkedExpenseId: "fun" });
  const shared = [{ id: "groc", what: "Groceries", amount: 500, freq: "Monthly" }, { id: "fun", what: "Going out", amount: 200, freq: "Monthly" }, { id: "rent", what: "Rent", amount: 2000, freq: "Monthly" }];
  withState({ shared, transactions: tx }, function(){
    const r = trimReport({ state, today: TODAY });
    // Trim's months run from the first spending logged, so the monthly figures are near, not exactly, what's spent.
    assert.deepEqual(r.under.map(x => x.id), ["groc"], "spent above the budget");
    assert.ok(Math.abs(r.under[0].suggested - 900) < 90);
    assert.deepEqual(r.over.map(x => x.id), ["rent", "fun"], "budgeted above spending — the rent with nothing logged too, in Trim");
    assert.deepEqual(spendingDrift(r).map(x => x.id), ["fun", "groc"], "but Checks offers only lines with spending logged");
    const c = integrityChecks(state, TODAY).find(x => x.id === "int-budget-drift");
    assert.match(c.title, /^2 budget lines far from what you spend/);
    assert.match(c.detail, /“Groceries” \$6,000 planned, \$1[01],\d{3} spent/);
    assert.equal(c.fix.kind, "budget-to-spending");
    const undo = setLinesToSpending(state, spendingDrift(r));
    assert.deepEqual(undo.map(u => u.was), [200, 500]);
    assert.deepEqual([shared[0].amount, shared[1].amount, shared[2].amount], [r.under[0].suggested, r.over[1].suggested, 2000], "a line without spending logged is left alone");
    assert.equal(integrityChecks(state, TODAY).find(x => x.id === "int-budget-drift"), undefined);
  });
});

test("a property manager's account typed as an ordinary one: flagged when there's a property, and made one — linked to it", function(){
  const accounts = [{ id: "a1", name: "Bank One Everyday", type: "everyday", link: "" }, { id: "a2", name: "Example Realty property manager", type: "everyday", link: "asset:c9" }];
  assert.equal(looksLikeAgentAccount(accounts[0]), false);
  assert.equal(looksLikeAgentAccount(accounts[1]), true);
  withState({ accounts, properties: [] }, function(){
    assert.equal(integrityChecks(state, TODAY).find(x => x.id === "int-agent-type"), undefined, "no property: no manager");
  });
  withState({ accounts, properties: [{ id: "p1", what: "1 Example St", loans: [] }] }, function(){
    const c = integrityChecks(state, TODAY).find(x => x.id === "int-agent-type");
    assert.match(c.detail, /“Example Realty property manager” — named like one, but typed “Everyday”/);
    makeAgentAccount(state, accounts[1]);
    assert.deepEqual([accounts[1].type, accounts[1].link], ["agent", "property:p1"]);
    assert.equal(integrityChecks(state, TODAY).find(x => x.id === "int-agent-type"), undefined);
  });
});
