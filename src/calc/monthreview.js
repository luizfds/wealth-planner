import { state } from "../state.js";
import { periodsOf, currentStatementCycle } from "./ledger.js";
import { incomeActuals } from "./received.js";
import { dataHealthChecks } from "./health.js";
import { claimItems } from "./claims.js";
import { localDateStr } from "../lib/format.js";

// ---------------- The monthly review (v3.54.0) ----------------
//
// Everything from the last few releases — income received, the bank import, Checks — only stays
// accurate if someone feeds it, and the easiest way to make that happen is one short pass a month
// that asks for exactly what's missing. Four parts, for one calendar month:
//
//   1. money in: each regular income line, received against planned, flagging what's not logged
//   2. card statements: each credit card's statement that closed in the month, the charges logged
//      in it against what the statement says (typed in), so a gap points at missing transactions
//   3. checks: what Accounts → Checks says needs fixing
//   4. the month against the plan: income, spending by category, and what was saved
//
// state.monthReviews[ym] = { statements: {accountName: amount}, done: "YYYY-MM-DD" }.
// `accountOf` / `categoryOf` resolve a transaction through its linked line (components/expenses.js
// owns that), passed in so this stays a calc module.
export var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthLabel(ym){ return MONTH_NAMES[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4); }
export function monthBounds(ym){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return { start: ym + "-01", end: ym + "-" + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0") };
}
export function shiftMonth(ym, n){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + "-" + String(m + 1).padStart(2, "0");
}
// The month a review is for: last month, until it's been reviewed — then this one.
export function reviewMonth(today){
  today = today || localDateStr();
  var last = shiftMonth(today.slice(0, 7), -1);
  var rec = state.monthReviews && state.monthReviews[last];
  return rec && rec.done ? today.slice(0, 7) : last;
}
// The statement that closed within the month: the cycle containing the month's last day, or the
// one before it if that cycle runs past the month.
export function statementInMonth(startDay, ym){
  var end = monthBounds(ym).end;
  var c = currentStatementCycle(startDay || 1, end);
  if(c.end > end){
    var before = new Date(Date.parse(c.start) - 86400000).toISOString().slice(0, 10);
    c = currentStatementCycle(startDay || 1, before);
  }
  return c;
}

export function monthReview(ym, opts){
  opts = opts || {};
  var accountOf = opts.accountOf || function(t){ return t.account || ""; };
  var categoryOf = opts.categoryOf || function(t){ return t.category || ""; };
  var items = opts.items || claimItems();
  var b = monthBounds(ym);
  var rec = (state.monthReviews && state.monthReviews[ym]) || {};
  var txns = (state.transactions || []).filter(function(t){ return t.date >= b.start && t.date <= b.end; });

  var income = incomeActuals(ym).filter(function(r){ return !r.irregular && r.kind !== "payout"; });
  var incReceived = income.reduce(function(s, r){ return s + r.received; }, 0);
  var incPlanned = income.reduce(function(s, r){ return s + r.planned; }, 0);

  var statements = (state.accounts || []).filter(function(a){ return a.type === "credit"; }).map(function(a){
    var c = statementInMonth(a.statementStartDay, ym);
    var logged = (state.transactions || []).filter(function(t){ return t.date >= c.start && t.date <= c.end && accountOf(t) === a.name; })
      .reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    var said = rec.statements && rec.statements[a.name] != null ? Number(rec.statements[a.name]) : null;
    return { account: a.name, start: c.start, end: c.end, logged: Math.round(logged * 100) / 100, statement: said,
      gap: said == null ? null : Math.round((said - logged) * 100) / 100 };
  });

  var checks = dataHealthChecks({ items: items, today: opts.today }).filter(function(c){ return c.severity !== "info"; });

  // Spending by category: logged in the month against each category's planned monthly amount.
  var planned = {}, actual = {};
  items.forEach(function(i){
    if(i.irregular) return;
    var k = i.category || "Uncategorised";
    planned[k] = (planned[k] || 0) + periodsOf(Number(i.amount) || 0, i.freq).monthly;
  });
  // Spend against a reserve line (travel, gifts) is judged over its year, not one month — so it's
  // kept out of the month's comparison on both sides and reported on its own.
  var reserveIds = {};
  items.forEach(function(i){ if(i.irregular && i.id) reserveIds[i.id] = true; });
  var reserveSpent = 0;
  txns.forEach(function(t){
    if(t.linkedExpenseId && reserveIds[t.linkedExpenseId]){ reserveSpent += Number(t.amount) || 0; return; }
    var k = categoryOf(t) || "Uncategorised"; actual[k] = (actual[k] || 0) + (Number(t.amount) || 0);
  });
  var cats = Object.keys(Object.assign({}, planned, actual)).map(function(k){
    return { category: k, planned: Math.round((planned[k] || 0) * 100) / 100, actual: Math.round((actual[k] || 0) * 100) / 100 };
  }).filter(function(c){ return c.actual || c.planned; }).sort(function(x, y){ return (y.actual - y.planned) - (x.actual - x.planned); });
  var spent = txns.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0) - reserveSpent;
  var plannedSpend = Object.keys(planned).reduce(function(s, k){ return s + planned[k]; }, 0);

  return {
    ym: ym, label: monthLabel(ym), done: rec.done || null,
    income: income, incomeReceived: Math.round(incReceived * 100) / 100, incomePlanned: Math.round(incPlanned * 100) / 100,
    missingIncome: income.filter(function(r){ return !r.rows.length; }).length,
    statements: statements, checks: checks,
    categories: cats, spent: Math.round(spent * 100) / 100, plannedSpend: Math.round(plannedSpend * 100) / 100,
    reserveSpent: Math.round(reserveSpent * 100) / 100,
    transactions: txns.length
  };
}

export function setStatementAmount(ym, account, amount){
  if(!state.monthReviews || typeof state.monthReviews !== "object") state.monthReviews = {};
  var rec = state.monthReviews[ym] || (state.monthReviews[ym] = {});
  if(!rec.statements) rec.statements = {};
  if(amount === "" || amount == null || isNaN(Number(amount))) delete rec.statements[account];
  else rec.statements[account] = Number(amount);
}
export function markReviewed(ym, on, today){
  if(!state.monthReviews || typeof state.monthReviews !== "object") state.monthReviews = {};
  var rec = state.monthReviews[ym] || (state.monthReviews[ym] = {});
  if(on) rec.done = today || localDateStr(); else delete rec.done;
}
