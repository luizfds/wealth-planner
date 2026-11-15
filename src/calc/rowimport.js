// ---------------- Spreadsheet row imports: apply, duplicates and a guarded Undo (#265) ----------------
//
// Budget, Income and Assets each import rows from their own CSV template (parse*ImportCsv in expenses.js,
// income.js and assets.js — unchanged). This is what happens after the review: which rows look like ones
// the household already has, putting the chosen rows where they belong, and taking exactly those rows
// back out again.
//
// Undo used to put each list back to its old length. That removed whatever was last in the list, which
// was the import only if nothing had changed since: a row added after it went instead, a row deleted
// before it left one imported row behind, and rows sent to an investment property (and the categories
// the file brought) were never removed at all. A record here holds the rows themselves, so Undo finds
// them wherever they are now, and refuses when one was edited or deleted since, or the household itself
// was replaced (a restore, a reset, another tab's save adopted).
//
// Everything takes the household as `st` rather than reading `state`, so it is the same code whichever
// household it is given, and tests run it on a plain object.
import { genId } from "../state.js";
import { link } from "./accountlinks.js";
import { appendHistorySnapshot } from "./ledger.js";

function norm(s){ return String(s == null ? "" : s).trim().toLowerCase(); }
function num(n){ var v = Number(n); return isFinite(v) ? String(Math.round(v * 100) / 100) : ""; }

// Where an expense row goes, as a key: the home's costs, a property's costs (by id), or the shared budget.
function expenseDestination(item){ return item.source === "Housing" ? "housing" : item.propertyId ? "property:" + item.propertyId : "shared"; }

// What makes two rows "the same row" for each kind — the fields a person would recognise it by. Anything
// else (an account, a category, a sacrifice setting) can differ and it is still the row they already have.
export function rowImportKey(kind, item){
  if(kind === "expenses") return [expenseDestination(item), norm(item.what), num(item.amount), norm(item.freq)].join("|");
  if(kind === "income") return [norm(item.what), norm(item.person), norm(item.incomeType), num(item.amount), norm(item.freq)].join("|");
  if(item.category === "Shares") return ["Shares", norm(item.what), norm(item.symbol), num(item.quantity)].join("|");
  if(item.category === "Vehicle") return ["Vehicle", norm(item.what), num(item.purchasePrice), String(item.purchaseDate || "")].join("|");
  return [item.category, norm(item.what), num(item.amount)].join("|");
}

// The household's own rows of a kind, each in the shape rowImportKey reads.
function existingRows(kind, st){
  if(kind === "income") return (st.income || []).filter(function(r){ return r && !r.computed; });
  if(kind === "assets") return st.assets || [];
  var rows = [];
  (st.shared || []).forEach(function(r){ if(r) rows.push(Object.assign({}, r, { source: r.homeCost ? "Housing" : "Shared", propertyId: null })); });
  (st.properties || []).forEach(function(p){
    if(p && p.kind === "IP") (p.expenses || []).forEach(function(r){ if(r) rows.push(Object.assign({}, r, { source: p.what, propertyId: p.id })); });
  });
  return rows;
}

// Marks each parsed row `duplicate: "existing"` (the household has it) or `"file"` (an earlier row in the
// same file is the same), or null. Returns how many are marked. Nothing is changed in the household.
export function markRowImportDuplicates(kind, items, st){
  var have = {};
  existingRows(kind, st).forEach(function(r){ have[rowImportKey(kind, r)] = true; });
  var seen = {}, n = 0;
  items.forEach(function(item){
    var key = rowImportKey(kind, item);
    item.duplicate = have[key] ? "existing" : seen[key] ? "file" : null;
    if(item.duplicate) n++;
    seen[key] = true;
  });
  return n;
}

// The expense rows whose property is no longer one of the household's investment properties — deleted, or
// changed into a home, since the review was drawn. They are never sent anywhere else in its place.
export function rowImportLostDestinations(kind, items, st){
  if(kind !== "expenses") return [];
  return items.filter(function(item){
    if(!item.propertyId) return false;
    return !(st.properties || []).some(function(p){ return p && p.id === item.propertyId && p.kind === "IP"; });
  });
}

// The top-level keys an import of this kind writes, for commit().
export function rowImportTouched(kind){
  if(kind === "expenses") return ["shared", "properties", "categories"];
  return [kind];
}

