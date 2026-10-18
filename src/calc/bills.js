import { freqStepMonths } from "./ledger.js";

// ---------------- The bills calendar (v3.60.0) ----------------
//
// When each regular bill lands in a month, worked out from the last time it was paid: a monthly
// line paid on 3 September is due 3 October, a quarterly one paid 20 July is due 20 October. Each
// occurrence says whether it's been paid (a transaction on that line within a few days of it) so
// the month reads as a checklist. Lines never logged have no day to put them on — they're listed
// separately rather than guessed. Pure: everything comes in as arguments.
var PAID_WINDOW_DAYS = 6;
function iso(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parse(s){ var p = String(s).split("-"); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
function daysBetween(a, b){ return Math.round((parse(a) - parse(b)) / 86400000); }

// Every date the line falls on within [start, end], stepping from `anchor` in both directions.
// Month steps keep the anchor's day, clamped to short months (31 Jan → 28 Feb → 31 Mar, not 3 Mar).
export function occurrencesBetween(anchor, freq, start, end){
  var out = [];
  var a = parse(anchor);
  if(isNaN(a.getTime())) return out;
  if(freq === "Weekly" || freq === "Fortnightly"){
    var step = freq === "Weekly" ? 7 : 14;
    var k = Math.floor(daysBetween(start, anchor) / step) - 1;
    for(var guard = 0; guard < 80; guard++, k++){
      var d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + k * step);
      var s = iso(d);
      if(s > end) break;
      if(s >= start) out.push(s);
    }
    return out;
  }
  var months = freqStepMonths(freq);
  var startD = parse(start);
  var diff = (startD.getFullYear() - a.getFullYear()) * 12 + (startD.getMonth() - a.getMonth());
  var m = Math.floor(diff / months) * months - months;
  for(var g = 0; g < 40; g++, m += months){
    var y = a.getFullYear(), mo = a.getMonth() + m;
    var last = new Date(y, mo + 1, 0).getDate();
    var dd = iso(new Date(y, mo, Math.min(a.getDate(), last)));
    if(dd > end) break;
    if(dd >= start) out.push(dd);
  }
  return out;
}

// { days: { "YYYY-MM-DD": [bill] }, undated: [line], total, paidTotal } for one month.
// bill: { id, what, amount, date, paid, overdue }. items: regular budget lines; today for "overdue".
export function billsForMonth(items, transactions, ym, today){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var start = ym + "-01", end = ym + "-" + String(new Date(y, m, 0).getDate()).padStart(2, "0");
  var byLine = {};
  (transactions || []).forEach(function(t){ if(t.linkedExpenseId && t.date) (byLine[t.linkedExpenseId] = byLine[t.linkedExpenseId] || []).push(t.date); });
  var days = {}, undated = [], total = 0, paidTotal = 0;
  (items || []).forEach(function(i){
    if(!i.id || i.irregular || i.computed) return;
    var dates = (byLine[i.id] || []).slice().sort();
    var anchor, estimated = false;
    if(dates.length) anchor = dates[dates.length - 1];
    else if(i.dueMonth >= 1 && i.dueMonth <= 12 && freqStepMonths(i.freq) > 1){
      // v3.72.0: a renewal with a due month (and day) gets its date before it's ever paid.
      var dim = new Date(y, Number(i.dueMonth), 0).getDate();
      anchor = y + "-" + String(i.dueMonth).padStart(2, "0") + "-" + String(Math.min(Number(i.dueDay) || 1, dim)).padStart(2, "0");
      estimated = true;
    } else { undated.push({ id: i.id, what: i.what || "Bill", amount: Number(i.amount) || 0, freq: i.freq }); return; }
    occurrencesBetween(anchor, i.freq, start, end).forEach(function(d){
      var paid = dates.some(function(x){ return Math.abs(daysBetween(x, d)) <= PAID_WINDOW_DAYS; });
      var bill = { id: i.id, what: i.what || "Bill", amount: Number(i.amount) || 0, date: d, paid: paid, overdue: !paid && today && d < today, estimated: estimated };
      (days[d] = days[d] || []).push(bill);
      total += bill.amount;
      if(paid) paidTotal += bill.amount;
    });
  });
  Object.keys(days).forEach(function(d){ days[d].sort(function(a, b){ return b.amount - a.amount; }); });
  return { start: start, end: end, days: days, undated: undated, total: Math.round(total * 100) / 100, paidTotal: Math.round(paidTotal * 100) / 100 };
}
