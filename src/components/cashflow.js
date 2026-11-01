import { state } from "../state.js";
import { filterChoices } from "../calc/cashflowlist.js";
import { incomeTargets } from "../calc/received.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { usualCardSource } from "../calc/bills.js";
import { emptyFilter, filterOf, filterActive, effectiveFilter, viewMatching, describeFilter } from "../calc/txviews.js";

// ---------------- Cash flow → Spending: the unified list's controls (v3.59.0) ----------------
// components/expenses.js renders the list (its spending rows are the editable ones it always had);
// this owns what sits around them — the filters, the in/transfer rows, the bulk-edit bar, the
// transfer form and the split editor — and the session state each needs.
// v3.168.0: trip, an amount range and dates too, and the lot can be saved as a view (calc/txviews.js).
export var txFilters = emptyFilter();
export var txViewForm = { open: false };
export var txSelect = { on: false, picked: {} };
export var transferForm = { open: false };
export var splitEditing = { idx: null, parts: [] };
export function resetTxFilters(){ Object.assign(txFilters, emptyFilter()); txViewForm.open = false; }
export function txFiltersActive(){ return filterActive(txFilters); }
// The filters as the list applies them — a trip becomes its dates.
export function currentTxFilter(){ return effectiveFilter(txFilters, state.trips); }

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

