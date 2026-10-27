import { state } from "../state.js";
import { netWorthList } from "../calc/networthlist.js";
import { toAudAmount, totalNetWorthValue } from "../calc/engine.js";
import { detailLinkHtml } from "./detail.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Net worth (v3.129.0) ----------------
// The overview the rail above Accounts, Investments and Property opens on: everything owned and
// owed in one list, each row to its own page.
function money(v){ return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v)); }
export function netWorthPageHtml(){
  var l = netWorthList(state, toAudAmount);
  if(!l.groups.length) return '<p class="ledger-note">Nothing here yet. Add an account, a holding or a property and it appears in this list.</p>';
  var owned = l.groups.filter(function(g){ return g.key !== "debts"; }).reduce(function(s, g){ return s + g.total; }, 0);
  var owed = l.groups.filter(function(g){ return g.key === "debts"; }).reduce(function(s, g){ return s - g.total; }, 0);
  var head = '<div class="nw-head"><div><span>Net worth</span><b>' + money(totalNetWorthValue()) + '</b></div><div><span>Owned</span><b>' + money(owned) + '</b></div><div><span>Owed</span><b>' + money(owed) + '</b></div></div>';
  var bar = owned > 0 ? '<div class="nw-bar" role="img" aria-label="What makes up what you own">' + l.groups.filter(function(g){ return g.key !== "debts" && g.total > 0; }).map(function(g, i){
    return '<span class="series-color-' + i + '" style="width:' + (g.total / owned * 100).toFixed(2) + '%" title="' + escapeAttr(g.label + " " + money(g.total)) + '"></span>'; }).join("") + '</div>' : '';
  // Each group's dot is its colour in the bar above.
  var shown = l.groups.filter(function(g){ return g.key !== "debts" && g.total > 0; }).map(function(g){ return g.key; });
  return head + bar + l.groups.map(function(g){
    var ci = shown.indexOf(g.key);
    return '<section class="nw-group"><h3><span>' + (ci !== -1 ? '<i class="nw-dot series-color-' + ci + '" aria-hidden="true"></i>' : '') + escapeAttr(g.label) + '</span><b>' + money(g.total) + '</b></h3><ul>' + g.rows.map(function(r){
      return '<li><span class="nw-name">' + (r.id ? detailLinkHtml(r.kind, r.id, r.name) : escapeAttr(r.name)) + (r.sub ? '<small>' + escapeAttr(r.sub) + '</small>' : '') + '</span><b class="' + (r.value < 0 ? "neg" : "") + '">' + money(r.value) + '</b></li>';
    }).join("") + '</ul></section>';
  }).join("");
}
export function renderNetWorthPage(){
  var el = typeof document !== "undefined" && document.getElementById("netWorthBody");
  if(el) el.innerHTML = netWorthPageHtml();
}
