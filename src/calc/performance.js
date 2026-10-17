// Investment performance against a benchmark (v3.35.0). Pure.
//
// The honest comparison isn't "your shares are up 18%, the ASX 200 is up 22%": you didn't put all
// your money in on one day. It's "the same dollars, on the same dates, put into the index instead"
// — every buy buys index units at that day's price, every sale sells index units worth the same
// proceeds, and what's left is valued at today's price. The same flows compounded at a fixed rate
// give a second yardstick that needs no price data at all.
//
// Both sides are price-only: the app doesn't log distributions as cash flows, and GOOGLEFINANCE's
// "close" for an ETF excludes them too, so like is compared with like. Said on screen.

// Flows from Shares holdings that have purchase lots: buys negative (cost incl. brokerage), sales
// positive (proceeds), AUD. `toAud(asset, amount)` converts a holding's native currency.
export function shareFlows(assets, toAud){
  var flows = [], payouts = [], value = 0, included = [], excluded = [];
  (assets || []).forEach(function(a){
    if(a.category !== "Shares") return;
    var lots = (a.lots || []).filter(function(l){ return l.date && Number(l.units) > 0; });
    if(!lots.length){ if(Number(a.amount) > 0) excluded.push(a.what || a.symbol || "a holding"); return; }
    included.push(a.what || a.symbol);
    lots.forEach(function(l){
      var cost = (Number(l.units) || 0) * (Number(l.price) || 0) + (Number(l.brokerage) || 0);
      flows.push({ date: l.date, amount: -toAud(a, cost) });
    });
    (a.sales || []).forEach(function(s){
      if(s.date && Number(s.proceeds) > 0) flows.push({ date: s.date, amount: toAud(a, Number(s.proceeds)) });
    });
    // Distributions received (v3.38.0), cash only — kept apart so the price-only comparison with the
    // index stays like for like, and a with-income return can be worked out alongside it.
    (a.payouts || []).forEach(function(p){
      if(p.date && Number(p.cash) > 0) payouts.push({ date: p.date, amount: toAud(a, Number(p.cash)) });
    });
    value += toAud(a, Number(a.amount) || 0);
  });
  var byDate = function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; };
  flows.sort(byDate);
  payouts.sort(byDate);
  return { flows: flows, payouts: payouts, value: value, included: included, excluded: excluded };
}

function years(from, to){
  return (Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / (365.25 * 86400000);
}
// Money-weighted annual return: the rate r at which the flows plus today's value net to zero.
// Bisection — slower than Newton but it can't wander off on a bad first guess. null when the
// flows don't bracket a root (nothing invested, or under a month of history).
export function xirr(flows, value, today){
  if(!flows.length) return null;
  var first = flows[0].date;
  if(years(first, today) < 1 / 12) return null;
  var npv = function(r){
    var s = value;
    flows.forEach(function(f){ s += f.amount * Math.pow(1 + r, years(f.date, today)); });
    return s;
  };
  var lo = -0.99, hi = 10;
  var flo = npv(lo), fhi = npv(hi);
  if(flo * fhi > 0) return null;
  for(var i = 0; i < 200; i++){
    var mid = (lo + hi) / 2, fm = npv(mid);
    if(Math.abs(fm) < 1e-6) return mid;
    if((fm > 0) === (flo > 0)){ lo = mid; flo = fm; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}
// What the same flows would be worth today compounded at a fixed annual rate.
export function fixedRateValue(flows, rate, today){
  return flows.reduce(function(s, f){ return s - f.amount * Math.pow(1 + rate, years(f.date, today)); }, 0);
}
// What the same flows would be worth in the index. `priceOn(date)` returns the index's close on or
// before that date, or null; `todayPrice` is the latest. Returns {value} or {missing: [dates]}.
export function indexValue(flows, priceOn, todayPrice){
  var missing = [];
  var units = 0;
  flows.forEach(function(f){
    var p = priceOn(f.date);
    if(!(p > 0)){ if(missing.indexOf(f.date) === -1) missing.push(f.date); return; }
    units -= f.amount / p;
  });
  if(!(todayPrice > 0)) missing.push("today");
  if(missing.length) return { missing: missing };
  return { value: units * todayPrice, units: units };
}
// The dates an index price is needed for — every flow date, once.
export function priceDatesNeeded(flows){
  var seen = {};
  return flows.map(function(f){ return f.date; }).filter(function(d){ if(seen[d]) return false; seen[d] = true; return true; });
}

// ---------------- Benchmark price store (state.benchmark.prices[symbol]) ----------------
// A pasted row's symbol is "IOZ@2024-03-01" (close on or before that date) or "IOZ@NOW".
export function parseBenchmarkSymbol(sym){
  var m = /^([A-Z0-9.]+)@(NOW|\d{4}-\d{2}-\d{2})$/.exec(String(sym || "").toUpperCase());
  return m ? { symbol: m[1], date: m[2] === "NOW" ? "now" : m[2] } : null;
}
export function setBenchmarkPrice(benchmark, symbol, date, price, today){
  if(!benchmark.prices[symbol]) benchmark.prices[symbol] = {};
  var p = benchmark.prices[symbol];
  if(price === "" || price == null || !(Number(price) > 0)){ delete p[date]; if(date === "now") delete p.nowDate; return; }
  p[date] = Number(price);
  if(date === "now") p.nowDate = today;
}
// The close on or before `date` from what's stored — a price pasted for 3 March serves a buy on
// 3 March only; this doesn't borrow a neighbour's, it reads the exact date the template asked for.
export function benchmarkPriceOn(benchmark, symbol, date){
  var p = benchmark && benchmark.prices && benchmark.prices[symbol];
  return p && p[date] > 0 ? p[date] : null;
}
// The GOOGLEFINANCE formula for the last close on or before a date: a week's window ending that
// day, last row. Weekends and public holidays fall back to the previous trading day.
export function benchmarkFormula(symbol, date){
  var t = '"ASX:' + symbol + '"';
  if(date === "now") return '=GOOGLEFINANCE(' + t + ',"price")';
  var y = +date.slice(0, 4), m = +date.slice(5, 7), d = +date.slice(8, 10);
  var range = 'GOOGLEFINANCE(' + t + ',"close",DATE(' + y + ',' + m + ',' + d + ')-7,DATE(' + y + ',' + m + ',' + d + ')+1)';
  return '=INDEX(' + range + ',ROWS(' + range + '),2)';
}
