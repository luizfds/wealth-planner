// ---------------- The purchase and invest calculators, wired (v3.206.1, item 237) ----------------
//
// A scenario's purchase and invest-instead calculators, in Plan and on the Calculators page.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { recalcComputedItems } from "../calc/engine.js";
import { TRANSFER_FEE_BY_STATE, MORTGAGE_REG_FEE_BY_STATE } from "../constants.js";
import { state, persist, defaultInvestConfig } from "../state.js";
import { renderAssets } from "./assets.js";
import { renderCards, renderDetail } from "./dashboard.js";
import { renderHomeBody, patchHomeLoanRowIfSynced, patchCalcOutputs, afterCalcChange, patchInvestOutputs } from "./scenarios.js";

// ---------------- Purchase calculator: wiring ----------------

function onCalcInput(e){
  var panel = e.target.closest("[data-calc-scenario]");
  if(!panel) return;
  var scenario = panel.getAttribute("data-calc-scenario");
  var cfg = state.purchase[scenario];
  if(!cfg) return;
  var t = e.target;
  var matched = true;
  if(t.classList.contains("calc-price")) cfg.price = parseFloat(t.value) || 0;
  else if(t.classList.contains("calc-depositPct")) cfg.depositPct = Math.max(0, Math.min(100, parseFloat(t.value) || 0));
  else if(t.classList.contains("calc-rate")) cfg.rate = parseFloat(t.value) || 0;
  else if(t.classList.contains("calc-iorate")) cfg.ioRate = parseFloat(t.value) || 0;
  else if(t.classList.contains("calc-term")) cfg.termYears = Math.max(1, parseFloat(t.value) || 1);
  else if(t.classList.contains("calc-manual-stampduty")) cfg.manualStampDuty = parseFloat(t.value) || 0;
  else if(t.classList.contains("calc-growth-override")) cfg.propertyGrowthRate = t.value === "" ? null : (parseFloat(t.value) || 0);
  else if(t.classList.contains("cc-what") || t.classList.contains("cc-amount")){
    var tr = t.closest(".cc-row");
    var idx = Array.prototype.indexOf.call(tr.parentNode.children, tr);
    var cost = (cfg.otherCosts || [])[idx];
    if(!cost) return;
    if(t.classList.contains("cc-what")) cost.what = t.value; else cost.amount = parseFloat(t.value) || 0;
  } else { matched = false; }
  if(!matched) return;

  recalcComputedItems();
  patchCalcOutputs(panel, scenario);
  patchHomeLoanRowIfSynced(scenario);
  afterCalcChange(scenario);
}
function onCalcChange(e){
  var panel = e.target.closest("[data-calc-scenario]");
  if(!panel) return;
  var scenario = panel.getAttribute("data-calc-scenario");
  var cfg = state.purchase[scenario];
  if(!cfg) return;
  var t = e.target;
  if(t.classList.contains("calc-enabled")){
    cfg.enabled = t.checked;
    // Mutually exclusive with the invest-instead leg — see the invest-enabled handler below
    // and computeNetWorthSeries()'s own precedence for why both enabled would double-count.
    if(cfg.enabled && state.invest[scenario]) state.invest[scenario].enabled = false;
  }
  else if(t.classList.contains("calc-state")){
    cfg.state = t.value;
    // Transfer/Mortgage Registration are flat statutory land-registry fees, not something a
    // user has any reason to hand-tune the way Conveyancing or Building & Pest costs vary by
    // provider — so unlike every other otherCosts row, these two re-sync to the new state's
    // figure automatically, matching stamp duty's own state-driven recalculation just above.
    // Matched by exact label so a row the user has renamed/repurposed is left alone.
    (cfg.otherCosts || []).forEach(function(c){
      if(c.what === "Transfer Fee") c.amount = TRANSFER_FEE_BY_STATE[cfg.state] != null ? TRANSFER_FEE_BY_STATE[cfg.state] : TRANSFER_FEE_BY_STATE.Other;
      else if(c.what === "Mortgage Registration Fee") c.amount = MORTGAGE_REG_FEE_BY_STATE[cfg.state] != null ? MORTGAGE_REG_FEE_BY_STATE[cfg.state] : MORTGAGE_REG_FEE_BY_STATE.Other;
    });
  }
  else if(t.classList.contains("calc-fhb")) cfg.firstHomeBuyer = t.checked;
  else if(t.classList.contains("calc-sync")) cfg.syncRepayment = t.checked;
  else if(t.classList.contains("calc-repaymenttype")) cfg.repaymentType = t.value;
  else if(t.classList.contains("calc-lmi-capitalize")) cfg.lmiCapitalized = t.checked;
  else return;

  recalcComputedItems();
  renderHomeBody();
  renderCards();
  renderDetail();
  renderAssets();
  persist();
}
function onCalcClick(e){
  var useGrowthBtn = e.target.closest("[data-use-growth]");
  if(useGrowthBtn){
    var growthPanel = e.target.closest("[data-calc-scenario]");
    if(!growthPanel) return;
    var growthScenario = growthPanel.getAttribute("data-calc-scenario");
    var growthCfg = state.purchase[growthScenario];
    if(!growthCfg) return;
    growthCfg.propertyGrowthRate = parseFloat(useGrowthBtn.getAttribute("data-use-growth")) || 0;
    renderHomeBody();
    afterCalcChange(growthScenario);
    return;
  }
  var addBtn = e.target.closest("[data-cc-add]");
  var delBtn = e.target.closest("[data-cc-del]");
  if(!addBtn && !delBtn) return;
  var panel = e.target.closest("[data-calc-scenario]");
  if(!panel) return;
  var scenario = panel.getAttribute("data-calc-scenario");
  var cfg = state.purchase[scenario];
  if(!cfg) return;
  if(!cfg.otherCosts) cfg.otherCosts = [];
  if(addBtn) cfg.otherCosts.push({what:"New cost", amount:0});
  else if(delBtn) cfg.otherCosts.splice(Number(delBtn.getAttribute("data-cc-del")), 1);

  recalcComputedItems();
  renderHomeBody();
  renderCards();
  renderDetail();
  renderAssets();
  persist();
}
// ---------------- Invest-instead-of-buying calculator: wiring ----------------
// Mirrors onCalcInput/onCalcChange's split: per-keystroke number fields patch in place
// (afterCalcChange + patchInvestOutputs, no full re-render — preserves focus mid-keystroke),
// checkbox/select fields go through a full renderHomeBody() since they can change which
// fields are even shown (e.g. contribution mode revealing the manual-amount input).

