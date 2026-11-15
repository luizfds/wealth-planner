// ---------------- Pasted share prices: read, review, apply and a guarded Undo (#265) ----------------
//
// Investments → Shares' "paste prices by hand" used to write each line straight onto the holdings as it was
// read: a price of 0 or −3 included (the Google Sheet read has always refused those), a quoted "1,234.50"
// read as 234.50 because the line was split on every comma, two different prices for one ticker resolved
// by whichever came last, an exchange prefix naming another market ignored, and nothing to undo. Now the
// paste is read into a review first (reviewPricePaste), written only from that review (applyPriceReview),
// and taken back only while nothing has priced those holdings since (undoPriceReview).
//
// The writing itself is still applyPrices (calc/pricesheet.js), the one routine the sheet read and the
// paste share. Everything takes the household as `st`; nothing here touches the DOM.
import { parseBenchmarkSymbol } from "./performance.js";
import { applyPrices, parseCsvGrid } from "./pricesheet.js";

// The exchange prefixes GOOGLEFINANCE writes, by the market a holding records. A prefix not listed here
// says nothing about the market and is ignored, as before.
var PREFIX_MARKET = { ASX: "ASX", NASDAQ: "US", NYSE: "US", NYSEARCA: "US", NYSEAMERICAN: "US", AMEX: "US", BATS: "US", CURRENCY: "Crypto" };
// A change bigger than this is flagged for checking — a pasted quantity or a cents figure, say. It is still
// applied: share prices do move that much.
export var BIG_CHANGE = 0.5;

