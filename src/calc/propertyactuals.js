import { financialYearOf, fyWindow, loanInvestShare, borrowingCostsDeduction, propertyDepreciationForFy, propertyTaxResultBreakdown } from "./property.js";
import { propertyClaimLines } from "./claims.js";
import { rentLineFor, rentLineForExpense } from "./taxyear.js";
import { overlapDaysInclusive } from "./ledger.js";
import { loanInterestCharged, loanFeesCharged } from "./loancharges.js";

// ---------------- A property's financial year so far, actual (v3.209.0, item 241) ----------------
//
// The Tax tab's rental result is the plan: the rent and cost lines' yearly amounts. This is the same year as it
// actually went, from 1 July to today (or the whole year, once it's over):
//   rent         — each property manager statement's rent and water recovered, plus rent received directly
//                  (money received on the property that no statement wrote);
//   costs        — the statements' agency fees, plus every payment logged against the property's cost lines,
//                  the bills its statements paid, and household budget lines claimed against it (at their
//                  deductible share);
//   interest     — what the bank charged, from the loans' imported statements (item 243), worked out from the
//                  loans' rates only for the days no charge covers; the loans' fees count as costs;
//   depreciation, borrowing costs — never logged, so worked out for the same days, as the tax worksheet does.
// Beside it, the plan for the same days (the year's plan × the share of the year gone), so a gap reads as a gap
// and not as "it's only November". Pure: everything comes in through `st`.

function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function within(d, a, b){ return !!d && d >= a && d <= b; }
// The share of a claimed household line that's deductible (deductiblePct, 100 when unset).
function deductibleShare(i){ return i.deductiblePct == null ? 1 : Math.max(0, Math.min(100, Number(i.deductiblePct) || 0)) / 100; }

// `fy`: the financial year (2026 = FY26/27). `today`: "YYYY-MM-DD". `st`: the app state. `items`: the household's
// claimable lines (claimItems()), when known. Null when the year hasn't started.
export function propertyYearActual(p, fy, today, st, items){
  var win = fyWindow(fy);
  if(today < win.start) return null;
  var end = today < win.end ? today : win.end;
  var frac = overlapDaysInclusive(win.start, end, win.start, end) / overlapDaysInclusive(win.start, win.end, win.start, win.end);
  var stmts = (p.agentStatements || []).filter(function(r){ return within(r.date, win.start, end); });
  var stmtIncome = {}, stmtTx = {};
  (p.agentStatements || []).forEach(function(r){ if(r.incomeId) stmtIncome[r.incomeId] = true; (r.txIds || []).forEach(function(id){ stmtTx[id] = true; }); });
  // Rent: as the statements collected it, and anything received for the property without one.
  var direct = (st.incomeLog || []).filter(function(r){ return r.target === "rent:" + p.id && !stmtIncome[r.id] && within(r.date, win.start, end); });
  var rent = stmts.reduce(function(s, r){ return s + (Number(r.rent) || 0) + (Number(r.water) || 0); }, 0) +
    direct.reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
  // Costs: the agency's fees, and payments against the property's own lines or lines claimed against it.
  // A property's own line counts in full; a household line claimed against it, at its deductible share.
  var lines = {};
  propertyClaimLines(p.id, items).forEach(function(i){ if(i.id) lines[i.id] = deductibleShare(i); });
  (p.expenses || []).forEach(function(e){ if(e && e.id) lines[e.id] = 1; });
  var paid = (st.transactions || []).filter(function(t){ return within(t.date, win.start, end) && ((t.linkedExpenseId && lines[t.linkedExpenseId] != null) || stmtTx[t.id]); });
  var fees = stmts.reduce(function(s, r){ return s + (Number(r.fees) || 0); }, 0);
  var costs = fees + paid.reduce(function(s, t){ var share = t.linkedExpenseId && lines[t.linkedExpenseId] != null ? lines[t.linkedExpenseId] : 1; return s + (Number(t.amount) || 0) * share; }, 0);
  // As the bank charged it, worked out for the days it hasn't yet.
  var li = loansInterest(p, win.start, end);
  var interest = li.amount;
  costs += li.fees;
  var dep = propertyDepreciationForFy(p, fy);
  var depreciation = ((Number(dep.capitalWorks) || 0) + (Number(dep.plant) || 0)) * frac;
  var borrowing = (p.loans || []).reduce(function(s, l){ return s + borrowingCostsDeduction(l, { start: win.start, end: end }); }, 0);
  // The plan, for the same share of the year.
  var plan = {};
  propertyTaxResultBreakdown(p).rows.forEach(function(row){ plan[row.key] = row.amount * frac; });
  var rows = [
    { key: "rent", label: "Rent", actual: r2(rent), plan: r2(plan.rent), logged: true },
    { key: "expenses", label: "Costs", actual: r2(-costs), plan: r2((plan.expenses || 0) + (plan.claims || 0)), logged: true },
    { key: "interest", label: "Loan interest", actual: r2(-interest), plan: r2(plan.interest), logged: li.charged > 0 && li.modelled < 0.005,
      charged: li.charged, chargedTo: li.to },
    { key: "depreciation", label: "Depreciation", actual: r2(-depreciation), plan: r2(plan.depreciation), logged: false },
    { key: "borrowing", label: "Borrowing costs", actual: r2(-borrowing), plan: r2(plan.borrowing), logged: false }
  ];
  var net = rows.reduce(function(s, r){ return s + r.actual; }, 0), planNet = rows.reduce(function(s, r){ return s + r.plan; }, 0);
  return {
    fy: fy, start: win.start, end: end, wholeYear: end === win.end, share: frac,
    rows: rows, net: r2(net), planNet: r2(planNet),
    statements: stmts.length, received: direct.length, payments: paid.length, charges: li.count,
    nothingLogged: !stmts.length && !direct.length && !paid.length && !li.count
  };
}

