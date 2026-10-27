// ---------------- Investment reports (v3.121.0) ----------------
//
// Investments → Performance answers "how is the portfolio doing" as one number. A report wants it
// holding by holding, the income year by year, and the tax side parcel by parcel:
//   holdingReturns   — cost, value, unrealised and realised gain, income, and an annualised return
//                      for each holding beside the same dollars in the benchmark (the index, when its
//                      prices are in, else the fixed rate)
//   distributionYears — cash and franking credits by financial year, holding by holding
//   cgtParcels        — every parcel sold (with the 12-month discount) and every parcel still held
//                      (with the date its discount starts and the gain if it were sold today)
// Pure: assets and the benchmark come in as arguments; toAud converts a USD holding's figures.
import { lotCost, lotRemainingUnits, qualifiesForCgtDiscount, CGT_DISCOUNT_MIN_DAYS } from "./tax.js";
import { xirr, fixedRateValue, indexValue, benchmarkPriceOn } from "./performance.js";
import { MARKET_CURRENCY } from "../constants.js";

function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function fyOf(iso){ var y = Number(String(iso).slice(0, 4)), m = Number(String(iso).slice(5, 7)); return m >= 7 ? y : y - 1; }
function fyName(fy){ return "FY" + String(fy % 100).padStart(2, "0") + "/" + String((fy + 1) % 100).padStart(2, "0"); }
function byDate(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; }
function same(a, v){ return v; }
function addDays(iso, n){ var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function isShares(a){ return a && a.category === "Shares"; }
function nameOf(a){ return a.what || a.symbol || "Holding"; }

// One row per holding. opts: { today, toAud(asset, amount), benchmark: state.benchmark }.
export function holdingReturns(assets, opts){
  opts = opts || {};
  var today = opts.today, toAud = opts.toAud || same, bm = opts.benchmark || {};
  var sym = bm.symbol || "", rate = (Number(bm.fixedRate) || 0) / 100;
  var store = (bm.prices && bm.prices[sym]) || {};
  var rows = [];
  (assets || []).forEach(function(a){
    if(!isShares(a)) return;
    var lots = (a.lots || []).filter(function(l){ return l.date && Number(l.units) > 0; });
    var flows = lots.map(function(l){ return { date: l.date, amount: -toAud(a, lotCost(l)) }; });
    (a.sales || []).forEach(function(s){ if(s.date && Number(s.proceeds) > 0) flows.push({ date: s.date, amount: toAud(a, Number(s.proceeds)) }); });
    var pays = (a.payouts || []).filter(function(p){ return p.date; });
    var income = pays.reduce(function(s, p){ return s + toAud(a, (Number(p.cash) || 0) + (Number(p.credit) || 0)); }, 0);
    var qty = Number(a.quantity) || 0;
    var value = toAud(a, qty > 0 && Number(a.price) > 0 ? qty * Number(a.price) : Number(a.amount) || 0);
    var cost = lots.reduce(function(s, l){ var u = Number(l.units) || 0; return s + (u ? toAud(a, lotCost(l)) * lotRemainingUnits(l) / u : 0); }, 0);
    if(!lots.length) cost = toAud(a, (Number(a.avgCost) || 0) * qty);
    var realised = (a.sales || []).reduce(function(s, x){ return s + toAud(a, (Number(x.proceeds) || 0) - (Number(x.costBase) || 0)); }, 0);
    if(!(qty > 0) && !income && !realised) return;
    flows.sort(byDate);
    var withIncome = flows.concat(pays.filter(function(p){ return Number(p.cash) > 0; }).map(function(p){ return { date: p.date, amount: toAud(a, Number(p.cash)) }; })).sort(byDate);
    var mine = flows.length ? xirr(withIncome, value, today) : null;
    // The same flows in the index (price only, like for like with the holding's price-only rate),
    // or compounded at the fixed rate when the index prices aren't in.
    var idx = flows.length && sym ? indexValue(flows, function(d){ return benchmarkPriceOn(bm, sym, d); }, store.now) : null;
    var benchRate = idx && idx.value != null ? xirr(flows, idx.value, today) : (flows.length ? rate : null);
    var priceOnly = flows.length ? xirr(flows, value, today) : null;
    var gain = cost > 0 ? value - cost : null;
    rows.push({ name: nameOf(a), symbol: a.symbol || "", currency: MARKET_CURRENCY[a.market] || "AUD", cost: r2(cost), value: r2(value),
      gain: gain == null ? null : r2(gain), income: r2(income), realised: r2(realised),
      total: r2((gain || 0) + income + realised), annual: mine, priceOnly: priceOnly, bench: benchRate,
      benchKind: idx && idx.value != null ? sym : "fixed", since: flows.length ? flows[0].date : null });
  });
  rows.sort(function(x, y){ return y.value - x.value; });
  var allFlows = [], allValue = 0, allPayouts = [];
  (assets || []).forEach(function(a){
    if(!isShares(a)) return;
    (a.lots || []).forEach(function(l){ if(l.date && Number(l.units) > 0) allFlows.push({ date: l.date, amount: -toAud(a, lotCost(l)) }); });
    (a.sales || []).forEach(function(s){ if(s.date && Number(s.proceeds) > 0) allFlows.push({ date: s.date, amount: toAud(a, Number(s.proceeds)) }); });
    (a.payouts || []).forEach(function(p){ if(p.date && Number(p.cash) > 0) allPayouts.push({ date: p.date, amount: toAud(a, Number(p.cash)) }); });
    if((a.lots || []).length) allValue += toAud(a, Number(a.quantity) > 0 && Number(a.price) > 0 ? Number(a.quantity) * Number(a.price) : Number(a.amount) || 0);
  });
  allFlows.sort(byDate);
  var idxAll = allFlows.length && sym ? indexValue(allFlows, function(d){ return benchmarkPriceOn(bm, sym, d); }, store.now) : null;
  var sum = function(k){ return r2(rows.reduce(function(s, r){ return s + (r[k] || 0); }, 0)); };
  return { rows: rows, total: { cost: sum("cost"), value: sum("value"), gain: sum("gain"), income: sum("income"), realised: sum("realised"), total: sum("total"),
    annual: allFlows.length ? xirr(allFlows.concat(allPayouts).sort(byDate), allValue, today) : null,
    bench: idxAll && idxAll.value != null ? xirr(allFlows, idxAll.value, today) : (allFlows.length ? rate : null),
    benchKind: idxAll && idxAll.value != null ? sym : "fixed" }, fixedRate: rate, symbol: sym };
}

// Distributions by financial year, newest first: { fy, label, cash, credit, total, holdings: [{ name, cash, credit, total }] }.
export function distributionYears(assets, toAud){
  toAud = toAud || same;
  var by = {};
  (assets || []).forEach(function(a){
    if(!isShares(a)) return;
    (a.payouts || []).forEach(function(p){
      if(!p.date) return;
      var fy = fyOf(p.date);
      var y = by[fy] = by[fy] || { fy: fy, label: fyName(fy), cash: 0, credit: 0, h: {} };
      var c = toAud(a, Number(p.cash) || 0), cr = toAud(a, Number(p.credit) || 0);
      y.cash += c; y.credit += cr;
      var h = y.h[nameOf(a)] = y.h[nameOf(a)] || { name: nameOf(a), cash: 0, credit: 0 };
      h.cash += c; h.credit += cr;
    });
  });
  return Object.keys(by).map(Number).sort(function(a, b){ return b - a; }).map(function(fy){
    var y = by[fy];
    return { fy: fy, label: y.label, cash: r2(y.cash), credit: r2(y.credit), total: r2(y.cash + y.credit),
      holdings: Object.keys(y.h).map(function(k){ var h = y.h[k]; return { name: h.name, cash: r2(h.cash), credit: r2(h.credit), total: r2(h.cash + h.credit) }; })
        .sort(function(a, b){ return b.total - a.total; }) };
  });
}

// The year's net capital gain the way the return works it out: losses come off gains that don't
// get the discount first, then off discountable ones, and half of what's left of those is taxed.
export function netCapitalGain(parcels){
  var other = 0, disc = 0, loss = 0;
  parcels.forEach(function(p){ if(p.gain < 0) loss -= p.gain; else if(p.discount) disc += p.gain; else other += p.gain; });
  var gains = other + disc, losses = loss;
  var fromOther = Math.min(other, loss); other -= fromOther; loss -= fromOther;
  var fromDisc = Math.min(disc, loss); disc -= fromDisc; loss -= fromDisc;
  return { gains: r2(gains), losses: r2(losses), net: r2(other + disc / 2), carriedLoss: r2(loss) };
}

// { realised: [{ fy, label, parcels: [...], net }], unrealised: [...] }. A parcel: { name, acquired, sold,
// units, proceeds, cost, gain, discount, taxable } (sold) or { name, acquired, units, cost, value, gain,
// discountFrom, discount, taxable } (held). today decides which held parcels are past 12 months.
export function cgtParcels(assets, opts){
  opts = opts || {};
  var today = opts.today, toAud = opts.toAud || same;
  var byFy = {}, held = [];
  (assets || []).forEach(function(a){
    if(!isShares(a)) return;
    (a.sales || []).forEach(function(s){
      if(!s.date) return;
      var units = Number(s.units) || 0, proceeds = Number(s.proceeds) || 0;
      var parts = Array.isArray(s.parcels) && s.parcels.length ? s.parcels : [{ acquired: s.acquired || "", units: units, costBase: Number(s.costBase) || 0 }];
      parts.forEach(function(pc){
        var share = units > 0 ? (Number(pc.units) || 0) / units : 1;
        var pr = toAud(a, proceeds * share), cost = toAud(a, Number(pc.costBase) || 0), gain = pr - cost;
        var disc = !!pc.acquired && qualifiesForCgtDiscount(pc.acquired, s.date);
        var fy = fyOf(s.date);
        (byFy[fy] = byFy[fy] || []).push({ name: nameOf(a), acquired: pc.acquired || "", sold: s.date, units: Number(pc.units) || 0,
          proceeds: r2(pr), cost: r2(cost), gain: r2(gain), discount: disc, taxable: r2(gain > 0 && disc ? gain / 2 : gain) });
      });
    });
    var price = Number(a.price) || 0;
    (a.lots || []).forEach(function(l){
      var rem = lotRemainingUnits(l), u = Number(l.units) || 0;
      if(!(rem > 0) || !u || !l.date) return;
      var cost = toAud(a, lotCost(l) * rem / u), value = price > 0 ? toAud(a, price * rem) : null;
      var gain = value == null ? null : value - cost;
      var from = addDays(l.date, CGT_DISCOUNT_MIN_DAYS);
      var disc = !!today && qualifiesForCgtDiscount(l.date, today);
      held.push({ name: nameOf(a), acquired: l.date, units: rem, cost: r2(cost), value: value == null ? null : r2(value), gain: gain == null ? null : r2(gain),
        discountFrom: from, discount: disc, taxable: gain == null ? null : r2(gain > 0 && disc ? gain / 2 : gain) });
    });
  });
  held.sort(function(x, y){ return x.discountFrom < y.discountFrom ? -1 : x.discountFrom > y.discountFrom ? 1 : 0; });
  return {
    realised: Object.keys(byFy).map(Number).sort(function(a, b){ return b - a; }).map(function(fy){
      var ps = byFy[fy].sort(function(x, y){ return x.sold < y.sold ? -1 : x.sold > y.sold ? 1 : 0; });
      return { fy: fy, label: fyName(fy), parcels: ps, net: netCapitalGain(ps) };
    }),
    unrealised: held
  };
}
