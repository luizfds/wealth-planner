// ---------------- Essentials, Lifestyle and Set aside (November 2026) ----------------
//
// A budget line answers two questions, not one:
//   1. Is it essential? — `classification` "Needs" (shown as Essential: you'd still pay it if money got tight) or
//      "Wants" (Lifestyle: chosen, could cut). The stored values stay "Needs"/"Wants"; only the words changed.
//   2. Is it spent every month, or set aside? — `irregular` (shown as Set aside). A set-aside line is a pot: its monthly
//      amount goes in, its spending comes out, and it's judged over the year, never against this month. A trip that
//      costs four months of the allowance in one go is money leaving the pot, not a month over budget.
//
// monthSplit()  this month's every-month Essentials and Lifestyle — planned and spent — and what's set aside.
// potFor()      a set-aside line's pot: what it started with, what went in, what came out, what's left.
// budgetHints() lines whose answer looks wrong: an Essential that reads as Lifestyle, the reverse, and a set-aside
//               line that's spent nearly every month. Each can be fixed in one tap or kept ("It's right").
// Pure: no DOM, no state. The caller passes the lines, the transactions and the dates.
import { periodsOf, transactionClass, reserveCycleFor, isActiveOn } from "./ledger.js";
import { tripSpend } from "./trips.js";

import { CLASS_WORDS, classWord } from "../constants.js";
export { CLASS_WORDS, classWord };
export var ESSENTIAL_MEANS = "you'd still pay it if money got tight";

// The same shared, housing and investment lines drive the Budget list and suggestions from spending.
export function budgetLineSources(st, scenario){
  var sources = [{ section: "shared", items: st.shared || [] }];
  var home = (st.home || {})[scenario];
  if(home && home.length) sources.push({ section: "home:" + scenario, items: home });
  (st.properties || []).forEach(function(p){
    if(p.kind === "IP" && p.expenses && p.expenses.length) sources.push({ section: "propexp:" + p.id, items: p.expenses });
  });
  return sources;
}

function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function r2(n){ return Math.round(n * 100) / 100; }
function byId(lines){ var m = {}; (lines || []).forEach(function(l){ if(l && l.id) m[l.id] = l; }); return m; }
function monthsBetween(a, b){ // whole calendar months from a's month to b's month (same month → 0)
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}
function dayBefore(d){ var t = new Date(d + "T00:00:00"); t.setDate(t.getDate() - 1); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); }

export function isSetAside(line){ return !!(line && line.irregular); }
// "essential" | "lifestyle" | "other" — what a line is, set-aside or not.
export function kindOf(line){
  var c = line && line.classification;
  return c === "Needs" ? "essential" : c === "Wants" ? "lifestyle" : "other";
}
function kindOfClass(c){ return c === "Needs" ? "essential" : c === "Wants" ? "lifestyle" : "other"; }

// opts: { monthlyOf(line) — the line's monthly amount (default its amount and frequency) }.
// → { essential: { planned, spent }, lifestyle: { planned, spent }, other: { planned, spent }, setAside: { planned,
//     essential, lifestyle }, total, lifestyleLeft }. Spending counts in `ym` ("YYYY-MM"), by the purchase's own Essential
//     or Lifestyle when it says (transactionClass); a set-aside line's spending is its pot's, never this month's. A
//     purchase on no line is other spending unless it says otherwise — a real backup's biggest one was a home purchase's
//     costs, which is neither, and counting it as Lifestyle put the month thousands over.
export function monthSplit(lines, transactions, ym, opts){
  opts = opts || {};
  var monthlyOf = opts.monthlyOf || function(l){ return periodsOf(num(l.amount), l.freq).monthly; };
  var out = { essential: { planned: 0, spent: 0 }, lifestyle: { planned: 0, spent: 0 }, other: { planned: 0, spent: 0 },
    setAside: { planned: 0, essential: 0, lifestyle: 0 } };
  var mid = ym + "-15";
  (lines || []).forEach(function(l){
    if(!isActiveOn(l, mid)) return;
    var m = monthlyOf(l);
    if(isSetAside(l)){ out.setAside.planned += m; if(kindOf(l) !== "other") out.setAside[kindOf(l)] += m; }
    else out[kindOf(l)].planned += m;
  });
  var lines2 = byId(lines);
  (transactions || []).forEach(function(t){
    if(!t || String(t.date || "").slice(0, 7) !== ym) return;
    var k = monthKindOfTx(t, lines2);
    if(k) out[k].spent += num(t.amount);
  });
  ["essential", "lifestyle", "other"].forEach(function(k){ out[k].planned = r2(out[k].planned); out[k].spent = r2(out[k].spent); });
  out.setAside.planned = r2(out.setAside.planned); out.setAside.essential = r2(out.setAside.essential); out.setAside.lifestyle = r2(out.setAside.lifestyle);
  out.total = r2(out.essential.planned + out.lifestyle.planned + out.other.planned + out.setAside.planned);
  out.lifestyleLeft = r2(out.lifestyle.planned - out.lifestyle.spent);
  return out;
}

