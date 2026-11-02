import { loanInterestForWindow, loanRepaymentMonthly } from "./property.js";
import { periodsOf } from "./ledger.js";

// ---------------- Loans as the bank charged them (item 243) ----------------
//
// A loan's interest was worked out: today's balance less offset, at the rate on each day, for every day of the window.
// That misses a balance that fell through the year, and anything the bank did that the model doesn't know. The bank's
// own record is its loan statement: an "Interest charge" row each month, fees, the drawdown, the repayments. Imported
// (components/bank-import.js, for an account of type Loan linked to the loan) its charges are kept on the loan —
// loan.charges = [{ id, date, amount, kind: "interest" | "fee", what }] — and interest for any window is what the bank
// charged in it, worked out only for the days its charges don't cover. A charge covers the month up to its date (the
// bank charges a month's interest at the month's end), so a window's covered days run from a month before its first
// charge to its last; before and after that, the model fills in — from the day the loan settled, never before.

function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function shiftDay(d, n){ return new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10); }
// The same day a month earlier — the last day of that month for a month's last day (30 Sep → 31 Aug), or when it has
// fewer days.
function monthBefore(d){
  var y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)), day = Number(d.slice(8, 10));
  var monthEnd = day === new Date(Date.UTC(y, m, 0)).getUTCDate();
  m--;
  if(m === 0){ y--; m = 12; }
  var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return y + "-" + String(m).padStart(2, "0") + "-" + String(monthEnd ? last : Math.min(day, last)).padStart(2, "0");
}

export function loanCharges(loan, kind, start, end){
  return (Array.isArray(loan && loan.charges) ? loan.charges : []).filter(function(c){
    return c && c.kind === kind && c.date >= start && c.date <= end;
  }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

// Interest over [start, end]: { amount, charged, modelled, count, from, to } — `from`..`to` the days the bank's
// charges cover (null when none do). Rounded to the cent.
export function loanInterestCharged(loan, start, end){
  if(end < start) return { amount: 0, charged: 0, modelled: 0, count: 0, from: null, to: null };
  var ch = loanCharges(loan, "interest", start, end);
  if(!ch.length){
    var m = loanInterestForWindow(loan, start, end);
    return { amount: m, charged: 0, modelled: m, count: 0, from: null, to: null };
  }
  var charged = ch.reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
  var from = shiftDay(monthBefore(ch[0].date), 1);
  if(from < start) from = start;
  var to = ch[ch.length - 1].date;
  var modelled = loanInterestForWindow(loan, start, shiftDay(from, -1)) + loanInterestForWindow(loan, shiftDay(to, 1), end);
  return { amount: r2(charged + modelled), charged: r2(charged), modelled: r2(modelled), count: ch.length, from: from, to: to };
}

// The fees the bank charged on the loan in [start, end], in total.
export function loanFeesCharged(loan, start, end){
  return r2(loanCharges(loan, "fee", start, end).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0));
}

// ---- Reading a loan account's statement ----
// What a row on a loan account's statement is. From the loan's side, money in (a credit) pays it down; money out is
// the bank adding to it: interest, a fee, the drawdown. Anything else (a redraw) is left to the ordinary review.
export function loanRowKind(row){
  var w = String(row && row.description || "");
  if(/interest/i.test(w) && !/offset/i.test(w)) return "interest";
  if(row.direction === "credit") return "repayment";
  if(/draw\s*-?\s*down|\badvance\b|loan funds|funds released|settlement/i.test(w)) return "drawdown";
  if(/\bfees?\b|\bcharges?\b/i.test(w)) return "fee";
  return null;
}

// Item 245: a statement that reads like a loan account's — interest the bank charged, and nearly everything else on it
// interest, fees, a drawdown or money paid in. A card statement has interest too, but mostly purchases.
export function looksLikeLoanStatement(rows){
  var list = rows || [];
  if(!list.length) return false;
  var charged = list.some(function(r){ return r.direction === "debit" && loanRowKind(r) === "interest"; });
  var loanish = list.filter(function(r){ return loanRowKind(r) != null; }).length;
  return charged && loanish / list.length >= 0.8;
}

function chargeKey(kind, date, amount){ return kind + "|" + date + "|" + r2(Math.abs(amount)).toFixed(2); }

// Splits a loan statement's rows: { charges: [{ row, kind, amount }], drawdown: row | null, repayments: [row], rest:
// [rows], known: n }. A charge's amount is signed as it adds to what's owed (an interest refund is negative); one the
// loan already has (same kind, day and amount) is `known` and left out.
export function splitLoanStatement(rows, loan){
  var have = {};
  (Array.isArray(loan && loan.charges) ? loan.charges : []).forEach(function(c){ have[chargeKey(c.kind, c.date, c.amount)] = true; });
  var out = { charges: [], drawdown: null, repayments: [], rest: [], known: 0 };
  (rows || []).forEach(function(r){
    var kind = loanRowKind(r), amt = Math.abs(Number(r.amount) || 0);
    if(kind === "interest" || kind === "fee"){
      var signed = r.direction === "credit" ? -amt : amt;
      if(have[chargeKey(kind, r.date, signed)]){ out.known++; return; }
      out.charges.push({ row: r, kind: kind, amount: signed });
    } else if(kind === "drawdown"){
      if(!out.drawdown || r.date < out.drawdown.date) out.drawdown = r;
    } else {
      if(kind === "repayment") out.repayments.push(r);
      out.rest.push(r);
    }
  });
  return out;
}

// The repayment the bank takes, from a statement's repayments: the amount paid most often (the latest on a tie) and
// how often, from the gaps between them. Null without one.
export function bankRepaymentOf(rows){
  var list = (rows || []).filter(function(r){ return Number(r.amount); }).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  if(!list.length) return null;
  var counts = {};
  list.forEach(function(r){ var k = r2(Math.abs(r.amount)).toFixed(2); counts[k] = (counts[k] || 0) + 1; });
  var best = null;
  list.forEach(function(r){ var k = r2(Math.abs(r.amount)).toFixed(2); if(best == null || counts[k] >= counts[best]) best = k; });
  var dates = list.filter(function(r){ return r2(Math.abs(r.amount)).toFixed(2) === best; }).map(function(r){ return Date.parse(r.date); });
  var gaps = [];
  for(var i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
  gaps.sort(function(a, b){ return a - b; });
  var gap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30;
  return { amount: Number(best), freq: gap <= 10 ? "Weekly" : gap <= 20 ? "Fortnightly" : "Monthly", date: list[list.length - 1].date };
}

// When the bank's repayment (loan.bankRepayment, from its last statement) differs from the one the app uses: { amount,
// freq, current } — current is the app's, at the bank's frequency. Null when they agree or there's nothing to compare.
export function bankRepaymentNudge(loan){
  var b = loan && loan.bankRepayment;
  if(!b || !(Number(b.amount) > 0)) return null;
  var p = periodsOf(loanRepaymentMonthly(loan), "Monthly");
  var current = b.freq === "Weekly" ? p.weekly : b.freq === "Fortnightly" ? p.fortnightly : p.monthly;
  if(Math.abs(current - Number(b.amount)) < 0.5) return null;
  return { amount: Number(b.amount), freq: b.freq || "Monthly", current: r2(current) };
}
