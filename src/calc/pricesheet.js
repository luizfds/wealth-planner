import { appendHistorySnapshot } from "./ledger.js";
import { parseBenchmarkSymbol, setBenchmarkPrice } from "./performance.js";

// ---------------- Share prices from a published Google Sheet (v3.75.0) ----------------
//
// Pasting prices was the only way they moved, so a holding's history only grew on the days someone
// remembered. The price sheet the app already writes (GOOGLEFINANCE formulas) can be shared by
// link instead, and the app reads it on open. The app still never asks a price service anything:
// it reads one sheet the person owns, which holds tickers and prices and nothing about how many
// units anyone holds.
//
// The sheet's layout, as the template writes it:
//   Columns A–B: Symbol | Price — one row per holding, plus USDAUD and benchmark rows, exactly the
//   two columns the paste box has always read.
//   Columns D onwards, two per holding: row 1 the symbol, row 2 a GOOGLEFINANCE weekly-close
//   formula that spills Date | Close downwards. Dates are written by the formula as yyyy-mm-dd
//   text, so the sheet's locale can't turn 03/04 into 4 March.
// Pure: no fetch, no DOM. The component does the fetch and hands the text here.

// The URLs worth trying for whatever link was pasted. A "Publish to web" CSV link is used as is.
// A normal sheet link (shared "anyone with the link can view") goes through the visualisation
// endpoint, which browsers can read across origins; the plain export link redirects to a host that
// doesn't allow that, so it's the last resort.
export function sheetCsvUrls(link){
  var s = String(link || "").trim();
  if(!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(s)) return [];
  if(/\/spreadsheets\/d\/e\//.test(s)){
    var base = s.split("?")[0].replace(/\/pubhtml$/, "/pub");
    var gidP = /[?&#]gid=(\d+)/.exec(s);
    return [base + "?output=csv" + (gidP ? "&gid=" + gidP[1] + "&single=true" : "")];
  }
  var m = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(s);
  if(!m) return [];
  var gid = /[?&#]gid=(\d+)/.exec(s);
  var g = gid ? gid[1] : "0";
  return [
    "https://docs.google.com/spreadsheets/d/" + m[1] + "/gviz/tq?tqx=out:csv&headers=0&gid=" + g,
    "https://docs.google.com/spreadsheets/d/" + m[1] + "/export?format=csv&gid=" + g
  ];
}

export function parseCsvGrid(text){
  var rows = [], row = [], cell = "", q = false;
  text = String(text || "").replace(/^﻿/, "");
  for(var i = 0; i < text.length; i++){
    var ch = text[i];
    if(q){
      if(ch === '"'){ if(text[i + 1] === '"'){ cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if(ch === '"') q = true;
    else if(ch === ","){ row.push(cell); cell = ""; }
    else if(ch === "\n" || ch === "\r"){
      if(ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if(cell !== "" || row.length){ row.push(cell); rows.push(row); }
  return rows;
}

function num(v){
  var s = String(v == null ? "" : v).trim();
  if(!s || /^#/.test(s)) return null;
  var n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}
function cleanSymbol(v){ return String(v || "").trim().replace(/^["']|["']$/g, "").replace(/^[A-Za-z]+:/, "").toUpperCase(); }
function isoDate(v){
  var s = String(v || "").trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
}

// { prices: [{symbol, price}], history: { SYMBOL: [{date, close}] }, unreadable: [symbol] }
export function readPriceSheet(text){
  var grid = parseCsvGrid(text);
  var prices = [], unreadable = [], history = {};
  // The Symbol and Price columns, by their headers when there are any — the older four-column
  // template (What | Market | Symbol | Price) works too.
  var head = (grid[0] || []).map(function(h){ return String(h || "").trim().toLowerCase(); });
  var sc = head.indexOf("symbol"), pc = head.indexOf("price");
  var hasHead = sc !== -1 && pc !== -1;
  if(!hasHead){ sc = 0; pc = 1; }
  grid.forEach(function(r, i){
    if(hasHead && i === 0) return;
    var sym = cleanSymbol(r[sc]);
    // Google's CSV endpoint drops a text header above a column of numbers, so "Symbol" can arrive
    // without "Price" beside it — it's still the header row, not a holding with no price.
    if(!sym || (i === 0 && sym === "SYMBOL")){ return; }
    var p = num(r[pc]);
    if(p == null || !(p > 0)){ unreadable.push(sym); return; }
    prices.push({ symbol: sym, price: p });
  });
  var width = grid.reduce(function(w, r){ return Math.max(w, r.length); }, 0);
  for(var c = Math.max(sc, pc) + 2; c + 1 < width; c += 2){
    var sym = cleanSymbol(grid[0] && grid[0][c]);
    if(!sym) continue;
    var points = [];
    for(var r = 1; r < grid.length; r++){
      var d = isoDate(grid[r][c]), v = num(grid[r][c + 1]);
      if(d && v != null && v > 0) points.push({ date: d, close: v });
    }
    if(points.length) history[sym] = points;
  }
  return { prices: prices, history: history, unreadable: unreadable };
}

// Today's prices onto the holdings, the USD → AUD rate and the benchmark store — the one routine
// both the paste box and the sheet go through, so they can't drift apart.
export function applyPrices(st, prices, today){
  var updated = 0, notFound = [], fxUpdated = false, bench = 0;
  (prices || []).forEach(function(p){
    var bm = parseBenchmarkSymbol(p.symbol);
    if(bm){ if(!st.benchmark.prices) st.benchmark.prices = {}; setBenchmarkPrice(st.benchmark, bm.symbol, bm.date, p.price, today); bench++; return; }
    if(p.symbol === "USDAUD"){ st.fx.usdAud = p.price; st.fx.usdAudUpdated = today; fxUpdated = true; return; }
    var matches = (st.assets || []).filter(function(a){ return a.category === "Shares" && (a.symbol || "").toUpperCase() === p.symbol; });
    if(!matches.length){ notFound.push(p.symbol); return; }
    matches.forEach(function(item){
      item.price = p.price;
      item.priceUpdated = today;
      item.amount = Math.round((Number(item.quantity) || 0) * p.price * 100) / 100;
      if(!Array.isArray(item.history)) item.history = [];
      var d = appendHistorySnapshot(item.history, item.amount, today);
      var e = item.history.find(function(h){ return h.date === d; });
      if(e) e.price = p.price;
      thinPriceHistory(item.history, today);
    });
    updated += matches.length;
  });
  return { updated: updated, notFound: notFound, fxUpdated: fxUpdated, benchmarks: bench };
}

// Units held at the end of a date. With purchase lots, what had been bought by then less what had
// been sold. Without lots there's no purchase date to go on, so it's today's units plus anything
// sold since — the honest best guess, and the Shares page says so.
export function unitsOn(asset, date){
  var sales = Array.isArray(asset.sales) ? asset.sales : [];
  var lots = (Array.isArray(asset.lots) ? asset.lots : []).filter(function(l){ return l.date && Number(l.units) > 0; });
  if(lots.length){
    var bought = lots.reduce(function(s, l){ return l.date <= date ? s + Number(l.units) : s; }, 0);
    var sold = sales.reduce(function(s, x){ return x.date && x.date <= date ? s + (Number(x.units) || 0) : s; }, 0);
    return Math.max(0, bought - sold);
  }
  var later = sales.reduce(function(s, x){ return x.date && x.date > date ? s + (Number(x.units) || 0) : s; }, 0);
  return Math.max(0, (Number(asset.quantity) || 0) + later);
}

// Weekly closes into a holding's history, before its first recorded point only — anything logged
// or pasted is a real observation and stays as it was. Returns how many points were added.
export function backfillHistory(asset, points){
  if(!Array.isArray(asset.history)) asset.history = [];
  var first = asset.history.reduce(function(m, h){ return !m || h.date < m ? h.date : m; }, null);
  var added = 0;
  (points || []).forEach(function(p){
    if(first && p.date >= first) return;
    if(asset.history.some(function(h){ return h.date === p.date; })) return;
    var units = unitsOn(asset, p.date);
    if(!(units > 0)) return;
    asset.history.push({ date: p.date, value: Math.round(units * p.close * 100) / 100, price: p.close, backfill: true });
    added++;
  });
  if(added) asset.history.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return added;
}

export function applyBackfill(st, history, today){
  var added = 0, holdings = 0;
  Object.keys(history || {}).forEach(function(sym){
    (st.assets || []).filter(function(a){ return a.category === "Shares" && (a.symbol || "").toUpperCase() === sym; }).forEach(function(a){
      var n = backfillHistory(a, history[sym]);
      if(n){ added += n; holdings++; }
      if(today) thinPriceHistory(a.history, today);
    });
  });
  return { added: added, holdings: holdings };
}

// The date each holding's backfill should start from: its first purchase lot, or the chosen
// fallback for holdings with no lots.
export function backfillStart(asset, fallback){
  var lots = (Array.isArray(asset.lots) ? asset.lots : []).filter(function(l){ return l.date; }).map(function(l){ return l.date; }).sort();
  return lots[0] || fallback;
}

// Due for a refresh on open: a link is set and it hasn't been read today.
export function sheetRefreshDue(sheet, today){
  return !!(sheet && sheet.url && sheet.lastRead !== today);
}

// ---- Price history thinned as it ages (v3.137.0, item 167) ----
// Each price update adds a point per holding per day, and nothing reads that detail for long: the
// 1D and 1W windows look at recent days, everything else at weeks and months. Price points (those
// carrying a `price` — the daily update, a paste, a sheet, a backfill) are kept every day for
// THIN_DAILY_DAYS, then only the last of each week (weeks start on Monday) until THIN_WEEKLY_DAYS,
// then only the last of each month. Keeping the *last* point keeps every week-end and month-end
// value exactly as it was, since a value on a date reads the latest point at or before it. Points
// without a price — a value someone typed — are never removed. Mutates `history`; returns how many
// points went.
export var THIN_DAILY_DAYS = 90, THIN_WEEKLY_DAYS = 730;
function utcDay(d){ return Date.parse(d + "T00:00:00Z"); }
function mondayOf(d){ var t = utcDay(d); return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); }
// `thinnable(point)` (v3.139.0) says which points may go — by default the ones carrying a price.
export function thinPriceHistory(history, today, thinnable){
  if(!Array.isArray(history) || history.length < 3 || !today) return 0;
  var now = utcDay(today);
  var may = thinnable || function(h){ return h.price != null; };
  var bucket = function(h){
    if(!h || !h.date || !may(h)) return null;
    var age = (now - utcDay(h.date)) / 86400000;
    if(!(age > THIN_DAILY_DAYS)) return null;
    return age > THIN_WEEKLY_DAYS ? "m" + h.date.slice(0, 7) : "w" + mondayOf(h.date);
  };
  var last = {};
  history.forEach(function(h){ var b = bucket(h); if(b && (!last[b] || h.date > last[b])) last[b] = h.date; });
  var kept = history.filter(function(h){ var b = bucket(h); return !b || h.date === last[b]; });
  var removed = history.length - kept.length;
  if(removed){ history.length = 0; Array.prototype.push.apply(history, kept); }
  return removed;
}
