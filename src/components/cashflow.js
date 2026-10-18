import { state } from "../state.js";
import { filterChoices } from "../calc/cashflowlist.js";
import { incomeTargets } from "../calc/received.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Cash flow → Spending: the unified list's controls (v3.59.0) ----------------
// components/expenses.js renders the list (its spending rows are the editable ones it always had);
// this owns what sits around them — the filters, the in/transfer rows, the bulk-edit bar, the
// transfer form and the split editor — and the session state each needs.
export var txFilters = { direction: "all", account: "", category: "", line: "", person: "", text: "" };
export var txSelect = { on: false, picked: {} };
export var transferForm = { open: false };
export var splitEditing = { idx: null, parts: [] };
export function resetTxFilters(){ txFilters.direction = "all"; txFilters.account = txFilters.category = txFilters.line = txFilters.person = txFilters.text = ""; }
export function txFiltersActive(){ return txFilters.direction !== "all" || !!(txFilters.account || txFilters.category || txFilters.line || txFilters.person || txFilters.text); }

function selectHtml(key, label, values, current, labelOf){
  return '<label class="cf-filter"><span>' + label + '</span><select data-cf-filter="' + key + '" aria-label="Filter by ' + label.toLowerCase() + '">' +
    '<option value="">All</option>' + values.map(function(v){ return '<option value="' + escapeAttr(v) + '"' + (v === current ? " selected" : "") + '>' + escapeAttr(labelOf ? labelOf(v) : v) + '</option>'; }).join("") +
    (current && values.indexOf(current) === -1 ? '<option value="' + escapeAttr(current) + '" selected>' + escapeAttr(labelOf ? labelOf(current) : current) + '</option>' : '') + '</select></label>';
}
// A filter value's label: a budget line's or income target's name rather than its id.
export function lineLabeler(lines){
  var names = {};
  (lines || []).forEach(function(l){ if(l.id) names[l.id] = l.what || "Budget line"; });
  incomeTargets().forEach(function(t){ names[t.key] = t.label; });
  return function(id){ return names[id] || id; };
}

export function filterBarHtml(entries, lines){
  var ch = filterChoices(entries);
  var labelOf = lineLabeler(lines);
  var dirs = [["all", "All"], ["out", "Spending"], ["in", "Money in"], ["transfer", "Transfers"]];
  return '<div class="cf-filters">' +
    '<div class="seg-control cf-dir" role="group" aria-label="Show">' + dirs.map(function(d){
      var on = txFilters.direction === d[0];
      return '<button type="button" class="seg-option' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-cf-dir="' + d[0] + '">' + d[1] + '</button>';
    }).join("") + '</div>' +
    '<div class="cf-filter-row">' +
      '<label class="cf-filter cf-search"><span>Search</span><input type="search" data-cf-filter="text" value="' + escapeAttr(txFilters.text) + '" placeholder="Name or account" aria-label="Search transactions"></label>' +
      selectHtml("account", "Account", ch.accounts, txFilters.account) +
      selectHtml("category", "Category", ch.categories, txFilters.category) +
      selectHtml("line", "Line", ch.lines, txFilters.line, labelOf) +
      (ch.people.length ? selectHtml("person", "Person", ch.people, txFilters.person) : '') +
    '</div>' +
    '<div class="cf-filter-actions">' +
      (txFiltersActive() ? '<button type="button" class="btn btn-sm btn-ghost" data-cf-clear>Clear filters</button>' : '') +
      '<button type="button" class="btn btn-sm btn-ghost" data-cf-select aria-pressed="' + txSelect.on + '">' + (txSelect.on ? "Done selecting" : "Select") + '</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-cf-transfer>+ Transfer</button>' +
    '</div></div>';
}

export function totalsLineHtml(t, count){
  return '<p class="cf-totals"><span>In <b class="in">' + fmtCurrency0.format(t.in) + '</b></span><span>Out <b>' + fmtCurrency0.format(t.out) + '</b></span>' +
    '<span>Net <b class="' + (t.net >= 0 ? "in" : "out") + '">' + (t.net < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(t.net)) + '</b></span><span class="cf-count">' + count + ' entr' + (count === 1 ? "y" : "ies") + '</span></p>';
}

