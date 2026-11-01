import { financialYearOf, fyWindow, loanInterestForWindow, loanInvestShare, borrowingCostsDeduction, propertyDepreciationForFy, propertyTaxResultBreakdown } from "./property.js";
import { propertyClaimLines } from "./claims.js";
import { overlapDaysInclusive } from "./ledger.js";

// ---------------- A property's financial year so far, actual (v3.209.0, item 241) ----------------
//
// The Tax tab's rental result is the plan: the rent and cost lines' yearly amounts. This is the same year as it
// actually went, from 1 July to today (or the whole year, once it's over):
//   rent         — each property manager statement's rent and water recovered, plus rent received directly
//                  (money received on the property that no statement wrote);
//   costs        — the statements' agency fees, plus every payment logged against the property's cost lines,
//                  the bills its statements paid, and household budget lines claimed against it;
//   interest, depreciation, borrowing costs — never logged, so worked out for the same days, as the tax
//                  worksheet does: interest from the loans' rates, depreciation and borrowing costs pro rata.
// Beside it, the plan for the same days (the year's plan × the share of the year gone), so a gap reads as a gap
// and not as "it's only November". Pure: everything comes in through `st`.

function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function within(d, a, b){ return !!d && d >= a && d <= b; }

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
  var lines = {};
  (p.expenses || []).forEach(function(e){ if(e && e.id) lines[e.id] = true; });
  propertyClaimLines(p.id, items).forEach(function(i){ if(i.id) lines[i.id] = true; });
  var paid = (st.transactions || []).filter(function(t){ return within(t.date, win.start, end) && ((t.linkedExpenseId && lines[t.linkedExpenseId]) || stmtTx[t.id]); });
  var fees = stmts.reduce(function(s, r){ return s + (Number(r.fees) || 0); }, 0);
  var costs = fees + paid.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
  // Worked out for the same days.
  var interest = (p.loans || []).reduce(function(s, l){
    if(l.endedOn && l.endedOn < win.start) return s;
    var stop = l.endedOn && l.endedOn <= end ? new Date(Date.parse(l.endedOn) - 86400000).toISOString().slice(0, 10) : end;
    return s + loanInterestForWindow(l, win.start, stop) * loanInvestShare(l);
  }, 0);
  var dep = propertyDepreciationForFy(p, fy);
  var depreciation = ((Number(dep.capitalWorks) || 0) + (Number(dep.plant) || 0)) * frac;
  var borrowing = (p.loans || []).reduce(function(s, l){ return s + borrowingCostsDeduction(l, { start: win.start, end: end }); }, 0);
  // The plan, for the same share of the year.
  var plan = {};
  propertyTaxResultBreakdown(p).rows.forEach(function(row){ plan[row.key] = row.amount * frac; });
  var rows = [
    { key: "rent", label: "Rent", actual: r2(rent), plan: r2(plan.rent), logged: true },
    { key: "expenses", label: "Costs", actual: r2(-costs), plan: r2((plan.expenses || 0) + (plan.claims || 0)), logged: true },
    { key: "interest", label: "Loan interest", actual: r2(-interest), plan: r2(plan.interest), logged: false },
    { key: "depreciation", label: "Depreciation", actual: r2(-depreciation), plan: r2(plan.depreciation), logged: false },
    { key: "borrowing", label: "Borrowing costs", actual: r2(-borrowing), plan: r2(plan.borrowing), logged: false }
  ];
  var net = rows.reduce(function(s, r){ return s + r.actual; }, 0), planNet = rows.reduce(function(s, r){ return s + r.plan; }, 0);
  return {
    fy: fy, start: win.start, end: end, wholeYear: end === win.end, share: frac,
    rows: rows, net: r2(net), planNet: r2(planNet),
    statements: stmts.length, received: direct.length, payments: paid.length,
    nothingLogged: !stmts.length && !direct.length && !paid.length
  };
}

// The financial year the Tax tab means: the one holding today, or the household's chosen period's if that's over.
export function actualFyFor(periodEnd, today){
  return financialYearOf(periodEnd && periodEnd < today ? periodEnd : today);
}
