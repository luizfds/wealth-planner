import { FREQS, CLASSES, MONTH_NAMES } from "../constants.js";
import { periodsOf, RESERVE_YEAR_BASES } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr } from "./format.js";
import { escapeAttr } from "./html.js";

function todayStr(){ return localDateStr(); }

// The date input + button every "Log"-able row shows together — defaults to today but can be
// backdated (e.g. a payslip that landed last week). The date lives in a sibling input rather
// than a prompt/modal so it fits this app's established inline-editing style; the click handler
// reads it directly off the row rather than threading it through here.
//
// "Log" here always means the same thing: snapshot this row's own current Amount into
// item.history under a date, which is what the value-tracking rows (assets, debts, income,
// property income/expenses) need. Shared expenses used to reuse this control for something
// materially different — recording an actual, editable spend amount against a planned budget
// line — which is now the quick-log sheet's job (expenses.js), where amount comes first and the
// budget line is picked from chips instead of being fixed by whichever row you happened to open.
export function logControlsHtml(section, idx, item){
  return '<input type="date" class="log-date" value="' + todayStr() + '" aria-label="Date to log this amount under" title="Date to log this under — defaults to today, can be backdated">' +
    '<button type="button" class="asset-log-btn" data-log="' + escapeAttr(section) + ':' + idx + '"' +
      ' title="Snapshot the amount above under the date to the left">Log</button>';
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

// The two fields behind every row's "irregular / due month" timing (see state.js's
// applyTimingDefaults() and calc/ledger.js's resolvedDueMonth()) — shared by the generic Modern
// row (modernPlainRowHtml below) and Income's own bespoke Modern row (income.js), so the two
// surfaces can never drift apart on what these fields mean or how they're labeled. "Auto" (blank)
// lets a less-than-monthly item's due month be inferred from the last time it was logged instead
// of set explicitly.
export function timingFieldsHtml(item){
  var monthOptions = '<option value="">Auto</option>' + MONTH_NAMES.map(function(m, i){
    return '<option value="' + (i + 1) + '"' + (item.dueMonth === i + 1 ? " selected" : "") + '>' + m + '</option>';
  }).join("");
  return '<div class="m-edit-field span2"><label class="m-checkbox-field"><input type="checkbox" class="f-irregular"' + (item.irregular ? " checked" : "") +
      '> No fixed timing (irregular) — a lumpy spend like Extras or property maintenance, budgeted as a smoothed reserve instead of expected every period</label></div>' +
    '<div class="m-edit-field"><label>Due month</label><select class="f-duemonth" title="For anything billed less often than monthly — which month it\'s actually due. Auto infers it from the last time you logged it.">' + monthOptions + '</select></div>' +
    reserveYearFieldHtml(item);
}
// Only shown once "no fixed timing" is ticked, because that's the only case it changes anything:
// a reserve line is the one thing compared against a whole year rather than a billing cycle, so
// this is where "which year?" becomes a real question. Hidden rather than absent so ticking the
// box can reveal it without re-rendering the row out from under an open editor.
var RESERVE_YEAR_LABELS = [
  ["calendar", "Calendar year (Jan–Dec)"],
  ["financial", "Financial year (Jul–Jun)"],
  ["rolling12", "Rolling 12 months"]
];
function reserveYearFieldHtml(item){
  var current = RESERVE_YEAR_BASES.indexOf(item.reserveYear) !== -1 ? item.reserveYear : "calendar";
  var options = RESERVE_YEAR_LABELS.map(function(pair){
    return '<option value="' + pair[0] + '"' + (pair[0] === current ? " selected" : "") + '>' + pair[1] + '</option>';
  }).join("");
  return '<div class="m-edit-field f-reserveyear-field"' + (item.irregular ? "" : " hidden") + '>' +
    '<label>Budget year</label>' +
    '<select class="f-reserveyear" title="Which twelve months this reserve is measured over on the Spending tab. A travel or maintenance budget you think of in financial years shouldn\'t reset every 1 January.">' + options + '</select>' +
  '</div>';
}

export function optionsHtml(list, value){
  return list.map(function(o){ return '<option value="' + o + '"' + (o === value ? " selected" : "") + '>' + o + '</option>'; }).join("");
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
    (opts.computed ? "" : '<span class="m-row-chev" aria-hidden="true">✕</span>') +
  '</div>';
}
// The expand panel: caller-built .m-edit-field HTML dropped into the standard field grid, an
// optional collapsed "more options" block below it (own HTML, own <details> — not wrapped in the
// field grid, matching income.js's bespoke row so the two never look different), and an actions
// row (normally just the row's own Delete button) — all wrapped in the grid-template-rows
// animation container every expandable row shares (see ledger.css's .m-row-edit/-inner/-pad).
export function modernRowEditHtml(fieldsHtml, actionsHtml, moreOptionsHtml){
  return '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' + fieldsHtml + '</div>' +
    (moreOptionsHtml || "") +
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
  var trendHtml = (opts.showLog && !isComputed) ? historyTrendHtml(item) : "";
  var summary = modernRowSummaryHtml({
    computed: isComputed,
    colorIdx: opts.colorIdx,
    name: item.what,
    // extraSubLine is caller-built HTML (already escaped by the caller, same contract as every
    // other subLines entry) — Expenses uses it for each budget line's own spent-this-month
    // progress bar, so the planned figure and what's actually gone against it read together in
    // the list rather than in a second, parallel list further down the page.
    subLines: [isComputed && item.computedNote ? escapeAttr(item.computedNote) : "", trendHtml, opts.extraSubLine || ""],
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
  // A second, orthogonal axis to Classification: that one says whether the spend is discretionary,
  // this says where it goes. Only offered where the caller passes a category list (Expenses), and
  // only ever used for reporting — it never regroups the list the row lives in.
  var categoryField = opts.categories
    ? '<div class="m-edit-field"><label>Category</label><select class="f-category" title="Groups this line with others like it for the spending charts — manage the list under Accounts → Categories">' +
        '<option value=""' + (!(item.category || "") ? " selected" : "") + '>— None —</option>' +
        optionsHtml(opts.categories, item.category || "") +
      '</select></div>'
    : "";
  var accountField = '<div class="m-edit-field' + (opts.showClass ? " span3" : "") + '"><label>Account</label><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"></div>';
  // span2: the date input + button need more room than a single 1-of-3 grid column gives them
  // at narrow widths (they'd wrap onto separate lines) — span2 fits them on one line and, for
  // every current caller, exactly fills out the row alongside whatever's next to it.
  var logField = opts.showLog
    ? '<div class="m-edit-field span2"><label>Log</label>' + logControlsHtml(section, idx, item) + '</div>'
    : "";
  var fieldsHtml =
    '<div class="m-edit-field span3"><label>What</label><input type="text" class="f-what" value="' + escapeAttr(item.what) + '" aria-label="Item name"></div>' +
    classField +
    categoryField +
    '<div class="m-edit-field"><label>Amount</label><input type="number" step="0.01" min="0" class="f-amount" value="' + item.amount + '" aria-label="Amount"></div>' +
    '<div class="m-edit-field"><label>Frequency</label><select class="f-freq">' + optionsHtml(FREQS, item.freq) + '</select></div>' +
    accountField +
    logField;
  var moreOptionsHtml = '<details class="row-more-options"><summary>More options</summary><div class="m-edit-grid" style="margin-top:8px">' + timingFieldsHtml(item) + '</div></details>';
  // A visible "Done" (opts.showDone) — every field here already saves itself as you type, same as
  // any other row in the app, but on a full-screen mobile row editor there's otherwise nothing
  // that reads as "I'm finished, put this away" except the ✕ in the header, which reads more like
  // discard than save. Opt-in per caller rather than always-on, since a row that lives inside a
  // panel the user is already scanning doesn't need the extra button.
  // data-row-toggle re-uses wireModernRowToggle's existing "tap anything so-marked closes an open
  // row" handling — no separate click wiring needed for this to actually close the row.
  var doneButtonHtml = opts.showDone ? '<button type="button" class="btn btn-primary btn-sm" data-row-toggle>Done</button>' : '';
  var actionsHtml = doneButtonHtml + '<button type="button" class="btn btn-ghost btn-sm row-del" data-del="' + escapeAttr(section) + ':' + idx + '">Delete</button>';
  var edit = modernRowEditHtml(fieldsHtml, actionsHtml, moreOptionsHtml);
  return modernRowShellHtml(section, idx, openState, summary, edit, { primary: opts.primaryId && item.id === opts.primaryId });
}
