import { parseCsvGrid } from "./pricesheet.js";
import { lotsAverageCost, lotRemainingUnits } from "./tax.js";

// ---------------- A broker's trade history into purchase lots (v3.91.0) ----------------
//
// Purchase lots are what capital gains and a holding's real history stand on, and typing every
// trade from old contract notes is the reason most holdings have none. Brokers export the trades:
//   CommSec's Transactions CSV — Date, Reference, Details ("B 100 IVV @ 41.250000"), Debit, Credit
//   everyone else (Stake, SelfWealth, Pearler, a spreadsheet) — a column each for the date, code,
//   buy/sell, units and price, and usually brokerage; the headers vary, so they're matched by name.
// Each buy becomes a lot; each sell, taken first-in first-out from the lots in date order, becomes
// a recorded sale — without touching the units held, which are already today's. A trade already
// there (same date, units and price) is skipped, so the same file can be read twice. Pure.

var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function pad(n){ return String(n).padStart(2, "0"); }
export function tradeDate(v){
  var s = String(v || "").trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if(m) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
  if(m){ var y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + pad(m[2]) + "-" + pad(m[1]); }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2,4})/.exec(s);
  if(m && MONTHS[m[2].toLowerCase()]){ var yy = m[3].length === 2 ? "20" + m[3] : m[3]; return yy + "-" + pad(MONTHS[m[2].toLowerCase()]) + "-" + pad(m[1]); }
  return null;
}
function num(v){
  var s = String(v == null ? "" : v).trim();
  if(!s) return null;
  var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  var n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : (neg ? -n : n);
}
export function cleanCode(v){
  return String(v || "").trim().toUpperCase().replace(/^(ASX|NYSE|NASDAQ|CXA|CHIA)[:.\s]+/, "").replace(/[.:](AX|ASX|AU|US)$/, "").replace(/\s.*$/, "");
}
function sideOf(v){
  var s = String(v || "").trim().toLowerCase();
  if(/^(b|buy|bought|purchase|purchased|buy order|market buy|limit buy)\b/.test(s) || s === "buy") return "buy";
  if(/^(s|sell|sold|sale|sell order|market sell|limit sell)\b/.test(s)) return "sell";
  if(/\bbuy\b/.test(s)) return "buy";
  if(/\bsell\b/.test(s)) return "sell";
  return null;
}
function r2(n){ return Math.round(n * 100) / 100; }

var COLS = {
  date: /^(trade ?date|date|settlement ?date|time|date ?\/ ?time|executed|execution ?date|transaction ?date)$/,
  code: /^(code|symbol|ticker|security|stock|instrument|asx ?code|stock ?code|security ?code)$/,
  side: /^(side|type|action|buy ?\/ ?sell|transaction ?type|order ?type|direction|trade ?type)$/,
  units: /^(quantity|units|qty|shares|volume|no\.? ?of ?units|number ?of ?shares|filled ?quantity)$/,
  price: /^(price|unit ?price|avg\.? ?price|average ?price|execution ?price|effective ?price|fill ?price|trade ?price|price ?\(?\$?\)?)$/,
  fee: /^(brokerage|fee|fees|commission|brokerage ?\(?\$?\)?|brokerage ?\+ ?gst|fees ?\(?\$?\)?)$/,
  value: /^(value|amount|consideration|total|net ?amount|trade ?value|gross ?amount|total ?value)$/,
  details: /^(details|description|narrative)$/,
  debit: /^debit/, credit: /^credit/
};
function headerIndex(row){
  var idx = {};
  row.forEach(function(h, i){
    var k = String(h || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*\(\$\)$/, "");
    Object.keys(COLS).forEach(function(c){ if(idx[c] == null && COLS[c].test(k)) idx[c] = i; });
  });
  return idx;
}

