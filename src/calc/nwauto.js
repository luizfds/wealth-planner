// ---------------- Net worth history that keeps itself (v3.139.0, item 171) ----------------
//
// The net worth trend on Home and in the charts read `state.netWorthLog`, which only grew when
// someone pressed "Record". A household that did that a handful of times got a trend line drawn
// through a handful of points, weeks apart — and a "since …" figure resting on them. Now:
//   - recordNetWorth: the day's net worth is kept as the app saves — one point a day, today's
//     updated in place, marked `auto`;
//   - backfillNetWorth: the weeks before, back to where every record has a value, rebuilt from what
//     each record already knows (calc/nwhistory.js netWorthOn — the same rules as Reports' "a month
//     ago"), one point a week, marked `derived`, never over a point that's already there;
//   - netWorthMovers: what moved it between two dates, biggest first.
// The log is thinned like price history (calc/pricesheet.js thinPriceHistory): automatic points
// daily for 90 days, weekly to two years, monthly after; points recorded by hand are kept.
// Pure: the caller hands in the log, today's value and a rebuild function.

// Today's net worth into the log: today's point updated, or a new one. Returns true if it changed.
export function recordNetWorth(log, value, today){
  if(!Array.isArray(log) || !today || !isFinite(Number(value))) return false;
  var v = Math.round(Number(value) * 100) / 100;
  var last = log.length ? log[log.length - 1] : null;
  if(last && last.date === today){
    if(last.value === v) return false;
    last.value = v;
    return true;
  }
  if(last && last.date > today) return false;
  log.push({ date: today, value: v, auto: true });
  return true;
}

function dayMs(d){ return Date.parse(d + "T00:00:00Z"); }
function iso(ms){ return new Date(ms).toISOString().slice(0, 10); }
// The Sunday ending the week before `today`'s, then each Sunday before it.
function sundaysBefore(today, weeks){
  var t = dayMs(today), dow = new Date(t).getUTCDay();
  var last = t - (dow === 0 ? 7 : dow) * 86400000;
  var out = [];
  for(var i = 0; i < weeks; i++) out.push(iso(last - i * 7 * 86400000));
  return out;
}
// Weekly points for the weeks the log has nothing in, newest first, stopping at the first week some
// record has no value for yet (`rebuild(date)` → { total, partial }) — a figure missing one of them
// would show a rise or fall that never happened. Returns how many were added; the log stays sorted.
export function backfillNetWorth(log, rebuild, today, maxWeeks){
  if(!Array.isArray(log) || typeof rebuild !== "function" || !today) return 0;
  var added = 0;
  var has = function(sunday){
    var from = iso(dayMs(sunday) - 6 * 86400000);
    return log.some(function(p){ return p.date >= from && p.date <= sunday; });
  };
  var weeks = sundaysBefore(today, maxWeeks || 104);
  for(var i = 0; i < weeks.length; i++){
    var d = weeks[i];
    if(has(d)) continue;
    var r = rebuild(d);
    if(!r || (r.partial && r.partial.length) || !isFinite(Number(r.total))) break;
    log.push({ date: d, value: Math.round(Number(r.total) * 100) / 100, derived: true });
    added++;
  }
  if(added) log.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return added;
}

// What moved net worth between two breakdowns (netWorthOn's `parts`): [{ key, label, change }],
// largest change first, debts and loans counted as they move net worth (paying one down is a rise).
export function netWorthMovers(from, to){
  if(!from || !to) return [];
  var rows = {};
  var put = function(key, label, a, b){ rows[key] = { key: key, label: label, change: Math.round(((b || 0) - (a || 0)) * 100) / 100 }; };
  var cats = {};
  Object.keys(from.assets || {}).concat(Object.keys(to.assets || {})).forEach(function(c){ cats[c] = true; });
  Object.keys(cats).forEach(function(c){ put("asset:" + c, c, (from.assets || {})[c], (to.assets || {})[c]); });
  put("property", "Property value", from.property, to.property);
  put("offsets", "Offset balances", from.offsets, to.offsets);
  put("loans", "Property loans", -(from.loans || 0), -(to.loans || 0));
  put("debts", "Other debts", -(from.debts || 0), -(to.debts || 0));
  return Object.keys(rows).map(function(k){ return rows[k]; }).filter(function(r){ return Math.abs(r.change) >= 1; })
    .sort(function(a, b){ return Math.abs(b.change) - Math.abs(a.change); });
}

// Which log points the thinning may drop: the ones the app made, never one recorded by hand.
export function isAutoPoint(p){ return !!(p && (p.auto || p.derived)); }

// v3.146.0: the change in two parts — money (cash, offsets, what's owed on cards and loans: what was
// kept or spent) and values (property, shares, super and the rest: the market, revaluations, and
// money moved into them). movers: netWorthMovers' rows. { money, values, top } — `top` the values
// row that accounts for most of the values part (70% or more), else null.
var MONEY_KEYS = { "asset:Cash": 1, offsets: 1, loans: 1, debts: 1 };
export function netWorthSplit(movers){
  var money = 0, values = 0, valueRows = [];
  (movers || []).forEach(function(r){
    if(MONEY_KEYS[r.key]) money += r.change;
    else { values += r.change; valueRows.push(r); }
  });
  var top = valueRows.slice().sort(function(a, b){ return Math.abs(b.change) - Math.abs(a.change); })[0] || null;
  if(top && !(Math.abs(values) >= 1 && Math.sign(top.change) === Math.sign(values) && Math.abs(top.change) >= Math.abs(values) * 0.7)) top = null;
  return { money: Math.round(money * 100) / 100, values: Math.round(values * 100) / 100, top: top };
}
