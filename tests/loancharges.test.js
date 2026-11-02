import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { loanInterestCharged, loanFeesCharged, loanRowKind, splitLoanStatement, bankRepaymentOf, bankRepaymentNudge } from "../src/calc/loancharges.js";
import { loanInterestForWindow } from "../src/calc/property.js";
import { propertyYearActual, rentalLogged } from "../src/calc/propertyactuals.js";

// Item 243: loans as the bank charged them. Invented loans, rows and amounts.
function loan(extra){
  return Object.assign({ id: "L1", what: "Loan A", balance: 365000, offsetBalance: 0, rate: 6, termYears: 25, repaymentType: "PI", settlementDate: "2020-01-01", charges: [] }, extra || {});
}

test("no interest is worked out before the loan settled", function(){
  var drawnLate = loan({ settlementDate: "2026-08-06" });
  assert.equal(loanInterestForWindow(drawnLate, "2026-07-01", "2026-08-05"), 0);
  // 6% of 365,000 is 60 a day: 6 Aug to 31 Aug is 26 days.
  assert.equal(loanInterestForWindow(drawnLate, "2026-07-01", "2026-08-31"), 1560);
  assert.equal(loanInterestForWindow(loan(), "2026-07-01", "2026-07-31"), 1860);
});

test("interest is what the bank charged for the days its charges cover, worked out for the rest", function(){
  var l = loan({ charges: [
    { id: "a", date: "2026-07-31", amount: 2000, kind: "interest" },
    { id: "b", date: "2026-08-31", amount: 1950, kind: "interest" },
    { id: "c", date: "2026-08-15", amount: 10, kind: "fee", what: "Loan service fee" },
    { id: "d", date: "2026-05-31", amount: 2100, kind: "interest" }
  ] });
  var r = loanInterestCharged(l, "2026-07-01", "2026-09-10");
  assert.equal(r.charged, 3950);
  assert.equal(r.count, 2);
  assert.equal(r.from, "2026-07-01");
  assert.equal(r.to, "2026-08-31");
  assert.equal(r.modelled, 600, "1 to 10 September, 10 days at 60 a day");
  assert.equal(r.amount, 4550);
  assert.equal(loanFeesCharged(l, "2026-07-01", "2026-09-10"), 10);
  // Nothing charged in the window: all worked out.
  var none = loanInterestCharged(l, "2026-01-01", "2026-01-31");
  assert.equal(none.charged, 0);
  assert.equal(none.amount, 1860);
  // The first charge covers the month before it: charges from September leave July and August worked out.
  var late = loanInterestCharged(loan({ charges: [{ id: "x", date: "2026-09-30", amount: 1700, kind: "interest" }] }), "2026-07-01", "2026-09-30");
  assert.equal(late.from, "2026-09-01");
  assert.equal(late.modelled, 3720, "62 days of July and August at 60");
});

test("a loan statement's rows: interest and fees go on the loan, a drawdown says when it settled, repayments stay", function(){
  assert.equal(loanRowKind({ description: "Interest Charge", direction: "debit" }), "interest");
  assert.equal(loanRowKind({ description: "Repayment from 012", direction: "credit" }), "repayment");
  assert.equal(loanRowKind({ description: "Loan drawdown", direction: "debit" }), "drawdown");
  assert.equal(loanRowKind({ description: "Legal Fee", direction: "debit" }), "fee");
  assert.equal(loanRowKind({ description: "Offset interest benefit", direction: "credit" }), "repayment");
  assert.equal(loanRowKind({ description: "Redraw", direction: "debit" }), null);
  var l = loan({ charges: [{ id: "old", date: "2026-07-31", amount: 2000, kind: "interest" }] });
  var rows = [
    { date: "2026-07-31", amount: 2000, direction: "debit", description: "Interest Charge" },
    { date: "2026-08-31", amount: 1950, direction: "debit", description: "Interest Charge" },
    { date: "2026-08-06", amount: 100000, direction: "debit", description: "Loan drawdown" },
    { date: "2026-08-10", amount: 20, direction: "debit", description: "Legal Fee" },
    { date: "2026-08-15", amount: 900, direction: "credit", description: "Repayment" },
    { date: "2026-09-01", amount: 5, direction: "credit", description: "Interest adjustment" }
  ];
  var s = splitLoanStatement(rows, l);
  assert.equal(s.known, 1, "the July charge is already on the loan");
  assert.deepEqual(s.charges.map(function(c){ return [c.kind, c.row.date, c.amount]; }),
    [["interest", "2026-08-31", 1950], ["fee", "2026-08-10", 20], ["interest", "2026-09-01", -5]]);
  assert.equal(s.drawdown.date, "2026-08-06");
  assert.equal(s.repayments.length, 1);
  assert.deepEqual(s.rest.map(function(r){ return r.description; }), ["Repayment"]);
});

