import { localDateStr } from "../lib/format.js";

// ---------------- Spending over time ----------------
//
// Every other spending view in this app answers "how am I doing *right now*" — this month, this
// statement cycle, this budget year. All of them compare you against a number you typed in.
// None compares you against yourself: the app could say you were over budget on groceries, but
// never that groceries had climbed three months running, which is the thing you'd actually want
// to hear and the only thing that makes logging every coffee pay off.
//
// No new data model is needed for this — transactions are already dated and already carry a
// category (their own, or their linked budget line's). What was missing was anything that looked
// at more than one window at a time.
//
// Everything here is pure: it takes transactions and a category resolver, and knows nothing about
// the DOM or about how a transaction finds its category (that lives in components/expenses.js's
// transactionCategory(), which has to walk the budget lines).

// The last `count` month keys ("YYYY-MM"), oldest first, ending with the month `todayStr` is in.
//
// Built by stepping a Date rather than by subtracting from the month number, so year boundaries
// and the December->January wrap come out right without a modulo. Day is pinned to 1 first: from
// the 31st, `setMonth(m - 1)` would overflow a 30-day month forward into the month after.
export function monthKeysBack(count, todayStr){
  count = Math.max(1, Number(count) || 1);
  var base = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  var keys = [];
  for(var i = count - 1; i >= 0; i--){
    var d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(localDateStr(d).slice(0, 7));
  }
  return keys;
}

// Nice label for a month key — "Sep", or "Sep 25" when it isn't in the same year as the last key
// in the set, so a window spanning a year boundary doesn't show two identical-looking "Jan"s.
var SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthKeyLabel(key, referenceKey){
  var year = key.slice(0, 4), month = Number(key.slice(5, 7));
  var name = SHORT_MONTHS[month - 1] || key;
  if(referenceKey && referenceKey.slice(0, 4) !== year) return name + " " + year.slice(2);
  return name;
}

// Spend per category per month, over exactly the months asked for.
//
// `categoryFor` resolves a transaction's category (a transaction may carry its own, or inherit
// its linked budget line's — see transactionCategory()); anything it can't name is bucketed under
// `uncategorisedLabel` rather than dropped, so the rows still add up to what was actually spent.
//
// Returns rows sorted by total spend descending, each carrying the full `months`-aligned series
// so a caller can render a table without re-indexing anything:
//   [{ category, values: [n, n, ...], total }]
export function spendByCategoryByMonth(transactions, months, categoryFor, uncategorisedLabel, throughDay){
  uncategorisedLabel = uncategorisedLabel || "Uncategorised";
  var index = {};
  months.forEach(function(key, i){ index[key] = i; });
  var byCategory = {};
  (transactions || []).forEach(function(t){
    var slot = index[(t.date || "").slice(0, 7)];
    if(slot === undefined) return;
    // throughDay truncates every month to the same day-of-month — the month-to-date series that
    // makes a part-finished month comparable to whole ones (see spendingTrends).
    if(throughDay && Number((t.date || "").slice(8, 10)) > throughDay) return;
    var amount = Number(t.amount) || 0;
    if(!amount) return;
    var name = (categoryFor ? categoryFor(t) : "") || uncategorisedLabel;
    if(!byCategory[name]) byCategory[name] = months.map(function(){ return 0; });
    byCategory[name][slot] += amount;
  });
  return Object.keys(byCategory).map(function(name){
    var values = byCategory[name].map(function(v){ return Math.round(v * 100) / 100; });
    return {
      category: name,
      values: values,
      total: Math.round(values.reduce(function(s, v){ return s + v; }, 0) * 100) / 100
    };
  }).sort(function(a, b){ return b.total - a.total; });
}

// How many months in a row the series has risen, counting back from the most recent.
//
// A month equal to the one before it breaks the streak rather than extending it: "climbing" has
// to mean climbing, or a flat line reads as a trend. Returns the number of *increases*, so three
// consecutive rises (four data points) returns 3.
export function risingStreak(values){
  var streak = 0;
  for(var i = (values || []).length - 1; i > 0; i--){
    if(values[i] > values[i - 1]) streak++;
    else break;
  }
  return streak;
}
export function fallingStreak(values){
  var streak = 0;
  for(var i = (values || []).length - 1; i > 0; i--){
    if(values[i] < values[i - 1]) streak++;
    else break;
  }
  return streak;
}

