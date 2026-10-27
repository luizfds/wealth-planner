// ---------------- Life events (v3.126.0) ----------------
//
// The projection ran today's income and costs forward unchanged except for inflation and pay rises.
// Lives don't: a child arrives and costs money for eighteen years, someone takes a year off, a
// property is sold, an inheritance lands. A life event is one of those, dated by calendar year:
//   child — a yearly cost for a number of years
//   break — income down by a yearly amount for a number of years (a career break, part-time)
//   spend — a yearly cost (or, negative, a saving) for a number of years
//   lump  — a one-off amount in (a sale, an inheritance, a downsizer) or out (a car, a wedding)
// Amounts are in today's dollars; the projection inflates them to the year they land. They apply
// to every scenario — they're about the household, not the housing choice. Pure.

export var EVENT_KINDS = [
  { key: "child", label: "A child", what: "A child", amount: 15000, years: 18, help: "costs a year" },
  { key: "break", label: "A career break", what: "Career break", amount: 40000, years: 1, help: "less income a year" },
  { key: "spend", label: "A cost for some years", what: "School fees", amount: 10000, years: 6, help: "costs a year (negative saves)" },
  { key: "lump", label: "A one-off amount", what: "Inheritance", amount: 100000, years: 1, help: "in (negative is out)" }
];
export function kindOf(key){ return EVENT_KINDS.find(function(k){ return k.key === key; }) || EVENT_KINDS[3]; }

export function newEvent(kind, thisYear, id){
  var k = kindOf(kind);
  return { id: id, kind: k.key, what: k.what, year: thisYear + 1, years: k.years, amount: k.amount };
}

// Projection year y (1 = the twelve months from today) belongs to calendar year thisYear + y - 1
// for an event's purposes: an event dated this year starts in the first projected year.
function startIndex(ev, thisYear){ return Math.max(1, (Number(ev.year) || thisYear) - thisYear + 1); }

// What the events do in projection year y, in today's dollars: { yearly } — less saved that year
// (costs, and income lost) — and { lump } — added to (or taken from) savings at the start of it.
export function eventEffects(events, y, thisYear){
  var out = { yearly: 0, lump: 0 };
  (events || []).forEach(function(ev){
    if(!ev) return;
    var s = startIndex(ev, thisYear), amt = Number(ev.amount) || 0;
    if(ev.kind === "lump"){ if(y === s) out.lump += amt; return; }
    var n = Math.max(1, Number(ev.years) || 1);
    if(y >= s && y < s + n) out.yearly += amt;
  });
  return out;
}

// Where each event sits on the projection's axis, within the horizon: [{ x, label }].
export function eventMarkers(events, thisYear, horizon){
  return (events || []).filter(Boolean).map(function(ev){ return { x: startIndex(ev, thisYear) - 1, label: ev.what || kindOf(ev.kind).label }; })
    .filter(function(m){ return m.x < horizon; }).sort(function(a, b){ return a.x - b.x; });
}
