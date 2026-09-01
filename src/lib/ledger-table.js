import { PERIODS, FREQS, CLASSES, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, sacrificeModeToLabel } from "../constants.js";
import { periodsOf } from "../calc/ledger.js";
import { incomeRowSuperNote } from "../calc/tax.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr } from "./format.js";
import { escapeAttr } from "./html.js";

function todayStr(){ return localDateStr(); }

// The date input + button every "Log"-able row shows together — defaults to today but can be
// backdated (e.g. a payslip that landed last week). The date lives in a sibling input rather
// than a prompt/modal so it fits this app's established inline-editing style; the click handler
// reads it directly off the row rather than threading it through here.
//
// asTransaction (shared expenses only) changes what "Log" means: instead of snapshotting the
// row's own Amount field into item.history, it adds an editable-amount entry to
// state.transactions[] linked to this item, leaving the row's Amount/Frequency alone as the
// untouched planned budget. Needs its own amount input since the two numbers can now genuinely
// differ (e.g. logging $187 of actual groceries against a $150 planned line).
export function logControlsHtml(section, idx, item, asTransaction){
  var amountField = asTransaction
    ? '<input type="number" step="0.01" min="0" class="log-amount" value="' + item.amount + '" aria-label="Amount actually spent" title="Amount actually spent — defaults to the planned amount, edit if it differs">'
    : "";
  return amountField +
    '<input type="date" class="log-date" value="' + todayStr() + '" aria-label="Date to log this' + (asTransaction ? " transaction" : " amount") + ' under" title="Date to log this under — defaults to today, can be backdated">' +
    '<button type="button" class="asset-log-btn" data-log="' + escapeAttr(section) + ':' + idx + '"' + (asTransaction ? ' data-log-tx="1"' : '') +
      ' title="' + (asTransaction ? "Record this as a transaction against this budget line" : "Snapshot the amount above under the date to the left") + '">Log</button>';
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
  var showLog = !!opts.showLog;
  var logAsTransaction = !!opts.logAsTransaction;
  var acctClass = opts.acctColClass || (opts.hideAcctToggle ? "col-account-exp" : "");
  var classClass = opts.hideClassToggle ? "col-classification" : "";
  var thead = '<thead><tr><th>What</th>' +
    (showClass ? '<th' + (classClass ? ' class="' + classClass + '"' : '') + '>Classification</th>' : '') +
    (showIncomeFields ? '<th class="col-person">Person</th><th class="col-type">Type</th><th class="col-super">Super</th><th class="col-sacrifice">Cash / Sacrifice</th>' : '') +
    '<th' + (showIncomeFields ? ' class="col-account"' : acctClass ? ' class="' + acctClass + '"' : '') + '>Account</th><th class="num">Amount</th><th>Frequency</th>' +
    periodTh() + '<th></th></tr></thead>';
  var rows = items.map(function(item, idx){ return rowHtml(section, item, indices ? indices[idx] : idx, showClass, showIncomeFields, acctClass, classClass, showLog, logAsTransaction); }).join("");
  tableEl.innerHTML = thead + "<tbody>" + rows + "</tbody>";
}

export function rowHtml(section, item, idx, showClass, showIncomeFields, acctClass, classClass, showLog, logAsTransaction){
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
      (showLog && !logAsTransaction && !isComputed ? historyTrendHtml(item) : "") +
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
    periodTd(item) +
    '<td class="log-cell">' + (isComputed ? "" : (
      (showLog ? logControlsHtml(section, idx, item, logAsTransaction) : "") +
      '<button class="btn btn-ghost btn-sm row-del" data-del="' + section + ':' + idx + '" aria-label="Delete row">✕</button>'
    )) + '</td>' +
    '</tr>';
}

// ---------------- Generic collapsible-row shell ----------------
// The part of a modern-mode row that's truly generic — the open/closed wrapper, its
// data-section/data-index (what every row-level delegated handler keys off: delete,
// wireModernRowToggle, the field-input listeners), and the [data-row-toggle] summary button —
// split out from modernPlainRowHtml below so a row shape that doesn't fit "amount + frequency"
// (e.g. Transactions' date/description/link fields in expenses.js) can reuse the same shell
// without reimplementing the toggle/expand plumbing. Three small pieces, composed by the caller:
// modernRowSummaryHtml (the collapsed bar), modernRowEditHtml (the expand panel), and
// modernRowShellHtml (the wrapper that ties them to open/closed state).

