import { state, genId } from "../state.js";
import { incomeTargets } from "./received.js";

// ---------------- One list of money in, out and between accounts (v3.59.0) ----------------
//
// Spending lives in state.transactions, money received in state.incomeLog (kept apart on purpose —
// see calc/received.js), and transfers between the household's own accounts in state.transfers
// (v3.59.0, kept apart for the same reason: moving $500 from everyday to savings isn't spending,
// and every spending total in the app sums state.transactions). This joins the three for display
// and filtering only — nothing here changes what any total counts.
//
// An entry: { kind: "out" | "in" | "transfer", key, date, amount (always positive), label, account,
// toAccount (transfers), category, lineId, person, splitGroup, ref } — `ref` is the index into
// state.transactions for "out", the incomeLog / transfer id otherwise.
export function cashflowEntries(opts){
  opts = opts || {};
  var lines = opts.lines || [];
  var lineById = {};
  lines.forEach(function(l){ if(l.id) lineById[l.id] = l; });
  var accountOf = opts.accountOf || function(t){ return t.account || ""; };
  var categoryOf = opts.categoryOf || function(t){ return t.category || ""; };
  var nameOf = opts.nameOf || function(t){ return t.what || "Transaction"; };
  var out = [];
  (state.transactions || []).forEach(function(t, i){
    if(!t || !t.date) return;
    var line = t.linkedExpenseId ? lineById[t.linkedExpenseId] : null;
    var amt = Number(t.amount) || 0;
    out.push({ kind: "out", key: "t:" + (t.id || i), date: t.date, amount: amt, label: nameOf(t), account: accountOf(t),
      category: categoryOf(t), lineId: t.linkedExpenseId || "", person: line ? (line.person || line.deductiblePerson || "") : "",
      splitGroup: t.splitGroup || "", ref: i, refund: amt < 0 });
  });
  var targets = {};
  incomeTargets().forEach(function(t){ targets[t.key] = t; });
  (state.incomeLog || []).forEach(function(r){
    if(!r || !r.date) return;
    var tg = targets[r.target];
    var person = "";
    if(/^net:/.test(r.target || "")) person = r.target.slice(4);
    else if(/^income:/.test(r.target || "")){
      var row = (state.income || []).find(function(x){ return "income:" + x.id === r.target; });
      person = row ? row.person || "" : "";
    }
    out.push({ kind: "in", key: "i:" + r.id, date: r.date, amount: Number(r.amount) || 0, label: r.what || (tg ? tg.label : "Money in"),
      account: r.account || (tg && tg.account) || "", category: "Income", lineId: r.target || "", person: person, splitGroup: "", ref: r.id });
  });
  (state.transfers || []).forEach(function(x){
    if(!x || !x.date) return;
    out.push({ kind: "transfer", key: "x:" + x.id, date: x.date, amount: Number(x.amount) || 0, label: x.what || "Transfer",
      account: x.from || "", toAccount: x.to || "", category: "", lineId: "", person: "", splitGroup: "", ref: x.id });
  });
  return out.sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
}

// f: { direction: "all" | "out" | "in" | "transfer", account, category, line, person, text }.
// An account filter matches a transfer on either side — it moved money in or out of that account.
export function filterEntries(entries, f){
  f = f || {};
  var text = String(f.text || "").trim().toLowerCase();
  return entries.filter(function(e){
    if(f.direction && f.direction !== "all" && e.kind !== f.direction) return false;
    if(f.account && e.account !== f.account && e.toAccount !== f.account) return false;
    if(f.category && e.category !== f.category) return false;
    if(f.line && e.lineId !== f.line) return false;
    if(f.person && e.person !== f.person) return false;
    if(text && String(e.label).toLowerCase().indexOf(text) === -1 && String(e.account).toLowerCase().indexOf(text) === -1) return false;
    return true;
  });
}

