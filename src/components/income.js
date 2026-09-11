import { state } from "../state.js";
import { FREQS, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, MAX_SUPER_BASE, MONTH_NAMES, sacrificeModeToLabel, sacrificeLabelToMode } from "../constants.js";
import { periodsOf, sumField, nextPayDate, payScheduleKindFor, daysUntil, WEEKDAY_NAMES, householdYearWindow } from "../calc/ledger.js";
import { ipNetResultAnnual } from "../calc/property.js";
import { getTaxPeople, incomeRowSuperNote, personTaxSettings, computePersonTax } from "../calc/tax.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { optionsHtml, historyTrendHtml, timingFieldsHtml, endDateNoteHtml, scenarioVaryNoteHtml } from "../lib/ledger-table.js";
import { parseCsv } from "../lib/backup.js";
import { injectScenarioOverrideButtons } from "./expenses.js";

export function personBreakdownHtml(person){
  var r = computePersonTax(person);
  var row = function(label, value, cls){
    return '<div class="rb-row' + (cls ? " " + cls : "") + '"><span class="rb-label">' + escapeAttr(label) + '</span><span class="rb-value">' + value + '</span></div>';
  };
  var html = '<div class="row-breakdown-panel">';
  html += row("Gross income (excl. super)", fmtCurrency0.format(r.gross) + "/yr");
  if(Math.abs(r.ipShare) > 0.5) html += row("IP share", (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + "/yr");
  html += row("Taxable income", fmtCurrency0.format(r.taxable) + "/yr");
  html += row("Income tax", "−" + fmtCurrency0.format(r.incomeTax) + "/yr", "neg");
  html += row("Medicare levy", "−" + fmtCurrency0.format(r.medicare) + "/yr", "neg");
  if(r.sacrifice > 0.5) html += row("Super sacrifice", "−" + fmtCurrency0.format(r.sacrifice) + "/yr", "neg");
  html += row("Net take-home", fmtCurrency0.format(r.netTakeHome) + "/yr", "rb-total");
  if(Math.abs(r.ipTaxEffect) > 0.5) html += row("Payslip take-home", fmtCurrency0.format(r.payslipTakeHome) + "/yr", "rb-secondary");
  html += '</div>';
  if(Math.abs(r.ipTaxEffect) > 0.5){
    var isBenefit = r.ipTaxEffect > 0;
    html += '<p class="calc-note rb-ip-note">' +
      (isBenefit ? "+" : "−") + fmtCurrency0.format(Math.abs(r.ipTaxEffect)) + "/yr " + (isBenefit ? "less" : "more") +
      " tax from this property’s " + (r.ipShare < 0 ? "loss" : "profit") + " — “Net take-home” above already includes it, " +
      "but it usually arrives as a lump sum after lodging a return (“Payslip take-home”), not spread through the year, " +
      "unless you’ve arranged a PAYG withholding variation." +
    "</p>";
  }
  return html;
}

function incomeGroupKey(item){
  if(item.syntheticNetFor) return item.syntheticNetFor;
  if(item.person) return item.person;
  return "__household";
}

function incomeGroupOrder(){
  var order = getTaxPeople().slice();
  state.income.forEach(function(item){
    var key = incomeGroupKey(item);
    if(key !== "__household" && order.indexOf(key) === -1) order.push(key);
  });
  if(state.income.some(function(item){ return incomeGroupKey(item) === "__household"; })) order.push("__household");
  return order;
}

function computeIncomeGroups(){
  return incomeGroupOrder().map(function(key){
    var indices = [];
    var items = [];
    state.income.forEach(function(item, idx){
      if(incomeGroupKey(item) === key){ indices.push(idx); items.push(item); }
    });
    return { key: key, indices: indices, items: items, monthly: sumField(items.filter(function(i){ return i.incomeType !== "Gross"; }), "monthly") };
  });
}

export function patchOpenRowBreakdowns(){
  document.querySelectorAll(".row-breakdown-row").forEach(function(rowEl){
    var person = rowEl.getAttribute("data-breakdown-person");
    var cell = rowEl.querySelector("td");
    if(cell && person) cell.innerHTML = personBreakdownHtml(person);
  });
}

export function patchIncomeGroupTotals(){
  var groups = computeIncomeGroups();
  var summaryEl = document.getElementById("incomeSummaryLine");
  if(summaryEl){
    if(groups.length > 1){
      var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
      var parts = groups.map(function(g){ return (g.key === "__household" ? "Household" : g.key) + " " + fmtCurrency0.format(g.monthly); }).join(" + ");
      summaryEl.innerHTML = "Adds up: " + parts + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total household income";
      summaryEl.style.display = "";
    } else {
      summaryEl.style.display = "none";
    }
  }
  document.querySelectorAll("#incomeGroups .m-card").forEach(function(card, gi){
    var totalEl = card.querySelector(".m-card-total");
    if(totalEl && groups[gi]) totalEl.innerHTML = fmtCurrency0.format(groups[gi].monthly) + "<span>/mo</span>";
    var barWrap = card.querySelector("[data-comp-bar]");
    if(barWrap && groups[gi]){
      var freshBar = modernIncomeCompBarHtml(incomeGroupRowMeta(groups[gi]));
      if(freshBar) barWrap.outerHTML = freshBar;
    }
  });
}


// ---------------- Import income from a spreadsheet ----------------
// Same shape as expenses.js's CSV import (see that file's own comment for the full rationale) —
// mirrors exportIncomeCsv()'s own headers rather than trying to auto-map an arbitrary layout.
var INCOME_IMPORT_HEADERS = ["what", "person", "type", "amount", "frequency", "super", "sacrifice mode", "sacrifice value", "account"];
function matchIncomeImportHeader(headerRow){
  var colOf = {};
  headerRow.forEach(function(h, i){
    var key = (h || "").trim().toLowerCase();
    if(INCOME_IMPORT_HEADERS.indexOf(key) !== -1 && colOf[key] === undefined) colOf[key] = i;
  });
  return colOf;
}
// Pure parse+validate — see expenses.js's parseExpensesImportCsv for the same shape/rationale.
// Type/Super/Sacrifice mode all fall back to the same defaults a fresh "+Add income" row gets
// ("Net"/"On top"/"Cash out") rather than rejecting the row over an unrecognized value.
export function parseIncomeImportCsv(text){
  var rows = parseCsv(text);
  if(!rows.length) return { valid: [], errors: [], headerOk: false };
  var colOf = matchIncomeImportHeader(rows[0]);
  if(colOf.what === undefined || colOf.amount === undefined) return { valid: [], errors: [], headerOk: false };
  var valid = [], errors = [];
  rows.slice(1).forEach(function(cells, i){
    var rowNum = i + 2;
    var what = (cells[colOf.what] || "").trim();
    var amountRaw = (cells[colOf.amount] || "").trim();
    if(!what && cells.every(function(c){ return !c || !c.trim(); })) return; // fully blank row
    if(!what){ errors.push({ row: rowNum, reason: 'Missing "What"' }); return; }
    var amount = parseFloat(amountRaw.replace(/[^0-9.\-]/g, ""));
    if(!amountRaw || isNaN(amount)){ errors.push({ row: rowNum, reason: 'Amount "' + amountRaw + '" isn\'t a number' }); return; }
    var typeRaw = colOf.type !== undefined ? (cells[colOf.type] || "").trim() : "";
    var typeMatch = INCOME_TYPES.find(function(t){ return t.toLowerCase() === typeRaw.toLowerCase(); });
    var freqRaw = colOf.frequency !== undefined ? (cells[colOf.frequency] || "").trim() : "";
    var freqMatch = FREQS.find(function(f){ return f.toLowerCase() === freqRaw.toLowerCase(); });
    var superRaw = colOf["super"] !== undefined ? (cells[colOf["super"]] || "").trim() : "";
    var superMatch = SUPER_MODES.find(function(s){ return s.toLowerCase() === superRaw.toLowerCase(); });
    var sacrificeRaw = colOf["sacrifice mode"] !== undefined ? (cells[colOf["sacrifice mode"]] || "").trim() : "";
    var sacrificeLabelMatch = SACRIFICE_MODES.find(function(s){ return s.toLowerCase() === sacrificeRaw.toLowerCase(); });
    var sacrificeValueRaw = colOf["sacrifice value"] !== undefined ? (cells[colOf["sacrifice value"]] || "").trim() : "";
    var sacrificeValue = parseFloat(sacrificeValueRaw.replace(/[^0-9.\-]/g, ""));
    var person = colOf.person !== undefined ? (cells[colOf.person] || "").trim() : "";
    var account = colOf.account !== undefined ? (cells[colOf.account] || "").trim() : "";
    valid.push({
      what: what, person: person, incomeType: typeMatch || "Net", amount: amount, freq: freqMatch || "Monthly",
      superMode: superMatch || "On top", sacrificeMode: sacrificeLabelToMode(sacrificeLabelMatch || ""),
      sacrificeValue: isNaN(sacrificeValue) ? 0 : sacrificeValue, account: account
    });
  });
  return { valid: valid, errors: errors, headerOk: true };
}
export function renderIncomeImportPreview(parsed){
  var container = document.getElementById("incomeImportPreview");
  if(!container) return parsed.valid;
  container.hidden = false;
  if(!parsed.headerOk){
    container.innerHTML = '<p class="ledger-note" style="margin:0;color:var(--brass-strong)">Couldn\'t find "What" and "Amount" columns in that file — download the import template below, or check your header row matches it.</p>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="incomeImportCancelBtn">Dismiss</button></div>';
    return parsed.valid;
  }
  if(!parsed.valid.length && !parsed.errors.length){
    container.innerHTML = '<p class="ledger-note" style="margin:0">No rows found in that file.</p>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="incomeImportCancelBtn">Dismiss</button></div>';
    return parsed.valid;
  }
  var summary = parsed.valid.length + " row" + (parsed.valid.length === 1 ? "" : "s") + " ready to import" +
    (parsed.errors.length ? ", " + parsed.errors.length + " skipped" : "");
  var errorsHtml = parsed.errors.length
    ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--ink-soft)">' +
        parsed.errors.slice(0, 10).map(function(e){ return "<li>Row " + e.row + ": " + escapeAttr(e.reason) + "</li>"; }).join("") +
        (parsed.errors.length > 10 ? "<li>and " + (parsed.errors.length - 10) + " more</li>" : "") +
      "</ul>"
    : "";
  var previewRows = parsed.valid.slice(0, 8).map(function(item){
    return "<tr><td>" + escapeAttr(item.what) + "</td><td>" + escapeAttr(item.person) + "</td><td>" + escapeAttr(item.incomeType) + '</td><td class="num">' + fmtCurrency2.format(item.amount) + "</td><td>" + escapeAttr(item.freq) + "</td></tr>";
  }).join("");
  var moreNote = parsed.valid.length > 8 ? '<p class="ledger-note" style="margin:6px 0 0">and ' + (parsed.valid.length - 8) + " more…</p>" : "";
  container.innerHTML =
    '<p class="ledger-note" style="margin:0"><b>' + summary + "</b></p>" +
    errorsHtml +
    (parsed.valid.length ? '<div class="table-scroll" style="margin-top:8px"><table class="import-preview-table"><thead><tr><th>What</th><th>Person</th><th>Type</th><th class="num">Amount</th><th>Frequency</th></tr></thead><tbody>' + previewRows + "</tbody></table></div>" + moreNote : "") +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      (parsed.valid.length ? '<button type="button" class="btn btn-sm" id="incomeImportConfirmBtn">Import ' + parsed.valid.length + " row" + (parsed.valid.length === 1 ? "" : "s") + "</button>" : "") +
      '<button type="button" class="btn btn-sm btn-ghost" id="incomeImportCancelBtn">Cancel</button>' +
    "</div>";
  return parsed.valid;
}
export function clearIncomeImportPreview(){
  var container = document.getElementById("incomeImportPreview");
  if(container){ container.hidden = true; container.innerHTML = ""; }
}
// Same minimal shape "+Add income" pushes onto state.income today.
export function commitIncomeImport(items){
  items.forEach(function(item){
    state.income.push({
      what: item.what, person: item.person, classification: "", account: item.account,
      incomeType: item.incomeType, amount: item.amount, freq: item.freq,
      superMode: item.superMode, sacrificeMode: item.sacrificeMode, sacrificeValue: item.sacrificeValue
    });
  });
}

