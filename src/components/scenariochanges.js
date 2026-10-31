import { state } from "../state.js";
import { changesFor } from "../calc/scenariochanges.js";
import { periodsOf } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- A scenario's own changes, on Plan → Scenarios (v3.172.0, item 207) ----------------
// What a scenario does differently from the household, listed in the scenario itself — the per-line
// "Vary" that used to live on Budget and Income rows is here now. calc/scenariochanges.js keeps them.

function rowById(id){
  var r = (state.shared || []).find(function(l){ return l && l.id === id; });
  if(r) return { row: r, where: "Budget" };
  r = (state.income || []).find(function(l){ return l && l.id === id && !l.computed; });
  return r ? { row: r, where: "Income" } : null;
}
// The rows a change can be about: budget lines and income the household typed in (not computed ones).
function rowOptionsHtml(){
  var opt = function(r){ return '<option value="' + escapeAttr(r.id) + '">' + escapeAttr(r.what || "A line") + ' — ' + fmtCurrency2.format(Number(r.amount) || 0) + ' ' + escapeAttr(String(r.freq || "").toLowerCase()) + '</option>'; };
  var lines = (state.shared || []).filter(function(r){ return r && r.id; });
  var inc = (state.income || []).filter(function(r){ return r && r.id && !r.computed; });
  return '<option value="">Choose a line…</option>' +
    (lines.length ? '<optgroup label="Budget">' + lines.map(opt).join("") + '</optgroup>' : '') +
    (inc.length ? '<optgroup label="Income">' + inc.map(opt).join("") + '</optgroup>' : '');
}
export function scenarioChangesHtml(scenario){
  var amounts = changesFor(scenario).filter(function(c){ return c.kind === "amount"; });
  var rows = amounts.map(function(c){
    var hit = rowById(c.rowId);
    if(!hit) return '<div class="sc-change is-gone"><span class="sc-what">A line that has since been deleted</span>' +
      '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="Remove this change">✕</button></div>';
    var r = hit.row, today = Number(r.amount) || 0;
    var monthlyDiff = periodsOf(Number(c.amount) || 0, r.freq).monthly - periodsOf(today, r.freq).monthly;
    return '<div class="sc-change"><span class="sc-what"><b>' + escapeAttr(r.what || "A line") + '</b><small>' + hit.where + ' · today ' + fmtCurrency2.format(today) + ' ' + escapeAttr(String(r.freq || "").toLowerCase()) +
        (Math.abs(monthlyDiff) >= 0.5 ? ' · ' + (monthlyDiff > 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(monthlyDiff)) + '/mo' : '') + '</small></span>' +
      '<label class="sc-amt"><span class="visually-hidden">Amount in ' + escapeAttr(scenario) + '</span><input type="number" step="0.01" min="0" value="' + (Number(c.amount) || 0) + '" data-sc-amount="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr((r.what || "Line") + " in " + scenario + ", " + String(r.freq || "").toLowerCase()) + '"><small>' + escapeAttr(String(r.freq || "").toLowerCase()) + '</small></label>' +
      '<button type="button" class="btn btn-danger btn-sm" data-sc-del="' + escapeAttr(c.id) + '" data-sc-scenario="' + escapeAttr(scenario) + '" aria-label="' + escapeAttr("Remove the change to " + (r.what || "this line")) + '">✕</button></div>';
  }).join("");
  return '<div class="sc-changes"><div class="home-recurring-label">Changes from today</div>' +
    (rows || '<p class="ledger-note" style="margin:0 0 8px">Nothing else differs from today. A budget line or a pay that would be different here (a bigger grocery bill, three days a week) goes here.</p>') +
    '<div class="sc-add"><select data-sc-row="' + escapeAttr(scenario) + '" aria-label="A line that would be different in ' + escapeAttr(scenario) + '">' + rowOptionsHtml() + '</select>' +
      '<input type="number" step="0.01" min="0" data-sc-new-amount="' + escapeAttr(scenario) + '" placeholder="Amount, same frequency" aria-label="Its amount in ' + escapeAttr(scenario) + '">' +
      '<button type="button" class="btn btn-sm" data-sc-add="' + escapeAttr(scenario) + '">Add change</button></div></div>';
}
// The baseline's block: today's home is in Budget now, so this says where, and what it adds up to.
export function todaysHomeHtml(){
  var lines = (state.shared || []).filter(function(l){ return l && l.homeCost; });
  var total = lines.reduce(function(s, l){ return s + periodsOf(Number(l.amount) || 0, l.freq).monthly; }, 0);
  return '<div class="sc-today"><p>This is your household as it is — every other scenario is measured against it, and nothing here is a what-if.</p>' +
    (lines.length
      ? '<p class="sc-today-lines">Where you live today: ' + lines.map(function(l){ return escapeAttr(l.what) + ' ' + fmtCurrency0.format(periodsOf(Number(l.amount) || 0, l.freq).monthly) + '/mo'; }).join(" · ") + ' — <b>' + fmtCurrency0.format(total) + '/mo</b>.</p>'
      : '<p class="sc-today-lines">No home costs in Budget yet. Add rent or the home loan there, marked as Housing.</p>') +
    '<button type="button" class="btn btn-sm" data-adv-go="expenses" data-adv-sub="budget">Edit them in Budget</button></div>';
}
export function todaysHomeMonthly(){
  return (state.shared || []).filter(function(l){ return l && l.homeCost; }).reduce(function(s, l){ return s + periodsOf(Number(l.amount) || 0, l.freq).monthly; }, 0);
}
