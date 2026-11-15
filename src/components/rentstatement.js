// ---------------- Rent statements where you'd look for them (v3.208.0, item 240) ----------------
//
// A property manager's statement is logged on its property (Net worth → Property → Income & costs → Log a property
// manager statement, calc/agentstatement.js). That form used to be the only way in, four levels down. Now the same
// form is opened, filled in, from the main import (a statement PDF dropped into Spending, the Statements folder or
// shared to the app — importwiring.js), from the property's Overview tab and from the + menu. This module opens it.
import { statementTotals } from "../calc/agentstatement.js";
import { propertyOwnershipPct } from "../calc/property.js";
import { getTaxPeople } from "../calc/tax.js";
import { fmtCurrency2, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";
import { showToast } from "../lib/toast.js";
import { state } from "../state.js";
import { showPage } from "./nav.js";
import { renderProperties, propertyTabs, agentStatementUi, agentStatementFormValues, rememberAgentStatementForm } from "./properties.js";

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
var statementOpening = 0;
export async function openStatementForm(p, filled, options){
  var request = ++statementOpening, household = state, o = options || {};
  var current = function(){ return state === household && investmentProperties().indexOf(p) !== -1 && (!o.isCurrent || o.isCurrent()); };
  if(!current()){ showToast("That property or statement is no longer available. Choose the statement again."); return false; }
  var shown = await showPage("properties", { replace: true });
  if(shown === false || request !== statementOpening || !current()) return false;
  propertyTabs[p.id] = "income";
  agentStatementUi.open[p.id] = true;
  if(filled) agentStatementUi.reviews[p.id] = { household: household, property: p, name: o.name || "statement PDF", values: {}, isCurrent: current, onLogged: o.onLogged };
  renderProperties();
  var panel = document.querySelector('[data-as-panel="' + CSS.escape(p.id) + '"]');
  if(!panel) return false;
  panel.open = true;
  if(filled){ fillAgentStatementForm(panel, filled); rememberAgentStatementForm(panel); }
  panel.scrollIntoView({ block: "start" });
  var first = panel.querySelector(filled ? "[data-as-log]" : "[data-as-pdf]");
  if(first && filled) first.focus({ preventScroll: true });
  return true;
}

// Choose a live destination after the modal's history entry has actually closed.
var propertyPicker = null, propertyPickerSequence = 0;
export function chooseInvestmentProperty(title, then){
  if(propertyPicker){ propertyPicker.querySelector("button").focus(); return; }
  var ips = investmentProperties(), household = state;
  if(!ips.length){ showToast("Add the investment property first (Net worth → Property), then log its statements there"); return; }
  if(ips.length === 1){ then(ips[0]); return; }
  var opener = document.activeElement, request = ++propertyPickerSequence, closing = false;
  var menu = opener && opener.closest("[data-overflow-menu]");
  if(menu) opener = menu.parentElement.querySelector("[data-overflow-toggle]");
  var root = propertyPicker = document.createElement("dialog"), people = getTaxPeople();
  root.className = "app-dialog property-picker";
  root.setAttribute("aria-labelledby", "propertyPickerTitle");
  root.setAttribute("aria-describedby", "propertyPickerHelp");
  root.innerHTML = '<h2 id="propertyPickerTitle">' + escapeAttr(title) + '</h2>' +
    '<p id="propertyPickerHelp">Choose the investment property. You will review the statement before logging it.</p>' +
    '<div class="qfab-actions">' + ips.map(function(p){
      var owners = people.filter(function(person){ return propertyOwnershipPct(p, person, people) > 0; }).join(" / ");
      var context = [p.state, p.purchaseDate ? "Bought " + fmtDate(p.purchaseDate) : "", owners].filter(Boolean).join(" · ");
      return '<button type="button" class="qfab-action property-picker-choice" data-ipp="' + escapeAttr(p.id) + '"><span class="qfab-action-label">' + escapeAttr(p.what || "Investment property") + '</span>' +
        (context ? '<span class="qfab-action-hint">' + escapeAttr(context) + '</span>' : '') + '</button>';
    }).join("") + '</div><div class="app-dialog-actions"><button type="button" class="btn btn-ghost" data-ipp-close>Cancel</button></div>';
  document.body.appendChild(root);
  function restoreFocus(){
    var target = opener && opener.isConnected ? opener : opener && opener.id ? document.getElementById(opener.id) : null;
    function available(el){ return el && el !== document.body && el.getClientRects().length && !el.disabled && !el.closest("[inert]"); }
    if(!available(target)) target = ["bankImportPickBtn", "quickFab", "avatarBtn"].map(function(id){ return document.getElementById(id); }).find(available);
    if(target) target.focus({ preventScroll: true });
  }
  pushActiveOverlay(function(){
    root.close(); root.remove();
    if(propertyPicker === root) propertyPicker = null;
    restoreFocus();
  });
  function cancelChoice(){ if(closing) return; closing = true; requestCloseActiveOverlay(); }
  root.addEventListener("cancel", function(e){ e.preventDefault(); cancelChoice(); });
  root.addEventListener("click", function(e){
    if(closing) return;
    var bounds = root.getBoundingClientRect();
    var backdrop = e.target === root && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom);
    if(e.target.closest("[data-ipp-close]") || backdrop){ cancelChoice(); return; }
    var button = e.target.closest("[data-ipp]");
    if(!button) return;
    var chosen = ips.find(function(p){ return p.id === button.getAttribute("data-ipp"); });
    closing = true;
    requestCloseActiveOverlay().then(function(closed){
      if(!closed || request !== propertyPickerSequence) return;
      if(state !== household || investmentProperties().indexOf(chosen) === -1){ showToast("That property or statement is no longer available. Choose the statement again."); return; }
      then(chosen);
    });
  });
  root.addEventListener("keydown", function(e){
    e.stopPropagation();
    if(e.key !== "Tab") return;
    var stops = Array.from(root.querySelectorAll("button")), first = stops[0], last = stops[stops.length - 1];
    if(e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
  });
  root.showModal();
  root.querySelector("[data-ipp]").focus();
}