// Session-only UI state (not persisted app data) — which modern income rows are expanded,
// keyed by their state.income index. A structural edit (Type, sacrifice mode, Person) forces a
// full re-render of #incomeGroups, and without this the row the user is mid-edit on would
// snap shut the moment they touched the field driving the change.
export var modernIncomeRowOpen = {};

// Assigns each non-computed row in a group a stable color index (cycling the same 8-color
// series used everywhere else) — shared by the row's identity dot and the card's composition
// bar so the two visuals stay in sync, and reused by the patch path so a live edit doesn't
// have to guess the same assignment a second way.
function incomeGroupRowMeta(g){
  var contribIdx = 0;
  return g.items.map(function(item, i){
    var colorIdx = null;
    if(!item.computed){ colorIdx = contribIdx % 8; contribIdx++; }
    return { item: item, idx: g.indices[i], colorIdx: colorIdx };
  });
}

function modernIncomeCompBarHtml(rowMeta){
  var segs = rowMeta.filter(function(m){ return m.colorIdx != null; }).map(function(m){
    return { item: m.item, colorIdx: m.colorIdx, monthly: Math.max(0, periodsOf(m.item.amount, m.item.freq).monthly) };
  }).filter(function(x){ return x.monthly > 0.5; });
  if(segs.length < 2) return "";
  var total = segs.reduce(function(s, x){ return s + x.monthly; }, 0);
  return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
    var pct = total > 0 ? x.monthly / total : 0;
    return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.monthly + ' 1 0%" title="' + escapeAttr(x.item.what) + ': ' + fmtCurrency0.format(x.monthly) + '/mo (' + fmtPercent1.format(pct) + ')"></div>';
  }).join("") + '</div>';
}

