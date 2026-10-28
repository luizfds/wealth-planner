import { state } from "../state.js";
import { goalsOverview } from "../calc/savegoals.js";
import { fmtCurrency0, fmtPercent0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Accounts → Savings goals (v3.65.0) ----------------
export var goalOpen = {};
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ym(s){ return s ? MONTHS[Number(s.slice(5, 7)) - 1] + " " + s.slice(0, 4) : ""; }
function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(n || 0)); }
var STATUS = { done: ["Reached", "ok"], "on-track": ["On track", "ok"], possible: ["Within the plan", "ok"], behind: ["Behind", "warn"], moving: ["Growing", ""], open: ["No date", ""] };

function goalLine(g){
  var bits = [];
  if(g.status === "done"){
    bits.push(g.over > 0 ? "Target reached — " + money(g.over) + " over." : "Target reached.");
    var to = g.surplusTo;
    if(to && to.kind === "goal") bits.push((to.finishes ? "Moving " + money(to.amount) + " of it would finish " : "It could go toward ") + to.name + (to.finishes ? "." : " (" + money(to.amount) + ")."));
    else if(to && to.kind === "offset") bits.push("Kept in " + to.name + " instead, it would bring the loan's interest down.");
  }
  else {
    if(g.neededMonthly != null) bits.push(money(g.neededMonthly) + "/mo needed to reach it by " + ym(g.by) + ".");
    if(g.pace != null) bits.push("Balances have moved " + (g.pace >= 0 ? "+" : "") + money(g.pace) + "/mo over the last " + g.paceMonths + " months" + (g.projected ? " — at that pace, " + ym(g.projected + "-01") + "." : "."));
    else bits.push("Update the balances now and then to see the pace.");
  }
  if(g.missing.length) bits.push(g.missing.join(", ") + (g.missing.length === 1 ? " has" : " have") + " no balance yet.");
  return bits.join(" ");
}

export function goalCardHtml(g, i, opts){
  opts = opts || {};
  var st = STATUS[g.status] || ["", ""];
  var open = !opts.compact && goalOpen[g.id];
  var head = '<div class="sgl-head"><button type="button" class="sgl-name" data-goal-toggle="' + escapeAttr(g.id) + '"' + (opts.compact ? ' data-goal-go' : '') + ' aria-expanded="' + !!open + '">' + escapeAttr(g.name) + '</button>' +
    '<span class="sgl-status ' + st[1] + '">' + st[0] + '</span></div>' +
    '<div class="sgl-amounts"><b>' + money(g.current) + '</b><span>of ' + money(g.target) + (g.by ? ' by ' + ym(g.by) : '') + ' · ' + (g.over > 0 && g.times >= 1.1 ? g.times + '× the target' : fmtPercent0.format(g.pct)) + '</span></div>' +
    '<div class="sgl-bar"><i style="width:' + Math.max(1, Math.round(g.pct * 100)) + '%"></i></div>';
  if(opts.compact) return '<div class="sgl sgl-compact">' + head + (g.over > 0 && g.surplusTo ? '<p class="sgl-hint">' + escapeAttr(g.surplusTo.kind === "goal"
      ? money(g.over) + " over — " + (g.surplusTo.finishes ? money(g.surplusTo.amount) + " of it would finish " : "it could go toward ") + g.surplusTo.name
      : money(g.over) + " over — in " + g.surplusTo.name + " it would cut the loan's interest") + '</p>' : '') + '</div>';
  var accts = (state.accounts || []).filter(function(a){ return a.name; });
  var edit = open ? '<div class="sgl-edit">' +
      '<label class="cf-filter"><span>Name</span><input type="text" data-goal-field="name" data-goal-index="' + i + '" value="' + escapeAttr(g.name) + '"></label>' +
      '<label class="cf-filter"><span>Target $</span><input type="number" min="0" step="100" data-goal-field="target" data-goal-index="' + i + '" value="' + (g.target || "") + '"></label>' +
      '<label class="cf-filter"><span>By</span><input type="date" data-goal-field="by" data-goal-index="' + i + '" value="' + escapeAttr(g.by) + '"></label>' +
      '<fieldset class="sgl-accts"><legend>Counts the balance of</legend>' + (accts.length ? accts.map(function(a){
        return '<label><input type="checkbox" data-goal-acct="' + escapeAttr(a.name) + '" data-goal-index="' + i + '"' + (g.accounts.indexOf(a.name) !== -1 ? " checked" : "") + '> ' + escapeAttr(a.name) + '</label>';
      }).join("") : '<p class="ledger-note" style="margin:0">Add an account first.</p>') + '</fieldset>' +
      '<div class="sgl-edit-foot"><button type="button" class="btn btn-ghost btn-sm acct-del" data-goal-del="' + i + '">Delete goal</button></div></div>' : '';
  return '<div class="sgl' + (open ? " is-open" : "") + '">' + head + '<p class="sgl-note">' + escapeAttr(goalLine(g)) + '</p>' + edit + '</div>';
}

export function goalsSectionHtml(today, surplusMonthly){
  var ov = goalsOverview(today || localDateStr(), surplusMonthly);
  if(!ov.goals.length) return '<p class="ledger-note" style="margin:0 0 10px">No goals yet. A goal is a target by a date — a house deposit, an emergency fund — measured on the accounts you keep it in, so it moves whenever their balances do.</p>' +
    '<button type="button" class="btn btn-sm" data-goal-add>+ Add a goal</button>';
  var cover = ov.surplusMonthly == null || !ov.neededMonthly ? '' :
    '<p class="sgl-cover ' + (ov.covered ? "ok" : "warn") + '">Your goals need <b>' + money(ov.neededMonthly) + '/mo</b> together; the plan leaves <b>' + money(ov.surplusMonthly) + '/mo</b>' +
      (ov.covered ? ' — enough.' : ' — ' + money(ov.neededMonthly - ov.surplusMonthly) + '/mo short. Push a date out, lower a target, or find it in the budget.') + '</p>';
  return cover + '<div class="sgl-list">' + ov.goals.map(function(g, i){ return goalCardHtml(g, i); }).join("") + '</div>' +
    '<div class="ledger-footer"><button type="button" class="btn btn-sm btn-ghost" data-goal-add>+ Add a goal</button></div>';
}
