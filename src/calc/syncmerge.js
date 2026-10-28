// ---------------- Merge, not choose, when two devices both changed (v3.143.0, item 182) ----------------
//
// Sync used to make you keep one copy when this device and another had both changed since they last
// synced. Now it combines them, three ways: `base` is the copy both last agreed on (kept on this
// device by lib/foldersync.js each time it writes or loads the file), `ours` this device's, `theirs`
// the file's. Anything changed on one side only is taken from that side — a row added, removed or
// edited, down to the single field — so two people adding transactions on two phones just get both.
// Only the same thing changed both ways is a conflict, and only those are asked about.
//
// Rows are matched by `id`; rows with none (computed income rows, a row added since the last load) by
// their `date` when every row in the list has a different one (the net worth log), else by content.
// Some differences are never worth asking about: this device's own view settings, the app's
// automatic bookkeeping (price checks, its own net worth points, computed rows — rebuilt after any
// load anyway) and "last done" dates, where the later one wins.
// Pure: mergeStates(base, ours, theirs, choices) → { merged, conflicts, fromTheirs, fromOurs }.
// Call it once to see the conflicts, then again with `choices` ({ [conflict.id]: "ours" | "theirs" })
// to get the answer; a conflict with no choice keeps this device's.

// Kept as this device has them: how it shows things, not what's in them.
var DEVICE_KEYS = { activeScenario: 1, showAllPeriods: 1, uiMode: 1, budgetGroupsCollapsed: 1, budgetGroupBy: 1, incomeCols: 1, expenseCols: 1,
  homeCols: 1, assetCols: 1, setupDismissed: 1, checksDismissed: 1, savedAt: 1, savedBy: 1 };
// The app's own bookkeeping: rebuilt or refreshed by itself, so either side will do.
var AUTO_KEYS = { priceSheet: 1, fx: 1, benchmark: 1, projectionReference: 1 };
function isLastDone(field){ return /^last[A-Z]|(At|Date|Updated)$/.test(String(field || "")); }
function isAutoRow(r){ return !!(r && typeof r === "object" && (r.auto || r.derived || r.computed || r.syntheticNetFor || r.syntheticRentForProperty || r.syntheticOneOffFor || r.syntheticRefundFor)); }