export function renderIncomeGroups(){
  var container = document.getElementById("incomeGroups");
  if(!container) return;
  var groups = computeIncomeGroups();
  patchIncomeGroupTotals();
  var order = incomeGroupOrder();
  container.innerHTML = '<div class="m-people">' + groups.map(function(g){
    var label = g.key === "__household" ? "Household / Shared" : g.key;
    var addValue = g.key === "__household" ? "" : g.key;
    var avatarClass = g.key === "__household" ? "m-avatar-neutral" : "series-color-" + (order.indexOf(g.key) % 8);
    var initial = escapeAttr(label.charAt(0).toUpperCase());
    var rowMeta = incomeGroupRowMeta(g);
    var rows = rowMeta.map(function(m){ return modernIncomeRowHtml(m.item, m.idx, m.colorIdx); }).join("");
    return '<div class="m-card">' +
      '<div class="m-card-head"><span class="m-avatar ' + avatarClass + '">' + initial + '</span>' +
      '<div class="m-card-name">' + escapeAttr(label) + '</div>' +
      '<div class="m-card-total">' + fmtCurrency0.format(g.monthly) + '<span>/mo</span></div></div>' +
      modernIncomeCompBarHtml(rowMeta) +
      '<div class="m-rows">' + rows + '</div>' +
      '<button type="button" class="m-add-row" data-add="income:' + escapeAttr(addValue) + '">+ Add income</button>' +
    '</div>';
  }).join("") + '</div>';
  // Same post-render DOM patch the Expenses budget list uses, for the same reason: the "⇄ Vary"
  // button belongs to rows that can carry a per-scenario override, not to the generic row
  // renderers, which are shared with several sections that can't.
  injectScenarioOverrideButtons("incomeGroups", "income");
}

