import { adviceFor } from "../calc/advice.js";
import { state } from "../state.js";
import { partAllows } from "../calc/parts.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { askClaudeHtml } from "./askclaude.js";

// ---------------- What the app notices (v3.98.0) — calc/advice.js ----------------
// The whole list on Home → Insights; a page shows one line for what is about it (attentionline.js, drawn by redraw.js).
var KIND = { risk: "Watch", opportunity: "Opportunity", info: "Worth knowing", good: "On track" };
export var adviceUi = { open: {}, goodOpen: false };

export function renderAdvice(){
  if(typeof document === "undefined") return;
  var items;
  try { items = adviceFor({ today: localDateStr() }); } catch(e){ items = []; }
  items = items.filter(function(a){ return partAllows(a.id, state); });
  var home = document.getElementById("adviceHome");
  if(home) home.innerHTML = adviceHomeHtml(items);
}
function impact(a){
  if(!a.impactYearly) return "";
  return '<span class="adv-impact' + (a.impactYearly < 0 ? ' neg' : '') + '">' + (a.kind === "risk" ? "" : a.impactYearly < 0 ? "−" : "≈ ") + fmtCurrency0.format(Math.abs(a.impactYearly)) + '/yr</span>';
}
function card(a, withGo){
  var open = !!adviceUi.open[a.id];
  return '<details class="adv-item adv-' + a.kind + '" data-adv-id="' + escapeAttr(a.id) + '"' + (open ? ' open' : '') + '><summary>' +
      '<span class="adv-kind">' + KIND[a.kind] + '</span><span class="adv-title">' + escapeAttr(a.title) + '</span>' + impact(a) + '</summary>' +
    '<p>' + escapeAttr(a.detail) + '</p>' +
    (withGo && a.go ? (a.go.filter
      // v3.168.0: a notice about spending opens Spending filtered to exactly what it counted.
      ? '<button type="button" class="link-btn adv-go" data-sv' + Object.keys(a.go.filter).map(function(k){ return ' data-sv-' + k + '="' + escapeAttr(a.go.filter[k]) + '"'; }).join("") + '>Show me in Spending →</button>'
      : '<button type="button" class="link-btn adv-go" data-adv-go="' + escapeAttr(a.go.page) + '"' + (a.go.sub ? ' data-adv-sub="' + escapeAttr(a.go.sub) + '"' : '') + '>See the figures →</button>') : '') +
  '</details>';
}
// v3.154.0: what's on track is worth knowing, not acting on — one fold under the rest, not a card each.
export function adviceHomeHtml(items){
  var act = items.filter(function(a){ return a.kind !== "good"; });
  var good = items.filter(function(a){ return a.kind === "good"; });
  var goodFold = good.length
    ? '<details class="adv-good-fold"' + (adviceUi.goodOpen ? ' open' : '') + ' data-adv-good><summary><span class="adv-kind">On track</span><span class="adv-title">' + good.length + ' thing' + (good.length === 1 ? '' : 's') + ' holding up</span><span class="adv-fold-caret" aria-hidden="true">▸</span></summary>' +
        '<div class="adv-list">' + good.map(function(a){ return card(a, true); }).join("") + '</div></details>'
    : '';
  var body = items.length
    ? '<div class="adv-list">' + act.map(function(a){ return card(a, true); }).join("") + '</div>' + goodFold
    : '<p class="ledger-note">Nothing to say yet — this fills in as income, spending, loans and scenarios are entered.</p>';
  return '<div class="panel adv-panel"><h2 class="section-title">What the app notices</h2>' +
    '<p class="ledger-note adv-note help">Read from your own figures, worked out here in the browser. Observations to weigh, not financial advice — the ones about tax and loans are worth taking to your accountant.</p>' +
    body + askClaudeHtml() + '</div>';
}
