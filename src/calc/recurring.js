import { merchantKey, suggestedLineName } from "./import-rules.js";
import { periodsOf } from "./ledger.js";

// ---------------- Recurring payments and subscriptions (v3.66.0) ----------------
//
// Two things a statement shows that a budget doesn't:
//   unbudgeted — the same payee charging on a steady rhythm with no budget line behind it (a
//                streaming service signed up for and forgotten, a gym direct debit)
//   rising     — a budget line whose recent charges are clearly above what it's budgeted at (a
//                price rise nobody updated the plan for)
// Pure: transactions and lines come in as arguments.
var CADENCES = [
  { freq: "Weekly", days: 7 }, { freq: "Fortnightly", days: 14 }, { freq: "Monthly", days: 30.4 },
  { freq: "Quarterly", days: 91 }, { freq: "Half-yearly", days: 182 }, { freq: "Yearly", days: 365 }
];
function median(a){ var s = a.slice().sort(function(x, y){ return x - y; }); var m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function days(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
function round(n){ return Math.round(n * 100) / 100; }

// The cadence a list of dates keeps, or null: the median gap within 25% of a known rhythm, and
// most gaps agreeing with it.
export function cadenceOf(dates){
  var d = dates.slice().sort();
  if(d.length < 3) return null;
  var gaps = [];
  for(var i = 1; i < d.length; i++) gaps.push(days(d[i - 1], d[i]));
  var g = median(gaps);
  var c = CADENCES.find(function(x){ return Math.abs(g - x.days) <= x.days * 0.25; });
  if(!c) return null;
  var agree = gaps.filter(function(x){ return Math.abs(x - c.days) <= c.days * 0.3; }).length;
  return agree >= Math.ceil(gaps.length * 0.7) ? c.freq : null;
}

export function unbudgetedRecurring(transactions, today){
  var groups = {};
  (transactions || []).forEach(function(t, i){
    if(!t || t.linkedExpenseId || !(Number(t.amount) > 0) || !t.date) return;
    var key = merchantKey(t.what || "");
    if(!key) return;
    (groups[key] = groups[key] || { key: key, label: t.what, items: [] }).items.push({ date: t.date, amount: Number(t.amount), index: i, category: t.category || "" });
  });
  var out = [];
  Object.keys(groups).forEach(function(k){
    var g = groups[k];
    var freq = cadenceOf(g.items.map(function(x){ return x.date; }));
    if(!freq) return;
    var amounts = g.items.map(function(x){ return x.amount; });
    var med = median(amounts);
    // A steady payee charges about the same each time; groceries at one shop don't.
    var similar = amounts.filter(function(a){ return Math.abs(a - med) <= Math.max(2, med * 0.15); }).length;
    if(similar < Math.ceil(amounts.length * 0.7)) return;
    var last = g.items.map(function(x){ return x.date; }).sort().pop();
    var cad = CADENCES.find(function(c){ return c.freq === freq; });
    // Stopped: nothing for more than two cycles.
    if(today && days(last, today) > cad.days * 2.2) return;
    var cats = g.items.map(function(x){ return x.category; }).filter(Boolean);
    out.push({ key: k, name: suggestedLineName(k), label: g.label, freq: freq, amount: round(med), count: g.items.length, last: last,
      monthly: round(periodsOf(med, freq).monthly), category: cats.length ? cats[cats.length - 1] : "", indices: g.items.map(function(x){ return x.index; }) });
  });
  return out.sort(function(a, b){ return b.monthly - a.monthly; });
}

// Lines whose last three charges (median) run more than 5% and $2 above the budgeted amount.
export function risingLines(lines, transactions){
  var byLine = {};
  (transactions || []).forEach(function(t){ if(t && t.linkedExpenseId && Number(t.amount) > 0 && t.date) (byLine[t.linkedExpenseId] = byLine[t.linkedExpenseId] || []).push(t); });
  var out = [];
  (lines || []).forEach(function(l){
    if(!l.id || l.irregular || l.computed) return;
    var tx = (byLine[l.id] || []).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    if(tx.length < 2) return;
    // A line paid in pieces (groceries, fuel) isn't a single charge to compare against its amount.
    if(!cadenceOf(tx.map(function(t){ return t.date; })) && tx.length >= 3) return;
    var recent = median(tx.slice(-3).map(function(t){ return Number(t.amount); }));
    var planned = Number(l.amount) || 0;
    if(planned > 0 && recent > planned * 1.05 && recent - planned >= 2){
      var earlier = tx.length > 3 ? median(tx.slice(0, -3).map(function(t){ return Number(t.amount); })) : null;
      out.push({ id: l.id, what: l.what || "Budget line", freq: l.freq, planned: round(planned), recent: round(recent), since: tx[tx.length - 1].date,
        earlier: earlier == null ? null : round(earlier), extraMonthly: round(periodsOf(recent - planned, l.freq).monthly) });
    }
  });
  return out.sort(function(a, b){ return b.extraMonthly - a.extraMonthly; });
}

// ---------------- What's hiding in a catch-all line (v3.90.0) ----------------
//
// "Misc." and "Extras" end up holding a real share of spending, and a line that holds everything
// says nothing about any of it. The same payees come up again and again inside them — the hardware
// store, the bottle shop — and each of those is a line waiting to be named. Payees of one kind are
// grouped (three bottle shops are one "Alcohol" line, not three), and each group is offered as its
// own line, or as a move to a line that already exists with that name. Pure.
var CATCH_ALL = /\b(misc|miscellaneous|extras?|other|sundr(y|ies)|general|uncategori[sz]ed)\b/i;
export function isCatchAllLine(line){ return !!(line && CATCH_ALL.test(String(line.what || ""))); }
var KINDS = [
  { name: "Alcohol", category: "Eating out", re: /\b(bws|dan murphy|liquorland|first choice|vintage cellars|liquor|bottle ?shop|cellars?)\b/ },
  { name: "Home & garden", category: "Home", re: /\b(bunnings|ikea|mitre ?10|amart|fantastic furniture|freedom|harvey norman|temple ?& ?webster|officeworks)\b/ },
  { name: "Household", category: "Shopping", re: /\b(kmart|big w|target|daiso|spotlight|the reject shop|myer|david jones)\b/ },
  { name: "Pharmacy", category: "Health", re: /\b(chemist|cwh|priceline|pharmacy|terrywhite|amcal)\b/ },
  { name: "Kids & play", category: "Kids", re: /\b(timezone|kids|playground|toy|lego)\b/ }
];
function kindOf(key){ return KINDS.find(function(k){ return k.re.test(key); }) || null; }

export function catchAllSuggestions(lines, transactions, today, opts){
  opts = opts || {};
  var minCount = opts.minCount || 3, minTotal = opts.minTotal || 100;
  var since = String(Number(String(today).slice(0, 4)) - 1) + String(today).slice(4);
  var others = (lines || []).filter(function(l){ return l && l.id && !isCatchAllLine(l); });
  var out = [];
  (lines || []).filter(isCatchAllLine).forEach(function(line){
    var groups = {};
    (transactions || []).forEach(function(t, i){
      if(!t || t.linkedExpenseId !== line.id || !t.date || t.date <= since) return;
      var key = merchantKey(t.what || "");
      if(!key) return;
      var k = kindOf(key);
      var gk = k ? "kind:" + k.name : "m:" + key;
      var g = groups[gk] || (groups[gk] = { name: k ? k.name : suggestedLineName(key), category: k ? k.category : "", keys: [], indices: [], total: 0 });
      if(g.keys.indexOf(key) === -1) g.keys.push(key);
      g.indices.push(i);
      g.total += Number(t.amount) || 0;
    });
    Object.keys(groups).forEach(function(gk){
      var g = groups[gk];
      if(g.indices.length < minCount || g.total < minTotal) return;
      var lower = g.name.toLowerCase();
      var existing = others.find(function(l){ return String(l.what || "").trim().toLowerCase() === lower; }) || null;
      out.push({ id: line.id + "|" + gk, lineId: line.id, lineWhat: line.what || "", name: g.name, category: g.category, keys: g.keys,
        indices: g.indices, count: g.indices.length, total: round(g.total), monthly: round(g.total / 12),
        existingLineId: existing ? existing.id : null, existingWhat: existing ? existing.what : "" });
    });
  });
  return out.sort(function(a, b){ return b.total - a.total; });
}
