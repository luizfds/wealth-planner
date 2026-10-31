// ---------------- Who changed what (v3.171.0, item 202) ----------------
//
// Two people syncing could see that the numbers moved but not who moved them. Each device now says
// whose it is (Settings → Preferences, kept on the device), and each change is written to a short
// activity log in state.activity — so it syncs, and arrives on the other device with the name of the
// person who made it. Entries: { id, at (ISO), by (name or ""), device, section, what, detail, undo? }.
// Kept 90 days, and under a size cap.
//
// The log isn't written by each edit handler (there are hundreds); it's read off the data: a short
// while after the last save, what changed since the last look is diffed and summarised (diffForLog →
// entriesFor). A copy loaded from sync, a backup or the sample data resets the look instead of being
// logged as this device's edit. Pure: before/after in, entries out.

import { isDraftKey } from "./scenariodraft.js";
import { rowLabel, fieldLabel, sectionLabel } from "./syncmerge.js";

export var KEEP_DAYS = 90;
export var MAX_ENTRIES = 400;
export var MAX_CHARS = 120000;      // the log's size in the saved data, at most
var MAX_UNDO_ROW = 4000;            // a removed row bigger than this is logged without an undo

// Not the household's data: how this device shows it, the app's own bookkeeping, computed rows, and
// the log itself.
var SKIP = { activity: 1, savedAt: 1, savedBy: 1, savedByName: 1, activeScenario: 1, showAllPeriods: 1, uiMode: 1,
  budgetGroupsCollapsed: 1, budgetGroupBy: 1, incomeCols: 1, expenseCols: 1, homeCols: 1, assetCols: 1, setupDismissed: 1,
  checksDismissed: 1, priceSheet: 1, fx: 1, benchmark: 1, projectionReference: 1, autoPrices: 1, lastBackupDate: 1,
  lastFolderBackup: 1, netWorthLog: 1, weekRecaps: 1, firstRunDone: 1, firstRunSkipped: 1, rollover: 1 };
function isAutoRow(r){ return !!(r && typeof r === "object" && (r.auto || r.derived || r.computed || r.syntheticNetFor || r.syntheticRentForProperty || r.syntheticOneOffFor || r.syntheticRefundFor || r.syntheticEndingFor)); }
function isObj(v){ return v != null && typeof v === "object" && !Array.isArray(v); }
function same(a, b){ return a === b || JSON.stringify(a) === JSON.stringify(b); }
function short(v){
  if(v === undefined || v === null || v === "") return "blank";
  if(typeof v === "object") return Array.isArray(v) ? v.length + " item" + (v.length === 1 ? "" : "s") : "set";
  var s = String(v);
  return s.length > 40 ? s.slice(0, 39) + "…" : s;
}
function rowsWithIds(a){ return Array.isArray(a) && a.length > 0 && a.every(function(r){ return isObj(r) && r.id != null; }); }

// The changes between two copies, as { path: [top, sub?], section, kind: "added"|"removed"|"changed"|"edited",
// id, label, fields: [{ field, from, to }], row (removed rows, for undo) }.
export function diffForLog(before, after){
  before = before || {}; after = after || {};
  var out = [];
  function walk(path, b, a, depth){
    var section = sectionLabel(path[0]) + (path.length > 1 ? " · " + path.slice(1).join(" · ") : "");
    if(same(b, a)) return;
    // v3.181.0: a scenario being edited (calc/scenariodraft.js) — its Save is the change, not each edit.
    if(path.length === 2 && isDraftKey(path[1])) return;
    if(rowsWithIds(b) || rowsWithIds(a)){
      var bi = {}, ai = {};
      (b || []).forEach(function(r){ bi[r.id] = r; });
      (a || []).forEach(function(r){ ai[r.id] = r; });
      Object.keys(ai).forEach(function(id){
        var r = ai[id], o = bi[id];
        if(isAutoRow(r)) return;
        if(!o){ out.push({ path: path, section: section, kind: "added", id: r.id, label: rowLabel(r) }); return; }
        if(same(o, r)) return;
        var fields = [];
        Object.keys(Object.assign({}, o, r)).forEach(function(f){ if(!same(o[f], r[f])) fields.push({ field: f, from: o[f], to: r[f] }); });
        out.push({ path: path, section: section, kind: "changed", id: r.id, label: rowLabel(r), fields: fields });
      });
      Object.keys(bi).forEach(function(id){
        if(ai[id] || isAutoRow(bi[id])) return;
        out.push({ path: path, section: section, kind: "removed", id: bi[id].id, label: rowLabel(bi[id]), row: bi[id] });
      });
      return;
    }
    if(isObj(b) && isObj(a) && depth < 2){
      Object.keys(Object.assign({}, b, a)).forEach(function(k){ walk(path.concat(k), b[k], a[k], depth + 1); });
      return;
    }
    out.push({ path: path, section: sectionLabel(path[0]), kind: "edited", label: path.length > 1 ? path.slice(1).map(fieldLabel).join(" › ") : sectionLabel(path[0]), fields: [{ field: path[path.length - 1], from: b, to: a }] });
  }
  Object.keys(Object.assign({}, before, after)).forEach(function(k){
    if(SKIP[k]) return;
    walk([k], before[k], after[k], 0);
  });
  return out;
}

