import { state, persist } from "../state.js";
import {
  propertyEquityToday, propertyGearingAnnual, propertyLoanRepaymentMonthly, loanRepaymentDisplay,
  propertyCapitalGain, propertyYieldOnCost, propertiesTotalValue, propertiesTotalEquityToday,
  propertiesTotalMortgageBalance, propertiesNetCashFlowMonthly, propertiesWeightedGrossYield
} from "../calc/property.js";
import { sumField } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { syncUiModeToggle, applyPeriodVisibility } from "../lib/uimode.js";
import { optionsHtml, buildTable, modernPlainRowHtml, historyTrendHtml } from "../lib/ledger-table.js";
import { showToast } from "../lib/toast.js";
import { appendHistorySnapshot } from "../calc/ledger.js";
import { renderLineChart, sparklineHtml, sparklinePlaceholderHtml } from "../lib/charts.js";
import { renderPropertyExpensesSummary } from "./expenses.js";
import { renderProjectionOutputs } from "./projections.js";

// Real-world payment cadences (loan repayments, and how a property manager actually disburses
// rent) are only ever weekly, fortnightly, or monthly — unlike income/expense rows elsewhere in
// this app, Quarterly/Yearly aren't real options here, so this is its own shorter list rather
// than reusing the global FREQS.
var PAYMENT_FREQS = ["Weekly", "Fortnightly", "Monthly"];
var PAYMENT_FREQ_SUFFIX = { Weekly: "/wk", Fortnightly: "/fn", Monthly: "/mo" };

// Which of a property's five sections (value/acquisition/loans/income/expenses) collapse-all/
// expand-all should toggle — order here is also the display order, matching propertyCardHtml.
export var PROPERTY_SECTION_KEYS = ["value", "acquisition", "loans", "income", "expenses"];
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

