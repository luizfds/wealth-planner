// ---------------- One report frame (v3.118.0) ----------------
//
// Every report followed the header's year and nothing else: no last-12-months view across two
// financial years, no comparison, one fixed grouping. The frame is the shared part — which dates,
// compared with what, grouped how — so each report only says what it adds up. Pure.
import { MONTH_NAMES } from "../constants.js";

function pad(n){ return String(n).padStart(2, "0"); }
function ymd(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parse(s){ return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))); }
function shortLabel(s){ return Number(s.slice(8, 10)) + " " + MONTH_NAMES[Number(s.slice(5, 7)) - 1] + " " + s.slice(0, 4); }
function monthLabel(ym){ return MONTH_NAMES[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4); }

export var RANGES = [
  { key: "period", label: "The header's year" },
  { key: "l12", label: "Last 12 months" },
  { key: "cal", label: "This calendar year" },
  { key: "quarter", label: "This quarter" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom dates" }
];
export var COMPARES = [
  { key: "none", label: "Nothing" },
  { key: "prev", label: "The period before" },
  { key: "lastyear", label: "The same period last year" },
  { key: "budget", label: "The budget" }
];
export var GROUPS = [
  { key: "category", label: "Category" },
  { key: "class", label: "Needs / Wants" },
  { key: "line", label: "Budget line" },
  { key: "merchant", label: "Merchant" },
  { key: "account", label: "Account" },
  { key: "person", label: "Person" }
];

// { start, end, label } for a range key. yearWin: the header's year window (selectedYearWindow).
export function rangeWindow(range, today, opts){
  opts = opts || {};
  var t = parse(today);
  if(range === "l12"){ var s = new Date(t.getFullYear(), t.getMonth() - 11, 1); return { start: ymd(s), end: today, label: "Last 12 months" }; }
  if(range === "cal") return { start: t.getFullYear() + "-01-01", end: t.getFullYear() + "-12-31", label: String(t.getFullYear()) };
  if(range === "quarter"){ var q = Math.floor(t.getMonth() / 3); var qs = new Date(t.getFullYear(), q * 3, 1), qe = new Date(t.getFullYear(), q * 3 + 3, 0); return { start: ymd(qs), end: ymd(qe), label: "Q" + (q + 1) + " " + t.getFullYear() }; }
  if(range === "month"){ var ms = new Date(t.getFullYear(), t.getMonth(), 1), me = new Date(t.getFullYear(), t.getMonth() + 1, 0); return { start: ymd(ms), end: ymd(me), label: monthLabel(ymd(ms).slice(0, 7)) }; }
  if(range === "custom" && opts.from && opts.to && opts.from <= opts.to) return { start: opts.from, end: opts.to, label: shortLabel(opts.from) + " – " + shortLabel(opts.to) };
  return opts.yearWin ? { start: opts.yearWin.start, end: opts.yearWin.end, label: opts.yearWin.label } : rangeWindow("l12", today);
}

// The window a comparison reads: the same length just before, or the same dates a year earlier.
export function compareWindow(win, compare){
  if(compare === "lastyear"){
    var back = function(s){ return (Number(s.slice(0, 4)) - 1) + s.slice(4); };
    return { start: back(win.start), end: back(win.end), label: "a year earlier" };
  }
  if(compare === "prev"){
    var s = parse(win.start), e = parse(win.end);
    var days = Math.round((e - s) / 86400000) + 1;
    var pe = new Date(s); pe.setDate(pe.getDate() - 1);
    var ps = new Date(pe); ps.setDate(ps.getDate() - days + 1);
    return { start: ymd(ps), end: ymd(pe), label: "the period before" };
  }
  return null;
}

// The calendar months a window touches, up to `today` — what a month-by-month report lists.
export function monthsIn(win, today){
  var out = [], d = parse(win.start), last = (today && today < win.end ? today : win.end).slice(0, 7);
  d.setDate(1);
  while(ymd(d).slice(0, 7) <= last && out.length < 60){ out.push(ymd(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); }
  return out;
}

// Totals of spending by group inside a window: { key: total }. groupOf(t) names a transaction's group.
export function spendingByGroup(transactions, win, groupOf){
  var out = {};
  (transactions || []).forEach(function(t){
    if(!t || !t.date || t.date < win.start || t.date > win.end) return;
    var k = groupOf(t) || "Other";
    out[k] = (out[k] || 0) + (Number(t.amount) || 0);
  });
  return out;
}
// Change from b to a as { diff, pct } (pct null when b is 0).
export function change(a, b){
  if(b == null) return { diff: null, pct: null };
  return { diff: Math.round((a - b) * 100) / 100, pct: b ? (a - b) / Math.abs(b) : null };
}
