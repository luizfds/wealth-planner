// ---------------- Tidy up: spending filed on the wrong line (November 2026) ----------------
//
// A budget line collects whatever was filed against it, and nothing ever looked back. A household's
// "Pet" line had the toys in it as well as the food (all counted as Needs), one bottle shop among the
// groceries while every other visit sat under Drinks, a hardware store under the pet. Each was one
// tap at the time and nothing on screen said so afterwards.
//
// Two answers, both pure (no DOM, no state writes except the helpers handed the arrays they change):
//   strays()        a merchant nearly always filed on one line, with a few on another — the few are
//                   probably slips. A hint, never an error: "It's right" (`ok`) keeps the pair quiet.
//   lineMerchants() everything a line collected over the last year, by merchant, with its txIds, so
//                   a whole merchant (or a few of its purchases) can be moved, counted as Needs or
//                   Wants, or taught to the import.
import { merchantGroupKey } from "./merchants.js";
import { cleanMerchantName, knownMerchant } from "./merchantbook.js";
import { merchantKey, learnRule } from "./import-rules.js";
import { TX_CLASSES } from "./ledger.js";
import { tripOn } from "./trips.js";

export var TIDY_MONTHS = 12;
// A merchant needs this many purchases before "nearly always on one line" means anything; its main
// line this share of them; and a line counts as a stray with at most this many.
export var STRAY_MIN_TOTAL = 4;
export var STRAY_MIN_MAIN = 3;
export var STRAY_MAIN_SHARE = 0.75;
export var STRAY_MAX = 2;

// Words that start too many shop names to stand for one merchant on their own.
var GENERIC_LEAD = ["the", "a", "an", "my", "new", "big", "best", "city", "shop", "store", "cafe", "market", "online"];

function windowStart(today, months){
  var y = Number(String(today).slice(0, 4)), m = Number(String(today).slice(5, 7)) - (months || TIDY_MONTHS);
  while(m <= 0){ m += 12; y--; }
  return y + "-" + String(m).padStart(2, "0") + String(today).slice(7, 10);
}

// Who a transaction paid: { key, label, known } or null when nothing names it. The bank's words when
// the row came from a statement (a typed note on it — "Toys for the dog" — says what, not who), else
// what was typed. A brand the merchant book knows is that brand, so "PETSHOP ONE EXAMPLE TOWN" and
// "Petshop One" agree.
export function merchantIdentity(t){
  if(!t) return null;
  var raw = String(t.bankWhat || t.what || "").trim();
  if(!raw) return null;
  var known = knownMerchant(raw);
  var label = known ? known.name : cleanMerchantName(raw);
  var key = merchantGroupKey(label);
  return key ? { key: key, label: label, known: !!known } : null;
}

// Keys mapped onto the merchant they're a branch of: "petshop one northside" → "petshop one" when both
// were seen. Never a known brand into another ("shop one fuel" stays apart from "shop one"), never onto a
// lone generic word.
function prefixMap(keys, knownKeys){
  var sorted = keys.slice().sort(function(a, b){ return a.length - b.length; });
  var map = {};
  sorted.forEach(function(k){
    if(knownKeys[k]) return;
    for(var i = 0; i < sorted.length; i++){
      var s = sorted[i];
      if(s.length >= k.length) break;
      if(k.indexOf(s + " ") !== 0) continue;
      if(s.length < 4 || GENERIC_LEAD.indexOf(s) !== -1) continue;
      map[k] = map[s] || s;
      return;
    }
  });
  return map;
}

// Spending rows in the window, each with its merchant: [{ t, key, label }].
function spendRows(transactions, today, months, filter){
  var from = windowStart(today, months);
  var rows = [];
  (transactions || []).forEach(function(t){
    if(!t || !t.id || !(Number(t.amount) > 0) || !t.date || t.date < from || t.date > today) return;
    if(filter && !filter(t)) return;
    var who = merchantIdentity(t);
    if(who) rows.push({ t: t, key: who.key, label: who.label, known: who.known });
  });
  var knownKeys = {};
  rows.forEach(function(r){ if(r.known) knownKeys[r.key] = true; });
  var map = prefixMap(Object.keys(rows.reduce(function(m, r){ m[r.key] = 1; return m; }, {})), knownKeys);
  rows.forEach(function(r){ if(map[r.key]) r.key = map[r.key]; });
  return rows;
}
// The label read back for a group: the spelling seen most for its own key (the shortest, unmerged one).
function bestLabel(rows){
  var counts = {}, best = "", n = -1;
  rows.forEach(function(r){ counts[r.label] = (counts[r.label] || 0) + 1; });
  Object.keys(counts).forEach(function(l){
    var short = merchantGroupKey(l) === rows[0].key;
    var score = counts[l] + (short ? 1000 : 0);
    if(score > n){ n = score; best = l; }
  });
  return best;
}
function round2(n){ return Math.round(n * 100) / 100; }

