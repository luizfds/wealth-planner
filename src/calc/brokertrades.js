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
  return String(v || "").trim().toUpperCase().replace(/\s*\/\s*(AUD|USD|USDT|USDC)$/, "").replace(/^(ASX|NYSE|NASDAQ|CXA|CHIA)[:.\s]+/, "").replace(/[.:](AX|ASX|AU|US)$/, "").replace(/\s.*$/, "");
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
  code: /^(code|symbol|ticker|security|stock|instrument|asx ?code|stock ?code|security ?code|market|coin|asset)$/,
  side: /^(side|type|action|buy ?\/ ?sell|transaction ?type|order ?type|direction|trade ?type)$/,
  units: /^(quantity|units|qty|shares|volume|no\.? ?of ?units|number ?of ?shares|filled ?quantity)$/,
  price: /^(price|unit ?price|avg\.? ?price|average ?price|execution ?price|effective ?price|fill ?price|trade ?price|price ?\(?\$?\)?)$/,
  fee: /^(brokerage|fee|fees|commission|brokerage ?\(?\$?\)?|brokerage ?\+ ?gst|fees ?\(?\$?\)?)$/,
  gst: /^(gst|gst ?\(?\$?\)?|tax on fees)$/,
  value: /^(value|amount|consideration|total|net ?amount|trade ?value|gross ?amount|total ?value)$/,
  details: /^(details|description|narrative)$/,
  // v3.97.0: a crypto exchange's order history (CoinSpot's): Amount is the coins, the rate before
  // its fee is the price, and the fee in dollars already includes its GST.
  rateEx: /^rate ex\.? ?fee$/, feeAud: /^fee aud/,
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
export function parseTrades(text){ return parseTradesGrid(parseCsvGrid(text)); }
// Several tables at once (a spreadsheet's sheets: Stake puts ASX and US trades on separate ones).
export function parseTradeSheets(grids){
  var all = { trades: [], skipped: 0, format: null };
  (grids || []).forEach(function(g){
    var r = parseTradesGrid(g);
    if(!r.format) return;
    all.trades = all.trades.concat(r.trades);
    all.skipped += r.skipped;
    all.format = all.format || r.format;
  });
  all.trades.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : a.side === "buy" ? -1 : 1; });
  return all;
}
export function parseTradesGrid(rawGrid){
  var grid = (rawGrid || []).map(function(r){ return (r || []).map(function(c){ return c == null ? "" : String(c); }); })
    .filter(function(r){ return r.some(function(c){ return String(c).trim(); }); });
  var hi = -1, idx = null;
  for(var i = 0; i < Math.min(grid.length, 15); i++){
    var t = headerIndex(grid[i]);
    if(t.date != null && (t.details != null || (t.code != null && (t.units != null || (t.rateEx != null && t.value != null))))){ hi = i; idx = t; break; }
  }
  if(hi === -1) return { trades: [], skipped: grid.length, format: null };
  var trades = [], skipped = 0;
  var commsec = idx.details != null && idx.code == null;
  if(idx.rateEx != null){ idx.units = idx.value; idx.value = null; idx.price = idx.rateEx; idx.fee = idx.feeAud != null ? idx.feeAud : idx.fee; idx.gst = null; }
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
    // Brokerage is a cost base item with its GST: a separate GST column (Stake's) is added to it.
    var fe = (idx.fee != null ? Math.abs(num(r[idx.fee]) || 0) : 0) + (idx.gst != null ? Math.abs(num(r[idx.gst]) || 0) : 0);
    trades.push({ date: date, code: code, side: sd, units: u, price: Math.round(p * 1e6) / 1e6, brokerage: r2(fe) });
  });
  trades.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : a.side === "buy" ? -1 : 1; });
  return { trades: trades, skipped: skipped, format: commsec ? "CommSec" : idx.rateEx != null ? "crypto exchange" : "columns" };
}

