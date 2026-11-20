// Loan strategy (v3.41.0) — the four questions people actually ask about a mortgage, answered by
// running the loan month by month rather than with rules of thumb. Pure.
import { calcRepaymentMonthly } from "./property.js";

// Months to pay the loan off and the interest paid on the way, with an optional extra repayment
// each month and money sitting in offset (interest is charged on balance less offset; the offset
// itself never repays anything). Interest-only loans don't amortise: one year of interest.
export function runLoan(balance, ratePct, repayment, opts){
  opts = opts || {};
  var bal = Math.max(0, Number(balance) || 0);
  var r = (Number(ratePct) || 0) / 100 / 12;
  var offset = Math.max(0, Number(opts.offset) || 0);
  var pay = Math.max(0, Number(repayment) || 0) + Math.max(0, Number(opts.extra) || 0);
  var months = 0, interest = 0;
  var cap = opts.maxMonths == null ? 600 : Number(opts.maxMonths);
  if(!Number.isSafeInteger(cap) || cap < 1){ throw new RangeError("maxMonths must be a positive safe integer"); }
  while(bal > 0.005 && months < cap){
    var i = Math.max(0, bal - offset) * r;
    interest += i;
    bal = bal + i - pay;
    months++;
    if(pay <= i && bal > 0.005){ return { months: null, interest: null, neverPaid: true, status: "non-amortising" }; }
  }
  if(bal > 0.005){ return { months: null, interest: null, neverPaid: true, status: "capped" }; }
  return { months: months, interest: Math.round(interest), neverPaid: false, status: "paid-off" };
}
// Everything the Loan strategy section shows, for one loan. s = the loan's saved inputs.
export function loanStrategy(loan, s){
  s = s || {};
  var balance = Number(loan.balance) || 0;
  var rate = Number(loan.rate) || 0;
  var term = Number(loan.termYears) || 0;
  var io = loan.repaymentType === "IO";
  var repayment = calcRepaymentMonthly(balance, rate, term, loan.repaymentType);
  var offset = Number(loan.offsetBalance) || 0;
  var base = io ? null : runLoan(balance, rate, repayment, { offset: offset });
  var out = { io: io, repayment: Math.round(repayment), base: base };
  var extra = Number(s.extra) || 0;
  if(!io && extra > 0){
    var withExtra = runLoan(balance, rate, repayment, { offset: offset, extra: extra });
    out.extra = { amount: extra, months: withExtra.months, interest: withExtra.interest,
      status: withExtra.status,
      monthsSaved: base.status === "paid-off" && withExtra.status === "paid-off" ? base.months - withExtra.months : null,
      interestSaved: base.status === "paid-off" && withExtra.status === "paid-off" ? base.interest - withExtra.interest : null };
  }
  var offsetAdd = Number(s.offsetAdd) || 0;
  if(offsetAdd > 0){
    var yearlySaved = offsetAdd * rate / 100;
    out.offset = { amount: offsetAdd, yearlySaved: Math.round(Math.min(yearlySaved, Math.max(0, balance - offset) * rate / 100)) };
    if(!io){
      var withOffset = runLoan(balance, rate, repayment, { offset: offset + offsetAdd });
      out.offset.months = withOffset.months;
      out.offset.status = withOffset.status;
      out.offset.monthsSaved = base.status === "paid-off" && withOffset.status === "paid-off" ? base.months - withOffset.months : null;
      out.offset.interestSaved = base.status === "paid-off" && withOffset.status === "paid-off" ? base.interest - withOffset.interest : null;
    }
  }
  var newRate = s.newRate === "" || s.newRate == null ? null : Number(s.newRate);
  if(newRate != null && isFinite(newRate)){
    var newRep = calcRepaymentMonthly(balance, newRate, term, loan.repaymentType);
    out.rate = { newRate: newRate, repayment: Math.round(newRep), monthlyChange: Math.round(newRep - repayment), yearlyChange: Math.round((newRep - repayment) * 12) };
  }
  var refiRate = s.refiRate === "" || s.refiRate == null ? null : Number(s.refiRate);
  if(refiRate != null && isFinite(refiRate)){
    var refiRep = calcRepaymentMonthly(balance, refiRate, term, loan.repaymentType);
    var monthlySaving = repayment - refiRep;
    var costs = Math.max(0, Number(s.refiCosts) || 0) - Math.max(0, Number(s.cashback) || 0);
    out.refi = { rate: refiRate, repayment: Math.round(refiRep), monthlySaving: Math.round(monthlySaving),
      firstYearInterestSaved: Math.round(Math.max(0, balance - offset) * (rate - refiRate) / 100),
      netCosts: Math.round(costs),
      breakEvenMonths: monthlySaving > 0 ? Math.max(0, Math.ceil(costs / monthlySaving)) : null };
  }
  return out;
}