// v3.138.0: one row — search, a Filters button carrying how many are on, Select and + Transfer. The
// four dropdowns open under it on request, and while they're closed each filter that's on shows as
// a chip that clears it. On a phone the first transaction is now on the first screen. The
// direction (All / Spending / Money in / Transfers) sits with the Month / Year / All control above.
export var txFilterPanel = { open: false };
var FILTER_KEYS = [["account"], ["category"], ["line"], ["person"], ["trip"], ["min"], ["max"], ["from"], ["to"]];
function tripName(id){ var t = (state.trips || []).find(function(x){ return x.id === id; }); return t ? t.name || "Trip" : "A deleted trip"; }
function inputHtml(key, label, type, value, extra){
  return '<label class="cf-filter"><span>' + label + '</span><input type="' + type + '" data-cf-filter="' + key + '" value="' + escapeAttr(value || "") + '" aria-label="Filter: ' + label.toLowerCase() + '"' + (extra || '') + '></label>';
}
// The saved views as chips over the list; the one you're on is marked. With filters set that aren't a
// view yet, "Save view" names them; on a view, it can be deleted.
export function viewsBarHtml(){
  var views = state.txViews || [];
  var on = viewMatching(views, txFilters);
  var active = filterActive(txFilters);
  if(!views.length && !active) return "";
  var chips = views.map(function(v){
    var cur = on && on.id === v.id;
    return '<button type="button" class="cf-view' + (cur ? " active" : "") + '" aria-pressed="' + !!cur + '" data-cf-view="' + escapeAttr(v.id) + '">' + escapeAttr(v.name) + '</button>';
  }).join("");
  var tail = txViewForm.open
    ? '<span class="cf-view-form"><input type="text" data-cf-view-name maxlength="40" placeholder="Name this view" aria-label="Name for this view">' +
        '<button type="button" class="btn btn-sm btn-primary" data-cf-view-confirm>Save</button><button type="button" class="btn btn-sm btn-ghost" data-cf-view-cancel>Cancel</button></span>'
    : on ? '<button type="button" class="btn btn-sm btn-danger" data-cf-view-del="' + escapeAttr(on.id) + '">Delete view</button>'
    : active ? '<button type="button" class="btn btn-sm btn-ghost" data-cf-view-save>Save view</button>' : '';
  return '<div class="cf-views" role="group" aria-label="Saved views">' + (views.length ? '<span class="cf-views-k">Views</span>' : '') + chips + tail + '</div>';
}
export function directionControlHtml(){
  var dirs = [["all", "All"], ["out", "Spending"], ["in", "Money in"], ["transfer", "Transfers"]];
  return '<div class="seg-control cf-dir" role="group" aria-label="Show">' + dirs.map(function(d){
    var on = txFilters.direction === d[0];
    return '<button type="button" class="seg-option' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-cf-dir="' + d[0] + '">' + d[1] + '</button>';
  }).join("") + '</div>';
}
export function filterBarHtml(entries, lines){
  var ch = filterChoices(entries);
  var labelOf = lineLabeler(lines);
  var on = FILTER_KEYS.filter(function(k){ return txFilters[k[0]]; });
  var chips = !txFilterPanel.open && on.length ? '<div class="cf-chips">' + on.map(function(k){
    var d = describeFilter(k[0], txFilters[k[0]], { lineName: labelOf, tripName: tripName, date: fmtDate });
    return '<button type="button" class="cf-chip" data-cf-chip-clear="' + k[0] + '" aria-label="' + escapeAttr("Remove filter " + d.text) + '">' + escapeAttr(d.label + d.sep) + '<b>' + escapeAttr(d.value) + '</b> <span aria-hidden="true">✕</span></button>';
  }).join("") + '</div>' : '';
  return '<div class="cf-filters">' +
    '<div class="cf-toolbar">' +
      '<input type="search" class="cf-search-input" data-cf-filter="text" value="' + escapeAttr(txFilters.text) + '" placeholder="Search name or account" aria-label="Search transactions">' +
      '<button type="button" class="btn btn-sm btn-ghost cf-more-btn" data-cf-panel aria-expanded="' + txFilterPanel.open + '" aria-controls="cfFilterRow">Filters' + (on.length ? ' <span class="cf-badge">' + on.length + '</span>' : '') + '</button>' +
      '<span class="cf-filter-actions">' +
        (txFiltersActive() ? '<button type="button" class="btn btn-sm btn-ghost" data-cf-clear>Clear</button>' : '') +
        '<button type="button" class="btn btn-sm btn-ghost" data-cf-select aria-pressed="' + txSelect.on + '">' + (txSelect.on ? "Done selecting" : "Select") + '</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-cf-transfer>+ Transfer</button>' +
      '</span>' +
    '</div>' +
    (txFilterPanel.open ? '<div class="cf-filter-row" id="cfFilterRow">' +
      selectHtml("account", "Account", ch.accounts, txFilters.account) +
      selectHtml("category", "Category", ch.categories, txFilters.category) +
      selectHtml("line", "Line", ch.lines, txFilters.line, labelOf) +
      (ch.people.length ? selectHtml("person", "Person", ch.people, txFilters.person) : '') +
      ((state.trips || []).length ? selectHtml("trip", "Trip", state.trips.map(function(t){ return t.id; }), txFilters.trip, tripName) : '') +
      inputHtml("min", "Amount from", "number", txFilters.min, ' min="0" step="0.01" inputmode="decimal"') +
      inputHtml("max", "Amount up to", "number", txFilters.max, ' min="0" step="0.01" inputmode="decimal"') +
      inputHtml("from", "Date from", "date", txFilters.from) +
      inputHtml("to", "Date to", "date", txFilters.to) +
    '</div>' : '') + chips +
  '</div>';
}

export function totalsLineHtml(t, count){
  return '<p class="cf-totals"><span>In <b class="in">' + fmtCurrency0.format(t.in) + '</b></span><span>Out <b>' + fmtCurrency0.format(t.out) + '</b></span>' +
    '<span>Net <b class="' + (t.net >= 0 ? "in" : "out") + '">' + (t.net < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(t.net)) + '</b></span><span class="cf-count">' + count + ' entr' + (count === 1 ? "y" : "ies") + '</span></p>';
}

