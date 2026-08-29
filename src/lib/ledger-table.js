import { PERIODS, FREQS, CLASSES, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, sacrificeModeToLabel } from "../constants.js";
import { periodsOf, nextDueDate, daysUntil } from "../calc/ledger.js";
import { incomeRowSuperNote } from "../calc/tax.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "./format.js";
import { escapeAttr } from "./html.js";

function todayStr(){ return new Date().toISOString().slice(0, 10); }

// The date input + button every "Log"-able row shows together — defaults to today but can be
// backdated (e.g. a payslip that landed last week). The date lives in a sibling input rather
// than a prompt/modal so it fits this app's established inline-editing style; the click handler
// reads it directly off the row rather than threading it through here.
export function logControlsHtml(section, idx){
  return '<input type="date" class="log-date" value="' + todayStr() + '" aria-label="Date to log this amount under" title="Date to log this amount under — defaults to today, can be backdated">' +
    '<button type="button" class="asset-log-btn" data-log="' + escapeAttr(section) + ':' + idx + '" title="Snapshot the amount above under the date to the left">Log</button>';
}

// Shared by every "Log"-able row (assets, properties, debts, income, shared expenses) — a small
// up/down note showing the change since the previous logged snapshot. Empty string (not a
// placeholder) when there's fewer than two snapshots yet, so callers can splice it in without an
// extra "nothing logged" wrapper cluttering rows nobody has logged.
export function historyTrendHtml(item){
  var hist = item.history;
  if(!hist || hist.length < 2) return "";
  var last = hist[hist.length - 1], prev = hist[hist.length - 2];
  var delta = last.value - prev.value;
  var pct = prev.value ? (delta / Math.abs(prev.value)) : 0;
  var cls = delta > 0 ? "up" : (delta < 0 ? "down" : "");
  var arrow = delta > 0 ? "▲" : (delta < 0 ? "▼" : "–");
  return '<div class="asset-trend ' + cls + '">' + arrow + ' ' + fmtCurrency0.format(Math.abs(delta)) +
    ' (' + fmtPercent1.format(Math.abs(pct)) + ') since ' + escapeAttr(prev.date) + '</div>';
}

// Shared by both row renderers below (opts.showDueDate) — projects a plain-language "next due"
// note from item.lastIncurredDate + item.freq, or a prompt to set one if it's never been
// tracked. Not shown for computed rows (nothing to "pay" — they're auto-derived).
export function dueDateNoteHtml(item){
  var due = nextDueDate(item.lastIncurredDate, item.freq);
  if(!due) return '<span class="due-note due-unset">No last-paid date set</span>';
  var days = daysUntil(due);
  var label = days < 0 ? ("overdue by " + Math.abs(days) + "d") : (days === 0 ? "due today" : "due in " + days + "d");
  var cls = days < 0 ? "due-overdue" : (days <= 7 ? "due-soon" : "");
  return '<span class="due-note ' + cls + '">Next due ' + escapeAttr(due) + " (" + label + ")</span>";
}

export function periodTh(){
  return PERIODS.map(function(p){
    return '<th class="num period-col' + (p.hidden ? " hidden-period" : "") + '" data-period="' + p.key + '">' + p.label + '</th>';
  }).join("");
}
export function periodTd(item){
  var p = periodsOf(item.amount, item.freq);
  return PERIODS.map(function(pd){
    return '<td class="num computed period-col' + (pd.hidden ? " hidden-period" : "") + '" data-period="' + pd.key + '">' + fmtCurrency2.format(p[pd.key]) + '</td>';
  }).join("");
}
export function optionsHtml(list, value){
  return list.map(function(o){ return '<option value="' + o + '"' + (o === value ? " selected" : "") + '>' + o + '</option>'; }).join("");
}

export function buildTable(tableEl, section, items, opts, indices){
  opts = opts || {};
  var showClass = opts.showClass !== false;
  var showIncomeFields = !!opts.showIncomeFields;
  var showDueDate = !!opts.showDueDate;
  var showLog = !!opts.showLog;
  var acctClass = opts.acctColClass || (opts.hideAcctToggle ? "col-account-exp" : "");
  var classClass = opts.hideClassToggle ? "col-classification" : "";
  var thead = '<thead><tr><th>What</th>' +
    (showClass ? '<th' + (classClass ? ' class="' + classClass + '"' : '') + '>Classification</th>' : '') +
    (showIncomeFields ? '<th class="col-person">Person</th><th class="col-type">Type</th><th class="col-super">Super</th><th class="col-sacrifice">Cash / Sacrifice</th>' : '') +
    '<th' + (showIncomeFields ? ' class="col-account"' : acctClass ? ' class="' + acctClass + '"' : '') + '>Account</th><th class="num">Amount</th><th>Frequency</th>' +
    (showDueDate ? '<th title="When this was last actually paid — used to project when it\'s next due">Last paid</th>' : '') +
    periodTh() + '<th></th></tr></thead>';
  var rows = items.map(function(item, idx){ return rowHtml(section, item, indices ? indices[idx] : idx, showClass, showIncomeFields, acctClass, classClass, showDueDate, showLog); }).join("");
  tableEl.innerHTML = thead + "<tbody>" + rows + "</tbody>";
}

