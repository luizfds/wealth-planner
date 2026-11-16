// ---------------- The year reconciled: kept, and where it went (#397, 2/5 of #390) ----------------
//
// Money in (state.incomeLog — take-home, rent and the rest as it landed) − spending (state.transactions, by Needs,
// Wants and other) = kept. Then where the kept money ended up, read from balances on the day before the year and its
// last day (netWorthOn, the net-worth statement's own rules):
//   cash and offsets       their balances' change
//   loans paid down        principal: the loans' recorded balances fell (negative when more was borrowed)
//   cards and other debts  their balances fell
//   shares bought less sold purchase lots and sales dated in the year, at cost — a price moving isn't money that moved
// What's left is unaccounted, and shown. The owner chose this over following transfers (#390): transfers aren't
// counted at all, so a transfer can't be counted twice — moving money between your own accounts changes no total.
//
// What's missing is said, never read as $0: a cash account, card or loan with no balance recorded near either end of
// the year (a loan with no balance history reads as unchanged, which would hide what was paid), and months with
// nothing logged. Super (paid before tax), a car's or property's value, and a property bought are left out, with a note.
import { state } from "../state.js";
import { netWorthOn } from "./nwhistory.js";
import { toAudAmount } from "./engine.js";
import { monthLabel } from "./monthreview.js";
import { loanInterestCharged, loanFeesCharged } from "./loancharges.js";
import { fmtDate } from "../lib/format.js";

var STALE_DAYS = 62;  // a balance recorded more than about two months from the date it stands for is called out