var BIN = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>';
// v3.138.0: the list reads by day — a header per date, so the rows under it needn't repeat it.
// "Today" and "Yesterday" by name; the year only when it isn't this one.
export function dayHeaderHtml(date, today){
  today = today || localDateStr();
  var y = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  var d = new Date(date + "T00:00:00");
  var label = date === today ? "Today" : date === y ? "Yesterday" :
    d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" }).replace(",", "");
  return '<h3 class="cf-day">' + escapeAttr(label) + '</h3>';
}
export function inRowHtml(e){
  return '<div class="m-row cf-row cf-in"><div class="m-row-summary cf-row-summary">' +
    '<span class="cf-kind in" aria-hidden="true">↓</span>' +
    '<div class="cf-row-main"><div class="m-row-name">' + escapeAttr(e.label) + '</div><div class="m-row-sub">' + (e.account ? escapeAttr(e.account) + ' · ' : '') + 'money in</div></div>' +
    '<div class="m-row-amt cf-amt in">+' + fmtCurrency2.format(e.amount) + '</div>' +
    '<button type="button" class="btn btn-danger btn-sm cf-row-del" data-cf-del-in="' + escapeAttr(e.ref) + '" aria-label="Delete this money-in record" title="Delete">' + BIN + '</button></div></div>';
}
export function transferRowHtml(e){
  return '<div class="m-row cf-row cf-transfer"><div class="m-row-summary cf-row-summary">' +
    '<span class="cf-kind transfer" aria-hidden="true">⇄</span>' +
    '<div class="cf-row-main"><div class="m-row-name">' + escapeAttr(e.label) + '</div><div class="m-row-sub">' + escapeAttr(e.account || "?") + ' → ' + escapeAttr(e.toAccount || "?") + '</div></div>' +
    '<div class="m-row-amt cf-amt">' + fmtCurrency2.format(e.amount) + '</div>' +
    '<button type="button" class="btn btn-danger btn-sm cf-row-del" data-cf-del-transfer="' + escapeAttr(e.ref) + '" aria-label="Delete this transfer" title="Delete">' + BIN + '</button></div></div>';
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
    '<button type="button" class="btn btn-sm btn-danger cf-danger" data-cf-bulk-delete' + (n ? "" : " disabled") + '>Delete</button></div>';
}

// transferForm.preset (v3.141.0): { from, to, amount, what } to open it filled in — "Pay a card".
// v3.144.0: the accounts grouped by kind, so an offset and the loan it sits against — which often
// share most of a name — can't be mistaken for each other in one long list.
var TF_GROUPS = [["Everyday & savings", { everyday: 1, savings: 1 }], ["Offsets", { offset: 1 }], ["Credit cards", { credit: 1 }], ["Loans", { loan: 1 }]];
export function transferAccountOptionsHtml(accounts, sel){
  var opt = function(a){ return '<option value="' + escapeAttr(a.name) + '"' + (a.name === sel ? " selected" : "") + '>' + escapeAttr(a.name) + '</option>'; };
  var list = accounts || [], used = {};
  var html = TF_GROUPS.map(function(g){
    var rows = list.filter(function(a){ return g[1][a.type]; });
    rows.forEach(function(a){ used[a.name] = 1; });
    return rows.length ? '<optgroup label="' + g[0] + '">' + rows.map(opt).join("") + '</optgroup>' : "";
  }).join("");
  var rest = list.filter(function(a){ return !used[a.name]; });
  return html + (rest.length ? '<optgroup label="Other">' + rest.map(opt).join("") + '</optgroup>' : "");
}
// A word under the form when a card repayment's From looks wrong: a loan or another card (it reads
// as borrowing more), or not the account the card is paid from by direct debit.
export function transferHint(from, to, accounts, transfers){
  var byName = {}; (accounts || []).forEach(function(a){ byName[a.name] = a; });
  var f = byName[from], t = byName[to];
  if(!f || !t || t.type !== "credit" || from === to) return "";
  var usual = usualCardSource(t, accounts, transfers);
  var tail = usual && usual !== from ? " " + to + " is usually paid from " + usual + "." : "";
  if(f.type === "loan") return "That's a loan — paying the card from it adds to what's owed on the loan." + tail;
  if(f.type === "credit") return "That's another card — paying one card with another just moves the debt." + tail;
  if(t.autoPayFrom && t.autoPayFrom !== from) return to + " is paid by direct debit from " + t.autoPayFrom + ".";
  return "";
}

