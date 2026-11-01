// ---------------- Automatic payments, confirmed on the day (v3.196.0, item 231) ----------------
//
// A loan repaid by direct debit, a standing transfer into savings: money that moves from one of the
// household's accounts to another on its own, on a rhythm. state.autoPayments holds each one:
//
//   { id, what, from, to, amount, freq, start, asksFrom, line?, answers: { "YYYY-MM-DD": answer } }
//
// `from` / `to` are account names (like every account link — renames walk them, see expenses.js).
// `start` is a day it falls on and sets the rhythm (the 15th, every other Friday); `asksFrom` is the
// day it was set up, so a rhythm anchored in the past never asks about payments before the app knew.
// On the day, the bell and Home ask "paid?": Yes records the transfer (tagged `autoPay`), a different
// amount records that (and can be the amount from now on — a rate change), Skipped records nothing.
// An answer is kept in `answers` by the date it was due: { s: "paid" | "skipped", amount?, tx? }.
// A transfer logged another way (a statement import) within three days of the date answers it too.
//
// Pure: every function takes the state (or its parts) and today.
import { occurrencesBetween } from "./bills.js";

export var AUTOPAY_FREQS = ["Weekly", "Fortnightly", "Monthly", "Quarterly", "Yearly"];
// How far back an unanswered payment is still asked about.
export var ASK_DAYS = 31;
// A transfer this many days either side of the date, between the same accounts, counts as it.
export var MATCH_DAYS = 3;

function addDays(iso, n){ var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b){ return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000); }
function r2(n){ return Math.round(n * 100) / 100; }

export function autoPayValid(ap){
  return !!(ap && ap.from && ap.to && ap.from !== ap.to && Number(ap.amount) > 0 && ap.start && AUTOPAY_FREQS.indexOf(ap.freq) !== -1);
}
export function autoPayName(ap){ return (ap && ap.what) || ((ap && ap.to) ? ap.to + " payment" : "Automatic payment"); }

// Every date it falls on in [start, end], none before its own start or after `until`.
export function autoPayDates(ap, start, end){
  if(!autoPayValid(ap)) return [];
  var from = start < ap.start ? ap.start : start;
  var to = ap.until && ap.until < end ? ap.until : end;
  if(from > to) return [];
  return occurrencesBetween(ap.start, ap.freq, from, to);
}

// The transfers that already stand for a payment: tagged with it, or between the same two accounts
// within MATCH_DAYS of the date and not claimed by another date. { date: transfer }.
export function matchedTransfers(ap, dates, transfers){
  var out = {}, used = {};
  var mine = (transfers || []).filter(function(x){ return x && x.from === ap.from && x.to === ap.to; });
  mine.forEach(function(x){ if(x.autoPay === ap.id && x.autoPayDate){ out[x.autoPayDate] = x; used[x.id] = true; } });
  dates.forEach(function(d){
    if(out[d]) return;
    var best = null;
    mine.forEach(function(x){
      if(used[x.id] || (x.autoPay && x.autoPay !== ap.id)) return;
      var gap = Math.abs(daysBetween(x.date, d));
      if(gap > MATCH_DAYS) return;
      if(!best || gap < best.gap) best = { x: x, gap: gap };
    });
    if(best){ out[d] = best.x; used[best.x.id] = true; }
  });
  return out;
}

// One payment's state on a date: "paid" (answered or a matching transfer), "skipped", "due" (on or
// before today, still to answer), "upcoming", or "before" (before the app was asked to watch it).
function statusOf(ap, date, matched, today){
  var a = (ap.answers || {})[date];
  if(a && a.s === "skipped") return { status: "skipped" };
  if(a && a.s === "paid") return { status: "paid", amount: a.amount != null ? Number(a.amount) : Number(ap.amount) };
  if(matched[date]) return { status: "paid", amount: Number(matched[date].amount), matched: true };
  if(date > today) return { status: "upcoming" };
  if(ap.asksFrom && date < ap.asksFrom) return { status: "before" };
  return { status: "due" };
}

