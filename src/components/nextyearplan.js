// ---------------- Next year's plan (#399, 4/5 of #390) ----------------
//
// The last section of the guided Year in review: a few goals for the year ahead, one monthly surplus shared between
// them in the order they're listed (calc/nextyearplan.js). The drafts live here, for the session only, until "Save
// these goals" adds them as ordinary savings goals. Cancel, or leaving the page and coming back, changes nothing.
import { PLAN_KINDS, EMERGENCY_CHOICES, planSurplus, planAccounts, planYearLabel, allocatePlan, savePlan } from "../calc/nextyearplan.js";
import { financialYearOf } from "../calc/property.js";
import { monthLabel } from "../calc/monthreview.js";
import { state } from "../state.js";
import { fieldHtml } from "../lib/field.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtDate } from "../lib/format.js";
import { emptyStateHtml } from "../lib/empty.js";

export var planUi = { open: false, drafts: [], seq: 0 };

// The end of the year the plan is for: a draft's date until it's changed.
function planYearEnd(today){
  return state.yearBasis === "calendar" ? today.slice(0, 4) + "-12-31" : (financialYearOf(today) + 1) + "-06-30";
}
export function startPlan(today){
  planUi.open = true;
  if(!planUi.drafts.length) addDraft("emergency", today);
}
export function addDraft(kind, today){
  planUi.seq += 1;
  planUi.drafts.push({ id: "p" + planUi.seq, kind: kind || "save", months: 6, name: "", amount: "", account: "", by: planYearEnd(today) });
}
export function cancelPlan(){ planUi.open = false; planUi.drafts = []; }
export function moveDraft(id, step){
  var i = planUi.drafts.findIndex(function(d){ return d.id === id; }), j = i + step;
  if(i < 0 || j < 0 || j >= planUi.drafts.length) return;
  var d = planUi.drafts.splice(i, 1)[0];
  planUi.drafts.splice(j, 0, d);
}
export function removeDraft(id){ planUi.drafts = planUi.drafts.filter(function(d){ return d.id !== id; }); }
// A change to one of a draft's fields. A save goal's single account is kept as its accounts list.
export function setDraftField(id, field, value){
  var d = planUi.drafts.find(function(x){ return x.id === id; });
  if(!d) return;
  if(field === "kind"){ d.kind = value; d.account = ""; return; }
  if(field === "months") d.months = Number(value) || 6;
  else if(field === "amount"){ var n = Number(String(value).replace(/[$,\s]/g, "")); d.amount = n > 0 ? n : ""; }
  else if(field === "name" || field === "account" || field === "by") d[field] = String(value || "");
}
// The calc's draft shape: a save goal sits on the one account chosen.
function asDrafts(){
  return planUi.drafts.map(function(d){ return Object.assign({}, d, { accounts: d.kind === "save" && d.account ? [d.account] : d.kind === "emergency" ? null : undefined }); });
}
export function currentPlan(today, opts){
  var s = planSurplus(today, opts);
  return { surplus: s, plan: allocatePlan(asDrafts(), s.monthly, today) };
}
// Saves the plan's goals; returns how many were added. The caller commits ["savingsGoals"].
export function savePlanGoals(today, opts){
  var added = savePlan(currentPlan(today, opts).plan, today);
  if(added.length) cancelPlan();
  return added.length;
}

function surplusText(s){
  if(!(s.monthly > 0)) return "The budget doesn't leave anything over each month" + (s.actual != null && s.actual <= 0 ? ", and last year more went out than came in" : "") + " — so nothing can go to these goals yet. Trimming the budget, or raising what comes in, makes room.";
  return "About " + fmtCurrency0.format(s.monthly) + " a month to share — " + (s.basis === "actual"
    ? "what was actually kept last year, which is less than the budget's " + fmtCurrency0.format(s.planned) + " a month."
    : "the budget's regular surplus" + (s.actual != null ? " (last year " + fmtCurrency0.format(s.actual) + " a month was kept, so the budget is the lower)." : "; with a year of money in logged, the plan takes what was actually kept if that's less."));
}
function statusText(r){
  if(r.status === "problem") return r.problem;
  if(r.status === "done") return "Already there — " + fmtCurrency0.format(r.current) + (r.target ? " of " + fmtCurrency0.format(r.target) : "") + ". Nothing to put aside.";
  var need = "Needs " + fmtCurrency0.format(r.needed) + " a month to get there by " + fmtDate(r.by, { year: true });
  if(r.status === "funded") return need + " — all of it fits.";
  if(r.status === "partial") return need + " — " + fmtCurrency0.format(r.given) + " a month fits" + (r.reach ? ", which gets there around " + monthLabel(r.reach) : "") + ".";
  return need + " — nothing left for it once the goals above are funded. Move it up, or push its date out.";
}
var STATUS_LABEL = { done: "Done", funded: "Fits", partial: "Part fits", unfunded: "Doesn't fit", problem: "Incomplete" };

