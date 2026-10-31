// ---------------- Against the market, a target mix, distributions ahead (v3.178.0, item 203) ----------------
//
// Three cards under Investments → Shares, from calc/investreturn.js. The benchmark needs the price
// file's weekly series (2 MB), so it's read the first time the card is shown and kept for the session.

import { state } from "../state.js";
import { moneyWeighted, benchmark, mixGaps, nextGoesTo, distributionsAhead, MIX_CLASSES } from "../calc/investreturn.js";
import { toAudAmount } from "../calc/engine.js";
import { unitsOn } from "../calc/pricesheet.js";
import { fmtCurrency0, fmtPercent1, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Number(n) || 0)); }
function pct(x){ return x == null ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + fmtPercent1.format(Math.abs(x)); }
function card(id, title, total, body){
  return '<details class="ledger" open id="' + id + '"><summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">' + title + '</h2></div>' +
    (total ? '<div class="ledger-total">' + total + '</div>' : '') + '</summary><div class="ledger-body">' + body + '</div></details>';
}

// The indexes, by an ETF that tracks each in Australian dollars, and the dividends the price leaves
// out (roughly what each has paid; said on the card).
export var BENCHMARKS = [
  { key: "asx200", label: "ASX 200", fileKey: "ASX:A200", via: "A200", yieldPct: 4 },
  { key: "sp500", label: "S&P 500", fileKey: "ASX:IVV", via: "IVV on the ASX, in A$", yieldPct: 1.3 }
];
export var bench = { status: "idle", series: {}, pick: "asx200", nextAmount: 5000 };

export function shareHoldings(){ return (state.assets || []).filter(function(a){ return a && a.category === "Shares"; }); }
// The portfolio's value on a date, from each holding's recorded history (carried forward).
export function portfolioValueOn(date){
  return shareHoldings().reduce(function(sum, a){
    var h = (a.history || []).filter(function(x){ return x.date <= date; });
    var last = h.length ? h[h.length - 1] : null;
    return sum + (last ? toAudAmount(a, Number(last.value) || 0) : 0);
  }, 0);
}
export function loadBenchmarks(fetchJson){
  if(bench.status === "loading" || bench.status === "ready") return Promise.resolve(bench);
  bench.status = "loading";
  return fetchJson("prices/weekly.json").then(function(file){
    BENCHMARKS.forEach(function(b){
      var rows = file && file.weekly && file.weekly[b.fileKey];
      bench.series[b.key] = Array.isArray(rows) ? rows.filter(function(r){ return r && r[0] && Number(r[1]) > 0; }).map(function(r){ return { date: r[0], close: Number(r[1]) }; }) : [];
    });
    bench.status = "ready";
    return bench;
  }, function(){ bench.status = "error"; return bench; });
}

export function benchmarkCardHtml(today){
  today = today || localDateStr();
  var mw = moneyWeighted(shareHoldings(), today, toAudAmount);
  if(!mw.flows.length) return "";
  var b = BENCHMARKS.find(function(x){ return x.key === bench.pick; }) || BENCHMARKS[0];
  var pick = '<div class="seg-control" role="group" aria-label="Compare with">' + BENCHMARKS.map(function(x){
    var on = x.key === b.key;
    return '<button type="button" class="seg-option' + (on ? " active" : "") + '" data-bench="' + x.key + '" aria-pressed="' + on + '">' + x.label + '</button>';
  }).join("") + '</div>';
  var body;
  if(bench.status !== "ready") body = '<p class="ledger-note">' + (bench.status === "error" ? "The price file couldn't be read — the comparison needs it. It'll try again next time." : "Reading the index's prices…") + '</p>';
  else {
    var r = benchmark(mw.flows, bench.series[b.key], today, { yieldPct: b.yieldPct, mineAt: portfolioValueOn });
    if(!r) body = '<p class="ledger-note">No prices for the ' + b.label + ' yet.</p>';
    else {
      var diff = r.mine - r.value;
      body = '<p class="bench-line">Every dollar you put in or took out since ' + escapeAttr(fmtDate(mw.since)) + ', put into the ' + b.label + ' on the same day instead, would be worth <b>' + money(r.value) + '</b> today — ' +
        '<b class="' + (diff >= 0 ? "up" : "down") + '">' + money(Math.abs(diff)) + (diff >= 0 ? " less" : " more") + '</b> than your ' + money(r.mine) + '.</p>' +
        '<div class="inv-tiles bench-tiles"><div><span>Yours</span><b>' + pct(mw.irr) + '</b><small>a year, money-weighted</small></div>' +
        '<div><span>' + b.label + '</span><b>' + pct(r.irr) + '</b><small>a year, the same money</small></div></div>' +
        '<div id="benchChart"></div>' +
        '<p class="ledger-note" style="margin:6px 0 0">The ' + b.label + ' is priced by ' + b.via + ', with about ' + b.yieldPct + '% a year in dividends added back in (the price leaves them out). ' +
        (r.coveredFrom ? 'Money in before ' + escapeAttr(fmtDate(r.coveredFrom)) + ' is put in at the first price there is. ' : '') +
        'Your line is your holdings\' recorded values, so it\'s only as complete as their price history.' + (mw.uncounted ? ' Holdings without dated purchase lots aren\'t in either figure.' : '') + '</p>';
    }
  }
  return card("benchCard", "Against the market", "", pick + body);
}
export function benchmarkChartSeries(today){
  today = today || localDateStr();
  if(bench.status !== "ready") return null;
  var mw = moneyWeighted(shareHoldings(), today, toAudAmount);
  var b = BENCHMARKS.find(function(x){ return x.key === bench.pick; }) || BENCHMARKS[0];
  var r = mw.flows.length && benchmark(mw.flows, bench.series[b.key], today, { yieldPct: b.yieldPct, mineAt: portfolioValueOn });
  if(!r || r.points.length < 2) return null;
  var t0 = Date.parse(r.points[0].date);
  var x = function(p){ return (Date.parse(p.date) - t0) / 86400000; };
  return { t0: t0, series: [
    { label: "Yours", colorClass: "series-color-0", points: r.points.map(function(p){ return { x: x(p), y: p.mine }; }) },
    { label: "Same money in the " + b.label, colorClass: "series-color-1", dashed: true, points: r.points.map(function(p){ return { x: x(p), y: p.index }; }) }
  ] };
}

