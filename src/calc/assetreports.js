// ---------------- Property, debt and super reports (v3.122.0) ----------------
//
// The Property P&L report is one year of the plan; the loans and super each live on their own
// cards. These put them side by side the way a review of the year would:
//   propertyReturns — yields, cash before and after repayments and tax, the last 12 months' growth
//                     and total return, growth a year since purchase, and value at each 30 June
//   debtSchedule    — every loan and debt: balance now and a year ago, rate, interest this year
//                     and last, the deductible share, and when it's paid off at today's repayments
//   loanPayoff      — months to pay a balance off at a fixed repayment, with an offset
// Pure apart from the property helpers it reads loans and depreciation through.
import { valueOn } from "./history.js";
import { sumField } from "./ledger.js";
import { propertyCostBase, propertyCashResultAnnual, propertyGearingAnnual, propertyTaxDeductibleResultAnnual,
  loanBalance, loanPaidOut, loanInterestForWindow, loanInvestShare, loanRepaymentMonthly, loanRateOn, fyWindow, financialYearOf, fyLabel } from "./property.js";

function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
export function shiftMonths(iso, n){
  var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n, 1);
  var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(Math.min(Number(iso.slice(8, 10)), last)).padStart(2, "0");
}
function yearsBetween(a, b){ return (Date.parse(b) - Date.parse(a)) / (365.25 * 86400000); }

// Months until `balance` is paid off at `monthly` a month with `offset` sitting against it, or null
// when the repayment doesn't cover the interest (or it would take more than 50 years).
export function loanPayoff(balance, ratePct, monthly, offset){
  var bal = Number(balance) || 0, r = (Number(ratePct) || 0) / 100 / 12, m = Number(monthly) || 0, off = Math.max(0, Number(offset) || 0);
  if(bal <= 0) return 0;
  for(var i = 1; i <= 600; i++){
    var interest = Math.max(0, bal - off) * r;
    if(m <= interest + 1e-9) return null;
    bal = bal + interest - m;
    if(bal <= 0.005) return i;
  }
  return null;
}

// props: the properties (any kind). opts: { today, rateOf(property) — the owners' marginal rate }.
export function propertyReturns(props, opts){
  opts = opts || {};
  var today = opts.today, yearAgo = shiftMonths(today, -12);
  return (props || []).map(function(p){
    var value = Number(p.value) || 0;
    var loans = (p.loans || []).reduce(function(s, l){ return s + loanBalance(l, today); }, 0);
    var offset = (p.loans || []).reduce(function(s, l){ return s + (loanPaidOut(l, today) ? 0 : Number(l.offsetBalance) || 0); }, 0);
    var ip = p.kind === "IP";
    var rent = ip ? sumField(p.income, "yearly") : 0, expenses = ip ? sumField(p.expenses, "yearly") : 0;
    var beforeRepay = ip ? propertyCashResultAnnual(p) : null; // rent less expenses and interest
    var afterRepay = ip ? propertyGearingAnnual(p) : null;     // …and the principal too
    var taxResult = ip ? propertyTaxDeductibleResultAnnual(p) : null;
    var rate = ip && opts.rateOf ? Number(opts.rateOf(p)) || 0 : 0;
    var taxEffect = ip ? -taxResult * rate : null;
    var valueThen = valueOn(p.history, yearAgo);
    var growth = valueThen != null ? value - valueThen : null;
    var loansThen = (p.loans || []).reduce(function(s, l){ var h = valueOn(l.balanceHistory, yearAgo); return s + (h != null ? h : loanBalance(l, today)); }, 0);
    var cost = propertyCostBase(p);
    var since = p.purchaseDate && Number(p.purchasePrice) > 0 && p.purchaseDate < today ? yearsBetween(p.purchaseDate, today) : null;
    var years = [];
    if(Array.isArray(p.history) && p.history.length){
      var first = p.history.reduce(function(m, h){ return h.date && h.date < m ? h.date : m; }, today);
      for(var fy = financialYearOf(first); fy <= financialYearOf(today); fy++){
        var end = fyWindow(fy).end, at = end < today ? end : today;
        var v = at === today ? value : valueOn(p.history, at);
        if(v != null) years.push({ fy: fy, label: fyLabel(fy), date: at, value: r2(v) });
      }
    }
    return { id: p.id, name: p.what || "Property", ip: ip, value: r2(value), cost: cost == null ? null : r2(cost), loans: r2(loans), equity: r2(value - loans + offset),
      lvr: value > 0 ? loans / value : null, rent: r2(rent), expenses: r2(expenses),
      grossYield: ip && value > 0 ? rent / value : null, netYield: ip && value > 0 ? (rent - expenses) / value : null,
      beforeRepay: beforeRepay == null ? null : r2(beforeRepay), afterRepay: afterRepay == null ? null : r2(afterRepay),
      taxEffect: taxEffect == null ? null : r2(taxEffect), afterTax: afterRepay == null ? null : r2(afterRepay + taxEffect),
      growth: growth == null ? null : r2(growth), equityGrowth: valueThen == null ? null : r2((value - loans) - (valueThen - loansThen)),
      totalReturn: growth == null ? null : r2(growth + (beforeRepay || 0) + (taxEffect || 0)),
      growthPa: since != null && since >= 1 && value > 0 ? Math.pow(value / Number(p.purchasePrice), 1 / since) - 1 : null,
      years: years };
  });
}

// Every loan (on a property) and debt. props, debts: the state arrays.
export function debtSchedule(props, debts, opts){
  opts = opts || {};
  var today = opts.today, yearAgo = shiftMonths(today, -12);
  var fy = financialYearOf(today), cur = fyWindow(fy), prev = fyWindow(fy - 1);
  var rows = [];
  (props || []).forEach(function(p){
    (p.loans || []).forEach(function(l, i){
      if(loanPaidOut(l, today)) return;
      var bal = loanBalance(l, today), then = valueOn(l.balanceHistory, yearAgo);
      var monthly = loanRepaymentMonthly(l), rate = Number(loanRateOn(l, today)) || Number(l.rate) || 0;
      var share = loanInvestShare(l), io = l.repaymentType === "IO" && l.repaymentMode !== "manual";
      var months = io ? null : loanPayoff(bal, rate, monthly, l.offsetBalance);
      var thisYear = loanInterestForWindow(l, cur.start, today < cur.end ? today : cur.end), lastYear = loanInterestForWindow(l, prev.start, prev.end);
      rows.push({ name: (p.what || "Property") + ((p.loans || []).length > 1 ? " — " + (l.what || "loan " + (i + 1)) : ""), kind: "loan",
        balance: r2(bal), then: then == null ? null : r2(then), offset: r2(Number(l.offsetBalance) || 0), rate: rate, monthly: r2(monthly),
        interestThisYear: r2(thisYear), interestLastYear: r2(lastYear), deductibleShare: p.kind === "IP" ? share : 0,
        deductibleLastYear: r2(p.kind === "IP" ? lastYear * share : 0), interestOnly: io,
        months: months, payoff: months == null ? null : shiftMonths(today, months) });
    });
  });
  (debts || []).forEach(function(d){
    var bal = Number(d.balance) || 0;
    if(!bal) return;
    var then = valueOn(d.history, yearAgo);
    rows.push({ name: d.what || "Debt", kind: "debt", balance: r2(bal), then: then == null ? null : r2(then), offset: 0, rate: null, monthly: null,
      interestThisYear: null, interestLastYear: null, deductibleShare: 0, deductibleLastYear: 0, interestOnly: false, months: null, payoff: null });
  });
  return { rows: rows, fy: fy, thisLabel: cur.label, lastLabel: prev.label };
}
