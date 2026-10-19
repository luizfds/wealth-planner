import { state } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0 } from "../lib/format.js";
import { tripRefilePlan, tripSpend } from "../calc/trips.js";
import { budgetLineItems, budgetLineOptgroupsHtml } from "./expenses.js";

// ---------------- Cash flow → Spending → Trips (v3.78.0) ----------------

// Lines a trip never takes over: housing (every scenario's home block) and a property's costs —
// paid wherever you are, and never what a trip cost.
export function tripProtectedLineIds(){
  var ids = {};
  Object.keys(state.home || {}).forEach(function(k){ (state.home[k] || []).forEach(function(r){ if(r.id) ids[r.id] = true; }); });
  (state.properties || []).forEach(function(p){ (p.expenses || []).forEach(function(e){ if(e.id) ids[e.id] = true; }); });
  return ids;
}
export function tripPlan(trip){ return tripRefilePlan(trip, state.transactions, budgetLineItems(), tripProtectedLineIds()); }

function shortRange(t){
  var f = function(d){ var p = String(d).split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : d; };
  return t.from === t.to ? f(t.from) : f(t.from) + " – " + f(t.to);
}
function defaultTripLine(){
  var lines = budgetLineItems();
  var l = lines.find(function(x){ return /^trips?$|travel|holiday/i.test(x.what || ""); });
  return l ? l.id : "";
}

export function tripsCardHtml(){
  var trips = (state.trips || []).slice().sort(function(a, b){ return a.from < b.from ? 1 : -1; });
  var lineName = {};
  budgetLineItems().forEach(function(l){ lineName[l.id] = l.what; });
  var list = trips.map(function(t){
    var plan = tripPlan(t);
    var spent = tripSpend(t, state.transactions);
    return '<li class="trip-row">' +
      '<div class="trip-main"><b>' + escapeAttr(t.name) + '</b><span>' + escapeAttr(shortRange(t)) + ' · ' + escapeAttr(lineName[t.lineId] || "no line") + '</span></div>' +
      '<div class="trip-side"><b class="trip-spent">' + fmtCurrency0.format(spent) + '</b>' +
        (plan.length ? '<button type="button" class="btn btn-sm" data-trip-move="' + escapeAttr(t.id) + '" title="Spending inside these dates that\'s on another line (bills excepted)">Move ' + plan.length + ' here</button>' : '') +
        '<button type="button" class="icon-btn" data-trip-del="' + escapeAttr(t.id) + '" aria-label="Remove this trip">✕</button></div>' +
    '</li>';
  }).join("");
  return '<p class="ledger-note">Mark the dates you were away. Spending inside them is filed to the trip\'s line when you import a statement, and what\'s already logged can be moved there too. Regular bills that land on those days, rent and property costs stay where they are.</p>' +
    (list ? '<ul class="trip-list">' + list + '</ul>' : '') +
    '<div class="trip-add">' +
      '<label class="fr-field"><span>Trip</span><input type="text" data-trip-name placeholder="Melbourne"></label>' +
      '<label class="fr-field"><span>From</span><input type="date" data-trip-from></label>' +
      '<label class="fr-field"><span>To</span><input type="date" data-trip-to></label>' +
      '<label class="fr-field"><span>Line</span><select data-trip-line><option value="">Pick a line…</option>' + budgetLineOptgroupsHtml(defaultTripLine()) + '</select></label>' +
      '<button type="button" class="btn btn-sm btn-primary" data-trip-add>Add trip</button>' +
    '</div>';
}
