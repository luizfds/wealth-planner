import { adviceFor } from "../calc/advice.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { askClaudeHtml } from "./askclaude.js";

// ---------------- What the app notices (v3.98.0) — calc/advice.js ----------------
// The whole list on Home → Insights; on each page, a strip with that page's findings.
var STRIPS = { plan: "adviceStrip-plan", cashflow: "adviceStrip-cashflow", income: "adviceStrip-income", tax: "adviceStrip-tax", investments: "adviceStrip-investments", accounts: "adviceStrip-accounts" };
var KIND = { risk: "Watch", opportunity: "Opportunity", info: "Worth knowing", good: "On track" };
export var adviceUi = { open: {} };

export function renderAdvice(){
  if(typeof document === "undefined") return;
  var items;
  try { items = adviceFor({ today: localDateStr() }); } catch(e){ items = []; }
  var home = document.getElementById("adviceHome");
  if(home) home.innerHTML = adviceHomeHtml(items);
  Object.keys(STRIPS).forEach(function(area){
    var el = document.getElementById(STRIPS[area]);
    if(el) el.innerHTML = adviceStripHtml(items.filter(function(a){ return a.area === area; }), area);
  });
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
    (withGo && a.go ? '<button type="button" class="link-btn adv-go" data-adv-go="' + escapeAttr(a.go.page) + '"' + (a.go.sub ? ' data-adv-sub="' + escapeAttr(a.go.sub) + '"' : '') + '>See the figures →</button>' : '') +
  '</details>';
}
export function adviceHomeHtml(items){
  var body = items.length
    ? '<div class="adv-list">' + items.map(function(a){ return card(a, true); }).join("") + '</div>'
    : '<p class="ledger-note">Nothing to say yet — this fills in as income, spending, loans and scenarios are entered.</p>';
  return '<div class="panel adv-panel"><h3>What the app notices</h3>' +
    '<p class="ledger-note adv-note">Read from your own figures, worked out here in the browser. Observations to weigh, not financial advice — the ones about tax and loans are worth taking to your accountant.</p>' +
    body + askClaudeHtml() + '</div>';
}
export function adviceStripHtml(items, area){
  if(!items.length) return "";
  var shown = items.slice(0, 3);
  return '<div class="adv-strip"><div class="adv-strip-head"><span>The app notices</span>' +
    (items.length > shown.length ? '<button type="button" class="link-btn" data-adv-go="dashboard" data-adv-sub="insights">' + (items.length - shown.length) + ' more →</button>' : '<button type="button" class="link-btn" data-adv-go="dashboard" data-adv-sub="insights">All of it →</button>') +
    '</div>' + shown.map(function(a){ return card(a, false); }).join("") + '</div>';
}