export function transferFormHtml(today){
  today = today || localDateStr();
  var pre = transferForm.preset || {};
  var accts = function(sel){ return transferAccountOptionsHtml(state.accounts, sel); };
  var hint = pre.from && pre.to ? transferHint(pre.from, pre.to, state.accounts, state.transfers) : "";
  return '<div class="cf-transfer-form" role="group" aria-label="New transfer"><b>Move money between your accounts</b>' +
    '<p class="ledger-note" style="margin:0">Not spending — paying off a card, topping up savings or an offset. It doesn\'t count in any budget total.</p>' +
    '<div class="cf-tf-grid">' +
      '<label class="cf-filter"><span>From</span><select data-tf="from">' + accts(pre.from) + '</select></label>' +
      '<label class="cf-filter"><span>To</span><select data-tf="to">' + accts(pre.to) + '</select></label>' +
      '<label class="cf-filter"><span>Amount $</span><input type="number" step="0.01" min="0" data-tf="amount" aria-label="Transfer amount" value="' + (pre.amount > 0 ? pre.amount : "") + '"></label>' +
      '<label class="cf-filter"><span>Date</span><input type="date" data-tf="date" value="' + today + '"></label>' +
      '<label class="cf-filter cf-tf-wide"><span>Note <small>(optional)</small></span><input type="text" data-tf="what" placeholder="e.g. Card repayment" value="' + escapeAttr(pre.what || "") + '"></label>' +
    '</div>' +
    '<p class="cf-tf-hint" data-tf-hint' + (hint ? '' : ' hidden') + '>' + escapeAttr(hint) + '</p>' +
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
        (parts.length > 2 ? '<button type="button" class="btn btn-danger btn-sm" data-cf-split-del="' + i + '" aria-label="Remove part ' + (i + 1) + '">✕</button>' : '<span></span>') + '</div>';
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
  var all = (opts.income || []).filter(function(r){ return Math.abs(r.monthly) >= 0.5; });
  // v3.139.0 (item 172): a bonus comes once a year, so it isn't part of a normal month — the header
  // and Home leave it out, and this said "each month" with it spread in. Now the normal month first,
  // then the bonuses averaged over the year, each total labelled for what it is.
  var income = all.filter(function(r){ return !r.oneOff; }), bonuses = all.filter(function(r){ return r.oneOff; });
  var groups = (opts.groups || []).filter(function(g){ return Math.abs(g.monthly) >= 0.5; });
  var total = function(label, v){ return '<div class="bp-row bp-total"><span>' + label + '</span><b></b><em class="' + (v < 0 ? "neg" : "pos") + '">' + (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v)) + '</em></div>'; };
  var html = '<div class="bp-head"><span></span><span>per month</span><span>left</span></div>' +
    // v3.151.0: money in can be negative — tax to pay at lodgement, pay that has stopped.
    '<div class="bp-sec">Money in</div>' + income.map(function(r){ return row(r.label, Math.abs(r.monthly), r.monthly < 0 ? -1 : 1, "in"); }).join("") +
    '<div class="bp-sec">Money out</div>' + groups.map(function(g){ return row(g.label, g.monthly, -1); }).join("") +
    (Math.abs(opts.other || 0) >= 0.5 ? row("Investment loan repayments", opts.other, -1) : "");
  if(!bonuses.length){
    var net = opts.net != null ? opts.net : run;
    return html + total("Left over each month", net);
  }
  var normal = run;
  html += total("Left over in a normal month", normal);
  html += '<div class="bp-sec">Once a year, averaged over twelve months</div>' + bonuses.map(function(r){ return row(r.label, Math.abs(r.monthly), r.monthly < 0 ? -1 : 1, "in"); }).join("");
  return html + total("Left over a month across the year", opts.net != null ? opts.net : run);
}

