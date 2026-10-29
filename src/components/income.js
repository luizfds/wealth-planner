import { state } from "../state.js";
import { FREQS, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, MAX_SUPER_BASE, MONTH_NAMES, sacrificeModeToLabel, sacrificeLabelToMode } from "../constants.js";
import { periodsOf, sumField, nextPayDate, payScheduleKindFor, daysUntil, WEEKDAY_NAMES, householdYearWindow, isActiveOn } from "../calc/ledger.js";
import { ipNetResultAnnual, ipDepreciationAnnual, ipOwnershipMismatches, propertyOwnershipTotal, fyLabel } from "../calc/property.js";
import { getTaxPeople, incomeRowSuperNote, personTaxSettings, computePersonTax, wfhRateForFy, phiRebateAdjustment, taxTablesFor, currentTaxFy, phiPremiumsAnnual, phiLine, personRowsAfterTax } from "../calc/tax.js";
import { claimItems } from "../calc/claims.js";
import { projectWithholding } from "../calc/withholding.js";
import { renderJuneMoves } from "./junemoves.js";
import { superTopUp } from "../calc/supertopup.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr, fmtDate } from "../lib/format.js";
import { payFrequency } from "../calc/payslip.js";
import { payslipCheck } from "../calc/payslipcheck.js";
import { escapeAttr } from "../lib/html.js";
import { optionsHtml, historyTrendHtml, timingFieldsHtml, endDateNoteHtml, scenarioVaryNoteHtml, hasEnded, rowEditSlot } from "../lib/ledger-table.js";
import { parseCsv } from "../lib/backup.js";
import { injectScenarioOverrideButtons } from "./expenses.js";
import { renderTaxYear } from "./taxyear.js";
import { SHOW_AS, showAsOption, fromMonthly, DEFAULT_HOURS_PER_WEEK } from "../calc/showas.js";

// ---- Show as (v3.138.0): the Income tab read per year, month, fortnight, week, day or hour ----
// A way of reading, not data: kept per device, like the ⓘ preference. calc/showas.js converts.
var SHOW_AS_KEY = "wealthPlanner.incomeShowAs";
export function incomeShowAs(){ try { return showAsOption(localStorage.getItem(SHOW_AS_KEY)).key; } catch(e){ return "month"; } }
export function setIncomeShowAs(key){ try { localStorage.setItem(SHOW_AS_KEY, showAsOption(key).key); } catch(e){} }
// A person's hours a week (Tax → People; 38 until set). The household group has none of its own.
export function hoursPerWeekOf(groupKey){
  if(!groupKey || groupKey === "__household") return null;
  var st = state.tax.settings && state.tax.settings[groupKey];
  var h = st && st.hoursPerWeek;
  return h != null && h !== "" && Number(h) >= 0 ? Number(h) : DEFAULT_HOURS_PER_WEEK;
}
function everyonesHours(groups){
  return groups.reduce(function(s, g){ return s + (hoursPerWeekOf(g.key) || 0); }, 0);
}
// A monthly figure as shown: "$1,234<span>/wk</span>"-style pieces, or a dash where per hour has
// nobody's hours to go by.
function shownAmount(monthly, hours, fmt){
  var key = incomeShowAs(), v = fromMonthly(monthly, key, hours);
  return v == null ? null : (fmt || fmtCurrency0).format(v);
}
var NO_HOURS = "Per hour goes by the hours a person works — shared income has no one's hours";
// The Income header's figure: the monthly total it has always shown (the caller's), in the chosen period.
export function incomeHeaderTotal(total){
  var groups = computeIncomeGroups(), key = incomeShowAs();
  var v = fromMonthly(total, key, everyonesHours(groups));
  return { label: showAsOption(key).long + " total", value: v == null ? "—" : fmtCurrency0.format(v) };
}
function showAsControlHtml(){
  var cur = incomeShowAs();
  return '<div class="income-showas"><span class="cf-filter-l">Show as</span><div class="seg-control" role="group" aria-label="Show income per">' + SHOW_AS.map(function(o){
    var on = o.key === cur;
    return '<button type="button" class="seg-option' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-showas="' + o.key + '">' + o.label + '</button>';
  }).join("") + '</div>' + (cur === "hour" ? '<small>Each person\'s hours a week are under Tax → People (38 until set).</small>' : '') + '</div>';
}

