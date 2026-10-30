// ---------------- Saved views of your transactions (v3.168.0, item 198) ----------------
//
// Spending's search and filters were lost the moment you left the page. A filter set — direction,
// account, category, line, person, trip, an amount range, dates and the search text — can now be
// saved under a name and comes back as a chip above the list. Views live in state.txViews, so they
// travel in the backup and sync like everything else. Other pages ("Show me in Spending" on a
// budget line, a report's category, a notice) open Spending with a filter set made here.
//
// Pure: views and filters in, views and filters out. A trip is a date window, read from state.trips
// by whoever calls effectiveFilter.

export var FILTER_FIELDS = ["direction", "account", "category", "line", "person", "trip", "min", "max", "from", "to", "text"];

export function emptyFilter(){ return { direction: "all", account: "", category: "", line: "", person: "", trip: "", min: "", max: "", from: "", to: "", text: "" }; }

// Only what's set — what a view stores and what two filter sets are compared by.
export function filterOf(f){
  var out = {};
  FILTER_FIELDS.forEach(function(k){
    var v = f && f[k];
    if(k === "direction"){ if(v && v !== "all") out[k] = v; return; }
    if(k === "text") v = String(v || "").trim();
    if(v !== "" && v != null) out[k] = String(v);
  });
  return out;
}
export function filterActive(f){ return Object.keys(filterOf(f)).length > 0; }
export function sameFilter(a, b){
  var x = filterOf(a), y = filterOf(b), kx = Object.keys(x), ky = Object.keys(y);
  return kx.length === ky.length && kx.every(function(k){ return x[k] === y[k]; });
}
// Whether the dates come from the filter itself (a view, a trip) rather than the header's period.
export function hasOwnDates(f){ return !!(f && (f.from || f.to || f.trip)); }

// The filter as the list applies it: a trip narrows the dates to its own (and to from/to, if both).
export function effectiveFilter(f, trips){
  var e = Object.assign(emptyFilter(), f || {});
  if(e.trip){
    var t = (trips || []).find(function(x){ return x && x.id === e.trip; });
    if(t && t.from){
      var end = t.to || t.from;
      if(!e.from || t.from > e.from) e.from = t.from;
      if(!e.to || end < e.to) e.to = end;
    } else { e.from = "9999-12-31"; } // a deleted trip matches nothing rather than everything
  }
  return e;
}

// The view a filter set is, if any — so its chip shows as the one you're on.
export function viewMatching(views, f){
  return (views || []).find(function(v){ return sameFilter(v.filter, f); }) || null;
}
// Save the current filters under `name`. A view of the same name is replaced (names are what you
// pick by); an empty name or an empty filter set saves nothing.
export function saveView(views, name, f, idFactory){
  name = String(name || "").trim();
  var filter = filterOf(f);
  if(!name || !Object.keys(filter).length) return null;
  var existing = views.find(function(v){ return v.name.toLowerCase() === name.toLowerCase(); });
  if(existing){ existing.name = name; existing.filter = filter; return existing; }
  var v = { id: idFactory ? idFactory() : "v" + Date.now(), name: name, filter: filter };
  views.push(v);
  return v;
}
export function deleteView(views, id){
  var i = views.findIndex(function(v){ return v.id === id; });
  return i === -1 ? null : views.splice(i, 1)[0];
}
// A view's filters, ready to be the list's: every field present, unset ones blank.
export function applyView(view){ return Object.assign(emptyFilter(), view ? view.filter : {}); }

// What a chip says a filter is: { label, value, text } — "Category" / "Groceries" / "Category: Groceries".
export function describeFilter(key, value, opts){
  opts = opts || {};
  var label, v = value, sep = ": ";
  if(key === "min"){ label = "At least"; v = "$" + value; sep = " "; }
  else if(key === "max"){ label = "At most"; v = "$" + value; sep = " "; }
  else if(key === "from" || key === "to"){ label = key === "from" ? "From" : "To"; v = opts.date ? opts.date(value) : value; sep = " "; }
  else if(key === "trip"){ label = "Trip"; v = opts.tripName ? opts.tripName(value) : value; }
  else if(key === "line"){ label = "Line"; v = opts.lineName ? opts.lineName(value) : value; }
  else label = key.charAt(0).toUpperCase() + key.slice(1);
  return { label: label, value: v, text: label + sep + v, sep: sep };
}
