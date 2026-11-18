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
import { chooseOne } from "../lib/chooser.js";
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
export function chooseInvestmentProperty(title, then){
  var ips = investmentProperties(), household = state, people = getTaxPeople();
  if(!ips.length){ showToast("Add the investment property first (Net worth → Property), then log its statements there"); return; }
  if(ips.length === 1){ then(ips[0]); return; }
  // #426: the dialog is lib/chooser.js's, shared with the + sheet's "Update a balance".
  chooseOne({ title: title, help: "Choose the investment property. You will review the statement before logging it.", cls: "property-picker", attr: "ipp",
    fallbacks: ["bankImportPickBtn", "quickFab", "avatarBtn"],
    items: ips.map(function(p){
      var owners = people.filter(function(person){ return propertyOwnershipPct(p, person, people) > 0; }).join(" / ");
      return { id: p.id, label: p.what || "Investment property", hint: [p.state, p.purchaseDate ? "Bought " + fmtDate(p.purchaseDate) : "", owners].filter(Boolean).join(" · ") };
    }),
    // The very property offered, not one with its id: a household replaced meanwhile (an import, another tab's save)
    // has new objects, and logging against a stale one would write to nothing.
    valid: function(id){ var chosen = ips.find(function(p){ return p.id === id; }); return state === household && investmentProperties().indexOf(chosen) !== -1; },
    gone: "That property or statement is no longer available. Choose the statement again.",
    then: function(id){ then(ips.find(function(p){ return p.id === id; })); } });
}
