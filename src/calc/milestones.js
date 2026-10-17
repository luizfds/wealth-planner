// Projection milestones (v3.34.0) — reading a net-worth series for the moments people plan around,
// rather than leaving them to squint at where two lines cross. Pure: takes the points
// computeNetWorthSeries() returns ({x: year, y, debt, ...}).

// The first year the series reaches `amount`, or null within the horizon. Year 0 counts: already
// there is an answer too.
export function firstYearAtLeast(points, amount){
  var hit = (points || []).find(function(p){ return p.y >= amount; });
  return hit ? hit.x : null;
}
// The first year with no debt left, when there's debt today; null when there's none to start with
// or it outlasts the horizon. Under a dollar counts as gone (rounding in the loan schedule).
export function debtFreeYear(points){
  if(!points || !points.length || !(points[0].debt > 1)) return null;
  var hit = points.find(function(p){ return p.debt != null && p.debt <= 1; });
  return hit ? hit.x : null;
}
// The years where the scenario in front changes, as [{year, leader, behind}]. Ties are not a
// change of leader — a pair of lines that meet and part the same way they came don't "overtake".
export function leadChanges(seriesList){
  var named = (seriesList || []).filter(function(s){ return s.points && s.points.length; });
  if(named.length < 2) return [];
  var years = named[0].points.map(function(p){ return p.x; });
  var out = [];
  var leaderAt = function(i){
    var best = null;
    named.forEach(function(s){
      var p = s.points[i];
      if(p && (best === null || p.y > best.y + 0.5)) best = { label: s.label, y: p.y };
    });
    return best && best.label;
  };
  var prev = leaderAt(0);
  for(var i = 1; i < years.length; i++){
    var now = leaderAt(i);
    if(now && now !== prev){ out.push({ year: years[i], leader: now, behind: prev }); prev = now; }
  }
  return out;
}
// Round thresholds worth naming, picked from where the series actually goes: the next three
// $500k/$1M steps above today's figure, so a $300k household sees $500k/$1M/$1.5M and a $3M one
// doesn't see milestones it passed years ago.
export function milestoneAmounts(seriesList){
  var start = Infinity, end = 0;
  (seriesList || []).forEach(function(s){
    (s.points || []).forEach(function(p){ if(p.x === 0) start = Math.min(start, p.y); end = Math.max(end, p.y); });
  });
  if(!isFinite(start)) return [];
  var step = end > 4e6 ? 1e6 : 5e5;
  var out = [];
  for(var a = (Math.floor(Math.max(0, start) / step) + 1) * step; a <= end && out.length < 3; a += step) out.push(a);
  return out;
}