// ---- Target mix ----
export function targetMixCardHtml(){
  var target = state.targetMix || {};
  var mix = mixGaps(state.assets, target, toAudAmount);
  if(!(mix.total > 0)) return "";
  var hasTarget = mix.targetSum > 0;
  var rows = MIX_CLASSES.filter(function(c){ return mix.rows.some(function(r){ return r.cls === c; }) || hasTarget; }).map(function(c){
    var r = mix.rows.find(function(x){ return x.cls === c; }) || { value: 0, pct: 0, target: 0, gap: 0 };
    return '<div class="mix-row"><span class="mix-name">' + c + '</span>' +
      '<span class="mix-now">' + money(r.value) + ' <small>' + fmtPercent1.format(r.pct) + '</small></span>' +
      '<label class="mix-target"><input type="number" min="0" max="100" step="1" inputmode="decimal" data-mix-target="' + escapeAttr(c) + '" value="' + escapeAttr(target[c] != null ? target[c] : "") + '" placeholder="—" aria-label="Target % for ' + c + '">%</label>' +
      '<span class="mix-gap ' + (!hasTarget ? "" : r.gap > 0 ? "up" : r.gap < 0 ? "down" : "") + '">' + (!hasTarget ? "" : Math.abs(r.gap) < 1 ? "on target" : (r.gap > 0 ? money(r.gap) + " short" : money(-r.gap) + " over")) + '</span></div>';
  }).join("");
  var next = "";
  if(hasTarget){
    var to = nextGoesTo(mix, bench.nextAmount);
    next = '<div class="mix-next"><label>The next <input type="number" min="0" step="100" inputmode="decimal" data-mix-next value="' + escapeAttr(bench.nextAmount) + '" aria-label="Amount to invest next"> goes to</label> ' +
      (to.length ? to.map(function(t){ return '<b>' + escapeAttr(t.cls) + ' ' + money(t.amount) + '</b>'; }).join(" · ") : '<span>—</span>') + '</div>';
  }
  return card("mixCard", "Target mix", hasTarget && mix.targetSum !== 100 ? '<span class="down">targets add to ' + mix.targetSum + '%</span>' : "",
    '<p class="ledger-note" style="margin:0 0 8px">Shares, cash and other investments by kind (super isn\'t in it). ' + (hasTarget ? "" : "Set a target % for each to see the gap and where the next dollars should go — optional.") + ' A holding on another market counts as international; set one\'s own kind on its row.</p>' +
    '<div class="mix-table">' + rows + '</div>' + next);
}

// ---- Distributions ahead ----
export function distributionsAheadCardHtml(today){
  today = today || localDateStr();
  var months = distributionsAhead(shareHoldings(), today, unitsOn, toAudAmount);
  if(!months.length) return "";
  var total = months.reduce(function(s, m){ return s + m.total; }, 0);
  var name = function(m){ var d = new Date(m + "-01T00:00:00"); return d.toLocaleDateString("en-AU", { month: "short", year: "numeric" }); };
  return card("distAheadCard", "Distributions in the year ahead", "about <b>" + money(total) + "</b>",
    '<ul class="dist-ahead">' + months.map(function(m){
      return '<li><span class="dist-month">' + name(m.month) + '</span><span class="dist-items">' + m.items.map(function(i){ return escapeAttr(i.name) + ' <small>' + escapeAttr(fmtDate(i.date)) + '</small>'; }).join(" · ") + '</span><b>' + money(m.total) + '</b></li>';
    }).join("") + '</ul><p class="ledger-note" style="margin:6px 0 0">From what each holding paid in the last year, on the same dates, for the units you hold now. Funds change their payments, so treat these as about.</p>');
}