// Which of this month's figures a purchase counts in — "essential", "lifestyle" or "other" — or null for a set-aside
// line's, which comes out of its pot. The one rule monthSplit and lifestylePace share.
function monthKindOfTx(t, linesById){
  var line = t.linkedExpenseId ? linesById[t.linkedExpenseId] : null;
  if(line && isSetAside(line)) return null;
  return kindOfClass(line ? transactionClass(t, line) : (t.classification === "Needs" || t.classification === "Wants" ? t.classification : "N/A"));
}

// Lifestyle's month, day by day — the figure to watch, and whether it's on pace.
// → { days, day, planned, spent, left, daysLeft, perDay, byDay: [cumulative spent at the end of each day so far],
//     projected, diff, status } — status "early" (before day 5: too soon to say), "under", "on" (within $25 or 2% of
//     the plan), "over", or "past" (a finished month: spent against planned). `today` decides how far the month has got.
export function lifestylePace(lines, transactions, ym, today, opts){
  var split = opts && opts.split ? opts.split : monthSplit(lines, transactions, ym, opts);
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var days = new Date(y, m, 0).getDate();
  var tym = String(today).slice(0, 7);
  var day = tym === ym ? Number(String(today).slice(8, 10)) : (tym > ym ? days : 0);
  var linesById = byId(lines), perDayRaw = [];
  for(var i = 0; i < days; i++) perDayRaw.push(0);
  (transactions || []).forEach(function(t){
    if(!t || String(t.date || "").slice(0, 7) !== ym) return;
    if(monthKindOfTx(t, linesById) !== "lifestyle") return;
    var d = Number(String(t.date).slice(8, 10));
    if(d >= 1 && d <= days) perDayRaw[d - 1] += num(t.amount);
  });
  var byDay = [], run = 0;
  for(var j = 0; j < day; j++){ run += perDayRaw[j]; byDay.push(r2(run)); }
  var planned = split.lifestyle.planned, spent = split.lifestyle.spent, left = r2(planned - spent);
  var daysLeft = days - day;
  var projected = day > 0 ? r2(spent / day * days) : 0;
  var diff = r2(planned - projected);
  var status = day >= days ? "past" : day < 5 ? "early" : Math.abs(diff) <= Math.max(25, planned * 0.02) ? "on" : diff > 0 ? "under" : "over";
  return { days: days, day: day, planned: planned, spent: spent, left: left, daysLeft: daysLeft,
    perDay: daysLeft > 0 ? r2(Math.max(0, left) / daysLeft) : 0, byDay: byDay, projected: projected, diff: diff, status: status };
}

// A set-aside line's pot on `today`. `potStart` is what it held on `potFrom` (set when someone says what's in it);
// without them it starts empty the day before the line's budget year, so the pot is that year's allowance less what
// was spent. Each month after potFrom's adds the monthly amount; spending after potFrom comes out.
// → { from, start, months, putIn, spent, balance, monthly, yearly, short }.
export function potFor(line, transactions, today, opts){
  opts = opts || {};
  var monthly = opts.monthlyOf ? opts.monthlyOf(line) : periodsOf(num(line.amount), line.freq).monthly;
  var from = line.potFrom && /^\d{4}-\d{2}-\d{2}$/.test(line.potFrom) ? line.potFrom : dayBefore(reserveCycleFor(line, today).start);
  var start = line.potFrom ? num(line.potStart) : 0;
  var months = Math.max(0, monthsBetween(from, today));
  var spent = (transactions || []).reduce(function(s, t){
    return t && t.linkedExpenseId === line.id && t.date > from && t.date <= today ? s + num(t.amount) : s;
  }, 0);
  var putIn = monthly * months;
  var balance = start + putIn - spent;
  return { from: from, start: r2(start), months: months, putIn: r2(putIn), spent: r2(spent), balance: r2(balance), monthly: r2(monthly), yearly: r2(monthly * 12), short: balance < -0.5 };
}
// Every set-aside line still running on `today`, with its pot: [{ line, pot }].
export function pots(lines, transactions, today, opts){
  return (lines || []).filter(function(l){ return isSetAside(l) && !l.computed && isActiveOn(l, today); })
    .map(function(l){ return { line: l, pot: potFor(l, transactions, today, opts) }; })
    .sort(function(a, b){ return b.pot.monthly - a.pot.monthly; });
}
// The trips that spent from a line (state.trips with this lineId), newest first: [{ trip, spent }].
export function potTrips(line, trips, transactions){
  return (trips || []).filter(function(t){ return t && t.lineId === line.id; })
    .map(function(t){ return { trip: t, spent: r2(tripSpend(t, (transactions || []).filter(function(x){ return x.linkedExpenseId === line.id; }))) }; })
    .sort(function(a, b){ return String(b.trip.from).localeCompare(String(a.trip.from)); });
}

