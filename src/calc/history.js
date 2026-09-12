// Turning logged snapshots into series a chart can draw.
//
// Pure: no DOM, no state reads. Everything here takes the records it needs as arguments, which is
// what lets the whole file be tested — and matters more than usual, because these functions are
// the difference between a chart that tells you something and a chart that invents something.
//
// The one rule the whole module is built around: **never draw a value that wasn't logged.**
// A holding with a snapshot in July and another in September did not sit at zero in August; it
// sat at its July value until told otherwise. But a holding whose first snapshot is in September
// has no July value at all, and carrying its *current* amount backwards would paint a portfolio
// that never existed. Those two cases look identical in a naive implementation and produce very
// different charts.

// The last logged value at or before `date`, or null when nothing was logged that early.
// null, not 0 — "I don't know" and "it was worth nothing" are different claims, and only the
// caller knows which one is safe to draw.
export function valueOn(history, date){
  if(!history || !history.length) return null;
  var best = null;
  for(var i = 0; i < history.length; i++){
    var h = history[i];
    if(!h || !h.date || h.date > date) continue;
    if(!best || h.date > best.date) best = h;
  }
  return best ? (Number(best.value) || 0) : null;
}
// Whether this record had been logged at all by `date` — the test that stops a chart back-filling
// an asset you hadn't bought yet.
export function trackedOn(history, date){
  return valueOn(history, date) !== null;
}

// Every date on which anything was logged, sorted. The x-axis of every chart here: real observation
// dates rather than a synthetic monthly grid, so the chart can't imply a reading that never
// happened. `extra` appends today, which callers want so the line reaches the present.
export function observationDates(historyArrays, extra){
  var seen = Object.create(null);
  (historyArrays || []).forEach(function(h){
    (h || []).forEach(function(p){ if(p && p.date) seen[p.date] = true; });
  });
  (extra || []).forEach(function(d){ if(d) seen[d] = true; });
  return Object.keys(seen).sort();
}

// One series for one set of records — an asset category, say — as {x, y, dateLabel} points.
//
// `records` is [{history, current}]. A record contributes its last logged value at each date, and
// contributes *nothing* before its first snapshot rather than zero: a category total that dips
// because one holding hadn't been logged yet is a drop that never happened.
export function categorySeries(records, dates, opts){
  opts = opts || {};
  var today = opts.today;
  return (dates || []).map(function(d){
    var total = 0, tracked = 0;
    (records || []).forEach(function(r){
      // Today is the one date where the app knows more than its own log: whatever is typed into
      // the row right now *is* the present value, whether or not Log was ever pressed. Reading the
      // last snapshot instead makes the chart's right-hand edge quietly stale — an asset edited
      // but not logged showed its old figure, so the chart and the number in the table disagreed.
      if(today && d === today && r.current != null){ total += Number(r.current) || 0; tracked++; return; }
      var v = valueOn(r.history, d);
      // No snapshot this early, and not today either: this record contributes nothing rather than
      // zero, or a category total dips on the day a second holding was first logged.
      if(v === null) return;
      total += v;
      tracked++;
    });
    return { x: dateMs(d), y: total, dateLabel: d, tracked: tracked };
  });
}

// Points where nothing at all was tracked yet are dropped, not drawn at zero — the leading run of
// "we have no idea" that would otherwise render as a portfolio climbing out of nothing.
export function trimUntracked(points){
  var first = (points || []).findIndex(function(p){ return p.tracked > 0; });
  return first === -1 ? [] : points.slice(first);
}

export function dateMs(d){ return new Date(d + "T00:00:00").getTime(); }

// ---------------- Allocation ----------------
// The same series, one per bucket, aligned on one set of dates so they can be stacked. Returned in
// the caller's bucket order, which is fixed — colour follows the entity, never its rank, so a
// bucket that empties out must not hand its colour to the next one along.
export function allocationSeries(buckets, dates, opts){
  return (buckets || []).map(function(b){
    return {
      key: b.key,
      label: b.label || b.key,
      colorClass: b.colorClass,
      points: categorySeries(b.records, dates, opts)
    };
  });
}

// ---------------- Contributions vs growth ----------------
// The most useful figure in a wealth tracker and the easiest to fake, so this is deliberately
// conservative about what it claims.
//
// Net worth moves for two reasons: money you added, and assets changing price. The app knows the
// first one honestly — it is the household's net savings, which the scenario engine already
// computes from real income and real budgeted spending. Everything left over is attributed to
// growth.
//
// That attribution is an *inference*, not a measurement, and it absorbs every error in the model:
// a month you underspent your budget lands in "growth" even though nothing grew. The UI has to say
// so. What makes it worth showing anyway is that the two components usually differ by an order of
// magnitude, so even a loose split answers "am I getting wealthier by saving or by owning".