// ---- Spare cash, four ways (#455, November 2026) ----
//
// The same amount, on one loan, over the same timeline: kept as cash; in a savings account (its rate, less the holder's
// tax); in the offset (interest charged on the balance less it — it never repays anything, and it's still yours to
// take back); or paid off the loan (the balance less it — back only through redraw, if the loan has it). A
// principal-and-interest repayment stays what the bank set, so an offset or a lump sum pays the loan off sooner; once
// it's paid, the repayment it no longer needs goes to cash, so the four stay comparable to the end. On an investment
// loan the interest saved is shown after the tax that would have been claimed back (`deductiblePct`, the owners' rate,
// shown and editable — an estimate, not tax advice). Nothing here is spending or a second asset: the amount is counted
// once, wherever it sits.
// o: { amount, savingsRate (null: not known), savingsTaxPct, deductiblePct, rateShift, redraw, years: [1, 5, 10] }
export function cashStrategies(loan, o){
  o = o || {};
  var amount = Math.max(0, Number(o.amount) || 0);
  var balance0 = Math.max(0, Number(loan.balance) || 0), offset0 = Math.max(0, Number(loan.offsetBalance) || 0);
  var rate = (Number(loan.rate) || 0) + (Number(o.rateShift) || 0);
  var io = loan.repaymentType === "IO";
  var repayment = io ? null : calcRepaymentMonthly(balance0, rate, Number(loan.termYears) || 30, "PI");
  var savings = o.savingsRate == null || o.savingsRate === "" ? null : (Number(o.savingsRate) || 0) * (1 - (Number(o.savingsTaxPct) || 0) / 100);
  var ded = Math.min(100, Math.max(0, Number(o.deductiblePct) || 0)) / 100;
  var years = o.years || [1, 5, 10], horizon = Math.max.apply(null, years) * 12;
  function run(kind){
    var bal = kind === "extra" ? Math.max(0, balance0 - amount) : balance0;
    var off = offset0 + (kind === "offset" ? amount : 0);
    // Cash to hand: the amount when it's kept or saved; in the offset it's counted as the offset (still yours), paid off
    // the loan it's gone (but for redraw).
    var cash = kind === "keep" || kind === "savings" ? amount : 0, sched = balance0, interest = 0, paidAt = null, at = {};
    var r = rate / 100 / 12, monthlySavings = savings == null ? 0 : savings / 100 / 12;
    // Interest only: the same outflow every way — today's interest — so a month's interest not charged is cash kept.
    var ioOut = Math.max(0, balance0 - offset0) * r;
    for(var m = 1; m <= 600; m++){
      var pay = io ? Math.max(0, bal - off) * r : repayment;
      if(io) cash += Math.max(0, ioOut - pay);
      if(bal > 0.005){
        var i = Math.max(0, bal - off) * r;
        interest += i;
        var principal = io ? 0 : Math.min(bal, pay - i);
        bal = Math.max(0, bal - principal);
        // Paid off — or, with an offset, covered by it: interest stops and it could be closed that month.
        if(bal - off <= 0.005 && paidAt == null){ paidAt = m; }
        // Paid before the month's repayment was used up: what's left of it is cash.
        if(!io && pay - i > principal) cash += pay - i - principal;
      } else if(!io){ cash += pay; }
      if(kind === "savings") cash += cash * monthlySavings;
      // The schedule without the lump sum, for what redraw would give back.
      if(!io && sched > 0.005){ var si = Math.max(0, sched - offset0) * r; sched = Math.max(0, sched - Math.min(sched, repayment - si)); }
      if(years.indexOf(m / 12) !== -1){
        var avail = cash + (kind === "offset" ? amount : 0);
        if(kind === "extra" && o.redraw) avail += Math.max(0, (io ? balance0 : sched) - bal);
        at[m / 12] = { balance: Math.round(bal), interest: Math.round(interest), cash: Math.round(avail) };
      }
      if(m >= horizon && (paidAt != null || io || m >= 600)) break;
    }
    if(!io && bal - off > 0.005 && paidAt == null){
      // Not paid off within the horizon: keep running (no cash needed) just to find the payoff month.
      var b2 = bal;
      for(var k = m + 1; k <= 600 && b2 - off > 0.005; k++){ var i2 = Math.max(0, b2 - off) * r; b2 = Math.max(0, b2 - Math.min(b2, repayment - i2)); if(b2 - off <= 0.005) paidAt = k; }
    }
    return { kind: kind, at: at, paidOffMonth: io ? null : paidAt };
  }
  var kinds = ["keep", "savings", "offset", "extra"];
  var runs = {};
  kinds.forEach(function(k){ if(k !== "savings" || savings != null) runs[k] = run(k); });
  var keep = runs.keep;
  var out = kinds.filter(function(k){ return runs[k]; }).map(function(k){
    var r2 = runs[k], rows = {};
    years.forEach(function(y){
      var a = r2.at[y], b = keep.at[y];
      if(!a || !b) return;
      var saved = b.interest - a.interest;
      // On an investment loan, interest saved is a deduction lost: worth the saving less the tax it would have saved —
      // that much less back at tax time, so that much less cash to hand.
      var lost = Math.round(Math.max(0, saved) * ded);
      rows[y] = { balance: a.balance, cash: a.cash - lost, interestSaved: Math.round(saved), interestSavedAfterTax: Math.round(saved * (1 - ded)), deductionLost: lost,
        // What's yours, net: the cash to hand less what's owed — the measure the four are compared on.
        position: a.cash - lost - a.balance };
    });
    return { kind: k, years: rows, paidOffMonth: r2.paidOffMonth, monthsSooner: keep.paidOffMonth != null && r2.paidOffMonth != null ? keep.paidOffMonth - r2.paidOffMonth : null };
  });
  var missing = [];
  if(savings == null) missing.push("A savings rate, to compare a savings account.");
  if(!(rate > 0)) missing.push("The loan's rate.");
  return { amount: amount, rate: rate, io: io, deductible: ded > 0, deductiblePct: Math.round(ded * 1000) / 10, strategies: out, missing: missing,
    best: out.slice().sort(function(a, b){ var y = years[years.length - 1]; return ((b.years[y] || {}).position || 0) - ((a.years[y] || {}).position || 0); })[0] || null };
}
