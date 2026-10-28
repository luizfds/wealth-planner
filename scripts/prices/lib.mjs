// The price file's pure parts (v3.133.0): reading each source's answer, and merging a day's results
// into the files the app reads. No network, no file system — scripts/prices/fetch.mjs does that.
//
// latest.json: { updated, prices: { "ASX:VAS": { close, date }, "US:AAPL": { close, date } } }
// weekly.json: { updated, weekly: { "ASX:VAS": [[date, close], …] } }   (five years, oldest first)

export var KEEP_WEEKS = 262;
export var STALE_DAYS = 10;

// Stooq's daily/weekly CSV: Date,Open,High,Low,Close,Volume — oldest first. [[date, close]].
export function parseStooqCsv(text){
  var lines = String(text || "").trim().split(/\r?\n/);
  if(!lines.length || !/^date,/i.test(lines[0])) return [];
  var head = lines[0].toLowerCase().split(","), ci = head.indexOf("close");
  return lines.slice(1).map(function(l){ var c = l.split(","); return [c[0], Number(c[ci])]; })
    .filter(function(r){ return /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && r[1] > 0; });
}

// Twelve Data's time_series answer: { status: "ok", values: [{ datetime, close }] } newest first.
// [[date, close]] oldest first, or null when it's an error ({ status: "error", code, message }).
export function parseTwelveData(json){
  if(!json || json.status !== "ok" || !Array.isArray(json.values)) return null;
  return json.values.map(function(v){ return [String(v.datetime).slice(0, 10), Number(v.close)]; })
    .filter(function(r){ return /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && r[1] > 0; }).reverse();
}

function daysBetween(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

// Today's results into the two files. fresh: { "ASX:VAS": { weekly: [[date, close]], latest: { close, date } } }.
// A ticker that failed today keeps yesterday's price while it's under STALE_DAYS old, then drops out —
// a stale price is worse than none, because the app would show it as today's.
export function mergeFiles(prevLatest, prevWeekly, fresh, today){
  var prices = {}, weekly = {};
  var oldP = (prevLatest && prevLatest.prices) || {}, oldW = (prevWeekly && prevWeekly.weekly) || {};
  Object.keys(oldP).forEach(function(k){ if(oldP[k] && oldP[k].date && daysBetween(oldP[k].date, today) <= STALE_DAYS) prices[k] = oldP[k]; });
  Object.keys(oldW).forEach(function(k){ weekly[k] = oldW[k]; });
  Object.keys(fresh || {}).forEach(function(k){
    var f = fresh[k];
    if(f.latest && f.latest.close > 0) prices[k] = { close: Math.round(f.latest.close * 10000) / 10000, date: f.latest.date };
    if(f.weekly && f.weekly.length) weekly[k] = f.weekly.slice(-KEEP_WEEKS).map(function(r){ return [r[0], Math.round(r[1] * 10000) / 10000]; });
  });
  var sorted = function(o){ var out = {}; Object.keys(o).sort().forEach(function(k){ out[k] = o[k]; }); return out; };
  return { latest: { updated: today, prices: sorted(prices) }, weekly: { updated: today, weekly: sorted(weekly) } };
}

// The latest close from a weekly series: the last bar (the week to date).
export function latestFromWeekly(rows){ var r = rows && rows[rows.length - 1]; return r ? { close: r[1], date: r[0] } : null; }

// Stooq writes US tickers lower-case with ".us", and class shares with a hyphen (brk-b.us).
export function stooqSymbol(t){ return t.toLowerCase().replace(/\./g, "-") + ".us"; }

// Twelve Data writes class shares with a dot (BRK.B); the universe keeps Stooq's hyphen.
export function twelveSymbol(t){ return t.replace(/-/g, "."); }

// Yahoo Finance's chart answer (v8/finance/chart/<SYMBOL>.AX?range=5y&interval=1wk):
// { chart: { result: [{ meta: { gmtoffset, regularMarketPrice, regularMarketTime }, timestamp: [...],
//   indicators: { quote: [{ close: [...] }] } }], error } }. Times are UTC seconds, so each is moved
// by the exchange's offset before taking its date (a Sydney Monday opens on Sunday, UTC). Closes can
// be null (a week with no trade); the week to date can repeat a date. → { weekly, latest } or null.
export function parseYahooChart(json){
  var res = json && json.chart && json.chart.result && json.chart.result[0];
  if(!res || !Array.isArray(res.timestamp)) return null;
  var meta = res.meta || {}, off = Number(meta.gmtoffset) || 0;
  var closes = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
  var day = function(ts){ return new Date((Number(ts) + off) * 1000).toISOString().slice(0, 10); };
  var byDate = {};
  res.timestamp.forEach(function(ts, i){ var c = Number(closes[i]); if(closes[i] != null && c > 0) byDate[day(ts)] = c; });
  var weekly = Object.keys(byDate).sort().map(function(d){ return [d, byDate[d]]; });
  if(!weekly.length) return null;
  var price = Number(meta.regularMarketPrice);
  var latest = price > 0 && meta.regularMarketTime ? { close: price, date: day(meta.regularMarketTime) } : latestFromWeekly(weekly);
  return { weekly: weekly, latest: latest };
}
