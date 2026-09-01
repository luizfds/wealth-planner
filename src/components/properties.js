import { state, persist } from "../state.js";
import { propertyEquityToday, propertyGearingAnnual, propertyLoanRepaymentMonthly, loanRepaymentDisplay } from "../calc/property.js";
import { sumField } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { syncUiModeToggle, applyPeriodVisibility } from "../lib/uimode.js";
import { optionsHtml, buildTable, modernPlainRowHtml, historyTrendHtml } from "../lib/ledger-table.js";
import { showToast } from "../lib/toast.js";
import { appendHistorySnapshot } from "../calc/ledger.js";
import { renderPropertyExpensesSummary } from "./expenses.js";
import { renderProjectionOutputs } from "./projections.js";

// Real mortgages are only ever paid weekly, fortnightly, or monthly — unlike income/expense
// rows elsewhere in this app, Quarterly/Yearly aren't real options here, so this is its own
// shorter list rather than reusing the global FREQS.
var LOAN_REPAY_FREQS = ["Weekly", "Fortnightly", "Monthly"];
var LOAN_REPAY_FREQ_SUFFIX = { Weekly: "/wk", Fortnightly: "/fn", Monthly: "/mo" };

function loanRowHtml(loan, li){
  var disp = loanRepaymentDisplay(loan);
  var suffix = LOAN_REPAY_FREQ_SUFFIX[disp.freq] || "/mo";
  return '<tr data-loan-index="' + li + '">' +
    '<td><input type="text" class="loan-what" value="' + escapeAttr(loan.what) + '" aria-label="Loan name"></td>' +
    '<td class="num"><input type="number" step="1000" min="0" class="loan-balance" value="' + (Number(loan.balance) || 0) + '" aria-label="Loan balance"></td>' +
    '<td class="num"><input type="number" step="0.01" min="0" class="loan-rate" value="' + (Math.round((Number(loan.rate) || 0) * 100) / 100) + '" aria-label="Interest rate percent"></td>' +
    '<td class="num"><input type="number" step="1" min="0" class="loan-term" value="' + (Number(loan.termYears) || 0) + '" aria-label="Term years remaining"></td>' +
    '<td><select class="loan-type" aria-label="Repayment type">' + optionsHtml(["PI", "IO"], loan.repaymentType) + '</select></td>' +
    '<td><select class="loan-repay-freq" aria-label="How often this loan is paid" title="For auto repayments this only changes how the amount is displayed (still calculated monthly) — for a manual repayment it\'s the frequency the amount you type in is actually paid at.">' + optionsHtml(LOAN_REPAY_FREQS, disp.freq) + '</select></td>' +
    '<td class="num loan-repayment-cell">' +
      '<select class="loan-repay-mode" aria-label="Repayment mode">' + optionsHtml(["auto", "manual"], loan.repaymentMode) + '</select>' +
      (loan.repaymentMode === "manual"
        ? '<input type="number" step="1" min="0" class="loan-manual-amount" value="' + (Number(loan.manualRepaymentAmount) || 0) + '" aria-label="Manual repayment amount">'
        : '<span class="computed-note">' + fmtCurrency0.format(disp.amount) + suffix + '</span>') +
    '</td>' +
    '<td class="num"><input type="number" step="1000" min="0" class="loan-offset" value="' + (Number(loan.offsetBalance) || 0) + '" aria-label="Offset account balance" title="Netted against this loan\'s balance for both equity and interest — this is the one place to enter it. Don\'t also add it as a separate Cash asset on the Assets tab, or it\'ll be counted twice."></td>' +
    '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-loan-del="' + li + '" aria-label="Delete loan">✕</button></td>' +
    '</tr>';
}