function numberCell(v){
  var s = String(v == null ? "" : v).trim();
  if(!s || /^#/.test(s)) return null;
  // Spaces, currency signs and thousands separators go; anything else that isn't a number is not one.
  var t = s.replace(/[\s$A-Za-z]/g, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if(!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(t)) return null;
  return parseFloat(t);
}
function cellsOf(line){
  if(/\t/.test(line)) return line.split(/\t/);
  if(/,/.test(line)) return parseCsvGrid(line)[0] || [];
  return line.trim().split(/\s+/);
}

// Each non-blank line as { line (1-based), raw, symbol, market (from a prefix, or null), price (or null),
// reason (why it can't be used, or "") }. A "Symbol | Price" header line is skipped.
export function parsePricePaste(text){
  var out = [];
  String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).forEach(function(raw, i){
    if(!raw.trim()) return;
    var cells = cellsOf(raw).map(function(c){ return String(c == null ? "" : c).trim(); }).filter(function(c){ return c !== ""; });
    var first = (cells[0] || "").replace(/^["']|["']$/g, "");
    var pm = /^([A-Za-z]+):(.+)$/.exec(first);
    var market = pm && PREFIX_MARKET[pm[1].toUpperCase()] || null;
    var symbol = (pm ? pm[2] : first).trim().toUpperCase();
    if(!out.length && symbol === "SYMBOL") return;
    var entry = { line: i + 1, raw: raw.trim(), symbol: symbol, market: market, price: null, reason: "" };
    var rest = cells.slice(1), numbers = rest.map(numberCell).filter(function(n){ return n != null; });
    if(!symbol || rest.length === 0) entry.reason = "no price after the ticker";
    else if(numbers.length > 1) entry.reason = "more than one number after the ticker — put the price in its own column, or in quotes";
    else if(numberCell(rest[rest.length - 1]) == null) entry.reason = /#/.test(rest[rest.length - 1]) ? "the sheet hasn't worked out this price (" + rest[rest.length - 1] + ")" : "\"" + rest[rest.length - 1] + "\" isn't a price";
    else if(!(numberCell(rest[rest.length - 1]) > 0)) entry.reason = "a price has to be more than zero";
    else entry.price = numberCell(rest[rest.length - 1]);
    out.push(entry);
  });
  return out;
}

function holdingMarket(a){ return a.market || "ASX"; }
function sharesFor(st, symbol){ return (st.assets || []).filter(function(a){ return a && a.category === "Shares" && (a.symbol || "").toUpperCase() === symbol; }); }

// What the paste would do to this household:
//   updates:  [{ symbol, market, price, holdings: [{ asset, what, person, market, was, change }], big }]
//   fx:       { price, was } or null — a USDAUD line
//   benchmarks: [{ symbol, date, price }]
//   leftOut:  [{ line, symbol, raw, reason }]
// A ticker given two different prices is left out both times; the same price twice counts once.
export function reviewPricePaste(text, st){
  var lines = parsePricePaste(text);
  var priced = {}, leftOut = [];
  lines.forEach(function(l){
    if(l.reason){ leftOut.push({ line: l.line, symbol: l.symbol, raw: l.raw, reason: l.reason }); return; }
    var key = l.symbol + "|" + (l.market || "");
    (priced[key] = priced[key] || []).push(l);
  });
  var updates = [], fx = null, benchmarks = [];
  Object.keys(priced).forEach(function(key){
    var group = priced[key], l = group[0];
    var prices = group.map(function(g){ return g.price; }).filter(function(p, i, a){ return a.indexOf(p) === i; });
    if(prices.length > 1){
      group.forEach(function(g){ leftOut.push({ line: g.line, symbol: g.symbol, raw: g.raw, reason: "two different prices given for " + g.symbol }); });
      return;
    }
    var bm = parseBenchmarkSymbol(l.symbol);
    if(bm){ benchmarks.push({ symbol: bm.symbol, date: bm.date, price: l.price, line: l.line }); return; }
    if(l.symbol === "USDAUD"){ fx = { price: l.price, was: Number(st.fx && st.fx.usdAud) || null, line: l.line }; return; }
    var held = sharesFor(st, l.symbol);
    if(!held.length){ leftOut.push({ line: l.line, symbol: l.symbol, raw: l.raw, reason: "no holding with this ticker" }); return; }
    var markets = held.map(holdingMarket).filter(function(m, i, a){ return a.indexOf(m) === i; });
    var chosen = held;
    if(l.market){
      chosen = held.filter(function(a){ return holdingMarket(a) === l.market; });
      if(!chosen.length){ leftOut.push({ line: l.line, symbol: l.symbol, raw: l.raw, reason: "a " + l.market + " price, but " + l.symbol + " is held on the " + markets.join(" and ") + " — prices aren't converted between markets" }); return; }
    } else if(markets.length > 1){
      leftOut.push({ line: l.line, symbol: l.symbol, raw: l.raw, reason: l.symbol + " is held on the " + markets.join(" and ") + " — add an exchange prefix (ASX:" + l.symbol + ", NASDAQ:" + l.symbol + ") to say which" });
      return;
    }
    var rows = chosen.map(function(a){
      var was = Number(a.price) > 0 ? Number(a.price) : null;
      return { asset: a, what: a.what, person: a.person || "", market: holdingMarket(a), was: was, change: was ? l.price / was - 1 : null };
    });
    updates.push({ symbol: l.symbol, market: l.market || (markets.length === 1 ? markets[0] : null), price: l.price, line: l.line, holdings: rows,
      big: rows.some(function(r){ return r.change != null && Math.abs(r.change) > BIG_CHANGE; }) });
  });
  var byLine = function(a, b){ return a.line - b.line; };
  updates.sort(byLine); benchmarks.sort(byLine); leftOut.sort(byLine);
  return { updates: updates, fx: fx, benchmarks: benchmarks, leftOut: leftOut, household: st };
}

// How many changes a review would make (holdings, the rate and benchmark prices).
export function priceReviewCount(review){
  return review.updates.reduce(function(s, u){ return s + u.holdings.length; }, 0) + (review.fx ? 1 : 0) + review.benchmarks.length;
}

// What the review read from the holdings, to tell at confirm whether they changed since: which holdings,
// in which market, at what price.
export function priceReviewSignature(review){
  return JSON.stringify(review.updates.map(function(u){
    return [u.symbol, u.price, u.holdings.map(function(h){ return [(review.household.assets || []).indexOf(h.asset), h.market, h.was]; })];
  }).concat([review.fx ? ["USDAUD", review.fx.price, review.fx.was] : null]));
}

function holdingState(a){ return JSON.stringify({ price: a.price, priceUpdated: a.priceUpdated, amount: a.amount, history: a.history }); }
function fxState(st){ return JSON.stringify({ usdAud: st.fx && st.fx.usdAud, usdAudUpdated: st.fx && st.fx.usdAudUpdated }); }
function benchState(st){ return JSON.stringify(st.benchmark && st.benchmark.prices || {}); }

// Writes the review's prices through applyPrices and returns what Undo needs: each touched holding, the
// rate and the benchmark store, as they were before and as they are after.
export function applyPriceReview(review, st, today){
  var touched = [];
  review.updates.forEach(function(u){ u.holdings.forEach(function(h){ if(touched.indexOf(h.asset) === -1) touched.push(h.asset); }); });
  var record = {
    household: st,
    holdings: touched.map(function(a){ return { asset: a, before: holdingState(a), after: null }; }),
    fx: review.fx ? { before: fxState(st), after: null } : null,
    bench: review.benchmarks.length ? { before: benchState(st), after: null } : null
  };
  var prices = review.updates.map(function(u){ return { symbol: u.symbol, price: u.price, market: u.market }; })
    .concat(review.fx ? [{ symbol: "USDAUD", price: review.fx.price }] : [])
    .concat(review.benchmarks.map(function(b){ return { symbol: b.symbol + "@" + (b.date === "now" ? "NOW" : b.date), price: b.price }; }));
  var res = applyPrices(st, prices, today);
  record.holdings.forEach(function(h){ h.after = holdingState(h.asset); });
  if(record.fx) record.fx.after = fxState(st);
  if(record.bench) record.bench.after = benchState(st);
  record.result = res;
  return record;
}

// Whether Undo can put the old prices back: { ok } or { ok: false, reason: "replaced" | "changed", changed }.
// Anything that priced one of these holdings (or the rate, or a benchmark) since — the daily price read,
// the sheet, another paste, an edit — counts as changed.
export function checkPriceUndo(record, st){
  if(!record || record.household !== st) return { ok: false, reason: "replaced", changed: 0 };
  var changed = record.holdings.filter(function(h){ return (st.assets || []).indexOf(h.asset) === -1 || holdingState(h.asset) !== h.after; }).length;
  if(record.fx && fxState(st) !== record.fx.after) changed++;
  if(record.bench && benchState(st) !== record.bench.after) changed++;
  return changed ? { ok: false, reason: "changed", changed: changed } : { ok: true };
}

export function undoPriceReview(record, st){
  var check = checkPriceUndo(record, st);
  if(!check.ok) return check;
  record.holdings.forEach(function(h){
    var was = JSON.parse(h.before);
    ["price", "priceUpdated", "amount", "history"].forEach(function(k){ if(was[k] === undefined) delete h.asset[k]; else h.asset[k] = was[k]; });
  });
  if(record.fx){
    var fx = JSON.parse(record.fx.before);
    ["usdAud", "usdAudUpdated"].forEach(function(k){ if(fx[k] === undefined) delete st.fx[k]; else st.fx[k] = fx[k]; });
  }
  if(record.bench) st.benchmark.prices = JSON.parse(record.bench.before);
  return { ok: true };
}