function loanRowHtml(loan, li){
  var disp = loanRepaymentDisplay(loan);
  var suffix = PAYMENT_FREQ_SUFFIX[disp.freq] || "/mo";
  return '<tr data-loan-index="' + li + '">' +
    '<td><input type="text" class="loan-what" value="' + escapeAttr(loan.what) + '" aria-label="Loan name"></td>' +
    '<td class="num"><input type="number" step="1000" min="0" class="loan-balance" value="' + (Number(loan.balance) || 0) + '" aria-label="Loan balance"></td>' +
    '<td class="num"><input type="number" step="0.01" min="0" class="loan-rate" value="' + (Math.round((Number(loan.rate) || 0) * 100) / 100) + '" aria-label="Interest rate percent"></td>' +
    '<td class="num"><input type="number" step="1" min="0" class="loan-term" value="' + (Number(loan.termYears) || 0) + '" aria-label="Term years remaining"></td>' +
    '<td><select class="loan-type" aria-label="Repayment type">' + optionsHtml(["PI", "IO"], loan.repaymentType) + '</select></td>' +
    '<td><select class="loan-repay-freq" aria-label="How often this loan is paid" title="For auto repayments this only changes how the amount is displayed (still calculated monthly) — for a manual repayment it\'s the frequency the amount you type in is actually paid at.">' + optionsHtml(PAYMENT_FREQS, disp.freq) + '</select></td>' +
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
  var suffix = PAYMENT_FREQ_SUFFIX[disp.freq] || "/mo";
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
        '<div class="m-edit-field"><label>Paid</label><select class="loan-repay-freq" aria-label="How often this loan is paid" title="For auto repayments this only changes how the amount is displayed (still calculated monthly) — for a manual repayment it\'s the frequency the amount you type in is actually paid at.">' + optionsHtml(PAYMENT_FREQS, disp.freq) + '</select></div>' +
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

// Reuses the exact cc-what/cc-amount/cc-del/calc-costs-table component scenarios.js's purchase
// calculator already built for its own "Other acquisition costs" list (same real-world concept —
// settlement costs — just attached to a planned future purchase there instead of a real property
// here) — borderless inputs, a fixed-width right-aligned amount column, the same row-dot +
// composition-bar treatment in Modern mode. data-acq-cost-index/data-acq-cost-del stay as extra
// attributes (not extra classes) so app.js's existing event delegation for this section is
// unaffected by reusing the shared classes.
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
function acquisitionCostRowHtml(item, index){
  var whatInput = '<input type="text" class="cc-what" data-acq-cost-index="' + index + '" value="' + escapeAttr(item.what) + '" placeholder="e.g. Stamp duty" aria-label="Acquisition cost description">';
  var amountInput = '<input type="number" step="100" min="0" class="cc-amount" data-acq-cost-index="' + index + '" value="' + (Number(item.amount) || 0) + '" aria-label="Amount">';
  var delBtn = '<button type="button" class="btn btn-ghost btn-sm row-del" data-acq-cost-del="' + index + '" aria-label="Delete acquisition cost">✕</button>';
  return '<tr class="cc-row" data-acq-cost-index="' + index + '"><td>' + whatInput + '</td><td class="cc-amount-cell">' + amountInput + '</td><td class="cc-del">' + delBtn + '</td></tr>';
}
function acquisitionCostRowModernHtml(item, index, colorIdx){
  var whatInput = '<input type="text" class="cc-what" data-acq-cost-index="' + index + '" value="' + escapeAttr(item.what) + '" placeholder="e.g. Stamp duty" aria-label="Acquisition cost description">';
  var amountInput = '<input type="number" step="100" min="0" class="cc-amount" data-acq-cost-index="' + index + '" value="' + (Number(item.amount) || 0) + '" aria-label="Amount">';
  var delBtn = '<button type="button" class="btn btn-ghost btn-sm row-del" data-acq-cost-del="' + index + '" aria-label="Delete acquisition cost">✕</button>';
  return '<div class="cc-row m-cost-row" data-acq-cost-index="' + index + '">' +
    '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' + whatInput + amountInput + delBtn +
  '</div>';
}
// Stamp duty, legal, buyer's agent, inspection, etc. — itemized rather than a single lump sum, so
// it doubles as a real record of what was paid, not just a number. Always rendered (even with an
// empty list) so there's somewhere obvious to add the first one — unlike Loans/Income/Expenses,
// this section has no natural "hide until non-empty" moment since it's core to Capital gain.
function acquisitionCostsSectionHtml(p){
  var rowMeta = acquisitionCostRowMeta(p);
  var total = rowMeta.reduce(function(s, m){ return s + (Number(m.cost.amount) || 0); }, 0);
  var isModern = state.uiMode === "modern";
  var rowsHtml = isModern
    ? rowMeta.map(function(m){ return acquisitionCostRowModernHtml(m.cost, m.i, m.colorIdx); }).join("")
    : rowMeta.map(function(m){ return acquisitionCostRowHtml(m.cost, m.i); }).join("");
  var titleHtml = '<div class="property-section-title">Acquisition costs <span data-out="acqcoststotal" style="font-weight:400;color:var(--ink-soft)">' + (total > 0 ? "— " + fmtCurrency0.format(total) + " total" : "") + '</span></div>';
  var bodyHtml =
    '<p class="ledger-note" style="margin-left:0">Stamp duty, legal/conveyancing, buyer\'s agent, building/pest inspection — itemize what you actually paid. Added to Purchase price above for Capital gain and yield-on-cost.</p>' +
    (isModern
      ? '<div class="m-card m-cost-rows" id="propAcqCostRows_' + escapeAttr(p.id) + '">' + acquisitionCostCompBarHtml(rowMeta) + rowsHtml + '</div>'
      : (rowMeta.length ? '<div class="table-scroll"><table class="calc-costs-table"><thead><tr><th>What</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' : '')) +
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

function propertyCardHtml(p, colorIdx){
  var equity = propertyEquityToday(p);
  var loanRows = (p.loans || []).map(loanRowHtml).join("");
  var hasPmFee = p.kind === "IP";
  var pmFeePanel = hasPmFee
    ? '<div class="proj-controls prop-pmfee-panel">' +
        '<div class="proj-field" title="Applied to this property\'s Property Manager Fee expense row, worked out from its own rent — each property manager can charge a different rate"><label>PM fee % of rent</label><input type="number" min="0" max="100" step="0.1" class="prop-pmfee-percent" value="' + (Number(p.pmFee.percent) || 0) + '"></div>' +
        '<div class="proj-field"><label>+ flat $/month</label><input type="number" min="0" step="0.5" class="prop-pmfee-flat" value="' + (Number(p.pmFee.flat) || 0) + '"></div>' +
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
  var mortgageBalance = (p.loans || []).reduce(function(s, l){ return s + (Number(l.balance) || 0); }, 0);
  if(p.kind === "IP"){
    var gearing = propertyGearingAnnual(p);
    var isPositive = gearing >= 0;
    gearingBadge = '<span class="gearing-badge ' + (isPositive ? "positive" : "negative") + '" title="Rent minus expenses and loan repayments, per year (' + fmtCurrency0.format(gearing) + '/yr). ' +
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
      { title: "Current value minus what you paid", color: capitalGain.gain >= 0 ? "var(--good)" : "var(--bad)" });
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

  return '<div class="property-card series-color-' + (colorIdx % 8) + '" data-property-id="' + escapeAttr(p.id) + '" id="property-card-' + escapeAttr(p.id) + '">' +
    '<div class="property-card-head">' +
      '<h4><input type="text" class="prop-what" value="' + escapeAttr(p.what) + '" aria-label="Property name">' +
      '<select class="prop-kind" aria-label="Property kind">' + optionsHtml(["IP", "PPOR"], p.kind) + '</select></h4>' +
      '<button type="button" class="btn btn-ghost btn-sm row-del property-del-btn" data-property-del="' + escapeAttr(p.id) + '" aria-label="Delete property">✕</button>' +
    '</div>' +
    (gearingBadge || yieldBadge ? '<div class="property-card-badges">' + gearingBadge + yieldBadge + '</div>' : '') +
    '<div class="calc-outputs">' + primaryTiles + '</div>' +
    (moreTiles ? '<details class="tax-advanced m-more-options property-stats-more"><summary>More detail</summary><div class="calc-outputs" style="margin-top:10px">' + moreTiles + '</div></details>' : '') +
    '<div class="property-card-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-prop-collapse-toggle="' + escapeAttr(p.id) + '">' + (allSectionsCollapsed ? "Expand all" : "Collapse all") + '</button>' +
    '</div>' +
    propertySectionHtml(p, "value",
      '<div class="property-section-title">Property value</div>',
      '<div class="calc-grid">' +
        '<div class="calc-field"><label>Current value</label><input type="number" step="1000" min="0" class="prop-value" value="' + (Number(p.value) || 0) + '"></div>' +
        '<div class="calc-field" title="What you actually paid — separate from Current value above, and from the Log button\'s value-over-time history, which starts whenever this property was first added rather than the real purchase date. Powers Capital gain and the yield-on-cost badge above; leave blank if unknown."><label>Purchase price</label><input type="number" step="1000" min="0" class="prop-purchase-price" value="' + (p.purchasePrice != null ? p.purchasePrice : "") + '" placeholder="Unknown"></div>' +
        '<div class="calc-field"><label>Purchase date</label><input type="date" class="prop-purchase-date" value="' + escapeAttr(p.purchaseDate || "") + '"></div>' +
      '</div>' +
      '<div class="prop-value-log"><button type="button" class="asset-log-btn" data-property-log="' + escapeAttr(p.id) + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart">Log</button>' + historyTrendHtml(p) + '</div>') +
    acquisitionCostsSectionHtml(p) +
    propertySectionHtml(p, "loans",
      '<div class="property-section-title">Loans</div>',
      (state.uiMode === "modern"
        ? '<div class="m-card" id="propLoanRows_' + escapeAttr(p.id) + '">' + modernLoanListHtml(p) + '</div>'
        : '<div class="table-scroll"><table class="calc-costs-table prop-loans-table"><thead><tr><th>What</th><th class="num">Balance</th><th class="num">Rate %</th><th class="num">Term (yrs)</th><th>Type</th><th>Paid</th><th>Repayment</th><th class="num" title="Netted against the loan balance for both equity and interest — the one place to enter this money, not also as a separate Cash asset">Offset</th><th></th></tr></thead><tbody>' + loanRows + '</tbody></table></div>') +
      '<button type="button" class="btn btn-sm btn-ghost" data-loan-add="' + escapeAttr(p.id) + '">+ Add loan</button>') +
    propertySectionHtml(p, "income",
      '<div class="property-section-title">Income</div>',
      incomePaidPanel +
      (state.uiMode === "modern"
        ? '<div class="m-card"><div class="m-rows" id="propIncomeRows_' + escapeAttr(p.id) + '">' + modernPropListHtml(p.income, "propinc:" + p.id, false) + '</div></div>'
        : '<div class="table-scroll"><table class="ledger-table" id="propIncomeTable_' + escapeAttr(p.id) + '"></table></div>') +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propinc:' + escapeAttr(p.id) + '">+ Add income</button>') +
    propertySectionHtml(p, "expenses",
      '<div class="property-section-title">Expenses</div>',
      pmFeePanel +
      (state.uiMode === "modern"
        ? '<div class="m-card"><div class="m-rows" id="propExpRows_' + escapeAttr(p.id) + '">' + modernPropListHtml(p.expenses, "propexp:" + p.id, true) + '</div></div>'
        : '<div class="table-scroll"><table class="ledger-table" id="propExpTable_' + escapeAttr(p.id) + '"></table></div>') +
      '<button type="button" class="btn btn-sm btn-ghost group-add-btn" data-add="propexp:' + escapeAttr(p.id) + '">+ Add expense</button>') +
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
        '<div class="stat-tile" title="Value minus full loan balance, net of offset — matches each card\'s own Net equity tile, summed across the portfolio"><span>Total equity</span><b>' + fmtCurrency0.format(propertiesTotalEquityToday()) + '</b><small>net of offset</small></div>' +
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
    xFormat: function(ms){ return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short" }); },
    xTickCount: Math.min(7, Math.max(2, dates.length)),
    ariaLabel: "Total property value over time",
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
  syncUiModeToggle();
  var container = document.getElementById("propertiesBody");
  if(!container) return;
  container.innerHTML = state.properties.length
    ? state.properties.map(function(p, idx){ return propertyCardHtml(p, idx); }).join("")
    : '<p class="ledger-note" style="margin:0">No properties yet — add one below to start tracking its value, loans, and (for an investment property) rent and expenses.</p>';
  if(state.uiMode !== "modern"){
    state.properties.forEach(function(p){
      buildTable(document.getElementById("propIncomeTable_" + p.id), "propinc:" + p.id, p.income, {showClass:false, showLog:true});
      buildTable(document.getElementById("propExpTable_" + p.id), "propexp:" + p.id, p.expenses, {showClass:true, hideAcctToggle:true, hideClassToggle:true, showLog:true});
    });
  }
  renderPropertyExpensesSummary();
  applyPeriodVisibility();
  renderPropertiesSummary();
  renderPropertiesValueHistoryChart();
  var compareEl = document.getElementById("propertiesCompareList");
  if(compareEl) compareEl.innerHTML = propertiesCompareListHtml();
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
    var suffix = PAYMENT_FREQ_SUFFIX[disp.freq] || "/mo";
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
