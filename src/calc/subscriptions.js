// ---------------- Every subscription in one list (v3.179.0, item 205) ----------------
//
// Cash flow → Bills' Subscriptions: every payee that charges on a steady rhythm (calc/recurring.js
// repeatingPayees — the same detector as Budget's "repeating, not budgeted"), budgeted or not, with
// what it costs a year, its last price rise, its next charge, and a "cancel by" date the person sets.
// One that has stopped charging says so — stopped, not overdue. Pure: transactions, today and the
// person's notes (state.subscriptionNotes) in.

import { repeatingPayees } from "./recurring.js";
import { periodsOf, isActiveOn } from "./ledger.js";

// November 2026: a subscription is something you sign up to and can cancel — streaming, apps, storage, a membership.
// Council rates, insurance and internet charge just as steadily, but they're bills (Bills lists them). With the budget
// lines in hand (opts.lines), a line's category decides; a steady charge on no line is one unless its name says bill.
var SUB_CATEGORY = /subscri|stream|entertain|membership|software|\bapps?\b/i;
var BILL_WORDS = /utilit|phone|mobile|internet|broadband|insur|health|\bcar\b|housing|\bhome\b|rent\b|rates|council|energy|electric|power|water|\bgas\b|loan|mortgage|strata|body corp|rego|registration|school|childcare/i;
export function isSubscriptionLine(line){ return !!(line && (SUB_CATEGORY.test(line.category || "") || (!line.category && SUB_CATEGORY.test(line.what || "")))); }
export function isBillLike(line, name){
  if(line && isSubscriptionLine(line)) return false;
  if(line && (BILL_WORDS.test(line.category || "") || BILL_WORDS.test(line.what || ""))) return true;
  return !!(name && BILL_WORDS.test(name));
}

