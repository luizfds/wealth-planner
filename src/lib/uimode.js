import { state } from "../state.js";
import { PERIODS, INCOME_COL_DEFS } from "../constants.js";

export function applyPeriodVisibility(){
  var show = state.showAllPeriods;
  document.querySelectorAll(".period-col").forEach(function(el){
    var isHiddenByDefault = PERIODS.find(function(p){ return p.key === el.getAttribute("data-period"); }).hidden;
    el.classList.toggle("hidden-period", isHiddenByDefault && !show);
  });
  INCOME_COL_DEFS.forEach(function(c){
    var visible = state.incomeCols[c.key] !== false;
    document.querySelectorAll(".col-" + c.key).forEach(function(el){
      el.classList.toggle("col-hidden", !visible);
    });
  });
  var expAcctVisible = !!state.expenseCols.account;
  document.querySelectorAll(".col-account-exp").forEach(function(el){
    el.classList.toggle("col-hidden", !expAcctVisible);
  });
  var expClassVisible = !!state.expenseCols.classification;
  document.querySelectorAll(".col-classification").forEach(function(el){
    el.classList.toggle("col-hidden", !expClassVisible);
  });
  var homeAcctVisible = !!state.homeCols.account;
  document.querySelectorAll(".col-account-home").forEach(function(el){
    el.classList.toggle("col-hidden", !homeAcctVisible);
  });
}

export function syncUiModeToggle(){
  document.getElementById("uiModeToggle").checked = state.uiMode === "modern";
  document.getElementById("mobileLayoutBtn").textContent = "Layout: " + (state.uiMode === "modern" ? "Modern" : "Classic");
  // The column picker/toggle only makes sense for the classic table's fixed columns — modern
  // rows already show every field, just tucked behind an expand instead of hidden by a toggle.
  ["incomeColPicker", "expenseColPicker", "homeAcctToggleWrap", "periodsToggleWrap", "mobilePeriodsToggleWrap"].forEach(function(id){
    var picker = document.getElementById(id);
    if(picker) picker.hidden = state.uiMode === "modern";
  });
}