// Words that say a line is chosen spending, or essential, whatever it's marked.
var LIFESTYLE_CATEGORIES = /^(eating out|dining out|takeaway|entertainment|shopping|subscriptions?|fitness|travel|holidays?|gifts?|alcohol|hobbies|leisure|going out|clothes|clothing|beauty)$/i;
var ESSENTIAL_CATEGORIES = /^(health|medical|utilities|housing|insurance|childcare|education|groceries|rent)$/i;
var ESSENTIAL_WORDS = /\b(medical|pharmacy|chemist|doctor|gp|dental|dentist|vet|health insurance|rent|electricity|water|council rates|childcare|school fees)\b/i;

// Lines whose answers look wrong. lines: what spend is logged against (no computed rows). opts: { today (required),
// ok: { "<hint id>": true } }. → [{ id, kind, lineId, what, text, fix: { label, set } }], at most one per line.
//   "essential-lifestyle": marked Essential, its category is chosen spending (Eating out, Shopping, Travel…).
//   "lifestyle-essential": marked Lifestyle, its category or name is essential (Health, Pharmacy, Vet…).
//   "setaside-monthly":    set aside, but spent in 10 or more of the last 12 months — it's an every-month cost.
export function budgetHints(lines, transactions, opts){
  opts = opts || {};
  var today = opts.today, ok = opts.ok || {}, out = [];
  // The last twelve calendar months, this one included.
  var fy = Number(today.slice(0, 4)), fm = Number(today.slice(5, 7)) - 11;
  if(fm <= 0){ fm += 12; fy--; }
  var from = fy + "-" + String(fm).padStart(2, "0") + "-01";
  var monthsSpent = {};
  (transactions || []).forEach(function(t){
    if(!t || !t.linkedExpenseId || !(num(t.amount) > 0) || !t.date || t.date < from || t.date > today) return;
    (monthsSpent[t.linkedExpenseId] = monthsSpent[t.linkedExpenseId] || {})[t.date.slice(0, 7)] = true;
  });
  (lines || []).forEach(function(l){
    if(!l || !l.id || l.computed || !isActiveOn(l, today)) return;
    var cat = String(l.category || "").trim(), name = String(l.what || "");
    var add = function(kind, text, fix){
      var id = "hint:" + kind + "|" + l.id;
      if(!ok[id] && !out.some(function(h){ return h.lineId === l.id; })) out.push({ id: id, kind: kind, lineId: l.id, what: name, text: text, fix: fix });
    };
    if(l.classification === "Needs" && LIFESTYLE_CATEGORIES.test(cat))
      add("essential-lifestyle", "marked Essential, but " + cat + " is usually chosen spending", { label: "Make it Lifestyle", set: { classification: "Wants" } });
    if(l.classification === "Wants" && (ESSENTIAL_CATEGORIES.test(cat) || ESSENTIAL_WORDS.test(name)))
      add("lifestyle-essential", "marked Lifestyle, but it reads as essential", { label: "Make it Essential", set: { classification: "Needs" } });
    var n = Object.keys(monthsSpent[l.id] || {}).length;
    if(isSetAside(l) && n >= 10)
      add("setaside-monthly", "set aside, but spent in " + n + " of the last 12 months", { label: "Make it every month", set: { irregular: false } });
  });
  return out;
}
