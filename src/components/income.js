import { state } from "../state.js";
import { FREQS, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, MAX_SUPER_BASE, PERIODS, sacrificeModeToLabel } from "../constants.js";
import { periodsOf, sumField } from "../calc/ledger.js";
import { ipNetResultAnnual } from "../calc/property.js";
import { getTaxPeople, incomeRowSuperNote, personTaxSettings, computePersonTax } from "../calc/tax.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { syncUiModeToggle } from "../lib/uimode.js";
import { buildTable, optionsHtml, historyTrendHtml, logControlsHtml } from "../lib/ledger-table.js";

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
  document.querySelectorAll("#incomeGroups .income-group-total").forEach(function(el, gi){
    if(groups[gi]) el.textContent = fmtCurrency0.format(groups[gi].monthly) + " / mo";
  });
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

export function renderIncomeGroups(){
  syncUiModeToggle();
  if(state.uiMode === "modern") renderIncomeGroupsModern();
  else renderIncomeGroupsClassic();
}

function renderIncomeGroupsClassic(){
  var container = document.getElementById("incomeGroups");
  if(!container) return;
  var groups = computeIncomeGroups();
  patchIncomeGroupTotals();
  container.innerHTML = groups.map(function(g, gi){
    var label = g.key === "__household" ? "Household / shared" : g.key;
    var addValue = g.key === "__household" ? "" : g.key;
    var hasGrossRows = g.items.some(function(i){ return i.incomeType === "Gross" && !i.computed; });
    return '<div class="income-group income-person-card"><div class="income-group-head">' +
      '<div class="income-group-head-left"><h4>' + escapeAttr(label) + '</h4></div>' +
      '<div class="income-group-total">' + fmtCurrency0.format(g.monthly) + ' / mo</div>' +
      '</div>' +
      (hasGrossRows ? '<p class="income-group-note">Gross rows below are reference only, excluded from the total — see “' + escapeAttr(g.key) + ' — Net income” for the actual after-tax contribution.</p>' : '') +
      '<div class="table-scroll"><table class="ledger-table" id="incomeGroupTable' + gi + '"></table></div>' +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="income:' + escapeAttr(addValue) + '">+ Add to ' + escapeAttr(label) + '</button></div>';
  }).join("");
  groups.forEach(function(g, gi){
    buildTable(document.getElementById("incomeGroupTable" + gi), "income", g.items, {showClass:false, showIncomeFields:true, showLog:true}, g.indices);
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

function renderIncomeGroupsModern(){
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
    '</div>' +
    (isGrossRef ? '<span class="m-row-tag gross">Gross</span>' : "") +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency2.format(monthly) + '/mo</span>' +
    (isComputed ? "" : '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>') +
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
    '</div>' +
    '<details class="tax-advanced m-more-options"><summary>More options</summary>' +
      '<div class="m-edit-grid" style="margin-top:8px">' +
        '<div class="m-edit-field"><label>Super</label><select class="f-superincluded" title="Whether super is already included in the Amount, paid on top, or doesn\'t apply at all">' + optionsHtml(SUPER_MODES, item.superMode || "On top") + '</select></div>' +
        '<div class="m-edit-field"><label>Sacrifice</label><div class="sacrifice-wrap"><select class="f-sacrificemode">' + optionsHtml(SACRIFICE_MODES, sacrificeModeToLabel(item.sacrificeMode)) + '</select>' + sacrificeValueField + '</div></div>' +
        '<div class="m-edit-field"><label>Account</label><input type="text" class="f-account" list="acctSuggestions" value="' + escapeAttr(item.account || "") + '" aria-label="Account"></div>' +
        '<div class="m-edit-field span3"><label>Log</label>' + logControlsHtml("income", idx) + '</div>' +
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
    var cells = tr.querySelectorAll("td.computed");
    var p = periodsOf(item.amount, item.freq);
    PERIODS.forEach(function(pd, i){ if(cells[i]) cells[i].textContent = fmtCurrency2.format(p[pd.key]); });
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
export function renderTaxSuper(){
  if(state.uiMode === "modern") renderTaxSuperModern();
  else renderTaxSuperClassic();
}

function renderTaxSuperClassic(){
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

  html += people.map(function(person){
    var r = computePersonTax(person);
    var settings = personTaxSettings(person);
    var capPct = r.capAvailable > 0 ? Math.min(100, (r.totalConcessional / r.capAvailable) * 100) : 0;
    var pid = escapeAttr(person);
    var contributingRows = state.income.filter(function(i){ return i.incomeType === "Gross" && i.person === person; });
    var rowsSummary = contributingRows.map(function(i){ return escapeAttr(i.what) + " " + fmtCurrency0.format(periodsOf(i.amount, i.freq).yearly) + "/yr"; }).join(" + ");
    var baseLabel = Math.abs(r.packageTotal - r.gross) > 1 ? "Base salary (excl. super) /yr" : "Total gross income /yr";
    return '<div class="tax-person" data-tax-person="' + pid + '">' +
      '<div class="tax-person-head">' +
        '<h4>' + escapeAttr(person) + '<button type="button" class="icon-btn" data-tax-rename="' + pid + '" aria-label="Rename ' + pid + '" title="Rename this person (updates every income row)">✎</button><button type="button" class="icon-btn icon-del" data-tax-remove="' + pid + '" aria-label="Remove ' + pid + '" title="Remove this person from tax &amp; super (their income rows go back to Net)">✕</button></h4>' +
        '<span class="tax-marginal">Marginal rate ' + fmtPercent1.format(r.marginalRate) + ' · effective ' + fmtPercent1.format(r.effectiveRate) + '</span>' +
      '</div>' +
      (rowsSummary ? '<p class="tax-rows-summary">Adds up: ' + rowsSummary + ' = <b>' + fmtCurrency0.format(r.packageTotal) + '/yr</b> total gross</p>' : '') +
      '<div class="tax-hero"><span class="tax-hero-label">Net take-home</span><div class="tax-hero-value"><span data-out="nettakehome">' + fmtCurrency0.format(r.netTakeHome) + '</span><small> /yr · <span data-out="nettakehomemo">' + fmtCurrency0.format(r.netTakeHome / 12) + '</span> /mo</small></div></div>' +
      '<div class="tax-waterfall">' + renderTaxWaterfallHtml(r) + '</div>' +
      '<p class="tax-secondary-line">' + baseLabel.replace(" /yr", "") + ' <b data-out="gross">' + fmtCurrency0.format(r.gross) + '</b> · IP share <b data-out="ipshare" class="' + (r.ipShare < 0 ? "neg" : "") + '">' + (r.ipShare >= 0 ? "+" : "") + fmtCurrency0.format(r.ipShare) + '</b> · Taxable income <b data-out="taxable">' + fmtCurrency0.format(r.taxable) + '</b> /yr</p>' +
      (Math.abs(r.packageTotal - r.gross) > 1
        ? '<p class="tax-package-note" data-out="packagenote" style="margin:-6px 0 12px">Of that ' + fmtCurrency0.format(r.packageTotal) + ', ' + fmtCurrency0.format(r.packageTotal - r.gross) + ' is super already included inside a row marked "Super: Included" — so tax and take-home are calculated on ' + fmtCurrency0.format(r.gross) + ' base salary, not the full ' + fmtCurrency0.format(r.packageTotal) + '. (Total super for the year, from every row, is in the cap line below.)</p>'
        : '') +
      '<div class="tax-inputs-label">Your inputs</div>' +
      '<div class="tax-inputs-panel">' +
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
      '<div class="tax-inputs-label">Concessional cap usage <span class="calc-help" title="Estimated from your inputs above — not something you set directly.">ⓘ</span></div>' +
      '<div class="cap-bar-track"><div class="cap-bar-fill' + (r.capExceeded > 0 ? " over" : "") + '" style="width:' + Math.min(100, capPct) + '%"></div></div>' +
      '<div class="tax-cap-note' + (r.capExceeded > 0 ? " warn" : "") + '">' +
        (r.capExceeded > 0
          ? ('Over cap by ' + fmtCurrency0.format(r.capExceeded) + ' — excess concessional contributions are taxed at your marginal rate, not just 15%. Check with your accountant.')
          : (fmtCurrency0.format(r.totalConcessional) + ' of ' + fmtCurrency0.format(r.capAvailable) + ' concessional cap used (SG ' + fmtCurrency0.format(r.sg) + (r.autoSacrifice > 0 ? ' + bonus/income sacrifice ' + fmtCurrency0.format(r.autoSacrifice) : '') + (r.manualSacrifice > 0 ? ' + manual sacrifice ' + fmtCurrency0.format(r.manualSacrifice) : '') + ') — super received net of 15% contributions tax: ' + fmtCurrency0.format(r.superNet))
        ) +
      '</div>' +
      '<div class="tax-cap-note tax-div293-note warn"' + (r.div293Tax > 0.5 ? '' : ' hidden') + ' title="Simplified: income for surcharge purposes is approximated as taxable income + your within-cap concessional contributions, ignoring reportable fringe benefits and net investment losses. Check with your accountant.">Division 293: your income is over the $250,000 threshold, so an extra 15% applies to ' + fmtCurrency0.format(Math.min(r.totalConcessional, r.capAvailable)) + ' of low-tax super contributions — ' + fmtCurrency0.format(r.div293Tax) + '/yr, assessed separately by the ATO (not withheld from take-home above).</div>' +
      '<div class="tax-cap-note tax-mscb-note"' + (r.superOverCap ? '' : ' hidden') + ' title="Employer super guarantee isn\'t compulsory on ordinary-time earnings above this threshold — indexed each financial year.">Your ordinary earnings are over the ' + fmtCurrency0.format(MAX_SUPER_BASE) + '/yr Maximum Super Contribution Base, so employer super isn\'t compulsory on the excess — SG above is capped accordingly.</div>' +
    '</div>';
  }).join("");
  container.innerHTML = html;
}

// Same data and the same data-tax-person/tax-ipshare/tax-sacrifice/etc. contract as classic
// (reuses computePersonTax, renderTaxWaterfallHtml, and the existing taxSuperBody click/input
// handlers below verbatim — patchAllTaxPersonOutputs doesn't care which layout produced the
// DOM it's patching) — the only real difference is ownership/sacrifice tucked behind a
// disclosure instead of always-open, so the net take-home number stays the headline.
function renderTaxSuperModern(){
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