function r2(n){ return Math.round(n * 100) / 100 || 0; }
function dayBefore(iso){
  var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function daysBetween(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
// The date of the last record on or before `date`, or null.
function lastRecord(history, date){
  var best = null;
  (history || []).forEach(function(h){ if(h && h.date && h.date <= date && (!best || h.date > best)) best = h.date; });
  return best;
}
function classKey(c){ return c === "Needs" || c === "Wants" ? c : "Other"; }

// w: { start, end, label }. opts: { today, classOf(transaction) → "Needs" | "Wants" | …, budgetLines }.
export function reconcileYear(w, opts){
  opts = opts || {};
  var today = opts.today, classOf = opts.classOf || function(){ return "Other"; };
  var inWin = function(r){ return r && r.date >= w.start && r.date <= w.end; };
  var moneyIn = (state.incomeLog || []).filter(inWin).reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
  var spend = { Needs: 0, Wants: 0, Other: 0 };
  (state.transactions || []).filter(inWin).forEach(function(t){ spend[classKey(classOf(t))] += Number(t.amount) || 0; });
  var spent = spend.Needs + spend.Wants + spend.Other;
  // Loan interest and fees aren't in Spending: a loan statement's charges go on the loan (item 243), and a repayment is
  // a transfer. Principal shows in the loan's balance below; the interest is money gone, so it's taken off here — what
  // the bank charged where its statements were imported, the model's figure for the rest. Unless repayments are being
  // logged as spending, against a line named for the loan: then they're already in Spending, and adding interest would
  // count it twice.
  var linesById = {};
  (opts.budgetLines || []).forEach(function(l){ if(l && l.id) linesById[l.id] = l; });
  var repaymentsAsSpending = (state.transactions || []).filter(inWin).some(function(t){
    var l = t.linkedExpenseId && linesById[t.linkedExpenseId];
    return !!l && /mortgage|home loan|loan repayment/i.test(l.what || "");
  });
  var interest = { charged: 0, modelled: 0, fees: 0 };
  if(!repaymentsAsSpending){
    (state.properties || []).forEach(function(p){
      (p.loans || []).forEach(function(l){
        var i = loanInterestCharged(l, w.start, w.end);
        interest.charged += i.charged; interest.modelled += i.modelled;
        interest.fees += loanFeesCharged(l, w.start, w.end);
      });
    });
  }
  var interestTotal = interest.charged + interest.modelled + interest.fees;
  var kept = moneyIn - spent - interestTotal;
  var from = dayBefore(w.start), a = netWorthOn(from, today), b = netWorthOn(w.end, today);
  var cash = (b.parts.assets.Cash || 0) - (a.parts.assets.Cash || 0);
  var offsets = b.parts.offsets - a.parts.offsets;
  var loans = a.parts.loans - b.parts.loans;
  var debts = a.parts.debts - b.parts.debts;
  var bought = 0, sold = 0;
  (state.assets || []).filter(function(x){ return x && x.category === "Shares"; }).forEach(function(x){
    (x.lots || []).filter(inWin).forEach(function(l){ bought += toAudAmount(x, (Number(l.units) || 0) * (Number(l.price) || 0) + (Number(l.brokerage) || 0)); });
    (x.sales || []).filter(inWin).forEach(function(s){ sold += toAudAmount(x, Number(s.proceeds) || 0); });
  });
  var moves = [
    { key: "cash", label: "Cash and savings", amount: r2(cash) },
    { key: "offsets", label: "Offset accounts", amount: r2(offsets) },
    { key: "loans", label: loans >= 0 ? "Loans paid down" : "Borrowed on loans", amount: r2(loans) },
    { key: "debts", label: debts >= 0 ? "Cards and other debts paid down" : "Cards and other debts grew", amount: r2(debts) },
    { key: "shares", label: bought - sold >= 0 ? "Shares bought, less sold" : "Shares sold, less bought", amount: r2(bought - sold) }
  ];
  var accounted = moves.reduce(function(s, m){ return s + m.amount; }, 0);

  // What's missing.
  var balances = [];
  var check = function(name, history, current){
    var s = lastRecord(history, from), e = lastRecord(history, w.end);
    if(!(history && history.length)){ if(Number(current)) balances.push(name + " — no balances recorded, so its change isn't known"); return; }
    if(!s) balances.push(name + " — no balance recorded before " + w.label + " began");
    else if(daysBetween(s, from) > STALE_DAYS) balances.push(name + " — the last balance before the year is from " + fmtDate(s, { year: true }));
    if(!e) balances.push(name + " — no balance recorded by the end of " + w.label);
    else if(daysBetween(e, w.end) > STALE_DAYS) balances.push(name + " — the last balance in the year is from " + fmtDate(e, { year: true }));
  };
  (state.assets || []).filter(function(x){ return x && x.category === "Cash"; }).forEach(function(x){ check(x.what || "A cash account", x.history, x.amount); });
  (state.debts || []).forEach(function(d){ check(d.what || "A debt", d.history, d.balance); });
  (state.properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l){
      var name = l.what || ((p.what || "A property") + "'s loan");
      check(name, l.balanceHistory, l.balance);
      if(Number(l.offsetBalance) || (l.offsetHistory && l.offsetHistory.length)) check(name + "'s offset", l.offsetHistory, l.offsetBalance);
    });
  });
  var months = [];
  var logged = {};
  (state.transactions || []).concat(state.incomeLog || []).filter(inWin).forEach(function(r){ logged[r.date.slice(0, 7)] = true; });
  for(var y = Number(w.start.slice(0, 4)), m = Number(w.start.slice(5, 7)); ; ){
    var ym = y + "-" + String(m).padStart(2, "0");
    if(ym > w.end.slice(0, 7) || (today && ym > today.slice(0, 7))) break;
    if(!logged[ym]) months.push({ ym: ym, label: monthLabel(ym) });
    m++; if(m > 12){ m = 1; y++; }
  }
  return {
    moneyIn: r2(moneyIn), spending: { needs: r2(spend.Needs), wants: r2(spend.Wants), other: r2(spend.Other), total: r2(spent) },
    interest: { total: r2(interestTotal), charged: r2(interest.charged), modelled: r2(interest.modelled), fees: r2(interest.fees), repaymentsAsSpending: repaymentsAsSpending },
    kept: r2(kept), moves: moves, accounted: r2(accounted), unaccounted: r2(kept - accounted),
    missing: { balances: balances, months: months },
    complete: !balances.length && !months.length
  };
}
