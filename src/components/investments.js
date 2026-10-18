import { fmtCurrency0, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Investments → Shares and Super additions (v3.61.0) ----------------
// calc/investments.js does the sums; these lay them out as ledger cards for the Shares and Super
// tabs.
function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Number(n) || 0)); }
function signedMoney(n){ return (n > 0 ? "+" : "") + money(n); }
function pct(x){ return x == null ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + fmtPercent1.format(Math.abs(x)); }
function card(title, total, body){
  return '<details class="ledger" open><summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">' + title + '</h2></div>' +
    (total ? '<div class="ledger-total">' + total + '</div>' : '') + '</summary><div class="ledger-body">' + body + '</div></details>';
}

export function performanceCardHtml(perf, periodLabel){
  if(!perf.rows.length) return "";
  var tiles = '<div class="inv-tiles">' +
    '<div><span>Value</span><b>' + money(perf.value) + '</b><small>cost ' + money(perf.cost) + '</small></div>' +
    '<div><span>Unrealised gain</span><b class="' + (perf.gain >= 0 ? "up" : "down") + '">' + signedMoney(perf.gain) + '</b><small>' + pct(perf.gainPct) + '</small></div>' +
    '<div><span>Distributions</span><b>' + money(perf.incomeWindow) + '</b><small>' + escapeAttr(periodLabel) + ' · ' + money(perf.incomeAll) + ' all time</small></div>' +
    '<div><span>Total return</span><b class="' + (perf.totalReturn >= 0 ? "up" : "down") + '">' + signedMoney(perf.totalReturn) + '</b><small>gain + distributions' + (perf.realised ? ' + ' + money(perf.realised) + ' realised' : '') + '</small></div></div>';
  var rows = '<div class="inv-table" role="table" aria-label="Performance by holding"><div class="inv-tr inv-th" role="row"><span>Holding</span><span>Value</span><span>Gain</span><span>Distributions</span><span>Total return</span></div>' +
    perf.rows.map(function(r){
      return '<div class="inv-tr" role="row"><span class="inv-name">' + escapeAttr(r.name) + (r.symbol && r.symbol !== r.name ? ' <small>' + escapeAttr(r.symbol) + '</small>' : '') + '</span>' +
        '<span>' + money(r.value) + '</span>' +
        '<span class="' + (r.gain >= 0 ? "up" : "down") + '">' + (r.hasCost ? signedMoney(r.gain) + ' <small>' + pct(r.gainPct) + '</small>' : '<small>no cost</small>') + '</span>' +
        '<span>' + money(r.incomeAll) + '</span>' +
        '<span class="' + (r.totalReturn >= 0 ? "up" : "down") + '">' + signedMoney(r.totalReturn) + (r.totalReturnPct != null ? ' <small>' + pct(r.totalReturnPct) + '</small>' : '') + '</span></div>';
    }).join("") + '</div>' +
    (perf.uncosted ? '<p class="ledger-note" style="margin:6px 0 0">' + perf.uncosted + ' holding' + (perf.uncosted === 1 ? " has" : "s have") + ' no cost recorded, so it isn\'t in the gain — add its purchase lots or an average cost.</p>' : '');
  return card("Performance", 'Total return <b>' + signedMoney(perf.totalReturn) + '</b>', tiles + rows);
}

export function distributionsCardHtml(hist){
  if(!hist.length) return "";
  var max = Math.max.apply(null, hist.map(function(y){ return y.total; }).concat([1]));
  var body = '<div class="inv-dist">' + hist.map(function(y){
    return '<details class="inv-dist-year"><summary><span class="inv-dist-label">' + escapeAttr(y.label) + '</span>' +
      '<span class="inv-dist-bar"><i style="width:' + Math.max(2, Math.round(y.total / max * 100)) + '%"></i></span><b>' + money(y.total) + '</b></summary>' +
      '<p class="ledger-note" style="margin:4px 0">' + money(y.cash) + ' paid in cash' + (y.credit ? ', ' + money(y.credit) + ' in franking credits' : '') + '.</p>' +
      '<ul class="inv-dist-list">' + y.holdings.map(function(h){ return '<li><span>' + escapeAttr(h.name) + '</span><b>' + money(h.total) + '</b></li>'; }).join("") + '</ul></details>';
  }).join("") + '</div>';
  return card("Distributions by year", "", body);
}

export function superContributionsCardHtml(rows, label){
  if(!rows.length) return "";
  var body = rows.map(function(r){
    var w = Math.round(r.used * 100);
    return '<div class="inv-super"><div class="inv-super-head"><b>' + escapeAttr(r.person) + '</b><span>' + money(r.total) + ' of ' + money(r.cap) + ' cap</span></div>' +
      '<div class="inv-super-bar' + (r.over > 0 ? " over" : "") + '"><i style="width:' + Math.max(1, w) + '%"></i></div>' +
      '<div class="inv-super-lines"><span>Employer ' + money(r.sg) + '</span>' + (r.other ? '<span>Salary sacrifice / personal ' + money(r.other) + '</span>' : '') +
        (r.over > 0 ? '<span class="down">' + money(r.over) + ' over the cap — taxed at your marginal rate</span>' : '<span class="up">' + money(r.room) + ' of room left</span>') +
        (r.div293 ? '<span>Division 293 ' + money(r.div293) + '</span>' : '') + '</div></div>';
  }).join("") + '<p class="ledger-note" style="margin:6px 0 0">Concessional contributions in ' + escapeAttr(label) + ', from your income rows. The cap includes any carry-forward set under Settings → People. Using room before 30 June is on Tax → This year.</p>';
  return card("Contributions — " + escapeAttr(label), "", body);
}
