import { lotsAverageCost, computePersonTax, getTaxPeople } from "./tax.js";
import { toAudAmount } from "./engine.js";
import { fyLabel } from "./property.js";

// ---------------- Investments: performance, distributions, super against the cap (v3.61.0) ----------------
//
// Each holding already carried its cost (lots or an average), its price, its sales and the
// distributions it paid — but nothing added them up into "how is the portfolio doing", and the
// distributions were only visible one holding at a time. Pure apart from reading the tax model.

function fyOf(iso){ var y = Number(String(iso).slice(0, 4)), m = Number(String(iso).slice(5, 7)); return m >= 7 ? y : y - 1; }
function round(n){ return Math.round(n * 100) / 100; }

// Per holding and in total: cost, value, unrealised gain, distributions (in the window and all
// time), realised gains from sales, and total return = gain + distributions + realised.
// win: { start, end } — the period whose distributions count as "this period".
export function portfolioPerformance(assets, win){
  var rows = [];
  (assets || []).forEach(function(a, i){
    if(!a || a.category !== "Shares") return;
    var qty = Number(a.quantity) || 0;
    var avg = lotsAverageCost(a) || Number(a.avgCost) || 0;
    var cost = toAudAmount(a, avg * qty);
    var value = toAudAmount(a, qty > 0 && Number(a.price) > 0 ? Number(a.price) * qty : (Number(a.amount) || 0));
    var pays = Array.isArray(a.payouts) ? a.payouts : [];
    var paid = function(p){ return (Number(p.cash) || 0) + (Number(p.credit) || 0); };
    var incomeAll = pays.reduce(function(s, p){ return s + paid(p); }, 0);
    var incomeWin = pays.filter(function(p){ return win && p.date >= win.start && p.date <= win.end; }).reduce(function(s, p){ return s + paid(p); }, 0);
    var realised = (Array.isArray(a.sales) ? a.sales : []).reduce(function(s, x){
      // A sale records its proceeds (net of brokerage) and the cost base it used (FIFO lots, or typed).
      var proceeds = x.proceeds != null ? Number(x.proceeds) || 0 : (Number(x.units) || 0) * (Number(x.price) || 0);
      var basis = x.costBase != null ? Number(x.costBase) : (Number(x.units) || 0) * avg;
      return s + (proceeds - basis);
    }, 0);
    if(!(qty > 0) && !incomeAll && !realised) return;
    var gain = cost > 0 ? value - cost : 0;
    rows.push({ index: i, name: a.what || a.symbol || "Holding", symbol: a.symbol || "", cost: round(cost), value: round(value), gain: round(gain),
      gainPct: cost > 0 ? gain / cost : null, incomeWindow: round(incomeWin), incomeAll: round(incomeAll), realised: round(realised),
      totalReturn: round(gain + incomeAll + realised), totalReturnPct: cost > 0 ? (gain + incomeAll + realised) / cost : null, hasCost: cost > 0 });
  });
  var sum = function(k){ return round(rows.reduce(function(s, r){ return s + r[k]; }, 0)); };
  var costed = rows.filter(function(r){ return r.hasCost; });
  var costTotal = round(costed.reduce(function(s, r){ return s + r.cost; }, 0));
  var gainTotal = round(costed.reduce(function(s, r){ return s + r.gain; }, 0));
  return {
    rows: rows.sort(function(x, y){ return y.value - x.value; }),
    cost: costTotal, value: sum("value"), gain: gainTotal, gainPct: costTotal > 0 ? gainTotal / costTotal : null,
    incomeWindow: sum("incomeWindow"), incomeAll: sum("incomeAll"), realised: sum("realised"),
    totalReturn: round(gainTotal + sum("incomeAll") + sum("realised")),
    uncosted: rows.length - costed.length
  };
}

// Distributions by financial year, newest first: { fy, label, cash, credit, total, holdings: [{name, total}] }.
export function distributionHistory(assets){
  var byFy = {};
  (assets || []).forEach(function(a){
    if(!a || a.category !== "Shares") return;
    (Array.isArray(a.payouts) ? a.payouts : []).forEach(function(p){
      if(!p.date) return;
      var fy = fyOf(p.date);
      var y = byFy[fy] = byFy[fy] || { fy: fy, label: fyLabel(fy), cash: 0, credit: 0, total: 0, by: {} };
      var c = Number(p.cash) || 0, cr = Number(p.credit) || 0;
      y.cash += c; y.credit += cr; y.total += c + cr;
      var n = a.what || a.symbol || "Holding";
      y.by[n] = (y.by[n] || 0) + c + cr;
    });
  });
  return Object.keys(byFy).map(Number).sort(function(a, b){ return b - a; }).map(function(fy){
    var y = byFy[fy];
    return { fy: fy, label: y.label, cash: round(y.cash), credit: round(y.credit), total: round(y.total),
      holdings: Object.keys(y.by).map(function(n){ return { name: n, total: round(y.by[n]) }; }).sort(function(a, b){ return b.total - a.total; }) };
  });
}

// Concessional super for each person in financial year `fy`, from the tax model: employer SG,
// salary sacrifice and personal deductible contributions against the cap (plus carry-forward),
// with what's left and any Division 293.
export function superContributions(fy){
  return getTaxPeople().map(function(person){
    var r = computePersonTax(person, { fy: fy });
    var total = Number(r.totalConcessional) || 0, sg = Number(r.sg) || 0;
    var cap = Number(r.capAvailable) || 0;
    return { person: person, fy: fy, sg: round(sg), other: round(total - sg), total: round(total), cap: round(cap),
      room: round(Math.max(0, cap - total)), over: round(Number(r.capExceeded) || 0), used: cap > 0 ? Math.min(1, total / cap) : 0,
      div293: round(Number(r.div293Tax) || 0) };
  });
}