export function rowHtml(section, item, idx, showClass, showIncomeFields, acctClass, classClass, showDueDate, showLog){
  var isComputed = !!item.computed;
  var isGrossRef = showIncomeFields && item.incomeType === "Gross" && !isComputed;
  // A template row nobody has filled in yet (still $0) shouldn't read with the same weight as
  // real numbers next to it — most visible on the Scenarios page, where every scenario starts
  // with the same Home Insurance/Council Rates/etc. rows whether or not they apply.
  var isZero = !isComputed && !isGrossRef && item.id !== "homeLoanRow" && (Number(item.amount) || 0) === 0;
  var rowClass = (isComputed ? " is-computed" : (isGrossRef ? " is-gross-ref" : (isZero ? " is-zero-value" : ""))) + (item.id === "homeLoanRow" ? " is-home-loan-row" : "");
  return '<tr data-section="' + section + '" data-index="' + idx + '"' + (rowClass ? ' class="' + rowClass.trim() + '"' : "") + '>' +
    '<td class="what-cell"><input type="text" class="f-what" value="' + escapeAttr(item.what) + '" aria-label="Item name">' +
      (item.syntheticNetFor ? '<button type="button" class="row-breakdown-toggle" data-breakdown-person="' + escapeAttr(item.syntheticNetFor) + '" aria-expanded="false">▸ Breakdown</button>' : "") +
      (showLog && !isComputed ? historyTrendHtml(item) : "") +
    '</td>' +
    (showClass ? '<td class="class-cell' + (classClass ? " " + classClass : "") + '"><select class="f-class">' + optionsHtml(CLASSES, item.classification || "Needs") + '</select></td>' : '') +
    (showIncomeFields ? (
      '<td class="account-cell col-person"><input type="text" class="f-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" aria-label="Person" placeholder="—"' + (isComputed ? " disabled" : "") + '></td>' +
      '<td class="freq-cell col-type"><select class="f-incometype"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(INCOME_TYPES, item.incomeType || "Net") + '</select></td>' +
      '<td class="freq-cell col-super"><select class="f-superincluded" title="Whether super is already included in the Amount, paid on top, or doesn\'t apply at all (e.g. dividends, sole-trader income, government benefits)"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(SUPER_MODES, item.superMode || "On top") + '</select></td>' +
      '<td class="freq-cell sacrifice-cell col-sacrifice"><div class="sacrifice-wrap"><select class="f-sacrificemode" title="Take this item as cash, or redirect part of it into super instead"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(SACRIFICE_MODES, sacrificeModeToLabel(item.sacrificeMode)) + '</select>' +
        (!isComputed && item.sacrificeMode && item.sacrificeMode !== "none" ? '<input type="number" min="0" step="' + (item.sacrificeMode === "percent" ? "1" : "50") + '" max="' + (item.sacrificeMode === "percent" ? "100" : "") + '" class="f-sacrificevalue" value="' + (item.sacrificeValue || 0) + '" aria-label="Sacrifice ' + (item.sacrificeMode === "percent" ? "percent" : "amount") + '">' : '') +
      '</div></td>'
    ) : '') +
    '<td class="account-cell' + (showIncomeFields ? " col-account" : acctClass ? " " + acctClass : "") + '"><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"' + (isComputed ? " disabled" : "") + '></td>' +
    '<td class="amount-cell"><input type="number" step="0.01" min="0" class="f-amount" value="' + item.amount + '"' + (isComputed ? " readonly" : "") + ' aria-label="Amount">' +
      (isComputed ? '<span class="computed-note">' + escapeAttr(item.computedNote || "auto-calculated") + '</span>' : "") +
      (isGrossRef ? '<span class="computed-note super-note">' + escapeAttr(incomeRowSuperNote(item)) + '</span>' : "") + '</td>' +
    '<td class="freq-cell"><select class="f-freq"' + (isComputed ? " disabled" : "") + '>' + optionsHtml(FREQS, item.freq) + '</select></td>' +
    (showDueDate ? '<td class="due-cell"><input type="date" class="f-lastpaid" value="' + escapeAttr(item.lastIncurredDate || "") + '"' + (isComputed ? " disabled" : "") + ' aria-label="Last paid date">' + (isComputed ? "" : dueDateNoteHtml(item)) + '</td>' : '') +
    periodTd(item) +
    '<td class="log-cell">' + (isComputed ? "" : (
      (showLog ? logControlsHtml(section, idx) : "") +
      '<button class="btn btn-ghost btn-sm row-del" data-del="' + section + ':' + idx + '" aria-label="Delete row">✕</button>'
    )) + '</td>' +
    '</tr>';
}