// Puts the rows into the household: the same shapes "+ Add" makes, with each account linked by id (0006) —
// a name that matches no account stays as the name, as typing it would. Returns the record Undo needs.
export function applyRowImport(kind, items, st, today){
  var created = [], categories = [];
  function add(list, row){ list.push(row); created.push({ list: list, row: row }); }
  items.forEach(function(item){
    if(kind === "expenses"){
      var row = { what: item.what, classification: item.classification, category: item.category || "", account: "", amount: item.amount, freq: item.freq };
      link(row, "account", item.account || "", st);
      var target = item.propertyId && (st.properties || []).find(function(p){ return p.id === item.propertyId && p.kind === "IP"; });
      if(item.source === "Housing"){
        // Today's housing is an ordinary budget line, marked as the home (v3.172.0, item 207).
        row.id = genId("exp"); row.irregular = false; row.dueMonth = null; row.homeCost = true;
        row.category = row.category || "Housing";
        add(st.shared, row);
      } else if(target){
        row.id = genId("exp"); row.irregular = false; row.dueMonth = null;
        add(target.expenses, row);
      } else if(!item.propertyId){
        add(st.shared, row);
      }
      // A file's category the manager doesn't know yet is registered, so no row names a missing one.
      var cat = (item.category || "").trim();
      if(cat && st.categories.indexOf(cat) === -1 && categories.indexOf(cat) === -1){ st.categories.push(cat); categories.push(cat); }
    } else if(kind === "income"){
      var inc = {
        what: item.what, person: item.person, classification: "", account: "",
        incomeType: item.incomeType, amount: item.amount, freq: item.freq,
        superMode: item.superMode, sacrificeMode: item.sacrificeMode, sacrificeValue: item.sacrificeValue
      };
      link(inc, "account", item.account || "", st);
      add(st.income, inc);
    } else if(item.category === "Shares"){
      // A real price is stamped as read today with a first history point, as a pasted price is, so the
      // holding doesn't arrive "never updated".
      var holding = {
        what: item.what, category: "Shares", symbol: item.symbol, market: item.market,
        quantity: item.quantity, avgCost: item.avgCost, price: item.price,
        priceUpdated: item.price > 0 ? today : "", person: item.person, amount: item.amount, history: []
      };
      if(item.price > 0){
        var entryDate = appendHistorySnapshot(holding.history, holding.amount, today);
        var entry = holding.history.find(function(h){ return h.date === entryDate; });
        if(entry) entry.price = item.price;
      }
      add(st.assets, holding);
    } else if(item.category === "Vehicle"){
      add(st.assets, { what: item.what, category: "Vehicle", purchasePrice: item.purchasePrice, purchaseDate: item.purchaseDate, depreciationRate: item.depreciationRate, amount: item.amount, person: item.person });
    } else {
      add(st.assets, { what: item.what, category: item.category, amount: item.amount, person: item.person });
    }
  });
  return { kind: kind, household: st, created: created, categories: categories, snaps: null };
}

// What the app itself keeps changing on a row (a vehicle's written-down value, the day's share price) is
// left out of the comparison, so only a person's edit makes Undo refuse.
var SELF_UPDATED = { amount: 1, price: 1, priceUpdated: 1, history: 1, monthly: 1, annual: 1 };
function rowSnapshot(kind, row){
  var out = {};
  Object.keys(row).sort().forEach(function(k){ if(!(kind === "assets" && SELF_UPDATED[k]) && !(kind !== "assets" && (k === "monthly" || k === "annual"))) out[k] = row[k]; });
  return JSON.stringify(out);
}
// Taken once the import is saved and drawn, so what drawing it adds counts as the imported row.
export function snapshotRowImport(record){
  record.snaps = record.created.map(function(c){ return rowSnapshot(record.kind, c.row); });
}

// Whether Undo can take the rows out: { ok } or { ok: false, reason, changed } — the household replaced,
// or rows deleted or edited since (how many).
export function checkRowImportUndo(record, st){
  if(!record || record.household !== st) return { ok: false, reason: "replaced", changed: 0 };
  var changed = 0;
  record.created.forEach(function(c, i){
    if(c.list.indexOf(c.row) === -1 || (record.snaps && rowSnapshot(record.kind, c.row) !== record.snaps[i])) changed++;
  });
  return changed ? { ok: false, reason: "changed", changed: changed } : { ok: true };
}

function categoryInUse(st, name){
  var arrays = [st.shared || [], st.transactions || []];
  Object.keys(st.home || {}).forEach(function(k){ if(Array.isArray(st.home[k])) arrays.push(st.home[k]); });
  (st.properties || []).forEach(function(p){ if(p && Array.isArray(p.expenses)) arrays.push(p.expenses); });
  return arrays.some(function(rows){ return rows.some(function(r){ return r && (r.category || "") === name; }); });
}

// Takes exactly the imported rows back out, and the categories the file added that nothing uses now.
// Does nothing unless checkRowImportUndo says it can.
export function undoRowImport(record, st){
  var check = checkRowImportUndo(record, st);
  if(!check.ok) return check;
  record.created.forEach(function(c){ var i = c.list.indexOf(c.row); if(i !== -1) c.list.splice(i, 1); });
  record.categories.forEach(function(name){
    var i = st.categories.indexOf(name);
    if(i !== -1 && !categoryInUse(st, name)) st.categories.splice(i, 1);
  });
  return { ok: true };
}
