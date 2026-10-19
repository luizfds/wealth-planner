import { state } from "../state.js";
import { toAudAmount } from "./engine.js";
import { monthFigures, monthBounds, shiftMonth } from "./monthdetail.js";
import { valueOn } from "./history.js";
import { loanRateOn, loanPaidOut } from "./property.js";

// ---------------- Did net worth add up? (v3.82.0) ----------------
//
// What you kept in a month (money in − money out) should show up as net worth — but net worth
// also moves for reasons that aren't saving, and some costs never pass through spending. So:
//
//   net worth at the start
//   + what you kept                     logged money in − logged money out
//   + investments                       shares and crypto, as their recorded values moved
//   + super                             contributions and returns: neither reaches your bank
//   + property and other assets         revaluations, a car's depreciation
//   − loan interest                     repayments go from the offset to the lender; the principal
//                                       just swaps cash for less debt, the interest is a real cost
//   = expected at the end
//
// Against the actual end, the gap is what the money and the balances don't explain together:
// spending or income not logged, money moved to an account the app doesn't hold, or a balance
// recorded late or early. Cash, offsets, cards and loans are the side the gap lives on, so the
// check also says which of them had no balance recorded near either end of the month.

function r2(n){ return Math.round(n * 100) / 100; }
function dayBefore(iso){ var d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function daysApart(a, b){ return Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 86400000)); }

// Every balance-bearing record at a date: its value, or null when it has a history that hadn't
// started yet. A record with no history at all is taken at today's value (no change). Compared
// like for like: something first recorded mid-way isn't "growth", it's "started tracking".
function recordsOn(st, date){
  var out = [];
  function at(history, current){
    if(!history || !history.length) return Number(current) || 0;
    return valueOn(history, date);
  }
  (st.assets || []).forEach(function(a, i){
    var v = at(a.history, a.amount);
    var cat = a.category || "Other";
    var group = cat === "Cash" ? "cash" : (cat === "Shares" || cat === "Crypto") ? "invest" : cat === "Super" ? "super" : "other";
    out.push({ key: "a" + i, name: a.what || cat, group: group, value: v == null ? null : toAudAmount(a, v) });
  });
  (st.debts || []).forEach(function(d, i){
    var v = at(d.history, d.balance);
    out.push({ key: "d" + i, name: d.what || "Debt", group: "cash", value: v == null ? null : -v });
  });
  (st.properties || []).forEach(function(p, pi){
    var v = at(p.history, p.value);
    out.push({ key: "p" + pi, name: p.what || "Property", group: "other", value: v });
    (p.loans || []).forEach(function(l, li){
      var bal = at(l.balanceHistory, l.balance), off = at(l.offsetHistory, l.offsetBalance);
      out.push({ key: "l" + pi + "." + li, name: l.what || "Loan", group: "cash", value: bal == null ? null : -Math.max(0, bal) });
      out.push({ key: "o" + pi + "." + li, name: (l.what || "Loan") + " offset", group: "cash", value: off == null ? null : Math.max(0, off) });
    });
  });
  return out;
}
function compare(st, d0, d1){
  var a = recordsOn(st, d0), z = recordsOn(st, d1);
  var g = { cash: 0, invest: 0, super: 0, other: 0 }, started = [], startTotal = 0, endTotal = 0;
  z.forEach(function(r, i){
    var s0 = a[i] ? a[i].value : null;
    if(r.value != null) endTotal += r.value;
    if(s0 != null) startTotal += s0;
    if(r.value == null || s0 == null){ if(r.value != null && s0 == null && r.value) started.push(r.name); return; }
    g[r.group] += r.value - s0;
  });
  return { groups: g, started: started, start: startTotal, end: endTotal };
}