// Session-only (not persisted) — shares modernPropRowOpen with each property's income/expense
// rows, keyed by "loan:<propertyId>:<loanIndex>" so it never collides with "propinc:<id>"/
// "propexp:<id>" keys, and is already wired up for free via wireModernRowToggle("propertiesBody", ...).
// Every loan gets a color (none are "computed" read-only rows), cycling the same 8-color
// series used everywhere else — shared by each row's identity dot and the card's composition
// bar so the two visuals stay in sync.
function loanRowMeta(p){
  return (p.loans || []).map(function(loan, li){ return { loan: loan, li: li, colorIdx: li % 8 }; });
}
function modernLoanCompBarHtml(rowMeta){
  var segs = rowMeta.map(function(m){ return { loan: m.loan, colorIdx: m.colorIdx, balance: Math.max(0, Number(m.loan.balance) || 0) }; })
    .filter(function(x){ return x.balance > 0.5; });
  if(segs.length < 2) return "";
  var total = segs.reduce(function(s, x){ return s + x.balance; }, 0);
  return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
    var pct = total > 0 ? x.balance / total : 0;
    return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.balance + ' 1 0%" title="' + escapeAttr(x.loan.what) + ': ' + fmtCurrency0.format(x.balance) + ' balance (' + fmtPercent1.format(pct) + ')"></div>';
  }).join("") + '</div>';
}
function loanRowModernHtml(loan, li, propId, colorIdx){
  var section = "loan:" + propId;
  var isOpen = !!modernPropRowOpen[section + ":" + li];
  var disp = loanRepaymentDisplay(loan);
  var suffix = LOAN_REPAY_FREQ_SUFFIX[disp.freq] || "/mo";
  var rateDisplay = Math.round((Number(loan.rate) || 0) * 100) / 100;
  var dot = colorIdx != null ? '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' : "";
  var summary = '<div class="m-row-summary" role="button" tabindex="0" data-row-toggle>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(loan.what) + '</div>' +
      '<div class="m-row-sub" data-computed="sub">' + fmtCurrency0.format(Number(loan.balance) || 0) + ' balance · ' + rateDisplay + '% · ' + loan.repaymentType + " · paid " + disp.freq.toLowerCase() + (loan.repaymentMode === "manual" ? " (manual)" : "") + '</div>' +
    '</div>' +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency2.format(disp.amount) + suffix + '</span>' +
    '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="loan-what" value="' + escapeAttr(loan.what) + '" aria-label="Loan name"></div>' +
      '<div class="m-edit-field"><label>Balance</label><input type="number" step="1000" min="0" class="loan-balance" value="' + (Number(loan.balance) || 0) + '" aria-label="Loan balance"></div>' +
      '<div class="m-edit-field"><label>Rate %</label><input type="number" step="0.01" min="0" class="loan-rate" value="' + rateDisplay + '" aria-label="Interest rate percent"></div>' +
      '<div class="m-edit-field"><label>Term (yrs)</label><input type="number" step="1" min="0" class="loan-term" value="' + (Number(loan.termYears) || 0) + '" aria-label="Term years remaining"></div>' +
    '</div>' +
    '<details class="tax-advanced m-more-options"><summary>More options</summary>' +
      '<div class="m-edit-grid" style="margin-top:8px">' +
        '<div class="m-edit-field"><label>Type</label><select class="loan-type" aria-label="Repayment type">' + optionsHtml(["PI", "IO"], loan.repaymentType) + '</select></div>' +
        '<div class="m-edit-field"><label>Paid</label><select class="loan-repay-freq" aria-label="How often this loan is paid" title="For auto repayments this only changes how the amount is displayed (still calculated monthly) — for a manual repayment it\'s the frequency the amount you type in is actually paid at.">' + optionsHtml(LOAN_REPAY_FREQS, disp.freq) + '</select></div>' +
        '<div class="m-edit-field"><label>Repayment</label><select class="loan-repay-mode" aria-label="Repayment mode">' + optionsHtml(["auto", "manual"], loan.repaymentMode) + '</select></div>' +
        '<div class="m-edit-field" title="Netted against this loan\'s balance for both equity and interest — this is the one place to enter it. Don\'t also add it as a separate Cash asset on the Assets tab, or it\'ll be counted twice."><label>Offset</label><input type="number" step="1000" min="0" class="loan-offset" value="' + (Number(loan.offsetBalance) || 0) + '" aria-label="Offset account balance"></div>' +
        (loan.repaymentMode === "manual"
          ? '<div class="m-edit-field span3"><label>Manual repayment amount</label><input type="number" step="1" min="0" class="loan-manual-amount" value="' + (Number(loan.manualRepaymentAmount) || 0) + '" aria-label="Manual repayment amount"></div>'
          : "") +
      '</div>' +
    '</details>' +
    '<div class="m-edit-actions"><button type="button" class="btn btn-ghost btn-sm row-del" data-loan-del="' + li + '">Delete</button></div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="' + escapeAttr(section) + '" data-index="' + li + '" data-loan-index="' + li + '">' + summary + edit + '</div>';
}
function modernLoanListHtml(p){
  var rowMeta = loanRowMeta(p);
  var rows = rowMeta.map(function(m){ return loanRowModernHtml(m.loan, m.li, p.id, m.colorIdx); }).join("");
  return modernLoanCompBarHtml(rowMeta) + '<div class="m-rows">' + rows + '</div>';
}

