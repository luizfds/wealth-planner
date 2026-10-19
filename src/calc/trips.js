// ---------------- Trips as date ranges (v3.78.0) ----------------
//
// Away for four days, spending lands under eleven budget lines — cafés, petrol, Ubers, groceries —
// and the trip's real cost is nowhere. A trip is a name, two dates and the line its spending
// belongs to (Trips, or House Hunting for an inspection weekend). Spending inside the dates files
// to that line: on import, before the merchant rules get a say, and for what's already logged, as
// a reviewed "move these" rather than silently.
//
// Not everything in the window is the trip. A monthly bill that happens to fall on day two
// (Spotify, insurance, the rent) stays where it is: a regular, non-irregular line paid monthly or
// less often is a bill, not trip spending. Weekly lines (groceries, fuel, transport) and anything
// irregular move. Pure: no state, no DOM.

var BILL_FREQS = ["Monthly", "Quarterly", "Half-yearly", "Yearly"];

export function tripOn(date, trips){
  var hits = (trips || []).filter(function(t){ return t && t.from && date >= t.from && date <= (t.to || t.from); });
  if(!hits.length) return null;
  // Overlapping trips: the shorter one is the more specific claim.
  hits.sort(function(a, b){ return spanDays(a) - spanDays(b); });
  return hits[0];
}
function spanDays(t){ return Math.round((Date.parse(t.to || t.from) - Date.parse(t.from)) / 86400000); }

// Whether a transaction on `line` (or on no line) belongs to a trip that covers its date.
export function tripTakes(line, protectedIds){
  if(!line) return true;
  if(protectedIds && protectedIds[line.id]) return false;
  if(line.irregular) return true;
  return BILL_FREQS.indexOf(line.freq) === -1;
}

// What moving a trip's spending to its line would change: the transactions in its window that
// aren't on its line yet and that it takes. `lines` is every budget line (id → line); refunds move
// with their purchases.
export function tripRefilePlan(trip, transactions, lines, protectedIds){
  var byId = {};
  (lines || []).forEach(function(l){ if(l && l.id) byId[l.id] = l; });
  return (transactions || []).filter(function(t){
    if(!t.date || t.date < trip.from || t.date > (trip.to || trip.from)) return false;
    if(t.linkedExpenseId === trip.lineId) return false;
    return tripTakes(t.linkedExpenseId ? byId[t.linkedExpenseId] : null, protectedIds);
  });
}
export function applyTripRefile(trip, transactions, lines, protectedIds){
  var moving = tripRefilePlan(trip, transactions, lines, protectedIds);
  moving.forEach(function(t){
    t.linkedExpenseId = trip.lineId;
    t.category = "";
    t.trip = trip.id;
  });
  return moving.length;
}
// What a trip has cost: everything on its line inside its dates.
export function tripSpend(trip, transactions){
  return Math.round((transactions || []).reduce(function(s, t){
    return t.date >= trip.from && t.date <= (trip.to || trip.from) && t.linkedExpenseId === trip.lineId ? s + (Number(t.amount) || 0) : s;
  }, 0) * 100) / 100;
}

// A tidy record: dates in order, a name, a line.
export function normaliseTrip(t, idFactory){
  var from = String(t.from || ""), to = String(t.to || t.from || "");
  if(to < from){ var x = from; from = to; to = x; }
  return { id: t.id || (idFactory ? idFactory() : "trip" + Date.now().toString(36)), name: String(t.name || "Trip").trim() || "Trip", from: from, to: to, lineId: t.lineId || "" };
}
