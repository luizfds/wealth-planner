import { state } from "../state.js";

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
