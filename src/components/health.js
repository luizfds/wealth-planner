import { dataHealthChecks } from "../calc/health.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Accounts → Checks (v3.48.0) ----------------
// calc/health.js finds the inconsistencies; this lists them, worst first, each with a way there.
var WHERE_LABEL = { expenses: "Open the budget", properties: "Open Properties", accounts: "Open", tax: "Open the return" };

export function healthHtml(checks){
  checks = checks || dataHealthChecks();
  if(!checks.length) return '<p class="hc-clear">Nothing to fix — every check passes.</p>';
  return '<div class="hc-list">' + checks.map(function(c){
    var w = c.where || {};
    return '<div class="hc-item hc-' + c.severity + '" data-hc-id="' + escapeAttr(c.id) + '">' +
      '<span class="hc-dot" aria-hidden="true"></span>' +
      '<div class="hc-body"><div class="hc-title">' + escapeAttr(c.title) + '</div><p class="hc-detail">' + escapeAttr(c.detail) + '</p></div>' +
      (w.page ? '<button type="button" class="btn btn-sm btn-ghost hc-go" data-hc-page="' + escapeAttr(w.page) + '"' + (w.sub ? ' data-hc-sub="' + escapeAttr(w.sub) + '"' : '') + (w.fy != null ? ' data-hc-fy="' + w.fy + '"' : '') + '>' + (WHERE_LABEL[w.page] || "Open") + '</button>' : '') +
    '</div>';
  }).join("") + '</div>';
}
export function healthSummaryText(checks){
  checks = checks || dataHealthChecks();
  var n = checks.filter(function(c){ return c.severity !== "info"; }).length;
  return checks.length ? (n ? n + " to fix" : "") + (n && checks.length > n ? " · " : "") + (checks.length > n ? (checks.length - n) + " to look at" : "") : "all clear";
}
export function renderHealth(){
  var el = document.getElementById("healthBody");
  if(!el) return;
  var checks = dataHealthChecks();
  el.innerHTML = healthHtml(checks);
  var sum = document.getElementById("healthSummary");
  if(sum) sum.textContent = healthSummaryText(checks);
}