// { trades: [{date, code, side, units, price, brokerage}], skipped: n, format }
export function parseTrades(text){
  var grid = parseCsvGrid(text).filter(function(r){ return r.some(function(c){ return String(c).trim(); }); });
  var hi = -1, idx = null;
  for(var i = 0; i < Math.min(grid.length, 15); i++){
    var t = headerIndex(grid[i]);
    if(t.date != null && (t.details != null || (t.code != null && t.units != null))){ hi = i; idx = t; break; }
  }
  if(hi === -1) return { trades: [], skipped: grid.length, format: null };
  var trades = [], skipped = 0;
  var commsec = idx.details != null && idx.code == null;
  grid.slice(hi + 1).forEach(function(r){
    var date = tradeDate(r[idx.date]);
    if(!date){ skipped++; return; }
    if(commsec){
      // "B 100 IVV @ 41.250000" / "S 25 CBA @ 118.40". Anything else (deposits, interest) isn't a trade.
      var m = /^\s*([BS])\s+([\d,.]+)\s+([A-Z0-9.]+)\s+@\s+([\d,.]+)/i.exec(String(r[idx.details] || ""));
      if(!m){ skipped++; return; }
      var side = m[1].toUpperCase() === "B" ? "buy" : "sell";
      var units = num(m[2]), price = num(m[4]);
      var gross = units * price;
      var cash = side === "buy" ? Math.abs(num(r[idx.debit]) || 0) : Math.abs(num(r[idx.credit]) || 0);
      var fee = cash ? Math.max(0, side === "buy" ? cash - gross : gross - cash) : 0;
      trades.push({ date: date, code: cleanCode(m[3]), side: side, units: units, price: price, brokerage: r2(fee) });
      return;
    }
    var code = cleanCode(r[idx.code]);
    var u = num(r[idx.units]);
    var sd = idx.side != null ? sideOf(r[idx.side]) : null;
    if(!sd && u != null) sd = u < 0 ? "sell" : "buy";
    var p = idx.price != null ? num(r[idx.price]) : null;
    var val = idx.value != null ? num(r[idx.value]) : null;
    u = u == null ? null : Math.abs(u);
    if(p == null && val != null && u) p = Math.abs(val) / u;
    if(!code || !sd || !(u > 0) || !(p > 0)){ skipped++; return; }
    var fe = idx.fee != null ? Math.abs(num(r[idx.fee]) || 0) : 0;
    trades.push({ date: date, code: code, side: sd, units: u, price: Math.round(p * 1e6) / 1e6, brokerage: r2(fe) });
  });
  trades.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : a.side === "buy" ? -1 : 1; });
  return { trades: trades, skipped: skipped, format: commsec ? "CommSec" : "columns" };
}

// The holdings a code could mean: shares holdings with that symbol, in the order they're listed.
export function holdingsFor(assets, code){
  var out = [];
  (assets || []).forEach(function(a, i){ if(a && a.category === "Shares" && String(a.symbol || "").toUpperCase() === code) out.push(i); });
  return out;
}
function sameLot(l, t){ return l.date === t.date && Math.abs((Number(l.units) || 0) - t.units) < 1e-6 && Math.abs((Number(l.price) || 0) - t.price) < 0.0005; }
function sameSale(s, t){ return s.date === t.date && Math.abs((Number(s.units) || 0) - t.units) < 1e-6; }

