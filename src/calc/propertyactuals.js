import { financialYearOf, fyWindow, loanInvestShare, borrowingCostsDeduction, propertyDepreciationForFy, propertyTaxResultBreakdown } from "./property.js";
import { propertyClaimLines } from "./claims.js";
import { rentLineFor, rentLineForExpense } from "./taxyear.js";
import { overlapDaysInclusive } from "./ledger.js";
import { loanInterestCharged } from "./loancharges.js";
import { removeAgentStatement } from "./agentstatement.js";

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

// ---------------- One property ledger (item 244) ----------------
//
// Everything logged about a property in [start, end], one entry per piece of money, each with the return line it goes
// on (calc/taxyear.js RENT_LINES) — the one list the year so far, the rental schedule's logged figures, the property's
// Activity tab and its tax pack all read, so they can't disagree:
//   a property manager statement   → its rent (Rental income), water recovered (Other rental-related income) and
//                                    fees (Agent fees); the bills it paid are transactions, below;
//   rent received directly         → Rental income (money received on the property that no statement wrote);
//   a payment against its own cost line → that line's return line (rentLineFor), in full;
//   a payment against a household line claimed against it → that line's return line, at its deductible share;
//   a bill a statement paid without a line → by its words (rentLineForExpense);
//   its loans' interest and fees as the bank charged them (item 243) → Interest on loans / the fee's line, at the
//                                    loan's invest share, up to any payout.
// Entry: { key, date, amount, gross, share, side: "income" | "cost", line, source, what, ref: { kind, id, loanId },
// lineId } — `amount` is what counts (gross × share); `ref` names the record behind it, which can hold several entries
// (a statement's rent and fees). Sorted by date. Pure: everything comes in through `st`.
export function propertyLedger(p, start, end, st, items){
  var out = [];
  var push = function(e){ e.amount = r2(e.gross * e.share); if(e.amount) out.push(e); };
  var stmtIncome = {}, stmtTx = {};
  (p.agentStatements || []).forEach(function(r){
    if(r.incomeId) stmtIncome[r.incomeId] = true;
    (r.txIds || []).forEach(function(id){ stmtTx[id] = r.id; });
    if(!within(r.date, start, end)) return;
    var ref = { kind: "statement", id: r.id };
    push({ key: "st:" + r.id + ":rent", date: r.date, gross: Number(r.rent) || 0, share: 1, side: "income", line: "rent", source: "statement", what: "Rent collected", ref: ref });
    push({ key: "st:" + r.id + ":water", date: r.date, gross: Number(r.water) || 0, share: 1, side: "income", line: "otherIncome", source: "statement", what: "Water recovered", ref: ref });
    push({ key: "st:" + r.id + ":fees", date: r.date, gross: Number(r.fees) || 0, share: 1, side: "cost", line: "agentFees", source: "statement", what: "Management fees", ref: ref });
  });
  (st.incomeLog || []).forEach(function(r){
    if(r.target !== "rent:" + p.id || stmtIncome[r.id] || !within(r.date, start, end)) return;
    push({ key: "rc:" + r.id, date: r.date, gross: Number(r.amount) || 0, share: 1, side: "income", line: "rent", source: "received", what: r.what || "Rent received", ref: { kind: "received", id: r.id } });
  });
  var own = {}, claimed = {};
  (p.expenses || []).forEach(function(e){ if(e && e.id) own[e.id] = e; });
  propertyClaimLines(p.id, items).forEach(function(i){ if(i.id && !own[i.id]) claimed[i.id] = i; });
  (st.transactions || []).forEach(function(t){
    if(!within(t.date, start, end)) return;
    var lid = t.linkedExpenseId, line = lid && (own[lid] || claimed[lid]);
    if(!line && !stmtTx[t.id]) return;
    push({ key: "tx:" + t.id, date: t.date, gross: Number(t.amount) || 0, share: line && !own[lid] ? deductibleShare(line) : 1, side: "cost",
      line: line ? rentLineFor(line) : rentLineForExpense(t.what), source: line ? (own[lid] ? "payment" : "claimed") : "statementBill",
      what: t.what || (line && line.what) || "Payment", ref: { kind: "tx", id: t.id, statementId: stmtTx[t.id] || null }, lineId: line ? lid : null });
  });
  (p.loans || []).forEach(function(l){
    if(l.endedOn && l.endedOn < start) return;
    var share = loanInvestShare(l);
    (l.charges || []).forEach(function(c){
      if(!c || !within(c.date, start, end)) return;
      push({ key: "lc:" + c.id, date: c.date, gross: Number(c.amount) || 0, share: share, side: "cost",
        line: c.kind === "interest" ? "interest" : rentLineForExpense(c.what), source: c.kind === "interest" ? "interest" : "loanFee",
        what: c.what || (c.kind === "interest" ? "Interest charge" : "Loan fee"), ref: { kind: "charge", id: c.id, loanId: l.id, loan: l.what || "Loan" } });
    });
  });
  return out.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

// Removes the record behind a ledger entry — a statement (with the rent and bills it logged), rent received, a payment,
// or a loan's charge — from `st`. False when it's already gone.
export function removeLedgerRecord(st, p, kind, id, loanId){
  var drop = function(list){ var i = (list || []).findIndex(function(x){ return x && x.id === id; }); if(i === -1) return false; list.splice(i, 1); return true; };
  if(kind === "statement") return removeAgentStatement(st, p, id);
  if(kind === "received") return drop(st.incomeLog);
  if(kind === "tx") return drop(st.transactions);
  if(kind === "charge"){ var l = (p.loans || []).find(function(x){ return x.id === loanId; }); return !!l && drop(l.charges); }
  return false;
}

// The records behind a ledger, counted by kind: { statements, received, payments, charges, records }.
export function ledgerCounts(entries){
  var seen = {}, out = { statements: 0, received: 0, payments: 0, charges: 0, records: 0 };
  entries.forEach(function(e){
    var k = e.ref.kind + ":" + e.ref.id;
    if(seen[k]) return;
    seen[k] = true; out.records++;
    if(e.ref.kind === "statement") out.statements++;
    else if(e.ref.kind === "received") out.received++;
    else if(e.ref.kind === "charge"){ if(e.line === "interest") out.charges++; }
    else out.payments++;
  });
  return out;
}

// `fy`: the financial year (2026 = FY26/27). `today`: "YYYY-MM-DD". `st`: the app state. `items`: the household's
// claimable lines (claimItems()), when known. Null when the year hasn't started.
export function propertyYearActual(p, fy, today, st, items){
  var win = fyWindow(fy);
  if(today < win.start) return null;
  var end = today < win.end ? today : win.end;
  var frac = overlapDaysInclusive(win.start, end, win.start, end) / overlapDaysInclusive(win.start, win.end, win.start, win.end);
  var ledger = propertyLedger(p, win.start, end, st, items), counts = ledgerCounts(ledger);
  var rent = 0, costs = 0;
  ledger.forEach(function(e){ if(e.side === "income") rent += e.amount; else if(e.line !== "interest") costs += e.amount; });
  // Interest: as the bank charged it, worked out for the days it hasn't yet.
  var li = loansInterest(p, win.start, end);
  var interest = li.amount;
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
    statements: counts.statements, received: counts.received, payments: counts.payments, charges: counts.charges,
    nothingLogged: !counts.records
  };
}