// Exactly one of these is shown per row, chosen by the frequency — see nextPayDate's own note on
// why the three families need different information. Rendering all three and hiding two would be
// simpler, but "Paid on" meaning three different things depending on a select two fields up is the
// kind of ambiguity that makes people fill it in wrong.
function payScheduleFieldHtml(item, idx){
  var kind = payScheduleKindFor(item.freq);
  if(kind === "weekday"){
    var days = WEEKDAY_NAMES.map(function(name, i){
      return '<option value="' + i + '"' + (String(item.payWeekday) === String(i) ? " selected" : "") + '>' + name + '</option>';
    }).join("");
    return '<div class="m-edit-field"><label>Paid on</label>' +
      '<select class="f-payweekday" aria-label="Day of the week this is paid">' +
        '<option value=""' + (item.payWeekday == null || item.payWeekday === "" ? " selected" : "") + '>—</option>' + days +
      '</select></div>';
  }
  if(kind === "anchor"){
    // A weekday alone can't place a fortnightly cycle — which of the two weeks is only knowable
    // from a real date, so that's what this asks for.
    return '<div class="m-edit-field"><label>A recent pay date</label>' +
      '<input type="date" class="f-payanchor" value="' + escapeAttr(item.payAnchor || "") + '"' +
      ' title="Any date you were actually paid — every fortnight is counted from here" aria-label="A recent pay date"></div>';
  }
  var dayOptions = "";
  for(var d = 1; d <= 31; d++){
    dayOptions += '<option value="' + d + '"' + (String(item.payDay) === String(d) ? " selected" : "") + '>' + d + '</option>';
  }
  dayOptions += '<option value="last"' + (item.payDay === "last" ? " selected" : "") + '>Last day</option>';
  return '<div class="m-edit-field"><label>Paid on</label>' +
    '<select class="f-payday" aria-label="Day of the month this is paid" title="A day the month doesn\'t have is treated as its last — the 31st in a 30-day month means the 30th.">' +
      '<option value=""' + (item.payDay == null || item.payDay === "" ? " selected" : "") + '>—</option>' + dayOptions +
    '</select></div>';
}
// A short, human "next pay" line for the row summary. Empty when the row hasn't been told enough
// to know — a blank is honest, an invented date isn't.
function nextPayNoteHtml(item){
  var next = nextPayDate(item, state.transactions);
  if(!next) return "";
  var d = new Date(next + "T00:00:00");
  var days = daysUntil(next);
  var when = days === 0 ? "today" : (days === 1 ? "tomorrow" : "in " + days + " days");
  var label = WEEKDAY_NAMES[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTH_NAMES[d.getMonth()];
  return '<span class="next-pay">Next pay ' + escapeAttr(label) + ' · ' + escapeAttr(when) + '</span>';
}
// What the old "Log" button should always have been on this page. It used to snapshot whatever was
// already in the Amount field, which meant a pay rise took two steps in the right order (edit the
// amount, then log) and silently recorded the wrong figure in the wrong order. This asks for the
// new amount directly and applies it: the row's amount becomes this, and the change is dated.
function payChangeControlsHtml(idx, item){
  return '<div class="pay-change">' +
    '<input type="number" step="0.01" min="0" class="pay-change-amount" value="' + (Number(item.amount) || 0) + '" aria-label="New amount">' +
    '<input type="date" class="pay-change-date" value="' + localDateStr() + '" aria-label="Date the new amount starts">' +
    // A real button, not .asset-log-btn's bare text link: this is the primary action of the block
    // it sits in, and on a phone a borderless label next to two filled inputs doesn't read as
    // tappable at all.
    '<button type="button" class="btn btn-sm" data-pay-change="' + idx + '" title="Set this as the new amount from that date, and keep the old one in this row\'s history">Record</button>' +
  '</div>';
}
// Past amounts, newest first — the point of recording a change is being able to see the series
// afterwards. Without this the feature wrote to a store nothing ever displayed beyond a one-line
// "since" delta.
function payHistoryHtml(item){
  var hist = item.history;
  if(!hist || !hist.length) return '<p class="ledger-note" style="margin:6px 0 0">No changes recorded yet.</p>';
  var rows = hist.slice().reverse().slice(0, 8).map(function(entry, i, arr){
    var prev = arr[i + 1];
    var delta = prev ? entry.value - prev.value : null;
    var deltaHtml = delta == null ? "" :
      '<span class="pay-hist-delta ' + (delta > 0 ? "up" : (delta < 0 ? "down" : "")) + '">' +
        (delta > 0 ? "▲" : (delta < 0 ? "▼" : "–")) + " " + fmtCurrency0.format(Math.abs(delta)) +
      '</span>';
    return '<div class="pay-hist-row"><span class="pay-hist-date">' + escapeAttr(entry.date) + '</span>' +
      '<span class="pay-hist-value">' + fmtCurrency2.format(entry.value) + '</span>' + deltaHtml + '</div>';
  }).join("");
  var more = hist.length > 8 ? '<p class="ledger-note" style="margin:6px 0 0">and ' + (hist.length - 8) + ' earlier</p>' : "";
  return '<div class="pay-hist">' + rows + '</div>' + more;
}
function modernIncomeRowHtml(item, idx, colorIdx){
  var isComputed = !!item.computed;
  var isGrossRef = item.incomeType === "Gross" && !isComputed;
  var monthly = periodsOf(item.amount, item.freq).monthly;
  var note = isGrossRef ? incomeRowSuperNote(item) : "";
  var dot = colorIdx != null ? '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' : "";
  var trendHtml = isComputed ? "" : historyTrendHtml(item);
  var summary = '<div class="m-row-summary"' + (isComputed ? ' style="cursor:default"' : ' role="button" tabindex="0" data-row-toggle') + '>' +
    (isComputed ? "" : dot) +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(item.what) + '</div>' +
      (note ? '<div class="m-row-sub super-note">' + escapeAttr(note) + '</div>' : "") +
      (trendHtml ? '<div class="m-row-sub">' + trendHtml + '</div>' : "") +
      (isComputed ? "" : (function(){ var n = nextPayNoteHtml(item); return n ? '<div class="m-row-sub">' + n + '</div>' : ""; })()) +
      (function(){ var e = endDateNoteHtml(item); return e ? '<div class="m-row-sub">' + e + '</div>' : ""; })() +
      (function(){ var v = scenarioVaryNoteHtml(item, state.activeScenario); return v ? '<div class="m-row-sub">' + v + '</div>' : ""; })() +
    '</div>' +
    (isGrossRef ? '<span class="m-row-tag gross">Gross</span>' : "") +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency2.format(monthly) + '/mo</span>' +
    (isComputed ? "" : '<span class="m-row-chev" aria-hidden="true">✕</span>') +
  '</div>';
  if(isComputed){
    return '<div class="m-row computed" data-section="income" data-index="' + idx + '">' + summary + '</div>';
  }
  var isOpen = !!modernIncomeRowOpen["income:" + idx];
  var sacrificeValueField = (item.sacrificeMode && item.sacrificeMode !== "none")
    ? '<input type="number" min="0" step="' + (item.sacrificeMode === "percent" ? "1" : "50") + '" max="' + (item.sacrificeMode === "percent" ? "100" : "") + '" class="f-sacrificevalue" value="' + (item.sacrificeValue || 0) + '" aria-label="Sacrifice ' + (item.sacrificeMode === "percent" ? "percent" : "amount") + '">'
    : "";
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="f-what" value="' + escapeAttr(item.what) + '" aria-label="Item name"></div>' +
      '<div class="m-edit-field"><label>Type</label><select class="f-incometype">' + optionsHtml(INCOME_TYPES, item.incomeType || "Net") + '</select></div>' +
      '<div class="m-edit-field"><label>Amount</label><input type="number" step="0.01" min="0" class="f-amount" value="' + item.amount + '" aria-label="Amount"></div>' +
      '<div class="m-edit-field"><label>Frequency</label><select class="f-freq">' + optionsHtml(FREQS, item.freq) + '</select></div>' +
      '<div class="m-edit-field"><label>Super</label><select class="f-superincluded" title="Whether super is already included in the Amount, paid on top, or doesn\'t apply at all">' + optionsHtml(SUPER_MODES, item.superMode || "On top") + '</select></div>' +
      '<div class="m-edit-field"><label>Sacrifice</label><div class="sacrifice-wrap"><select class="f-sacrificemode">' + optionsHtml(SACRIFICE_MODES, sacrificeModeToLabel(item.sacrificeMode)) + '</select>' + sacrificeValueField + '</div></div>' +
      '<div class="m-edit-field"><label>Account</label><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"></div>' +
      payScheduleFieldHtml(item, idx) +
      '<div class="m-edit-field span3"><label>Record a pay change</label>' + payChangeControlsHtml(idx, item) +
        '<p class="ledger-note" style="margin:6px 0 0">Sets this as the new amount from that date. The old one stays below.</p>' +
        payHistoryHtml(item) +
      '</div>' +
    '</div>' +
    '<details class="tax-advanced m-more-options"><summary>More options</summary>' +
      '<div class="m-edit-grid" style="margin-top:8px">' +
        timingFieldsHtml(item) +
      '</div>' +
    '</details>' +
    '<div class="m-edit-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm row-del" data-del="income:' + idx + '">Delete</button>' +
    '</div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="income" data-index="' + idx + '">' + summary + edit + '</div>';
}

export function patchSyntheticIncomeRows(){
  var table = document.getElementById("incomeGroups");
  if(!table) return;
  state.income.forEach(function(item, idx){
    if(!item.syntheticNetFor && !item.syntheticRentForProperty) return;
    var tr = table.querySelector('[data-index="' + idx + '"]');
    if(!tr) return;
    var amountInput = tr.querySelector(".f-amount");
    if(amountInput) amountInput.value = item.amount;
    var p = periodsOf(item.amount, item.freq);
    var modernAmt = tr.querySelector('[data-computed="amt"]');
    if(modernAmt) modernAmt.textContent = fmtCurrency2.format(p.monthly) + "/mo";
  });
}

export function patchIncomeSuperNotes(){
  var table = document.getElementById("incomeGroups");
  if(!table) return;
  table.querySelectorAll(".super-note").forEach(function(el){
    var tr = el.closest("[data-index]");
    if(!tr) return;
    var item = state.income[Number(tr.getAttribute("data-index"))];
    if(item) el.textContent = incomeRowSuperNote(item);
  });
}

var TAX_WATERFALL_SEGMENTS = [
  { key: "nettakehome", label: "Net take-home", colorClass: "series-color-0" },
  { key: "incometax", label: "Income tax", colorClass: "series-color-1" },
  { key: "medicare", label: "Medicare levy", colorClass: "series-color-2" },
  { key: "sacrifice", label: "To super (sacrifice)", colorClass: "series-color-3" }
];
function taxWaterfallValues(r){
  return { nettakehome: Math.max(0, r.netTakeHome), incometax: Math.max(0, r.incomeTax), medicare: Math.max(0, r.medicare), sacrifice: Math.max(0, r.sacrifice) };
}
function renderTaxWaterfallHtml(r){
  var values = taxWaterfallValues(r);
  var whole = values.nettakehome + values.incometax + values.medicare + values.sacrifice;
  var bar = TAX_WATERFALL_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
    return '<div class="tax-waterfall-seg ' + seg.colorClass + '" data-seg-bar="' + seg.key + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + escapeAttr(seg.label) + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
  }).join("");
  var legend = TAX_WATERFALL_SEGMENTS.map(function(seg){
    return '<div class="tax-waterfall-item"><span class="proj-swatch ' + seg.colorClass + '"></span><div class="tax-waterfall-item-text"><span class="tax-waterfall-item-label">' + seg.label + '</span><span class="tax-waterfall-item-value" data-seg-val="' + seg.key + '">' + fmtCurrency0.format(values[seg.key]) + '</span></div></div>';
  }).join("");
  return '<div class="tax-waterfall-bar" data-waterfall-bar>' + bar + '</div><div class="tax-waterfall-legend">' + legend + '</div>';
}
function patchTaxWaterfall(panel, r){
  var values = taxWaterfallValues(r);
  var whole = values.nettakehome + values.incometax + values.medicare + values.sacrifice;
  var barWrap = panel.querySelector("[data-waterfall-bar]");
  if(barWrap) barWrap.innerHTML = TAX_WATERFALL_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
    return '<div class="tax-waterfall-seg ' + seg.colorClass + '" data-seg-bar="' + seg.key + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + escapeAttr(seg.label) + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
  }).join("");
  TAX_WATERFALL_SEGMENTS.forEach(function(seg){
    var el = panel.querySelector('[data-seg-val="' + seg.key + '"]');
    if(el) el.textContent = fmtCurrency0.format(values[seg.key]);
  });
}
// Ownership/sacrifice sits tucked behind a disclosure instead of always-open, so the net
// take-home number stays the headline — reuses computePersonTax, renderTaxWaterfallHtml, and
// the existing taxSuperBody click/input handlers below verbatim; patchAllTaxPersonOutputs
// doesn't care which function produced the DOM it's patching.
export function renderTaxSuper(){
  // Names the year it's estimating. A tax estimate that doesn't say which twelve months it covers
  // is the one figure on this page you can't check, and the answer differs by household
  // (Accounts → Preferences) now that the year is a preference rather than an assumption.
  var periodEl = document.getElementById("taxSuperPeriod");
  if(periodEl) periodEl.textContent = householdYearWindow().label + " · per person";
  var container = document.getElementById("taxSuperBody");
  if(!container) return;
  var people = getTaxPeople();
  if(!people.length){
    container.innerHTML = '<p class="tax-empty">Mark an Income row\'s Type as "Gross" and give it a Person to see their estimated tax, Medicare levy, and super here.</p>';
    return;
  }
  var ipResult = ipNetResultAnnual();
  var html = '<div class="tax-global">' +
    '<div class="proj-field"><label>Super guarantee % p.a.</label><input type="number" min="0" max="30" step="0.1" id="taxSgRate" value="' + (Number(state.tax.sgRate) || 11.5) + '"></div>' +
    '</div>';
  html += '<p class="ledger-note" style="margin:0 0 12px">Investment property result this year: <b style="font-family:\'IBM Plex Mono\',monospace">' + fmtCurrency0.format(ipResult) + '</b> (' + (ipResult < 0 ? "a loss — negatively geared, reduces taxable income" : "net rental profit — adds to taxable income") + '), split below by ownership share.</p>';

  html += people.map(function(person, pi){
    var r = computePersonTax(person);
    var pid = escapeAttr(person);
    return '<div class="tax-person" data-tax-person="' + pid + '">' +
      taxPersonHeadHtml(person, r, pi) +
      '<div class="m-taxp-flipface" data-flipface>' + (taxCardFlipped[person] ? personBreakdownHtml(person) : taxPersonFrontBodyHtml(person, r)) + '</div>' +
    '</div>';
  }).join("");
  container.innerHTML = html;
}

