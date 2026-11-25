import { state, commit, genId } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency2 } from "../lib/format.js";
import { furnishingDecision } from "../calc/furnishing.js";
import { projectSpent, projectRemaining } from "../calc/projects.js";

var editing = null;
var money = function(n){ return fmtCurrency2.format(n); };
function options(rows, selected){
  return rows.map(function(row){
    return '<option value="' + escapeAttr(row.id) + '"' + (row.id === selected ? ' selected' : '') + '>' + escapeAttr(row.name) + '</option>';
  }).join("");
}
export function projectOptions(selected){
  return '<option value="">No project</option>' + options((state.projects || []).concat(state.trips || []), selected);
}
function field(key, label, value, type, extra){
  return '<label class="field-label">' + label + '<input class="field-control" name="' + key + '" type="' + type + '" ' + extra +
    ' value="' + escapeAttr(value == null ? "" : value) + '"></label>';
}
function editor(p){
  var links = (state.purchases || []).map(function(b){ return { id: b.id, name: b.what }; });
  if(p.purchaseId && !links.some(function(b){ return b.id === p.purchaseId; })) links.push({ id: p.purchaseId, name: p.propertyName || "Linked property" });
  return '<form class="trip-form" data-furnishing><h2 class="section-title">' + (p.id ? "Edit project" : "Add project") + '</h2><div class="trip-form-grid">' +
    field("name", "Project name", p.name, "text", "required") +
    '<label class="field-label">Kind<select class="field-control" name="kind">' + options(["Home setup","Wedding","Car","Other"].map(function(k){ return { id:k, name:k }; }), p.kind) + '</select></label>' +
    '<label class="field-label">Linked purchase<select class="field-control" name="purchaseId"><option value="">None</option>' + options(links, p.purchaseId) + '</select></label>' +
    field("budget","Budget from savings ($)",p.budget,"number",'required min="0" step="0.01"') +
    field("spent","Already spent outside linked transactions ($)",p.spent,"number",'min="0" step="0.01"') +
    field("month","Forecast remaining spending in",p.month,"month","") +
    field("cash","Expected cash after settlement before this purchase ($)",p.cash,"number",'step="0.01"') +
    field("buffer","Cash buffer to keep ($)",p.buffer,"number",'min="0" step="0.01"') +
    field("price","Try a purchase ($)",p.price,"number",'min="0" step="0.01"') +
    '</div><p role="status"></p><button class="btn" type="submit">Save project</button> <button class="btn" type="button" data-project-cancel>Cancel</button></form>';
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
export function furnishingHtml(){
  var projects = state.projects || [];
  var cards = projects.map(function(p){
    if(editing === p.id) return editor(p);
    return '<article class="trip-row project-card"><h2 class="section-title">' + escapeAttr(p.name) + '</h2><p>' + escapeAttr(p.kind) + ' · From savings' +
      (p.propertyName ? ' · ' + escapeAttr(p.propertyName) : '') + '</p><p>Budget ' + money(p.budget) + ' · Spent ' + money(projectSpent(p,state.transactions)) +
      ' · Remaining ' + money(projectRemaining(p,state.transactions)) + '</p><p>' + decision(p) + '</p><div class="trip-actions"><button class="btn" data-book-trip="' + escapeAttr(p.id) + '">Log spend</button> <button class="btn" data-sv data-sv-trip="' + escapeAttr(p.id) + '">Its transactions</button> <button class="btn" data-project-edit="' + escapeAttr(p.id) + '">Edit project</button></div></article>';
  }).join("");
  return '<h2 class="section-title">Projects</h2>' + cards + (editing === "new" ? editor({}) : '<button class="btn" data-project-edit="new">+ Add project</button>');
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
    if(form) form.querySelector('[role="status"]').textContent = decision(Object.assign(read(form), {id:editing}));
  });
  body.addEventListener("submit", function(e){
    var form = e.target.closest("[data-furnishing]");
    if(!form) return;
    e.preventDefault();
    var values = read(form);
    if(!values.name || !form.reportValidity()) return;
    var projects = state.projects;
    var proj = projects.find(function(p){ return p.id === editing; });
    if(!proj){ proj = { id: genId("project") }; projects.push(proj); }
    var link = (state.purchases || []).find(function(p){ return p.id === values.purchaseId; });
    values.propertyName = link ? link.what : values.purchaseId ? proj.propertyName : "";
    Object.assign(proj, values);
    editing = null;
    commit(["projects"]);
  });
}
