import { dataHealthChecks } from "../calc/health.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Accounts → Checks (v3.48.0) ----------------
// calc/health.js finds the inconsistencies; this lists them, worst first, each with a way there.
var WHERE_LABEL = { expenses: "Open the budget", properties: "Open Properties", accounts: "Open", tax: "Open the return" };

// A check disappears by itself once what it found is fixed — they're worked out fresh every time.
// One that's fine as it is gets "Looks right" (v3.70.0), which hides it until it finds something
// different; hidden ones are listed at the bottom, each with Show again.
export function healthHtml(checks, hidden){
  checks = checks || dataHealthChecks();
  hidden = hidden || [];
  var hiddenHtml = hidden.length ? '<details class="hc-hidden"><summary>' + hidden.length + ' marked “looks right”</summary>' + hidden.map(function(c){
    return '<div class="hc-item hc-info"><span class="hc-dot" aria-hidden="true"></span><div class="hc-body"><div class="hc-title">' + escapeAttr(c.title) + '</div></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-hc-undismiss="' + escapeAttr(c.id) + '">Show again</button></div>';
  }).join("") + '</details>' : '';
  if(!checks.length) return '<p class="hc-clear">Nothing to fix — every check passes.</p>' + hiddenHtml;
  return '<p class="ledger-note" style="margin:0 0 8px">Each check goes away by itself once the data is fixed. If one is fine as it is, mark it “Looks right” and it stays hidden until it finds something new.</p>' +
    '<div class="hc-list">' + checks.map(function(c){
    var w = c.where || {};
    return '<div class="hc-item hc-' + c.severity + '" data-hc-id="' + escapeAttr(c.id) + '">' +
      '<span class="hc-dot" aria-hidden="true"></span>' +
      '<div class="hc-body"><div class="hc-title">' + escapeAttr(c.title) + '</div><p class="hc-detail">' + escapeAttr(c.detail) + '</p></div>' +
      // v3.105.0: both buttons in one cell — as two grid children the second wrapped into the 10px
      // dot column on its own row.
      '<div class="hc-actions">' +
      (c.fix ? '<button type="button" class="btn btn-sm hc-fix" data-hc-fix="' + escapeAttr(c.fix.kind) + '">' + escapeAttr(c.fix.label) + '</button>' : '') +
      (w.page ? '<button type="button" class="btn btn-sm btn-ghost hc-go" data-hc-page="' + escapeAttr(w.page) + '"' + (w.sub ? ' data-hc-sub="' + escapeAttr(w.sub) + '"' : '') + (w.fy != null ? ' data-hc-fy="' + w.fy + '"' : '') + '>' + escapeAttr(w.label || WHERE_LABEL[w.page] || "Open") + '</button>' : '') +
      '<button type="button" class="btn btn-sm btn-ghost hc-ok" data-hc-dismiss="' + escapeAttr(c.id) + '">Looks right</button>' +
      '</div>' +
    '</div>';
  }).join("") + '</div>' + hiddenHtml;
}
export function healthSummaryText(checks){
  checks = checks || dataHealthChecks();
  var n = checks.filter(function(c){ return c.severity !== "info"; }).length;
  return checks.length ? (n ? n + " to fix" : "") + (n && checks.length > n ? " · " : "") + (checks.length > n ? (checks.length - n) + " to look at" : "") : "all clear";
}
export function renderHealth(){
  var el = document.getElementById("healthBody");
  if(!el) return;
  var all = dataHealthChecks({ includeDismissed: true });
  var checks = all.filter(function(c){ return !c.dismissed; });
  el.innerHTML = healthHtml(checks, all.filter(function(c){ return c.dismissed; }));
  var sum = document.getElementById("healthSummary");
  if(sum) sum.textContent = healthSummaryText(checks);
}
