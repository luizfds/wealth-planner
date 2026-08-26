import { state, persist, defaultHomeBlock, defaultPurchaseConfig } from "../state.js";
import { PURCHASE_STATE_CODES, STATE_GROWTH_RATES, PERIODS } from "../constants.js";
import { recalcPurchase } from "../calc/property.js";
import { recalcComputedItems } from "../calc/engine.js";
import { periodsOf, sumField } from "../calc/ledger.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "../lib/format.js";
import { escapeAttr, slug } from "../lib/html.js";
import { syncUiModeToggle, applyPeriodVisibility } from "../lib/uimode.js";
import { buildTable, modernPlainRowHtml } from "../lib/ledger-table.js";
import { showToast } from "../lib/toast.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { renderAssets } from "./assets.js";

export function selectScenario(name){
  if(state.activeScenario === name) return;
  state.activeScenario = name;
  persist();
  renderCards();
  renderDetail();
  renderHomeBody();
}

export function addScenario(){
  var name = prompt('Name the new scenario (e.g. "Buy Brisbane"):', "");
  if(name === null) return;
  name = name.trim();
  if(!name) return;
  if(state.scenarios.indexOf(name) !== -1){ showToast('A scenario named "' + name + '" already exists'); return; }
  state.scenarios.push(name);
  state.home[name] = defaultHomeBlock();
  state.purchase[name] = defaultPurchaseConfig(0, 20, 6.0, 30, "NSW", true);
  state.activeScenario = name;
  persist();
  renderCards();
  renderDetail();
  renderHomeBody();
  renderAssets();
  showToast('Added "' + name + '"');
}

export function renameScenario(oldName){
  var name = prompt("Rename scenario:", oldName);
  if(name === null) return;
  name = name.trim();
  if(!name || name === oldName) return;
  if(state.scenarios.indexOf(name) !== -1){ showToast('A scenario named "' + name + '" already exists'); return; }
  var idx = state.scenarios.indexOf(oldName);
  if(idx === -1) return;
  state.scenarios[idx] = name;
  state.home[name] = state.home[oldName];
  delete state.home[oldName];
  state.purchase[name] = state.purchase[oldName];
  delete state.purchase[oldName];
  if(state.activeScenario === oldName) state.activeScenario = name;
  if(state.baselineScenario === oldName) state.baselineScenario = name;
  persist();
  renderCards();
  renderDetail();
  renderHomeBody();
  renderAssets();
}

export function deleteScenario(name){
  if(state.scenarios.length <= 1){ showToast("You need at least one scenario"); return; }
  if(name === state.baselineScenario){ showToast('"' + name + '" is your Current situation baseline and can\'t be deleted — rename it instead if you want to reuse the slot.'); return; }
  if(!confirm('Delete "' + name + '"? This removes its home-cost inputs.')) return;
  state.scenarios = state.scenarios.filter(function(s){ return s !== name; });
  delete state.home[name];
  delete state.purchase[name];
  if(state.activeScenario === name) state.activeScenario = state.scenarios[0];
  persist();
  renderCards();
  renderDetail();
  renderHomeBody();
  renderAssets();
}

function homeReconciliationHtml(scenario){
  var items = state.home[scenario] || [];
  var loanRow = items.find(function(i){ return i.id === "homeLoanRow"; });
  var loanMonthly = loanRow ? periodsOf(loanRow.amount, loanRow.freq).monthly : 0;
  var total = sumField(items, "monthly");
  var other = total - loanMonthly;
  return "Adds up: " + escapeAttr(loanRow ? loanRow.what : "Rent / Home Loan") + " " + fmtCurrency0.format(loanMonthly) +
    " + other recurring costs " + fmtCurrency0.format(other) + " = <b>" + fmtCurrency0.format(total) + " / mo</b> total home cost";
}

// Session-only UI preference (not persisted app data, like colPickers below) — which
// scenario cards are collapsed on the Scenarios page. Seeded per-scenario the first time
// it's rendered so comparing several scenarios at once doesn't mean scrolling past every
// purchase calculator fully expanded; the active scenario starts open, the rest start closed.
export var homeBlockCollapsed = {};