function draftFieldsHtml(d, n){
  var key = function(f){ return { "data-plan-field": f, "data-plan-id": d.id }; };
  var id = function(f){ return "nyp-" + d.id + "-" + f; };
  var accounts = function(kind){
    var names = planAccounts(kind);
    if(d.account && names.indexOf(d.account) === -1) names = names.concat([d.account]);
    return [{ value: "", label: kind === "debt" ? "Choose a card or loan" : "Choose an account" }].concat(names.map(function(a){ return { value: a, label: a }; }));
  };
  var out = fieldHtml({ id: id("kind"), label: "Goal " + n, type: "select", value: d.kind, options: PLAN_KINDS.map(function(k){ return { value: k.key, label: k.label }; }), attrs: key("kind") });
  if(d.kind === "emergency") out += fieldHtml({ id: id("months"), label: "Months of essentials", type: "select", value: d.months, options: EMERGENCY_CHOICES.map(function(m){ return { value: m, label: m + " months" }; }), attrs: key("months") });
  else if(d.kind === "debt") out += fieldHtml({ id: id("account"), label: "Card or loan", type: "select", value: d.account, options: accounts("debt"), attrs: key("account") });
  else {
    out += fieldHtml({ id: id("name"), label: "What it's for", value: d.name, placeholder: "A holiday", attrs: key("name") });
    out += fieldHtml({ id: id("amount"), label: "Amount", type: "number", value: d.amount, attrs: Object.assign(key("amount"), { min: "0", step: "100", inputmode: "decimal" }) });
    out += fieldHtml({ id: id("account"), label: "Builds up in", type: "select", value: d.account, options: accounts("save"), attrs: key("account") });
  }
  return out + fieldHtml({ id: id("by"), label: "By", type: "date", value: d.by, attrs: key("by") });
}

// The section. surplus/plan from currentPlan(); today for dates.
export function nextYearPlanSectionHtml(ui, surplus, plan, today){
  var year = planYearLabel(today);
  var head = '<section class="yr-section yr-info nyp" data-yr-section="plan" aria-labelledby="yr-plan"><h3 id="yr-plan">Next year\'s plan</h3>';
  if(!ui.open) return head + '<p class="yr-verdict">' + escapeAttr("A few goals for " + year + ", each with what it needs a month — shared out of one monthly surplus, in the order you put them, so the same dollar isn't promised twice.") + '</p>' +
    '<button type="button" class="btn btn-sm" data-plan-start>Make a plan for ' + escapeAttr(year) + '</button></section>';
  var rows = {};
  plan.rows.forEach(function(r){ rows[r.id] = r; });
  var body = '<p class="yr-verdict nyp-surplus">' + escapeAttr(surplusText(surplus)) + '</p>';
  if(!ui.drafts.length) body += emptyStateHtml("No goals in the plan yet — add one, or cancel.", { done: true, className: "yr-empty" });
  body += '<ol class="nyp-goals">' + ui.drafts.map(function(d, i){
    var r = rows[d.id] || { status: "problem", problem: "" };
    return '<li class="nyp-goal nyp-' + escapeAttr(r.status) + '" data-plan-goal="' + escapeAttr(d.id) + '">' +
      '<div class="nyp-fields">' + draftFieldsHtml(d, i + 1) + '</div>' +
      '<p class="nyp-status"><span class="nyp-badge">' + escapeAttr(STATUS_LABEL[r.status] || "") + '</span> ' + escapeAttr(statusText(r)) + '</p>' +
      '<div class="nyp-actions">' +
        '<button type="button" class="btn btn-sm btn-ghost" data-plan-move="-1" data-plan-id="' + escapeAttr(d.id) + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up, goal ' + (i + 1) + '">Move up</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-plan-move="1" data-plan-id="' + escapeAttr(d.id) + '"' + (i === ui.drafts.length - 1 ? ' disabled' : '') + ' aria-label="Move down, goal ' + (i + 1) + '">Move down</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-plan-remove="' + escapeAttr(d.id) + '" aria-label="Remove goal ' + (i + 1) + '">Remove</button>' +
      '</div></li>';
  }).join("") + '</ol>';
  body += '<button type="button" class="btn btn-sm btn-ghost nyp-add" data-plan-add>+ Add goal</button>';
  var saveable = plan.rows.filter(function(r){ return r.status !== "problem" && r.status !== "done"; }).length;
  body += '<dl class="yr-recon-lines nyp-sum">' +
    '<div><dt>Shared out a month</dt><dd>' + fmtCurrency0.format(plan.used) + '</dd></div>' +
    '<div class="yr-recon-total"><dt>Left over a month</dt><dd>' + fmtCurrency0.format(plan.left) + '</dd></div></dl>';
  body += '<p class="yr-detail">Saving adds each complete goal to Goals as an ordinary savings goal, with what the plan gives it a month. Goals already there, and ones still missing something, aren\'t saved.</p>';
  body += '<div class="nyp-foot"><button type="button" class="btn btn-sm" data-plan-save' + (saveable ? '' : ' disabled') + '>Save ' + (saveable === 1 ? "this goal" : "these goals") + '</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-plan-cancel>Cancel</button></div>';
  return head + body + '</section>';
}
export function nextYearPlanHtml(opts){
  var today = opts.today;
  var c = currentPlan(today, opts);
  return nextYearPlanSectionHtml(planUi, c.surplus, c.plan, today);
}
