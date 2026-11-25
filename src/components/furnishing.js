import { state, commit, genId } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { furnishingDecision } from "../calc/furnishing.js";
import { projectSpent, projectRemaining } from "../calc/projects.js";

import { addTrip, updateTrip } from "../calc/trips.js";
import { budgetLineOptgroupsHtml } from "./expenses.js";

var editing = null;
var money = function(n){ return fmtCurrency2.format(n); };
function options(rows, selected){
  return rows.map(function(row){
    return '<option value="' + escapeAttr(row.id) + '"' + (row.id === selected ? ' selected' : '') + '>' + escapeAttr(row.name) + '</option>';
  }).join("");
}
export function projectOptions(selected){
  return '<option value="">No event budget</option>' + options((state.projects || []).concat(state.trips || []), selected);
}
function field(key, label, value, type, extra){
  return '<label class="field-label">' + label + '<input class="field-control" name="' + key + '" type="' + type + '" ' + extra +
    ' value="' + escapeAttr(value == null ? "" : value) + '"></label>';
}
function editor(p){
  var links = (state.purchases || []).concat(state.properties || []).map(function(b){ return { id: b.id, name: b.what }; });
  if(p.purchaseId && !links.some(function(b){ return b.id === p.purchaseId; })) links.push({ id: p.purchaseId, name: p.propertyName || "Linked property" });
  return '<form class="trip-form" data-furnishing><h2 class="section-title">' + (p.id ? "Edit budget" : "Add budget") + '</h2><div class="trip-form-grid">' +
    field("name", "Event name", p.name, "text", "required") +
    field("budget","Budget ($)",p.budget,"number",'required min="0" step="0.01"') +
    (p.id && !p.lineId ? '<p>Paid from savings</p>' : '<label class="field-label">Paid from<select class="field-control" name="lineId">' + (p.id ? "" : '<option value="">Savings</option>') + budgetLineOptgroupsHtml(p.lineId || "") + '</select></label>') +
    '</div><details><summary>Dates and property</summary><div class="trip-form-grid">' +
    field("from","Starts",p.from,"date","") + field("to","Ends",p.to,"date","") +
    '<label class="field-label">Linked property<select class="field-control" name="purchaseId"><option value="">None</option>' + options(links, p.purchaseId) + '</select></label>' +
    field("month","Forecast month",p.month,"month","") + '</div></details><details data-savings-only' + (p.lineId ? " hidden" : "") + '><summary>Spending and purchase estimate</summary><div class="trip-form-grid">' +
    field("spent","Already spent outside linked transactions ($)",p.spent,"number",'min="0" step="0.01"') +
    field("cash","Expected cash after settlement before this purchase ($)",p.cash,"number",'step="0.01"') +
    field("buffer","Cash buffer to keep ($)",p.buffer,"number",'min="0" step="0.01"') +
    field("price","Try a purchase ($)",p.price,"number",'min="0" step="0.01"') +
    '</div><p role="status"></p></details><button class="btn" type="submit">Save budget</button> <button class="btn" type="button" data-project-cancel>Cancel</button></form>';
}
function decision(p){
  if(p.cash == null || p.buffer == null || p.budget == null) return "";
  var d = furnishingDecision(p.budget, projectSpent(p,state.transactions), p.cash,p.buffer,p.price || 0);
  return money(d.available) + " available before settlement." + (p.price == null ? "" : " Cash after buying: " + money(d.after) + ", " +
    money(Math.abs(d.bufferMargin)) + (d.bufferMargin < 0 ? " below" : " above") + " your buffer.");
}
function read(form){
  var data = Object.fromEntries(new FormData(form));
  ["budget","spent","cash","buffer","price"].forEach(function(k){ data[k] = data[k] === "" ? null : Number(data[k]); });
  data.name = data.name.trim();
  return data;
}
export function projectBudgetBarHtml(spent, budget){
  if(!(budget > 0)) return "";
  var pct = Math.max(0, Math.min(100, Math.round(spent / budget * 100)));
  return '<div class="trip-bar' + (spent > budget ? " is-over" : "") + '" role="img" aria-label="' + escapeAttr(fmtCurrency0.format(spent) + " of " + fmtCurrency0.format(budget)) + '"><span style="width:' + pct + '%"></span></div>';
}

