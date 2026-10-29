// ---------------- The rent in the plan against the agent's statements (v3.153.0) ----------------
//
// An agent's statement pays a whole number of rent payments — four or five weeks in a month — so
// every statement's rent is a multiple of the weekly (or fortnightly) rent. When the plan's figure
// doesn't divide the recent statements but another one does, the plan's rent is out: often a
// monthly figure typed as weekly. Pure: a property in, { planned, fromStatements, statements } or null.

function gcdCents(a, b){ while(b){ var t = b; b = a % b; a = t; } return a; }
export function rentCheck(p){
  if(!p || p.kind !== "IP") return null;
  var row = (p.income || [])[0];
  if(!row || !(Number(row.amount) > 0) || (row.freq !== "Weekly" && row.freq !== "Fortnightly")) return null;
  // Since the last rent review, or the latest four — a rise changes the multiple.
  var lastReview = (p.rentReviews || []).map(function(r){ return r.date; }).sort().pop() || "";
  var stmts = (p.agentStatements || []).filter(function(s){ return Number(s.rent) > 0 && (!lastReview || s.date > lastReview); })
    .sort(function(a, b){ return a.date < b.date ? -1 : 1; }).slice(-4);
  if(stmts.length < 2) return null;
  var planned = Number(row.amount);
  var fits = function(v){ return stmts.every(function(s){ var m = Number(s.rent) / v; return Math.round(m) >= 1 && Math.abs(m - Math.round(m)) * v <= 1; }); };
  if(fits(planned)) return null;
  var g = stmts.reduce(function(acc, s){ return gcdCents(acc, Math.round(Number(s.rent) * 100)); }, 0) / 100;
  // The common payment closest to the plan's: the gcd, or a whole fraction of it.
  var best = null;
  for(var k = 1; k <= 6; k++){ var c = Math.round(g / k * 100) / 100; if(c > 0 && fits(c) && (!best || Math.abs(c - planned) < Math.abs(best - planned))) best = c; }
  if(!best || Math.abs(best - planned) / planned > 0.25) return null;
  return { property: p, planned: planned, fromStatements: best, freq: row.freq, statements: stmts.length };
}