test("the bank's repayment: the amount paid most often, and how often", function(){
  var monthly = [["2026-07-15", 1500], ["2026-08-15", 1500], ["2026-09-15", 1500], ["2026-09-20", 4000]].map(function(x){ return { date: x[0], amount: x[1] }; });
  assert.deepEqual(bankRepaymentOf(monthly), { amount: 1500, freq: "Monthly", date: "2026-09-20" });
  var fortnightly = ["2026-07-01", "2026-07-15", "2026-07-29"].map(function(d){ return { date: d, amount: 700 }; });
  assert.equal(bankRepaymentOf(fortnightly).freq, "Fortnightly");
  assert.equal(bankRepaymentOf([]), null);
  // The nudge: only when the loan's own repayment differs.
  var l = loan({ repaymentMode: "manual", manualRepaymentAmount: 1500, manualRepaymentFreq: "Monthly", bankRepayment: { amount: 1500, freq: "Monthly" } });
  assert.equal(bankRepaymentNudge(l), null);
  l.manualRepaymentAmount = 1400;
  assert.deepEqual(bankRepaymentNudge(l), { amount: 1500, freq: "Monthly", current: 1400 });
  assert.equal(bankRepaymentNudge(loan()), null, "nothing imported: nothing to compare");
});

test("the year so far and the rental schedule use the bank's charges, at the invest share", function(){
  var p = { id: "ip1", what: "1 Example St", kind: "IP", income: [], expenses: [], agentStatements: [],
    loans: [loan({ investPct: 50, charges: [
      { id: "a", date: "2026-07-31", amount: 2000, kind: "interest" },
      { id: "b", date: "2026-08-31", amount: 1950, kind: "interest" },
      { id: "f", date: "2026-08-10", amount: 20, kind: "fee", what: "Loan service fee" }] })] };
  var st = { transactions: [], incomeLog: [] };
  var a = propertyYearActual(p, 2026, "2026-08-31", st, []);
  var interest = a.rows.find(function(r){ return r.key === "interest"; });
  assert.equal(interest.actual, -1975);
  assert.equal(interest.logged, true, "charged all the way to today");
  assert.equal(interest.chargedTo, "2026-08-31");
  assert.equal(a.rows.find(function(r){ return r.key === "expenses"; }).actual, -10, "the fee, at the invest share");
  assert.equal(a.charges, 2);
  var lg = rentalLogged(p, 2026, "2026-08-31", st, []);
  assert.equal(lg.lines.interest, 1975);
  assert.equal(lg.lines.other, 10);
});

// Item 245: a statement that reads like a loan's, when no loan account was picked.
test("a loan statement is told from a card's or an everyday account's", async function(){
  const { looksLikeLoanStatement } = await import("../src/calc/loancharges.js");
  var loanRows = [{ description: "Interest Charge", direction: "debit" }, { description: "Repayment", direction: "credit" }, { description: "Interest Charge", direction: "debit" }, { description: "Loan Service Fee", direction: "debit" }];
  assert.equal(looksLikeLoanStatement(loanRows), true);
  var card = [{ description: "Fern Cafe", direction: "debit" }, { description: "Grocer", direction: "debit" }, { description: "Interest charged", direction: "debit" }, { description: "Payment thank you", direction: "credit" }, { description: "Fuel", direction: "debit" }];
  assert.equal(looksLikeLoanStatement(card), false);
  var savings = [{ description: "Interest credit", direction: "credit" }, { description: "Transfer in", direction: "credit" }];
  assert.equal(looksLikeLoanStatement(savings), false, "no interest charged");
  assert.equal(looksLikeLoanStatement([]), false);
});

test("the account for a loan: the linked one, else a new Loan account linked to it", async function(){
  const { loanAccountFor } = await import("../src/calc/accounts.js");
  var s = { accounts: [{ id: "a1", name: "Loan A", type: "everyday", link: "" }], properties: [{ what: "1 Example St", loans: [{ id: "L1", what: "Loan A" }, { id: "L2", what: "Loan B" }] }], assets: [], debts: [] };
  assert.equal(loanAccountFor("L1", s), "Loan A 2", "a name already taken gets a number");
  assert.deepEqual([s.accounts[1].type, s.accounts[1].link], ["loan", "loan:L1"]);
  assert.equal(loanAccountFor("L1", s), "Loan A 2", "the second time, the same account");
  assert.equal(s.accounts.length, 2);
  assert.equal(loanAccountFor("nope", s), "");
});

// Item 244: removing the record behind an Activity row.
test("removing a ledger record takes out exactly that record", async function(){
  const { removeLedgerRecord } = await import("../src/calc/propertyactuals.js");
  var p = { id: "ip1", loans: [{ id: "L1", charges: [{ id: "c1" }, { id: "c2" }] }], agentStatements: [{ id: "s1", incomeId: "in1", txIds: ["t1"] }] };
  var st = { incomeLog: [{ id: "in1" }, { id: "in2" }], transactions: [{ id: "t1" }, { id: "t2" }] };
  assert.equal(removeLedgerRecord(st, p, "charge", "c1", "L1"), true);
  assert.deepEqual(p.loans[0].charges.map(function(c){ return c.id; }), ["c2"]);
  assert.equal(removeLedgerRecord(st, p, "received", "in2"), true);
  assert.equal(removeLedgerRecord(st, p, "tx", "t2"), true);
  assert.equal(removeLedgerRecord(st, p, "statement", "s1"), true, "with the rent and bills it logged");
  assert.deepEqual([st.incomeLog.length, st.transactions.length, p.agentStatements.length], [0, 0, 0]);
  assert.equal(removeLedgerRecord(st, p, "tx", "t2"), false);
});