// Changes → log entries. A change to one row is one entry naming its fields; a burst (an import of 80
// transactions) is one entry per section and kind, not 80. opts: { by, device, at, idFactory }.
export function entriesFor(changes, opts){
  opts = opts || {};
  var at = opts.at || new Date().toISOString();
  var mk = function(e){ return Object.assign({ id: opts.idFactory ? opts.idFactory() : "a" + Math.random().toString(36).slice(2, 10), at: at, by: opts.by || "", device: opts.device || "" }, e); };
  var groups = {};
  changes.forEach(function(c){ var k = c.section + "|" + c.kind; (groups[k] = groups[k] || []).push(c); });
  var out = [];
  Object.keys(groups).forEach(function(k){
    var g = groups[k];
    if(g.length > 3 && g[0].kind !== "edited"){
      var verb = g[0].kind === "added" ? "Added" : g[0].kind === "removed" ? "Removed" : "Changed";
      out.push(mk({ section: g[0].section, what: verb + " " + g.length + " rows", detail: g.slice(0, 3).map(function(c){ return c.label; }).join(", ") + "…" }));
      return;
    }
    g.forEach(function(c){
      var e = { section: c.section };
      if(c.kind === "added"){ e.what = "Added " + c.label; e.undo = { op: "remove", path: c.path, id: c.id }; }
      else if(c.kind === "removed"){
        e.what = "Removed " + c.label;
        var json = JSON.stringify(c.row);
        if(json.length <= MAX_UNDO_ROW) e.undo = { op: "restore", path: c.path, row: c.row };
      } else if(c.kind === "changed"){
        e.what = c.label + ": " + c.fields.slice(0, 3).map(function(f){ return fieldLabel(f.field) + " " + short(f.from) + " → " + short(f.to); }).join(", ") + (c.fields.length > 3 ? " and " + (c.fields.length - 3) + " more" : "");
        var vals = {};
        c.fields.forEach(function(f){ if(typeof f.from !== "object" || f.from === null) vals[f.field] = f.from === undefined ? null : f.from; });
        if(Object.keys(vals).length === c.fields.length) e.undo = { op: "fields", path: c.path, id: c.id, values: vals };
      } else {
        var f = c.fields[0];
        var deep = (f.from && typeof f.from === "object") || (f.to && typeof f.to === "object");
        e.what = deep ? c.label + " updated" : c.label + ": " + short(f.from) + " → " + short(f.to);
        if(typeof f.from !== "object" || f.from === null) e.undo = { op: "set", path: c.path, value: f.from === undefined ? null : f.from };
      }
      out.push(mk(e));
    });
  });
  return out;
}

// Newest first, 90 days, under the caps.
export function pruneActivity(list, today){
  var cutoff = new Date(Date.parse((today || new Date().toISOString().slice(0, 10)) + "T00:00:00Z") - KEEP_DAYS * 86400000).toISOString();
  var seen = {};
  var out = (list || []).filter(function(e){ if(!e || !e.id || seen[e.id] || !(e.at >= cutoff)) return false; seen[e.id] = true; return true; })
    .sort(function(a, b){ return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; })
    .slice(0, MAX_ENTRIES);
  while(out.length && JSON.stringify(out).length > MAX_CHARS) out.pop();
  return out;
}

function holderAt(st, path){
  var v = st;
  for(var i = 0; i < path.length - 1; i++){ if(v == null) return null; v = v[path[i]]; }
  return v;
}
// Undo one entry against the live data: true when it could be applied (the row still exists, etc.).
export function undoEntry(st, entry){
  var u = entry && entry.undo;
  if(!u) return false;
  var parent = holderAt(st, u.path), key = u.path[u.path.length - 1];
  if(!parent) return false;
  if(u.op === "set"){ if(u.value === null) delete parent[key]; else parent[key] = u.value; return true; }
  var arr = parent[key];
  if(u.op === "restore"){
    if(!Array.isArray(arr)) parent[key] = arr = [];
    if(arr.some(function(r){ return r && r.id === u.row.id; })) return false;
    arr.push(JSON.parse(JSON.stringify(u.row)));
    return true;
  }
  if(!Array.isArray(arr)) return false;
  var i = arr.findIndex(function(r){ return r && r.id === u.id; });
  if(i === -1) return false;
  if(u.op === "remove"){ arr.splice(i, 1); return true; }
  if(u.op === "fields"){
    Object.keys(u.values).forEach(function(f){ if(u.values[f] === null) delete arr[i][f]; else arr[i][f] = u.values[f]; });
    return true;
  }
  return false;
}

// Who, in words: the name, else whether it was this device.
export function whoText(entry, thisDevice){
  if(entry.by) return entry.by;
  return entry.device && entry.device === thisDevice ? "This device" : "Another device";
}
