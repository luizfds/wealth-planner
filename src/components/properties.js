import { state, persist } from "../state.js";
import {
  propertyEquityToday, propertyGearingAnnual, propertyLoanRepaymentMonthly, loanRepaymentDisplay,
  capitalWorksAnnual, plantDepreciationAnnual, propertyDepreciationForWindow, financialYearOf, fyLabel,
  propertyCapitalGain, propertyYieldOnCost, propertyLVR, propertiesTotalValue, propertiesTotalEquityToday, propertiesOffsetTotal,
  propertiesTotalMortgageBalance, propertiesNetCashFlowMonthly, propertiesWeightedGrossYield,
  propertyOwnershipPct, propertyOwnershipTotal, propertyTaxDeductibleResultAnnual, propertyTaxResultBreakdown, loanBalance, loanPaidOut,
  landTaxByState, totalLandTax, borrowingCostsSchedule, borrowingCostsDeduction, sortedRateHistory, calcRepaymentMonthly
} from "../calc/property.js";
import { getTaxPeople, computePersonTax } from "../calc/tax.js";
import { saleScenario } from "../calc/sale.js";
import { propertyClaimLines, rowDeductionAnnual } from "../calc/claims.js";
import { loanStrategy } from "../calc/loanstrategy.js";
import { LAND_TAX_STATES, LAND_TAX_YEAR } from "../constants.js";
import { sumField, householdYearWindow } from "../calc/ledger.js";
import { fixedRateView, rentSummary } from "../calc/propertylife.js";
import { statementTotals, statementsForFy, waterRatesLine } from "../calc/agentstatement.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { optionsHtml, modernPlainRowHtml, historyTrendHtml } from "../lib/ledger-table.js";
import { showToast } from "../lib/toast.js";
import { appendHistorySnapshot } from "../calc/ledger.js";
import { renderLineChart, dateAxisFormat, sparklineHtml, sparklinePlaceholderHtml } from "../lib/charts.js";
import { renderPropertyExpensesSummary } from "./expenses.js";
import { renderProjectionOutputs } from "./projections.js";

// Real-world payment cadences (loan repayments, and how a property manager actually disburses
// rent) are only ever weekly, fortnightly, or monthly — unlike income/expense rows elsewhere in
// this app, the less-than-monthly frequencies aren't real options here, so this is its own
// shorter list rather
// than reusing the global FREQS.
var PAYMENT_FREQS = ["Weekly", "Fortnightly", "Monthly"];
var PAYMENT_FREQ_SUFFIX = { Weekly: "/wk", Fortnightly: "/fn", Monthly: "/mo" };

// Which of a property's five sections (value/acquisition/loans/income/expenses) collapse-all/
// expand-all should toggle — order here is also the display order, matching propertyCardHtml.
export var PROPERTY_SECTION_KEYS = ["value", "acquisition", "ownership", "depreciation", "loans", "strategy", "income", "expenses", "sale"];
// Wraps one section's already-built head/body HTML with the collapse toggle chrome — shared by
// every .property-section below (Property value, Acquisition costs, Loans, Income, Expenses) so
// they all get identical collapse behavior and a consistent title treatment, rather than five
// slightly different hand-rolled headers. sectionKey only needs to be unique within one property
// (e.g. "value", "acquisition") — the property card itself scopes it, via property.sectionsCollapsed.
// Persisted on the property (state.js migration), not session-only — a structural edit anywhere on
// the page (adding a loan, an acquisition cost, editing Purchase price) rebuilds this whole card's
// innerHTML via renderProperties(), which would silently reset a native <details> back to its
// default open/closed state; reading straight off the property object survives that rebuild same
// as it did when this was a session-only map, but also survives a reload rather than resetting
// every session to all-open.

// Land value and state — the two inputs land tax needs, and nothing else uses. Kept in the Property
// value section because that is where the figure comes from: land value is printed on the same
// council/valuer-general notice as the valuation, and is a genuinely different number from market
// value (it excludes the building), which is the mistake this panel most needs to prevent.
//
// Only investment properties get it. A principal home is exempt in every state this app covers, so
// asking for its land value would imply a bill that will never arrive — the note says so instead,
// because "why is there no land tax on my home?" is a fair question with a real answer.
function landTaxFieldsHtml(p){
  if(p.kind !== "IP"){
    return '<p class="ledger-note" style="margin:6px 0 0">No land tax — your principal home is exempt in NSW, VIC and QLD. That exemption is also why buying a home to live in doesn\'t change the land tax on any investment property you hold.</p>';
  }
  var stateOpts = '<option value="">— Not set —</option>' + LAND_TAX_STATES.map(function(code){
    return '<option value="' + code + '"' + (p.state === code ? " selected" : "") + '>' + code + '</option>';
  }).join("") + '<option value="Other"' + (p.state === "Other" ? " selected" : "") + '>Other / not listed</option>';
  return '<div class="calc-grid">' +
    '<div class="calc-field" title="The state this property is in. Land tax is assessed per state on your combined holdings there, so this decides which scale applies and what it is aggregated with."><label>State</label>' +
      '<select class="prop-state" aria-label="State">' + stateOpts + '</select></div>' +
    '<div class="calc-field" title="Land value only — the site value from your council or valuer-general notice, NOT the market value of the property. It excludes the building, so it is usually well below Current value above."><label>Land value</label>' +
      '<input type="number" step="1000" min="0" class="prop-land-value" aria-label="Land value" value="' + (Number(p.landValue) || 0) + '" placeholder="0"></div>' +
  '</div>' +
  landTaxNoteHtml(p);
}
// What this property's land value actually produces, said in full. The apportionment is the part
// worth spelling out: a share of a joint assessment is not what the property would pay alone, and
// a reader who does not know that will think the figure is wrong.
function landTaxNoteHtml(p){
  if(!p.state) return '<p class="ledger-note" style="margin:6px 0 0">Set a state and land value to work out land tax.</p>';
  if(LAND_TAX_STATES.indexOf(p.state) === -1){
    return '<p class="ledger-note" style="margin:6px 0 0">Land tax isn\'t calculated for "' + escapeAttr(p.state) + '" — only NSW, VIC and QLD have rate tables in this app. Add it as an ordinary expense row below if you know the amount.</p>';
  }
  if(!(Number(p.landValue) || 0)) return '<p class="ledger-note" style="margin:6px 0 0">Enter this property\'s land value to work out ' + escapeAttr(p.state) + ' land tax.</p>';
  var group = landTaxByState().find(function(g){ return g.state === p.state; });
  if(!group) return "";
  var mine = group.properties.find(function(x){ return x.id === p.id; });
  var others = group.properties.length - 1;
  var lines = [];
  if(group.tax <= 0){
    lines.push(escapeAttr(p.state) + " land tax: nothing owing — " + fmtCurrency0.format(group.landValue) + " of land" + (others > 0 ? " across " + group.properties.length + " properties" : "") + " is under the threshold.");
  } else {
    lines.push(escapeAttr(p.state) + " land tax: " + fmtCurrency0.format(group.tax) + "/yr on " + fmtCurrency0.format(group.landValue) + " of land" + (others > 0 ? " across " + group.properties.length + " properties in " + escapeAttr(p.state) : "") + ".");
    if(others > 0){
      lines.push("This property's share is " + fmtCurrency0.format(mine ? mine.tax : 0) + "/yr (" + Math.round((mine ? mine.share : 0) * 100) + "% of the land value). It is one assessment on the combined total, so a share is not what this property would pay on its own.");
    }
  }
  lines.push("Rates as at the " + LAND_TAX_YEAR + " land tax year, general rates for an individual — check with the state revenue office before relying on it.");
  return '<p class="ledger-note" style="margin:6px 0 0">' + lines.join(" ") + '</p>';
}

