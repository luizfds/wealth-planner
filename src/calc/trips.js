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
// What a trip has cost: every purchase answered as the trip's (t.trip), and — for one logged before trips were asked
// about (November 2026) — anything on its line inside its dates that isn't another trip's or said not to be this one.
export function tripSpend(trip, transactions){
  return Math.round((transactions || []).reduce(function(s, t){
    if(!t) return s;
    if(t.trip === trip.id) return s + (Number(t.amount) || 0);
    var legacy = !t.project && !t.trip && t.tripNo !== trip.id && trip.from && t.date >= trip.from && t.date <= (trip.to || trip.from) && t.linkedExpenseId === trip.lineId;
    return legacy ? s + (Number(t.amount) || 0) : s;
  }, 0) * 100) / 100;
}

// A tidy record: dates in order (or none yet, with the month it's planned for), a name, a budget and a line.
export function normaliseTrip(t, idFactory){
  var from = String(t.from || ""), to = String(t.to || t.from || "");
  if(to < from){ var x = from; from = to; to = x; }
  var budget = Math.max(0, Math.round((Number(t.budget) || 0) * 100) / 100);
  var month = !from && /^\d{4}-\d{2}$/.test(String(t.month || "")) ? String(t.month) : "";
  var out = { id: t.id || (idFactory ? idFactory() : "trip" + Date.now().toString(36)), name: String(t.name || "Trip").trim() || "Trip", from: from, to: from ? to : "", lineId: t.lineId || "", budget: budget };
  if(t.purchaseId) out.purchaseId = t.purchaseId;
  if(month) out.month = month;
  return out;
}

// ---------------- Planning trips, and asking on their days (November 2026) ----------------
//
// A trip has its own budget, carved out of the line it's paid from (Holidays: $6,000 a year across three trips), and
// every purchase on its days is asked about — "part of the trip?" — rather than filed without a word. The answer lives
// on the transaction: t.trip = the trip's id for yes, t.tripNo = the trip's id for no, so nothing is asked twice.

// Where a trip stands on `today`: planning (no dates yet), coming, away (inside its dates) or past.
export function tripStatus(trip, today){
  if(!trip || !trip.from) return "planning";
  if(today < trip.from) return "coming";
  if(today <= (trip.to || trip.from)) return "away";
  return "past";
}
// Days from `a` to `b`, both "YYYY-MM-DD", counting both ends.
function daysInclusive(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1; }
// What's left of a trip's budget, and — while away — a day for the days still to come (today included).
export function tripLeft(trip, spent, today){
  var budget = Number(trip && trip.budget) || 0;
  var left = Math.round((budget - (Number(spent) || 0)) * 100) / 100;
  var out = { budget: budget, spent: Number(spent) || 0, left: left, over: budget > 0 && left < 0, perDay: null, daysLeft: null };
  if(tripStatus(trip, today) === "away" && budget > 0){
    out.daysLeft = daysInclusive(today, trip.to || trip.from);
    out.perDay = Math.max(0, Math.floor(left / out.daysLeft));
  }
  return out;
}
// The purchases on a trip's days still to answer: inside its dates, not on it already, not said to be something else,
// not another trip's, and not a bill or a protected line (tripTakes).
export function tripPending(trip, transactions, lines, protectedIds){
  if(!trip || !trip.from || !trip.lineId) return [];
  var byId = {};
  (lines || []).forEach(function(l){ if(l && l.id) byId[l.id] = l; });
  return (transactions || []).filter(function(t){
    if(!t || !t.date || t.date < trip.from || t.date > (trip.to || trip.from)) return false;
    if(t.project || t.trip || t.tripNo === trip.id) return false;
    if(t.linkedExpenseId === trip.lineId) return false;
    if(!(Number(t.amount) > 0)) return false;
    return tripTakes(t.linkedExpenseId ? byId[t.linkedExpenseId] : null, protectedIds);
  });
}
// Answering one: yes files it to the trip (and its line); no leaves it where it is and remembers the answer.
export function answerTrip(t, trip, yes){
  if(!t || !trip) return;
  if(yes){
    t.linkedExpenseId = trip.lineId;
    t.category = "";
    t.trip = trip.id;
    delete t.tripNo;
  } else {
    if(t.trip === trip.id) delete t.trip;
    t.tripNo = trip.id;
  }
}
// A trip's year, for splitting its line: its first day, else the month it's planned for.
function tripDate(trip){ return trip.from || (trip.month ? trip.month + "-01" : ""); }
// How a line's year is shared between the trips paid from it: each trip in the window [start, end] and its budget,
// what they come to, and what's left of the line's yearly amount (`yearly`) for no trip yet.
export function tripLineSplit(trips, lineId, yearly, start, end){
  var mine = (trips || []).filter(function(t){
    var d = tripDate(t);
    return t && t.lineId === lineId && (!d || (d >= start && d <= end));
  });
  var given = Math.round(mine.reduce(function(s, t){ return s + (Number(t.budget) || 0); }, 0) * 100) / 100;
  var y = Math.round((Number(yearly) || 0) * 100) / 100;
  return { trips: mine, given: given, yearly: y, unallocated: Math.round((y - given) * 100) / 100 };
}

// The edits, on a household `st` (components commit them): a new trip, a trip changed, a trip removed — its purchases
// keep their line, and their answers to it go — and answers given to a trip's purchases.
export function addTrip(st, fields, idFactory){
  var trip = normaliseTrip(fields, idFactory);
  if(!Array.isArray(st.trips)) st.trips = [];
  st.trips.push(trip);
  return trip;
}
export function updateTrip(st, id, fields){
  var i = (st.trips || []).findIndex(function(t){ return t && t.id === id; });
  if(i === -1) return null;
  st.trips[i] = normaliseTrip(Object.assign({}, st.trips[i], fields, { id: id }));
  return st.trips[i];
}
export function removeTrip(st, id){
  var before = (st.trips || []).length;
  st.trips = (st.trips || []).filter(function(t){ return t && t.id !== id; });
  (st.transactions || []).forEach(function(t){
    if(t && t.trip === id) delete t.trip;
    if(t && t.tripNo === id) delete t.tripNo;
  });
  return st.trips.length < before;
}
export function answerTrips(st, tripId, txIds, yes){
  var trip = (st.trips || []).find(function(t){ return t && t.id === tripId; });
  if(!trip) return 0;
  var want = {};
  (txIds || []).forEach(function(id){ want[id] = true; });
  var n = 0;
  (st.transactions || []).forEach(function(t){ if(t && want[t.id]){ answerTrip(t, trip, yes); n++; } });
  return n;
}