// The collapsed bar: an optional color dot, a name + any sub-lines, a trailing amount, and
// (unless computed) the expand chevron. `name` is escaped here since it's always plain text;
// `subLines` entries are taken as pre-built HTML (falsy entries are dropped) since a sub-line can
// itself carry markup (e.g. historyTrendHtml's colored up/down note) — escape the plain-text ones
// yourself before passing them in, same as everywhere else in this codebase.
export function modernRowSummaryHtml(opts){
  opts = opts || {};
  var dot = (!opts.computed && opts.colorIdx != null) ? '<span class="m-row-dot series-color-' + opts.colorIdx + '" aria-hidden="true"></span>' : "";
  var subs = (opts.subLines || []).filter(Boolean).map(function(s){ return '<div class="m-row-sub">' + s + '</div>'; }).join("");
  return '<div class="m-row-summary"' + (opts.computed ? ' style="cursor:default"' : ' role="button" tabindex="0" data-row-toggle') + '>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(opts.name || "") + '</div>' +
      subs +
    '</div>' +
    '<span class="m-row-amt" data-computed="amt">' + (opts.amountHtml || "") + '</span>' +
    (opts.computed ? "" : '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>') +
  '</div>';
}
// The expand panel: caller-built .m-edit-field HTML dropped into the standard field grid, plus
// an actions row (normally just the row's own Delete button), wrapped in the grid-template-rows
// animation container every expandable row shares (see ledger.css's .m-row-edit/-inner/-pad).
export function modernRowEditHtml(fieldsHtml, actionsHtml){
  return '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' + fieldsHtml + '</div>' +
    '<div class="m-edit-actions">' + actionsHtml + '</div>' +
  '</div></div></div>';
}
// Ties a summary + edit panel to open/closed state and gives the row its data-section/data-index.
// A computed row renders the summary only — there's nothing to edit, so no edit panel, no toggle.
// extraClass lets a caller add its own marker class (e.g. Transactions' "tx-row") alongside "m-row".
export function modernRowShellHtml(section, idx, openState, summaryHtml, editHtml, opts){
  opts = opts || {};
  var extra = (opts.extraClass ? " " + opts.extraClass : "") + (opts.primary ? " m-row-primary" : "");
  if(opts.computed){
    return '<div class="m-row computed' + extra + '" data-section="' + escapeAttr(section) + '" data-index="' + idx + '">' + summaryHtml + '</div>';
  }
  var isOpen = !!openState[section + ":" + idx];
  return '<div class="m-row' + (isOpen ? " open" : "") + extra + '" data-section="' + escapeAttr(section) + '" data-index="' + idx + '">' + summaryHtml + editHtml + '</div>';
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
  var monthly = periodsOf(item.amount, item.freq).monthly;
  var trendHtml = (opts.showLog && !opts.logAsTransaction && !isComputed) ? historyTrendHtml(item) : "";
  var summary = modernRowSummaryHtml({
    computed: isComputed,
    colorIdx: opts.colorIdx,
    name: item.what,
    subLines: [isComputed && item.computedNote ? escapeAttr(item.computedNote) : "", trendHtml],
    amountHtml: fmtCurrency2.format(monthly) + "/mo"
  });
  if(isComputed){
    return modernRowShellHtml(section, idx, openState, summary, "", { computed: true });
  }
  // With a Classification field, Account gets its own full-width row below (matches Expenses);
  // without one, there's room for Amount/Frequency/Account to share a single row instead.
  var classField = opts.showClass
    ? '<div class="m-edit-field"><label>Classification</label><select class="f-class">' + optionsHtml(CLASSES, item.classification || "Needs") + '</select></div>'
    : "";
  var accountField = '<div class="m-edit-field' + (opts.showClass ? " span3" : "") + '"><label>Account</label><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"></div>';
  // span2: the date input + button need more room than a single 1-of-3 grid column gives them
  // at narrow widths (they'd wrap onto separate lines) — span2 fits them on one line and, for
  // every current caller, exactly fills out the row alongside whatever's next to it.
  var logField = opts.showLog
    ? '<div class="m-edit-field' + (opts.logAsTransaction ? " span3" : " span2") + '"><label>' + (opts.logAsTransaction ? "Log a transaction" : "Log") + '</label>' + logControlsHtml(section, idx, item, opts.logAsTransaction) + '</div>'
    : "";
  var fieldsHtml =
    '<div class="m-edit-field span3"><label>What</label><input type="text" class="f-what" value="' + escapeAttr(item.what) + '" aria-label="Item name"></div>' +
    classField +
    '<div class="m-edit-field"><label>Amount</label><input type="number" step="0.01" min="0" class="f-amount" value="' + item.amount + '" aria-label="Amount"></div>' +
    '<div class="m-edit-field"><label>Frequency</label><select class="f-freq">' + optionsHtml(FREQS, item.freq) + '</select></div>' +
    accountField +
    logField;
  var actionsHtml = '<button type="button" class="btn btn-ghost btn-sm row-del" data-del="' + escapeAttr(section) + ':' + idx + '">Delete</button>';
  var edit = modernRowEditHtml(fieldsHtml, actionsHtml);
  return modernRowShellHtml(section, idx, openState, summary, edit, { primary: opts.primaryId && item.id === opts.primaryId });
}
