import { state } from "../state.js";
import { periodsOf, isActiveOn, resolveSharedAmount } from "./ledger.js";
import { scenarioTotals } from "./engine.js";
import { amountChangeFor, setAmountChange } from "./scenariochanges.js";

// ---------------- Trimming the budget (v3.100.0) ----------------
//
// Some lines are commitments; others are choices that could be paused or cut if a purchase or a
// bad year needed them to be — trips, house hunting, date nights. And some lines are simply bigger
// in the plan than anything that's been spent on them, which makes every scenario look worse than
// life actually is. This finds both, and lets a scenario be run "lean": each flexible line kept,
// halved or paused in that scenario only (through the per-scenario overrides the budget already
// has), so the household budget itself is never touched. Pure apart from reading state.
//
// A line is flexible when marked so (line.flexible), or — until it's marked either way — when it's
// a Wants line spent unevenly (irregular): the lumpy, discretionary money.
var MIN_MONTHS = 6;
function r0(n){ return Math.round(n); }
function shiftIso(iso, months){ var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + months, Number(iso.slice(8, 10))); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

export function isFlexible(line){
  if(!line) return false;
  if(line.flexible === true || line.flexible === false) return line.flexible;
  return line.classification === "Wants" && !!line.irregular;
}
function budgetLines(st){
  return (st.shared || []).filter(function(l){ return l && l.id && !l.computed; });
}

// What's been spent on each line over the last twelve months, and how many months that covers.
function actuals(st, today){
  var from = shiftIso(today, -12), by = {}, first = null;
  (st.transactions || []).forEach(function(t){
    if(!t.linkedExpenseId || !t.date || t.date <= from || t.date > today) return;
    by[t.linkedExpenseId] = (by[t.linkedExpenseId] || 0) + (Number(t.amount) || 0);
    if(!first || t.date < first) first = t.date;
  });
  var months = first ? Math.min(12, (Date.parse(today) - Date.parse(first)) / (86400000 * 30.44)) : 0;
  return { by: by, months: months };
}

// Similar subscriptions: two of a kind is worth a look (two cloud storage plans, two video services).
var FAMILIES = [
  { name: "Cloud storage", re: /\b(icloud|google (one|drive|play storage|storage)|dropbox|onedrive|google play storage)\b/i },
  { name: "Video streaming", re: /\b(netflix|stan|binge|disney|paramount|foxtel|kayo|crunchyroll|youtube premium|prime video|prime ad free|apple tv)\b/i },
  { name: "Music", re: /\b(spotify|apple music|youtube music|tidal|deezer)\b/i },
  { name: "Amazon Prime", re: /\bprime\b/i }
];

export function trimReport(opts){
  opts = opts || {};
  var st = opts.state || state;
  var today = opts.today;
  var a = actuals(st, today);
  var lines = budgetLines(st).filter(function(l){ return isActiveOn(l, today); });
  // Budgeted well above what's actually spent — once enough is logged to say.
  var over = a.months >= MIN_MONTHS ? lines.map(function(l){
    var planned = periodsOf(Number(l.amount) || 0, l.freq).yearly;
    var actual = (a.by[l.id] || 0) * 12 / Math.max(1, a.months);
    return { id: l.id, what: l.what || "Line", category: l.category || "", freq: l.freq, planned: r0(planned), actual: r0(actual), gap: r0(planned - actual),
      suggested: Math.round(actual / Math.max(1, periodsOf(1, l.freq).yearly) * 100) / 100 };
  }).filter(function(x){ return x.planned > 0 && x.gap >= 300 && x.actual < x.planned * 0.75; })
    .sort(function(x, y){ return y.gap - x.gap; }) : [];
  // The flexible lines, biggest first, with what halving or pausing each frees.
  var flex = lines.filter(isFlexible).map(function(l){
    var y = periodsOf(Number(l.amount) || 0, l.freq).yearly;
    return { id: l.id, what: l.what || "Line", category: l.category || "", yearly: r0(y), monthly: r0(y / 12), inferred: l.flexible == null };
  }).sort(function(x, y){ return y.yearly - x.yearly; });
  // Every Wants line, for marking which are flexible.
  var wants = lines.filter(function(l){ return l.classification === "Wants"; }).map(function(l){
    return { id: l.id, what: l.what || "Line", flexible: isFlexible(l), inferred: l.flexible == null, yearly: r0(periodsOf(Number(l.amount) || 0, l.freq).yearly) };
  }).sort(function(x, y){ return y.yearly - x.yearly; });
  var subs = lines.filter(function(l){ return /subscri/i.test(l.category || "") || FAMILIES.some(function(f){ return f.re.test(l.what || ""); }); });
  var dupes = [];
  FAMILIES.forEach(function(f){
    var hit = subs.filter(function(l){ return f.re.test(l.what || ""); });
    if(hit.length >= 2) dupes.push({ family: f.name, lines: hit.map(function(l){ return { id: l.id, what: l.what, yearly: r0(periodsOf(Number(l.amount) || 0, l.freq).yearly) }; }) });
  });
  return {
    months: a.months, over: over, overYearly: over.reduce(function(s, x){ return s + x.gap; }, 0),
    flexible: flex, flexibleYearly: flex.reduce(function(s, x){ return s + x.yearly; }, 0),
    wants: wants, duplicates: dupes
  };
}

// The level a flexible line is set to in a scenario: "keep", "half", "pause" (or "custom").
// v3.172.0 (item 207): the level is a change kept in the scenario (calc/scenariochanges.js), not on the line.
export function leanLevel(line, scenario){
  var own = line && line.id != null ? amountChangeFor(scenario, line.id) : null;
  if(own == null) return "keep";
  var base = Number(line.amount) || 0, v = Number(own);
  if(v === 0) return "pause";
  if(base > 0 && Math.abs(v - base / 2) < 0.01) return "half";
  if(Math.abs(v - base) < 0.01) return "keep";
  return "custom";
}
export function setLeanLevel(line, scenario, level){
  if(!line) return;
  var base = Number(line.amount) || 0;
  if(line.id == null) return;
  if(level === "keep"){ setAmountChange(scenario, line.id, null); return; }
  setAmountChange(scenario, line.id, level === "pause" ? 0 : Math.round(base / 2 * 100) / 100, function(){ return "chg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); });
}
// What the lean settings change in a scenario: what a normal month leaves with and without them.
export function leanEffect(scenario, opts){
  opts = opts || {};
  var st = opts.state || state;
  var today = opts.today;
  var freed = 0, changed = [];
  budgetLines(st).forEach(function(l){
    if(!isActiveOn(l, today)) return;
    var lvl = leanLevel(l, scenario);
    if(lvl === "keep") return;
    var base = periodsOf(Number(l.amount) || 0, l.freq).monthly;
    var now = periodsOf(Number(resolveSharedAmount(l, scenario)) || 0, l.freq).monthly;
    if(base - now > 0.005){ freed += base - now; changed.push({ id: l.id, what: l.what, level: lvl, monthly: r0(base - now) }); }
  });
  var t = scenarioTotals(scenario);
  return { scenario: scenario, freedMonthly: r0(freed), freedYearly: r0(freed * 12), changed: changed,
    leanMonthly: r0(t.regularNetMonthly), fullMonthly: r0(t.regularNetMonthly - freed) };
}