// What each filter can be set to, from the entries themselves — nothing offered that matches nothing.
export function filterChoices(entries){
  var pick = function(fn){
    var seen = {};
    entries.forEach(function(e){ var v = fn(e); if(v) seen[v] = true; });
    return Object.keys(seen).sort(function(a, b){ return a.localeCompare(b); });
  };
  return {
    accounts: pick(function(e){ return e.account; }).concat(pick(function(e){ return e.toAccount; })).filter(function(v, i, a){ return a.indexOf(v) === i; }).sort(),
    categories: pick(function(e){ return e.category; }),
    lines: pick(function(e){ return e.lineId; }),
    people: pick(function(e){ return e.person; })
  };
}

// In, out and net over a set of entries. Transfers are neither — they're shown, never totalled.
export function entryTotals(entries){
  var inn = 0, outt = 0;
  entries.forEach(function(e){ if(e.kind === "in") inn += e.amount; else if(e.kind === "out") outt += e.amount; });
  return { in: Math.round(inn * 100) / 100, out: Math.round(outt * 100) / 100, net: Math.round((inn - outt) * 100) / 100 };
}

// ---------------- Transfers ----------------
export function addTransfer(t){
  if(!Array.isArray(state.transfers)) state.transfers = [];
  var rec = { id: genId("x"), date: t.date, amount: Math.round((Number(t.amount) || 0) * 100) / 100, from: t.from || "", to: t.to || "", what: t.what || "" };
  state.transfers.push(rec);
  return rec;
}
export function deleteTransfer(id){
  var i = (state.transfers || []).findIndex(function(x){ return x.id === id; });
  if(i === -1) return null;
  return { record: state.transfers.splice(i, 1)[0], index: i };
}

// ---------------- Splits ----------------
// One bank line that paid for several things (a supermarket shop that was half groceries, half a
// gift) becomes that many transactions sharing a splitGroup — each a normal transaction on its own
// budget line, so every total, chart and comparison already counts it correctly. parts:
// [{ linkedExpenseId, amount, what? }]. Returns the new transactions, or null if the parts are empty.
export function splitTransaction(idx, parts){
  var t = state.transactions[idx];
  if(!t) return null;
  var clean = (parts || []).filter(function(p){ return Number(p.amount); });
  if(clean.length < 2) return null;
  var group = t.splitGroup || t.id || genId("sg");
  var made = clean.map(function(p){
    return Object.assign({}, t, { id: genId("t"), amount: Math.round(Number(p.amount) * 100) / 100, linkedExpenseId: p.linkedExpenseId || null,
      what: p.what != null ? p.what : t.what, splitGroup: group, category: p.linkedExpenseId ? "" : (t.category || "") });
  });
  state.transactions.splice.apply(state.transactions, [idx, 1].concat(made));
  return made;
}
// Merges a split back into one transaction (the first part's date, account and description).
export function unsplit(group){
  var idxs = [];
  (state.transactions || []).forEach(function(t, i){ if(t.splitGroup === group) idxs.push(i); });
  if(idxs.length < 2) return null;
  var parts = idxs.map(function(i){ return state.transactions[i]; });
  var total = parts.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
  var merged = Object.assign({}, parts[0], { amount: Math.round(total * 100) / 100, linkedExpenseId: null });
  delete merged.splitGroup;
  for(var k = idxs.length - 1; k >= 0; k--) state.transactions.splice(idxs[k], 1);
  state.transactions.splice(idxs[0], 0, merged);
  return merged;
}

// ---------------- Bulk edit ----------------
// changes: { linkedExpenseId?, account?, category? } — a key present (even "") is applied.
export function bulkEditTransactions(indices, changes){
  var n = 0;
  indices.forEach(function(i){
    var t = state.transactions[i];
    if(!t) return;
    if("linkedExpenseId" in changes) t.linkedExpenseId = changes.linkedExpenseId || null;
    if("account" in changes) t.account = changes.account || "";
    if("category" in changes) t.category = changes.category || "";
    n++;
  });
  return n;
}
export function bulkDeleteTransactions(indices){
  var removed = indices.slice().sort(function(a, b){ return b - a; }).map(function(i){ return { index: i, t: state.transactions.splice(i, 1)[0] }; }).filter(function(x){ return x.t; });
  return removed.reverse();
}