export function personBreakdownHtml(person){
  var r = computePersonTax(person);
  var row = function(label, value, cls){
    return '<div class="rb-row' + (cls ? " " + cls : "") + '"><span class="rb-label">' + escapeAttr(label) + '</span><span class="rb-value">' + value + '</span></div>';
  };
  // The two derivations that used to sit on the front of the card, where they cost 167px above the
  // headline they were explaining. This panel is the place for "how was this arrived at".
  var contributingRows = state.income.filter(function(i){ return i.incomeType === "Gross" && i.person === person; });
  var rowsSummary = contributingRows.map(function(i){ return escapeAttr(i.what) + " " + fmtCurrency0.format(periodsOf(i.amount, i.freq).yearly) + "/yr"; }).join(" + ");
  var html = "";
  if(rowsSummary){
    html += '<p class="calc-note rb-adds-up">Adds up: ' + rowsSummary + ' = <b>' + fmtCurrency0.format(r.packageTotal) + '/yr</b> total gross</p>';
  }
  html += '<div class="row-breakdown-panel">';
  html += row("Gross income (excl. super)", fmtCurrency0.format(r.gross) + "/yr");
  if(Math.abs(r.ipShare) > 0.5) html += row("IP share", (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + "/yr");
  html += row("Taxable income", fmtCurrency0.format(r.taxable) + "/yr");
  html += row("Income tax", "−" + fmtCurrency0.format(r.incomeTax) + "/yr", "neg");
  html += row("Medicare levy", "−" + fmtCurrency0.format(r.medicare) + "/yr", "neg");
  if(r.sacrifice > 0.5) html += row("Super sacrifice", "−" + fmtCurrency0.format(r.sacrifice) + "/yr", "neg");
  html += row("Net take-home", fmtCurrency0.format(r.netTakeHome) + "/yr", "rb-total");
  if(Math.abs(r.ipTaxEffect) > 0.5) html += row("Payslip take-home", fmtCurrency0.format(r.payslipTakeHome) + "/yr", "rb-secondary");
  html += '</div>';
  if(Math.abs(r.packageTotal - r.gross) > 1){
    html += '<p class="calc-note">Of that ' + fmtCurrency0.format(r.packageTotal) + ', ' + fmtCurrency0.format(r.packageTotal - r.gross) +
      ' is super already included inside a row marked "Super: Included" — so tax and take-home are calculated on ' +
      fmtCurrency0.format(r.gross) + ' base salary, not the full ' + fmtCurrency0.format(r.packageTotal) +
      '. (Total super for the year, from every row, is in the cap line on the front of this card.)</p>';
  }
  if(Math.abs(r.ipTaxEffect) > 0.5){
    var isBenefit = r.ipTaxEffect > 0;
    html += '<p class="calc-note rb-ip-note">' +
      (isBenefit ? "+" : "−") + fmtCurrency0.format(Math.abs(r.ipTaxEffect)) + "/yr " + (isBenefit ? "less" : "more") +
      " tax from this property’s " + (r.ipShare < 0 ? "loss" : "profit") + " — “Net take-home” above includes it for the year, " +
      (isBenefit
        ? "but it isn't in any payslip: the monthly take-home is the payslip figure, and this is planned as a refund after lodging (unless Tax → People says a PAYG withholding variation already puts it in each pay)."
        : "but it's owed when the return is lodged, not taken from each pay.") +
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
      var opt = showAsOption(incomeShowAs());
      if(opt.key === "hour"){
        // Per hour doesn't add up person by person (each divides by their own hours), so the line
        // says what the household's figure is made of instead.
        var t = shownAmount(total, everyonesHours(groups));
        summaryEl.innerHTML = "Together: <b>" + (t || "—") + " " + opt.suffix + "</b> — the household's income over everyone's " + everyonesHours(groups) + " hours a week";
      } else {
        var parts = groups.map(function(g){ return (g.key === "__household" ? "Household" : g.key) + " " + shownAmount(g.monthly); }).join(" + ");
        summaryEl.innerHTML = "Adds up: " + parts + " = <b>" + shownAmount(total) + " " + opt.suffix + "</b> total household income";
      }
      summaryEl.style.display = "";
    } else {
      summaryEl.style.display = "none";
    }
  }
  document.querySelectorAll("#incomeGroups .m-card").forEach(function(card, gi){
    var totalEl = card.querySelector(".m-card-total");
    if(totalEl && groups[gi]) totalEl.innerHTML = groupTotalHtml(groups[gi]);
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
  // v3.151.2: pay that stops is said on the row that stops (endingNoteHtml), not as a negative row
  // of income that "starts" the day after — that one is only for the forecast.
  // v3.152.0: and a person's take-home and bonus-after-tax rows — their figures sit on the rows that
  // earn them now (afterTaxHtml), with the take-home under the list (takeHomeLineHtml).
  return g.items.map(function(item, i){ return { item: item, i: i }; }).filter(function(x){ return !x.item.syntheticEndingFor && !x.item.syntheticNetFor && !x.item.syntheticOneOffFor; }).map(function(x){
    var item = x.item, i = x.i;
    var colorIdx = null;
    if(!item.computed){ colorIdx = contribIdx % 8; contribIdx++; }
    return { item: item, idx: g.indices[i], colorIdx: colorIdx };
  });
}

function groupTotalHtml(g){
  var v = shownAmount(g.monthly, hoursPerWeekOf(g.key));
  return v == null ? '<span title="' + NO_HOURS + '">—</span>' : v + '<span>' + showAsOption(incomeShowAs()).suffix + '</span>';
}
function rowAmountText(item, monthly){
  var v = shownAmount(monthly, hoursPerWeekOf(incomeGroupKey(item)), fmtCurrency2);
  return v == null ? "—" : v + showAsOption(incomeShowAs()).suffix;
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
  resetAfterTaxCache();
  patchIncomeGroupTotals();
  var order = incomeGroupOrder();
  container.innerHTML = showAsControlHtml() + '<div class="m-people">' + groups.map(function(g){
    var label = g.key === "__household" ? "Household / Shared" : g.key;
    var addValue = g.key === "__household" ? "" : g.key;
    var avatarClass = g.key === "__household" ? "m-avatar-neutral" : "series-color-" + (order.indexOf(g.key) % 8);
    var initial = escapeAttr(label.charAt(0).toUpperCase());
    var rowMeta = incomeGroupRowMeta(g);
    var rows = rowMeta.map(function(m){ return modernIncomeRowHtml(m.item, m.idx, m.colorIdx); }).join("") +
      (g.key === "__household" ? "" : takeHomeLineHtml(g.key));
    return '<div class="m-card">' +
      '<div class="m-card-head"><span class="m-avatar ' + avatarClass + '">' + initial + '</span>' +
      '<div class="m-card-name">' + escapeAttr(label) + '</div>' +
      '<div class="m-card-total">' + groupTotalHtml(g) + '</div></div>' +
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
    return '<div class="pay-hist-row"><span class="pay-hist-date">' + escapeAttr(fmtDate(entry.date)) + '</span>' +
      '<span class="pay-hist-value">' + fmtCurrency2.format(entry.value) + '</span>' + deltaHtml + '</div>';
  }).join("");
  var more = hist.length > 8 ? '<p class="ledger-note" style="margin:6px 0 0">and ' + (hist.length - 8) + ' earlier</p>' : "";
  return '<div class="pay-hist">' + rows + '</div>' + more;
}
// v3.146.1: under a person's own card a row needn't name them again — "Alex — Net income (after
// tax & super)" reads as "Net income (after tax & super)" there. Elsewhere (Home, reports, search)
// the full name stays, since nothing around it says whose it is.
export function incomeRowLabel(item){
  var what = String(item.what || ""), key = incomeGroupKey(item);
  if(!key || key === "__household") return what;
  var prefix = key + " — ";
  if(what.indexOf(prefix) !== 0 || what.length <= prefix.length) return what;
  var rest = what.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
// v3.151.3: a payslip's "net pay" counts after-tax payments made with the salary (a phone
// reimbursement) that the plan keeps as rows of their own. On the take-home row, the two together —
// the figure to hold a payslip against — without adding them into it, which would count them twice.
// After-tax rows: the person's own typed Net rows paid into the account their salary goes to.
export function payslipNetLine(item){
  if(!item || !item.syntheticNetFor) return "";
  var person = item.syntheticNetFor, salary = salaryRowFor(person);
  var acct = salary && salary.account;
  if(!acct) return "";
  var extra = (state.income || []).filter(function(i){ return i.person === person && i.incomeType === "Net" && !i.computed && i.account === acct && isActiveOn(i, localDateStr()); });
  if(!extra.length) return "";
  var add = extra.reduce(function(t, i){ return t + periodsOf(Number(i.amount) || 0, i.freq).monthly; }, 0);
  if(!(Math.abs(add) >= 0.5)) return "";
  // v3.152.1: in the period Income is shown in, like every other figure on the card.
  var v = shownAmount((Number(item.amount) || 0) + add, hoursPerWeekOf(person), fmtCurrency0);
  if(v == null) return "";
  return "Net pay on the payslip: " + v + showAsOption(incomeShowAs()).suffix + ", with " + extra.map(function(i){ return i.what || "an after-tax payment"; }).join(" and ");
}
// v3.151.2: what take-home drops by once this row stops (its after-tax "ends" row, engine.js).
export function endingNoteHtml(item){
  if(!item || !item.id || !item.endDate) return "";
  var e = (state.income || []).find(function(i){ return i.syntheticEndingFor === item.id; });
  if(!e || !(Math.abs(Number(e.amount) || 0) >= 0.5)) return "";
  var v = shownAmount(Math.abs(Number(e.amount)), hoursPerWeekOf(item.person), fmtCurrency0);
  return v == null ? "" : 'Take-home −' + v + showAsOption(incomeShowAs()).suffix + ' after tax from then';
}
// v3.152.0: what a Gross row comes to after tax (calc/tax.js personRowsAfterTax), under its gross
// figure in the same column, in the period Income is shown in. Worked out once a person per render.
var afterTaxCache = {};
export function resetAfterTaxCache(){ afterTaxCache = {}; }
var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function afterTaxHtml(item){
  if(!item || !item.person || !item.id) return "";
  if(!afterTaxCache[item.person]){ try { afterTaxCache[item.person] = personRowsAfterTax(item.person); } catch(e){ afterTaxCache[item.person] = {}; } }
  var a = afterTaxCache[item.person][item.id];
  if(!a) return "";
  var v = shownAmount(a.monthly, hoursPerWeekOf(item.person), fmtCurrency0);
  if(v == null) return "";
  return '<small class="m-row-after">' + v + showAsOption(incomeShowAs()).suffix + ' after tax' +
    (a.oneOff ? '<br>(' + fmtCurrency0.format(a.yearly) + (a.dueMonth ? ' in ' + MONTH_SHORT[a.dueMonth - 1] : ' once a year') + ')' : '') + '</small>';
}
// Under a person's rows: their take-home, and the payslip's net pay when after-tax payments come with it.
export function takeHomeLineHtml(person){
  var net = (state.income || []).find(function(i){ return i.syntheticNetFor === person; });
  if(!net) return "";
  var v = shownAmount(periodsOf(Number(net.amount) || 0, net.freq).monthly, hoursPerWeekOf(person), fmtCurrency2);
  var slip = payslipNetLine(net);
  return '<div class="m-takehome" data-takehome="' + escapeAttr(person) + '"><span>Take-home pay<small>after tax & super, as a payslip pays it</small></span><b>' + (v == null ? "—" : v + showAsOption(incomeShowAs()).suffix) + '</b>' +
    (slip ? '<small class="m-takehome-slip">' + escapeAttr(slip) + '</small>' : '') + '</div>';
}
function modernIncomeRowHtml(item, idx, colorIdx){
  var isComputed = !!item.computed;
  var isGrossRef = item.incomeType === "Gross" && !isComputed;
  var monthly = periodsOf(item.amount, item.freq).monthly;
  var note = isGrossRef ? incomeRowSuperNote(item) : "";
  var dot = colorIdx != null ? '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' : "";
  var trendHtml = isComputed ? "" : historyTrendHtml(item);
  var after = isGrossRef ? afterTaxHtml(item) : "";
  var summary = '<div class="m-row-summary"' + (isComputed ? ' style="cursor:default"' : ' role="button" tabindex="0" data-row-toggle') + '>' +
    (isComputed ? "" : dot) +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(incomeRowLabel(item)) + '</div>' +
      (note ? '<div class="m-row-sub super-note">' + escapeAttr(note) + '</div>' : "") +
      (trendHtml ? '<div class="m-row-sub">' + trendHtml + '</div>' : "") +
      (isComputed ? "" : (function(){ var n = nextPayNoteHtml(item); return n ? '<div class="m-row-sub">' + n + '</div>' : ""; })()) +
      (function(){ var e = endDateNoteHtml(item); return e ? '<div class="m-row-sub">' + e + '</div>' : ""; })() +
      // With its after-tax figure beside it (v3.152.0), "Ends 31 Dec" already says what goes.
      (after ? "" : (function(){ var t = endingNoteHtml(item); return t ? '<div class="m-row-sub">' + escapeAttr(t) + '</div>' : ""; })()) +
      (function(){ var v = scenarioVaryNoteHtml(item, state.activeScenario); return v ? '<div class="m-row-sub">' + v + '</div>' : ""; })() +
    '</div>' +
    (isGrossRef && !after ? '<span class="m-row-tag gross">Gross</span>' : "") +
    '<span class="m-row-amt' + (after ? " has-after" : "") + (hasEnded(item) ? " row-amt-ended" : "") + '" data-computed="amt">' + rowAmountText(item, monthly) + (after || "") + '</span>' +
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
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="income" data-index="' + idx + '">' + summary + rowEditSlot(isOpen, edit) + '</div>';
}

// v3.152.0: after an edit, every Gross row's figures (gross and after tax) and each person's
// take-home line, without a full render — the row being edited stays open.
export function patchIncomeAfterTax(){
  var table = document.getElementById("incomeGroups");
  if(!table) return;
  resetAfterTaxCache();
  state.income.forEach(function(item, idx){
    if(item.incomeType !== "Gross" || item.computed) return;
    var tr = table.querySelector('[data-index="' + idx + '"]');
    var amt = tr && tr.querySelector('[data-computed="amt"]');
    if(!amt) return;
    var after = afterTaxHtml(item);
    amt.innerHTML = rowAmountText(item, periodsOf(Number(item.amount) || 0, item.freq).monthly) + after;
    amt.classList.toggle("has-after", !!after);
  });
  table.querySelectorAll("[data-takehome]").forEach(function(el){
    var html = takeHomeLineHtml(el.getAttribute("data-takehome"));
    if(html) el.outerHTML = html;
  });
}
export function patchSyntheticIncomeRows(){
  var table = document.getElementById("incomeGroups");
  if(!table) return;
  state.income.forEach(function(item, idx){
    if(!item.syntheticNetFor && !item.syntheticRentForProperty && !item.syntheticOneOffFor && !item.syntheticRefundFor && !item.syntheticEndingFor) return;
    var tr = table.querySelector('[data-index="' + idx + '"]');
    if(!tr) return;
    var amountInput = tr.querySelector(".f-amount");
    if(amountInput) amountInput.value = item.amount;
    var p = periodsOf(item.amount, item.freq);
    var modernAmt = tr.querySelector('[data-computed="amt"]');
    if(modernAmt) modernAmt.textContent = rowAmountText(item, p.monthly);
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

// The bar answers one question — everything that came in, and where it went — so the segments have
// to be exhaustive or the answer is a lie. They were not: the Medicare levy surcharge (v2.82.0) and
// the HELP repayment (v2.81.0) both came out of take-home and neither was ever added here, so the
// bar and its legend left $18,350 of a $161,900 salary unaccounted for on a test household's data. The
// most-read figure on the page, quietly wrong for five versions.
//
// taxWaterfallTotal() states what the segments add up to, and a unit test pins the identity. If you
// add another deduction to computePersonTax, it belongs here too.
// `label` is the full name, used for the bar's hover tooltip. `short` is what the legend prints:
// at 390px the legend has ~282px to work with, so the two longest names are the difference between
// a two-column legend and a five-row column of one item each. The short forms only ever sit
// directly under the full-length "Medicare levy" line, which is what makes "Surcharge" readable.
//
// No two segments may share a hue. series-color-5 (#008300) was HELP's until it turned out to sit
// next to Medicare levy's series-color-2 (#1baf7a) in the bar — two greens, indistinguishable at a
// glance and worse for anyone with a green deficiency. series-color-6 (purple) is the free slot.
var TAX_WATERFALL_SEGMENTS = [
  { key: "nettakehome", label: "Net take-home", short: "Net take-home", colorClass: "series-color-0" },
  { key: "incometax", label: "Income tax", short: "Income tax", colorClass: "series-color-1" },
  { key: "medicare", label: "Medicare levy", short: "Medicare levy", colorClass: "series-color-2" },
  { key: "surcharge", label: "Medicare levy surcharge", short: "Surcharge", colorClass: "series-color-4" },
  { key: "help", label: "HELP/HECS repayment", short: "HELP/HECS", colorClass: "series-color-6" },
  { key: "sacrifice", label: "To super (sacrifice)", short: "To super", colorClass: "series-color-3" }
];
export function taxWaterfallValues(r){
  return {
    nettakehome: Math.max(0, r.netTakeHome),
    incometax: Math.max(0, r.incomeTax),
    medicare: Math.max(0, r.medicare),
    surcharge: Math.max(0, r.medicareSurcharge || 0),
    help: Math.max(0, r.helpRepayment || 0),
    sacrifice: Math.max(0, r.sacrifice)
  };
}
// What the segments sum to: the salary package plus any dividend money, since net take-home
// carries the dividend cash and the franking credit is settled through the tax bill. Stated rather
// than implied, because "where did it go" is only meaningful against a named total.
export function taxWaterfallTotal(r){
  return Math.max(0, r.gross) + Math.max(0, r.dividendCash || 0) + Math.max(0, r.frankingCredit || 0);
}
function waterfallWhole(values){
  return TAX_WATERFALL_SEGMENTS.reduce(function(sum, seg){ return sum + values[seg.key]; }, 0);
}
function renderTaxWaterfallHtml(r){
  var values = taxWaterfallValues(r);
  var whole = waterfallWhole(values);
  var bar = TAX_WATERFALL_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
    return '<div class="tax-waterfall-seg ' + seg.colorClass + '" data-seg-bar="' + seg.key + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + escapeAttr(seg.label) + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
  }).join("");
  // Zero rows are hidden, not omitted: six segments means most people would otherwise read two or
  // three "$0" lines, but patchAllTaxPersonOutputs writes by data-seg-val and needs the element to
  // still be there when a figure appears. Net take-home always shows, even at $0 — that's the
  // headline, and a missing headline reads as a broken card.
  var legend = TAX_WATERFALL_SEGMENTS.map(function(seg){
    var empty = seg.key !== "nettakehome" && !(values[seg.key] > 0);
    return '<div class="tax-waterfall-item" data-seg-row="' + seg.key + '"' + (empty ? " hidden" : "") + '><span class="proj-swatch ' + seg.colorClass + '"></span><div class="tax-waterfall-item-text"><span class="tax-waterfall-item-label" title="' + escapeAttr(seg.label) + '">' + seg.short + '</span><span class="tax-waterfall-item-value" data-seg-val="' + seg.key + '">' + fmtCurrency0.format(values[seg.key]) + '</span></div></div>';
  }).join("");
  return '<div class="tax-waterfall-bar" data-waterfall-bar>' + bar + '</div><div class="tax-waterfall-legend">' + legend + '</div>';
}
function patchTaxWaterfall(panel, r){
  var values = taxWaterfallValues(r);
  var whole = waterfallWhole(values);
  var barWrap = panel.querySelector("[data-waterfall-bar]");
  if(barWrap) barWrap.innerHTML = TAX_WATERFALL_SEGMENTS.filter(function(seg){ return values[seg.key] > 0; }).map(function(seg){
    return '<div class="tax-waterfall-seg ' + seg.colorClass + '" data-seg-bar="' + seg.key + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + escapeAttr(seg.label) + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
  }).join("");
  TAX_WATERFALL_SEGMENTS.forEach(function(seg){
    var el = panel.querySelector('[data-seg-val="' + seg.key + '"]');
    if(el) el.textContent = fmtCurrency0.format(values[seg.key]);
    var row = panel.querySelector('[data-seg-row="' + seg.key + '"]');
    if(row) row.hidden = seg.key !== "nettakehome" && !(values[seg.key] > 0);
  });
}
// The shares on one property adding to 97% or 140% is not a rounding artifact — it means the
// portfolio result reaching these cards is under- or over-claimed by that much, which is precisely
// the failure the old single global percentage could never even surface (two people could each
// enter 100% and the same loss was deducted twice, in silence). Nothing rescales: the fix belongs
// on the property, and this says which one.
function ipOwnershipWarningHtml(){
  var bad = ipOwnershipMismatches();
  if(!bad.length) return "";
  return '<p class="tax-cap-note warn" style="margin:0 0 12px">Ownership doesn\'t add up to 100% on ' +
    bad.map(function(p){
      return '<b>' + escapeAttr(p.what || "an unnamed property") + '</b> (' + Math.round(propertyOwnershipTotal(p)) + '%)';
    }).join(", ") +
    ' — so the result below is ' + (propertyOwnershipTotal(bad[0]) > 100 ? "over" : "under") +
    '-claimed against it. Fix it in that card\'s Ownership section in Net worth → Property.</p>';
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
  // Household-level, not per person: a hospital policy covers a household, and once you have a
  // spouse the surcharge is assessed on family income against family thresholds.
  // v3.154.0: the household's settings fold away below the people — set once a year, read past every day.
  var settingsHtml = '<details class="tax-advanced tax-household"' + (taxUi.householdOpen ? ' open' : '') + ' data-tax-household><summary>Household settings <span class="ps-summary-line">super guarantee, hospital cover, rebate tier' + (ipResult ? ', the rental\'s result' : '') + '</span></summary>' +
    '<div class="tax-global">' +
    '<div class="proj-field"><label for="taxSgRate">Super guarantee % p.a.</label><input type="number" min="0" max="30" step="0.1" id="taxSgRate" value="' + (Number(state.tax.sgRate) || 11.5) + '"></div>' +
    '<div class="proj-field"><label class="m-checkbox-field" title="Private hospital cover (not extras-only) exempts you from the Medicare levy surcharge at any income."><input type="checkbox" id="taxPrivateCover"' + (state.tax.privateHospitalCover ? " checked" : "") + '> Private hospital cover</label></div>' +
    phiPremiumFieldsHtml() +
    '<div class="proj-field"><label for="taxPhiTier" title="The income tier you told your insurer — it sets the rebate taken off your premiums. Your return works out the right tier and adjusts the difference.">Rebate tier with insurer</label><select id="taxPhiTier">' +
      [["0", "Base tier"], ["1", "Tier 1"], ["2", "Tier 2"], ["3", "Tier 3"], ["-1", "No rebate taken"]].map(function(o){ return '<option value="' + o[0] + '"' + (String(state.tax.phiTierClaimed == null ? 0 : state.tax.phiTierClaimed) === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") +
    '</select></div>' +
    '<div class="proj-field"><label class="m-checkbox-field" title="Couples and anyone with dependants are assessed against family thresholds — roughly double the singles ones (+$1,500 per child after the first, which this app doesn\'t model)."><input type="checkbox" id="taxFamilyThresholds"' + (state.tax.familyThresholds ? " checked" : "") + '> Family thresholds</label></div>' +
    '</div>' +
    '<p class="ledger-note tax-phi-note" style="margin:0 0 8px">' + phiNoteText() + '</p>';
  var html = (taxTablesFor().assumed ? '<p class="ledger-note warn" style="margin:0 0 8px">' + householdYearWindow().label + ' rates aren\'t all published yet — this uses the latest year the app has (' + "FY" + String(taxTablesFor().borrowedFrom % 100).padStart(2, "0") + "/" + String((taxTablesFor().borrowedFrom + 1) % 100).padStart(2, "0") + ').</p>' : '');
  // Depreciation is named separately because it's the part of the result that isn't cash — leaving
  // it folded into one figure is how people conclude a property "costs" more or less than it does.
  var ipDepreciation = ipDepreciationAnnual();
  settingsHtml += '<p class="ledger-note tax-ip-note" style="margin:0">Investment property result this year: <b style="font-family:var(--font-num)">' + fmtCurrency0.format(ipResult) + '</b> (' + (ipResult < 0 ? "a loss — negatively geared, reduces taxable income" : "net rental profit — adds to taxable income") + '), shared out as each person\'s IP share above — by ownership, set per property, on each card\'s <b>Ownership</b> section in Net worth → Property.' +
    (ipDepreciation > 0
      ? ' Includes <b>' + fmtCurrency0.format(ipDepreciation) + '</b> of depreciation — a deduction that never leaves your bank account, so the cash result is that much better than the taxable one.'
      : '') + '</p></details>';
  html += ipOwnershipWarningHtml();

  html += people.map(function(person, pi){
    var r = computePersonTax(person);
    var pid = escapeAttr(person);
    return '<div class="tax-person" data-tax-person="' + pid + '">' +
      taxPersonHeadHtml(person, r, pi) +
      '<div class="m-taxp-flipface" data-flipface>' + (taxCardFlipped[person] ? personBreakdownHtml(person) : taxPersonFrontBodyHtml(person, r)) + '</div>' +
    '</div>';
  }).join("") + settingsHtml;
  container.innerHTML = html;
  renderJuneMoves();
  refreshOpenTaxYear();
}
// The worksheet reads the same figures, so when it's open it follows every recalculation.
function refreshOpenTaxYear(){
  var page = document.getElementById("page-tax");
  if(page && !page.hidden) renderTaxYear();
}

function taxPersonHeadHtml(person, r, pi){
  var pid = escapeAttr(person);
  return '<div class="tax-person-head">' +
      '<h3><span class="m-avatar series-color-' + (pi % 8) + '" style="width:24px;height:24px;font-size:11px;margin-right:8px">' + escapeAttr(person.charAt(0).toUpperCase()) + '</span>' + escapeAttr(person) + '</h3>' +
      '<span class="tax-marginal">Marginal rate ' + fmtPercent1.format(r.marginalRate) + ' · effective ' + fmtPercent1.format(r.effectiveRate) + '</span>' +
      '<button type="button" class="m-flip-btn" data-tax-flip="' + pid + '" aria-label="Flip ' + pid + '\'s card to see the calculation breakdown" title="Flip to see how this is calculated"><span aria-hidden="true">⇋</span> Breakdown</button>' +
    '</div>';
}

// Mid-year withholding check (v3.50.0) — calc/withholding.js. Three figures off the latest
// payslip; the answer is refund-or-bill for the year being earned now.
// v3.116.0: a payslip read into the check (calc/payslip.js). Session-only: the last one read, per person.
export var payslipRead = {};
// The person's main salary row: their Gross income row with the largest amount.
export function salaryRowFor(person){
  return (state.income || []).filter(function(i){ return i.person === person && i.incomeType === "Gross" && !i.computed && !i.irregular; })
    .sort(function(a, b){ return periodsOf(Number(b.amount) || 0, b.freq).yearly - periodsOf(Number(a.amount) || 0, a.freq).yearly; })[0] || null;
}
function payslipReadHtml(person){
  var pid = escapeAttr(person);
  var p = payslipRead[person];
  var out = '<div class="slip-read"><label class="btn btn-sm btn-ghost slip-pick">Read a payslip (PDF)<input type="file" accept=".pdf,application/pdf" data-slip-file="' + pid + '" hidden></label>' +
    '<details class="slip-paste"><summary>or paste its text</summary><textarea rows="5" data-slip-text="' + pid + '" placeholder="Copy everything on the payslip and paste it here"></textarea>' +
    '<button type="button" class="btn btn-sm" data-slip-read="' + pid + '">Read it</button></details>';
  if(!p) return out + '</div>';
  if(p.error) return out + '<p class="slip-out warn">' + escapeAttr(p.error) + '</p></div>';
  var money = function(v){ return v == null ? "—" : fmtCurrency2.format(v); };
  var freq = payFrequency(p);
  out += '<div class="slip-out"><b>Read from the payslip' + (p.periodEnd ? ' for the period to ' + escapeAttr(fmtDate(p.periodEnd, { year: true })) : '') + ':</b>' +
    '<span>Gross ' + money(p.gross) + (p.ytd.gross != null ? ' (' + money(p.ytd.gross) + ' this year)' : '') + '</span>' +
    '<span>Tax ' + money(p.tax) + (p.ytd.tax != null ? ' (' + money(p.ytd.tax) + ')' : '') + '</span>' +
    (p.super != null ? '<span>Super ' + money(p.super) + '</span>' : '') +
    (p.sacrifice != null ? '<span>Salary sacrifice ' + money(p.sacrifice) + '</span>' : '') +
    (p.net != null ? '<span>Net ' + money(p.net) + '</span>' : '') + '</div>';
  var actions = [];
  // v3.149.0: the year-to-date figures are used as soon as they're read (app.js applyPayslipYtd);
  // the button is only for when they weren't — the stored ones came from a later payslip.
  var stY = personTaxSettings(person).ytd || {};
  var inUse = stY.asOf === p.periodEnd && stY.gross === p.ytd.gross && stY.withheld === p.ytd.tax;
  if(p.ytd.gross != null && p.ytd.tax != null && p.periodEnd){ if(!inUse) actions.push('<button type="button" class="btn btn-sm btn-primary" data-slip-use="' + pid + '">Use the year-to-date figures</button>'); }
  else out += '<p class="slip-out">' + (p.periodEnd ? "No year-to-date column found" : "No period dates found") + ' — type the figures above.</p>';
  var row = salaryRowFor(person);
  if(row && freq && p.gross > 0){
    var planned = periodsOf(Number(row.amount) || 0, row.freq).yearly, read = periodsOf(p.gross, freq).yearly;
    if(Math.abs(read - planned) > Math.max(100, planned * 0.02)) actions.push('<button type="button" class="btn btn-sm" data-slip-salary="' + pid + '">Set “' + escapeAttr(row.what || "salary") + '” to ' + fmtCurrency2.format(p.gross) + ' ' + freq.toLowerCase() + '</button>');
  }
  // v3.148.0: the payslip against the plan, line by line (calc/payslipcheck.js), and logging the pay.
  var chk = payslipCheck(person, p);
  if(chk){
    out += '<ul class="slip-check">' + chk.lines.map(function(l){ return '<li class="' + l.tone + '">' + escapeAttr(l.text) + '</li>'; }).join("") + '</ul>';
    if(chk.loggable) actions.unshift('<button type="button" class="btn btn-sm btn-primary" data-slip-log="' + pid + '">Log ' + fmtCurrency2.format(chk.loggable.amount) + ' as received ' + escapeAttr(fmtDate(chk.loggable.date)) + '</button>');
  }
  return out + (actions.length ? '<div class="slip-actions">' + actions.join("") + '</div>' : '') + '</div>';
}
export function withholdingCheckHtml(person){
  var st = personTaxSettings(person);
  var y = st.ytd || {};
  var pid = escapeAttr(person);
  return '<details class="tax-ytd"' + (y.asOf ? " open" : "") + '><summary>Refund or bill? Check against your latest payslip</summary>' +
    '<div class="tax-inputs" style="margin-top:8px">' +
      '<div class="proj-field"><label>Payslip date</label><input type="date" class="tax-ytd-asof" aria-label="Payslip period end for ' + pid + '" value="' + escapeAttr(y.asOf || "") + '"></div>' +
      '<div class="proj-field"><label title="Year-to-date gross on the payslip, before tax — not counting super">Gross so far $</label><input type="number" min="0" step="100" class="tax-ytd-gross" aria-label="Year-to-date gross for ' + pid + '" value="' + (y.gross || "") + '"></div>' +
      '<div class="proj-field"><label>Tax withheld so far $</label><input type="number" min="0" step="100" class="tax-ytd-withheld" aria-label="Year-to-date tax withheld for ' + pid + '" value="' + (y.withheld || "") + '"></div>' +
    '</div><p class="tax-ytd-out">' + withholdingCheckText(person) + '</p>' + payslipReadHtml(person) + '</details>';
}
export function withholdingCheckText(person){
  var fy = currentTaxFy();
  var p = projectWithholding(personTaxSettings(person).ytd, computePersonTax(person, { fy: fy }), fy);
  if(!p) return "Type the year-to-date figures from the latest payslip (every employer's, added together).";
  if(p.stale) return "That payslip is from outside " + fyLabel(fy) + " — use one from this financial year.";
  var big = Math.abs(p.outcome) >= 50;
  return "At " + fmtPercent1.format(p.rate) + " withheld so far, the year comes to about <b>" + fmtCurrency0.format(p.projectedWithheld) + "</b> withheld against <b>" +
    fmtCurrency0.format(p.tax) + "</b> of tax" + (personTaxSettings(person).helpBalance > 0 ? " and HELP" : "") + " — " +
    (!big ? "<b>about even</b>." : p.outcome > 0 ? "heading for a <b class=\"up\">" + fmtCurrency0.format(p.outcome) + " refund</b>." : "heading for a <b class=\"down\">" + fmtCurrency0.format(-p.outcome) + " bill</b>" +
      " — setting aside about " + fmtCurrency0.format(-p.outcome / Math.max(1, Math.round((1 - p.elapsed) * 12))) + " a month until 30 June covers it.") +
    (p.aheadOfPlan ? ' <span class="warn">The payslip is already past the plan\'s gross for the year — update the income rows.</span>' : "") +
    " Assumes the rest of the year is withheld at the same average rate; a bonus taxed at a flat rate moves it.";
}

// Super top-up before 30 June (v3.42.0) — calc/supertopup.js. Shown while there's cap room left (or
// an amount has been typed): what a personal deductible contribution would get back at tax time,
// what lands in the fund, and what it really costs.
export function topUpHtml(person, r){
  var settings = personTaxSettings(person);
  var amount = Number(settings.topUpAmount) || 0;
  var room = Math.max(0, (r.capAvailable || 0) - (r.totalConcessional || 0));
  if(room < 1 && !amount) return '<div class="tax-topup" hidden></div>';
  var t = superTopUp(r, amount || room, r.fy != null ? r.fy : currentTaxFy());
  var out = t.amount > 0
    ? 'Contributing <b>' + fmtCurrency0.format(t.amount) + '</b> and claiming it: about <b>' + fmtCurrency0.format(t.taxSaved) + '</b> back at tax time, ' +
      fmtCurrency0.format(t.superAdded) + ' lands in super after ' + fmtCurrency0.format(t.contributionsTax + t.div293) + ' contributions tax' + (t.div293 ? ' (incl. Division 293)' : '') +
      ' — it costs you ' + fmtCurrency0.format(t.outOfPocket) + ' after the refund, ' + fmtCurrency0.format(t.netGain) + ' better off than taking it as pay.' +
      (t.overRoom ? ' <span class="warn">' + fmtCurrency0.format(t.overRoom) + ' is over the cap and left out.</span>' : '') +
      ' The fund must have it by 30 June, and you send it a notice of intent to claim before you lodge. It stays in super until preservation age.'
    : 'No concessional cap room left this year.';
  return '<div class="tax-topup"><label class="tax-topup-field">Top up super before 30 June <span>$</span><input type="number" min="0" step="500" class="tax-topup-amt" aria-label="Personal super contribution for ' + escapeAttr(person) + '" value="' + (amount || "") + '" placeholder="' + Math.round(room) + '"></label>' +
    '<p class="tax-topup-out">' + out + '</p></div>';
}

function taxPersonFrontBodyHtml(person, r){
  var settings = personTaxSettings(person);
  var pid = escapeAttr(person);
  var capPct = r.capAvailable > 0 ? Math.min(100, (r.totalConcessional / r.capAvailable) * 100) : 0;
  var baseLabel = Math.abs(r.packageTotal - r.gross) > 1 ? "Base salary (excl. super) /yr" : "Total gross income /yr";
  // "Adds up: …" and the super-inside-the-row note are *derivations* — they explain how a figure
  // was arrived at, which is exactly what the Breakdown flip already exists for. Together they were
  // 167px of the 841px this card takes on a 390px screen, sitting above the headline they explain.
  // Moved, not deleted: nothing about the numbers is now unexplained, it's one tap away instead of
  // permanently in the way.
  return '<div class="tax-hero"><span class="tax-hero-label">Net take-home</span><div class="tax-hero-value"><span data-out="nettakehome">' + fmtCurrency0.format(r.netTakeHome) + '</span><small> /yr · <span data-out="nettakehomemo">' + fmtCurrency0.format(r.netTakeHome / 12) + '</span> /mo</small></div></div>' +
    '<div class="tax-waterfall">' + renderTaxWaterfallHtml(r) + '</div>' +
    '<p class="tax-secondary-line">' + baseLabel.replace(" /yr", "") + ' <b data-out="gross">' + fmtCurrency0.format(r.gross) + '</b> · IP share <b data-out="ipshare" class="' + (r.ipShare < 0 ? "neg" : "") + '">' + (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + '</b> · Taxable income <b data-out="taxable">' + fmtCurrency0.format(r.taxable) + '</b> /yr</p>' +
    '<div class="tax-inputs-label">Concessional cap usage <span class="calc-help" title="Estimated from your inputs below — not something you set directly.">ⓘ</span></div>' +
    '<div class="cap-bar-track"><div class="cap-bar-fill' + (r.capExceeded > 0 ? " over" : "") + '" style="width:' + Math.min(100, capPct) + '%"></div></div>' +
    '<div class="tax-cap-note tax-cap-main' + (r.capExceeded > 0 ? " warn" : "") + '">' +
      (r.capExceeded > 0
        ? ('Over cap by ' + fmtCurrency0.format(r.capExceeded) + ' — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.')
        : (fmtCurrency0.format(r.totalConcessional) + ' of ' + fmtCurrency0.format(r.capAvailable) + ' concessional cap used (SG ' + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? ' + bonus/income sacrifice ' + fmtCurrency0.format(r.autoSacrifice) : '') + (r.manualSacrifice > 0 ? ' + manual sacrifice ' + fmtCurrency0.format(r.manualSacrifice) : '') + ') — super received net of 15% contributions tax: ' + fmtCurrency0.format(r.superNet))
      ) +
    '</div>' +
    '<div class="tax-cap-note tax-div293-note warn"' + (r.div293Tax > 0.5 ? '' : ' hidden') + ' title="Simplified: income for surcharge purposes is approximated as taxable income + your within-cap concessional contributions, ignoring reportable fringe benefits and net investment losses. Check with your accountant.">Division 293: your income is over the $250,000 threshold, so an extra 15% applies to ' + fmtCurrency0.format(Math.min(r.totalConcessional, r.capAvailable)) + ' of low-tax super contributions — ' + fmtCurrency0.format(r.div293Tax) + '/yr, assessed separately by the ATO (not withheld from take-home above).</div>' +
    '<div class="tax-cap-note tax-mscb-note"' + (r.superOverCap ? '' : ' hidden') + ' title="Employer super guarantee isn\'t compulsory on ordinary-time earnings above this threshold — indexed each financial year.">Your ordinary earnings are over the ' + fmtCurrency0.format(MAX_SUPER_BASE) + '/yr Maximum Super Contribution Base, so employer super isn\'t compulsory on the excess — SG above is capped accordingly.</div>' +
    // HELP is its own note rather than a line in the cap note above, because it isn't a super
    // figure and it isn't a tax — it's a debt repayment coming out of the same pay. The "next
    // threshold" line is the point: the rate applies to the whole income, so crossing one costs
    // real money in a way a marginal system never does.
    // Always shown, in both directions: without cover it names the cost, with cover it names what
    // the cover is saving — which is the only way the panel can answer "is a policy worth it",
    // the question this app has every other input for.
    '<div class="tax-cap-note tax-cgt-note"' + (hasCapitalGainsActivity(r) ? '' : ' hidden') + ' title="Recorded under \'Record a sale\' on a Shares holding. Held more than 12 months, an individual\'s gain is halved before tax.">' + capitalGainsNoteText(r) + '</div>' +
    '<div class="tax-cap-note tax-fund-note"' + (r.funds && r.funds.funds.length ? '' : ' hidden') + ' title="From annual tax statements entered on Shares holdings (Investments). The income labels go into taxable income as they are; capital gains go through the capital gains figure above.">' + fundsNoteText(r) + '</div>' +
    '<div class="tax-cap-note tax-div-note"' + (r.dividendGrossedUp > 0 ? '' : ' hidden') + ' title="Taken from Shares holdings with a dividend per unit set on Investments. Australian franking credits are refundable, so a low-income holder can receive more than the company distributed.">' + dividendNoteText(r) + '</div>' +
    '<div class="tax-cap-note tax-deduct-note"' + (r.deductions > 0 ? '' : ' hidden') + ' title="Taken from budget lines flagged as work-related on Cash flow. They reduce taxable income, which also reduces the Medicare levy and can move you under a surcharge tier — but not your HELP repayment, which is worked out on gross income.">' + deductionsNoteText(r) + '</div>' +
    '<div class="tax-cap-note tax-mls-note' + (r.medicareSurcharge > 0 ? " warn" : "") + '"' + (r.mlsIfUncovered > 0 ? '' : ' hidden') + ' title="Income for surcharge purposes is approximated as taxable income + your reportable super contributions, ignoring reportable fringe benefits and net investment losses — the same simplification Division 293 uses here.">' + mlsNoteText(r) + '</div>' +
    '<div class="tax-cap-note tax-help-note"' + (r.helpBalance > 0 ? '' : ' hidden') + ' title="Compulsory repayment, worked out as a flat percentage of your repayment income — which adds back salary sacrifice and any rental loss, so neither of those reduces it.">' + helpNoteText(r) + '</div>' +
    // v3.154.0: what can be done (top up, check a payslip) after what the figures say, not between the notes.
    topUpHtml(person, r) +
    withholdingCheckHtml(person) +
    // v3.44.0: the person's own details (date of birth, HELP, caps, carry-forward, losses, home
    // hours) moved to Accounts → People. What stays is this year's choice: how much to sacrifice.
    '<div class="tax-inputs pp-on-tax">' +
      '<div class="proj-field"><label title="Separate from the Cash / Sacrifice column on income rows — use this for sacrifice not tied to a specific item">Manual sacrifice $/yr</label><input type="number" min="0" step="500" class="tax-sacrifice" aria-label="Manual super sacrifice per year for ' + pid + '" value="' + settings.superSacrificeAnnual + '"><button type="button" class="calc-hint-link" style="margin-top:4px" data-tax-maxcap="' + pid + '" title="Fills your remaining concessional cap headroom this year with manual sacrifice (SG and any auto/bonus sacrifice already counted): sets manual sacrifice to ' + fmtCurrency0.format(Math.max(0, r.capAvailable - r.sg - r.autoSacrifice)) + '">Max out cap</button></div>' +
    '</div>' +
    '<p class="ledger-note pp-link-note" style="margin:8px 0 0">Date of birth, HELP, super caps, capital losses and home hours: <button type="button" class="link-btn" data-goto-people="' + pid + '">Tax → People</button></p>';
}

// Capital gains for the household's year, netted as a return nets them: losses (this year's, then
// carried-forward) off non-discounted gains first, then discounted ones, then the 50% discount.
// Once a sale is recorded it's too late to act on the holding period, so every step is stated.
function capitalGainsNoteText(r){
  var parts = [];
  var sources = [];
  if(r.capitalGainSales.length) sources.push(r.capitalGainSales.length + " sale" + (r.capitalGainSales.length === 1 ? "" : "s"));
  if(r.funds && r.funds.capitalGainGross > 0) sources.push("fund statements");
  parts.push(fmtCurrency0.format(r.capitalGainsTotal) + " of gains" + (sources.length ? " from " + sources.join(" and ") : ""));
  if(r.capitalLossesApplied > 0){
    parts.push("less " + fmtCurrency0.format(r.capitalLossesApplied) + " of losses" +
      (r.priorCapitalLossesApplied > 0 ? " (" + fmtCurrency0.format(r.priorCapitalLossesApplied) + " brought forward from earlier years)" : ""));
  }
  if(r.capitalGainsDiscount > 0) parts.push("less the 50% discount of " + fmtCurrency0.format(r.capitalGainsDiscount));
  var text = "Capital gains (" + r.capitalGainsYear + "): " + parts.join(", ") + " = " + fmtCurrency0.format(r.capitalGains) + " added to taxable income.";
  if(r.capitalLossCarriedForward > 0){
    text += " " + fmtCurrency0.format(r.capitalLossCarriedForward) + " of capital losses carries forward to next year — capital losses only ever offset capital gains, never other income.";
  }
  return text;
}
function hasCapitalGainsActivity(r){
  return r.capitalGainSales.length > 0 || (r.funds && r.funds.capitalGainGross > 0) || r.capitalLossCarriedForward > 0 || r.capitalLossesApplied > 0;
}

// Dividends, stated the way a return states them: grossed up, with the credit as an offset and
// the after-tax result spelled out. Above a 30% marginal rate a fully franked dividend still costs
// a top-up; below it the credit is refundable. Neither is obvious from the cash figure.
// One sentence per person for what their fund statements add — income, credits, gains, offset.
function fundsNoteText(r){
  var f = r.funds;
  if(!f || !f.funds.length) return "";
  return "Fund statements (" + f.funds.join(", ") + "): " + fmtCurrency0.format(f.income - f.credit) + " income + " +
    fmtCurrency0.format(f.credit) + " franking credits declared" +
    (f.capitalGainGross > 0 ? ", " + fmtCurrency0.format(f.capitalGainGross) + " capital gains (" + fmtCurrency0.format(f.capitalGainNet) + " after the fund's discount)" : "") +
    (r.fito > 0 ? ", and a " + fmtCurrency0.format(r.fito) + " foreign income tax offset" : "") + ".";
}
function dividendNoteText(r){
  var sign = r.dividendNet >= 0 ? "" : "-";
  return "Dividends: " + fmtCurrency0.format(r.dividendCash) + " cash + " +
    fmtCurrency0.format(r.frankingCredit) + " franking credit = " + fmtCurrency0.format(r.dividendGrossedUp) +
    " declared as income. The credit comes off the tax bill, so after tax at your " +
    fmtPercent1.format(r.marginalRate) + " marginal rate they're worth about " + sign +
    fmtCurrency0.format(Math.abs(r.dividendNet)) + "." +
    (r.marginalRate > 0.30 ? " Above the 30% company rate, so a fully franked dividend still costs a top-up." :
     r.marginalRate < 0.30 ? " Below the 30% company rate, so the credit is refunded to you." : "");
}

// What the deductions are worth, not what they cost. "I claimed $2,000" and "I got $2,000 back"
// is the most common confusion about deductions, so the note leads with the refund figure.
function deductionsNoteText(r){
  var labels = Object.keys(r.deductionsByLabel || {}).filter(function(k){ return r.deductionsByLabel[k] > 0; })
    .sort(function(a, b){ return Number(a.slice(1)) - Number(b.slice(1)); });
  return "Deductions: " + fmtCurrency0.format(r.deductions) + " claimed" +
    (labels.length ? " (" + labels.map(function(k){ return k + " " + fmtCurrency0.format(r.deductionsByLabel[k]); }).join(", ") + ")" : "") +
    ", worth about " + fmtCurrency0.format(r.deductionsWorth) + " back at your " + fmtPercent1.format(r.marginalRate) +
    " marginal rate — a deduction reduces the income you're taxed on, it isn't a refund of itself." +
    (r.wfh && r.wfh.amount > 0 ? " Includes working from home: " + Math.round(r.wfh.hours).toLocaleString("en-AU") + " hours x the fixed rate = " + fmtCurrency0.format(r.wfh.amount) + (r.wfh.assumed ? " (rate not yet published for this year — last year's used)" : "") + "." : "") +
    (r.wfhOverlap && r.wfhOverlap.length ? " Check: " + r.wfhOverlap.join(", ") + (r.wfhOverlap.length === 1 ? " is" : " are") + " also flagged, but the fixed rate already covers energy, internet, phone and stationery." : "") +
    " Flag a budget line as deductible under More options on Cash flow.";
}
// Both directions of the surcharge in one sentence — see the note's own comment for why holding
// cover still prints a figure.
function mlsNoteText(r){
  if(r.hasPrivateCover){
    return "Medicare levy surcharge: none, because you hold private hospital cover. Without it you'd pay " +
      fmtCurrency0.format(r.mlsIfUncovered) + "/yr at " + fmtCurrency0.format(r.surchargeIncome) +
      " surcharge income (" + r.mlsTier.label + ") — that's what a policy has to beat to be worth it on tax alone.";
  }
  return "Medicare levy surcharge: " + fmtPercent1.format(r.mlsTier.rate) + " of " +
    fmtCurrency0.format(r.surchargeIncome) + " surcharge income = " + fmtCurrency0.format(r.medicareSurcharge) +
    "/yr (" + r.mlsTier.label + "), because you don't hold private hospital cover. A policy cheaper than that saves money outright." +
    (r.mlsNext
      ? " Next tier is " + fmtCurrency0.format(r.mlsNext.at) + " (" + fmtCurrency0.format(r.mlsNext.away) +
        " away) — crossing it takes the rate to " + fmtPercent1.format(r.mlsNext.rate) +
        " of the whole amount, about " + fmtCurrency0.format(r.mlsNext.stepCost) + " more a year."
      : "");
}

// One builder for the HELP note, shared by the render above and patchAllTaxPersonOutputs below —
// the two used to be written out twice for the cap and Division 293 notes, and keeping a third
// pair in step by hand is how they drift.
function helpNoteText(r){
  var marginal = r.helpNext ? r.helpNext.marginal : (r.repaymentIncome > 0 && r.fy >= 2025);
  var head = marginal
    ? "HELP/HECS: " + fmtCurrency0.format(r.helpRepayment) + "/yr on " + fmtCurrency0.format(r.repaymentIncome) +
      " repayment income — marginal since FY25/26, " + fmtPercent1.format(r.helpRate) + " on your next dollar"
    : "HELP/HECS: " + fmtPercent1.format(r.helpRate) + " of " + fmtCurrency0.format(r.repaymentIncome) +
      " repayment income = " + fmtCurrency0.format(r.helpRepayment) + "/yr";
  return head + ", withheld from take-home above. " +
    fmtCurrency0.format(r.helpBalance) + " owing" +
    (r.helpRepayment > 0 ? ", " + fmtCurrency0.format(r.helpBalanceAfter) + " after this year" : "") + "." +
    (r.helpNext
      ? (r.helpNext.marginal
        ? " Next band starts at " + fmtCurrency0.format(r.helpNext.at) + " (" + fmtCurrency0.format(r.helpNext.away) + " away), where the rate on further income becomes " + fmtPercent1.format(r.helpNext.rate) + (r.helpNext.rate === 0.10 ? " of the whole amount" : "") + "."
        : " Next threshold is " + fmtCurrency0.format(r.helpNext.at) + " (" + fmtCurrency0.format(r.helpNext.away) +
          " away) — crossing it takes the rate to " + fmtPercent1.format(r.helpNext.rate) +
          " of the whole amount, about " + fmtCurrency0.format(r.helpNext.stepCost) + " more a year.")
      : "");
}

// The household's private health rebate position for the year: which tier the combined income
// lands in, which tier the insurer is applying, and what that difference does at tax time.
// Premiums typed, or read from the budget line that pays the policy (v3.47.0) — see
// calc/tax.js phiPremiumsAnnual(). Lines that look like health cover are offered first.
function phiPremiumFieldsHtml(){
  var lines = claimItems().filter(function(i){ return i.id && !i.computed; });
  var healthy = lines.filter(function(i){ return /health/i.test(i.category || "") || /health|hospital|extras|medical/i.test(i.what || ""); });
  var others = lines.filter(function(i){ return healthy.indexOf(i) === -1; });
  var cur = state.tax.phiLineId || "";
  var line = phiLine();
  var opt = function(i){ return '<option value="' + escapeAttr(i.id) + '"' + (i.id === cur ? " selected" : "") + '>' + escapeAttr(i.what || "Line") + '</option>'; };
  return '<div class="proj-field"><label for="taxPhiLine" title="The budget line you pay the policy from. Its amount is after the rebate your insurer applies, so the premium is worked back up from it at the tier below.">Premiums from</label><select id="taxPhiLine">' +
      '<option value="">Typed in</option>' +
      (healthy.length ? '<optgroup label="Looks like health cover">' + healthy.map(opt).join("") + '</optgroup>' : '') +
      (others.length ? '<optgroup label="Other budget lines">' + others.map(opt).join("") + '</optgroup>' : '') +
      (cur && !line ? '<option value="' + escapeAttr(cur) + '" selected>(deleted line)</option>' : '') +
    '</select></div>' +
    '<div class="proj-field"><label for="taxPhiPremiums" title="What your hospital and extras policies cost a year before the government rebate. The rebate is income-tested on the same tiers as the surcharge.">Premiums $/yr</label><input type="number" min="0" step="50" id="taxPhiPremiums" value="' + (line ? phiPremiumsAnnual() : (Number(state.tax.phiPremiums) || 0)) + '"' + (line ? ' disabled title="Worked out from ' + escapeAttr(line.what || "the line") + '"' : '') + '></div>';
}
function phiNoteText(){
  var a = phiRebateAdjustment();
  if(!a) return "Enter what your hospital and extras cover costs a year (before the rebate) to see whether your insurer is applying the right rebate tier.";
  var names = ["the base tier", "Tier 1", "Tier 2", "Tier 3"];
  var claimed = a.claimedTier < 0 ? "no rebate up front" : names[a.claimedTier];
  var ageNote = a.ageKnown
    ? (a.ageBand === "u65" ? "" : " Rates for the oldest person being " + (a.ageBand === "a70" ? "70 or over" : "65-69") + ".")
    : " Assumes everyone on the policy is under 65 — add dates of birth (Tax → People) if not.";
  return phiNoteCore(a, names, claimed) + ageNote;
}
function phiNoteCore(a, names, claimed){
  if(Math.abs(a.adjustment) < 1) return "Private health rebate: your " + (a.family ? "combined " : "") + "income of " + fmtCurrency0.format(a.income) + " is " + names[a.actualTier] + ", which is what your insurer applies — nothing to adjust at tax time.";
  return "Private health rebate: your " + (a.family ? "combined " : "") + "income of " + fmtCurrency0.format(a.income) + " is " + names[a.actualTier] +
    " (" + fmtCurrency0.format(a.entitled) + " rebate) but your insurer applies " + claimed + " (" + fmtCurrency0.format(a.received) + "). " +
    (a.adjustment > 0
      ? "About " + fmtCurrency0.format(a.adjustment) + " comes back off your refund at tax time — ask your insurer to change tier and it stops."
      : "About " + fmtCurrency0.format(-a.adjustment) + " more comes back to you at tax time.");
}

// Session-only (not persisted) — which Tax & Super cards are showing the calculation
// breakdown instead of the normal front. Keyed by person so it survives a full re-render
// (e.g. from an income edit elsewhere) without snapping back to the front on its own.
var taxCardFlipped = {};
// Whether Household settings is open — session only, kept across re-renders.
export var taxUi = { householdOpen: false };

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

export function patchPhiNote(){
  var el = document.querySelector(".tax-phi-note");
  if(el) el.textContent = phiNoteText();
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
    // Every note on this card is a .tax-cap-note; this one is the concessional-cap note
    // specifically. Excluding each sibling by class was already fragile with two of them — a third
    // (HELP) would have silently patched the wrong element, since querySelector takes the first
    // match and the notes are siblings.
    var note = panel.querySelector(".tax-cap-note.tax-cap-main");
    if(note){
      note.classList.toggle("warn", r.capExceeded > 0);
      note.textContent = r.capExceeded > 0
        ? ("Over cap by " + fmtCurrency0.format(r.capExceeded) + " — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.")
        : (fmtCurrency0.format(r.totalConcessional) + " of " + fmtCurrency0.format(r.capAvailable) + " concessional cap used (SG " + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? " + bonus/income sacrifice " + fmtCurrency0.format(r.autoSacrifice) : "") + (r.manualSacrifice > 0 ? " + manual sacrifice " + fmtCurrency0.format(r.manualSacrifice) : "") + ") — super received net of 15% contributions tax: " + fmtCurrency0.format(r.superNet));
    }
    var topUp = panel.querySelector(".tax-topup");
    if(topUp){
      var fresh = document.createElement("div");
      fresh.innerHTML = topUpHtml(panel.getAttribute("data-tax-person"), r);
      var out = topUp.querySelector(".tax-topup-out"), freshOut = fresh.querySelector(".tax-topup-out");
      if(out && freshOut) out.innerHTML = freshOut.innerHTML;
      var amt = topUp.querySelector(".tax-topup-amt"), freshAmt = fresh.querySelector(".tax-topup-amt");
      if(amt && freshAmt) amt.placeholder = freshAmt.placeholder;
    }
    var div293Note = panel.querySelector(".tax-div293-note");
    if(div293Note){
      div293Note.hidden = !(r.div293Tax > 0.5);
      div293Note.textContent = "Division 293: your income is over the $250,000 threshold, so an extra 15% applies to " + fmtCurrency0.format(Math.min(r.totalConcessional, r.capAvailable)) + " of low-tax super contributions — " + fmtCurrency0.format(r.div293Tax) + "/yr, assessed separately by the ATO (not withheld from take-home above).";
    }
    var mscbNote = panel.querySelector(".tax-mscb-note");
    if(mscbNote) mscbNote.hidden = !r.superOverCap;
    var fundNote = panel.querySelector(".tax-fund-note");
    if(fundNote){
      fundNote.hidden = !(r.funds && r.funds.funds.length);
      fundNote.textContent = fundsNoteText(r);
    }
    var cgtNote = panel.querySelector(".tax-cgt-note");
    if(cgtNote){
      cgtNote.hidden = !hasCapitalGainsActivity(r);
      cgtNote.textContent = capitalGainsNoteText(r);
    }
    var divNote = panel.querySelector(".tax-div-note");
    if(divNote){
      divNote.hidden = !(r.dividendGrossedUp > 0);
      divNote.textContent = dividendNoteText(r);
    }
    var deductNote = panel.querySelector(".tax-deduct-note");
    if(deductNote){
      deductNote.hidden = !(r.deductions > 0);
      deductNote.textContent = deductionsNoteText(r);
    }
    var mlsNote = panel.querySelector(".tax-mls-note");
    if(mlsNote){
      mlsNote.hidden = !(r.mlsIfUncovered > 0);
      mlsNote.classList.toggle("warn", r.medicareSurcharge > 0);
      mlsNote.textContent = mlsNoteText(r);
    }
    var helpNote = panel.querySelector(".tax-help-note");
    if(helpNote){
      helpNote.hidden = !(r.helpBalance > 0);
      helpNote.textContent = helpNoteText(r);
    }
    // No packagenote patch here any more: that note moved to the Breakdown side, which is rebuilt
    // wholesale by personBreakdownHtml() every time the card is flipped rather than patched in place.
  });
  var ipNote = document.querySelector("#taxSuperBody .tax-ip-note b");
  if(ipNote) ipNote.textContent = fmtCurrency0.format(ipNetResultAnnual());
  refreshOpenTaxYear();
}