function propertyCardHtml(p){
  var equity = propertyEquityToday(p);
  var loanRows = (p.loans || []).map(loanRowHtml).join("");
  var hasPmFee = p.kind === "IP";
  var pmFeePanel = hasPmFee
    ? '<div class="proj-controls prop-pmfee-panel">' +
        '<div class="proj-field" title="Applied to this property\'s Property Manager Fee expense row, worked out from its own rent — each property manager can charge a different rate"><label>PM fee % of rent</label><input type="number" min="0" max="100" step="0.1" class="prop-pmfee-percent" value="' + (Number(p.pmFee.percent) || 0) + '"></div>' +
        '<div class="proj-field"><label>+ flat $/month</label><input type="number" min="0" step="0.5" class="prop-pmfee-flat" value="' + (Number(p.pmFee.flat) || 0) + '"></div>' +
      '</div>'
    : "";
  var gearingBadge = "";
  var yieldBadge = "";
  var mortgageBalance = (p.loans || []).reduce(function(s, l){ return s + (Number(l.balance) || 0); }, 0);
  if(p.kind === "IP"){
    var gearing = propertyGearingAnnual(p);
    var isPositive = gearing >= 0;
    gearingBadge = '<span class="gearing-badge ' + (isPositive ? "positive" : "negative") + '" title="Rent minus expenses and loan repayments, per year (' + fmtCurrency0.format(gearing) + '/yr). ' +
      (isPositive ? "Positively geared — the property earns more than it costs to hold." : "Negatively geared — the property costs more to hold than it earns, a common tax strategy.") +
      '">' + (isPositive ? "Positively geared" : "Negatively geared") + '</span>';
    if(Number(p.value) > 0){
      var grossYield = sumField(p.income, "yearly") / Number(p.value);
      yieldBadge = '<span class="gearing-badge neutral" title="Annual rent ÷ current property value">' + fmtPercent1.format(grossYield) + ' gross yield</span>';
    }
  }
  var usableEquity = Math.max(0, (Number(p.value) || 0) * 0.8 - mortgageBalance);
  var loanRepaymentMonthlyTotal = propertyLoanRepaymentMonthly(p);
  var summaryTiles =
    '<div class="calc-out"><span>Valuation</span><b data-out="valuation">' + fmtCurrency0.format(Number(p.value) || 0) + '</b></div>' +
    '<div class="calc-out"><span>Mortgage balance</span><b data-out="mortgagebalance">' + fmtCurrency0.format(mortgageBalance) + '</b></div>' +
    '<div class="calc-out" title="Combined across every loan below, each converted to a monthly figure regardless of how it\'s individually displayed."><span>Loan repayment</span><b data-out="loanrepayment">' + fmtCurrency0.format(loanRepaymentMonthlyTotal) + '/mo</b></div>' +
    '<div class="calc-out emph"><span>Net equity</span><b data-out="netequity">' + fmtCurrency0.format(equity) + '</b></div>' +
    '<div class="calc-out" title="What you could borrow against this property, up to 80% LVR, without triggering LMI — based on its balance, not netted against any offset (that\'s a separate liquid asset, not more borrowing capacity)."><span>Usable equity</span><b data-out="usableequity">' + fmtCurrency0.format(usableEquity) + '</b></div>';
  if(p.kind === "IP"){
    var netCashFlowMonthly = propertyGearingAnnual(p) / 12;
    summaryTiles += '<div class="calc-out"><span>Net cash flow</span><b data-out="cashflow" style="color:' + (netCashFlowMonthly < 0 ? "var(--bad)" : "var(--good)") + '">' + (netCashFlowMonthly >= 0 ? "+" : "") + fmtCurrency0.format(netCashFlowMonthly) + '/mo</b></div>';
  }
  return '<div class="property-card" data-property-id="' + escapeAttr(p.id) + '">' +
    '<div class="home-block-head">' +
      '<div class="home-block-head-left">' +
        '<h4><input type="text" class="prop-what" value="' + escapeAttr(p.what) + '" aria-label="Property name">' +
        '<select class="prop-kind" aria-label="Property kind">' + optionsHtml(["IP", "PPOR"], p.kind) + '</select></h4>' +
        gearingBadge + yieldBadge +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm row-del" data-property-del="' + escapeAttr(p.id) + '" aria-label="Delete property">✕</button>' +
    '</div>' +
    '<div class="calc-outputs">' + summaryTiles + '</div>' +
    '<div class="property-section">' +
      '<div class="property-section-title">Property value</div>' +
      '<div class="calc-grid">' +
        '<div class="calc-field"><label>Current value</label><input type="number" step="1000" min="0" class="prop-value" value="' + (Number(p.value) || 0) + '"></div>' +
      '</div>' +
      '<div class="prop-value-log"><button type="button" class="asset-log-btn" data-property-log="' + escapeAttr(p.id) + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart">Log</button>' + historyTrendHtml(p) + '</div>' +
    '</div>' +
    '<div class="property-section">' +
      '<div class="property-section-title">Loans</div>' +
      (state.uiMode === "modern"
        ? '<div class="m-card" id="propLoanRows_' + escapeAttr(p.id) + '">' + modernLoanListHtml(p) + '</div>'
        : '<div class="table-scroll"><table class="calc-costs-table prop-loans-table"><thead><tr><th>What</th><th class="num">Balance</th><th class="num">Rate %</th><th class="num">Term (yrs)</th><th>Type</th><th>Paid</th><th>Repayment</th><th class="num" title="Netted against the loan balance for both equity and interest — the one place to enter this money, not also as a separate Cash asset">Offset</th><th></th></tr></thead><tbody>' + loanRows + '</tbody></table></div>') +
      '<button type="button" class="btn btn-sm btn-ghost" data-loan-add="' + escapeAttr(p.id) + '">+ Add loan</button>' +
    '</div>' +
    '<div class="property-section">' +
      '<div class="income-group">' +
        '<div class="income-group-head"><div class="income-group-head-left"><h4>Income</h4></div></div>' +
        (state.uiMode === "modern"
          ? '<div class="m-card"><div class="m-rows" id="propIncomeRows_' + escapeAttr(p.id) + '">' + modernPropListHtml(p.income, "propinc:" + p.id, false) + '</div></div>'
          : '<div class="table-scroll"><table class="ledger-table" id="propIncomeTable_' + escapeAttr(p.id) + '"></table></div>') +
        '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propinc:' + escapeAttr(p.id) + '">+ Add income</button>' +
      '</div>' +
    '</div>' +
    '<div class="property-section">' +
      '<div class="income-group">' +
        '<div class="income-group-head"><div class="income-group-head-left"><h4>Expenses</h4></div></div>' +
        pmFeePanel +
        (state.uiMode === "modern"
          ? '<div class="m-card"><div class="m-rows" id="propExpRows_' + escapeAttr(p.id) + '">' + modernPropListHtml(p.expenses, "propexp:" + p.id, true) + '</div></div>'
          : '<div class="table-scroll"><table class="ledger-table" id="propExpTable_' + escapeAttr(p.id) + '"></table></div>') +
        '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propexp:' + escapeAttr(p.id) + '">+ Add expense</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// Session-only (not persisted) — mirrors modernIncomeRowOpen/modernSharedRowOpen, shared across
// every property's income and expense lists (the section string, e.g. "propexp:<id>", already
// makes each property's keys unique within this one map).
export var modernPropRowOpen = {};
function modernPropListHtml(items, section, showClass){
  return items.map(function(item, i){ return modernPlainRowHtml(item, i, section, modernPropRowOpen, {showClass: showClass, showLog: true}); }).join("");
}
// Rebuilds just one property's income or expense list in place — used by rerenderTableFor so
// that, in modern mode, editing a property's rent (which auto-recalculates its Property Manager
// Fee expense row) only touches the expense list's own container, not the whole Properties page
// — the income row the user is actively typing into lives in a separate container and is never
// torn down mid-edit.
export function renderPropListModern(propId, section, items, showClass){
  var container = document.getElementById((showClass ? "propExpRows_" : "propIncomeRows_") + propId);
  if(container) container.innerHTML = modernPropListHtml(items, section, showClass);
}

export function renderProperties(){
  syncUiModeToggle();
  var container = document.getElementById("propertiesBody");
  if(!container) return;
  container.innerHTML = state.properties.length
    ? state.properties.map(propertyCardHtml).join("")
    : '<p class="ledger-note" style="margin:0">No properties yet — add one below to start tracking its value, loans, and (for an investment property) rent and expenses.</p>';
  if(state.uiMode !== "modern"){
    state.properties.forEach(function(p){
      buildTable(document.getElementById("propIncomeTable_" + p.id), "propinc:" + p.id, p.income, {showClass:false, showLog:true});
      buildTable(document.getElementById("propExpTable_" + p.id), "propexp:" + p.id, p.expenses, {showClass:true, hideAcctToggle:true, hideClassToggle:true, showLog:true});
    });
  }
  renderPropertyExpensesSummary();
  applyPeriodVisibility();
}

export function patchPropertyCardComputed(property){
  var card = document.querySelector('.property-card[data-property-id="' + CSS.escape(property.id) + '"]');
  if(!card) return;
  var equity = propertyEquityToday(property);
  var mortgageBalance = (property.loans || []).reduce(function(s, l){ return s + (Number(l.balance) || 0); }, 0);
  var setOut = function(key, text, color){
    var el = card.querySelector('[data-out="' + key + '"]');
    if(el){ el.textContent = text; if(color) el.style.color = color; }
  };
  setOut("valuation", fmtCurrency0.format(Number(property.value) || 0));
  setOut("mortgagebalance", fmtCurrency0.format(mortgageBalance));
  setOut("loanrepayment", fmtCurrency0.format(propertyLoanRepaymentMonthly(property)) + "/mo");
  setOut("netequity", fmtCurrency0.format(equity));
  setOut("usableequity", fmtCurrency0.format(Math.max(0, (Number(property.value) || 0) * 0.8 - mortgageBalance)));
  if(property.kind === "IP"){
    var netCashFlowMonthly = propertyGearingAnnual(property) / 12;
    setOut("cashflow", (netCashFlowMonthly >= 0 ? "+" : "") + fmtCurrency0.format(netCashFlowMonthly), netCashFlowMonthly < 0 ? "var(--bad)" : "var(--good)");
  }
  (property.loans || []).forEach(function(loan, li){
    var row = card.querySelector('[data-loan-index="' + li + '"]');
    if(!row) return;
    var disp = loanRepaymentDisplay(loan);
    var suffix = LOAN_REPAY_FREQ_SUFFIX[disp.freq] || "/mo";
    var note = row.querySelector(".loan-repayment-cell .computed-note");
    if(note) note.textContent = fmtCurrency0.format(disp.amount) + suffix;
    var headlineAmt = row.querySelector('[data-computed="amt"]');
    if(headlineAmt) headlineAmt.textContent = fmtCurrency2.format(disp.amount) + suffix;
    var sub = row.querySelector('[data-computed="sub"]');
    if(sub){
      var rateDisplay = Math.round((Number(loan.rate) || 0) * 100) / 100;
      sub.textContent = fmtCurrency0.format(Number(loan.balance) || 0) + " balance · " + rateDisplay + "% · " + loan.repaymentType + " · paid " + disp.freq.toLowerCase() + (loan.repaymentMode === "manual" ? " (manual)" : "");
    }
  });
  var loanBarWrap = card.querySelector('#propLoanRows_' + CSS.escape(property.id) + ' [data-comp-bar]');
  if(loanBarWrap) loanBarWrap.outerHTML = modernLoanCompBarHtml(loanRowMeta(property));
  var gearBadge = card.querySelector(".gearing-badge.positive, .gearing-badge.negative");
  if(gearBadge && property.kind === "IP"){
    var gearing = propertyGearingAnnual(property);
    var isPositive = gearing >= 0;
    gearBadge.className = "gearing-badge " + (isPositive ? "positive" : "negative");
    gearBadge.textContent = isPositive ? "Positively geared" : "Negatively geared";
    gearBadge.title = "Rent minus expenses and loan repayments, per year (" + fmtCurrency0.format(gearing) + "/yr). " +
      (isPositive ? "Positively geared — the property earns more than it costs to hold." : "Negatively geared — the property costs more to hold than it earns, a common tax strategy.");
  }
  var yieldBadge = card.querySelector(".gearing-badge.neutral");
  if(yieldBadge && property.kind === "IP" && Number(property.value) > 0){
    var grossYield = sumField(property.income, "yearly") / Number(property.value);
    yieldBadge.textContent = fmtPercent1.format(grossYield) + " gross yield";
  }
  renderPropertyExpensesSummary();
}

export function logPropertySnapshot(id){
  var property = state.properties.find(function(p){ return p.id === id; });
  if(!property) return;
  var num = Number(property.value) || 0;
  if(!Array.isArray(property.history)) property.history = [];
  var dateStr = appendHistorySnapshot(property.history, num);
  renderProperties();
  renderProjectionOutputs();
  persist();
  showToast("Logged " + fmtCurrency0.format(num) + " for " + property.what + " (" + dateStr + ")");
}
