// ---------------- Investments against a benchmark, and a target mix (v3.178.0, item 203) ----------------
//
// The Performance card's gain is simple: value against cost. It can't say how well the money did
// while it was in — $10,000 that doubled over ten years and $10,000 that doubled last month read the
// same. A money-weighted return (an IRR over every buy, sale and distribution, with today's value as
// the last flow) does, per holding and overall. Beside it:
//   - the same money in an index — each dollar in or out bought or sold index units on the same day,
//     from the price file's weekly series (an ETF that tracks it, its dividends added at a stated yield);
//   - a target mix by asset class, the gap in dollars, and where the next $X should go to close it;
//   - the distributions expected in the year ahead, from when each holding has paid before.
// Pure: assets and series in, figures out. Amounts are in each holding's currency through toAud.

function round(n){ return Math.round(n * 100) / 100; }
function dayNum(iso){ var p = String(iso).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
function isoOf(days){ return new Date(days * 86400000).toISOString().slice(0, 10); }

// XIRR on an actual/365 basis: the yearly rate at which every flow, discounted to the first, sums to
// zero. flows: [{ date, amount }] — money put in negative, money taken out (and today's value) positive.
// Null when there's no answer (all one sign, or under a day of history).
export function xirr(flows){
  var f = (flows || []).filter(function(x){ return x && x.date && isFinite(Number(x.amount)) && Number(x.amount) !== 0; });
  if(f.length < 2 || !f.some(function(x){ return x.amount < 0; }) || !f.some(function(x){ return x.amount > 0; })) return null;
  var d0 = Math.min.apply(null, f.map(function(x){ return dayNum(x.date); }));
  var t = f.map(function(x){ return (dayNum(x.date) - d0) / 365; });
  if(Math.max.apply(null, t) <= 1 / 365) return null;
  var npv = function(r){ return f.reduce(function(s, x, i){ return s + x.amount / Math.pow(1 + r, t[i]); }, 0); };
  var dnpv = function(r){ return f.reduce(function(s, x, i){ return s - t[i] * x.amount / Math.pow(1 + r, t[i] + 1); }, 0); };
  var r = 0.1;
  for(var k = 0; k < 60; k++){
    var v = npv(r), d = dnpv(r);
    if(!isFinite(v) || !isFinite(d) || d === 0) break;
    var next = r - v / d;
    if(next <= -0.9999) next = (r - 0.9999) / 2;
    if(Math.abs(next - r) < 1e-12){ r = next; return r; }
    r = next;
  }
  // Newton didn't settle: bisect between nearly −100% and +1,000%.
  var lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi);
  if(!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for(var j = 0; j < 200; j++){
    var mid = (lo + hi) / 2, fm = npv(mid);
    if(Math.abs(fm) < 1e-9) return mid;
    if(flo * fm < 0){ hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// One holding's flows: each dated purchase lot out (units × price + brokerage), each sale's proceeds
// and each distribution (cash and franking credits, as the Performance card counts them) in, and
// today's value in. A holding without dated lots has no start date to measure from: null.
export function holdingFlows(a, today, toAud){
  var aud = toAud || function(_, n){ return n; };
  var lots = (Array.isArray(a.lots) ? a.lots : []).filter(function(l){ return l && l.date && Number(l.units) > 0; });
  if(!lots.length) return null;
  var flows = lots.map(function(l){ return { date: l.date, amount: -aud(a, (Number(l.units) || 0) * (Number(l.price) || 0) + (Number(l.brokerage) || 0)) }; });
  (Array.isArray(a.sales) ? a.sales : []).forEach(function(x){
    if(!x || !x.date) return;
    var proceeds = x.proceeds != null ? Number(x.proceeds) || 0 : (Number(x.units) || 0) * (Number(x.price) || 0);
    flows.push({ date: x.date, amount: aud(a, proceeds) });
  });
  (Array.isArray(a.payouts) ? a.payouts : []).forEach(function(p){
    if(!p || !p.date || p.date > today) return;
    flows.push({ date: p.date, amount: aud(a, (Number(p.cash) || 0) + (Number(p.credit) || 0)) });
  });
  var qty = Number(a.quantity) || 0;
  var value = qty > 0 && Number(a.price) > 0 ? Number(a.price) * qty : (Number(a.amount) || 0);
  if(value > 0) flows.push({ date: today, amount: aud(a, value) });
  return flows.sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
}

// Per holding and overall: { rows: [{ index, name, irr, since }], irr, since, flows, uncounted }.
export function moneyWeighted(assets, today, toAud){
  var rows = [], all = [], uncounted = 0;
  (assets || []).forEach(function(a, i){
    if(!a || a.category !== "Shares") return;
    var f = holdingFlows(a, today, toAud);
    if(!f){ if((Number(a.quantity) || 0) > 0) uncounted++; return; }
    rows.push({ index: i, name: a.what || a.symbol || "Holding", symbol: a.symbol || "", irr: xirr(f), since: f[0].date });
    all = all.concat(f);
  });
  all.sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
  return { rows: rows, irr: xirr(all), since: all.length ? all[0].date : null, flows: all, uncounted: uncounted };
}

// The index's close on a date: the last weekly close on or before it (null before the series starts).
export function closeOn(series, date){
  var out = null;
  for(var i = 0; i < series.length; i++){ if(series[i].date <= date) out = series[i]; else break; }
  return out ? out.close : null;
}
// The same money in the index. `flows` are moneyWeighted's; today's value (the positive flows dated
// today) is left out, and every other flow buys (money in) or sells (money out) index units at that
// day's close. The series is a price, so yieldPct adds the index's dividends, reinvested: its price
// grows by that much a year on top (a total-return price). opts.mineAt(date) gives the portfolio's own
// value for the weekly points. Returns { value, mine, irr, points: [{ date, index, mine }], coveredFrom }
// — coveredFrom is set when money went in before the series starts (it's bought at the first close).
export function benchmark(flows, series, today, opts){
  opts = opts || {};
  var s = (series || []).filter(function(p){ return p && p.date && Number(p.close) > 0; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  var fl = flows || [];
  var valueNow = fl.filter(function(f){ return f.date === today && f.amount > 0; });
  var money = fl.filter(function(f){ return valueNow.indexOf(f) === -1; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
  if(!s.length || !money.length) return null;
  var y = (Number(opts.yieldPct) || 0) / 100, d0 = dayNum(s[0].date), coveredFrom = null;
  var tr = function(date){
    var c = closeOn(s, date), at = date;
    if(c == null){ c = s[0].close; at = s[0].date; coveredFrom = s[0].date; }
    return c * Math.pow(1 + y, (dayNum(at) - d0) / 365);
  };
  var units = 0, fi = 0, points = [];
  s.filter(function(p){ return p.date >= money[0].date.slice(0, 10) || p === s[0]; }).forEach(function(w){
    if(w.date > today) return;
    while(fi < money.length && money[fi].date <= w.date){ units += -money[fi].amount / tr(money[fi].date); fi++; }
    if(!(units > 0) && fi === 0) return;
    points.push({ date: w.date, index: round(units * tr(w.date)), mine: opts.mineAt ? round(opts.mineAt(w.date)) : null });
  });
  while(fi < money.length){ units += -money[fi].amount / tr(money[fi].date); fi++; }
  var value = round(units * tr(today));
  return { value: value, mine: round(valueNow.reduce(function(t, f){ return t + f.amount; }, 0)),
    irr: xirr(money.concat([{ date: today, amount: value }])), points: points, coveredFrom: coveredFrom };
}

// ---- A target mix ----
export var MIX_CLASSES = ["Australian shares", "International shares", "Cash", "Crypto", "Other"];
// A holding's class: its own (a.assetClass) if set, else from where it trades.
export function classOf(a){
  if(a.assetClass && MIX_CLASSES.indexOf(a.assetClass) !== -1) return a.assetClass;
  if(a.category === "Cash") return "Cash";
  if(a.category === "Shares") return a.market === "Crypto" ? "Crypto" : (a.market && a.market !== "ASX" ? "International shares" : "Australian shares");
  if(a.category === "Super") return null; // not something you move money into at will
  return "Other";
}
// { total, rows: [{ cls, value, pct, target, gap }] } — gap is dollars short (+) or over (−) of target.
export function mixGaps(assets, target, toAud){
  var aud = toAud || function(_, n){ return n; };
  var by = {}, total = 0;
  (assets || []).forEach(function(a){
    var c = a && classOf(a);
    if(!c) return;
    var v = aud(a, Number(a.amount) || 0);
    if(!(v > 0)) return;
    by[c] = (by[c] || 0) + v; total += v;
  });
  var t = target || {};
  var rows = MIX_CLASSES.filter(function(c){ return by[c] || Number(t[c]); }).map(function(c){
    var tgt = Number(t[c]) || 0, v = by[c] || 0;
    return { cls: c, value: round(v), pct: total > 0 ? v / total : 0, target: tgt / 100, gap: round(tgt / 100 * total - v) };
  });
  return { total: round(total), rows: rows, targetSum: MIX_CLASSES.reduce(function(s, c){ return s + (Number(t[c]) || 0); }, 0) };
}
// Where the next `amount` goes: to the classes furthest under target once it's in, in proportion
// to how far under each is; anything left (all on target) by the target itself.
export function nextGoesTo(mix, amount){
  var x = Number(amount) || 0;
  if(!(x > 0) || !mix.rows.length) return [];
  var after = mix.total + x;
  var need = mix.rows.map(function(r){ return { cls: r.cls, need: Math.max(0, r.target * after - r.value), target: r.target }; });
  var sumNeed = need.reduce(function(s, n){ return s + n.need; }, 0), sumT = need.reduce(function(s, n){ return s + n.target; }, 0);
  var out = need.map(function(n){
    var amt = sumNeed > 0 ? Math.min(n.need, x * n.need / sumNeed) : (sumT > 0 ? x * n.target / sumT : 0);
    return { cls: n.cls, amount: round(amt) };
  });
  var left = x - out.reduce(function(s, o){ return s + o.amount; }, 0);
  if(left > 0.005 && sumT > 0) out.forEach(function(o, i){ o.amount = round(o.amount + left * need[i].target / sumT); });
  return out.filter(function(o){ return o.amount >= 1; }).sort(function(a, b){ return b.amount - a.amount; });
}

// ---- Distributions in the year ahead ----
// Each payment a holding made in the year to today, a year on — if it still holds units — scaled by
// the units now against the units then. [{ month: "2027-02", total, items: [{ name, date, amount }] }].
export function distributionsAhead(assets, today, unitsOn, toAud){
  var aud = toAud || function(_, n){ return n; };
  var t = dayNum(today), months = {};
  (assets || []).forEach(function(a){
    if(!a || a.category !== "Shares" || !((Number(a.quantity) || 0) > 0)) return;
    (Array.isArray(a.payouts) ? a.payouts : []).forEach(function(p){
      if(!p || !p.date) return;
      var d = dayNum(p.date);
      if(d > t || d <= t - 365) return;
      var dt = new Date(Date.UTC(Number(p.date.slice(0, 4)) + 1, Number(p.date.slice(5, 7)) - 1, Number(p.date.slice(8, 10))));
      var next = dt.toISOString().slice(0, 10); // a 29 February pays on 1 March
      var then = unitsOn ? unitsOn(a, p.date) : 0, now = Number(a.quantity) || 0;
      var amount = aud(a, ((Number(p.cash) || 0) + (Number(p.credit) || 0)) * (then > 0 ? now / then : 1));
      var m = next.slice(0, 7);
      (months[m] = months[m] || []).push({ name: a.what || a.symbol || "Holding", date: next, amount: round(amount) });
    });
  });
  return Object.keys(months).sort().map(function(m){
    var items = months[m].sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    return { month: m, total: round(items.reduce(function(s, i){ return s + i.amount; }, 0)), items: items };
  });
}
