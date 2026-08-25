import { state } from "../state.js";
import { CLASSES } from "../constants.js";
import { sumField } from "../calc/ledger.js";
import { loanRepaymentMonthly, ipProperties } from "../calc/property.js";
import { fmtCurrency0, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { syncUiModeToggle } from "../lib/uimode.js";
import { buildTable, modernPlainRowHtml } from "../lib/ledger-table.js";

function sharedGroupOrder(){
  return CLASSES.filter(function(cls){
    return state.shared.some(function(item){ return (item.classification || "N/A") === cls; });
  });
}

function computeSharedGroups(){
  return sharedGroupOrder().map(function(cls){
    var indices = [];
    var items = [];
    state.shared.forEach(function(item, idx){
      if((item.classification || "N/A") === cls){ indices.push(idx); items.push(item); }
    });
    return { key: cls, indices: indices, items: items, monthly: sumField(items, "monthly") };
  });
}

export function patchSharedGroupTotals(){
  var groups = computeSharedGroups();
  var summaryEl = document.getElementById("sharedSummaryLine");
  if(summaryEl){
    // In modern mode the composition bar below already shows this same per-classification
    // split, so the text line would just repeat it.
    if(state.uiMode !== "modern" && groups.length > 1){
      var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
      var parts = groups.map(function(g){ return g.key + " " + fmtCurrency0.format(g.monthly); }).join(" + ");
      summaryEl.innerHTML = "Adds up: " + parts + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total shared expenses";
      summaryEl.style.display = "";
    } else {
      summaryEl.style.display = "none";
    }
  }
  document.querySelectorAll("#sharedGroups .income-group-total").forEach(function(el, gi){
    if(groups[gi]) el.textContent = fmtCurrency0.format(groups[gi].monthly) + " / mo";
  });
  document.querySelectorAll("#sharedGroups .m-card").forEach(function(card, gi){
    var totalEl = card.querySelector(".m-card-total");
    if(totalEl && groups[gi]) totalEl.innerHTML = fmtCurrency0.format(groups[gi].monthly) + "<span>/mo</span>";
  });
  var compWrap = document.querySelector("[data-shared-comp-bar]");
  if(compWrap){
    var freshComp = sharedCompositionBarHtml(groups);
    if(freshComp) compWrap.outerHTML = freshComp;
  }
}

export function renderSharedGroups(){
  syncUiModeToggle();
  if(state.uiMode === "modern") renderSharedGroupsModern();
  else renderSharedGroupsClassic();
}

function renderSharedGroupsClassic(){
  var container = document.getElementById("sharedGroups");
  if(!container) return;
  var groups = computeSharedGroups();
  patchSharedGroupTotals();
  container.innerHTML = groups.map(function(g, gi){
    return '<div class="income-group"><div class="income-group-head">' +
      '<div class="income-group-head-left"><h4>' + escapeAttr(g.key) + '</h4></div>' +
      '<div class="income-group-total">' + fmtCurrency0.format(g.monthly) + ' / mo</div>' +
      '</div><div class="table-scroll"><table class="ledger-table" id="sharedGroupTable' + gi + '"></table></div>' +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="shared:' + escapeAttr(g.key) + '">+ Add to ' + escapeAttr(g.key) + '</button></div>';
  }).join("");
  groups.forEach(function(g, gi){
    buildTable(document.getElementById("sharedGroupTable" + gi), "shared", g.items, {showClass:true, hideAcctToggle:true, hideClassToggle:true}, g.indices);
  });
}

// Needs/Wants/Savings already carry fixed colors everywhere else in the app (the Dashboard's
// 50/30/20 bar) — reusing them here instead of the Income page's rotating series-color palette
// ties an expense card back to the same visual language a user already knows, and sidesteps the
// problem a rotating palette would have with 8-10 items in one Needs group: too many colors to
// track, and the palette would repeat and misleadingly reuse a color between unrelated items.
function classificationSwatchClass(cls){
  if(cls === "Needs") return "needs";
  if(cls === "Wants") return "wants";
  if(cls === "Savings") return "savings";
  return "na";
}

function sharedCompositionBarHtml(groups){
  var total = groups.reduce(function(s, g){ return s + g.monthly; }, 0);
  if(total <= 0 || groups.length < 2) return "";
  var segs = groups.map(function(g){
    var pct = g.monthly / total;
    return '<div class="rule-seg ' + classificationSwatchClass(g.key) + '" style="width:' + (pct * 100) + '%" title="' + escapeAttr(g.key) + ': ' + fmtCurrency0.format(g.monthly) + '/mo (' + fmtPercent1.format(pct) + ')">' + (pct > 0.1 ? fmtPercent1.format(pct) : "") + '</div>';
  }).join("");
  var legend = groups.map(function(g){
    return '<div class="rule-legend-item"><span class="rule-swatch ' + classificationSwatchClass(g.key) + '"></span>' + escapeAttr(g.key) + ' <b>' + fmtCurrency0.format(g.monthly) + '</b></div>';
  }).join("");
  return '<div data-shared-comp-bar><div class="rule-bar">' + segs + '</div><div class="rule-legend" style="margin-bottom:16px">' + legend + '</div></div>';
}

// Session-only (not persisted) — mirrors modernIncomeRowOpen for the Expenses page's rows.
export var modernSharedRowOpen = {};

function renderSharedGroupsModern(){
  var container = document.getElementById("sharedGroups");
  if(!container) return;
  var groups = computeSharedGroups();
  patchSharedGroupTotals();
  container.innerHTML = sharedCompositionBarHtml(groups) + '<div class="m-people">' + groups.map(function(g){
    var initial = g.key === "N/A" ? "–" : g.key.charAt(0);
    return '<div class="m-card">' +
      '<div class="m-card-head"><span class="m-avatar m-avatar-' + classificationSwatchClass(g.key) + '">' + initial + '</span>' +
      '<div class="m-card-name">' + escapeAttr(g.key) + '</div>' +
      '<div class="m-card-total">' + fmtCurrency0.format(g.monthly) + '<span>/mo</span></div></div>' +
      '<div class="m-rows">' + g.items.map(function(item, i){ return modernPlainRowHtml(item, g.indices[i], "shared", modernSharedRowOpen, {showClass:true}); }).join("") + '</div>' +
      '<button type="button" class="m-add-row" data-add="shared:' + escapeAttr(g.key) + '">+ Add expense</button>' +
    '</div>';
  }).join("") + '</div>';
}

// Read-only mirror of each IP property's costs onto the Expenses page — same idea as the
// synthetic rent row on the Income tab, but this never touches state.shared, since property
// costs are already counted separately (ipExpenseItemsForClassification/ipExpensesMonthly/
// ipLoansMonthly) in every real total. Adding it as a real row there would double-count it.
function propertyMonthlyCost(p){
  var loanMonthly = (p.loans || []).reduce(function(s, l){ return s + loanRepaymentMonthly(l); }, 0);
  return sumField(p.expenses, "monthly") + loanMonthly;
}
function propertyExpensesModernHtml(ips){
  var rows = ips.map(function(p){
    var monthly = propertyMonthlyCost(p);
    return '<div class="m-row computed"><div class="m-row-summary" style="cursor:default">' +
      '<div style="flex:1 1 auto; min-width:0">' +
        '<div class="m-row-name">' + escapeAttr(p.what) + ' — Property costs</div>' +
        '<div class="m-row-sub">auto: expenses + loan repayment — edit on the Properties tab</div>' +
      '</div>' +
      '<span class="m-row-amt">' + fmtCurrency0.format(monthly) + '/mo</span>' +
    '</div></div>';
  }).join("");
  return '<div class="m-card"><div class="m-rows">' + rows + '</div></div>';
}

export function renderPropertyExpensesSummary(){
  var wrap = document.getElementById("propertyExpensesCard");
  var table = document.getElementById("propertyExpensesTable");
  var modernWrap = document.getElementById("propertyExpensesModern");
  if(!wrap || !table) return;
  var ips = ipProperties();
  wrap.hidden = !ips.length;
  if(!ips.length) return;
  var rows = ips.map(function(p){
    var monthly = propertyMonthlyCost(p);
    return '<tr class="is-computed">' +
      '<td class="what-cell">' + escapeAttr(p.what) + ' — Property costs</td>' +
      '<td class="amount-cell"><span class="computed-value">' + fmtCurrency0.format(monthly) + '</span>' +
        '<span class="computed-note">auto: expenses + loan repayment for ' + escapeAttr(p.what) + ' — edit on the Properties tab</span></td>' +
      '<td class="freq-cell">Monthly</td>' +
      '<td class="num">' + fmtCurrency0.format(monthly) + '</td>' +
      '<td class="num">' + fmtCurrency0.format(monthly * 12) + '</td>' +
      '</tr>';
  }).join("");
  var total = ips.reduce(function(s, p){ return s + propertyMonthlyCost(p); }, 0);
  table.innerHTML = '<thead><tr><th>What</th><th>Amount</th><th>Frequency</th><th class="num">Monthly</th><th class="num">Yearly</th></tr></thead><tbody>' + rows + '</tbody>';
  document.getElementById("propertyExpensesTotal").textContent = fmtCurrency0.format(total);
  var scrollWrap = table.closest(".table-scroll");
  var isModern = state.uiMode === "modern";
  if(scrollWrap) scrollWrap.hidden = isModern;
  if(modernWrap){
    modernWrap.hidden = !isModern;
    if(isModern) modernWrap.innerHTML = propertyExpensesModernHtml(ips);
  }
}