// Generic "name + amount, expands to a small field grid" row — used everywhere a ledger-table
// row is just What/[Classification]/Amount/Frequency/[Account] with no person-tax machinery
// (that's what makes Income's row special enough to need its own function). section is the
// data-section/data-del prefix (e.g. "shared", "propinc:<id>", "propexp:<id>") and also scopes
// the openState key, so the same in-memory map can safely track rows from several entities
// (every property's income and expenses) without index collisions. openState is passed in by the
// caller (not module-level here) so each page owns and exports its own open/closed map.
export function modernPlainRowHtml(item, idx, section, openState, opts){
  opts = opts || {};
  var isComputed = !!item.computed;
  var isPrimary = opts.primaryId && item.id === opts.primaryId;
  var monthly = periodsOf(item.amount, item.freq).monthly;
  var dot = (!isComputed && opts.colorIdx != null) ? '<span class="m-row-dot series-color-' + opts.colorIdx + '" aria-hidden="true"></span>' : "";
  var trendHtml = (opts.showLog && !isComputed) ? historyTrendHtml(item) : "";
  var summary = '<div class="m-row-summary"' + (isComputed ? ' style="cursor:default"' : ' role="button" tabindex="0" data-row-toggle') + '>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(item.what) + '</div>' +
      (isComputed && item.computedNote ? '<div class="m-row-sub">' + escapeAttr(item.computedNote) + '</div>' : "") +
      (opts.showDueDate && !isComputed ? '<div class="m-row-sub">' + dueDateNoteHtml(item) + '</div>' : "") +
      (trendHtml ? '<div class="m-row-sub">' + trendHtml + '</div>' : "") +
    '</div>' +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency2.format(monthly) + '/mo</span>' +
    (isComputed ? "" : '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>') +
  '</div>';
  if(isComputed){
    return '<div class="m-row computed" data-section="' + escapeAttr(section) + '" data-index="' + idx + '">' + summary + '</div>';
  }
  var isOpen = !!openState[section + ":" + idx];
  // With a Classification field, Account gets its own full-width row below (matches Expenses);
  // without one, there's room for Amount/Frequency/Account to share a single row instead.
  var classField = opts.showClass
    ? '<div class="m-edit-field"><label>Classification</label><select class="f-class">' + optionsHtml(CLASSES, item.classification || "Needs") + '</select></div>'
    : "";
  var accountField = '<div class="m-edit-field' + (opts.showClass ? " span3" : "") + '"><label>Account</label><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"></div>';
  var dueDateField = opts.showDueDate
    ? '<div class="m-edit-field"><label>Last paid</label><input type="date" class="f-lastpaid" value="' + escapeAttr(item.lastIncurredDate || "") + '" aria-label="Last paid date"></div>'
    : "";
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="f-what" value="' + escapeAttr(item.what) + '" aria-label="Item name"></div>' +
      classField +
      '<div class="m-edit-field"><label>Amount</label><input type="number" step="0.01" min="0" class="f-amount" value="' + item.amount + '" aria-label="Amount"></div>' +
      '<div class="m-edit-field"><label>Frequency</label><select class="f-freq">' + optionsHtml(FREQS, item.freq) + '</select></div>' +
      accountField +
      dueDateField +
    '</div>' +
    '<div class="m-edit-actions">' +
      (opts.showLog ? logControlsHtml(section, idx) : "") +
      '<button type="button" class="btn btn-ghost btn-sm row-del" data-del="' + escapeAttr(section) + ':' + idx + '">Delete</button>' +
    '</div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + (isPrimary ? " m-row-primary" : "") + '" data-section="' + escapeAttr(section) + '" data-index="' + idx + '">' + summary + edit + '</div>';
}