export function eventEditorHtml(event){ return editing === event.id ? editor(event) : ""; }

export function furnishingHtml(){
  var projects = state.projects || [];
  var cards = projects.map(function(p){
    if(editing === p.id) return editor(p);
    var spent = projectSpent(p,state.transactions);
    return '<article class="trip-row project-card"><h2 class="section-title">' + escapeAttr(p.name) + '</h2><p>' + 'Paid from savings' +
      (p.propertyName ? ' · ' + escapeAttr(p.propertyName) : '') + '</p><div class="trip-figures"><b class="trip-spent">' + money(spent) + '</b><span>of ' + money(p.budget) + '</span></div>' + projectBudgetBarHtml(spent,p.budget) +
      '<p>Remaining ' + money(projectRemaining(p,state.transactions)) + '</p>' + (decision(p) ? '<details><summary>Can I buy this now?</summary><p>' + decision(p) + '</p></details>' : '') + '<div class="trip-actions"><button class="btn" data-book-trip="' + escapeAttr(p.id) + '">Log purchase</button> <button class="btn" data-sv data-sv-trip="' + escapeAttr(p.id) + '">Its transactions</button> <button class="btn" data-project-edit="' + escapeAttr(p.id) + '">Edit budget</button></div></article>';
  }).join("");
  return '<div class="event-heading"><h2 class="section-title">Event budgets</h2>' + (editing === "new" ? '' : '<button class="btn" data-project-edit="new">+ Add budget</button>') + '</div>' + (editing === "new" ? editor({}) : '') + cards;
}
export function wireFurnishing(body, redraw){
  body.addEventListener("click", function(e){
    var edit = e.target.closest("[data-project-edit]");
    if(!edit && !e.target.closest("[data-project-cancel]")) return;
    editing = edit ? edit.dataset.projectEdit : null;
    redraw();
    var target = body.querySelector("[data-furnishing] input") || body.querySelector("[data-project-edit]");
    if(target) target.focus();
  });
  body.addEventListener("input", function(e){
    var form = e.target.closest("[data-furnishing]");
    if(form) form.elements.to.setCustomValidity("");
    if(form) form.querySelector('[role="status"]').textContent = decision(Object.assign(read(form), {id:editing}));
  });
  body.addEventListener("change", function(e){
    if(e.target.matches("[data-furnishing] [name=lineId]")) e.target.form.querySelector("[data-savings-only]").hidden = !!e.target.value;
  });
  body.addEventListener("submit", function(e){
    var form = e.target.closest("[data-furnishing]");
    if(!form) return;
    e.preventDefault();
    var values = read(form);
    if(!values.name || !form.reportValidity()) return;
    if(values.from && values.to && values.to < values.from){
      form.elements.to.setCustomValidity("End date must follow the start date."); form.elements.to.reportValidity(); return;
    }
    if(values.lineId){
      var event = editing === "new" ? addTrip(state, values, function(){ return genId("trip"); }) : updateTrip(state, editing, values);
      event.purchaseId = values.purchaseId;
      editing = null;
      commit(["trips"]);
      return;
    }
    var projects = state.projects;
    var proj = projects.find(function(p){ return p.id === editing; });
    if(!proj){ proj = { id: genId("project") }; projects.push(proj); }
    var link = (state.purchases || []).concat(state.properties || []).find(function(p){ return p.id === values.purchaseId; });
    values.propertyName = link ? link.what : values.purchaseId ? proj.propertyName : "";
    Object.assign(proj, values);
    editing = null;
    commit(["projects"]);
  });
}