// ---------------- "Was this month actually being logged?" ----------------
//
// The hazard that makes or breaks this whole feature: **a month with nothing logged looks exactly
// like a month with nothing spent.** Somebody who started logging in August has $0 across every
// earlier month, and a naive comparison reports groceries "up 3,124%" and "climbing 3 months
// running" — both nonsense, both stated with total confidence, on the very first day the feature
// is visible. One of those and nobody trusts the number again.
//
// So the baseline is only ever taken over months the user was *actually logging in*. A month
// counts as covered when its total spend is a meaningful fraction of a typical logged month —
// measured against the median of this household's own non-empty months, not a fixed dollar
// figure, because "typical" is $600 for one person and $12,000 for another.
//
// Only the contiguous run ending at the current month counts. History from before you started is
// not thin history, it's absent history, and a gap in the middle (a month you stopped logging)
// would poison an average just as badly as the months before you began.
export var DEFAULT_COVERAGE_FRACTION = 0.25;

function median(values){
  if(!values.length) return 0;
  var sorted = values.slice().sort(function(a, b){ return a - b; });
  var mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// How many months at the END of `totals` were genuinely being logged, counting back from the most
// recent. Feed it the month-to-date series (every month truncated to the same day) so the current
// part-finished month is judged on the same footing as the whole ones behind it.
export function coveredMonthCount(totals, opts){
  opts = opts || {};
  if(!totals || !totals.length) return 0;
  var fraction = opts.coverageFraction == null ? DEFAULT_COVERAGE_FRACTION : Number(opts.coverageFraction);
  var nonEmpty = totals.filter(function(v){ return v > 0; });
  if(!nonEmpty.length) return 0;
  var threshold = median(nonEmpty) * fraction;
  var count = 0;
  for(var i = totals.length - 1; i >= 0; i--){
    if(totals[i] > 0 && totals[i] >= threshold) count++;
    else break;
  }
  return count;
}

// This month against the months before it.
//
// Feed this the **month-to-date** series: this month's spend so far, and each prior month's spend
// up to the same day. That is the whole trick, and it took getting wrong twice to find:
//
//   - Comparing a part-finished month against whole ones reports a fall every time, so the panel
//     would be useless for the first three weeks of every month.
//   - Scaling the partial month up to a full one (current / fraction-of-month-elapsed) looks like
//     the fix and is worse. Household spending is front-loaded — rent, electricity and insurance
//     all land in the first week — and this app's own "Catch up on overdue" flow encourages
//     logging in bulk. On the real reference data, 11 days into the month, that projection turned
//     $3,067 actually spent into a confident "on track for $8,366", a 611% rise that never
//     happened.
//
// Truncating both sides to the same day needs no model of how spending is distributed, because it
// never extrapolates. The cost is that early in a month the figures are small; they're also true.
//
// The average excludes the current month: including it drags the baseline toward whatever you're
// being compared against, which is most wrong exactly when the current month is the outlier you
// wanted flagged.
//
// Returns null when there's no prior month with any spend in it — an honest "not enough history
// yet" rather than a percentage against zero.
export function categoryTrend(values, opts){
  opts = opts || {};
  if(!values || values.length < 2) return null;
  var lookback = Math.max(1, Math.min(Number(opts.lookback) || 3, values.length - 1));
  var current = values[values.length - 1];
  var priorSlice = values.slice(values.length - 1 - lookback, values.length - 1);
  var priorWithSpend = priorSlice.filter(function(v){ return v > 0; });
  if(!priorWithSpend.length) return null;
  var average = priorSlice.reduce(function(s, v){ return s + v; }, 0) / priorSlice.length;
  var delta = current - average;
  return {
    current: Math.round(current * 100) / 100,
    average: Math.round(average * 100) / 100,
    lookback: priorSlice.length,
    delta: Math.round(delta * 100) / 100,
    // Guarded because average can only be 0 if every prior month was 0, which priorWithSpend
    // already ruled out — but a divide-by-zero here would render as "Infinity%" on the page.
    deltaPct: average > 0 ? delta / average : 0,
    direction: delta > 0 ? "up" : (delta < 0 ? "down" : "flat"),
    // Whether the month is over. Drives wording only ("so far this month" vs "this month"), never
    // the arithmetic — both sides are already truncated to the same day either way.
    complete: opts.complete !== false,
    throughDay: opts.throughDay || null
  };
}

// How far through its month `todayStr` is, as a fraction — the last day of the month returns 1.
// Used for wording ("this month is 37% through"), not for scaling anything.
export function monthProgressFor(todayStr){
  var today = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  var daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return today.getDate() / daysInMonth;
}
export function daysInMonthOf(todayStr){
  var today = todayStr ? new Date(todayStr + "T00:00:00") : new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
}

// The whole Spending-trends view in one call.
//
// Two series per category, deliberately:
//   - `values`  — whole months. What the bars and the numbers table show, because "what did
//                 August cost" should be August's real total, not August-up-to-the-11th.
//   - `mtdValues` — every month truncated to today's day-of-month. What every comparison uses,
//                 so a part-finished month is never measured against whole ones.
// When today is the last day of the month the two coincide.
//
// `minSpend` drops categories too small to be worth a line of text — a $4 category that doubled is
// a true statement and a useless one. Applied to the window total, not to a single month, so a
// category that's only lumpy (car rego once a year) still keeps its place.
//
// The window is trimmed to the months that were actually being logged (see coveredMonthCount), so
// everything downstream, streaks included, only ever sees real history. `monthsCovered` and
// `monthsRequested` come back so the UI can say how much history it's working from instead of
// silently implying six months of it.
export function spendingTrends(transactions, opts){
  opts = opts || {};
  var todayStr = opts.todayStr || localDateStr();
  var requested = opts.months || 6;
  var allMonths = monthKeysBack(requested, todayStr);
  var progress = monthProgressFor(todayStr);
  var complete = progress >= 1;
  var throughDay = Number(todayStr.slice(8, 10));

  function rowsFor(months, day){
    return spendByCategoryByMonth(transactions, months, opts.categoryFor, opts.uncategorisedLabel, day);
  }
  function totalsFor(rows, months){
    return months.map(function(_, i){
      return Math.round(rows.reduce(function(sum, r){ return sum + r.values[i]; }, 0) * 100) / 100;
    });
  }

  // Coverage is judged on the month-to-date totals — the same like-for-like basis every
  // comparison uses, so a month isn't called a gap merely for being part-finished.
  var coverageTotals = totalsFor(rowsFor(allMonths, complete ? 0 : throughDay), allMonths);
  var covered = coveredMonthCount(coverageTotals, { coverageFraction: opts.coverageFraction });

  var months = covered > 0 ? allMonths.slice(allMonths.length - covered) : [];
  var fullRows = months.length ? rowsFor(months, 0) : [];
  var mtdRows = months.length ? (complete ? fullRows : rowsFor(months, throughDay)) : [];
  var mtdByCategory = {};
  mtdRows.forEach(function(r){ mtdByCategory[r.category] = r.values; });

  var minSpend = opts.minSpend == null ? 0 : Number(opts.minSpend);
  var kept = fullRows.filter(function(r){ return r.total >= minSpend; });
  // Lookback can't reach past the covered window: with two logged months the honest comparison is
  // "vs last month", not "vs your 3-month average" computed over two months that don't exist.
  var lookback = Math.max(1, Math.min(opts.lookback || 3, Math.max(1, months.length - 1)));
  kept.forEach(function(r){
    r.mtdValues = mtdByCategory[r.category] || r.values.map(function(){ return 0; });
    r.trend = categoryTrend(r.mtdValues, { lookback: lookback, complete: complete, throughDay: throughDay });
    // Streaks run on whole months only — a streak is a claim about months, and the current
    // part-finished one can't support it. Dropping it costs nothing: "up 3 months running" is
    // about what already happened.
    var settled = complete ? r.values : r.values.slice(0, r.values.length - 1);
    r.risingStreak = risingStreak(settled);
    r.fallingStreak = fallingStreak(settled);
  });
  var totals = totalsFor(fullRows, months);
  var mtdTotals = totalsFor(mtdRows, months);
  return {
    months: months,
    monthsCovered: covered,
    monthsRequested: requested,
    lookback: lookback,
    rows: kept,
    totals: totals,
    mtdTotals: mtdTotals,
    totalsTrend: categoryTrend(mtdTotals, { lookback: lookback, complete: complete, throughDay: throughDay }),
    monthProgress: progress,
    throughDay: throughDay,
    daysInMonth: daysInMonthOf(todayStr),
    complete: complete
  };
}
