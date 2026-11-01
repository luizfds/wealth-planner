// ---------------- Rent statements where you'd look for them (v3.208.0, item 240) ----------------
//
// A property manager's statement is logged on its property (Net worth → Property → Income & costs → Log a property
// manager statement, calc/agentstatement.js). That form used to be the only way in, four levels down. Now the same
// form is opened, filled in, from the main import (a statement PDF dropped into Spending, the Statements folder or
// shared to the app — importwiring.js), from the property's Overview tab and from the + menu. This module opens it.
import { statementTotals } from "../calc/agentstatement.js";
import { fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";
import { showToast } from "../lib/toast.js";
import { state } from "../state.js";
import { showPage } from "./nav.js";
import { renderProperties, propertyTabs, agentStatementUi, agentStatementFormValues } from "./properties.js";

export function investmentProperties(){
  return (state.properties || []).filter(function(p){ return p && p.kind === "IP"; });
}

// The statement form's fields from what agentStatementFromLines read; the toast says whether it adds up.
export function fillAgentStatementForm(panel, r){
  var set = function(k, v){ var el = panel.querySelector('[data-as="' + k + '"]'); if(el) el.value = v; };
  if(r.date) set("date", r.date);
  set("rent", r.rent || ""); set("water", r.water || ""); set("fees", r.fees || ""); set("waterRates", r.waterRates || "");
  var other = r.others.reduce(function(t, o){ return t + o.amount; }, 0);
  set("otherAmount", other ? Math.round(other * 100) / 100 : "");
  var sel = panel.querySelector('[data-as="otherLine"]');
  if(sel && r.others.length){
    var want = r.others[0].what.toLowerCase();
    var hit = Array.prototype.find.call(sel.options, function(o){ return want.indexOf(o.text.toLowerCase().split(" ")[0]) !== -1; });
    if(hit) sel.value = hit.value;
  }
  var out = panel.querySelector("[data-as-net]"), net = statementTotals(agentStatementFormValues(panel)).net;
  if(out) out.textContent = fmtCurrency2.format(net);
  showToast(r.received != null && Math.abs(net - r.received) >= 0.01
    ? "Filled — but it adds to " + fmtCurrency2.format(net) + ", the statement says " + fmtCurrency2.format(r.received) + ". Check it before logging."
    : "Filled from the statement" + (r.others.length ? " (other: " + r.others.map(function(o){ return o.what; }).join(", ") + ")" : "") + " — check it, then Log statement");
}

// The property's statement form, on its Income & costs tab, open and in view — filled in when `filled` (what
// agentStatementFromLines read) is given.
export function openStatementForm(p, filled){
  propertyTabs[p.id] = "income";
  agentStatementUi.open[p.id] = true;
  showPage("properties", { replace: true });
  renderProperties();
  setTimeout(function(){
    var panel = document.querySelector('[data-as-panel="' + CSS.escape(p.id) + '"]');
    if(!panel) return;
    panel.open = true;
    if(filled) fillAgentStatementForm(panel, filled);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    var first = panel.querySelector(filled ? "[data-as-log]" : "[data-as-pdf]");
    if(first && filled) first.focus({ preventScroll: true });
  }, 280);
}

// Which investment property: the only one straight away, else a sheet to pick from (Back and Escape close it).
export function chooseInvestmentProperty(title, then){
  var ips = investmentProperties();
  if(!ips.length){ showToast("Add the investment property first (Net worth → Property), then log its statements there"); return; }
  if(ips.length === 1){ then(ips[0]); return; }
  var chosen = null;
  var root = document.createElement("div");
  root.innerHTML = '<div class="review-backdrop" data-ipp-backdrop><div class="review-panel qfab-panel" role="dialog" aria-label="' + escapeAttr(title) + '">' +
    '<div class="review-head"><h4>' + escapeAttr(title) + '</h4><button type="button" class="icon-btn" data-ipp-close aria-label="Close">✕</button></div>' +
    '<div class="qfab-actions">' + ips.map(function(p){
      return '<button type="button" class="qfab-action" data-ipp="' + escapeAttr(p.id) + '"><span class="qfab-action-label">' + escapeAttr(p.what || "Investment property") + '</span></button>';
    }).join("") + '</div></div></div>';
  document.body.appendChild(root);
  // The choice is acted on once the sheet has closed (its history entry popped), so the page change that follows
  // doesn't race the Back the close made.
  pushActiveOverlay(function(){ root.remove(); if(chosen) setTimeout(function(){ then(chosen); }, 0); });
  root.addEventListener("click", function(e){
    if(e.target.closest("[data-ipp-close]") || (e.target.matches && e.target.matches("[data-ipp-backdrop]"))){ requestCloseActiveOverlay(); return; }
    var b = e.target.closest("[data-ipp]");
    if(!b) return;
    chosen = ips.find(function(p){ return p.id === b.getAttribute("data-ipp"); }) || null;
    requestCloseActiveOverlay();
  });
  root.addEventListener("keydown", function(e){ if(e.key === "Escape") requestCloseActiveOverlay(); });
  var first = root.querySelector("[data-ipp]");
  if(first) first.focus();
}