function propertySectionHtml(property, sectionKey, titleHtml, bodyHtml){
  var isCollapsed = !!(property.sectionsCollapsed && property.sectionsCollapsed[sectionKey]);
  return '<div class="property-section' + (isCollapsed ? " is-collapsed" : "") + '">' +
    '<div class="property-section-head" data-prop-section-toggle="' + escapeAttr(sectionKey) + '" role="button" tabindex="0" aria-expanded="' + (!isCollapsed) + '">' +
      '<span class="icon-btn property-section-toggle" aria-hidden="true"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg></span>' +
      titleHtml +
    '</div>' +
    '<div class="property-section-body">' + bodyHtml + '</div>' +
  '</div>';
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
  var segs = rowMeta.map(function(m){ return { loan: m.loan, colorIdx: m.colorIdx, balance: Math.max(0, loanBalance(m.loan)) }; })
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
  var suffix = PAYMENT_FREQ_SUFFIX[disp.freq] || "/mo";
  var rateDisplay = Math.round((Number(loan.rate) || 0) * 100) / 100;
  var dot = colorIdx != null ? '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' : "";
  var summary = '<div class="m-row-summary" role="button" tabindex="0" data-row-toggle>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(loan.what) + '</div>' +
      '<div class="m-row-sub" data-computed="sub">' + (loanPaidOut(loan) ? 'paid out ' + escapeAttr(loan.endedOn) + ' · ' : '') + fmtCurrency0.format(Number(loan.balance) || 0) + ' balance · ' + rateDisplay + '% · ' + loan.repaymentType + " · paid " + disp.freq.toLowerCase() + (loan.repaymentMode === "manual" ? " (manual)" : "") + (loan.fixedUntil && loan.fixedUntil >= localDateStr() ? ' · fixed to ' + escapeAttr(loan.fixedUntil) : '') + '</div>' +
    '</div>' +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency2.format(disp.amount) + suffix + '</span>' +
    '<span class="m-row-chev" aria-hidden="true">✕</span>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="loan-what" value="' + escapeAttr(loan.what) + '" aria-label="Loan name"></div>' +
      '<div class="m-edit-field"><label>Balance</label><input type="number" step="1000" min="0" class="loan-balance" value="' + (Number(loan.balance) || 0) + '" aria-label="Loan balance"></div>' +
      '<div class="m-edit-field"><label>Rate %</label><input type="number" step="0.01" min="0" class="loan-rate" value="' + rateDisplay + '" aria-label="Interest rate percent" title="The rate now. To keep a record of a change (so past years\' interest follows it), use Record change below."></div>' +
      '<div class="m-edit-field"><label>Term (yrs)</label><input type="number" step="1" min="0" class="loan-term" value="' + (Number(loan.termYears) || 0) + '" aria-label="Term years remaining"></div>' +
      '<div class="m-edit-field"><label>Type</label><select class="loan-type" aria-label="Repayment type">' + optionsHtml(["PI", "IO"], loan.repaymentType) + '</select></div>' +
      '<div class="m-edit-field"><label>Paid</label><select class="loan-repay-freq" aria-label="How often this loan is paid" title="For auto repayments this only changes how the amount is displayed (still calculated monthly) — for a manual repayment it\'s the frequency the amount you type in is actually paid at.">' + optionsHtml(PAYMENT_FREQS, disp.freq) + '</select></div>' +
      '<div class="m-edit-field"><label>Repayment</label><select class="loan-repay-mode" aria-label="Repayment mode">' + optionsHtml(["auto", "manual"], loan.repaymentMode) + '</select></div>' +
      '<div class="m-edit-field" title="Netted against this loan\'s balance for both equity and interest — this is the one place to enter it. Don\'t also add it as a separate Cash asset on the Assets tab, or it\'ll be counted twice."><label>Offset</label><input type="number" step="1000" min="0" class="loan-offset" value="' + (Number(loan.offsetBalance) || 0) + '" aria-label="Offset account balance"></div>' +
      // Borrowing costs — see calc/property.js. A total, not a list: only the total enters the
      // five-year rule, and this form is busy enough already.
      '<div class="m-edit-field"><label>Settled on</label><input type="date" class="loan-settled" value="' + escapeAttr(loan.settlementDate || "") + '" title="The day the loan was drawn down. Starts the five-year clock for borrowing costs." aria-label="Loan settlement date"></div>' +
      '<div class="m-edit-field"><label>Borrowing costs</label><input type="number" step="1" min="0" class="loan-borrowing" value="' + (Number(loan.borrowingCosts) || 0) + '" title="LMI, the lender\'s establishment or settlement fee, mortgage registration, a lender-required valuation, a broker fee — costs of taking out the LOAN. Not stamp duty on the purchase or conveyancing: those go in Acquisition costs. Over $100 is deducted over five years, by days." aria-label="Borrowing costs"></div>' +
      // v3.85.0: what the money was used for decides the deduction, not the property behind it.
      '<div class="m-edit-field"><label>Used to invest %</label><input type="number" step="1" min="0" max="100" class="loan-invest-pct" value="' + (loan.investPct != null && loan.investPct !== "" ? loan.investPct : "") + '" placeholder="100" aria-label="Share of this loan used to invest, percent" title="Interest is deductible for what the borrowed money was used for, not the property it\'s secured against. The rental, shares: invest. Your own home\'s deposit, a car, living costs: not. Blank means all of it."></div>' +
      '<div class="m-edit-field"><label>Original term (yrs)</label><input type="number" step="1" min="0" class="loan-borrowing-term" value="' + (Number(loan.borrowingTermYears) || "") + '" placeholder="30" title="Only matters if the loan was for less than five years — borrowing costs are then spread over the term instead." aria-label="Original loan term in years"></div>' +
      '<div class="m-edit-field"><label>Paid out on</label><input type="date" class="loan-ended" value="' + escapeAttr(loan.endedOn || "") + '" title="If this loan was paid out or refinanced before its borrowing costs were fully deducted, the rest is deducted in that financial year." aria-label="Loan paid out or refinanced on"></div>' +
      // v3.72.0: a fixed rate's end, and the rate it rolls to.
      '<div class="m-edit-field"><label>Fixed until</label><input type="date" class="loan-fixed-until" value="' + escapeAttr(loan.fixedUntil || "") + '" aria-label="Fixed rate ends on" title="Leave blank for a variable loan."></div>' +
      '<div class="m-edit-field"><label>Rate after %</label><input type="number" step="0.01" min="0" class="loan-revert-rate" value="' + (loan.revertRate != null ? loan.revertRate : "") + '" placeholder="' + rateDisplay + '" aria-label="Rate after the fixed period" title="What the lender says it reverts to — check your loan statement. Blank uses today\'s rate."></div>' +
      '<div class="m-edit-field span3"><span class="computed-note" data-computed="borrow">' + borrowingNoteText(loan) + '</span></div>' +
      rateHistoryHtml(loan) +
      (loan.repaymentMode === "manual"
        ? '<div class="m-edit-field span3"><label>Manual repayment amount</label><input type="number" step="1" min="0" class="loan-manual-amount" value="' + (Number(loan.manualRepaymentAmount) || 0) + '" aria-label="Manual repayment amount"></div>'
        : "") +
    '</div>' +
    '<div class="m-edit-actions"><button type="button" class="btn btn-ghost btn-sm row-del" data-loan-del="' + li + '">Delete</button></div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="' + escapeAttr(section) + '" data-index="' + li + '" data-loan-index="' + li + '">' + summary + edit + '</div>';
}
// Rate history (v3.53.0) — calc/property.js. The rate field above is the rate now; recording a
// change keeps when it moved, which a past year's interest and Close the year both read.
export function rateHistoryHtml(loan, today){
  today = today || localDateStr();
  var hist = sortedRateHistory(loan);
  var list = hist.map(function(h, i){
    return '<span class="rh-item">' + (Math.round(Number(h.rate) * 100) / 100) + '% ' + (h.date ? 'from ' + escapeAttr(h.date) : 'at the start') +
      '<button type="button" class="icon-btn" data-rate-del="' + i + '" aria-label="Remove this rate change">✕</button></span>';
  }).join("");
  return '<div class="m-edit-field span3 rh-wrap"><label>Rate changes</label>' +
    (hist.length ? '<div class="rh-list">' + list + '</div>' + (rateChangeNote(loan) ? '<span class="computed-note">' + rateChangeNote(loan) + '</span>' : '') : '<span class="computed-note">No changes recorded. When the lender moves the rate, record it here with the date — past years\' interest then follows it.</span>') +
    '<div class="rh-record"><input type="date" class="loan-rate-date" value="' + today + '" aria-label="Date the new rate applies from"><input type="number" step="0.01" min="0" class="loan-rate-new" placeholder="New rate %" aria-label="New rate percent">' +
    '<button type="button" class="btn btn-sm btn-ghost" data-rate-record>Record change</button></div></div>';
}
// What the latest recorded change did: the repayment and a year's interest, before and after.
export function rateChangeNote(loan){
  var hist = sortedRateHistory(loan);
  if(hist.length < 2) return "";
  var cur = hist[hist.length - 1], prev = hist[hist.length - 2];
  var pi = loan.repaymentType !== "IO";
  var interestBal = Math.max(0, (Number(loan.balance) || 0) - (Number(loan.offsetBalance) || 0));
  var repay = function(rate){ return pi ? calcRepaymentMonthly(loan.balance, rate, loan.termYears, loan.repaymentType) : interestBal * rate / 1200; };
  var dRepay = repay(cur.rate) - repay(prev.rate);
  var dInterest = interestBal * (Number(cur.rate) - Number(prev.rate)) / 100;
  var up = dRepay >= 0;
  return 'Last change' + (cur.date ? ' ' + escapeAttr(cur.date) : '') + ': ' + prev.rate + '% → ' + cur.rate + '% — repayment ' + fmtCurrency0.format(repay(prev.rate)) + ' → ' + fmtCurrency0.format(repay(cur.rate)) +
    ' a month (' + (up ? '+' : '−') + fmtCurrency0.format(Math.abs(dRepay)) + '), about ' + fmtCurrency0.format(Math.abs(dInterest)) + ' ' + (dInterest >= 0 ? 'more' : 'less') + ' interest a year' +
    (loan.repaymentMode === "manual" ? '. Your repayment is typed in — update it if the lender changed it.' : '.');
}
// One line under the borrowing-cost fields: what this year's return gets, out of what total, and
// when the spread ends — the three things you need when the ATO calculator asks the same question.
export function borrowingNoteText(loan){
  var total = Number(loan.borrowingCosts) || 0;
  if(!(total > 0)) return "Deducted over five years from settlement. Your lender's settlement letter or first loan statement lists them.";
  if(!loan.settlementDate) return "Add the settlement date to spread these over five years.";
  var sched = borrowingCostsSchedule(loan);
  var win = householdYearWindow();
  var now = borrowingCostsDeduction(loan, win);
  var last = sched[sched.length - 1];
  if(last && last.writtenOff){
    return "Deductible " + win.label + ": " + fmtCurrency2.format(now) + " of " + fmtCurrency2.format(total) +
      " — paid out " + loan.endedOn + ", so the remaining " + fmtCurrency2.format(last.amount) + " is deducted in " + fyLabel(last.fy) + ".";
  }
  return "Deductible " + win.label + ": " + fmtCurrency2.format(now) + " of " + fmtCurrency2.format(total) +
    (sched.length > 1 ? " — spread to FY" + String(last.fy % 100).padStart(2, "0") + "/" + String((last.fy + 1) % 100).padStart(2, "0") + "." : " — all in the year paid.");
}
function modernLoanListHtml(p){
  var rowMeta = loanRowMeta(p);
  var rows = rowMeta.map(function(m){ return loanRowModernHtml(m.loan, m.li, p.id, m.colorIdx); }).join("");
  return modernLoanCompBarHtml(rowMeta) + '<div class="m-rows">' + rows + '</div>';
}

