import { PERIODS, FREQS, CLASSES, INCOME_TYPES, SUPER_MODES, SACRIFICE_MODES, sacrificeModeToLabel } from "../constants.js";
import { periodsOf } from "../calc/ledger.js";
import { incomeRowSuperNote } from "../calc/tax.js";
import { fmtCurrency2 } from "./format.js";
import { escapeAttr } from "./html.js";

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
  var acctClass = opts.acctColClass || (opts.hideAcctToggle ? "col-account-exp" : "");
  var classClass = opts.hideClassToggle ? "col-classification" : "";
  var thead = '<thead><tr><th>What</th>' +
    (showClass ? '<th' + (classClass ? ' class="' + classClass + '"' : '') + '>Classification</th>' : '') +
    (showIncomeFields ? '<th class="col-person">Person</th><th class="col-type">Type</th><th class="col-super">Super</th><th class="col-sacrifice">Cash / Sacrifice</th>' : '') +
    '<th' + (showIncomeFields ? ' class="col-account"' : acctClass ? ' class="' + acctClass + '"' : '') + '>Account</th><th class="num">Amount</th><th>Frequency</th>' + periodTh() + '<th></th></tr></thead>';
  var rows = items.map(function(item, idx){ return rowHtml(section, item, indices ? indices[idx] : idx, showClass, showIncomeFields, acctClass, classClass); }).join("");
  tableEl.innerHTML = thead + "<tbody>" + rows + "</tbody>";
}

export function rowHtml(section, item, idx, showClass, showIncomeFields, acctClass, classClass){
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
    '<td>' + (isComputed ? "" : '<button class="btn btn-ghost btn-sm row-del" data-del="' + section + ':' + idx + '" aria-label="Delete row">✕</button>') + '</td>' +
    '</tr>';
}