export function inRowHtml(e){
  return '<div class="m-row cf-row cf-in"><div class="m-row-summary cf-row-summary">' +
    '<span class="cf-kind in" aria-hidden="true">↓</span>' +
    '<div class="cf-row-main"><div class="m-row-name">' + escapeAttr(e.label) + '</div><div class="m-row-sub">' + escapeAttr(e.date) + (e.account ? ' · ' + escapeAttr(e.account) : '') + ' · money in</div></div>' +
    '<div class="m-row-amt cf-amt in">+' + fmtCurrency2.format(e.amount) + '</div>' +
    '<button type="button" class="btn btn-ghost btn-sm cf-row-del" data-cf-del-in="' + escapeAttr(e.ref) + '" aria-label="Delete this money-in record">✕</button></div></div>';
}
export function transferRowHtml(e){
  return '<div class="m-row cf-row cf-transfer"><div class="m-row-summary cf-row-summary">' +
    '<span class="cf-kind transfer" aria-hidden="true">⇄</span>' +
    '<div class="cf-row-main"><div class="m-row-name">' + escapeAttr(e.label) + '</div><div class="m-row-sub">' + escapeAttr(e.date) + ' · ' + escapeAttr(e.account || "?") + ' → ' + escapeAttr(e.toAccount || "?") + '</div></div>' +
    '<div class="m-row-amt cf-amt">' + fmtCurrency2.format(e.amount) + '</div>' +
    '<button type="button" class="btn btn-ghost btn-sm cf-row-del" data-cf-del-transfer="' + escapeAttr(e.ref) + '" aria-label="Delete this transfer">✕</button></div></div>';
}
// A checkbox in front of a spending row while selecting.
export function selectBoxHtml(idx){
  return '<label class="cf-pick"><input type="checkbox" data-cf-pick="' + idx + '"' + (txSelect.picked[idx] ? " checked" : "") + ' aria-label="Select this transaction"></label>';
}

export function bulkBarHtml(lineOptionsHtml, accountOptionsHtml){
  var n = Object.keys(txSelect.picked).filter(function(k){ return txSelect.picked[k]; }).length;
  return '<div class="cf-bulk" role="region" aria-label="Edit selected transactions"><b>' + n + ' selected</b>' +
    '<button type="button" class="btn btn-sm btn-ghost" data-cf-pick-all>Select all shown</button>' +
    '<label class="cf-filter"><span>Line</span><select data-cf-bulk="line"' + (n ? "" : " disabled") + '><option value="__keep">— keep —</option>' + lineOptionsHtml + '</select></label>' +
    '<label class="cf-filter"><span>Account</span><select data-cf-bulk="account"' + (n ? "" : " disabled") + '><option value="__keep">— keep —</option>' + accountOptionsHtml + '</select></label>' +
    '<button type="button" class="btn btn-sm btn-primary" data-cf-bulk-apply' + (n ? "" : " disabled") + '>Apply</button>' +
    '<button type="button" class="btn btn-sm btn-ghost cf-danger" data-cf-bulk-delete' + (n ? "" : " disabled") + '>Delete</button></div>';
}

export function transferFormHtml(today){
  today = today || localDateStr();
  var accts = (state.accounts || []).map(function(a){ return '<option value="' + escapeAttr(a.name) + '">' + escapeAttr(a.name) + '</option>'; }).join("");
  return '<div class="cf-transfer-form" role="group" aria-label="New transfer"><b>Move money between your accounts</b>' +
    '<p class="ledger-note" style="margin:0">Not spending — paying off a card, topping up savings or an offset. It doesn\'t count in any budget total.</p>' +
    '<div class="cf-tf-grid">' +
      '<label class="cf-filter"><span>From</span><select data-tf="from">' + accts + '</select></label>' +
      '<label class="cf-filter"><span>To</span><select data-tf="to">' + accts + '</select></label>' +
      '<label class="cf-filter"><span>Amount $</span><input type="number" step="0.01" min="0" data-tf="amount" aria-label="Transfer amount"></label>' +
      '<label class="cf-filter"><span>Date</span><input type="date" data-tf="date" value="' + today + '"></label>' +
      '<label class="cf-filter cf-tf-wide"><span>Note <small>(optional)</small></span><input type="text" data-tf="what" placeholder="e.g. Card repayment"></label>' +
    '</div>' +
    '<label class="cf-tf-check"><input type="checkbox" data-tf="balances" checked> Also move the two balances (where each account has one)</label>' +
    '<div class="cf-tf-actions"><button type="button" class="btn btn-sm btn-primary" data-tf-save>Save transfer</button><button type="button" class="btn btn-sm btn-ghost" data-tf-cancel>Cancel</button></div></div>';
}

