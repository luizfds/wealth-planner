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
  var first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate();
  var lead = (first.getDay() + 6) % 7;
  var cells = [];
  for(var i = 0; i < lead; i++) cells.push('<div class="bc-cell is-blank" aria-hidden="true"></div>');
  for(var d = 1; d <= daysIn; d++){
    var key = ym + "-" + String(d).padStart(2, "0");
    // The card repayment first: it's the money actually leaving the bank that day.
    var chips = (payOn[key] || []).map(function(p){ return { what: p.card + " payment", amount: p.amount, cls: "card-pay " + st(p), title: p.card + " payment " + fmtCurrency0.format(p.amount) + (p.paid ? " — paid" : p.overdue ? " — not logged yet" : "") }; })
      .concat((data.days[key] || []).map(function(b){ return { what: b.what, amount: b.amount, cls: (b.card ? "on-card " : "") + st(b), title: b.what + " " + fmtCurrency0.format(b.amount) + (b.card ? " on the " + b.card + (b.payOn ? ", paid with the " + short(b.payOn) + " repayment" : "") : "") + (b.paid ? " — paid" : b.overdue ? " — not logged yet" : "") }; }));
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
  var direct = all.filter(function(b){ return !b.card; }).map(function(b){ return { date: b.date, html: row(b.date, escapeAttr(b.what), "", st(b), b.amount) }; })
    .concat(pays.map(function(p){
      var sub = 'Charges ' + short(p.cycle.start) + ' – ' + short(p.cycle.end) + (p.paid ? '' : p.open ? ', so far' : '');
      return { date: p.date, html: row(p.date, '<span class="bc-card-tag">Card</span>' + escapeAttr(p.card) + ' payment', sub, st(p), p.amount) };
    }))
    .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var onCard = all.filter(function(b){ return b.card; });
  var cardsUsed = onCard.map(function(b){ return b.card; }).filter(function(c, i, arr){ return arr.indexOf(c) === i; });
  var list = '';
  if(direct.length) list += '<h4 class="bc-sec">From your accounts</h4><ul class="bc-list">' + direct.map(function(x){ return x.html; }).join("") + '</ul>';
  cardsUsed.forEach(function(c){
    var bills = onCard.filter(function(b){ return b.card === c; });
    var sum = bills.reduce(function(s, b){ return s + b.amount; }, 0);
    list += '<h4 class="bc-sec">On the ' + escapeAttr(c) + ' <span>' + fmtCurrency0.format(sum) + ' — goes out with the card payment, not on its own</span></h4><ul class="bc-list is-card">' +
      bills.map(function(b){ return row(b.date, escapeAttr(b.what), b.payOn ? 'with the ' + short(b.payOn) + ' payment' : '', st(b), b.amount); }).join("") + '</ul>';
  });
  if(!list) list = '<p class="ledger-note" style="margin:8px 0 0">No dated bills in ' + mon + '. A bill gets a day once a payment has been logged against its budget line.</p>';
  var spend = (data.spending || []).length ? '<h4 class="bc-sec">Spending budgets in ' + mon + ' <span>not bills — many purchases, so no day</span></h4><ul class="bc-spend">' +
    data.spending.map(function(sp){
      var pct = sp.budget > 0 ? Math.min(100, Math.round(sp.spent / sp.budget * 100)) : 0;
      var over = sp.budget > 0 && sp.spent > sp.budget;
      return '<li' + (over ? ' class="over"' : '') + '><span class="bc-list-name">' + escapeAttr(sp.what) + '</span><b>' + fmtCurrency0.format(sp.spent) + ' <small>of ' + fmtCurrency0.format(sp.budget) + '</small></b>' +
        '<span class="bc-spend-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></li>';
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
    '<div class="bc-grid" role="grid" aria-label="Bills in ' + mon + '">' + head + cells.join("") + '</div>' + list + spend + undated + kinds;
}