function taxPersonHeadHtml(person, r, pi){
  var pid = escapeAttr(person);
  return '<div class="tax-person-head">' +
      '<h4><span class="m-avatar series-color-' + (pi % 8) + '" style="width:24px;height:24px;font-size:11px;margin-right:8px">' + escapeAttr(person.charAt(0).toUpperCase()) + '</span>' + escapeAttr(person) + '<button type="button" class="icon-btn" data-tax-rename="' + pid + '" aria-label="Rename ' + pid + '" title="Rename this person (updates every income row)">✎</button><button type="button" class="icon-btn icon-del" data-tax-remove="' + pid + '" aria-label="Remove ' + pid + '" title="Remove this person from tax &amp; super (their income rows go back to Net)">✕</button></h4>' +
      '<span class="tax-marginal">Marginal rate ' + fmtPercent1.format(r.marginalRate) + ' · effective ' + fmtPercent1.format(r.effectiveRate) + '</span>' +
      '<button type="button" class="m-flip-btn" data-tax-flip="' + pid + '" aria-label="Flip ' + pid + '\'s card to see the calculation breakdown" title="Flip to see how this is calculated"><span aria-hidden="true">⇋</span> Breakdown</button>' +
    '</div>';
}

function taxPersonFrontBodyHtml(person, r){
  var settings = personTaxSettings(person);
  var pid = escapeAttr(person);
  var capPct = r.capAvailable > 0 ? Math.min(100, (r.totalConcessional / r.capAvailable) * 100) : 0;
  var contributingRows = state.income.filter(function(i){ return i.incomeType === "Gross" && i.person === person; });
  var rowsSummary = contributingRows.map(function(i){ return escapeAttr(i.what) + " " + fmtCurrency0.format(periodsOf(i.amount, i.freq).yearly) + "/yr"; }).join(" + ");
  var baseLabel = Math.abs(r.packageTotal - r.gross) > 1 ? "Base salary (excl. super) /yr" : "Total gross income /yr";
  return (rowsSummary ? '<p class="tax-rows-summary">Adds up: ' + rowsSummary + ' = <b>' + fmtCurrency0.format(r.packageTotal) + '/yr</b> total gross</p>' : '') +
    '<div class="tax-hero"><span class="tax-hero-label">Net take-home</span><div class="tax-hero-value"><span data-out="nettakehome">' + fmtCurrency0.format(r.netTakeHome) + '</span><small> /yr · <span data-out="nettakehomemo">' + fmtCurrency0.format(r.netTakeHome / 12) + '</span> /mo</small></div></div>' +
    '<div class="tax-waterfall">' + renderTaxWaterfallHtml(r) + '</div>' +
    '<p class="tax-secondary-line">' + baseLabel.replace(" /yr", "") + ' <b data-out="gross">' + fmtCurrency0.format(r.gross) + '</b> · IP share <b data-out="ipshare" class="' + (r.ipShare < 0 ? "neg" : "") + '">' + (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + '</b> · Taxable income <b data-out="taxable">' + fmtCurrency0.format(r.taxable) + '</b> /yr</p>' +
    (Math.abs(r.packageTotal - r.gross) > 1
      ? '<p class="tax-package-note" data-out="packagenote" style="margin:-6px 0 12px">Of that ' + fmtCurrency0.format(r.packageTotal) + ', ' + fmtCurrency0.format(r.packageTotal - r.gross) + ' is super already included inside a row marked "Super: Included" — so tax and take-home are calculated on ' + fmtCurrency0.format(r.gross) + ' base salary, not the full ' + fmtCurrency0.format(r.packageTotal) + '. (Total super for the year, from every row, is in the cap line below.)</p>'
      : '') +
    '<div class="tax-inputs-label">Concessional cap usage <span class="calc-help" title="Estimated from your inputs below — not something you set directly.">ⓘ</span></div>' +
    '<div class="cap-bar-track"><div class="cap-bar-fill' + (r.capExceeded > 0 ? " over" : "") + '" style="width:' + Math.min(100, capPct) + '%"></div></div>' +
    '<div class="tax-cap-note' + (r.capExceeded > 0 ? " warn" : "") + '">' +
      (r.capExceeded > 0
        ? ('Over cap by ' + fmtCurrency0.format(r.capExceeded) + ' — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.')
        : (fmtCurrency0.format(r.totalConcessional) + ' of ' + fmtCurrency0.format(r.capAvailable) + ' concessional cap used (SG ' + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? ' + bonus/income sacrifice ' + fmtCurrency0.format(r.autoSacrifice) : '') + (r.manualSacrifice > 0 ? ' + manual sacrifice ' + fmtCurrency0.format(r.manualSacrifice) : '') + ') — super received net of 15% contributions tax: ' + fmtCurrency0.format(r.superNet))
      ) +
    '</div>' +
    '<div class="tax-cap-note tax-div293-note warn"' + (r.div293Tax > 0.5 ? '' : ' hidden') + ' title="Simplified: income for surcharge purposes is approximated as taxable income + your within-cap concessional contributions, ignoring reportable fringe benefits and net investment losses. Check with your accountant.">Division 293: your income is over the $250,000 threshold, so an extra 15% applies to ' + fmtCurrency0.format(Math.min(r.totalConcessional, r.capAvailable)) + ' of low-tax super contributions — ' + fmtCurrency0.format(r.div293Tax) + '/yr, assessed separately by the ATO (not withheld from take-home above).</div>' +
    '<div class="tax-cap-note tax-mscb-note"' + (r.superOverCap ? '' : ' hidden') + ' title="Employer super guarantee isn\'t compulsory on ordinary-time earnings above this threshold — indexed each financial year.">Your ordinary earnings are over the ' + fmtCurrency0.format(MAX_SUPER_BASE) + '/yr Maximum Super Contribution Base, so employer super isn\'t compulsory on the excess — SG above is capped accordingly.</div>' +
    '<details class="tax-advanced" style="margin-top:12px"><summary>Adjust ownership &amp; sacrifice</summary>' +
      '<div class="tax-inputs-panel" style="margin-top:8px">' +
        '<div class="tax-inputs">' +
          '<div class="proj-field"><label>IP ownership %</label><input type="number" min="0" max="100" step="1" class="tax-ipshare" value="' + r.ownershipPct + '"></div>' +
          '<div class="proj-field"><label title="Separate from the Cash / Sacrifice column on income rows above — use this for sacrifice not tied to a specific item">Manual sacrifice $/yr</label><input type="number" min="0" step="500" class="tax-sacrifice" value="' + settings.superSacrificeAnnual + '"><button type="button" class="calc-hint-link" style="margin-top:4px" data-tax-maxcap="' + pid + '" title="Fills your remaining concessional cap headroom this year with manual sacrifice (SG and any auto/bonus sacrifice already counted): sets manual sacrifice to ' + fmtCurrency0.format(Math.max(0, r.capAvailable - r.sg - r.autoSacrifice)) + '">Max out cap</button></div>' +
        '</div>' +
        '<details class="tax-advanced"><summary>Advanced — concessional cap &amp; carry-forward</summary>' +
          '<div class="tax-inputs">' +
            '<div class="proj-field"><label>Concessional cap $/yr</label><input type="number" min="0" step="500" class="tax-cap" value="' + settings.concessionalCap + '"></div>' +
            '<div class="proj-field"><label>Carry-forward available $</label><input type="number" min="0" step="500" class="tax-carryforward" value="' + settings.carryForward + '"></div>' +
          '</div>' +
        '</details>' +
      '</div>' +
    '</details>';
}