// Interest over the month on each investment loan: what was owed less the offset, at the rate then.
export function interestForMonth(st, ym){
  var b = monthBounds(ym), days = Number(b.end.slice(8, 10));
  var total = 0;
  (st.properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(loanPaidOut(l)) return;
      var bal = l.balanceHistory && l.balanceHistory.length ? valueOn(l.balanceHistory, b.start) : null;
      if(bal == null){
        // A loan with history that hadn't started by then owed nothing; one with none is assumed as now.
        if(l.balanceHistory && l.balanceHistory.length) return;
        bal = Number(l.balance) || 0;
      }
      var off = l.offsetHistory && l.offsetHistory.length ? valueOn(l.offsetHistory, b.start) : null;
      if(off == null) off = l.offsetHistory && l.offsetHistory.length ? 0 : (Number(l.offsetBalance) || 0);
      var rate = Number(loanRateOn(l, b.start)) || Number(l.rate) || 0;
      total += Math.max(0, bal - off) * rate / 100 / 365 * days;
    });
  });
  return r2(total);
}

// Balances on the cash side with nothing recorded within a week of the date.
function staleOn(st, date){
  var out = [];
  function check(name, history){
    var h = history || [];
    if(!h.length) return;
    // Not held yet on the date, or a balance that never changes (a term deposit left alone): a
    // missing month-end record says nothing about either.
    if(valueOn(h, date) == null) return;
    if(h.every(function(x){ return Number(x.value) === Number(h[0].value); })) return;
    var near = h.some(function(x){ return x.date && daysApart(x.date, date) <= 7; });
    if(!near) out.push(name);
  }
  (st.assets || []).forEach(function(a){ if(a.category === "Cash" && Number(a.amount)) check(a.what || "Cash", a.history); });
  (st.debts || []).forEach(function(d){ if(Number(d.balance)) check(d.what || "Debt", d.history); });
  (st.properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(loanPaidOut(l)) return;
      check((l.what || "Loan"), l.balanceHistory);
      if(Number(l.offsetBalance)) check((l.what || "Loan") + " offset", l.offsetHistory);
    });
  });
  return out;
}

export function netWorthCheck(ym, opts){
  opts = opts || {};
  var st = opts.state || state;
  var today = opts.today || "";
  var b = monthBounds(ym);
  var startDate = dayBefore(b.start);
  var endDate = today && today < b.end ? today : b.end;
  var c = compare(st, startDate, endDate);
  var kept = monthFigures(st, ym).left;
  var interest = interestForMonth(st, ym);
  var d = { invest: r2(c.groups.invest), super: r2(c.groups.super), other: r2(c.groups.other) };
  var expectedChange = r2(kept - interest + d.invest + d.super + d.other);
  // Like for like: only records held at both ends. Anything first recorded during the month is
  // listed, not counted as growth.
  var actualChange = r2(c.groups.cash + c.groups.invest + c.groups.super + c.groups.other);
  var gap = r2(actualChange - expectedChange);
  var stale = staleOn(st, endDate).concat(staleOn(st, startDate)).filter(function(n, i, all){ return all.indexOf(n) === i; });
  // Within 5% of the month's money in (at least $500) is "adds up": small timing and rounding,
  // a few dollars of interest on the offset, a balance read a day late.
  var tolerance = Math.max(500, Math.abs(monthFigures(st, ym).in) * 0.05);
  return {
    ym: ym, startDate: startDate, endDate: endDate, inProgress: endDate < b.end,
    start: r2(c.start), end: r2(c.end), kept: kept, interest: interest,
    invest: d.invest, super: d.super, other: d.other, started: c.started,
    cashSide: r2(c.groups.cash),
    expectedChange: expectedChange, actualChange: actualChange, gap: gap,
    addsUp: Math.abs(gap) <= tolerance, stale: stale
  };
}

// The last `n` months, oldest first.
export function netWorthChecks(ym, n, opts){
  var out = [];
  for(var i = (n || 12) - 1; i >= 0; i--) out.push(netWorthCheck(shiftMonth(ym, -i), opts));
  return out;
}

// What a gap most likely means, in words.
export function gapReading(c){
  if(c.addsUp) return "Adds up — what you kept, the market and the interest explain the change.";
  var amt = "$" + Math.round(Math.abs(c.gap)).toLocaleString("en-AU");
  return c.gap > 0
    ? "Net worth rose " + amt + " more than this explains — money in that wasn't logged, a balance recorded late, or spending logged that didn't happen."
    : "Net worth rose " + amt + " less than this explains — spending that wasn't logged, money moved to an account the app doesn't hold (a personal account, an overseas transfer), or a balance recorded early.";
}
