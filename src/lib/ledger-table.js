import { FREQS, CLASSES, MONTH_NAMES, DEDUCTION_LABELS } from "../constants.js";
import { periodsOf, RESERVE_YEAR_BASES, resolveSharedAmount } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr, fmtDate } from "./format.js";
import { escapeAttr } from "./html.js";
import { fieldHtml } from "./field.js";

// Stable ids include the surface: the same property cost is editable from Budget and Property.
// Keep the existing grid/conditional wrappers; fieldHtml owns the label, control, help and error.
export function ledgerFields(item, section, idx, surface){
  var key = encodeURIComponent((surface || "ledger") + ":" + (section || "income") + ":" + (item.id == null ? idx : item.id));
  return function(name, label, options, layout){
    layout = layout || {};
    return '<div class="m-edit-field' + (layout.className ? " " + escapeAttr(layout.className) : "") + (options && options.type === "date" ? " ledger-date-field" : "") + '"' + (layout.hidden ? " hidden" : "") + ">" +
      fieldHtml(Object.assign({}, options, { id: "ledger-" + key + "-" + name, label: label, className: name })) + "</div>";
  };
}
function choices(values){ return values.map(function(value){ return { value: value, label: value }; }); }

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
  // #261: no title tooltip — it said what the field already shows (today's date) and its name says.
  return '<input type="date" class="log-date field-control" value="' + todayStr() + '" aria-label="Date to log this amount under">' +
    '<button type="button" class="asset-log-btn" data-log="' + escapeAttr(section) + ':' + idx + '"' +
      ' title="Record the amount above under the date to the left">Record change</button>';
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
    ' (' + fmtPercent1.format(Math.abs(pct)) + ') since ' + escapeAttr(fmtDate(prev.date)) + '</div>';
}

// The fields behind every row's timing (see state.js's
// applyTimingDefaults() and calc/ledger.js's resolvedDueMonth()) — shared by the generic Modern
// row (modernPlainRowHtml below) and Income's own bespoke Modern row (income.js), so the two
// surfaces can never drift apart on what these fields mean or how they're labeled. "Auto" (blank)
// lets a less-than-monthly item's due month be inferred from the last time it was logged instead
// of set explicitly.
export function timingFieldsHtml(item, section, idx, surface){
  var field = ledgerFields(item, section, idx, surface);
  return '<div class="m-edit-field span2"><label class="m-checkbox-field"><input type="checkbox" class="f-irregular"' + (item.irregular ? " checked" : "") +
      '> No fixed timing (irregular) — a lumpy spend like Extras or property maintenance, budgeted as a smoothed reserve instead of expected every period</label></div>' +
    field("f-duemonth", "Due month", { type:"select", value:item.dueMonth || "", options:[{value:"",label:"Auto"}].concat(MONTH_NAMES.map(function(m,i){return {value:i+1,label:m};})), help:"For bills paid less often than monthly. Auto uses the last logged payment." }) +
    field("f-dueday", "Due day", { type:"number", value:item.dueDay || "", placeholder:"1", attrs:{min:1,max:31,step:1}, help:"Day of the month it is due. Used with Due month for the bills calendar until a payment is logged." }) +
    startDateFieldHtml(item, field) + endDateFieldHtml(item, field) +
    // Property costs already belong to their rental schedule; a personal claim would count twice.
    (String(section || "").indexOf("propexp:") === 0 ? "" : deductionFieldsHtml(item, field)) +
    reserveYearFieldHtml(item, field);
}
// An optional last date a row applies. Blank — the default, and what every row created before
// this existed carries — means "runs forever", which is what the projection assumed for
// everything until now. Childcare that finishes in two years and a car loan with eighteen
// payments left were both being projected out to the horizon; this is the field that lets the
// model stop counting them (calc/ledger.js's isActiveInYear, honoured by computeNetWorthSeries).
//
// Deliberately a plain date rather than a "months remaining" count: a count goes stale the day
// after you type it, and this file is edited months apart.
// The other end (v3.32.0). A cost or income that begins later — a new subscription from January,
// childcare from next term — shouldn't count from today in every total, the projection and the
// cash-flow forecast; and a year's figures count it from the day it starts.
function startDateFieldHtml(item, field){
  return field("f-startdate", "Starts (optional)", {type:"date",value:item.startDate || "",help:"Leave blank if already running. Totals, projections and the year's figures count this line from this date."});
}
function endDateFieldHtml(item, field){
  return field("f-enddate", "Ends (optional)", {type:"date",value:item.endDate || "",help:"Leave blank if it runs indefinitely. Projections stop counting this line after this date."});
}