// Session-only (not persisted) — mirrors modernPropRowOpen, shared across every scenario's
// recurring-costs list (the "home:<scenario>" section prefix keeps each scenario's rows
// unique in the map, the same way "propinc:<id>"/"propexp:<id>" do for Properties).
export var modernHomeRowOpen = {};
// Every non-computed cost row gets a color, cycling the same 8-color series used everywhere
// else — shared by each row's identity dot and the card's composition bar so the two stay in
// sync (mirrors incomeGroupRowMeta/loanRowMeta).
function homeRowMeta(scenario){
  var contribIdx = 0;
  return (state.home[scenario] || []).map(function(item, idx){
    var colorIdx = null;
    if(!item.computed){ colorIdx = contribIdx % 8; contribIdx++; }
    return { item: item, idx: idx, colorIdx: colorIdx };
  });
}
function modernHomeCompBarHtml(rowMeta){
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
function modernHomeListHtml(scenario){
  return homeRowMeta(scenario).map(function(m){
    return modernPlainRowHtml(m.item, m.idx, "home:" + scenario, modernHomeRowOpen, {showClass:true, primaryId:"homeLoanRow", colorIdx:m.colorIdx});
  }).join("");
}
export function renderHomeListModern(scenario, i){
  var container = document.getElementById("homeRows_" + slug(scenario) + i);
  if(container) container.innerHTML = modernHomeListHtml(scenario);
}

export function renderHomeBody(){
  syncUiModeToggle();
  var body = document.getElementById("homeBody");
  var canDelete = state.scenarios.length > 1;
  state.scenarios.forEach(function(scenario){
    if(!(scenario in homeBlockCollapsed)) homeBlockCollapsed[scenario] = (scenario !== state.activeScenario);
  });
  body.innerHTML = state.scenarios.map(function(scenario, i){
    var isActive = state.activeScenario === scenario;
    var isBaseline = state.baselineScenario === scenario;
    var isCollapsed = !!homeBlockCollapsed[scenario];
    var total = sumField(state.home[scenario], "monthly");
    return '<div class="home-block' + (isActive ? " is-active" : "") + (isCollapsed ? " is-collapsed" : "") + '">' +
      '<div class="home-block-head" data-collapse-toggle="' + escapeAttr(scenario) + '" role="button" tabindex="0" aria-expanded="' + (!isCollapsed) + '" aria-label="' + (isCollapsed ? "Expand" : "Collapse") + ' ' + escapeAttr(scenario) + '">' +
        '<div class="home-block-head-left">' +
          '<span class="icon-btn home-collapse-toggle" aria-hidden="true"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg></span>' +
          '<span class="home-dot"></span><h4>' + escapeAttr(scenario) + '</h4>' +
          (isBaseline ? '<span class="home-baseline-badge" title="Your current, real-life situation — kept as the fixed baseline every other scenario is compared against">Current situation</span>' : "") +
          (isActive
            ? '<span class="home-active-badge" title="This is the scenario shown on the Dashboard and compared against the others">Active on Dashboard</span>'
            : '<button type="button" class="home-setactive-btn" data-edit-scenario2="' + escapeAttr(scenario) + '" title="Make this the scenario shown on the Dashboard">Set active</button>') +
        '</div>' +
        '<div class="home-block-right" title="Total home cost per month — rent/repayment plus insurance, rates, water &amp; maintenance">' +
          '<span class="home-block-total-label">Home cost</span>' +
          '<span class="home-block-total">' + fmtCurrency0.format(total) + ' / mo</span>' +
          '<button type="button" class="icon-btn" data-rename="' + escapeAttr(scenario) + '" aria-label="Rename ' + escapeAttr(scenario) + '" title="Rename">✎</button>' +
          (canDelete && !isBaseline ? '<button type="button" class="icon-btn icon-del" data-delete="' + escapeAttr(scenario) + '" aria-label="Delete ' + escapeAttr(scenario) + '" title="Delete">✕</button>' : "") +
        '</div>' +
      '</div>' +
      '<div class="home-block-body">' +
        renderPurchasePanelHtml(scenario) +
        '<div class="home-recurring-label">Recurring costs — per month</div>' +
        '<p class="income-summary-line home-recon-line">' + homeReconciliationHtml(scenario) + '</p>' +
        (state.uiMode === "modern"
          ? '<div class="m-card" id="homeCard_' + slug(scenario) + i + '">' + modernHomeCompBarHtml(homeRowMeta(scenario)) + '<div class="m-rows" id="homeRows_' + slug(scenario) + i + '">' + modernHomeListHtml(scenario) + '</div></div>'
          : '<div class="table-scroll"><table class="ledger-table" id="homeTable_' + slug(scenario) + i + '"></table></div>') +
        '<div class="ledger-footer"><button class="btn btn-sm" data-add="home:' + escapeAttr(scenario) + '">+ Add item</button></div>' +
      '</div>' +
      '</div>';
  }).join("") +
  '<button type="button" class="add-scenario-row" id="addScenarioBtn2"><span class="add-plus" style="font-size:16px">+</span> Add another scenario</button>';
  if(state.uiMode !== "modern"){
    state.scenarios.forEach(function(scenario, i){
      buildTable(document.getElementById("homeTable_" + slug(scenario) + i), "home:" + scenario, state.home[scenario], {showClass:true, acctColClass:"col-account-home"});
    });
  }
  applyPeriodVisibility();
}

// Every acquisition cost gets a color, cycling the same 8-color series used everywhere else —
// shared by each row's identity dot and this list's composition bar so the two stay in sync.
function costRowMeta(cfg){
  return (cfg.otherCosts || []).map(function(c, ci){ return { cost: c, ci: ci, colorIdx: ci % 8 }; });
}
function modernCostCompBarHtml(rowMeta){
  var segs = rowMeta.map(function(m){ return { cost: m.cost, colorIdx: m.colorIdx, amount: Math.max(0, Number(m.cost.amount) || 0) }; })
    .filter(function(x){ return x.amount > 0.5; });
  if(segs.length < 2) return "";
  var total = segs.reduce(function(s, x){ return s + x.amount; }, 0);
  return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
    var pct = total > 0 ? x.amount / total : 0;
    return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.amount + ' 1 0%" title="' + escapeAttr(x.cost.what) + ': ' + fmtCurrency0.format(x.amount) + ' (' + fmtPercent1.format(pct) + ')"></div>';
  }).join("") + '</div>';
}
function renderPurchasePanelHtml(scenario){
  var cfg = state.purchase[scenario];
  if(!cfg) return "";
  var enabled = !!cfg.enabled;
  var body = "";
  if(enabled){
    var out = recalcPurchase(scenario);
    var stateOptions = PURCHASE_STATE_CODES.map(function(sc){
      return '<option value="' + sc + '"' + (sc === cfg.state ? " selected" : "") + '>' + sc + '</option>';
    }).join("");
    var isModern = state.uiMode === "modern";
    var costsRows = (cfg.otherCosts || []).map(function(c, ci){
      return '<tr class="cc-row">' +
        '<td><input type="text" class="cc-what" value="' + escapeAttr(c.what) + '" aria-label="Cost name"></td>' +
        '<td class="cc-amount-cell"><input type="number" step="1" min="0" class="cc-amount" value="' + c.amount + '" aria-label="Cost amount"></td>' +
        '<td class="cc-del"><button type="button" class="btn btn-ghost btn-sm row-del" data-cc-del="' + ci + '" aria-label="Remove cost">✕</button></td>' +
        '</tr>';
    }).join("");
    var modernCostsRows = costRowMeta(cfg).map(function(m){
      return '<div class="cc-row m-cost-row">' +
        '<span class="m-row-dot series-color-' + m.colorIdx + '" aria-hidden="true"></span>' +
        '<input type="text" class="cc-what" value="' + escapeAttr(m.cost.what) + '" aria-label="Cost name" placeholder="Cost name">' +
        '<input type="number" step="1" min="0" class="cc-amount" value="' + m.cost.amount + '" aria-label="Cost amount">' +
        '<button type="button" class="btn btn-ghost btn-sm row-del" data-cc-del="' + m.ci + '" aria-label="Remove cost">✕</button>' +
      '</div>';
    }).join("");
    var modernCostsCompBar = modernCostCompBarHtml(costRowMeta(cfg));
    var stampDutyHtml = out.stampDuty === null
      ? '<input type="number" step="1" min="0" class="calc-manual-stampduty" value="' + (Number(cfg.manualStampDuty) || 0) + '" style="width:100%;font-family:\'IBM Plex Mono\',monospace;font-size:15px;background:transparent;border:1px solid var(--border);border-radius:6px;padding:2px 4px;">'
      : fmtCurrency0.format(out.stampDuty);
    body =
      '<div class="calc-body">' +
        '<div class="calc-grid">' +
          '<div class="calc-field"><label>Property price</label><input type="number" step="1000" min="0" class="calc-price" value="' + cfg.price + '"></div>' +
          '<div class="calc-field" title="Below 20% usually means paying Lenders Mortgage Insurance (LMI) — see the settlement costs below."><label>Deposit %</label><input type="number" step="1" min="0" max="100" class="calc-depositPct" value="' + cfg.depositPct + '"><span class="calc-hint" data-out="deposit">' + fmtCurrency0.format(out.depositAmt) + '</span></div>' +
          '<div class="calc-field"><label>Loan term (years)</label><input type="number" step="1" min="1" class="calc-term" value="' + cfg.termYears + '"></div>' +
          '<div class="calc-field"><label>State</label><select class="calc-state">' + stateOptions + '</select></div>' +
          '<div class="calc-field" title="Overrides the global Property growth % p.a. (Projections tab) for this scenario only. Leave blank to use the global rate for every scenario alike."><label>Property growth % p.a. <span style="text-transform:none;font-weight:400">(this scenario)</span></label><input type="number" step="0.1" min="-10" max="30" class="calc-growth-override" placeholder="Global: ' + (Number(state.projection.propertyAppreciationRate) || 0) + '%" value="' + (cfg.propertyGrowthRate != null ? cfg.propertyGrowthRate : '') + '"><span class="calc-hint">' + (STATE_GROWTH_RATES[cfg.state] != null ? (cfg.state + ' long-run avg ' + STATE_GROWTH_RATES[cfg.state] + '%/yr (1980–2022) — <button type="button" class="calc-hint-link" data-use-growth="' + STATE_GROWTH_RATES[cfg.state] + '">use this</button>') : '') + '</span></div>' +
          '<div class="calc-field" title="Rate for a standard principal &amp; interest loan — get your bank/broker\'s quoted rate for an accurate comparison."><label>Interest rate % p.a. (P&amp;I)</label><input type="number" step="0.05" min="0" class="calc-rate" value="' + cfg.rate + '"></div>' +
          '<div class="calc-field" title="Interest-only rate — lenders usually price this higher than P&amp;I. Get the actual IO rate quoted by your bank, don\'t assume it matches P&amp;I."><label>Interest rate % p.a. (IO)</label><input type="number" step="0.05" min="0" class="calc-iorate" value="' + cfg.ioRate + '"></div>' +
          '<div class="calc-field" title="Which repayment feeds your budget below and the long-term projection. Both are shown for comparison regardless of this choice."><label>Repayment type used</label><select class="calc-repaymenttype"><option value="PI"' + (cfg.repaymentType !== "IO" ? " selected" : "") + '>Principal &amp; interest</option><option value="IO"' + (cfg.repaymentType === "IO" ? " selected" : "") + '>Interest only</option></select></div>' +
          '<div class="calc-field"><label>First home buyer <span class="calc-help" title="Applies first-home-buyer stamp duty savings: full exemption below $800k (NSW) / $600k (VIC), tapering down to no discount at $1M (NSW) / $750k (VIC). No effect when State is \'Other\' — stamp duty is entered manually there.">ⓘ</span></label><label class="calc-check-inline"><span class="switch"><input type="checkbox" class="calc-fhb"' + (cfg.firstHomeBuyer ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb"></span></span></span> Yes</label></div>' +
        '</div>' +
        '<div class="calc-outputs-label">At settlement — one-off</div>' +
        '<div class="calc-outputs">' +
          '<div class="calc-out"><span>Loan amount</span><b data-out="loan">' + fmtCurrency0.format(out.loanAmount) + '</b>' +
            '<small data-out="loanlmicap" style="font-weight:400;font-size:10.5px;color:var(--ink-soft)' + (out.lmiCapitalized && out.lmi > 0 ? '' : ';display:none') + '">+ ' + fmtCurrency0.format(out.lmi) + ' capitalized LMI = ' + fmtCurrency0.format(out.loanBalance) + '</small>' +
          '</div>' +
          '<div class="calc-out" title="Loan amount ÷ property price. Above 80% usually triggers Lenders Mortgage Insurance (LMI) below."><span>LVR</span><b data-out="lvr">' + fmtPercent1.format(out.lvr) + '</b></div>' +
          '<div class="calc-out"><span>Stamp duty' + (out.stampDuty === null ? " (enter manually)" : "") + '</span><b data-out="stampduty">' + stampDutyHtml + '</b></div>' +
          '<div class="calc-out" title="Lenders Mortgage Insurance — a one-off premium lenders charge when your deposit is under 20% (LVR over 80%), protecting the lender, not you. $0 below 80% LVR."><span>LMI (estimate)</span><b data-out="lmi">' + fmtCurrency0.format(out.lmi) + '</b>' +
            '<label class="calc-check-inline" data-out="lmicapwrap" style="margin-top:4px;font-size:11px;padding:3px 6px' + (out.lmi > 0 ? '' : ';display:none') + '"><span class="switch" style="width:26px;height:15px"><input type="checkbox" class="calc-lmi-capitalize"' + (out.lmiCapitalized ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb" style="width:11px;height:11px"></span></span></span> Capitalize into loan <span class="calc-help" title="Add the LMI premium to your loan balance instead of paying it as cash at settlement — increases your loan amount and repayments, but reduces the cash you need on hand. Most lenders default to this.">ⓘ</span></label>' +
          '</div>' +
          '<div class="calc-out"><span>Other costs</span><b data-out="othercosts">' + fmtCurrency0.format(out.otherTotal) + '</b></div>' +
          '<div class="calc-out emph" data-out="upfrontwrap" title="Deposit + stamp duty + other costs' + (out.lmiCapitalized ? " — LMI is capitalized into the loan, not paid as cash" : " + LMI") + ' — the cash you need available on settlement day."><span>Total upfront cash</span><b data-out="upfront">' + fmtCurrency0.format(out.upfrontCash) + '</b></div>' +
        '</div>' +
        '<div class="calc-outputs-label">Ongoing — per month · compare repayment options</div>' +
        '<div class="calc-outputs">' +
          '<div class="calc-out' + (cfg.repaymentType !== "IO" ? " emph" : "") + '" data-repayment-out="PI" title="Loan principal &amp; interest — pays down the balance over the loan term"><span>Repayment (P&amp;I)' + (cfg.repaymentType !== "IO" ? " ✓ used below" : "") + '</span><b data-out="repaymentpi">' + fmtCurrency0.format(out.repaymentMonthlyPI) + '/mo</b></div>' +
          '<div class="calc-out' + (cfg.repaymentType === "IO" ? " emph" : "") + '" data-repayment-out="IO" title="Interest only — cheaper monthly, but the loan balance never reduces. Get the actual IO rate from your bank, don\'t assume it matches the P&amp;I rate."><span>Repayment (Interest only)' + (cfg.repaymentType === "IO" ? " ✓ used below" : "") + '</span><b data-out="repaymentio">' + fmtCurrency0.format(out.repaymentMonthlyIO) + '/mo</b></div>' +
        '</div>' +
        '<div>' +
          '<div class="calc-costs-title">Other acquisition costs</div>' +
          (isModern ? '<div class="m-card m-cost-rows">' + modernCostsCompBar + modernCostsRows + '</div>' : '<table class="calc-costs-table">' + costsRows + '</table>') +
          '<button type="button" class="btn btn-sm" style="margin-top:8px" data-cc-add="1">+ Add cost</button>' +
        '</div>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer">' +
          '<span class="switch"><input type="checkbox" class="calc-sync"' + (cfg.syncRepayment ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb"></span></span></span> Use this repayment as "Rent / Home Loan" below' +
        '</label>' +
        '<p class="calc-note">P&amp;I repayment is exact (standard amortisation). Interest-only repayment is simplified — modelled flat for the full loan term rather than a fixed IO period reverting to P&amp;I, and the projection assumes the balance never reduces while IO is selected. Stamp duty (NSW/VIC) and LMI are estimates based on published general scales and typical lender premiums — all rates and fees vary by lender/insurer and change over time, so confirm exact figures with your bank, broker or state revenue office before relying on them.</p>' +
      '</div>';
  }
  return (
    '<div class="calc-panel" data-calc-scenario="' + escapeAttr(scenario) + '">' +
      '<label class="calc-enable"><span class="switch"><input type="checkbox" class="calc-enabled"' + (enabled ? " checked" : "") + '><span class="switch-track"><span class="switch-thumb"></span></span></span> This is a property purchase — show the calculator</label>' +
      body +
    '</div>'
  );
}

export function renderHomeBodyTotalsOnly(){
  document.querySelectorAll('#homeBody .home-block').forEach(function(block, i){
    var scenario = state.scenarios[i];
    var monthly = sumField(state.home[scenario], "monthly");
    var totalSpan = block.querySelector('.home-block-total');
    if(totalSpan) totalSpan.textContent = fmtCurrency0.format(monthly) + " / mo";
    var reconLine = block.querySelector('.home-recon-line');
    if(reconLine) reconLine.innerHTML = homeReconciliationHtml(scenario);
    var barWrap = block.querySelector('[id^="homeCard_"] [data-comp-bar]');
    if(barWrap) barWrap.outerHTML = modernHomeCompBarHtml(homeRowMeta(scenario));
  });
}

export function patchHomeLoanRowIfSynced(scenario){
  var cfg = state.purchase[scenario];
  if(!cfg || !cfg.enabled || !cfg.syncRepayment) return;
  var arr = state.home[scenario] || [];
  var idx = arr.findIndex(function(i){ return i.id === "homeLoanRow"; });
  if(idx === -1) return;
  var item = arr[idx];
  var i = state.scenarios.indexOf(scenario);
  if(i === -1) return;
  var wrap = document.getElementById(state.uiMode === "modern" ? ("homeRows_" + slug(scenario) + i) : ("homeTable_" + slug(scenario) + i));
  if(!wrap) return;
  var tr = wrap.querySelector('[data-index="' + idx + '"]');
  if(!tr) return;
  var amountInput = tr.querySelector(".f-amount");
  if(amountInput) amountInput.value = item.amount;
  var cells = tr.querySelectorAll("td.computed");
  var p = periodsOf(item.amount, item.freq);
  PERIODS.forEach(function(pd, pi){ if(cells[pi]) cells[pi].textContent = fmtCurrency2.format(p[pd.key]); });
  var modernAmt = tr.querySelector('[data-computed="amt"]');
  if(modernAmt) modernAmt.textContent = fmtCurrency2.format(p.monthly) + "/mo";
}

export function patchCalcOutputs(panel, scenario){
  var out = recalcPurchase(scenario);
  if(!out) return;
  var setOut = function(key, text){ var el = panel.querySelector('[data-out="' + key + '"]'); if(el) el.textContent = text; };
  setOut("loan", fmtCurrency0.format(out.loanAmount));
  setOut("lvr", fmtPercent1.format(out.lvr));
  if(out.stampDuty !== null) setOut("stampduty", fmtCurrency0.format(out.stampDuty));
  setOut("lmi", fmtCurrency0.format(out.lmi));
  setOut("othercosts", fmtCurrency0.format(out.otherTotal));
  setOut("upfront", fmtCurrency0.format(out.upfrontCash));
  setOut("repaymentpi", fmtCurrency0.format(out.repaymentMonthlyPI) + "/mo");
  setOut("repaymentio", fmtCurrency0.format(out.repaymentMonthlyIO) + "/mo");
  setOut("deposit", fmtCurrency0.format(out.depositAmt));
  // These three toggle visibility as LMI crosses in/out of applying (e.g. typing a price/deposit
  // that pushes LVR over 80%) — always present in the markup (see renderHomeBody) specifically so
  // this per-keystroke patch can show/hide them without a full re-render, which would drop focus
  // mid-keystroke on whichever field the user is actually typing in.
  var lmiCapWrap = panel.querySelector('[data-out="lmicapwrap"]');
  if(lmiCapWrap){
    lmiCapWrap.style.display = out.lmi > 0 ? "" : "none";
    var lmiCapInput = lmiCapWrap.querySelector(".calc-lmi-capitalize");
    if(lmiCapInput) lmiCapInput.checked = out.lmiCapitalized;
  }
  var loanLmiCap = panel.querySelector('[data-out="loanlmicap"]');
  if(loanLmiCap){
    loanLmiCap.style.display = out.lmiCapitalized && out.lmi > 0 ? "" : "none";
    loanLmiCap.textContent = "+ " + fmtCurrency0.format(out.lmi) + " capitalized LMI = " + fmtCurrency0.format(out.loanBalance);
  }
  var upfrontWrap = panel.querySelector('[data-out="upfrontwrap"]');
  if(upfrontWrap) upfrontWrap.title = "Deposit + stamp duty + other costs" + (out.lmiCapitalized ? " — LMI is capitalized into the loan, not paid as cash" : " + LMI") + " — the cash you need available on settlement day.";
  var barWrap = panel.querySelector(".m-cost-rows [data-comp-bar]");
  if(barWrap) barWrap.outerHTML = modernCostCompBarHtml(costRowMeta(state.purchase[scenario]));
}

export function afterCalcChange(scenario){
  recalcComputedItems();
  renderCards();
  renderDetail();
  renderHomeBodyTotalsOnly();
  renderAssets();
  persist();
}