// A property's loans' interest over [start, end] at their invest share — { amount, charged, modelled, count, to }:
// as charged where their statements cover it (calc/loancharges.js), worked out elsewhere; up to the day before any
// payout. `to` is the latest day the charges reach. (Their fees are in propertyLedger.)
export function loansInterest(p, start, end){
  var out = { amount: 0, charged: 0, modelled: 0, count: 0, to: null };
  (p.loans || []).forEach(function(l){
    if(l.endedOn && l.endedOn < start) return;
    var stop = l.endedOn && l.endedOn <= end ? new Date(Date.parse(l.endedOn) - 86400000).toISOString().slice(0, 10) : end;
    var share = loanInvestShare(l), res = loanInterestCharged(l, start, stop);
    out.amount += res.amount * share; out.charged += res.charged * share; out.modelled += res.modelled * share;
    out.count += res.count;
    if(res.to && (!out.to || res.to > out.to)) out.to = res.to;
  });
  ["amount", "charged", "modelled"].forEach(function(k){ out[k] = r2(out[k]); });
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
// anything logged, so a line with nothing keeps the plan rather than becoming zero. Item 244: it adds up
// propertyLedger by line; `last` is each line's latest entry and `byLine` how many entries make it.
export function rentalLogged(p, fy, today, st, items){
  var win = fyWindow(fy);
  var out = { lines: {}, has: {}, count: 0, last: {}, end: today < win.end ? today : win.end, wholeYear: today >= win.end };
  if(today < win.start) return out;
  var ledger = propertyLedger(p, win.start, out.end, st, items);
  ledger.forEach(function(e){
    out.lines[e.line] = r2((out.lines[e.line] || 0) + e.amount); out.has[e.line] = true;
    if(!out.last[e.line] || e.date > out.last[e.line]) out.last[e.line] = e.date;
  });
  out.byLine = {};
  ledger.forEach(function(e){ out.byLine[e.line] = (out.byLine[e.line] || 0) + 1; });
  out.count = ledgerCounts(ledger).records;
  return out;
}