// The holdings a code could mean: shares holdings with that symbol, in the order they're listed.
export function holdingsFor(assets, code){
  var out = [];
  (assets || []).forEach(function(a, i){ if(a && a.category === "Shares" && String(a.symbol || "").toUpperCase() === code) out.push(i); });
  return out;
}
// A holding's units are often typed to four decimals while the broker keeps eight (fractional US
// shares): within half a ten-thousandth, the lots and the holding agree.
var UNIT_TOL = 0.00005;
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
    // A sale already recorded (typed in, or from a tax return) whose parcels aren't tied to any lot
    // hasn't used up a lot yet: the buys read now are what it sold, so it counts against them.
    var unlinked = sales.filter(function(sa){ return list.some(function(t){ return t.side === "sell" && sameSale(sa, t); }) && !(sa.parcels || []).some(function(pc){ return pc.lotId && lots.some(function(l){ return l.id === pc.lotId; }); }); });
    // In date order, as applyTrades will do it: a sale can only use what was bought before it.
    var pool = lots.filter(function(l){ return lotRemainingUnits(l) > 0; }).map(function(l){ return { date: l.date || "", left: lotRemainingUnits(l) }; })
      .concat(newBuys.map(function(t){ return { date: t.date, left: t.units }; }));
    var outs = newSales.map(function(t){ return { date: t.date, units: t.units }; })
      .concat(newBuys.length ? unlinked.map(function(sa){ return { date: sa.date || "", units: Number(sa.units) || 0 }; }) : []);
    pool.sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    outs.sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    var short = 0;
    outs.forEach(function(o){
      var need = o.units;
      pool.forEach(function(lp){ if(need <= 1e-12 || lp.date > o.date || lp.left <= 0) return; var take = Math.min(lp.left, need); lp.left -= take; need -= take; });
      short += Math.max(0, need);
    });
    var after = Math.round(pool.reduce(function(s, lp){ return s + lp.left; }, 0) * 1e6) / 1e6;
    short = Math.round(short * 1e8) / 1e8;
    var held = a ? Number(a.quantity) || 0 : 0;
    var problem = !hs.length ? "No holding with this code — add it on Shares first, or leave it out."
      : short > UNIT_TOL ? "A sale used " + short + " more units than had been bought before it — something bought or transferred in isn't in this file, so that part of the sale has no cost base."
      : a && Math.abs(after - held) > UNIT_TOL ? "After this the lots hold " + after + " units; the holding shows " + held + "." : "";
    return { code: code, holdings: hs, target: target, buys: list.filter(function(t){ return t.side === "buy"; }).length, sells: list.filter(function(t){ return t.side === "sell"; }).length,
      newBuys: newBuys, newSales: newSales, linkSales: newBuys.length ? unlinked : [], lotsAfter: after, short: short, held: held, problem: problem };
  });
}

// Writes a plan's new lots and sales onto the holdings. Sales take FIFO from the lots as they stood
// on the sale date; the units held aren't changed. Returns { lots, sales }.
export function applyTrades(assets, plan, idFactory){
  var lotsAdded = 0, salesAdded = 0, linked = 0;
  plan.forEach(function(p){
    if(p.target == null) return;
    var a = assets[p.target];
    if(!a) return;
    if(!Array.isArray(a.lots)) a.lots = [];
    if(!Array.isArray(a.sales)) a.sales = [];
    p.newBuys.forEach(function(t){
      a.lots.push({ id: idFactory ? idFactory() : "lot" + Math.random().toString(36).slice(2), date: t.date, units: t.units, price: t.price, brokerage: t.brokerage, soldUnits: 0, imported: true });
      lotsAdded++;
    });
    a.lots.sort(function(x, y){ return (x.date || "").localeCompare(y.date || ""); });
    // Sales already there: use up the lots they sold, oldest first, and tie each parcel to its lot.
    (p.linkSales || []).slice().sort(function(x, y){ return (x.date || "").localeCompare(y.date || ""); }).forEach(function(sa){
      var need = Number(sa.units) || 0;
      var hadParcels = Array.isArray(sa.parcels) && sa.parcels.length;
      var parcels = [];
      a.lots.forEach(function(l){
        if(need <= 1e-9 || !l.date || l.date > sa.date) return;
        var rem = lotRemainingUnits(l);
        if(rem <= 0) return;
        var take = Math.min(rem, need);
        var cost = ((Number(l.units) || 0) * (Number(l.price) || 0) + (Number(l.brokerage) || 0)) * take / (Number(l.units) || 1);
        parcels.push({ lotId: l.id, acquired: l.date, units: take, costBase: r2(cost) });
        l.soldUnits = Math.round(((Number(l.soldUnits) || 0) + take) * 1e8) / 1e8;
        need = Math.round((need - take) * 1e8) / 1e8;
      });
      // The recorded cost base stands (it may be what was lodged); only the link to the lots is new.
      if(!hadParcels){ sa.parcels = parcels; sa.costBase = r2(parcels.reduce(function(s, x){ return s + x.costBase; }, 0)); if(parcels.length) sa.acquired = parcels[0].acquired; }
      else sa.parcels.forEach(function(pc){ var m = parcels.find(function(x){ return x.acquired === pc.acquired && !x.used; }); if(m){ pc.lotId = m.lotId; m.used = true; } });
      linked++;
    });
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
    // Avg cost follows the lots only when they account for every unit held — a holding partly
    // bought elsewhere keeps the average it had, which covers all of its units.
    var unsold = a.lots.reduce(function(s, l){ return s + lotRemainingUnits(l); }, 0);
    var avg = lotsAverageCost(a);
    if(avg != null && Math.abs(unsold - (Number(a.quantity) || 0)) <= UNIT_TOL) a.avgCost = avg;
  });
  return { lots: lotsAdded, sales: salesAdded, linked: linked };
}