// Per code: { code, holdings: [asset index], target (index or null), buys, sells, newBuys, newSales,
// lotsAfter (unsold units), held, problem }. choice: { CODE: assetIndex } picks among several.
export function planTrades(assets, trades, choice){
  choice = choice || {};
  var byCode = {};
  trades.forEach(function(t){ (byCode[t.code] = byCode[t.code] || []).push(t); });
  return Object.keys(byCode).sort().map(function(code){
    var list = byCode[code];
    var hs = holdingsFor(assets, code);
    var target = choice[code] != null ? Number(choice[code]) : (hs.length ? hs[0] : null);
    if(target != null && hs.indexOf(target) === -1 && choice[code] !== "skip") target = hs.length ? hs[0] : null;
    if(choice[code] === "skip") target = null;
    var a = target != null ? assets[target] : null;
    var lots = a && Array.isArray(a.lots) ? a.lots : [];
    var sales = a && Array.isArray(a.sales) ? a.sales : [];
    var newBuys = list.filter(function(t){ return t.side === "buy" && !lots.some(function(l){ return sameLot(l, t); }); });
    var newSales = list.filter(function(t){ return t.side === "sell" && !sales.some(function(s){ return sameSale(s, t); }); });
    var bought = lots.reduce(function(s, l){ return s + lotRemainingUnits(l); }, 0) + newBuys.reduce(function(s, t){ return s + t.units; }, 0);
    var sold = newSales.reduce(function(s, t){ return s + t.units; }, 0);
    var after = Math.round((bought - sold) * 1e6) / 1e6;
    var held = a ? Number(a.quantity) || 0 : 0;
    var problem = !hs.length ? "No holding with this code — add it on Shares first, or leave it out."
      : after < -1e-6 ? "Sells more than the file and the lots ever bought — an earlier buy is missing."
      : a && Math.abs(after - held) > 1e-6 ? "After this the lots hold " + after + " units; the holding shows " + held + "." : "";
    return { code: code, holdings: hs, target: target, buys: list.filter(function(t){ return t.side === "buy"; }).length, sells: list.filter(function(t){ return t.side === "sell"; }).length,
      newBuys: newBuys, newSales: newSales, lotsAfter: after, held: held, problem: problem };
  });
}

// Writes a plan's new lots and sales onto the holdings. Sales take FIFO from the lots as they stood
// on the sale date; the units held aren't changed. Returns { lots, sales }.
export function applyTrades(assets, plan, idFactory){
  var lotsAdded = 0, salesAdded = 0;
  plan.forEach(function(p){
    if(p.target == null || p.lotsAfter < -1e-6) return;
    var a = assets[p.target];
    if(!a) return;
    if(!Array.isArray(a.lots)) a.lots = [];
    if(!Array.isArray(a.sales)) a.sales = [];
    p.newBuys.forEach(function(t){
      a.lots.push({ id: idFactory ? idFactory() : "lot" + Math.random().toString(36).slice(2), date: t.date, units: t.units, price: t.price, brokerage: t.brokerage, soldUnits: 0, imported: true });
      lotsAdded++;
    });
    a.lots.sort(function(x, y){ return (x.date || "").localeCompare(y.date || ""); });
    p.newSales.forEach(function(t){
      var need = t.units, parcels = [];
      a.lots.forEach(function(l){
        if(need <= 1e-9 || !l.date || l.date > t.date) return;
        var rem = lotRemainingUnits(l);
        if(rem <= 0) return;
        var take = Math.min(rem, need);
        var cost = ((Number(l.units) || 0) * (Number(l.price) || 0) + (Number(l.brokerage) || 0)) * take / (Number(l.units) || 1);
        parcels.push({ lotId: l.id, acquired: l.date, units: take, costBase: r2(cost) });
        l.soldUnits = Math.round(((Number(l.soldUnits) || 0) + take) * 1e8) / 1e8;
        need = Math.round((need - take) * 1e8) / 1e8;
      });
      var proceeds = r2(t.units * t.price - t.brokerage);
      a.sales.push({ date: t.date, acquired: parcels.length ? parcels[0].acquired : "", units: t.units, proceeds: proceeds,
        costBase: r2(parcels.reduce(function(s, x){ return s + x.costBase; }, 0)), parcels: parcels, imported: true });
      salesAdded++;
    });
    a.sales.sort(function(x, y){ return (y.date || "").localeCompare(x.date || ""); });
    var avg = lotsAverageCost(a);
    if(avg != null) a.avgCost = avg;
  });
  return { lots: lotsAdded, sales: salesAdded };
}