// opts: { today (required), months, ok: { "<key>|<lineId>": true }, trips }. lines: the budget lines
// spend can be logged against. → [{ id, key, label, fromLineId, toLineId, txIds, count, total,
// mainCount }], biggest first. Some placements are on purpose and never count: one part of a split; a
// description that only restates a line's name ("Groceries" logged on a trip); spending inside a trip,
// on that trip's line (the trip is why it's there); and a line named for the merchant ("Shop One
// membership" beside the Shop One groceries).
export function strays(transactions, lines, opts){
  opts = opts || {};
  var byId = {}, names = {};
  (lines || []).forEach(function(l){ if(l && l.id){ byId[l.id] = l; names[merchantGroupKey(l.what || "")] = true; } });
  var ok = opts.ok || {};
  var onTrip = function(t){ var trip = tripOn(t.date, opts.trips); return !!(trip && trip.lineId && trip.lineId === t.linkedExpenseId); };
  var rows = spendRows(transactions, opts.today, opts.months, function(t){ return t.linkedExpenseId && byId[t.linkedExpenseId] && !t.splitGroup && !onTrip(t); })
    .filter(function(r){ return !names[r.key]; });
  var namedFor = function(lineId, key){ return (" " + merchantGroupKey(byId[lineId].what || "") + " ").indexOf(" " + key + " ") !== -1; };
  var groups = {};
  rows.forEach(function(r){
    var g = groups[r.key] || (groups[r.key] = { rows: [], byLine: {} });
    g.rows.push(r);
    (g.byLine[r.t.linkedExpenseId] = g.byLine[r.t.linkedExpenseId] || []).push(r);
  });
  var out = [];
  Object.keys(groups).forEach(function(key){
    var g = groups[key], n = g.rows.length;
    if(n < STRAY_MIN_TOTAL) return;
    var lineIds = Object.keys(g.byLine);
    if(lineIds.length < 2) return;
    lineIds.sort(function(a, b){ return g.byLine[b].length - g.byLine[a].length; });
    var main = lineIds[0], mainN = g.byLine[main].length;
    if(mainN < STRAY_MIN_MAIN || mainN / n < STRAY_MAIN_SHARE) return;
    var label = bestLabel(g.rows);
    lineIds.slice(1).forEach(function(lid){
      var few = g.byLine[lid];
      if(few.length > STRAY_MAX || ok[key + "|" + lid] || namedFor(lid, key)) return;
      // What someone typed for these, where it isn't the bank's shop: "The Bakery" on a purchase the bank calls a gym —
      // the card says so, so a stray that isn't a slip isn't moved as one.
      var typed = [];
      few.forEach(function(r){
        var own = String(r.t.what || "").trim();
        if(r.t.bankWhat && own && own !== String(r.t.bankWhat).trim() && merchantGroupKey(own) !== key && typed.indexOf(own) === -1) typed.push(own);
      });
      out.push({ id: key + "|" + lid, key: key, label: label, fromLineId: lid, toLineId: main, typed: typed,
        txIds: few.map(function(r){ return r.t.id; }), count: few.length,
        total: round2(few.reduce(function(s, r){ return s + Number(r.t.amount); }, 0)), mainCount: mainN });
    });
  });
  return out.sort(function(a, b){ return b.total - a.total || a.label.localeCompare(b.label); });
}
// { lineId: purchases that look misfiled on it } — the marker on a budget row.
export function strayCountByLine(list){
  var out = {};
  (list || []).forEach(function(s){ out[s.fromLineId] = (out[s.fromLineId] || 0) + s.count; });
  return out;
}

// Everything one line collected over the window, by merchant: [{ key, label, count, total, txIds,
// wants, needs }] biggest first — wants/needs count the purchases that say so themselves. Rows with
// nothing naming them come last as one "(no description)" group (key ""), so the parts add up.
export function lineMerchants(transactions, lineId, opts){
  opts = opts || {};
  var from = windowStart(opts.today, opts.months);
  var mine = function(t){ return t && t.linkedExpenseId === lineId; };
  var rows = spendRows(transactions, opts.today, opts.months, mine);
  var groups = {}, order = [];
  rows.forEach(function(r){
    if(!groups[r.key]){ groups[r.key] = []; order.push(r.key); }
    groups[r.key].push(r);
  });
  var out = order.map(function(key){
    var g = groups[key];
    return { key: key, label: bestLabel(g), count: g.length, txIds: g.map(function(r){ return r.t.id; }),
      total: round2(g.reduce(function(s, r){ return s + Number(r.t.amount); }, 0)),
      wants: g.filter(function(r){ return r.t.classification === "Wants"; }).length,
      needs: g.filter(function(r){ return r.t.classification === "Needs"; }).length };
  }).sort(function(a, b){ return b.total - a.total || a.label.localeCompare(b.label); });
  var named = {};
  rows.forEach(function(r){ named[r.t.id] = true; });
  var rest = (transactions || []).filter(function(t){ return mine(t) && t.id && !named[t.id] && Number(t.amount) > 0 && t.date && t.date >= from && t.date <= opts.today; });
  if(rest.length) out.push({ key: "", label: "(no description)", count: rest.length, txIds: rest.map(function(t){ return t.id; }),
    total: round2(rest.reduce(function(s, t){ return s + Number(t.amount); }, 0)),
    wants: rest.filter(function(t){ return t.classification === "Wants"; }).length, needs: rest.filter(function(t){ return t.classification === "Needs"; }).length });
  return out;
}
// Lines that collect several different merchants — the ones worth a look inside, most merchants first:
// [{ lineId, what, merchants, count, total }].
export function mixedLines(transactions, lines, opts){
  return (lines || []).map(function(l){
    var ms = lineMerchants(transactions, l.id, opts).filter(function(m){ return m.key; });
    return { lineId: l.id, what: l.what || "Line", merchants: ms.length, count: ms.reduce(function(s, m){ return s + m.count; }, 0),
      total: round2(ms.reduce(function(s, m){ return s + m.total; }, 0)) };
  }).filter(function(x){ return x.merchants >= 3; })
    .sort(function(a, b){ return b.merchants - a.merchants || b.total - a.total; });
}

