import { state } from "../state.js";
import { netWorthList } from "../calc/networthlist.js";
import { toAudAmount, totalNetWorthValue } from "../calc/engine.js";
import { loggedSinceRecorded } from "../calc/accounts.js";
import { estimatesUplift } from "../calc/estimates.js";
import { localDateStr } from "../lib/format.js";
import { detailLinkHtml } from "./detail.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Net worth (v3.129.0) ----------------
// The overview the rail above Accounts, Investments and Property opens on: everything owned and
// owed in one list, each row to its own page.
function money(v){ return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v)); }
export function netWorthPageHtml(){
  var today = localDateStr();
  var l = netWorthList(state, toAudAmount, loggedSinceRecorded(today).byRecord);
  var est = estimatesUplift(state, today);
  if(!l.groups.length) return '<p class="ledger-note">Nothing here yet. Add an account, a holding or a property and it appears in this list.</p>';
  var owned = l.groups.filter(function(g){ return g.key !== "debts"; }).reduce(function(s, g){ return s + g.total; }, 0);
  var owed = l.groups.filter(function(g){ return g.key === "debts"; }).reduce(function(s, g){ return s - g.total; }, 0);
  var nw = totalNetWorthValue();
  var head = '<div class="nw-head"><div><span>Net worth</span><b>' + money(nw) + '</b>' +
      (est.items.length && Math.abs(est.total) >= 1 ? '<small class="nw-est" title="' + escapeAttr(est.items.map(function(i){ return i.name + ": " + money(i.recorded) + " on record (" + i.from + "), about " + money(i.estimate) + " now"; }).join("\n")) + '">about ' + money(nw + est.total) + ' with estimates for ' + escapeAttr(est.items.map(function(i){ return i.name; }).join(", ")) + '</small>' : '') + '</div>' +
    '<div><span>Owned</span><b>' + money(owned) + '</b></div><div><span>Owed</span><b>' + money(owed) + '</b></div></div>';
  var parts = l.groups.filter(function(g){ return g.key !== "debts" && g.total > 0; });
  var pct = function(g){ var p = g.total / owned * 100; return p >= 1 ? Math.round(p) + "%" : "<1%"; };
  // v3.138.0: the bar says what its colours are, under it — not only in each group's dot further down.
  var bar = owned > 0 ? '<div class="nw-bar" role="img" aria-label="' + escapeAttr("What you own: " + parts.map(function(g){ return g.label + " " + pct(g); }).join(", ")) + '">' + parts.map(function(g, i){
    return '<span class="series-color-' + i + '" style="width:' + (g.total / owned * 100).toFixed(2) + '%" title="' + escapeAttr(g.label + " " + money(g.total)) + '"></span>'; }).join("") + '</div>' +
    '<ul class="nw-legend" aria-hidden="true">' + parts.map(function(g, i){ return '<li><i class="nw-dot series-color-' + i + '"></i>' + escapeAttr(g.label) + ' <b>' + pct(g) + '</b></li>'; }).join("") + '</ul>' : '';
  // Each group's dot is its colour in the bar above.
  var shown = l.groups.filter(function(g){ return g.key !== "debts" && g.total > 0; }).map(function(g){ return g.key; });
  return head + bar + l.groups.map(function(g){
    var ci = shown.indexOf(g.key);
    return '<section class="nw-group"><h2><span>' + (ci !== -1 ? '<i class="nw-dot series-color-' + ci + '" aria-hidden="true"></i>' : '') + escapeAttr(g.label) + '</span><b>' + money(g.total) + '</b></h2><ul>' + g.rows.map(function(r){
      return '<li><span class="nw-name">' + (r.id ? detailLinkHtml(r.kind, r.id, r.name) : escapeAttr(r.name)) + (r.sub ? '<small>' + escapeAttr(r.sub) + '</small>' : '') + '</span><b class="' + (r.value < 0 ? "neg" : "") + '">' + money(r.value) + '</b></li>';
    }).join("") + '</ul></section>';
  }).join("");
}
export function renderNetWorthPage(){
  var el = typeof document !== "undefined" && document.getElementById("netWorthBody");
  if(el) el.innerHTML = netWorthPageHtml();
}
