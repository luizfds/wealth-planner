// ---------------- Balance forecast by the day (v3.180.0, item 206) ----------------
//
// The 12-month forecast is monthly and household-wide; what goes wrong in real life is one account on
// one day — rent out on the 1st, pay in on the 3rd. For an everyday account: today's balance (rolled
// forward from the last recorded one), then each day for 90 days —
//   pay   — what's landed in this account before (state.incomeLog), on its own rhythm, at its last amount;
//   bills — the bills calendar's bills paid from this account, and the card repayments it usually makes;
//   spending — the account's usual day-to-day spending (the last 90 days, bills left out), spread evenly.
// It says where the balance is lowest and whether that's under the buffer the person set (account.buffer).
// dailyBalance is pure; accountForecast gathers its inputs from a state.

import { billsForMonth, usualCardSource, lineKind } from "./bills.js";
import { rolledBalance } from "./accounts.js";
import { cadenceOf } from "./recurring.js";
import { nextCharge } from "./subscriptions.js";

function r2(n){ return Math.round(n * 100) / 100; }
function addDays(iso, n){ var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonthsYm(ym, n){ var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n; return (y + Math.floor(m / 12)) + "-" + String(((m % 12) + 12) % 12 + 1).padStart(2, "0"); }

// inp: { start, today, days, events: [{ date, amount (+ in, − out), what, kind }], spendDaily, buffer }
// → { points: [{ date, balance, events }], lowest: { date, balance }, below: first point under the buffer
//    or null, end }. Day 0 is today, as it stands (today's events are already in today's balance).
export function dailyBalance(inp){
  var days = inp.days || 90, bal = Number(inp.start) || 0, spend = Number(inp.spendDaily) || 0;
  var byDate = {};
  (inp.events || []).forEach(function(e){ if(e && e.date > inp.today) (byDate[e.date] = byDate[e.date] || []).push(e); });
  var points = [{ date: inp.today, balance: r2(bal), events: [] }], lowest = points[0], below = null;
  var buffer = inp.buffer != null && inp.buffer !== "" ? Number(inp.buffer) : null;
  if(buffer != null && bal < buffer) below = points[0];
  for(var i = 1; i <= days; i++){
    var d = addDays(inp.today, i), ev = byDate[d] || [];
    bal += ev.reduce(function(s, e){ return s + Number(e.amount); }, 0) - spend;
    var p = { date: d, balance: r2(bal), events: ev };
    points.push(p);
    if(p.balance < lowest.balance) lowest = p;
    if(buffer != null && !below && p.balance < buffer) below = p;
  }
  return { points: points, lowest: { date: lowest.date, balance: lowest.balance }, below: below ? { date: below.date, balance: below.balance } : null,
    end: points[points.length - 1].balance, buffer: buffer };
}

// Pay into the account: each kind of money received there (by its target, else its description) that
// keeps a rhythm, at its latest amount, on the dates after today it would land.
export function payEvents(incomeLog, accountName, today, end){
  var groups = {};
  (incomeLog || []).forEach(function(r){
    if(!r || r.account !== accountName || !r.date || !(Number(r.amount) > 0) || r.date > today) return;
    var k = r.target || r.what || "";
    (groups[k] = groups[k] || []).push(r);
  });
  var out = [];
  Object.keys(groups).forEach(function(k){
    var g = groups[k].slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    var freq = cadenceOf(g.map(function(r){ return r.date; }));
    if(!freq) return;
    var last = g[g.length - 1];
    var d = last.date;
    for(var guard = 0; guard < 120; guard++){
      d = nextCharge(d, freq, d);
      if(d > end) break;
      if(d > today) out.push({ date: d, amount: Number(last.amount), what: last.what || "Pay", kind: "pay" });
    }
  });
  return out;
}

// The account's inputs from a state: { start, events, spendDaily, buffer, payFound, billCount }.
export function forecastInputs(st, account, today, days, opts){
  opts = opts || {};
  var end = addDays(today, days), name = account.name;
  var accountOf = opts.accountOf || function(t){ return t.account || ""; };
  var start = rolledBalance(account, { today: today, accountOf: accountOf }).balance;
  var items = opts.items || st.shared || [];
  var events = payEvents(st.incomeLog, name, today, end);
  var payFound = events.length > 0;
  // Bills from the calendar, month by month across the window.
  var billCount = 0;
  for(var ym = today.slice(0, 7); ym <= end.slice(0, 7); ym = addMonthsYm(ym, 1)){
    var m = billsForMonth(items, st.transactions, ym, today, { accounts: st.accounts, transfers: st.transfers });
    Object.keys(m.days).forEach(function(d){
      if(d <= today || d > end) return;
      m.days[d].forEach(function(b){
        if(b.paid || b.card || b.agent || b.account !== name) return;
        events.push({ date: d, amount: -b.amount, what: b.what, kind: "bill" }); billCount++;
      });
    });
    m.cardPayments.forEach(function(p){
      if(p.paid || !(p.amount > 0) || p.date <= today || p.date > end) return;
      var card = (st.accounts || []).find(function(a){ return a.name === p.card; });
      if(card && usualCardSource(card, st.accounts, st.transfers) === name){ events.push({ date: p.date, amount: -p.amount, what: p.card + " payment", kind: "card" }); billCount++; }
    });
  }
  // Day-to-day spending: the last 90 days on this account, less what went to bills.
  var byLine = {};
  (st.transactions || []).forEach(function(t){ if(t.linkedExpenseId) (byLine[t.linkedExpenseId] = byLine[t.linkedExpenseId] || []).push(t); });
  var billLine = {};
  items.forEach(function(i){ if(i && i.id && lineKind(i, byLine[i.id] || []) === "bill") billLine[i.id] = true; });
  var from = addDays(today, -90), spent = 0;
  (st.transactions || []).forEach(function(t){
    if(!t || !t.date || t.date <= from || t.date > today || accountOf(t) !== name) return;
    if(t.linkedExpenseId && billLine[t.linkedExpenseId]) return;
    spent += Number(t.amount) || 0;
  });
  return { start: start, events: events, spendDaily: r2(Math.max(0, spent) / 90), buffer: account.buffer, payFound: payFound, billCount: billCount };
}

export function accountForecast(st, account, today, days, opts){
  days = days || 90;
  var inp = forecastInputs(st, account, today, days, opts);
  if(inp.start == null) return null;
  var f = dailyBalance({ start: inp.start, today: today, days: days, events: inp.events, spendDaily: inp.spendDaily, buffer: inp.buffer });
  f.spendDaily = inp.spendDaily; f.payFound = inp.payFound; f.billCount = inp.billCount; f.account = account.name;
  return f;
}
// Everyday accounts whose lowest point in the next 90 days is under their buffer.
export function forecastWarnings(st, today, opts){
  return (st.accounts || []).filter(function(a){ return a && a.type === "everyday" && a.buffer != null && a.buffer !== ""; }).map(function(a){
    var f = accountForecast(st, a, today, 90, opts);
    return f && f.below ? { account: a, forecast: f } : null;
  }).filter(Boolean);
}