// Reuses the exact cc-what/cc-amount/cc-del/.m-cost-row component scenarios.js's purchase
// calculator already built for its own "Other acquisition costs" list (same real-world concept —
// settlement costs — just attached to a planned future purchase there instead of a real property
// here) — borderless inputs, a fixed-width right-aligned amount column, the same row-dot +
// composition-bar treatment. data-acq-cost-index/data-acq-cost-del stay as extra attributes (not
// extra classes) so app.js's existing event delegation for this section is unaffected by reusing
// the shared classes.
function acquisitionCostRowMeta(p){
  var costs = Array.isArray(p.acquisitionCosts) ? p.acquisitionCosts : [];
  return costs.map(function(c, i){ return { cost: c, i: i, colorIdx: i % 8 }; });
}
function acquisitionCostCompBarHtml(rowMeta){
  var segs = rowMeta.map(function(m){ return { cost: m.cost, colorIdx: m.colorIdx, amount: Math.max(0, Number(m.cost.amount) || 0) }; })
    .filter(function(x){ return x.amount > 0.5; });
  if(segs.length < 2) return "";
  var total = segs.reduce(function(s, x){ return s + x.amount; }, 0);
  return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
    var pct = total > 0 ? x.amount / total : 0;
    return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.amount + ' 1 0%" title="' + escapeAttr(x.cost.what) + ': ' + fmtCurrency0.format(x.amount) + ' (' + fmtPercent1.format(pct) + ')"></div>';
  }).join("") + '</div>';
}
// Names that usually mean a cost of the LOAN, not the purchase — from before item 37 gave
// borrowing costs their own field, when Acquisition costs was the only place to put them. Only a
// hint: nothing moves without a click, since moving a cost out of here changes the CGT cost base.
var LOAN_COST_PATTERN = /\blmi\b|mortgage insurance|lenders?'? mortgage|mortgage reg|registration of mortgage|loan (fee|application|establishment)|establishment fee|application fee|settlement fee|valuation|broker/i;
export function looksLikeLoanCost(what){ return LOAN_COST_PATTERN.test(String(what || "")); }
function acquisitionCostRowModernHtml(item, index, colorIdx, p){
  var canMove = p && p.kind === "IP" && (p.loans || []).length > 0;
  var suggested = canMove && looksLikeLoanCost(item.what);
  var moveBtn = canMove
    ? '<button type="button" class="btn btn-ghost btn-sm acq-move' + (suggested ? " suggested" : " icon-only") + '" data-acq-cost-move="' + index + '"' + (suggested ? "" : ' aria-label="Move to the loan\'s borrowing costs"') + ' title="A cost of taking out the loan (LMI, lender fees, mortgage registration) isn\'t part of the purchase: it\'s deducted over five years instead, and doesn\'t go in the CGT cost base.">' + (suggested ? "Looks like a loan cost — move to borrowing costs" : '<span aria-hidden="true">↪</span>') + '</button>'
    : "";
  var whatInput = '<input type="text" class="cc-what" data-acq-cost-index="' + index + '" value="' + escapeAttr(item.what) + '" placeholder="e.g. Stamp duty" aria-label="Acquisition cost description">';
  var amountInput = '<input type="number" step="100" min="0" class="cc-amount" data-acq-cost-index="' + index + '" value="' + (Number(item.amount) || 0) + '" aria-label="Amount">';
  var delBtn = '<button type="button" class="btn btn-ghost btn-sm row-del" data-acq-cost-del="' + index + '" aria-label="Delete acquisition cost">✕</button>';
  return '<div class="cc-row m-cost-row' + (canMove ? " has-move" : "") + (suggested ? " is-loan-cost" : "") + '" data-acq-cost-index="' + index + '">' +
    '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' + whatInput + amountInput + delBtn + moveBtn +
  '</div>';
}
// Stamp duty, legal, buyer's agent, inspection, etc. — itemized rather than a single lump sum, so
// it doubles as a real record of what was paid, not just a number. Always rendered (even with an
// empty list) so there's somewhere obvious to add the first one — unlike Loans/Income/Expenses,
// this section has no natural "hide until non-empty" moment since it's core to Capital gain.
// Investment properties only: depreciation is a deduction against rental income, and a home you
// live in doesn't have one. Rendering it on a PPOR would invite somebody to fill it in and then
// wonder why nothing happened.
// The quantity surveyor's year-by-year table. Each row is one financial year as printed in the
// report; a year listed here is used as-is, and the formula fields above only fill the years it
// doesn't list. The FY options run from the purchase year (or ten years back) to forty on, which
// covers any report's horizon without a free-text year to mistype.
// What the capital gain figure is measured against — a sentence, because "cost base" alone means
// nothing to most people and the capital works reduction is the part that surprises them.
export function capitalGainTitle(p, g){
  if(!g) return "";
  var base = "Current value minus your CGT cost base of " + fmtCurrency0.format(g.costBase) + " (what you paid plus acquisition costs";
  if(g.capitalWorksReduction > 0) return base + ", less " + fmtCurrency0.format(g.capitalWorksReduction) + " of capital works claimed since purchase — those deductions come back as gain on sale). Before tax and the 50% discount.";
  if(p.kind === "IP" && !p.purchaseDate) return base + "). Add the purchase date and capital works claimed since will come off it, as they do on sale.";
  return base + "). Before tax and the 50% discount.";
}
function depreciationScheduleHtml(p){
  var rows = Array.isArray(p.depreciationSchedule) ? p.depreciationSchedule : [];
  var thisFy = financialYearOf(localDateStr());
  var firstFy = p.purchaseDate ? financialYearOf(p.purchaseDate) : thisFy - 10;
  var years = [];
  for(var y = firstFy; y <= firstFy + 40; y++) years.push(y);
  rows.forEach(function(r){ if(years.indexOf(Number(r.fy)) === -1) years.push(Number(r.fy)); });
  years.sort(function(a, b){ return a - b; });
  var rowsHtml = rows.map(function(r, i){
    return '<div class="cc-row m-cost-row dep-sched-row" data-dep-sched-index="' + i + '">' +
      '<select class="dep-sched-fy" data-dep-sched-index="' + i + '" aria-label="Financial year">' +
        years.map(function(y){ return '<option value="' + y + '"' + (Number(r.fy) === y ? " selected" : "") + '>' + fyLabel(y) + '</option>'; }).join("") +
      '</select>' +
      '<input type="number" step="1" min="0" class="dep-sched-cw" data-dep-sched-index="' + i + '" value="' + (Number(r.capitalWorks) || 0) + '" aria-label="Capital works for ' + fyLabel(Number(r.fy)) + '" title="Capital works (Division 43) for this year, from the report">' +
      '<input type="number" step="1" min="0" class="dep-sched-plant" data-dep-sched-index="' + i + '" value="' + (Number(r.plant) || 0) + '" aria-label="Plant and equipment for ' + fyLabel(Number(r.fy)) + '" title="Plant & equipment (Division 40) for this year, from the report">' +
      '<button type="button" class="btn btn-ghost btn-sm row-del" data-dep-sched-del="' + i + '" aria-label="Delete ' + fyLabel(Number(r.fy)) + '">✕</button>' +
    '</div>';
  }).join("");
  return '<div class="calc-costs-title" style="margin-top:14px">Quantity surveyor\'s schedule</div>' +
    '<p class="ledger-note" style="margin-left:0">Year · capital works · plant, as printed in the report. A year listed here is used as-is; the fields above fill the years it doesn\'t list.</p>' +
    (rows.length ? '<div class="m-card m-cost-rows">' + rowsHtml + '</div>' : "") +
    '<button type="button" class="btn btn-sm btn-ghost" style="margin-top:8px" data-dep-sched-add="' + escapeAttr(p.id) + '">+ Add year</button>';
}
function depreciationSectionHtml(p){
  var thisYear = propertyDepreciationForWindow(p);
  var capitalWorks = thisYear.capitalWorks;
  var plant = thisYear.plant;
  var total = capitalWorks + plant;
  return propertySectionHtml(p, "depreciation",
    '<div class="property-section-title">Depreciation</div>' +
      '<div class="property-section-total" title="' + escapeAttr(householdYearWindow().label) + '">' + fmtCurrency0.format(total) + '</div>',
    '<p class="ledger-note help" style="margin-left:0">Usually the largest deduction on an investment property, and the only one that isn\'t money leaving your account — it reduces the taxable result without touching cash flow. A quantity surveyor\'s depreciation schedule is where these figures come from; entering guesses here produces a guess on your tax return.</p>' +
    '<div class="calc-grid">' +
      '<div class="calc-field" title="The original cost to BUILD, not what you paid for the property — land is not depreciable. Claimed at 2.5% a year for 40 years from completion."><label>Construction cost</label><input type="number" step="1000" min="0" class="prop-construction-cost" value="' + (Number(p.constructionCost) || 0) + '" placeholder="0"></div>' +
      '<div class="calc-field" title="When the building was completed. The 2.5% capital works claim runs for 40 years from then; leave blank if unknown and the full year is claimed."><label>Built on</label><input type="date" class="prop-construction-date" aria-label="Built on" value="' + escapeAttr(p.constructionDate || "") + '"></div>' +
      '<div class="calc-field" title="Carpets, blinds, appliances, air conditioning. Since 2017 these are only claimable on items you bought new — not on a second-hand residential property."><label>Plant &amp; equipment</label><input type="number" step="500" min="0" class="prop-plant-value" value="' + (Number(p.plantValue) || 0) + '" placeholder="0"></div>' +
      '<div class="calc-field" style="grid-column:1/-1"><label class="m-checkbox-field"><input type="checkbox" class="prop-plant-secondhand"' + (p.plantSecondHand ? " checked" : "") + '> Plant was already in the property when bought (second-hand)</label>' +
        '<span class="computed-note">Bought under a contract after 9 May 2017? Then existing plant isn\'t claimable — your QS report still values it, for a capital loss when an item is replaced and for CGT on sale.</span></div>' +
      '<div class="calc-field" title="Averaged straight-line over this many years. A real schedule depreciates each item separately at its own rate; this app has no per-item register, so an average across the pool is closer to the truth than pretending to a precision it can\'t support."><label>Effective life (yrs)</label><input type="number" step="1" min="1" max="40" class="prop-plant-life" aria-label="Plant and equipment effective life in years" value="' + (Number(p.plantEffectiveLife) || 10) + '"></div>' +
    '</div>' +
    depreciationScheduleHtml(p) +
    '<p class="ledger-note" style="margin-left:0">' +
      (total > 0
        ? householdYearWindow().label + (thisYear.source === "schedule" ? " (from the schedule)" : "") + ": capital works " + fmtCurrency0.format(capitalWorks) + " + plant " + fmtCurrency0.format(plant) + (p.plantSecondHand && Number(p.plantValue) > 0 ? " (second-hand, not claimable)" : "") +
          " = <b>" + fmtCurrency0.format(total) + "</b> off this property's taxable result. Cash flow is unchanged."
        : "Nothing claimed yet — this property's taxable result is the same as its cash result.") +
    '</p>');
}

