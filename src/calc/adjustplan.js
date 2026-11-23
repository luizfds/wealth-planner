// ---------------- Adjust the plan: each line beside what's typically spent (November 2026) ----------------
//
// A plan far from what's spent makes every month — and every scenario on Plan — look better or worse than it is. Here
// every line sits beside its typical month over the last twelve full months (this month isn't over, so it's left out),
// and "Use typical" sets the line to it in its own frequency. Pure: lines, transactions and dates in, rows out.
import { periodsOf, isActiveOn } from "./ledger.js";

function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function ymOf(d){ return String(d).slice(0, 7); }
function addMonths(ym, k){ var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + "-" + String(m + 1).padStart(2, "0"); }

// A line's typical month: { monthly, months, monthsSpent, monthsOver } over the full months it could have been spent in —
// the last twelve before this one, or fewer when the line started (or its spending began) later.
export function typicalMonthly(line, transactions, today, planMonthly){
  var end = addMonths(ymOf(today), -1), start = addMonths(end, -11);
  var mine = (transactions || []).filter(function(t){ return t && t.linkedExpenseId === line.id && t.date && ymOf(t.date) >= start && ymOf(t.date) <= end; });
  var from = start;
  if(line.startDate && ymOf(line.startDate) > from) from = ymOf(line.startDate);
  var firstEver = (transactions || []).reduce(function(m, t){ return t && t.linkedExpenseId === line.id && t.date && (!m || t.date < m) ? t.date : m; }, "");
  if(firstEver && ymOf(firstEver) > from) from = ymOf(firstEver);
  var months = 0, k = from;
  while(k <= end && months < 12){ months++; k = addMonths(k, 1); }
  var byMonth = {};
  mine.forEach(function(t){ var m = ymOf(t.date); if(m >= from) byMonth[m] = (byMonth[m] || 0) + num(t.amount); });
  var total = Object.keys(byMonth).reduce(function(s, m){ return s + byMonth[m]; }, 0);
  var monthsOver = planMonthly > 0 ? Object.keys(byMonth).filter(function(m){ return byMonth[m] > planMonthly + 0.5; }).length : 0;
  return { monthly: months ? Math.round(total / months * 100) / 100 : 0, months: months, monthsSpent: Object.keys(byMonth).length, monthsOver: monthsOver };
}

// [{ id, what, classification, irregular, freq, planMonthly, typical, months, far, diff, amount, note }], furthest first.
// `far`: at least three months to go on, something logged, and $20 and a fifth of the plan apart. `amount`: the typical month in the line's
// own frequency, to the dollar. opts: { monthlyOf(line) — the plan a month (default its amount and frequency) }.
export function adjustRows(lines, transactions, today, opts){
  opts = opts || {};
  var monthlyOf = opts.monthlyOf || function(l){ return periodsOf(num(l.amount), l.freq).monthly; };
  return (lines || []).filter(function(l){ return l && l.id && !l.computed && isActiveOn(l, today); }).map(function(l){
    var plan = Math.round(monthlyOf(l) * 100) / 100;
    var t = typicalMonthly(l, transactions, today, plan);
    var diff = Math.round((t.monthly - plan) * 100) / 100;
    var perMonth = periodsOf(1, l.freq).monthly || 1;
    // Nothing logged isn't "spends $0": a bill paid where nobody logs it (council rates from another account) would be
    // offered as $0. Such a line shows under All, where setting it to $0 is still one deliberate tap.
    var far = t.months >= 3 && t.monthsSpent > 0 && Math.abs(diff) >= Math.max(20, Math.abs(plan) * 0.2);
    var note = !t.monthsSpent ? "nothing logged in " + t.months + " month" + (t.months === 1 ? "" : "s") + " — paid somewhere else?"
      : t.monthsOver ? "over the plan " + t.monthsOver + " of " + t.months + " months" : "spent in " + t.monthsSpent + " of " + t.months + " months";
    return { id: l.id, what: l.what || "Line", classification: l.classification, irregular: !!l.irregular, freq: l.freq, planMonthly: plan, typical: t.monthly,
      months: t.months, far: far, diff: diff, amount: Math.round(t.monthly / perMonth), note: note };
  }).sort(function(a, b){ return Math.abs(b.diff) - Math.abs(a.diff) || a.what.localeCompare(b.what); });
}

// What saving the picked rows would do to the plan a month: { delta, count }.
export function adjustEffect(rows, picked){
  var delta = 0, count = 0;
  (rows || []).forEach(function(r){ if(picked && picked[r.id]){ delta += r.typical - r.planMonthly; count++; } });
  return { delta: Math.round(delta * 100) / 100, count: count };
}
// Sets each picked line to its typical amount. lineOf(id) → the line object. → its undo.
export function applyAdjust(rows, picked, lineOf){
  var was = [];
  (rows || []).forEach(function(r){
    if(!picked || !picked[r.id]) return;
    var l = lineOf(r.id);
    if(!l) return;
    was.push({ l: l, amount: l.amount });
    l.amount = r.amount;
  });
  return { count: was.length, undo: function(){ was.forEach(function(w){ w.l.amount = w.amount; }); } };
}