// The first point at which every record that is tracked *now* was already tracked — i.e. where the
// series starts comparing like with like.
//
// This is not a nicety. On the reference data, super and cash were logged from July 2025 while
// shares and the property were only added in August 2026. Measured from the earliest point, net
// worth "grew" $402,372 in 13 months, of which about $385,000 was assets that merely started being
// tracked. Attributing that to growth is not a rounding error, it is a fabrication — so the window
// starts where coverage is complete, even though that throws most of the history away.
export function fullCoverageFrom(points){
  if(!points || !points.length) return -1;
  var maxTracked = points.reduce(function(m, p){ return Math.max(m, p.tracked || 0); }, 0);
  if(maxTracked <= 0) return -1;
  return points.findIndex(function(p){ return (p.tracked || 0) >= maxTracked; });
}

export function contributionsVsGrowth(allPoints, monthlyContribution){
  if(!allPoints || allPoints.length < 2) return null;
  // Only across a span where the same assets were tracked at both ends — see fullCoverageFrom.
  var from = fullCoverageFrom(allPoints);
  var droppedPoints = from > 0 ? from : 0;
  var points = from > 0 ? allPoints.slice(from) : allPoints;
  if(points.length < 2){
    return { tooShort: true, droppedPoints: droppedPoints,
      coverageFrom: allPoints[from] ? allPoints[from].dateLabel : null,
      earliest: allPoints[0].dateLabel };
  }
  var first = points[0], last = points[points.length - 1];
  var months = monthsBetween(first.dateLabel, last.dateLabel);
  if(months <= 0) return null;
  var totalChange = last.y - first.y;
  var contributed = (Number(monthlyContribution) || 0) * months;
  return {
    from: first.dateLabel, to: last.dateLabel, months: months,
    // How much history was set aside to make the two ends comparable, so the panel can say so
    // rather than quietly presenting a 3-week window as if it were the whole record.
    droppedPoints: droppedPoints,
    earliest: allPoints[0].dateLabel,
    start: first.y, end: last.y,
    totalChange: totalChange,
    contributed: contributed,
    // Can be negative, and that is a real reading rather than an error: it means the portfolio grew
    // by less than was paid into it, i.e. the market went backwards while you kept saving.
    growth: totalChange - contributed
  };
}
export function monthsBetween(fromDate, toDate){
  if(!fromDate || !toDate) return 0;
  var a = fromDate.split("-"), b = toDate.split("-");
  var months = (Number(b[0]) - Number(a[0])) * 12 + (Number(b[1]) - Number(a[1]));
  // Part-months count proportionally: over a 45-day window, calling it "1 month of contributions"
  // understates by half a month, which on this arithmetic lands entirely in "growth".
  var dayFraction = (Number(b[2]) - Number(a[2])) / 30;
  return Math.max(0, months + dayFraction);
}

// ---------------- Monthly cash flow ----------------
// Income, spending and what's left, by calendar month, from real dated records. Spending comes from
// logged transactions, so a month nobody logged reads as zero spending — which is why the caller
// has to gate this on coverage the same way the trends panel does, rather than presenting an
// unlogged month as a month of heroic saving.
export function monthlyCashFlow(transactions, monthKeys, monthlyIncome){
  var byMonth = Object.create(null);
  (transactions || []).forEach(function(t){
    if(!t || !t.date) return;
    var key = t.date.slice(0, 7);
    byMonth[key] = (byMonth[key] || 0) + (Number(t.amount) || 0);
  });
  return (monthKeys || []).map(function(key){
    var spent = byMonth[key] || 0;
    var income = Number(monthlyIncome) || 0;
    return {
      month: key,
      income: income,
      spent: spent,
      saved: income - spent,
      logged: byMonth[key] !== undefined
    };
  });
}

// What fraction of the household's actual budget the logged transactions represent.
//
// The cash-flow panel's first version computed "saved = income − logged spending" and, on the
// reference data, announced that the household kept $21,713/mo. It keeps $8,339. Logged spend
// averaged $777/mo against a $14,613/mo budget — about 5% — so "income minus what you logged" was
// measuring how little had been typed in, and calling it thrift.
//
// A savings claim is only honest when logging is close to complete. Below that, the panel can still
// show what *was* logged month to month — that's a real trend — but it must not subtract it from
// income and call the remainder savings.
export function spendCoverage(loggedMonthlyAvg, budgetedMonthly){
  var budget = Number(budgetedMonthly) || 0;
  if(budget <= 0) return { fraction: 0, enough: false, budgeted: 0, logged: Number(loggedMonthlyAvg) || 0 };
  var fraction = (Number(loggedMonthlyAvg) || 0) / budget;
  return {
    fraction: fraction,
    budgeted: budget,
    logged: Number(loggedMonthlyAvg) || 0,
    // 80%: high enough that the remainder is plausibly rounding and forgotten cash, low enough to
    // be reachable by someone who imports a statement and doesn't chase every coffee.
    enough: fraction >= 0.8
  };
}
