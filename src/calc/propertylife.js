import { calcRepaymentMonthly, loanRepaymentMonthly, loanBalance, loanPaidOut, loanBalanceAfterMonths } from "./property.js";
import { sumField, periodsOf } from "./ledger.js";

// ---------------- Property beyond the numbers (v3.72.0) ----------------
//
// The rate a fixed loan rolls to, what the rent actually brought in against the plan (vacancies
// included), and the rent reviews that moved it. Pure: everything comes in as arguments.
function round(n){ return Math.round(n * 100) / 100; }
function monthsBetween(a, b){
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7))) + (Number(b.slice(8, 10)) - Number(a.slice(8, 10))) / 30;
}
function daysOverlap(a1, a2, b1, b2){
  var s = a1 > b1 ? a1 : b1, e = a2 < b2 ? a2 : b2;
  return s > e ? 0 : Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1;
}

// A fixed loan's expiry: { fixedUntil, months, rateNow, rateAfter, monthlyNow, monthlyAfter, change }
// or null if the loan isn't fixed (or the date has passed). `rateAfter` is the what-if rate when
// given, else the loan's own "rate after" (revertRate), else today's rate.
export function fixedRateView(loan, today, whatIfRate){
  if(!loan || !loan.fixedUntil || loanPaidOut(loan) || loan.fixedUntil < today) return null;
  var months = Math.max(0, monthsBetween(today, loan.fixedUntil));
  var rateNow = Number(loan.rate) || 0;
  var rateAfter = whatIfRate != null && whatIfRate !== "" && !isNaN(Number(whatIfRate)) ? Number(whatIfRate) : (loan.revertRate != null && loan.revertRate !== "" ? Number(loan.revertRate) : rateNow);
  // The balance when the fixed period ends: P&I pays some off by then; interest-only doesn't.
  var balance = loan.repaymentType === "IO" || loan.repaymentMode === "manual" ? loanBalance(loan)
    : loanBalanceAfterMonths(loanBalance(loan), rateNow, loan.termYears, Math.round(months), loan.repaymentType);
  var termLeft = Math.max(1, (Number(loan.termYears) || 0) - months / 12);
  var offset = Number(loan.offsetBalance) || 0;
  var monthlyNow = loanRepaymentMonthly(loan);
  var monthlyAfter = loan.repaymentType === "IO"
    ? Math.max(0, balance - offset) * rateAfter / 100 / 12
    : calcRepaymentMonthly(balance, rateAfter, termLeft, loan.repaymentType);
  return { fixedUntil: loan.fixedUntil, months: Math.round(months * 10) / 10, rateNow: rateNow, rateAfter: rateAfter,
    monthlyNow: round(monthlyNow), monthlyAfter: round(monthlyAfter), change: round(monthlyAfter - monthlyNow),
    yearlyInterestAfter: round(Math.max(0, balance - offset) * rateAfter / 100) };
}

// Rent over a window: what the plan expects, the weeks recorded vacant, and what was logged as
// received. { planned, vacancyWeeks, expected, received, gap, reviews, nextReview }
export function rentSummary(p, win, incomeLog){
  var plannedYear = sumField(p.income || [], "yearly");
  var days = Math.round((Date.parse(win.end) - Date.parse(win.start)) / 86400000) + 1;
  var planned = plannedYear * days / 365;
  var vacantDays = (p.vacancies || []).reduce(function(s, v){ return v && v.from ? s + daysOverlap(v.from, v.to || win.end, win.start, win.end) : s; }, 0);
  var expected = planned * Math.max(0, 1 - vacantDays / days);
  var received = (incomeLog || []).filter(function(r){ return r.target === "rent:" + p.id && r.date >= win.start && r.date <= win.end; })
    .reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
  var reviews = (p.rentReviews || []).slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; });
  return { planned: round(planned), vacancyWeeks: Math.round(vacantDays / 7 * 10) / 10, expected: round(expected), received: round(received),
    gap: round(received - expected), reviews: reviews, nextReview: p.nextRentReview || "" };
}

// Records a rent review on the property's first income row: the new amount in that row's own
// frequency. Returns the review, or null without an income row.
export function recordRentReview(p, date, newAmount){
  var row = (p.income || [])[0];
  if(!row) return null;
  var from = Number(row.amount) || 0, to = Math.max(0, Number(newAmount) || 0);
  if(!Array.isArray(p.rentReviews)) p.rentReviews = [];
  var rev = { date: date, from: from, to: to, freq: row.freq || "Weekly", change: from > 0 ? (to - from) / from : null };
  p.rentReviews.push(rev);
  row.amount = to;
  return rev;
}
export function yearlyChange(rev){ return round(periodsOf(rev.to - rev.from, rev.freq).yearly); }