function onInvestInput(e){
  var panel = e.target.closest("[data-invest-scenario]");
  if(!panel) return;
  var scenario = panel.getAttribute("data-invest-scenario");
  var cfg = state.invest[scenario];
  if(!cfg) return;
  var t = e.target;
  var matched = true;
  if(t.classList.contains("invest-initial")) cfg.initialAmount = Math.max(0, parseFloat(t.value) || 0);
  else if(t.classList.contains("invest-growth")) cfg.growthRatePct = parseFloat(t.value) || 0;
  else if(t.classList.contains("invest-manual-amount")) cfg.monthlyContribution = Math.max(0, parseFloat(t.value) || 0);
  else { matched = false; }
  if(!matched) return;

  patchInvestOutputs(panel, scenario);
  afterCalcChange(scenario);
}
function onInvestChange(e){
  var panel = e.target.closest("[data-invest-scenario]");
  if(!panel) return;
  var scenario = panel.getAttribute("data-invest-scenario");
  var cfg = state.invest[scenario];
  if(!cfg) return;
  var t = e.target;
  if(t.classList.contains("invest-enabled")){
    cfg.enabled = t.checked;
    // Mutually exclusive with the purchase leg — see computeNetWorthSeries()'s own precedence
    // for why having both enabled would double-count.
    if(cfg.enabled && state.purchase[scenario]) state.purchase[scenario].enabled = false;
  }
  else if(t.classList.contains("invest-assettype")){
    var oldType = cfg.assetType;
    var oldDefault = defaultInvestConfig(oldType).growthRatePct;
    cfg.assetType = t.value;
    // Only follow the new type's suggested rate if the field still held the old type's
    // default — a rate the user deliberately typed in is left alone, same reasoning as the
    // Transfer/Mortgage Registration fee re-sync on the purchase panel's state field.
    if((Number(cfg.growthRatePct) || 0) === oldDefault) cfg.growthRatePct = defaultInvestConfig(t.value).growthRatePct;
  }
  else if(t.classList.contains("invest-contribmode")) cfg.contributionMode = t.value;
  else return;

  recalcComputedItems();
  renderHomeBody();
  renderCards();
  renderDetail();
  renderAssets();
  persist();
}

export function wireCalculators(){
  document.getElementById("homeBody").addEventListener("input", onCalcInput);  // v3.189.0 (item 220): a scenario's calculators also work on the Calculators page.
  ["input", "change", "click"].forEach(function(type){
    var el = document.getElementById("calcScenarioBody");
    el.addEventListener(type, type === "input" ? onCalcInput : type === "change" ? onCalcChange : onCalcClick);
    if(type !== "click") el.addEventListener(type, type === "input" ? onInvestInput : onInvestChange);
  });
  document.getElementById("homeBody").addEventListener("change", onCalcChange);
  document.getElementById("homeBody").addEventListener("click", onCalcClick);
  document.getElementById("homeBody").addEventListener("input", onInvestInput);
  document.getElementById("homeBody").addEventListener("change", onInvestChange);
}