// Work-related deduction fields. Two, not one: the flag alone would claim 100% of a phone bill or
// a car, which is almost never the honest answer, and a share field is what stops people keeping a
// second set of numbers in a spreadsheet somewhere.
//
// The person select only appears with more than one person to choose between — in a single-income
// household an unattributed row already belongs to the only person, and asking would be noise.
// See calc/tax.js's deductionRows() for why an ambiguous row is deliberately claimed by nobody.
function deductionFieldsHtml(item, field){
  var people = deductionPeopleProvider ? deductionPeopleProvider() : [];
  var props = deductionPropertiesProvider ? deductionPropertiesProvider() : [];
  var onProperty = !!item.claimProperty;
  var current = onProperty ? "property:" + item.claimProperty : (item.deductiblePerson || "");
  var ownerOptions = people.length > 1 || !people.length ? [{value:"",label:"— Not set —"}] : [];
  ownerOptions = ownerOptions.concat(choices(people));
  if(props.length) ownerOptions.push({label:"Investment property",options:props.map(function(p){ return {value:"property:"+p.id,label:p.what || "Property"}; })});
  if(onProperty && !props.some(function(p){ return p.id===item.claimProperty; })) ownerOptions.push({value:current,label:"(deleted property)"});
  return '<div class="m-edit-field span2"><label class="m-checkbox-field"><input type="checkbox" class="f-deductible"' + (item.deductible ? " checked" : "") +
      '> Tax deduction — claimable on a tax return</label></div>' +
    field("f-deductpct", "Claimable %", {type:"number", value:item.deductiblePct == null ? 100 : item.deductiblePct, attrs:{min:0,max:100,step:5}, help:"Only the work-related share is claimable. A phone bill or a car is rarely 100%."}, {className:"f-deduct-extra",hidden:!item.deductible}) +
    (people.length > 1 || props.length ? field("f-deductperson", "Claimed by", {type:"select",value:current,options:ownerOptions,help:"Choose a person or an investment property's rental schedule (split by ownership). In a household with more than one income, Not set is claimed by nobody."}, {className:"f-deduct-extra",hidden:!item.deductible}) : "") +
    rentLineFieldHtml(item,field,{className:"f-deduct-extra f-claim-prop",hidden:!(item.deductible && onProperty)}) +
    field("f-deductlabel", "Return label", {type:"select",value:item.deductionLabel || "D5",options:DEDUCTION_LABELS.map(function(d){return {value:d.code,label:d.label};}),help:"Where this goes on the return. The tax card totals claims by label, as myTax does."}, {className:"f-deduct-extra f-claim-person",hidden:!(item.deductible && !onProperty)}) +
    field("f-deductfrom", "Claim from", {type:"date",value:item.deductibleFrom || "",help:"First day this was claimable. Leave blank if claimable before this tax year began."}, {className:"f-deduct-extra",hidden:!item.deductible}) +
    field("f-deductuntil", "Claim until", {type:"date",value:item.deductibleUntil || "",help:"Last claimable day if the claim stopped while the expense continued. The tax year counts only the claim's dates."}, {className:"f-deduct-extra",hidden:!item.deductible});
}
// Same registration shape as calc/tax.js's deductible-items provider, and for the same reason: the
// person list comes from calc/tax.js's getTaxPeople(), and lib/ deliberately imports no calc module.
var deductionPeopleProvider = null;
export function setDeductionPeopleProvider(fn){ deductionPeopleProvider = fn; }
// Investment properties a line can be claimed against, and the rental schedule's lines — same
// provider pattern (v3.45.0): calc/property.js and calc/taxyear.js own them.
var deductionPropertiesProvider = null;
export function setDeductionPropertiesProvider(fn){ deductionPropertiesProvider = fn; }
var rentLinesProvider = null;
export function setRentLinesProvider(fn){ rentLinesProvider = fn; }
function rentLineFieldHtml(item, field, layout){
  var rl = rentLinesProvider ? rentLinesProvider() : null;
  if(!rl) return "";
  return field("f-rentline", "Rental schedule line", {type:"select",value:rl.lineFor(item),options:rl.lines.map(function(l){return {value:l.key,label:l.label};}),help:"Which rental schedule line this goes on in Tax → Returns. Defaults to a guess from the name."},layout);
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
function reserveYearFieldHtml(item, field){
  var current = RESERVE_YEAR_BASES.indexOf(item.reserveYear) !== -1 ? item.reserveYear : "";
  return field("f-reserveyear", "Budget year", {type:"select",value:current,options:[{value:"",label:"Follow my year (Settings → Preferences)"}].concat(RESERVE_YEAR_LABELS.map(function(pair){return {value:pair[0],label:pair[1]};})),help:"Which twelve months this reserve is measured over on Spending. A financial-year budget need not reset on 1 January."}, {className:"f-reserveyear-field",hidden:!item.irregular});
}

// The collapsed-row counterpart to the Ends field: a row with an end date looks identical to a
// perpetual one in the list, which matters because the projection now treats them very
// differently. Past tense once the date has gone by, since a row that has already ended is still
// in the list contributing to every "per month" figure on the page — that's the case worth
// noticing.
export function hasEnded(item){
  return !!(item && item.endDate && item.endDate < todayStr());
}
export function endDateNoteHtml(item){
  if(!item) return "";
  // A line that hasn't started yet says so — it's in the list but in none of the totals.
  if(item.startDate && item.startDate > todayStr()){
    return '<span class="row-end-note">Starts ' + escapeAttr(fmtDate(item.startDate)) + (item.endDate ? ", ends " + escapeAttr(fmtDate(item.endDate)) : "") + '</span>';
  }
  if(!item.endDate) return "";
  var ended = hasEnded(item);
  return '<span class="row-end-note' + (ended ? " ended" : "") + '">' +
    (ended ? "Ended " : "Ends ") + escapeAttr(fmtDate(item.endDate)) + '</span>';
}

// A row whose amount differs in some scenario looks identical to one that doesn't, and the list
// it sits in shows the *default* amount — so without this the Income page can read $11,500 while
// the scenario you're actually looking at uses half that, with nothing on screen to say so.
//
// Names the active scenario's own figure when it has one, since that's the number the Dashboard
// and Projections are using right now; falls back to a plain "varies" when the active scenario
// happens to be the one on the default.
export function scenarioVaryNoteHtml(item, activeScenario){
  var overrides = item && item.scenarioOverrides;
  if(!overrides) return "";
  var names = Object.keys(overrides).filter(function(k){ return overrides[k] != null; });
  if(!names.length) return "";
  var here = overrides[activeScenario];
  // Which figure the pill names flipped in v2.87.0, along with the row's headline. The row now
  // shows what the ACTIVE scenario pays, so the pill's job is to name the default it's overriding
  // — naming the scenario figure as well would just print the same number twice.
  var text = here != null
    ? "default " + fmtCurrency2.format(item.amount)
    : "Varies in " + (names.length === 1 ? names[0] : names.length + " scenarios");
  return '<span class="row-vary-note" title="' + escapeAttr(
    "This row's amount differs by scenario. The figure shown is what " + (activeScenario || "the active scenario") +
    " pays; the default applies to any scenario without its own value.") +
    '">⇄ ' + escapeAttr(text) + '</span>';
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
  // v3.157.0: or a leading badge (a category's icon) in its place.
  if(opts.leadHtml) dot = opts.leadHtml;
  var subs = (opts.subLines || []).filter(Boolean).map(function(s){ return '<div class="m-row-sub">' + s + '</div>'; }).join("");
  return '<div class="m-row-summary"' + (opts.computed ? ' style="cursor:default"' : ' role="button" tabindex="0" data-row-toggle') + '>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name"' + (opts.nameTitle ? ' title="' + escapeAttr(opts.nameTitle) + '"' : '') + '>' + escapeAttr(opts.name || "") + '</div>' +
      subs +
    '</div>' +
    '<span class="m-row-amt' + (opts.ended ? " row-amt-ended" : "") + '" data-computed="amt">' + (opts.amountHtml || "") + '</span>' +
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
// data-section/data-index locate a row inside the array it was rendered from, which is what every
// edit handler needs. data-line-id is the other question — "where on the page is *this* record" —
// and is what lets something outside the list (cross-page search) find a row without knowing which
// array or which group it ended up in. Emitted only when the item carries an id, so nothing changes
// for the arrays whose rows are positional.
function lineIdAttr(lineId){
  return lineId ? ' data-line-id="' + escapeAttr(lineId) + '"' : "";
}
// v3.108.0: a closed row's edit form isn't in the page — not laid out, focusable or found by querySelectorAll —
// and openModernRow() builds it with materializeRowEdit() before the row opens; a row rendered open gets it inline.
// It was kept in a <template>, which still builds every element of every form, inert: on Cash flow with a real
// household that was ~50,000 of the page's ~78,000 nodes (each form's dropdowns run to hundreds), memory a phone's
// tab can be killed for. Now it's kept as text, in a script element that's never run (its type isn't JavaScript),
// and parsed only when its row opens. Text people typed is already escaped in the form, so it can't close the element.
export function rowEditSlot(isOpen, editHtml){
  if(!editHtml) return "";
  return isOpen ? editHtml : '<script type="text/x-row-edit" class="m-row-edit-tpl">' + editHtml.replace(/<\/(script)/gi, "<\\/$1") + '</script>';
}
export function materializeRowEdit(row){
  var t = row && row.querySelector(":scope > script.m-row-edit-tpl");
  if(!t) return;
  t.insertAdjacentHTML("afterend", t.textContent);
  t.remove();
}
// A closed row's form, as markup to change and put back (rows.js renames a placeholder in it).
export function editRowEditSource(row, change){
  var t = row && row.querySelector(":scope > script.m-row-edit-tpl");
  if(!t) return false;
  var tpl = document.createElement("template");
  tpl.innerHTML = t.textContent;
  change(tpl.content);
  t.textContent = tpl.innerHTML;
  return true;
}

// extraClass lets a caller add its own marker class (e.g. Transactions' "tx-row") alongside "m-row".
export function modernRowShellHtml(section, idx, openState, summaryHtml, editHtml, opts){
  opts = opts || {};
  var extra = (opts.extraClass ? " " + opts.extraClass : "") + (opts.primary ? " m-row-primary" : "");
  if(opts.computed){
    return '<div class="m-row computed' + extra + '"' + lineIdAttr(opts.lineId) + ' data-section="' + escapeAttr(section) + '" data-index="' + idx + '">' + summaryHtml + '</div>';
  }
  var isOpen = !!openState[section + ":" + idx];
  return '<div class="m-row' + (isOpen ? " open" : "") + extra + '"' + lineIdAttr(opts.lineId) + ' data-section="' + escapeAttr(section) + '" data-index="' + idx + '">' + summaryHtml + rowEditSlot(isOpen, editHtml) + '</div>';
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
  // The row's headline figure is what THIS scenario pays, so the list adds up to the card total
  // above it (which is scenario-resolved). The edit panel's Amount field still edits the default —
  // the "⇄" pill below names it, and the Vary dialog says so in as many words.
  var monthly = periodsOf(resolveSharedAmount(item, opts.activeScenario), item.freq).monthly;
  var trendHtml = (opts.showLog && !isComputed) ? historyTrendHtml(item) : "";
  var summary = modernRowSummaryHtml({
    computed: isComputed,
    colorIdx: opts.colorIdx,
    name: item.what,
    // extraSubLine is caller-built HTML (already escaped by the caller, same contract as every
    // other subLines entry) — Expenses uses it for each budget line's own spent-this-month
    // progress bar, so the planned figure and what's actually gone against it read together in
    // the list rather than in a second, parallel list further down the page.
    subLines: [isComputed && item.computedNote ? escapeAttr(item.computedNote) : "", trendHtml,
      endDateNoteHtml(item), scenarioVaryNoteHtml(item, opts.activeScenario), opts.extraSubLine || ""],
    // An ended row is no longer in any total (sumField skips it), so its amount is struck through
    // rather than silently reading as money still going out. The row stays in the list — you have
    // to be able to see it to extend or delete it.
    ended: hasEnded(item),
    amountHtml: fmtCurrency2.format(monthly) + "/mo"
  });
  if(isComputed){
    return modernRowShellHtml(section, idx, openState, summary, "", { computed: true, lineId: item.id });
  }
  // With a Classification field, Account gets its own full-width row below (matches Expenses);
  // without one, there's room for Amount/Frequency/Account to share a single row instead.
  var field = ledgerFields(item, section, idx, opts.fieldScope);
  var classField = opts.showClass ? field("f-class", "Classification", {type:"select",value:item.classification || "Needs",options:choices(CLASSES)}) : "";
  var categoryField = opts.categories ? field("f-category", "Category", {type:"select",value:item.category || "",options:[{value:"",label:"— None —"}].concat(choices(opts.categories)),help:"Groups this line in spending charts. Manage categories in Settings → Categories."}) : "";
  var accountField = field("f-account", "Account", {value:item.account || "",attrs:{list:"acctSuggestions"}}, {className:opts.showClass ? "span3" : ""});
  var logField = opts.showLog ? '<div class="m-edit-field span2"><span class="field-label">Record a change</span>' + logControlsHtml(section, idx, item) + '</div>' : "";
  var rentLineField = String(section || "").indexOf("propexp:") === 0 && rentLinesProvider ? rentLineFieldHtml(item,field) : "";
  var fieldsHtml =
    field("f-what", "Item name", {value:item.what || ""}, {className:"span3"}) +
    classField + categoryField +
    field("f-amount", "Amount", {type:"number",value:item.amount,attrs:{step:"0.01"}}) +
    field("f-freq", "Frequency", {type:"select",value:item.freq,options:choices(FREQS)}) +
    accountField + rentLineField + logField + (opts.extraFieldsHtml || "");
  var flexField = opts.showClass ? field("f-flexkind", "Counts as", {type:"select",value:item.flexKind || "",options:[["","Worked out"],["fixed","Fixed bill"],["flex","Flexible"],["nonmonthly","Non-monthly"]].map(function(o){return {value:o[0],label:o[1]};}),help:"Where this line sits when Budget is grouped Flexible."}) : "";
  var moreOptionsHtml = '<details class="row-more-options"><summary>More options</summary><div class="m-edit-grid" style="margin-top:8px">' + flexField + timingFieldsHtml(item, section, idx, opts.fieldScope) + '</div></details>';
  // A visible "Done" (opts.showDone) — every field here already saves itself as you type, same as
  // any other row in the app, but on a full-screen mobile row editor there's otherwise nothing
  // that reads as "I'm finished, put this away" except the ✕ in the header, which reads more like
  // discard than save. Opt-in per caller rather than always-on, since a row that lives inside a
  // panel the user is already scanning doesn't need the extra button.
  // data-row-toggle re-uses wireModernRowToggle's existing "tap anything so-marked closes an open
  // row" handling — no separate click wiring needed for this to actually close the row.
  var doneButtonHtml = opts.showDone ? '<button type="button" class="btn btn-primary btn-sm" data-row-toggle>Done</button>' : '';
  var actionsHtml = doneButtonHtml + '<button type="button" class="btn btn-danger btn-sm row-del" data-del="' + escapeAttr(section) + ':' + idx + '">Delete</button>';
  var edit = modernRowEditHtml(fieldsHtml, actionsHtml, moreOptionsHtml);
  return modernRowShellHtml(section, idx, openState, summary, edit, { primary: opts.primaryId && item.id === opts.primaryId, lineId: item.id });
}