// Who owns this property, and therefore who carries its taxable result. This used to be a single
// "IP ownership %" field per person on the Income page, applied to the whole portfolio at once:
// two properties owned differently were unrepresentable, and nothing ever checked the shares added
// to 100 — both spouses at 100% silently deducted the same negative-gearing loss twice. The split
// belongs to the property, so it lives on the property.
//
// One row per person with a Gross income row. No one else can appear here: the share only matters
// because it moves a taxable income, and someone with no taxable income to move has nothing to
// carry. Empty (nobody has set a share) means an even split — the same default as before — and the
// note says so rather than pre-filling numbers the user never chose.
// Loan strategy (v3.41.0) — calc/loanstrategy.js. Inputs on loan.strategy; which loan, when there
// are several, on p.strategyLoan.
export function loanStrategyHtml(p){
  var loans = (p.loans || []).filter(function(l){ return !loanPaidOut(l) && Number(l.balance) > 0; });
  if(!loans.length) return '<p class="ledger-note" style="margin:0">Add a loan with a balance to try extra repayments, offset, a rate change or a refinance.</p>';
  var li = Math.min(Number(p.strategyLoan) || 0, loans.length - 1);
  var loan = loans[li];
  var idx = p.loans.indexOf(loan);
  var st = loan.strategy || {};
  var r = loanStrategy(loan, st);
  var money = function(v){ return fmtCurrency0.format(v); };
  var yrs = function(m){ return m == null ? "never" : (Math.floor(m / 12) ? Math.floor(m / 12) + "y " : "") + (m % 12) + "m"; };
  var input = function(key, label, attrs){
    return '<label>' + label + ' <input type="number" data-strategy-field="' + key + '" data-strategy-loan="' + idx + '" value="' + escapeAttr(st[key] == null ? "" : st[key]) + '"' +
      ' step="' + (attrs.step || "1") + '" min="0" placeholder="' + escapeAttr(attrs.placeholder || "") + '"></label>';
  };
  var card = function(title, inputs, body){ return '<div class="ls-card"><div class="ls-title">' + title + '</div><div class="ls-inputs">' + inputs + '</div><div class="ls-body">' + body + '</div></div>'; };
  var picker = loans.length > 1 ? '<label class="ls-pick">Loan <select data-strategy-pick>' + loans.map(function(l, i){ return '<option value="' + i + '"' + (i === li ? " selected" : "") + '>' + escapeAttr(l.what || ("Loan " + (i + 1))) + '</option>'; }).join("") + '</select></label>' : '';
  var baseLine = r.io ? "Interest only: " + money(r.repayment) + " a month, and the balance doesn't fall."
    : money(r.repayment) + " a month · paid off in " + yrs(r.base.months) + " · " + money(r.base.interest) + " interest to go" + (Number(loan.offsetBalance) ? " (with today's offset)" : "") + ".";
  var extraBody = r.io ? "An interest-only loan doesn't take extra repayments into its schedule — see offset."
    : r.extra ? "Paid off <b>" + yrs(r.extra.monthsSaved) + " sooner</b>, <b>" + money(r.extra.interestSaved) + "</b> less interest." : "How much more a month?";
  var offBody = r.offset ? "<b>" + money(r.offset.yearlySaved) + "</b> a year less interest" + (r.offset.monthsSaved != null ? ", paid off " + yrs(r.offset.monthsSaved) + " sooner if it stays there" : "") + "." : "Money you'd park in offset.";
  var rateBody = r.rate ? "Repayments " + (r.rate.monthlyChange >= 0 ? "up " : "down ") + "<b>" + money(Math.abs(r.rate.monthlyChange)) + "</b> a month (" + money(Math.abs(r.rate.yearlyChange)) + " a year), to " + money(r.rate.repayment) + "." : "Try a rate.";
  var refiBody = r.refi ? (r.refi.monthlySaving > 0
      ? "<b>" + money(r.refi.monthlySaving) + "</b> a month less, about " + money(r.refi.firstYearInterestSaved) + " less interest in the first year. " +
        (r.refi.breakEvenMonths === 0 ? "The cashback covers the switching costs from day one." : "Pays back the " + money(r.refi.netCosts) + " net switching cost in <b>" + r.refi.breakEvenMonths + " month" + (r.refi.breakEvenMonths === 1 ? "" : "s") + "</b>.")
      : "Not cheaper: the new repayment is " + money(Math.abs(r.refi.monthlySaving)) + " a month more.") : "A rate you've been offered.";
  return picker + '<p class="ls-base">' + baseLine + '</p><div class="ls-grid">' +
    card("Extra repayments", input("extra", "$ a month", { step: "50", placeholder: "300" }), extraBody) +
    card("More in offset", input("offsetAdd", "$", { step: "1000", placeholder: "20000" }), offBody) +
    card("If the rate moves", input("newRate", "New rate %", { step: "0.05", placeholder: (Number(loan.rate) + 0.5).toFixed(2) }), rateBody) +
    card("Refinance", input("refiRate", "Rate %", { step: "0.05", placeholder: "5.79" }) + input("refiCosts", "Costs $", { step: "50", placeholder: "800" }) + input("cashback", "Cashback $", { step: "500", placeholder: "2000" }), refiBody) +
  '</div>' +
  (p.kind === "IP" ? '<p class="ledger-note" style="margin:8px 0 0">On an investment loan, offset and extra repayments save the same interest while the money stays put — but money redrawn from extra repayments for anything private isn\'t deductible, while money taken back out of offset leaves the deductible loan intact. Offset keeps the options.</p>' : '');
}
export function setLoanStrategyField(p, loanIdx, field, value){
  var loan = (p.loans || [])[loanIdx];
  if(!loan) return;
  if(!loan.strategy || typeof loan.strategy !== "object") loan.strategy = {};
  if(value === "" || value == null) delete loan.strategy[field]; else loan.strategy[field] = Number(value);
  persist();
}
export function patchLoanStrategy(p){
  var el = document.querySelector('[data-strategy-property="' + p.id + '"]');
  if(!el) return;
  var focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-strategy-field") : null;
  el.innerHTML = loanStrategyHtml(p);
  if(focused){ var f = el.querySelector('[data-strategy-field="' + focused + '"]'); if(f) f.focus(); }
}

// "If you sold" (v3.39.0) — calc/sale.js saleScenario(). Inputs live on p.saleWhatIf so they
// survive a re-render; nothing here changes the property itself.
export function saleWhatIfData(p){
  var w = p.saleWhatIf || {};
  var today = localDateStr();
  var people = getTaxPeople();
  var owners = people.map(function(name){
    return { name: name, pct: propertyOwnershipPct(p, name, people), taxable: computePersonTax(name).taxable };
  }).filter(function(o){ return o.pct > 0; });
  var saleDate = w.date || today;
  return {
    inputs: { date: saleDate, price: w.price || "", agentPct: w.agentPct == null ? 2.5 : w.agentPct, otherCosts: w.otherCosts == null ? 2500 : w.otherCosts },
    result: saleScenario(p, { today: today, saleDate: saleDate < today ? today : saleDate, salePrice: w.price, growthPct: state.projection.propertyAppreciationRate,
      agentPct: w.agentPct == null ? 2.5 : w.agentPct, otherCosts: w.otherCosts == null ? 2500 : w.otherCosts, owners: owners }),
    growthPct: state.projection.propertyAppreciationRate
  };
}
export function saleWhatIfHtml(p, d){
  var r = d.result, i = d.inputs;
  var line = function(label, v, cls){ return '<div class="sale-line' + (cls ? " " + cls : "") + '"><span>' + label + '</span><b>' + v + '</b></div>'; };
  var money = function(v){ return v == null ? "—" : fmtCurrency0.format(v); };
  var owners = r.owners.map(function(o){
    return '<div class="sale-owner"><div class="sale-owner-name">' + escapeAttr(o.name) + ' <small>' + Math.round(o.share * 100) + '%</small></div>' +
      line("Share of the gain", money(o.gain)) +
      (o.loss ? line("Capital loss to carry forward", money(o.loss)) : line(r.discount ? "Taxable, after the 50% discount" : "Taxable (held under 12 months)", money(o.assessable))) +
      line("Extra tax and Medicare", money(o.tax)) +
      line("Cash in hand after tax", money(o.cash), "sale-total") + '</div>';
  }).join("");
  return '<div class="sale-inputs">' +
      '<label>Sell on <input type="date" data-sale-field="date" value="' + escapeAttr(i.date) + '"></label>' +
      '<label>Sale price <input type="number" step="1000" min="0" data-sale-field="price" value="' + escapeAttr(i.price) + '" placeholder="' + r.salePrice + '"></label>' +
      '<label>Agent % <input type="number" step="0.1" min="0" max="10" data-sale-field="agentPct" value="' + i.agentPct + '"></label>' +
      '<label>Other costs $ <input type="number" step="100" min="0" data-sale-field="otherCosts" value="' + i.otherCosts + '" title="Conveyancing, marketing, styling, any break costs"></label>' +
    '</div>' +
    (i.price ? '' : '<p class="ledger-note" style="margin:0 0 8px">Sale price left blank: today\'s value grown at ' + d.growthPct + '% a year (Projections) to the sale date.</p>') +
    '<div class="sale-grid"><div class="sale-col">' +
      line("Sale price", money(r.salePrice)) + line("Agent and selling costs", "−" + money(r.sellingCosts)) +
      line("Loans paid out", "−" + money(r.loanPayout)) + line("Cash before tax", money(r.cashBeforeTax), "sale-total") +
      line("Paid, with acquisition costs", money(r.paid), "sale-gap") +
      (r.capitalWorksReduction ? line("Less capital works claimed", "−" + money(r.capitalWorksReduction)) : "") +
      line("Capital gain", money(r.gain), "sale-total") +
    '</div><div class="sale-col">' + (owners || '<p class="ledger-note">Set ownership above to split the gain between owners.</p>') +
      (r.owners.length > 1 ? line("Total cash after tax", money(r.cashAfterTax), "sale-total sale-grand") : '') + '</div></div>' +
    '<p class="ledger-note" style="margin:8px 0 0">' + (r.paid == null ? "Add the purchase price (Property value) for the capital gain. " : "") +
      'Taxed in ' + fyLabel(r.fy) + ' on top of each owner\'s taxable income today — the year the rent stops, so if anything that\'s slightly high. A capital loss carries forward against future gains. An offset balance stays yours on top of this. An estimate: your accountant settles the real one.</p>';
}

function ownershipSectionHtml(p){
  var people = getTaxPeople();
  var total = propertyOwnershipTotal(p);
  var isDefault = total == null;
  var offBy = !isDefault && Math.abs(total - 100) > 0.01;
  var result = propertyTaxDeductibleResultAnnual(p);
  if(!people.length){
    return propertySectionHtml(p, "ownership",
      '<div class="property-section-title">Ownership</div>',
      '<p class="ledger-note" style="margin-left:0">Mark an Income row\'s Type as "Gross" and give it a Person on Cash flow → Income, and they\'ll show up here to take a share of this property\'s result.</p>');
  }
  var rows = people.map(function(person){
    var pct = propertyOwnershipPct(p, person, people);
    return '<div class="calc-field"><label>' + escapeAttr(person) + ' %</label>' +
      '<input type="number" min="0" max="100" step="1" class="prop-ownership" data-ownership-person="' + escapeAttr(person) + '" value="' + (Math.round(pct * 100) / 100) + '"></div>';
  }).join("");
  return propertySectionHtml(p, "ownership",
    '<div class="property-section-title">Ownership</div>' +
      '<div class="property-section-total' + (offBy ? " is-warn" : "") + '">' + (isDefault ? "Even split" : Math.round(total) + "%") + '</div>',
    '<p class="ledger-note" style="margin-left:0">What share of this property\'s ' +
      (result < 0 ? "loss" : "result") + ' (' + fmtCurrency0.format(result) + '/yr) each person carries on their tax return. ' +
      (isDefault
        ? 'Not set, so it\'s split evenly between everyone with a Gross income row. Change a number to make it explicit.'
        : 'These must add to 100% — the app won\'t rescale them for you, because the number you typed is more likely right than a number it invented.') +
    '</p>' +
    '<div class="calc-grid">' + rows + '</div>' +
    (offBy
      ? '<p class="tax-cap-note warn" style="margin:10px 0 0">These add to ' + Math.round(total) + '%, not 100% — ' +
        fmtCurrency0.format(Math.abs(result * (total - 100) / 100)) + '/yr of this property\'s result is being ' +
        (total > 100 ? "claimed twice" : "claimed by nobody") + ' on Cash flow → Income.</p>'
      : '') );
}

function acquisitionCostsSectionHtml(p){
  var rowMeta = acquisitionCostRowMeta(p);
  var total = rowMeta.reduce(function(s, m){ return s + (Number(m.cost.amount) || 0); }, 0);
  var rowsHtml = rowMeta.map(function(m){ return acquisitionCostRowModernHtml(m.cost, m.i, m.colorIdx, p); }).join("");
  var titleHtml = '<div class="property-section-title">Acquisition costs <span data-out="acqcoststotal" style="font-weight:400;color:var(--ink-soft)">' + (total > 0 ? "— " + fmtCurrency0.format(total) + " total" : "") + '</span></div>';
  var bodyHtml =
    '<p class="ledger-note" style="margin-left:0">Stamp duty, legal/conveyancing, buyer\'s agent, building/pest inspection — itemize what you actually paid. Added to Purchase price above for Capital gain and yield-on-cost.</p>' +
    '<div class="m-card m-cost-rows" id="propAcqCostRows_' + escapeAttr(p.id) + '">' + acquisitionCostCompBarHtml(rowMeta) + rowsHtml + '</div>' +
    '<button type="button" class="btn btn-sm btn-ghost" style="margin-top:8px" data-acq-cost-add="' + escapeAttr(p.id) + '">+ Add cost</button>';
  return propertySectionHtml(p, "acquisition", titleHtml, bodyHtml);
}