// Every payment in [start, end] across the household: [{ ap, id, date, amount, status, days }], by date.
export function autoPaysBetween(st, start, end, today){
  var out = [];
  (st.autoPayments || []).forEach(function(ap){
    var dates = autoPayDates(ap, start, end);
    if(!dates.length) return;
    var matched = matchedTransfers(ap, dates, st.transfers);
    dates.forEach(function(d){
      var s = statusOf(ap, d, matched, today);
      out.push({ ap: ap, id: ap.id, what: autoPayName(ap), from: ap.from, to: ap.to, date: d, amount: s.amount != null ? s.amount : Number(ap.amount), status: s.status, matched: !!s.matched, days: daysBetween(d, today) });
    });
  });
  return out.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

// What to ask about now: the last ASK_DAYS days, unanswered and not matched, oldest first.
export function dueAutoPays(st, today){
  return autoPaysBetween(st, addDays(today, -ASK_DAYS), today, today).filter(function(p){ return p.status === "due"; });
}
// The next `days` days (today excluded), for a calendar or a forecast.
export function upcomingAutoPays(st, today, days){
  return autoPaysBetween(st, addDays(today, 1), addDays(today, days || 90), today).filter(function(p){ return p.status === "upcoming"; });
}
export function autoPaysForMonth(st, ym, today){
  var last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  return autoPaysBetween(st, ym + "-01", ym + "-" + String(last).padStart(2, "0"), today);
}
// The Budget lines an automatic payment stands for — the calendar and the forecast show the payment
// instead, so the same money isn't counted twice.
export function autoPayLineIds(st){
  var out = {};
  (st.autoPayments || []).forEach(function(ap){ if(ap && ap.line && autoPayValid(ap)) out[ap.line] = true; });
  return out;
}

// Answer one. answer: { paid: true, amount?, keep? } | { skipped: true } | { undo: true }.
// `newId` makes the transfer's id (state.js genId in the app). Returns { transfer, removed } —
// the transfer recorded, or the one an undo took away. Mutates st.
export function answerAutoPay(st, id, date, answer, newId){
  var ap = (st.autoPayments || []).find(function(x){ return x.id === id; });
  if(!ap) return null;
  if(!ap.answers || typeof ap.answers !== "object") ap.answers = {};
  if(!Array.isArray(st.transfers)) st.transfers = [];
  var prev = ap.answers[date];
  var removed = null;
  if(prev && prev.tx){
    var i = st.transfers.findIndex(function(x){ return x.id === prev.tx; });
    if(i !== -1) removed = st.transfers.splice(i, 1)[0];
  }
  if(answer.undo){ delete ap.answers[date]; return { transfer: null, removed: removed }; }
  if(answer.skipped){ ap.answers[date] = { s: "skipped" }; return { transfer: null, removed: removed }; }
  var amount = answer.amount != null && answer.amount !== "" ? r2(Number(answer.amount)) : Number(ap.amount);
  if(!(amount > 0)) return null;
  var rec = { id: newId ? newId("x") : "x" + Date.now().toString(36), date: date, amount: amount, from: ap.from, to: ap.to, what: autoPayName(ap), autoPay: ap.id, autoPayDate: date };
  st.transfers.push(rec);
  ap.answers[date] = { s: "paid", amount: amount, tx: rec.id };
  if(answer.keep && amount !== Number(ap.amount)) ap.amount = amount;
  pruneAnswers(ap, date);
  return { transfer: rec, removed: removed };
}
// Answers older than 400 days before `today` say nothing anyone will ask again.
export function pruneAnswers(ap, today){
  var cut = addDays(today, -400);
  Object.keys(ap.answers || {}).forEach(function(d){ if(d < cut) delete ap.answers[d]; });
}

// The events an account's 90-day forecast adds: money out of `from`, into `to`.
export function autoPayEvents(st, accountName, today, end){
  return upcomingAutoPays(st, today, daysBetween(end, today)).filter(function(p){ return p.from === accountName || p.to === accountName; })
    .map(function(p){ return { date: p.date, amount: p.from === accountName ? -p.amount : p.amount, what: p.what, kind: "autopay", id: p.id }; });
}

// A new one, from what a form gave: the fields checked, `asksFrom` today.
export function makeAutoPay(fields, today, id){
  var ap = { id: id, what: String(fields.what || "").trim(), from: fields.from || "", to: fields.to || "", amount: r2(Number(fields.amount) || 0),
    freq: AUTOPAY_FREQS.indexOf(fields.freq) !== -1 ? fields.freq : "Monthly", start: fields.start || today, asksFrom: today, answers: {} };
  if(fields.line) ap.line = fields.line;
  return ap;
}
