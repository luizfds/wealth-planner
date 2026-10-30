// ---------------- A flexible budget as well as a detailed one (v3.164.0, item 194) ----------------
//
// Thirty lines is a lot to keep. The same lines, read as three numbers: fixed bills (rent, power,
// insurance — they cost what they cost), one flexible amount for the month (groceries, fuel, eating
// out — what you can actually steer), and non-monthly costs set aside (rego, holidays, anything
// yearly or quarterly). Nothing about the lines changes; Budget → Group by → Flexible regroups them,
// so the two views always total the same. A line can say which it is (item.flexKind) when the
// guess is wrong. A category can roll what's unspent into next month (state.rollover[category] =
// the month it started). Pure.

import { freqStepMonths } from "./ledger.js";

export var FLEX_KINDS = ["fixed", "flex", "nonmonthly"];
export var FLEX_LABELS = { fixed: "Fixed bills", flex: "Flexible", nonmonthly: "Non-monthly" };

// Bills that cost what they cost, whatever the frequency: a weekly rent is as fixed as a monthly
// power bill, while weekly groceries are the money you steer.
var FIXED_WORDS = /investment property|rental|landlord|hous|rent\b|mortgage|home loan|loan|utilit|electric|\bgas\b|water|power|energy|insur|subscri|stream|membership|phone|mobile|internet|broadband|educat|school|childcare|council|strata|rates\b/i;

export function flexKindOf(item){
  item = item || {};
  if(FLEX_KINDS.indexOf(item.flexKind) !== -1) return item.flexKind;
  if(item.irregular || freqStepMonths(item.freq) > 1) return "nonmonthly";
  if(FIXED_WORDS.test((item.category || "") + " " + (item.what || ""))) return "fixed";
  if(item.classification === "Wants") return "flex";
  // A Needs line paid monthly is a bill; one paid weekly or fortnightly is spending.
  return item.freq === "Monthly" ? "fixed" : "flex";
}

function ymAdd(ym, n){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + "-" + String(m + 1).padStart(2, "0");
}

// The flexible month. lines: [{ item, monthly }] (monthly already scenario-resolved, as the cards
// total it); transactions: state.transactions; ym: "YYYY-MM" — the period picker's month.
// opts.categoryOf(t) resolves a transaction's category the way the rest of the app does;
// opts.rollover = state.rollover. A transaction counts as flexible spending when it's logged against
// a flexible line, or against no line at all (a one-off is spending you chose).
export function flexMonth(lines, transactions, ym, opts){
  opts = opts || {};
  var categoryOf = opts.categoryOf || function(t){ return t.category || ""; };
  var flexLines = (lines || []).filter(function(l){ return flexKindOf(l.item) === "flex"; });
  var lineIds = {}, kindById = {};
  (lines || []).forEach(function(l){ if(l.item && l.item.id) kindById[l.item.id] = flexKindOf(l.item); });
  flexLines.forEach(function(l){ if(l.item.id) lineIds[l.item.id] = true; });
  var isFlexSpend = function(t){ return t.linkedExpenseId ? !!lineIds[t.linkedExpenseId] : !kindById[t.linkedExpenseId]; };
  var spentIn = function(month){
    var byCat = {}, total = 0;
    (transactions || []).forEach(function(t){
      if(!t || !t.date || t.date.slice(0, 7) !== month || !isFlexSpend(t)) return;
      var a = Number(t.amount) || 0, c = categoryOf(t) || "Other";
      byCat[c] = (byCat[c] || 0) + a; total += a;
    });
    return { byCat: byCat, total: total };
  };
  var planned = {}, plannedTotal = 0;
  flexLines.forEach(function(l){ var c = (l.item.category || "").trim() || "Other"; planned[c] = (planned[c] || 0) + (Number(l.monthly) || 0); plannedTotal += Number(l.monthly) || 0; });
  var now = spentIn(ym);
  var cats = Object.keys(planned).concat(Object.keys(now.byCat).filter(function(c){ return planned[c] == null; }));
  var rolled = {}, rolledTotal = 0;
  cats.forEach(function(c){
    var start = opts.rollover && opts.rollover[c];
    if(!start || start >= ym) return;
    var bal = 0;
    for(var m = start, guard = 0; m < ym && guard < 120; m = ymAdd(m, 1), guard++) bal += (planned[c] || 0) - (spentIn(m).byCat[c] || 0);
    rolled[c] = bal; rolledTotal += bal;
  });
  var byCategory = cats.map(function(c){
    var p = planned[c] || 0, s = now.byCat[c] || 0, r = rolled[c] || 0;
    return { category: c, planned: p, spent: s, rolled: r, left: p + r - s, rollover: !!(opts.rollover && opts.rollover[c]) };
  }).sort(function(a, b){ return b.planned - a.planned || b.spent - a.spent; });
  return { planned: plannedTotal, spent: now.total, rolled: rolledTotal, left: plannedTotal + rolledTotal - now.total, byCategory: byCategory };
}

// The three totals, a month each — the same money the detailed view totals.
export function flexTotals(lines){
  var out = { fixed: 0, flex: 0, nonmonthly: 0 };
  (lines || []).forEach(function(l){ out[flexKindOf(l.item)] += Number(l.monthly) || 0; });
  return out;
}