// One stat tile — shared by both the always-visible "primary" row and the collapsible "More
// detail" row below it, so the two rows are visually identical, just showing a different subset.
function propertyStatTileHtml(key, label, valueHtml, opts){
  opts = opts || {};
  return '<div class="calc-out' + (opts.emph ? " emph" : "") + '"' + (opts.title ? ' title="' + escapeAttr(opts.title) + '"' : "") + '>' +
    '<span>' + label + '</span><b data-out="' + key + '"' + (opts.color ? ' style="color:' + opts.color + '"' : "") + '>' + valueHtml + '</b>' +
    (opts.extraHtml || "") +
  '</div>';
}

// ---------------- Fixed rates and rent (v3.72.0) — calc/propertylife.js ----------------
export var fixedWhatIf = {};
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthYear(iso){ return iso ? MON[Number(iso.slice(5, 7)) - 1] + " " + iso.slice(0, 4) : ""; }
export function fixedExpiryHtml(p, today){
  today = today || localDateStr();
  var rows = (p.loans || []).map(function(l, li){
    var key = p.id + ":" + li;
    var v = fixedRateView(l, today, fixedWhatIf[key]);
    if(!v) return "";
    var up = v.change >= 0;
    return '<div class="fx-row"><div class="fx-main"><b>' + escapeAttr(l.what || "Loan") + '</b> — fixed at ' + v.rateNow + '% until ' + escapeAttr(monthYear(v.fixedUntil)) + ' (' + (v.months < 1 ? "this month" : Math.round(v.months) + " months") + ').' +
      '<small>Then at <b>' + v.rateAfter + '%</b>: repayments ' + fmtCurrency0.format(v.monthlyNow) + ' → <b>' + fmtCurrency0.format(v.monthlyAfter) + '/mo</b> <span class="' + (up ? "down" : "up") + '">(' + (up ? "+" : "−") + fmtCurrency0.format(Math.abs(v.change)) + ')</span>, interest about ' + fmtCurrency0.format(v.yearlyInterestAfter) + ' a year.</small></div>' +
      '<label class="fx-whatif"><span>What if it rolls to</span><input type="number" step="0.05" min="0" data-fixed-whatif="' + escapeAttr(key) + '" value="' + (fixedWhatIf[key] != null ? fixedWhatIf[key] : "") + '" placeholder="' + v.rateAfter + '" aria-label="What-if rate for ' + escapeAttr(l.what || "loan") + '">%</label></div>';
  }).join("");
  return rows ? '<div class="fx"><div class="property-section-title">When fixed rates end</div>' + rows + '</div>' : "";
}
export function rentPanelHtml(p, today){
  today = today || localDateStr();
  var win = householdYearWindow();
  var r = rentSummary(p, { start: win.start, end: today < win.end ? today : win.end }, state.incomeLog);
  var reviews = r.reviews.slice(0, 3).map(function(rv){
    return '<li>' + escapeAttr(rv.date) + ': ' + fmtCurrency0.format(rv.from) + ' → ' + fmtCurrency0.format(rv.to) + ' ' + escapeAttr(String(rv.freq || "").toLowerCase()) + (rv.change != null ? ' (' + (rv.change >= 0 ? "+" : "") + Math.round(rv.change * 1000) / 10 + '%)' : '') + '</li>';
  }).join("");
  var vac = (p.vacancies || []).map(function(v, i){
    return '<li>' + escapeAttr(fmtDate(v.from)) + ' – ' + escapeAttr(v.to ? fmtDate(v.to) : "now") + ' <button type="button" class="btn btn-ghost btn-sm" data-vac-del="' + i + '" aria-label="Remove this vacancy">✕</button></li>';
  }).join("");
  var row = (p.income || [])[0];
  return '<div class="rentp"><div class="property-section-title">Rent — ' + escapeAttr(win.label) + (today < win.end ? ' so far' : '') + '</div>' +
    '<div class="rentp-figs"><div><span>Expected</span><b>' + fmtCurrency0.format(r.expected) + '</b><small>' + (r.vacancyWeeks ? r.vacancyWeeks + ' weeks vacant' : 'no vacancy recorded') + '</small></div>' +
      '<div><span>Received</span><b>' + fmtCurrency0.format(r.received) + '</b><small>logged as money in</small></div>' +
      (r.received ? '<div><span>Difference</span><b class="' + (r.gap >= -1 ? "up" : "down") + '">' + (r.gap < 0 ? "−" : "+") + fmtCurrency0.format(Math.abs(r.gap)) + '</b><small>' + (r.gap < -1 ? "less than expected" : "on or above") + '</small></div></div>'
        : '<div><span>Difference</span><b>—</b><small>log rent as it arrives (Cash flow → Income)</small></div></div>') +
    '<div class="rentp-grid">' +
      '<label class="cf-filter"><span>Next rent review</span><input type="date" data-rent-next value="' + escapeAttr(r.nextReview) + '"></label>' +
      (row ? '<div class="rentp-review"><label class="cf-filter"><span>Record a review — new rent ' + escapeAttr(String(row.freq || "").toLowerCase()) + '</span><input type="number" min="0" step="1" data-rent-new placeholder="' + (Number(row.amount) || 0) + '"></label>' +
        '<button type="button" class="btn btn-sm" data-rent-review>Record</button></div>' : '') +
      '<div class="rentp-vac"><span class="cf-filter-l">Vacancies</span>' + (vac ? '<ul>' + vac + '</ul>' : '<p class="ledger-note" style="margin:0">None recorded.</p>') +
        '<div class="rentp-vac-add"><input type="date" data-vac-from aria-label="Vacant from"><input type="date" data-vac-to aria-label="Vacant until (blank if still vacant)"><button type="button" class="btn btn-sm btn-ghost" data-vac-add>Add</button></div></div>' +
    '</div>' + (reviews ? '<div class="rentp-reviews"><span class="cf-filter-l">Past reviews</span><ul>' + reviews + '</ul></div>' : '') +
    agentStatementHtml(p, win) + '</div>';
}

// v3.79.0: a property manager's monthly statement, entered once (calc/agentstatement.js).
export var agentStatementUi = { open: {} };
function agentStatementHtml(p, win){
  var fy = financialYearOf(win.end < localDateStr() ? win.end : localDateStr());
  var sum = statementsForFy(p, fy);
  var costLines = (p.expenses || []).filter(function(e){ return !e.computed && e.id; });
  var water = waterRatesLine(p);
  var recent = (p.agentStatements || []).slice(-4).reverse().map(function(r){
    return '<li><span>' + escapeAttr(r.date) + '</span> <span>rent ' + fmtCurrency0.format(r.rent) + (r.water ? ' + water ' + fmtCurrency0.format(r.water) : '') + ' · out ' + fmtCurrency0.format(statementTotals(r).moneyOut) + '</span> <b>' + fmtCurrency2.format(r.net) + '</b>' +
      ' <button type="button" class="btn btn-ghost btn-sm" data-as-del="' + escapeAttr(r.id) + '" aria-label="Remove this statement">✕</button></li>';
  }).join("");
  var field = function(key, label, extra){ return '<label class="fr-field"><span>' + label + '</span><input type="number" inputmode="decimal" min="0" step="0.01" data-as="' + key + '"' + (extra || "") + '></label>'; };
  var accounts = (state.accounts || []).map(function(a){ return a.name; });
  var defAcct = (p.income && p.income[0] && p.income[0].account) || "";
  return '<details class="agent-stmt"' + (agentStatementUi.open[p.id] ? ' open' : '') + ' data-as-panel="' + escapeAttr(p.id) + '"><summary>Log a property manager statement</summary>' +
    '<p class="ledger-note">One statement in one go: what was collected, what was paid out of it, and what reached you. Rent received and any bills paid from the rent are logged for you.</p>' +
    '<p class="agent-pdf"><label class="btn btn-sm btn-ghost">Fill from the statement PDF<input type="file" accept=".pdf,application/pdf" data-as-pdf hidden></label></p>' +
    '<div class="agent-grid">' +
      '<label class="fr-field"><span>Statement date</span><input type="date" data-as="date" value="' + escapeAttr(localDateStr()) + '"></label>' +
      field("rent", "Rent collected $") + field("water", "Water usage recovered $") +
      field("fees", "Management + statement fees $") + field("waterRates", "Water rates paid $", water ? '' : ' title="No water line on this property — it will be logged without one"') +
      field("otherAmount", "Other cost paid $") +
      '<label class="fr-field"><span>Other cost is for</span><select data-as="otherLine">' + costLines.map(function(e){ return '<option value="' + escapeAttr(e.id) + '">' + escapeAttr(e.what) + '</option>'; }).join("") + '</select></label>' +
      '<label class="fr-field"><span>Paid into</span><select data-as="account"><option value="">—</option>' + accounts.map(function(a){ return '<option' + (a === defAcct ? ' selected' : '') + '>' + escapeAttr(a) + '</option>'; }).join("") + '</select></label>' +
    '</div>' +
    '<div class="agent-foot"><span>Paid to you <b data-as-net>$0.00</b></span><button type="button" class="btn btn-sm btn-primary" data-as-log>Log statement</button></div>' +
    (sum.count ? '<p class="agent-sum">' + escapeAttr(fyLabel(fy)) + ' from ' + sum.count + ' statement' + (sum.count === 1 ? '' : 's') + ': rent ' + fmtCurrency0.format(sum.rent) + ' · water back ' + fmtCurrency0.format(sum.water) + ' · fees ' + fmtCurrency0.format(sum.fees) + ' · bills paid ' + fmtCurrency0.format(sum.waterRates + sum.other) + ' · to you ' + fmtCurrency0.format(sum.net) + '</p>' : '') +
    (recent ? '<ul class="agent-list">' + recent + '</ul>' : '') +
  '</details>';
}
// The live "paid to you" figure while the form is filled in.
export function agentStatementFormValues(panel){
  var v = function(k){ var el = panel.querySelector('[data-as="' + k + '"]'); return el ? el.value : ""; };
  var others = Number(v("otherAmount")) > 0 ? [{ lineId: v("otherLine"), amount: Number(v("otherAmount")), what: "" }] : [];
  return { date: v("date") || localDateStr(), rent: Number(v("rent")) || 0, water: Number(v("water")) || 0, fees: Number(v("fees")) || 0,
    waterRates: Number(v("waterRates")) || 0, others: others, account: v("account") };
}