// ---------------- Cash flow → Bills (v3.60.0) ----------------
// The selected month as a calendar (Monday first), each day with its bills — ticked when paid,
// red when past and unpaid — and the same list underneath, which is what a phone mostly reads.
var CAL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function billsCalendarHtml(data, ym, today){
  today = today || localDateStr();
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var mon = CAL_MONTHS[m - 1];
  function short(iso){ return Number(iso.slice(8, 10)) + ' ' + CAL_MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3); }
  function st(b){ return b.paid ? "paid" : b.overdue ? "overdue" : ""; }
  var pays = data.cardPayments || [];
  var payOn = {};
  pays.forEach(function(p){ (payOn[p.date] = payOn[p.date] || []).push(p); });
  // v3.196.0: automatic payments between your own accounts — paid once confirmed (or a transfer matches).
  var autos = data.autoPays || [], autoOn = {};
  function apSt(p){ return p.status === "paid" ? "paid" : p.status === "due" ? "overdue" : p.status === "skipped" ? "skipped" : ""; }
  autos.forEach(function(p){ (autoOn[p.date] = autoOn[p.date] || []).push(p); });
  var first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate();
  var lead = (first.getDay() + 6) % 7;
  var cells = [];
  for(var i = 0; i < lead; i++) cells.push('<div class="bc-cell is-blank" aria-hidden="true"></div>');
  for(var d = 1; d <= daysIn; d++){
    var key = ym + "-" + String(d).padStart(2, "0");
    // The card repayment first: it's the money actually leaving the bank that day.
    var chips = (payOn[key] || []).map(function(p){ return { what: p.card + " payment", amount: p.amount, cls: "card-pay " + st(p), title: p.card + " payment " + fmtCurrency0.format(p.amount) + (p.assumed ? " — paid by direct debit from " + p.autoPayFrom + " (not logged)" : p.paid ? " — paid" : p.overdue ? " — not logged yet" : p.autoPayFrom ? " — by direct debit from " + p.autoPayFrom : "") }; })
      .concat((autoOn[key] || []).map(function(p){ return { what: p.what, amount: p.amount, cls: "auto-pay " + apSt(p), title: p.what + " " + fmtCurrency0.format(p.amount) + " — automatic, " + p.from + " → " + p.to + (p.status === "paid" ? " — paid" : p.status === "skipped" ? " — skipped" : p.status === "due" ? " — not confirmed yet" : "") }; }))
      .concat((data.days[key] || []).map(function(b){ return { what: b.what, amount: b.amount, cls: (b.card ? "on-card " : "") + (b.agent ? "by-agent " : "") + st(b), title: b.what + " " + fmtCurrency0.format(b.amount) + (b.card ? " on the " + b.card + (b.payOn ? ", paid with the " + short(b.payOn) + " repayment" : "") : "") + (b.agent ? " — paid by " + b.agent + " from the rent" : "") + (b.paid ? " — paid" : b.overdue ? " — not logged yet" : "") }; }));
    cells.push('<div class="bc-cell' + (key === today ? " is-today" : "") + (chips.length ? " has-bills" : "") + '"><span class="bc-day">' + d + '</span>' +
      chips.slice(0, 3).map(function(c){ return '<span class="bc-bill ' + c.cls.trim() + '" title="' + escapeAttr(c.title) + '">' + escapeAttr(c.what) + '</span>'; }).join("") +
      (chips.length > 3 ? '<span class="bc-more">+' + (chips.length - 3) + '</span>' : '') +
      (chips.length ? '<span class="bc-dots" aria-hidden="true">' + chips.map(function(c){ return '<i class="' + c.cls.trim() + '"></i>'; }).join("") + '</span>' : '') + '</div>');
  }
  var head = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function(n){ return '<div class="bc-head">' + n + '</div>'; }).join("");
  var all = [];
  Object.keys(data.days).sort().forEach(function(k){ data.days[k].forEach(function(b){ all.push(b); }); });
  function row(date, name, sub, st, amount){
    return '<li class="' + st + '"><span class="bc-list-date">' + short(date) + '</span><span class="bc-list-name">' + name + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
      '<span class="bc-list-state">' + (st === "paid" ? "paid ✓" : st === "overdue" ? "not logged" : date === today ? "today" : "due") + '</span><b>' + fmtCurrency0.format(amount) + '</b></li>';
  }
  var direct = all.filter(function(b){ return !b.card && !b.agent; }).map(function(b){ return { date: b.date, html: row(b.date, escapeAttr(b.what), "", st(b), b.amount) }; })
    .concat(pays.map(function(p){
      var parts = [];
      if(p.split){
        if(p.split.bills) parts.push(fmtCurrency0.format(p.split.bills) + ' bills');
        if(p.split.spending) parts.push(fmtCurrency0.format(p.split.spending) + ' spending budgets');
        if(p.split.other) parts.push(fmtCurrency0.format(p.split.other) + ' other');
      }
      var sub = 'Everything charged ' + short(p.cycle.start) + ' – ' + short(p.cycle.end) + (p.paid ? '' : p.open ? ', so far' : '') + (parts.length ? ': ' + parts.join(' · ') : '');
      return { date: p.date, html: row(p.date, '<span class="bc-card-tag">Card</span>' + escapeAttr(p.card) + ' payment', sub, st(p), p.amount) };
    }))
    .concat(autos.map(function(p){
      var stt = apSt(p) === "overdue" ? "confirm" : apSt(p);
      return { date: p.date, html: '<li class="' + stt + '"><span class="bc-list-date">' + short(p.date) + '</span><span class="bc-list-name"><span class="bc-card-tag">Auto</span>' + escapeAttr(p.what) + '<small>' + escapeAttr(p.from) + ' → ' + escapeAttr(p.to) + '</small></span>' +
        '<span class="bc-list-state">' + (p.status === "paid" ? "paid ✓" : p.status === "skipped" ? "skipped" : p.status === "due" ? "to confirm" : p.date === today ? "today" : "due") + '</span><b>' + fmtCurrency0.format(p.amount) + '</b></li>' };
    }))
    .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var onCard = all.filter(function(b){ return b.card; });
  var cardsUsed = onCard.map(function(b){ return b.card; }).filter(function(c, i, arr){ return arr.indexOf(c) === i; });
  var list = '';
  if(direct.length) list += '<h3 class="bc-sec">From your accounts</h3><ul class="bc-list">' + direct.map(function(x){ return x.html; }).join("") + '</ul>';
  cardsUsed.forEach(function(c){
    var bills = onCard.filter(function(b){ return b.card === c; });
    var sum = bills.reduce(function(s, b){ return s + b.amount; }, 0);
    list += '<h3 class="bc-sec">Bills on the ' + escapeAttr(c) + ' <span>' + fmtCurrency0.format(sum) + ' — charged here, paid together with everything else on the card</span></h3><ul class="bc-list is-card">' +
      bills.map(function(b){ return row(b.date, escapeAttr(b.what), b.payOn ? 'with the ' + short(b.payOn) + ' payment' : '', st(b), b.amount); }).join("") + '</ul>';
  });
  // v3.101.0: what the property manager pays out of the rent — on the statement, not a debit.
  var byAgent = all.filter(function(b){ return b.agent; });
  if(byAgent.length){
    var agentSum = byAgent.reduce(function(s, b){ return s + b.amount; }, 0);
    list += '<h3 class="bc-sec">Paid by the property manager <span>' + fmtCurrency0.format(agentSum) + ' — taken out of the rent, so nothing leaves your accounts</span></h3><ul class="bc-list is-agent">' +
      byAgent.map(function(b){
        return '<li class="' + (b.paid ? "paid" : "") + '"><span class="bc-list-date">' + short(b.date) + '</span><span class="bc-list-name">' + escapeAttr(b.what) + '<small>' + escapeAttr(b.agent) + '</small></span>' +
          '<span class="bc-list-state">' + (b.paid ? "paid ✓" : "from rent") + '</span><b>' + fmtCurrency0.format(b.amount) + '</b></li>';
      }).join("") + '</ul>';
  }
  if(!list) list = '<p class="ledger-note" style="margin:8px 0 0">No dated bills in ' + mon + '. A bill gets a day once a payment has been logged against its budget line.</p>';
  var spend = (data.spending || []).length ? '<h3 class="bc-sec">Spending budgets in ' + mon + ' <span>not bills — many purchases, so no day</span></h3><ul class="bc-spend">' +
    data.spending.map(function(sp){
      var pct = sp.budget > 0 ? Math.min(100, Math.round(sp.spent / sp.budget * 100)) : 0;
      var over = sp.budget > 0 && sp.spent > sp.budget;
      return '<li' + (over ? ' class="over"' : '') + '><span class="bc-list-name">' + escapeAttr(sp.what) + '</span><b>' + fmtCurrency0.format(sp.spent) + ' <small>of ' + fmtCurrency0.format(sp.budget) + '</small></b>' +
        '<span class="bc-spend-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></li>';
    }).join("") + '</ul>' : '';
  var stopped = (data.stopped || []).length ? '<h3 class="bc-sec">Stopped? <span>no payment for a while, so left off the calendar</span></h3><ul class="bc-stopped">' +
    data.stopped.map(function(sp){
      return '<li><span class="bc-list-name">' + escapeAttr(sp.what) + '<small>Last paid ' + short(sp.last) + ' ' + sp.last.slice(0, 4) + '</small></span>' +
        '<button type="button" class="link-btn bc-end" data-bc-end="' + escapeAttr(sp.id) + '" data-bc-end-date="' + escapeAttr(sp.last) + '">It ended then</button></li>';
    }).join("") + '</ul>' : '';
  var undated = data.undated.length ? '<details class="bc-undated"><summary>' + data.undated.length + ' regular line' + (data.undated.length === 1 ? "" : "s") + ' with no payment logged yet, so no day</summary><p class="ledger-note" style="margin:4px 0">' +
    data.undated.map(function(u){ return escapeAttr(u.what); }).join(", ") + '</p></details>' : '';
  var kinds = (data.kinds || []).length ? '<details class="bc-kinds"><summary>Bill or spending budget? Change how a line is treated</summary><p class="ledger-note" style="margin:4px 0 6px">Worked out from what\'s logged: about one payment a period is a bill; many purchases of varying size is a spending budget.</p><ul>' +
    data.kinds.map(function(k){
      return '<li><span>' + escapeAttr(k.what) + '</span><select class="bc-kind" data-bc-kind="' + escapeAttr(k.id) + '" aria-label="' + escapeAttr(k.what) + ' — bill or spending budget">' +
        '<option value=""' + (!k.setting ? ' selected' : '') + '>Auto (' + (k.auto === "spending" ? "spending" : "bill") + ')</option>' +
        '<option value="bill"' + (k.setting === "bill" ? ' selected' : '') + '>Bill</option>' +
        '<option value="spending"' + (k.setting === "spending" ? ' selected' : '') + '>Spending budget</option></select></li>';
    }).join("") + '</ul></details>' : '';
  var cardOut = pays.reduce(function(s, p){ return s + p.amount; }, 0);
  var leaves = (data.directTotal != null ? data.directTotal : data.total) + cardOut;
  var summary = pays.length
    ? fmtCurrency0.format(leaves) + ' leaves your accounts: ' + fmtCurrency0.format(data.directTotal) + ' in bills, ' + fmtCurrency0.format(cardOut) + ' card payment' + (pays.length === 1 ? '' : 's')
    : fmtCurrency0.format(data.paidTotal) + ' paid of ' + fmtCurrency0.format(data.total) + ' in dated bills';
  return '<div class="bc-summary"><b>' + mon + ' ' + y + '</b><span>' + summary + '</span></div>' +
    '<div class="bc-grid" role="group" aria-label="Bills in ' + mon + '">' + head + cells.join("") + '</div>' + list + spend + stopped + undated + kinds;
}