function isObj(v){ return v != null && typeof v === "object" && !Array.isArray(v); }
// Key order doesn't make two rows different.
function canon(v){
  if(Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if(isObj(v)) return "{" + Object.keys(v).filter(function(k){ return v[k] !== undefined; }).sort().map(function(k){ return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
  return v === undefined ? "~" : JSON.stringify(v);
}
function same(a, b){ return a === b || canon(a) === canon(b); }

// The key each row of a list goes by, and how the list is matched.
function keyer(lists){
  var rows = [];
  lists.forEach(function(l){ (l || []).forEach(function(r){ rows.push(r); }); });
  var noId = rows.filter(function(r){ return r == null || r.id == null; });
  var byDate = noId.length && noId.every(function(r){ return r && typeof r.date === "string"; }) &&
    lists.every(function(l){ var seen = {}; return (l || []).every(function(r){ if(r.id != null) return true; if(seen[r.date]) return false; seen[r.date] = 1; return true; }); });
  return function(list){
    var counts = {}, out = [];
    (list || []).forEach(function(r){
      var k = r != null && r.id != null ? "id:" + r.id : byDate ? "date:" + r.date : "row:" + canon(r);
      if(counts[k]){ counts[k]++; k += "#" + counts[k]; } else counts[k] = 1;
      out.push({ key: k, row: r });
    });
    return out;
  };
}
function rowsAreObjects(l){ return Array.isArray(l) && l.every(function(r){ return isObj(r); }); }

export function mergeStates(base, ours, theirs, choices){
  choices = choices || {};
  var conflicts = [], stats = { fromTheirs: 0, fromOurs: 0 };

  function leaf(b, o, t, ctx){
    var id = ctx.path.join("/");
    var top = ctx.path[0], field = ctx.field;
    if(DEVICE_KEYS[top]) return o;
    if(AUTO_KEYS[top] || isAutoRow(ctx.row) || isAutoRow(o) || isAutoRow(t)) return o !== undefined ? o : t;
    if(field && isLastDone(field) && typeof o === "string" && typeof t === "string") return o > t ? o : t;
    conflicts.push({ id: id, top: top, row: ctx.row || null, field: field || null, base: b, ours: o, theirs: t });
    if(choices[id] === "theirs"){ stats.fromTheirs++; return t; }
    return o;
  }

  function merge(b, o, t, ctx){
    if(same(o, t)) return o;
    if(same(b, o)){ stats.fromTheirs++; return t; }
    if(same(b, t)){ stats.fromOurs++; return o; }
    if(isObj(o) && isObj(t) && (b === undefined || isObj(b))){
      var out = {}, bb = b || {};
      var keys = Object.keys(o).concat(Object.keys(t).filter(function(k){ return !(k in o); }));
      keys.forEach(function(k){
        var v = merge(bb[k], o[k], t[k], { path: ctx.path.concat(k), row: ctx.row, field: k });
        if(v !== undefined) out[k] = v;
      });
      return out;
    }
    if(rowsAreObjects(o) && rowsAreObjects(t) && (b === undefined || rowsAreObjects(b))) return mergeRows(b || [], o, t, ctx);
    return leaf(b, o, t, ctx);
  }

  function mergeRows(b, o, t, ctx){
    var key = keyer([b, o, t]);
    var kb = key(b), ko = key(o), kt = key(t);
    var mb = {}, mt = {};
    kb.forEach(function(e){ mb[e.key] = e.row; });
    kt.forEach(function(e){ mt[e.key] = e.row; });
    var out = [], placed = {};
    var one = function(k, ro){
      var rt = mt[k], rb = mb[k];
      var label = ro || rt || rb;
      var v = merge(rb, ro, rt, { path: ctx.path.concat(k), row: label, field: null });
      placed[k] = true;
      if(v !== undefined) out.push({ key: k, row: v });
    };
    ko.forEach(function(e){ one(e.key, e.row); });
    // Theirs-only rows go after the row they followed there, so a list keeps its order.
    kt.forEach(function(e, i){
      if(placed[e.key]) return;
      var len = out.length;
      one(e.key, undefined);
      if(out.length === len) return;
      var added = out.pop(), at = 0;
      for(var j = i - 1; j >= 0; j--){
        var p = out.findIndex(function(x){ return x.key === kt[j].key; });
        if(p !== -1){ at = p + 1; break; }
      }
      out.splice(at, 0, added);
    });
    // Rows merged in from base alone (deleted both ways) never come back: merge() returned undefined.
    var rows = out.map(function(x){ return x.row; });
    if(rows.length && rows.every(function(r){ return r && r.id == null && typeof r.date === "string"; }))
      rows.sort(function(a, c){ return a.date < c.date ? -1 : a.date > c.date ? 1 : 0; });
    return rows;
  }

  var merged = merge(base || {}, ours || {}, theirs || {}, { path: [], row: null, field: null });
  return { merged: merged, conflicts: conflicts, fromTheirs: stats.fromTheirs, fromOurs: stats.fromOurs };
}

// What a row is called, for the question.
export function rowLabel(r){
  if(!r || typeof r !== "object") return "";
  return String(r.what || r.name || r.description || r.merchant || r.label || r.symbol || r.title || r.date || "a row");
}
var SECTION_LABELS = { transactions: "Spending", transfers: "Transfers", incomeLog: "Income received", shared: "Budget", income: "Income",
  assets: "Investments", properties: "Property", accounts: "Accounts", debts: "Debts", importRules: "Import rules", categories: "Categories",
  savingsGoals: "Savings goals", goals: "Goals", trips: "Trips", taxYears: "Tax years", home: "Home costs", monthReviews: "Month reviews",
  netWorthLog: "Net worth history", tax: "Tax settings", projection: "Projections", fire: "Retirement", purchase: "Purchase", invest: "Investing plan" };
export function fieldLabel(f){ return String(f || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); }
export function sectionLabel(top){ return SECTION_LABELS[top] || String(top || ""); }
// A value, short: a deleted row says so; a row its name; a field its value.
export function valueText(v, isRow){
  if(v === undefined) return isRow ? "Deleted" : "Not set";
  if(v === null || v === "") return "Blank";
  if(isRow && isObj(v)) return rowLabel(v) + (v.amount != null ? " · " + v.amount : "");
  if(typeof v === "object") { var s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + "…" : s; }
  return String(v);
}