// A property's loans' interest over [start, end] at their invest share — { amount, charged, modelled, fees, count, to }:
// as charged where their statements cover it (calc/loancharges.js), worked out elsewhere; up to the day before any
// payout. `to` is the latest day the charges reach. Fees, also at the invest share, as charged.
export function loansInterest(p, start, end){
  var out = { amount: 0, charged: 0, modelled: 0, fees: 0, count: 0, to: null };
  (p.loans || []).forEach(function(l){
    if(l.endedOn && l.endedOn < start) return;
    var stop = l.endedOn && l.endedOn <= end ? new Date(Date.parse(l.endedOn) - 86400000).toISOString().slice(0, 10) : end;
    var share = loanInvestShare(l), res = loanInterestCharged(l, start, stop);
    out.amount += res.amount * share; out.charged += res.charged * share; out.modelled += res.modelled * share;
    out.fees += loanFeesCharged(l, start, stop) * share;
    out.count += res.count;
    if(res.to && (!out.to || res.to > out.to)) out.to = res.to;
  });
  ["amount", "charged", "modelled", "fees"].forEach(function(k){ out[k] = r2(out[k]); });
  return out;
}

// The financial year the Tax tab means: the one holding today, or the household's chosen period's if that's over.
export function actualFyFor(periodEnd, today){
  return financialYearOf(periodEnd && periodEnd < today ? periodEnd : today);
}

// ---------------- The rental schedule from what's logged (v3.210.0, item 242) ----------------
//
// The same logged money as propertyYearActual, by the return line each piece goes on (calc/taxyear.js RENT_LINES):
// statements' rent → Rental income, the tenant's water recovered → Other rental-related income, the agency's fees →
// Agent fees; a payment against one of the property's cost lines → that line's return line (rentLineFor: its own
// choice, else its name — council rates, insurance, repairs…); a bill a statement paid without a line → by its
// words; a household line claimed against the property → its return line, at its deductible share; the interest and
// fees its loans' statements recorded (item 243) → Interest on loans and the fee's line, at the loan's invest share.
// Borrowing costs and depreciation aren't logged; the schedule works those out already. `has` names the lines with
// anything logged, so a line with nothing keeps the plan rather than becoming zero.
export function rentalLogged(p, fy, today, st, items){
  var win = fyWindow(fy);
  var out = { lines: {}, has: {}, count: 0, end: today < win.end ? today : win.end, wholeYear: today >= win.end };
  if(today < win.start) return out;
  var end = out.end;
  var add = function(key, amount){ if(!amount) return; out.lines[key] = Math.round(((out.lines[key] || 0) + amount) * 100) / 100; out.has[key] = true; };
  var stmtIncome = {}, stmtTx = {};
  (p.agentStatements || []).forEach(function(r){
    if(r.incomeId) stmtIncome[r.incomeId] = true;
    (r.txIds || []).forEach(function(id){ stmtTx[id] = true; });
    if(!within(r.date, win.start, end)) return;
    out.count++;
    add("rent", Number(r.rent) || 0); add("otherIncome", Number(r.water) || 0); add("agentFees", Number(r.fees) || 0);
  });
  (st.incomeLog || []).forEach(function(r){
    if(r.target === "rent:" + p.id && !stmtIncome[r.id] && within(r.date, win.start, end)){ out.count++; add("rent", Number(r.amount) || 0); }
  });
  var own = {}, claimed = {};
  (p.expenses || []).forEach(function(e){ if(e && e.id) own[e.id] = e; });
  propertyClaimLines(p.id, items).forEach(function(i){ if(i.id) claimed[i.id] = i; });
  // Item 243: the interest and fees the bank charged on its loans, as their statements recorded them.
  (p.loans || []).forEach(function(l){
    if(l.endedOn && l.endedOn < win.start) return;
    var share = loanInvestShare(l);
    (l.charges || []).forEach(function(c){
      if(!c || !within(c.date, win.start, end)) return;
      out.count++; add(c.kind === "interest" ? "interest" : rentLineForExpense(c.what), (Number(c.amount) || 0) * share);
    });
  });
  (st.transactions || []).forEach(function(t){
    if(!within(t.date, win.start, end)) return;
    var amt = Number(t.amount) || 0, line = t.linkedExpenseId && (own[t.linkedExpenseId] || claimed[t.linkedExpenseId]);
    if(line){
      out.count++; add(rentLineFor(line), amt * (own[t.linkedExpenseId] ? 1 : deductibleShare(line)));
    } else if(stmtTx[t.id]){ out.count++; add(rentLineForExpense(t.what), amt); }
  });
  return out;
}