// ---------------- The transaction table (v3.117.0) ----------------
// On a wide screen the list can be a table: every spending row's date, description, line, account and
// amount editable in place, Tab across and on; money in and transfers listed read-only beside them; a
// row at the top to type a new one and press Enter. The cells carry the same tx-* classes and
// data-tx-index as the row's own form, so the handlers that already save those save these.
export var txGrid = { on: false };
try { txGrid.on = typeof localStorage !== "undefined" && localStorage.getItem("wealthPlanner.txGrid") === "1"; } catch(e){}
export function setTxGrid(on){ txGrid.on = !!on; try { localStorage.setItem("wealthPlanner.txGrid", on ? "1" : "0"); } catch(e){} }
export function txViewToggleHtml(){
  return '<div class="seg tx-view-toggle" role="group" aria-label="Show transactions as">' +
    '<button type="button" class="seg-option' + (txGrid.on ? '' : ' active') + '" data-tx-view="list" aria-pressed="' + !txGrid.on + '">List</button>' +
    '<button type="button" class="seg-option' + (txGrid.on ? ' active' : '') + '" data-tx-view="table" aria-pressed="' + txGrid.on + '">Table</button></div>';
}
// entries: cashflowEntries rows; opts: { transactions, lineOptions(id), accountOptions(name), today, picking }
export function txGridHtml(entries, opts){
  var esc = escapeAttr;
  var head = '<thead><tr>' + (opts.picking ? '<th class="txg-pick"></th>' : '') + '<th>Date</th><th>Description</th><th>Line</th><th>Account</th><th class="num">Amount</th></tr></thead>';
  var newRow = '<tr class="txg-new">' + (opts.picking ? '<td></td>' : '') +
    '<td><input type="date" class="txg-new-date" value="' + esc(opts.today) + '" aria-label="New transaction date"></td>' +
    '<td><input type="text" class="txg-new-what" placeholder="New: what was it?" aria-label="New transaction description"></td>' +
    '<td><select class="txg-new-link" aria-label="New transaction budget line">' + opts.lineOptions(null) + '</select></td>' +
    '<td><select class="txg-new-account" aria-label="New transaction account">' + opts.accountOptions("") + '</select></td>' +
    '<td class="num"><input type="number" step="0.01" class="txg-new-amount" placeholder="0.00" aria-label="New transaction amount" title="Enter to add"></td></tr>';
  var rows = entries.map(function(e){
    if(e.kind !== "out"){
      var sign = e.kind === "in" ? "+" : "";
      return '<tr class="txg-ro txg-' + e.kind + '">' + (opts.picking ? '<td></td>' : '') + '<td>' + esc(fmtDate(e.date)) + '</td><td>' + esc(e.label) + '</td><td class="muted">' + (e.kind === "in" ? "money in" : "transfer") + '</td>' +
        '<td class="muted">' + esc(e.kind === "transfer" ? (e.account || "?") + " → " + (e.toAccount || "?") : (e.account || "")) + '</td><td class="num">' + sign + fmtCurrency2.format(e.amount) + '</td></tr>';
    }
    var t = opts.transactions[e.ref], i = e.ref;
    return '<tr class="txg-row" data-index="' + i + '">' +
      (opts.picking ? '<td class="txg-pick">' + selectBoxHtml(i) + '</td>' : '') +
      '<td><input type="date" class="tx-date" data-tx-index="' + i + '" value="' + esc(t.date || "") + '" aria-label="Date"></td>' +
      '<td><input type="text" class="tx-what" data-tx-index="' + i + '" value="' + esc(t.what || "") + '" placeholder="' + esc(e.label) + '" aria-label="Description"></td>' +
      '<td><select class="tx-link" data-tx-index="' + i + '" aria-label="Budget line">' + opts.lineOptions(t.linkedExpenseId) + '</select></td>' +
      '<td><select class="tx-account" data-tx-index="' + i + '" aria-label="Account">' + opts.accountOptions(t.account || "") + '</select></td>' +
      '<td class="num"><input type="number" step="0.01" class="tx-amount" data-tx-index="' + i + '" value="' + (Number(t.amount) || 0) + '" aria-label="Amount"></td></tr>';
  }).join("");
  return '<div class="txg-wrap"><table class="tx-grid">' + head + '<tbody>' + newRow + rows + '</tbody></table></div>';
}