// ---------------- Tabs on a property (v3.61.0) ----------------
// A property card had nine collapsible sections stacked one after another — value, purchase costs,
// ownership, depreciation, loans, strategy, income, expenses, sale — so finding the loans meant
// scrolling past the depreciation schedule. The summary stays on top; the rest is five tabs.
// Session-only, per property.
export var propertyTabs = {};
export function propertyTabsFor(p){
  var t = [{ key: "overview", label: "Overview" }, { key: "loans", label: "Loans" }, { key: "income", label: "Income & costs" }];
  if(p.kind === "IP") t.push({ key: "tax", label: "Tax" }, { key: "sale", label: "Sale" });
  return t;
}
export function propertyTabShown(p){
  var k = propertyTabs[p.id];
  return propertyTabsFor(p).some(function(t){ return t.key === k; }) ? k : "overview";
}
function propertyTabBarHtml(p, tabs, current){
  return '<div class="subnav prop-tabs" role="tablist" aria-label="' + escapeAttr(p.what || "Property") + ' sections">' + tabs.map(function(t){
    var on = t.key === current;
    return '<button type="button" class="subnav-item' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" data-prop-tab="' + escapeAttr(p.id) + '" data-tab="' + t.key + '">' + t.label + '</button>';
  }).join("") + '</div>';
}
// The Tax tab's lead: this year's rental result line by line, then each owner's share and roughly
// what it does to their tax.
export function propertyTaxTabHtml(p){
  var b = propertyTaxResultBreakdown(p);
  var people = getTaxPeople();
  var owners = people.map(function(person){
    var pct = propertyOwnershipPct(p, person, people);
    if(!pct) return "";
    var share = b.net * pct / 100;
    var rate = 0;
    try { rate = (computePersonTax(person).marginalRate || 0) + 0.02; } catch(e){ rate = 0; }
    return '<div class="ptx-row"><span>' + escapeAttr(person) + ' (' + pct + '%)</span><b>' + (share < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(share)) + '</b>' +
      '<em>' + (share < 0 ? "about " + fmtCurrency0.format(Math.abs(share) * rate) + " less tax" : share > 0 ? "about " + fmtCurrency0.format(share * rate) + " more tax" : "") + '</em></div>';
  }).join("");
  return '<div class="ptx"><div class="property-section-title">' + escapeAttr(householdYearWindow().label) + ' rental result</div>' +
    b.rows.filter(function(r){ return Math.abs(r.amount) >= 0.5; }).map(function(r){
      return '<div class="ptx-row"><span>' + r.label + '</span><b>' + (r.amount < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(r.amount)) + '</b><em></em></div>';
    }).join("") +
    '<div class="ptx-row ptx-total"><span>' + (b.net < 0 ? "Net rental loss" : "Net rental income") + '</span><b>' + (b.net < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(b.net)) + '</b><em></em></div>' +
    (owners ? '<div class="property-section-title" style="margin-top:10px">Each owner\'s share</div>' + owners : '') +
    '<p class="ledger-note" style="margin:6px 0 0">From the plan for the year; Tax → Returns has the year as lodged. The tax effect is at each person\'s marginal rate plus Medicare.</p></div>';
}
function propertyCardHtml(p, colorIdx){
  var equity = propertyEquityToday(p);
  var hasPmFee = p.kind === "IP";
  var pmFeePanel = hasPmFee
    ? '<div class="proj-controls prop-pmfee-panel">' +
        '<div class="proj-field" title="Applied to this property\'s Property Manager Fee expense row, worked out from its own rent — each property manager can charge a different rate"><label>PM fee % of rent</label><input type="number" min="0" max="100" step="0.1" class="prop-pmfee-percent" aria-label="Property manager fee, % of rent" value="' + (Number(p.pmFee.percent) || 0) + '"></div>' +
        '<div class="proj-field"><label>+ flat $/month</label><input type="number" min="0" step="0.5" class="prop-pmfee-flat" aria-label="Property manager flat fee per month" value="' + (Number(p.pmFee.flat) || 0) + '"></div>' +
      '</div>'
    : "";
  // Purely informational — the amount/frequency on each income row below is still the rate used
  // for every calculation (gearing, cash flow, projections), same as it's always been. This just
  // notes that the actual cash doesn't necessarily land on that same cadence — a weekly-quoted
  // rent is still commonly paid out as one monthly lump sum by a property manager, and that's
  // worth knowing when looking at the numbers, even though it changes nothing about them. Shown
  // unconditionally, even with no income rows yet, rather than gated on p.income.length — adding
  // the first row goes through rerenderTableFor's partial rebuild of just the row list, which
  // wouldn't retroactively reveal a panel that lives outside that container.
  var incomePaidPanel =
    '<div class="proj-controls prop-income-paid-panel">' +
      '<div class="proj-field" title="Doesn\'t change any calculation below — the amount/frequency on each row is still the rate used for planning. This just notes when the money actually lands, e.g. a property manager batching weekly-quoted rent into one monthly payout."><label>Actually received</label><select class="prop-income-paid-freq" aria-label="How often income from this property actually arrives">' + optionsHtml(PAYMENT_FREQS, p.incomePaidFreq || "Monthly") + '</select></div>' +
    '</div>';
  var gearingBadge = "";
  var yieldBadge = "";
  var lvrBadge = "";
  var mortgageBalance = (p.loans || []).reduce(function(s, l){ return s + loanBalance(l); }, 0);
  // Unlike gearing/yield (IP-only — a PPOR has no rent to gear or yield on), LVR is meaningful for
  // any mortgaged property, so this isn't gated on p.kind. Flagged (brass/warning, same treatment
  // as negative gearing) above 80%, the threshold where a lender would charge LMI on any new
  // borrowing against this property — informational only, doesn't imply LMI is currently owed.
  var lvr = propertyLVR(p);
  if(lvr != null){
    var lvrOverThreshold = lvr > 0.8;
    lvrBadge = '<span class="gearing-badge ' + (lvrOverThreshold ? "negative" : "neutral") + '" data-badge="lvr" title="Loan balance ÷ current value' +
      (lvrOverThreshold ? " — above 80% typically triggers Lenders Mortgage Insurance on any new borrowing against this property" : "") +
      '">' + fmtPercent1.format(lvr) + ' LVR</span>';
  }
  if(p.kind === "IP"){
    var gearing = propertyGearingAnnual(p);
    var isPositive = gearing >= 0;
    gearingBadge = '<span class="gearing-badge ' + (isPositive ? "positive" : "negative") + '" data-badge="gearing" title="Rent minus expenses and loan repayments, per year (' + fmtCurrency0.format(gearing) + '/yr). ' +
      (isPositive ? "Positively geared — the property earns more than it costs to hold." : "Negatively geared — the property costs more to hold than it earns, a common tax strategy.") +
      '">' + (isPositive ? "Positively geared" : "Negatively geared") + '</span>';
    if(Number(p.value) > 0){
      var grossYield = sumField(p.income, "yearly") / Number(p.value);
      yieldBadge = '<span class="gearing-badge neutral" data-badge="yield-value" title="Annual rent ÷ current property value">' + fmtPercent1.format(grossYield) + ' gross yield</span>';
    }
    var yieldOnCost = propertyYieldOnCost(p);
    if(yieldOnCost != null){
      yieldBadge += '<span class="gearing-badge neutral" data-badge="yield-cost" title="Annual rent ÷ what you paid — how your original investment is performing, as opposed to gross yield\'s \'would this be a good buy at today\'s price\'">' + fmtPercent1.format(yieldOnCost) + ' yield on cost</span>';
    }
  }
  var usableEquity = Math.max(0, (Number(p.value) || 0) * 0.8 - mortgageBalance);
  var loanRepaymentMonthlyTotal = propertyLoanRepaymentMonthly(p);
  var capitalGain = propertyCapitalGain(p);
  var netCashFlowMonthly = p.kind === "IP" ? propertyGearingAnnual(p) / 12 : null;

  // All seven possible stat tiles, keyed so the primary row (always visible) and the "More
  // detail" row (collapsed by default) can each pull a distinct subset without duplicating any
  // tile's markup — a mobile card showing all seven flat used to be ~450px of numbers before any
  // actual editable content, the single biggest contributor to the page's mobile scroll length.
  var allTiles = {
    valuation: propertyStatTileHtml("valuation", "Valuation", fmtCurrency0.format(Number(p.value) || 0), {
      extraHtml: '<span data-out-spark="valuation">' + (sparklineHtml(p.history) || sparklinePlaceholderHtml()) + '</span>'
    }),
    netequity: propertyStatTileHtml("netequity", "Net equity", fmtCurrency0.format(equity), { emph: true }),
    mortgagebalance: propertyStatTileHtml("mortgagebalance", "Mortgage balance", fmtCurrency0.format(mortgageBalance)),
    loanrepayment: propertyStatTileHtml("loanrepayment", "Loan repayment", fmtCurrency0.format(loanRepaymentMonthlyTotal) + "/mo", { title: "Combined across every loan below, each converted to a monthly figure regardless of how it's individually displayed." }),
    usableequity: propertyStatTileHtml("usableequity", "Usable equity", fmtCurrency0.format(usableEquity), { title: "What you could borrow against this property, up to 80% LVR, without triggering LMI — based on its balance, not netted against any offset (that's a separate liquid asset, not more borrowing capacity)." })
  };
  if(capitalGain){
    allTiles.capitalgain = propertyStatTileHtml("capitalgain", "Capital gain",
      (capitalGain.gain >= 0 ? "+" : "") + fmtCurrency0.format(capitalGain.gain) + ' (' + (capitalGain.gain >= 0 ? "+" : "") + fmtPercent1.format(capitalGain.pct) + ')',
      { title: capitalGainTitle(p, capitalGain), color: capitalGain.gain >= 0 ? "var(--good)" : "var(--bad)" });
  }
  if(netCashFlowMonthly != null){
    allTiles.cashflow = propertyStatTileHtml("cashflow", "Net cash flow",
      (netCashFlowMonthly >= 0 ? "+" : "") + fmtCurrency0.format(netCashFlowMonthly) + '/mo',
      { color: netCashFlowMonthly < 0 ? "var(--bad)" : "var(--good)" });
  }
  // Third primary tile: whichever of "how this property is doing right now" is most relevant —
  // net cash flow for an IP (is it costing or earning money this month), capital gain for a PPOR
  // with a known purchase price, usable equity as the fallback when neither applies yet.
  var thirdPrimaryKey = allTiles.cashflow ? "cashflow" : (allTiles.capitalgain ? "capitalgain" : "usableequity");
  var primaryKeys = ["valuation", "netequity", thirdPrimaryKey];
  var primaryTiles = primaryKeys.map(function(k){ return allTiles[k]; }).join("");
  var moreTiles = Object.keys(allTiles).filter(function(k){ return primaryKeys.indexOf(k) === -1; }).map(function(k){ return allTiles[k]; }).join("");

  var allSectionsCollapsed = PROPERTY_SECTION_KEYS.every(function(k){ return !!(p.sectionsCollapsed && p.sectionsCollapsed[k]); });
  var tabs = propertyTabsFor(p);
  var current = propertyTabShown(p);
  var panel = function(key, html){ return '<div class="prop-tab-panel" data-prop-panel="' + key + '"' + (key === current ? "" : " hidden") + ' role="tabpanel">' + html + '</div>'; };

  return '<div class="property-card series-color-' + (colorIdx % 8) + '" data-property-id="' + escapeAttr(p.id) + '" id="property-card-' + escapeAttr(p.id) + '">' +
    '<div class="property-card-head">' +
      '<h4><input type="text" class="prop-what" value="' + escapeAttr(p.what) + '" aria-label="Property name">' +
      '<select class="prop-kind" aria-label="Property kind">' + optionsHtml(["IP", "PPOR"], p.kind) + '</select></h4>' +
      '<button type="button" class="btn btn-ghost btn-sm row-del property-del-btn" data-property-del="' + escapeAttr(p.id) + '" aria-label="Delete property">✕</button>' +
    '</div>' +
    (lvrBadge || gearingBadge || yieldBadge ? '<div class="property-card-badges">' + lvrBadge + gearingBadge + yieldBadge + '</div>' : '') +
    '<div class="calc-outputs">' + primaryTiles + '</div>' +
    // v3.34.1: More detail and Expand/Collapse all share one row — the button had a row of its own,
    // right-aligned under an empty stretch, between the tiles and the first section.
    '<div class="property-card-tools">' +
      (moreTiles ? '<details class="tax-advanced m-more-options property-stats-more"><summary>More detail</summary><div class="calc-outputs" style="margin-top:10px">' + moreTiles + '</div></details>' : '<span></span>') +
      '<button type="button" class="btn btn-ghost btn-sm property-collapse-btn" data-prop-collapse-toggle="' + escapeAttr(p.id) + '">' + (allSectionsCollapsed ? "Expand all" : "Collapse all") + '</button>' +
    '</div>' +
    propertyTabBarHtml(p, tabs, current) +
    panel("overview", propertySectionHtml(p, "value",
      '<div class="property-section-title">Property value</div>',
      '<div class="calc-grid">' +
        '<div class="calc-field"><label>Current value</label><input type="number" step="1000" min="0" class="prop-value" aria-label="Current value" value="' + (Number(p.value) || 0) + '"></div>' +
        '<div class="calc-field" title="What you actually paid — separate from Current value above, and from the Log button\'s value-over-time history, which starts whenever this property was first added rather than the real purchase date. Powers Capital gain and the yield-on-cost badge above; leave blank if unknown."><label>Purchase price</label><input type="number" step="1000" min="0" class="prop-purchase-price" value="' + (p.purchasePrice != null ? p.purchasePrice : "") + '" placeholder="Unknown"></div>' +
        '<div class="calc-field"><label>Purchase date</label><input type="date" class="prop-purchase-date" aria-label="Purchase date" value="' + escapeAttr(p.purchaseDate || "") + '"></div>' +
      '</div>' +
      landTaxFieldsHtml(p) +
      '<div class="prop-value-log"><button type="button" class="btn btn-sm" data-property-log="' + escapeAttr(p.id) + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart">Record today\'s value</button>' + historyTrendHtml(p) + '</div>') +
    acquisitionCostsSectionHtml(p)  +
    (p.kind === "IP" ? ownershipSectionHtml(p) : "") ) +
    panel("loans", propertySectionHtml(p, "loans",
      '<div class="property-section-title">Loans</div>',
      '<div class="m-card" id="propLoanRows_' + escapeAttr(p.id) + '">' + modernLoanListHtml(p) + '</div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-loan-add="' + escapeAttr(p.id) + '">+ Add loan</button>' +
      '<div data-fixed-panel="' + escapeAttr(p.id) + '">' + fixedExpiryHtml(p) + '</div>') +
    ((p.loans || []).length ? propertySectionHtml(p, "strategy",
      '<div class="property-section-title">Loan strategy</div>',
      '<div class="ls-wrap" data-strategy-property="' + escapeAttr(p.id) + '">' + loanStrategyHtml(p) + '</div>') : "")) +
    panel("income", (p.kind === "IP" ? '<div data-rent-panel="' + escapeAttr(p.id) + '">' + rentPanelHtml(p) + '</div>' : '') + propertySectionHtml(p, "income",
      '<div class="property-section-title">Income</div>',
      incomePaidPanel +
      '<div class="m-card"><div class="m-rows" id="propIncomeRows_' + escapeAttr(p.id) + '">' + modernPropListHtml(p.income, "propinc:" + p.id, false) + '</div></div>' +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propinc:' + escapeAttr(p.id) + '">+ Add income</button>') +
    propertySectionHtml(p, "expenses",
      '<div class="property-section-title">Expenses</div>',
      pmFeePanel +
      '<div class="m-card"><div class="m-rows" id="propExpRows_' + escapeAttr(p.id) + '">' + modernPropListHtml(p.expenses, "propexp:" + p.id, true) + '</div></div>' +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propexp:' + escapeAttr(p.id) + '">+ Add expense</button>' +
      (p.kind === "IP" ? claimedHereHtml(p) : ""))) +
    (p.kind === "IP" ? panel("tax", propertyTaxTabHtml(p) + (p.kind === "IP" ? depreciationSectionHtml(p) : "")) : "") +
    (p.kind === "IP" ? panel("sale", (p.kind === "IP" ? propertySectionHtml(p, "sale",
      '<div class="property-section-title">If you sold</div>',
      '<div class="sale-body" data-sale-property="' + escapeAttr(p.id) + '">' + saleWhatIfHtml(p, saleWhatIfData(p)) + '</div>') : "")) : "") +
  '</div>';
}
// Budget lines paid from the household budget but claimed against this property (v3.45.0). They're
// on its rental schedule and in its tax result, not in its cash flow — this says so, so the card's
// figures don't look like they've lost a cost.
export function claimedHereHtml(p, items){
  var lines = propertyClaimLines(p.id, items);
  if(!lines.length) return "";
  var total = lines.reduce(function(s, i){ return s + rowDeductionAnnual(i); }, 0);
  return '<p class="ledger-note prop-claimed-here" style="margin:10px 0 0">Also claimed here from your budget: ' +
    lines.map(function(i){ return '<b>' + escapeAttr(i.what || "Line") + '</b> ' + fmtCurrency0.format(rowDeductionAnnual(i)) + '/yr'; }).join(", ") +
    (lines.length > 1 ? ' (' + fmtCurrency0.format(total) + ' in all)' : '') +
    ' — on the rental schedule and in this property\'s tax result, paid from the household budget.</p>';
}
export function setSaleWhatIfField(p, field, value){
  if(!p.saleWhatIf || typeof p.saleWhatIf !== "object") p.saleWhatIf = {};
  if(value === "" || value == null) delete p.saleWhatIf[field];
  else p.saleWhatIf[field] = field === "date" ? value : Number(value);
  persist();
}
// Re-renders just the section body, so typing in one field doesn't rebuild the card.
export function patchSaleWhatIf(p){
  var el = document.querySelector('[data-sale-property="' + p.id + '"]');
  if(!el) return;
  var focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-sale-field") : null;
  el.innerHTML = saleWhatIfHtml(p, saleWhatIfData(p));
  if(focused){ var f = el.querySelector('[data-sale-field="' + focused + '"]'); if(f) f.focus(); }
}

// Session-only (not persisted) — mirrors modernIncomeRowOpen/modernSharedRowOpen, shared across
// every property's income and expense lists (the section string, e.g. "propexp:<id>", already
// makes each property's keys unique within this one map).
export var modernPropRowOpen = {};
function modernPropListHtml(items, section, showClass){
  // An expense row gets the Category field an income row doesn't: an IP's costs are budget lines
  // on the Expenses page now, and they'd be the only ones you couldn't categorise from the page
  // that owns them. Passed off state.categories so both ends offer the same list.
  var opts = { showClass: showClass, showLog: true };
  if(showClass) opts.categories = state.categories;
  return items.map(function(item, i){ return modernPlainRowHtml(item, i, section, modernPropRowOpen, opts); }).join("");
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

// ---------------- Portfolio-wide overview (stat tiles, equity/debt bar, compare list) ----------------
// Reuses the same tax-waterfall-bar/-legend component assets.js's own Allocation panel already
// built (colored proportional bar + a legend row per segment) — same visual language, just two
// segments (Equity vs Debt) instead of asset categories.
function propertiesEquityDebtBarHtml(){
  var segs = [
    { key: "Equity", value: propertiesTotalEquityToday(), colorClass: "series-color-2" },
    { key: "Debt", value: propertiesTotalMortgageBalance(), colorClass: "series-color-7" }
  ];
  var visible = segs.filter(function(s){ return s.value > 0; });
  if(!visible.length) return '<p class="ledger-note" style="margin:0">Add a property to see this.</p>';
  var whole = visible.reduce(function(s, x){ return s + x.value; }, 0);
  var bar = visible.map(function(s){
    return '<div class="tax-waterfall-seg ' + s.colorClass + '" style="flex:' + s.value + ' 1 0%" title="' + s.key + ': ' + fmtCurrency0.format(s.value) + ' (' + fmtPercent1.format(whole > 0 ? s.value / whole : 0) + ')"></div>';
  }).join("");
  var legend = visible.map(function(s){
    return '<div class="tax-waterfall-item"><span class="proj-swatch ' + s.colorClass + '"></span><div class="tax-waterfall-item-text"><span class="tax-waterfall-item-label">' + s.key + '</span><span class="tax-waterfall-item-value">' + fmtCurrency0.format(s.value) + '</span></div></div>';
  }).join("");
  return '<div class="tax-waterfall-bar">' + bar + '</div><div class="tax-waterfall-legend">' + legend + '</div>';
}
export function renderPropertiesSummary(){
  var statsEl = document.getElementById("propertiesSummaryStats");
  if(statsEl){
    if(!state.properties.length){
      statsEl.innerHTML = "";
    } else {
      var netCashFlow = propertiesNetCashFlowMonthly();
      var weightedYield = propertiesWeightedGrossYield();
      statsEl.innerHTML =
        '<div class="stat-tile"><span>Total value</span><b>' + fmtCurrency0.format(propertiesTotalValue()) + '</b><small>across ' + state.properties.length + ' propert' + (state.properties.length === 1 ? "y" : "ies") + '</small></div>' +
        '<div class="stat-tile" title="Value minus what\'s owed after the offset — matches each card\'s own Net equity tile, summed across the portfolio"><span>Total equity</span><b>' + fmtCurrency0.format(propertiesTotalEquityToday()) + '</b><small>' + (propertiesOffsetTotal() > 0 ? "incl. " + fmtCurrency0.format(propertiesOffsetTotal()) + " in offset" : "value less loans") + '</small></div>' +
        '<div class="stat-tile"><span>Total mortgage</span><b>' + fmtCurrency0.format(propertiesTotalMortgageBalance()) + '</b><small>across every loan</small></div>' +
        '<div class="stat-tile" title="Rent minus expenses and loan repayments, across every investment property"><span>Net cash flow</span><b style="color:' + (netCashFlow < 0 ? "var(--bad)" : "var(--good)") + '">' + (netCashFlow >= 0 ? "+" : "") + fmtCurrency0.format(netCashFlow) + '/mo</b><small>investment properties</small></div>' +
        '<div class="stat-tile" title="Annual rent ÷ value, weighted by each investment property\'s own value"><span>Avg gross yield</span><b>' + (weightedYield != null ? fmtPercent1.format(weightedYield) : "—") + '</b><small>investment properties</small></div>';
    }
  }
  var barEl = document.getElementById("propertiesEquityDebtBar");
  if(barEl) barEl.innerHTML = propertiesEquityDebtBarHtml();
}

// "Total property value over time" — the properties-only counterpart to Assets' Net worth over
// time chart (renderPortfolioHistoryChart), same reconstruction approach: at each date any
// property was logged on, take every property's most-recent logged value at-or-before that date
// (falling back to its current value only on today's synthetic point, for a property that's
// never been logged). Deliberately gross value, not net of loans — the Equity vs debt bar above
// already covers the net point-in-time view; this tracks the honestly-available time series
// (property.history[] snapshots), which is only ever a value log, not a loan-balance log.
export function renderPropertiesValueHistoryChart(){
  var container = document.getElementById("propertiesValueHistoryPanel");
  if(!container) return;
  var dateSet = {};
  state.properties.forEach(function(p){ (p.history || []).forEach(function(h){ dateSet[h.date] = true; }); });
  var dates = Object.keys(dateSet).sort();
  var today = localDateStr();
  if(dates.indexOf(today) === -1) dates.push(today);

  if(dates.length < 2){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">Log a value for at least one property (the "Log" button under Property value) on two occasions to start tracking total property value over time.</p>';
    return;
  }

  function valueAtDate(history, currentValue, d){
    if(!history || !history.length) return d === today ? (Number(currentValue) || 0) : 0;
    var atOrBefore = history.filter(function(h){ return h.date <= d; });
    if(!atOrBefore.length) return 0;
    return atOrBefore[atOrBefore.length - 1].value;
  }
  var points = dates.map(function(d){
    var total = state.properties.reduce(function(s, p){ return s + valueAtDate(p.history, p.value, d); }, 0);
    return { x: new Date(d + "T00:00:00").getTime(), y: total, dateLabel: d };
  });

  container.innerHTML = "";
  var chartDiv = document.createElement("div");
  container.appendChild(chartDiv);
  renderLineChart(chartDiv, [{ label: "Total property value", colorClass: "series-color-1", points: points }], {
    height: 220,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: dateAxisFormat(points),
    xTickCount: Math.min(7, Math.max(2, dates.length)),
    ariaLabel: "Total property value over time",
    baseline: "auto",
    // Logged valuations, so held until the next one — a diagonal between two revaluations draws a
    // house appreciating day by day, which is not something anybody measured.
    stepped: true,
    alwaysLegend: false
  });
}

// A compact comparison row per property (value/equity/yield) that doubles as jump-nav to its
// card below — only worth showing once there's actually more than one property to compare/jump
// between; a single property has nowhere to jump to and nothing to compare against.
function propertiesCompareListHtml(){
  if(state.properties.length < 2) return "";
  var rows = state.properties.map(function(p, idx){
    var equity = propertyEquityToday(p);
    var yieldOnCost = p.kind === "IP" && Number(p.value) > 0 ? sumField(p.income, "yearly") / Number(p.value) : null;
    return '<button type="button" class="property-compare-row series-color-' + (idx % 8) + '" data-jump-property="' + escapeAttr(p.id) + '">' +
      '<span class="m-row-dot series-color-' + (idx % 8) + '" aria-hidden="true"></span>' +
      '<span class="property-compare-name">' + escapeAttr(p.what) + '</span>' +
      '<span class="property-compare-stat">' + fmtCurrency0.format(Number(p.value) || 0) + '</span>' +
      '<span class="property-compare-stat">' + fmtCurrency0.format(equity) + ' equity</span>' +
      (yieldOnCost != null ? '<span class="property-compare-stat">' + fmtPercent1.format(yieldOnCost) + ' yield</span>' : '') +
    '</button>';
  }).join("");
  return '<div class="property-compare-list">' + rows + '</div>';
}

export function renderProperties(){
  var container = document.getElementById("propertiesBody");
  if(!container) return;
  container.innerHTML = state.properties.length
    ? state.properties.map(function(p, idx){ return propertyCardHtml(p, idx); }).join("")
    : '<p class="ledger-note" style="margin:0">No properties yet — add one below to start tracking its value, loans, and (for an investment property) rent and expenses.</p>';
  renderPropertyExpensesSummary();
  renderPropertiesSummary();
  renderPropertiesValueHistoryChart();
  var compareEl = document.getElementById("propertiesCompareList");
  if(compareEl) compareEl.innerHTML = propertiesCompareListHtml();
}

export function patchPropertyCardComputed(property){
  var card = document.querySelector('.property-card[data-property-id="' + CSS.escape(property.id) + '"]');
  if(!card) return;
  var equity = propertyEquityToday(property);
  var mortgageBalance = (property.loans || []).reduce(function(s, l){ return s + loanBalance(l); }, 0);
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
    var suffix = PAYMENT_FREQ_SUFFIX[disp.freq] || "/mo";
    var note = row.querySelector(".loan-repayment-cell .computed-note");
    if(note) note.textContent = fmtCurrency0.format(disp.amount) + suffix;
    var headlineAmt = row.querySelector('[data-computed="amt"]');
    if(headlineAmt) headlineAmt.textContent = fmtCurrency2.format(disp.amount) + suffix;
    var sub = row.querySelector('[data-computed="sub"]');
    if(sub){
      var rateDisplay = Math.round((Number(loan.rate) || 0) * 100) / 100;
      sub.textContent = (loanPaidOut(loan) ? "paid out " + loan.endedOn + " · " : "") + fmtCurrency0.format(Number(loan.balance) || 0) + " balance · " + rateDisplay + "% · " + loan.repaymentType + " · paid " + disp.freq.toLowerCase() + (loan.repaymentMode === "manual" ? " (manual)" : "");
    }
  });
  var loanBarWrap = card.querySelector('#propLoanRows_' + CSS.escape(property.id) + ' [data-comp-bar]');
  if(loanBarWrap) loanBarWrap.outerHTML = modernLoanCompBarHtml(loanRowMeta(property));
  var gearBadge = card.querySelector('[data-badge="gearing"]');
  if(gearBadge && property.kind === "IP"){
    var gearing = propertyGearingAnnual(property);
    var isPositive = gearing >= 0;
    gearBadge.className = "gearing-badge " + (isPositive ? "positive" : "negative");
    gearBadge.textContent = isPositive ? "Positively geared" : "Negatively geared";
    gearBadge.title = "Rent minus expenses and loan repayments, per year (" + fmtCurrency0.format(gearing) + "/yr). " +
      (isPositive ? "Positively geared — the property earns more than it costs to hold." : "Negatively geared — the property costs more to hold than it earns, a common tax strategy.");
  }
  var lvrBadgeOut = card.querySelector('[data-badge="lvr"]');
  if(lvrBadgeOut){
    var lvrNow = propertyLVR(property);
    if(lvrNow != null){
      var lvrOverThresholdNow = lvrNow > 0.8;
      lvrBadgeOut.className = "gearing-badge " + (lvrOverThresholdNow ? "negative" : "neutral");
      lvrBadgeOut.textContent = fmtPercent1.format(lvrNow) + " LVR";
      lvrBadgeOut.title = "Loan balance ÷ current value" + (lvrOverThresholdNow ? " — above 80% typically triggers Lenders Mortgage Insurance on any new borrowing against this property" : "");
    }
  }
  var yieldBadge = card.querySelector('[data-badge="yield-value"]');
  if(yieldBadge && property.kind === "IP" && Number(property.value) > 0){
    var grossYield = sumField(property.income, "yearly") / Number(property.value);
    yieldBadge.textContent = fmtPercent1.format(grossYield) + " gross yield";
  }
  var yieldCostBadge = card.querySelector('[data-badge="yield-cost"]');
  if(yieldCostBadge && property.kind === "IP"){
    var yieldOnCost = propertyYieldOnCost(property);
    if(yieldOnCost != null) yieldCostBadge.textContent = fmtPercent1.format(yieldOnCost) + " yield on cost";
  }
  var capitalGainOut = card.querySelector('[data-out="capitalgain"]');
  if(capitalGainOut){
    var capitalGain = propertyCapitalGain(property);
    if(capitalGain){
      capitalGainOut.textContent = (capitalGain.gain >= 0 ? "+" : "") + fmtCurrency0.format(capitalGain.gain) + " (" + (capitalGain.gain >= 0 ? "+" : "") + fmtPercent1.format(capitalGain.pct) + ")";
      capitalGainOut.style.color = capitalGain.gain >= 0 ? "var(--good)" : "var(--bad)";
      var capitalGainTile = capitalGainOut.closest(".calc-out");
      if(capitalGainTile) capitalGainTile.title = capitalGainTitle(property, capitalGain);
    }
  }
  var acqCostsTotalOut = card.querySelector('[data-out="acqcoststotal"]');
  if(acqCostsTotalOut){
    var acqTotal = (property.acquisitionCosts || []).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
    acqCostsTotalOut.textContent = acqTotal > 0 ? "— " + fmtCurrency0.format(acqTotal) + " total" : "";
  }
  renderPropertyExpensesSummary();
  renderPropertiesSummary();
  var compareEl = document.getElementById("propertiesCompareList");
  if(compareEl) compareEl.innerHTML = propertiesCompareListHtml();
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

// Moves one acquisition cost onto a loan's borrowing costs (v3.28.0). Goes to the only loan, or the
// first one with an earlier settlement date when there are several — the toast names it, and undo
// puts everything back. A loan with no settlement date takes the purchase date, which is when the
// loan was almost always drawn; the five-year spread can't start without one.
export function moveAcquisitionCostToLoan(p, index){
  var cost = (p.acquisitionCosts || [])[index];
  var loans = p.loans || [];
  if(!cost || !loans.length) return null;
  var loan = loans.slice().sort(function(a, b){ return (a.settlementDate || "9999").localeCompare(b.settlementDate || "9999"); })[0];
  var before = { costs: p.acquisitionCosts.slice(), borrowing: Number(loan.borrowingCosts) || 0, settled: loan.settlementDate || "" };
  p.acquisitionCosts.splice(index, 1);
  loan.borrowingCosts = Math.round(((Number(loan.borrowingCosts) || 0) + (Number(cost.amount) || 0)) * 100) / 100;
  if(!loan.settlementDate && p.purchaseDate) loan.settlementDate = p.purchaseDate;
  return {
    cost: cost, loan: loan,
    undo: function(){ p.acquisitionCosts = before.costs; loan.borrowingCosts = before.borrowing; loan.settlementDate = before.settled; }
  };
}