// The split editor under a spending row: one line per part, and what's left to place.
export function splitEditorHtml(t, idx, lineOptionsFor){
  var total = Number(t.amount) || 0;
  var parts = splitEditing.parts;
  var placed = parts.reduce(function(s, p){ return s + (Number(p.amount) || 0); }, 0);
  var left = Math.round((total - placed) * 100) / 100;
  return '<div class="cf-split" data-cf-split-for="' + idx + '"><b>Split ' + fmtCurrency2.format(total) + ' across budget lines</b>' +
    parts.map(function(p, i){
      return '<div class="cf-split-row"><select data-cf-split-line="' + i + '" aria-label="Part ' + (i + 1) + ' budget line">' + lineOptionsFor(p.linkedExpenseId) + '</select>' +
        '<input type="number" step="0.01" data-cf-split-amt="' + i + '" value="' + (p.amount !== "" && p.amount != null ? p.amount : "") + '" aria-label="Part ' + (i + 1) + ' amount">' +
        (parts.length > 2 ? '<button type="button" class="btn btn-ghost btn-sm" data-cf-split-del="' + i + '" aria-label="Remove part ' + (i + 1) + '">✕</button>' : '<span></span>') + '</div>';
    }).join("") +
    '<div class="cf-split-foot"><button type="button" class="btn btn-sm btn-ghost" data-cf-split-add>+ Part</button>' +
      '<span class="cf-split-left' + (Math.abs(left) >= 0.01 ? " warn" : "") + '">' + (Math.abs(left) < 0.01 ? "All placed" : fmtCurrency2.format(Math.abs(left)) + (left > 0 ? " left to place" : " too much")) + '</span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-cf-split-save' + (Math.abs(left) >= 0.01 ? " disabled" : "") + '>Save split</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-cf-split-cancel>Cancel</button></div></div>';
}

// ---------------- Cash flow → Budget: the month, planned (v3.59.0) ----------------
// Income and spending used to be planned on two different pages, and the only place they met was a
// single "monthly cash" figure in the header. This lays the plan out as one statement: each income
// line in, each spending group out, with what's left running down the right — so "where does the
// surplus go" is answered line by line. opts: { income: [{label, monthly}], groups: [{label, monthly}],
// other: number (costs not in a group, e.g. investment loan repayments), net: number }.
export function budgetPlanHtml(opts){
  var run = 0;
  var row = function(label, amount, sign, cls){
    run += sign * amount;
    return '<div class="bp-row ' + (cls || "") + '"><span>' + escapeAttr(label) + '</span><b>' + (sign < 0 ? "−" : "+") + fmtCurrency0.format(Math.abs(amount)) + '</b>' +
      '<em class="' + (run < 0 ? "neg" : "") + '">' + (run < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(run)) + '</em></div>';
  };
  var income = (opts.income || []).filter(function(r){ return Math.abs(r.monthly) >= 0.5; });
  var groups = (opts.groups || []).filter(function(g){ return Math.abs(g.monthly) >= 0.5; });
  var html = '<div class="bp-head"><span></span><span>per month</span><span>left</span></div>' +
    '<div class="bp-sec">Money in</div>' + income.map(function(r){ return row(r.label, r.monthly, 1, "in"); }).join("") +
    '<div class="bp-sec">Money out</div>' + groups.map(function(g){ return row(g.label, g.monthly, -1); }).join("") +
    (Math.abs(opts.other || 0) >= 0.5 ? row("Investment loan repayments", opts.other, -1) : "");
  var net = opts.net != null ? opts.net : run;
  return html + '<div class="bp-row bp-total"><span>Left over each month</span><b></b><em class="' + (net < 0 ? "neg" : "pos") + '">' + (net < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(net)) + '</em></div>';
}