function round(n){ return Math.round(n * 100) / 100; }
function addDays(iso, n){ var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonths(iso, n){
  var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, day = Number(iso.slice(8, 10));
  var ty = y + Math.floor(m / 12), tm = ((m % 12) + 12) % 12;
  var last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return ty + "-" + String(tm + 1).padStart(2, "0") + "-" + String(Math.min(day, last)).padStart(2, "0");
}
var STEP = { Weekly: [7, 0], Fortnightly: [14, 0], Monthly: [0, 1], Quarterly: [0, 3], "Half-yearly": [0, 6], Yearly: [0, 12] };
// The next charge after `last` on the payee's rhythm — the first one after today if some were missed
// in between (the statement may not be in yet).
export function nextCharge(last, freq, today){
  var st = STEP[freq] || [0, 1], d = last, n = 0;
  do { d = st[0] ? addDays(d, st[0]) : addMonths(last, st[1] * (++n)); } while(d <= today && n < 400);
  return d;
}
// The rise to today's price: the latest charge more than 2% (and 50c) above the one before it, where
// that new amount is still what it charges (a price that went up and back down again has no rise).
// Item 255: a day with two charges (an adjustment beside the bill, a refund re-charged) says nothing about the price
// before, so it's passed over rather than read as one.
export function lastRise(charges){
  var latest = charges.length ? charges[charges.length - 1].amount : 0;
  var perDay = {};
  charges.forEach(function(c){ perDay[c.date] = (perDay[c.date] || 0) + 1; });
  for(var i = charges.length - 1; i > 0; i--){
    if(perDay[charges[i - 1].date] > 1) continue;
    var a = charges[i - 1].amount, b = charges[i].amount;
    if(Math.abs(b - latest) > Math.max(0.01, latest * 0.01)) return null;
    if(b > a * 1.02 && b - a >= 0.5) return { date: charges[i].date, from: round(a), to: round(b) };
  }
  return null;
}
// A subscription charges the same amount, cent for cent, until the price changes: its two most common
// amounts make up most of its charges. A fuel stop or a transit top-up comes close each time but
// rarely exactly, so it isn't one.
export function steadyAmounts(charges){
  var counts = {};
  charges.forEach(function(c){ var k = Math.round(c.amount * 100); counts[k] = (counts[k] || 0) + 1; });
  var top = Object.keys(counts).map(function(k){ return counts[k]; }).sort(function(a, b){ return b - a; });
  return (top[0] || 0) + (top[1] || 0) >= Math.ceil(charges.length * 0.7);
}
// [{ key, name, freq, amount (the latest charge), yearly, lastRise, last, next, stopped, cancelBy, line, ignored }]
// — running ones first by yearly cost, then the stopped (only those that stopped within the year).
// opts.homeLines: ids of the budget lines that are where the household lives (rent, the home loan) —
// a charge filed to one isn't a subscription; nor is one categorised Housing.
export function subscriptionList(transactions, today, notes, opts){
  notes = notes || {};
  var home = {};
  ((opts && opts.homeLines) || []).forEach(function(id){ home[id] = true; });
  var yearAgo = addDays(today, -365);
  var lines = (opts && opts.lines) || null, lineById = {};
  (lines || []).forEach(function(l){ if(l && l.id) lineById[l.id] = l; });
  // Item 255: payments to one budget line under several descriptions, one after the other, are one subscription.
  var out = repeatingPayees(transactions, today, { includeLinked: true, mergeByLine: true }).filter(function(r){
    if(r.stopped && r.last < yearAgo) return false;
    if(r.category === "Housing" || r.charges.some(function(c){ return c.line && home[c.line]; })) return false;
    if(lines){
      var lastLine = r.charges.map(function(c){ return c.line; }).filter(Boolean).pop();
      if(isBillLike(lineById[lastLine], r.name || r.label)) return false;
    }
    // Item 255: a joined one is steady when each name it went by was (a new plan, a new price, a new name).
    if((r.keys || []).length > 1){
      var byKey = {};
      r.charges.forEach(function(c){ var mk = c.key || ""; (byKey[mk] = byKey[mk] || []).push(c); });
      return Object.keys(byKey).every(function(k){ return byKey[k].length < 3 || steadyAmounts(byKey[k]); });
    }
    return steadyAmounts(r.charges);
  }).map(function(r){
    // A note set under a name it used to have (a cancel-by date, "not a subscription") stays with it.
    var noteKey = (r.keys || [r.key]).find(function(k){ return notes[k]; });
    var latest = r.charges[r.charges.length - 1].amount, n = (noteKey && notes[noteKey]) || {};
    var lines = r.charges.map(function(c){ return c.line; }).filter(Boolean);
    return { key: r.key, name: r.name, label: r.label, freq: r.freq, amount: round(latest), yearly: round(periodsOf(latest, r.freq).yearly),
      lastRise: lastRise(r.charges), last: r.last, next: r.stopped ? null : nextCharge(r.last, r.freq, today), stopped: r.stopped,
      count: r.count, cancelBy: n.cancelBy || "", ignored: !!n.ignored, line: lines.length ? lines[lines.length - 1] : "", category: r.category };
  });
  // A line you file subscriptions under is one, though its charges aren't steady enough to be found (a price in another
  // currency, a description that changes with the city it's billed from, a yearly one charged once so far).
  if(lines){
    var covered = {};
    out.forEach(function(x){ if(x.line) covered[x.line] = true; });
    lines.forEach(function(l){
      if(!l || !l.id || covered[l.id] || !isSubscriptionLine(l) || !isActiveOn(l, today)) return;
      var mine = (transactions || []).filter(function(t){ return t && t.linkedExpenseId === l.id && t.date && t.date <= today && Number(t.amount) > 0; })
        .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var lastT = mine[mine.length - 1], freq = l.freq || "Monthly";
      var amount = lastT ? Number(lastT.amount) : Number(l.amount) || 0;
      if(!(amount > 0)) return;
      var step = { Weekly: 7, Fortnightly: 14, Monthly: 31, Quarterly: 92, "Half-yearly": 183, Yearly: 366 }[freq] || 31;
      var stopped = !!(lastT && addDays(lastT.date, Math.round(step * 2.5)) < today);
      if(stopped && lastT.date < yearAgo) return;
      var key = "line:" + l.id, n = notes[key] || {};
      out.push({ key: key, name: l.what || "Subscription", label: l.what || "Subscription", freq: freq, amount: round(amount), yearly: round(periodsOf(amount, freq).yearly),
        lastRise: null, last: lastT ? lastT.date : "", next: lastT && !stopped ? nextCharge(lastT.date, freq, today) : null, stopped: stopped,
        count: mine.length, cancelBy: n.cancelBy || "", ignored: !!n.ignored, line: l.id, category: l.category || "" });
    });
  }
  return out.sort(function(a, b){ return (a.stopped - b.stopped) || (b.yearly - a.yearly); });
}
// The list as every caller wants it: the household's budget lines decide what's a bill.
export function householdSubscriptions(st, today){
  return subscriptionList((st && st.transactions) || [], today, (st && st.subscriptionNotes) || {}, { homeLines: homeLineIds(st), lines: ((st && st.shared) || []) });
}
export function homeLineIds(st){ return ((st && st.shared) || []).filter(function(l){ return l && l.homeCost && l.id; }).map(function(l){ return l.id; }); }
export function subscriptionsYearly(list){
  return round(list.filter(function(s){ return !s.stopped && !s.ignored; }).reduce(function(t, s){ return t + s.yearly; }, 0));
}
// Reminders due: a cancel-by date within `days` (or passed) on a subscription that's still charging.
export function cancelReminders(list, today, days){
  var horizon = addDays(today, days == null ? 7 : days);
  return list.filter(function(s){ return s.cancelBy && !s.stopped && !s.ignored && s.cancelBy <= horizon; });
}
