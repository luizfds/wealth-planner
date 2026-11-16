import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileYear } from "../src/calc/reconcile.js";
import { state, defaultState, setState } from "../src/state.js";

// #397: kept, and where it went. An invented household whose year closes exactly.
const W = { start: "2025-07-01", end: "2026-06-30", label: "FY25/26" };
const monthEnds = ["2025-07-31", "2025-08-31", "2025-09-30", "2025-10-31", "2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"];
function household(){
  const s = defaultState();
  s.incomeLog = monthEnds.map((d, i) => ({ id: "in" + i, date: d, amount: 8000, target: "net:Alex" }));
  s.transactions = monthEnds.map((d, i) => ({ id: "t" + i, date: d, amount: i % 2 ? 3000 : 2000, linkedExpenseId: i % 2 ? "groceries" : "fun" }));
  s.shared = [{ id: "groceries", what: "Groceries", classification: "Needs", amount: 1, freq: "Monthly" }, { id: "fun", what: "Eating out", classification: "Wants", amount: 1, freq: "Monthly" }];
  s.assets = [
    { what: "Everyday", category: "Cash", amount: 25000, history: [{ date: "2025-06-28", value: 10000 }, { date: "2026-06-29", value: 25000 }] },
    { what: "Fund", category: "Shares", symbol: "EXA", market: "ASX", quantity: 100, price: 50, amount: 5000, history: [{ date: "2025-06-01", value: 1000 }, { date: "2026-06-30", value: 9999 }],
      lots: [{ date: "2025-09-01", units: 100, price: 50, brokerage: 10 }], sales: [{ date: "2026-02-01", units: 20, proceeds: 2000 }] }
  ];
  s.debts = [{ what: "Card A", balance: 2000, history: [{ date: "2025-06-30", value: 5000 }, { date: "2026-06-30", value: 2000 }] }];
  s.properties = [{ id: "p1", what: "1 Example St", kind: "IP", value: 600000, history: [{ date: "2025-06-01", value: 600000 }],
    loans: [{ id: "l1", what: "Loan A", balance: 290000, rate: 0, termYears: 30, repaymentType: "PI", settlementDate: "2020-01-01",
      balanceHistory: [{ date: "2025-06-30", value: 300000 }, { date: "2026-06-30", value: 290000 }],
      charges: monthEnds.map((d, i) => ({ id: "c" + i, date: d, amount: 1000, kind: "interest" })) }] }];
  return s;
}
const classOf = t => ({ groceries: "Needs", fun: "Wants" })[t.linkedExpenseId] || "Other";
const opts = s => ({ today: "2026-11-03", classOf, budgetLines: s.shared });

test("kept = money in − spending − loan interest; where it went, from balances; the rest unaccounted", () => {
  const was = state; const s = household(); setState(s);
  try {
    const r = reconcileYear(W, opts(s));
    assert.equal(r.moneyIn, 96000);
    assert.deepEqual(r.spending, { needs: 18000, wants: 12000, other: 0, total: 30000 });
    assert.equal(r.interest.charged, 12000);
    assert.equal(r.interest.total, 12000);
    assert.equal(r.kept, 54000);
    const m = Object.fromEntries(r.moves.map(x => [x.key, x.amount]));
    assert.deepEqual(m, { cash: 15000, offsets: 0, loans: 10000, debts: 3000, shares: 3010 });
    assert.equal(r.accounted, 31010);
    assert.equal(r.unaccounted, 22990);
    assert.equal(r.complete, true, JSON.stringify(r.missing));
  } finally { setState(was); }
});

test("transfers between your own accounts change nothing", () => {
  const was = state; const s = household(); setState(s);
  try {
    const before = reconcileYear(W, opts(s));
    s.transfers = [{ id: "x1", date: "2025-10-01", amount: 5000, from: "Everyday", to: "Savings" }, { id: "x2", date: "2025-11-01", amount: 900, from: "Everyday", to: "Card A" }];
    assert.deepEqual(reconcileYear(W, opts(s)), before);
  } finally { setState(was); }
});

test("loan repayments logged as spending: interest isn't taken off again", () => {
  const was = state; const s = household(); setState(s);
  try {
    s.shared.push({ id: "mort", what: "Home loan repayment", classification: "Needs", amount: 1, freq: "Monthly" });
    s.transactions.push({ id: "tm", date: "2025-08-15", amount: 1500, linkedExpenseId: "mort" });
    const r = reconcileYear(W, opts(s));
    assert.equal(r.interest.repaymentsAsSpending, true);
    assert.equal(r.interest.total, 0);
    assert.equal(r.kept, 96000 - 31500);
  } finally { setState(was); }
});

test("what's missing is said: a balance not recorded near either end, a loan without history, months with nothing logged", () => {
  const was = state; const s = household(); setState(s);
  try {
    s.assets[0].history = [{ date: "2025-12-01", value: 12000 }];
    delete s.properties[0].loans[0].balanceHistory;
    s.incomeLog = s.incomeLog.filter(r => r.date.slice(0, 7) !== "2025-10");
    s.transactions = s.transactions.filter(r => r.date.slice(0, 7) !== "2025-10");
    const r = reconcileYear(W, opts(s));
    assert.equal(r.complete, false);
    assert.ok(r.missing.balances.some(t => /^Everyday — no balance recorded before FY25\/26 began/.test(t)), r.missing.balances.join("; "));
    assert.ok(r.missing.balances.some(t => /^Everyday — the last balance in the year is from 1 Dec 2025/.test(t)), r.missing.balances.join("; "));
    assert.ok(r.missing.balances.some(t => /^Loan A — no balances recorded/.test(t)));
    assert.deepEqual(r.missing.months, [{ ym: "2025-10", label: "October 2025" }]);
    assert.ok(r.missing.balances.every(t => !/\d{4}-\d{2}-\d{2}/.test(t)), "dates are written for people");
  } finally { setState(was); }
});

test("an empty household: zeros, nothing missing to list, nothing non-finite", () => {
  const was = state; setState(defaultState());
  try {
    const r = reconcileYear(W, { today: "2026-11-03" });
    assert.equal(r.kept, 0);
    assert.equal(r.unaccounted, 0);
    assert.equal(r.missing.balances.length, 0);
    assert.equal(r.missing.months.length, 12);
    JSON.stringify(r, (k, v) => { if(typeof v === "number") assert.ok(Number.isFinite(v), k); return v; });
  } finally { setState(was); }
});