// ---- Changes. Each takes the arrays it changes and returns what it needs to undo. ----
function pick(transactions, ids){
  var want = {};
  (ids || []).forEach(function(id){ want[id] = true; });
  return (transactions || []).filter(function(t){ return t && want[t.id]; });
}
// Onto another line: its category comes from the line, so the row's own is cleared, and it counts as
// looked at. → [{ t, was }] for undo().
export function moveTransactions(transactions, ids, lineId){
  return pick(transactions, ids).map(function(t){
    var was = { linkedExpenseId: t.linkedExpenseId, category: t.category, reviewed: t.reviewed };
    t.linkedExpenseId = lineId || null;
    t.category = "";
    if(t.reviewed === false) t.reviewed = true;
    return { t: t, was: was };
  });
}
// Needs or Wants on the purchase itself; "" goes back to what its line is.
export function setTransactionsClass(transactions, ids, cls){
  return pick(transactions, ids).map(function(t){
    var was = { classification: t.classification };
    if(TX_CLASSES.indexOf(cls) !== -1) t.classification = cls; else delete t.classification;
    return { t: t, was: was };
  });
}
export function undoChanges(list){
  (list || []).forEach(function(x){
    Object.keys(x.was).forEach(function(k){ if(x.was[k] === undefined) delete x.t[k]; else x.t[k] = x.was[k]; });
  });
}
// The next statement files these merchants on `lineId` by itself: a rule learnt (or repointed) for
// each distinct merchant the import would key them on. → how many keys were taught.
export function teachRules(rules, transactions, ids, lineId, idFactory){
  var seen = {};
  pick(transactions, ids).forEach(function(t){
    var text = String(t.bankWhat || t.what || "").trim();
    var k = text && merchantKey(text);
    if(!k || seen[k]) return;
    seen[k] = true;
    learnRule(rules, text, { linkedExpenseId: lineId }, idFactory);
  });
  return Object.keys(seen).length;
}
// A new line for what's moved out of another: its category and account, the Needs or Wants asked for,
// and planned at what those purchases cost a month over the window.
export function newLineFor(source, what, cls, movedTotal, months, id){
  return { id: id, what: String(what || "").trim() || "New line", classification: TX_CLASSES.indexOf(cls) !== -1 ? cls : (source && source.classification) || "Wants",
    category: (source && source.category) || "", account: (source && source.account) || "", amount: Math.round((Number(movedTotal) || 0) / (months || TIDY_MONTHS)),
    freq: "Monthly", irregular: false, dueMonth: null };
}

// ---- The edits the Tidy up card makes, on the state it's handed — each returns its own undo. ----
// "It's right": this merchant belongs on that line; it isn't asked again.
export function markTidyOk(st, id){
  if(!st.tidyOk || typeof st.tidyOk !== "object") st.tidyOk = {};
  st.tidyOk[id] = true;
  return function(){ delete st.tidyOk[id]; };
}
// Move `ids` to line `to` — or, with `opts.newLine` ({ what, cls, source, months, id }), to a new line made for them —
// and with `opts.teach`, teach the import to file their merchants there. → { lineId, made, taught, undo }.
export function tidyMove(st, ids, to, opts){
  opts = opts || {};
  var made = null;
  if(opts.newLine){
    var n = opts.newLine;
    var movedTotal = pick(st.transactions, ids).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    made = newLineFor(n.source, n.what, n.cls, movedTotal, n.months, n.id);
    if(!Array.isArray(st.shared)) st.shared = [];
    st.shared.push(made);
    to = made.id;
  }
  if(!Array.isArray(st.importRules)) st.importRules = [];
  var rulesBefore = JSON.parse(JSON.stringify(st.importRules));
  var taught = opts.teach ? teachRules(st.importRules, st.transactions, ids, to, opts.idFactory) : 0;
  var moved = moveTransactions(st.transactions, ids, to);
  return { lineId: to, made: made, taught: taught, moved: moved.length, undo: function(){
    undoChanges(moved);
    st.importRules.length = 0;
    rulesBefore.forEach(function(r){ st.importRules.push(r); });
    if(made){ var at = st.shared.indexOf(made); if(at !== -1) st.shared.splice(at, 1); }
  } };
}
