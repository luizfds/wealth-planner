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
  var cap = opts.maxMonths || 600;
  while(bal > 0.005 && months < cap){
    var i = Math.max(0, bal - offset) * r;
    interest += i;
    bal = bal + i - pay;
    months++;
    if(pay <= i && offset < bal){ return { months: null, interest: null, neverPaid: true }; }
  }
  return { months: months, interest: Math.round(interest), neverPaid: false };
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
      monthsSaved: base.months - withExtra.months, interestSaved: base.interest - withExtra.interest };
  }
  var offsetAdd = Number(s.offsetAdd) || 0;
  if(offsetAdd > 0){
    var yearlySaved = offsetAdd * rate / 100;
    out.offset = { amount: offsetAdd, yearlySaved: Math.round(Math.min(yearlySaved, Math.max(0, balance - offset) * rate / 100)) };
    if(!io){
      var withOffset = runLoan(balance, rate, repayment, { offset: offset + offsetAdd });
      out.offset.months = withOffset.months;
      out.offset.monthsSaved = base.months - withOffset.months;
      out.offset.interestSaved = base.interest - withOffset.interest;
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