// Session-only (not persisted) — which Tax & Super cards are showing the calculation
// breakdown instead of the normal front. Keyed by person so it survives a full re-render
// (e.g. from an income edit elsewhere) without snapping back to the front on its own.
var taxCardFlipped = {};

export function flipTaxCard(panel, person){
  var face = panel.querySelector("[data-flipface]");
  if(!face || face.classList.contains("is-flipping")) return;
  var willShowBack = !taxCardFlipped[person];
  taxCardFlipped[person] = willShowBack;
  var buildFace = function(){ return willShowBack ? personBreakdownHtml(person) : taxPersonFrontBodyHtml(person, computePersonTax(person)); };
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    face.innerHTML = buildFace();
    return;
  }
  face.classList.add("is-flipping");
  face.style.transform = "rotateY(90deg)";
  setTimeout(function(){
    face.innerHTML = buildFace();
    face.style.transition = "none";
    face.style.transform = "rotateY(-90deg)";
    void face.offsetWidth;
    face.style.transition = "";
    face.style.transform = "rotateY(0deg)";
    setTimeout(function(){ face.classList.remove("is-flipping"); }, 180);
  }, 160);
}

export function patchAllTaxPersonOutputs(){
  document.querySelectorAll("[data-tax-person]").forEach(function(panel){
    var person = panel.getAttribute("data-tax-person");
    var r = computePersonTax(person);
    var set = function(key, text, isNeg){
      var el = panel.querySelector('[data-out="' + key + '"]');
      if(!el) return;
      el.textContent = text;
      if(isNeg !== undefined) el.classList.toggle("neg", isNeg);
    };
    set("gross", fmtCurrency0.format(r.gross));
    set("ipshare", (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare), r.ipShare < 0);
    set("taxable", fmtCurrency0.format(r.taxable));
    set("nettakehome", fmtCurrency0.format(r.netTakeHome));
    set("nettakehomemo", fmtCurrency0.format(r.netTakeHome / 12));
    patchTaxWaterfall(panel, r);
    var marginalEl = panel.querySelector(".tax-marginal");
    if(marginalEl) marginalEl.textContent = "Marginal rate " + fmtPercent1.format(r.marginalRate) + " · effective " + fmtPercent1.format(r.effectiveRate);
    var capPct = r.capAvailable > 0 ? Math.min(100, (r.totalConcessional / r.capAvailable) * 100) : 0;
    var fill = panel.querySelector(".cap-bar-fill");
    if(fill){ fill.style.width = Math.min(100, capPct) + "%"; fill.classList.toggle("over", r.capExceeded > 0); }
    var note = panel.querySelector(".tax-cap-note:not(.tax-div293-note)");
    if(note){
      note.classList.toggle("warn", r.capExceeded > 0);
      note.textContent = r.capExceeded > 0
        ? ("Over cap by " + fmtCurrency0.format(r.capExceeded) + " — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.")
        : (fmtCurrency0.format(r.totalConcessional) + " of " + fmtCurrency0.format(r.capAvailable) + " concessional cap used (SG " + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? " + bonus/income sacrifice " + fmtCurrency0.format(r.autoSacrifice) : "") + (r.manualSacrifice > 0 ? " + manual sacrifice " + fmtCurrency0.format(r.manualSacrifice) : "") + ") — super received net of 15% contributions tax: " + fmtCurrency0.format(r.superNet));
    }
    var div293Note = panel.querySelector(".tax-div293-note");
    if(div293Note){
      div293Note.hidden = !(r.div293Tax > 0.5);
      div293Note.textContent = "Division 293: your income is over the $250,000 threshold, so an extra 15% applies to " + fmtCurrency0.format(Math.min(r.totalConcessional, r.capAvailable)) + " of low-tax super contributions — " + fmtCurrency0.format(r.div293Tax) + "/yr, assessed separately by the ATO (not withheld from take-home above).";
    }
    var mscbNote = panel.querySelector(".tax-mscb-note");
    if(mscbNote) mscbNote.hidden = !r.superOverCap;
    var pkgNote = panel.querySelector('[data-out="packagenote"]');
    if(pkgNote && Math.abs(r.packageTotal - r.gross) > 1){
      pkgNote.textContent = "Of that " + fmtCurrency0.format(r.packageTotal) + ", " + fmtCurrency0.format(r.packageTotal - r.gross) + " is super already included inside a row marked \"Super: Included\" — so tax and take-home are calculated on " + fmtCurrency0.format(r.gross) + " base salary, not the full " + fmtCurrency0.format(r.packageTotal) + ". (Total super for the year, from every row, is in the cap line below.)";
    }
  });
  var ipNote = document.querySelector("#taxSuperBody .ledger-note b");
  if(ipNote) ipNote.textContent = fmtCurrency0.format(ipNetResultAnnual());
}
