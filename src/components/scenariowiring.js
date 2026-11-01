// ---------------- Plan → Scenarios, wired (v3.200.0, item 230) ----------------
//
// The event wiring for a scenario's changes, the "start from a question" sheet, a scenario on its own page
// (draft, Save / Cancel, the leave guard, "+ Add a change", the Calculators round trip) and Make it real —
// moved out of app.js as it was, listener for listener. app.js calls wireScenarioEditor() where this code
// used to sit; Home and Plan reach the question sheet, a scenario's page and a saved change through scenarioActions.
import { recalcComputedItems } from "../calc/engine.js";
import { applyMakeReal } from "../calc/makereal.js";
import { setAmountChange, removeChange, includeCandidates, changesFor } from "../calc/scenariochanges.js";
import { openDraft, saveDraft, draftChanged, discardDraft, resetChange, resetBuyInvest } from "../calc/scenariodraft.js";
import { newChange } from "../calc/scenariolegs.js";
import { buildScenario } from "../calc/scenariotemplates.js";
import { localDateStr } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { commit, genId, state, defaultHomeBlock, defaultPurchaseConfig, defaultInvestConfig } from "../state.js";
import { calcFor, calcQ, calcOutHtml } from "./calculators.js";
import { mrQ, makeRealSheetHtml } from "./makereal.js";
import { showPage, showPlanSubpage, setLeaveGuard } from "./nav.js";
import { renderProjectionsWhenSeen } from "./projections.js";
import { renderScenarioAccountChart, tryQ } from "./scenarioaccount.js";
import { changeOpen, addChangeSheetHtml, addSheet } from "./scenariochanges.js";
import { renderHomeBody, homeBlockCollapsed, addScenario, editing, renameScenarioTo, renderScenarioEditor, renderCalcScenario, editorUi, renderScenarioEditorChart, deleteScenario } from "./scenarios.js";
import { startQ, startSheetHtml, templateContext } from "./scenariotemplates.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";
import { withUndo, renderAll } from "./redraw.js";

// What Home and Plan call from here — the question sheet, a scenario's page, a change saved — filled in by
// wireScenarioEditor (v3.206.2, item 237b: exported rather than handed back to app.js).
export var scenarioActions = {};

export function wireScenarioEditor(){
  // ---------------- A scenario's changes (v3.172.0, item 207) ----------------
  // Plan → Scenarios: a line's amount in a scenario, kept in the scenario (calc/scenariochanges.js).
  // v3.206.0 (item 236b): the commit redraws the views that read scenarios (the home blocks, the cards, the
  // comparison) on the page on screen, the rest when opened; what isn't a view — the draft's editor, the
  // projection chart — is drawn here.
  function afterScenarioChange(){
    commit(["scenarioChanges", "scenarios", "purchase", "invest", "home"]);
    if(editing.key && editing.key !== editing.name) renderScenarioEditor();
    else renderProjectionsWhenSeen();
  }
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var add = e.target.closest("[data-sc-add]");
    if(add){
      var sc = add.getAttribute("data-sc-add"), box = add.closest(".sc-add");
      var rowId = box && box.querySelector("[data-sc-row]").value, amt = box && box.querySelector("[data-sc-new-amount]").value;
      if(!rowId){ showToast("Choose the line that would be different"); return; }
      if(amt === "" || isNaN(Number(amt))){ showToast("Type its amount in " + sc); box.querySelector("[data-sc-new-amount]").focus(); return; }
      setAmountChange(sc, rowId, Number(amt), function(){ return genId("chg"); });
      afterScenarioChange();
      return;
    }
    var del = e.target.closest("[data-sc-del]");
    if(del){
      var dsc = del.getAttribute("data-sc-scenario"), gone = removeChange(dsc, del.getAttribute("data-sc-del"));
      if(!gone) return;
      afterScenarioChange();
      showUndoToast("Removed the change", function(){ (state.scenarioChanges[dsc] = state.scenarioChanges[dsc] || []).push(gone); afterScenarioChange(); });
    }
  });
  // v3.173.0 (item 208): the other kinds of change — rent elsewhere, an investment property, a cost, a sale.
  var SC_NUMBERS = { amount: 1, fromYear: 1, whenAge: 1, whenCash: 1, rate: 1, price: 1, depositPct: 1, termYears: 1, rentWeekly: 1, vacancyWeeks: 1, mgmtPct: 1, costsYearly: 1, depreciationYearly: 1, sellingCostsPct: 1, firstRentedValue: 1 };
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var nb = e.target.closest("[data-sc-new]");
    if(nb){
      var sc = nb.getAttribute("data-sc-scenario");
      var c = newChange(nb.getAttribute("data-sc-new"), genId("chg"), { properties: state.properties, state: (state.purchase[sc] && state.purchase[sc].state) || "NSW", include: includeCandidates(sc)[0] });
      (state.scenarioChanges[sc] = changesFor(sc).slice()).push(c);
      changeOpen[c.id] = true;
      afterScenarioChange();
      var first = document.querySelector('[data-scf-id="' + c.id + '"]');
      if(first) first.focus();
      return;
    }
    var tg = e.target.closest("[data-sc-toggle]");
    if(tg){ var tid = tg.getAttribute("data-sc-toggle"); changeOpen[tid] = !changeOpen[tid]; renderHomeBody(); var again = document.querySelector('[data-sc-toggle="' + tid + '"]'); if(again) again.focus(); }
  });
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-scf]")) return;
    var sc = e.target.getAttribute("data-scf-scenario"), id = e.target.getAttribute("data-scf-id"), key = e.target.getAttribute("data-scf");
    var c = changesFor(sc).find(function(x){ return x.id === id; });
    if(!c) return;
    var v = e.target.value;
    c[key] = SC_NUMBERS[key] ? (v === "" ? 0 : Number(v)) : (key === "growthPct" ? (v === "" ? "" : Number(v)) : v);
    afterScenarioChange();
    var back = document.querySelector('[data-scf="' + key + '"][data-scf-id="' + id + '"]');
    if(back) back.focus();
  });
  document.addEventListener("change", function(e){
    if(!e.target.matches || !e.target.matches("[data-sc-amount]")) return;
    var sc = e.target.getAttribute("data-sc-scenario"), id = e.target.getAttribute("data-sc-amount");
    var c = (state.scenarioChanges[sc] || []).find(function(x){ return x.id === id; });
    if(!c || e.target.value === "" || isNaN(Number(e.target.value))) return;
    setAmountChange(sc, c.rowId, Number(e.target.value), function(){ return genId("chg"); });
    afterScenarioChange();
  });

  // ---------------- Start from a question (v3.174.0, item 209) ----------------
  var startSheetRoot = document.getElementById("startSheetRoot");
  function renderStartSheet(){
    startSheetRoot.innerHTML = startQ.open ? startSheetHtml() : "";
    var f = startQ.open && startSheetRoot.querySelector(startQ.key ? "[data-sq]" : "[data-sq-pick]:not([disabled])");
    if(f) f.focus();
  }
  function openStartSheet(){ startQ.open = true; startQ.key = null; renderStartSheet(); pushActiveOverlay(function(){ startQ.open = false; startQ.key = null; renderStartSheet(); }); }
  function makeScenarioFrom(built){
    var name = built.name, n = 2;
    while(state.scenarios.indexOf(name) !== -1) name = built.name + " (" + (n++) + ")";
    var st = templateContext().state;
    state.scenarios.push(name);
    // A scenario that rents somewhere new has its rent as a change; no $0 placeholder home rows beside it.
    var rents = (built.changes || []).some(function(c){ return c.kind === "rent"; });
    state.home[name] = built.home ? built.home.map(function(r){ return Object.assign({}, r); }) : rents ? [] : defaultHomeBlock();
    var pc = built.purchase;
    state.purchase[name] = pc ? Object.assign(defaultPurchaseConfig(pc.price, pc.depositPct, pc.rate, pc.termYears || 30, pc.state || st, true), pc) : defaultPurchaseConfig(0, 20, 6.0, 30, st, false);
    state.invest[name] = built.invest ? Object.assign(defaultInvestConfig(built.invest.assetType), built.invest) : defaultInvestConfig();
    state.scenarioChanges[name] = built.changes || [];
    homeBlockCollapsed[name] = false;
    recalcComputedItems();
    afterScenarioChange();
    return name;
  }
  startSheetRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-sq-close]") || e.target === e.target.closest("[data-sq-backdrop]")){ requestCloseActiveOverlay(); return; }
    var pick = e.target.closest("[data-sq-pick]");
    if(pick){ startQ.key = pick.getAttribute("data-sq-pick"); renderStartSheet(); return; }
    if(e.target.closest("[data-sq-back]")){ startQ.key = null; renderStartSheet(); return; }
    if(e.target.closest("[data-sq-blank]")){ requestCloseActiveOverlay(); setTimeout(function(){ var n = state.scenarios.length; addScenario(); if(state.scenarios.length > n) openScenarioEditor(state.scenarios[state.scenarios.length - 1]); }, 50); return; }
    if(e.target.closest("[data-sq-make]")){
      var answers = {};
      startSheetRoot.querySelectorAll("[data-sq]").forEach(function(el){ answers[el.getAttribute("data-sq")] = el.value; });
      var built = buildScenario(startQ.key, answers, Object.assign(templateContext(), { idFactory: function(){ return genId("chg"); } }));
      var made = makeScenarioFrom(built);
      requestCloseActiveOverlay();
      showToast('Made "' + made + '" — change anything in it, then Save');
      // v3.181.0: straight into its editor.
      setTimeout(function(){ openScenarioEditor(made); }, 250);
    }
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && startQ.open) requestCloseActiveOverlay(); });
  // ---------------- A scenario on its own page (v3.181.0, item 212) ----------------
  // Edits go to a draft (calc/scenariodraft.js) and only the page redraws; Save writes it back and
  // updates everything once; Cancel (or ← Scenarios) drops it, asking first if anything changed.
  function openScenarioEditor(name){
    if(state.scenarios.indexOf(name) === -1) return;
    var today = name === state.baselineScenario && !(state.home[name] || []).length;
    editing.name = name;
    editing.key = today ? name : openDraft(name);
    Object.keys(changeOpen).forEach(function(k){ delete changeOpen[k]; });
    commit(["scenarioChanges", "scenarios", "purchase", "invest", "home"]);
    showPage("scenario");
    window.scrollTo(0, 0);
  }
  function closeScenarioEditor(saved){
    var name = editing.name;
    editing.name = null; editing.key = null;
    calcFor.key = null; calcFor.name = null;
    recalcComputedItems();
    commit(["scenarioChanges", "scenarios", "purchase", "invest", "home"]);
    renderProjectionsWhenSeen();
    showPage("plan");
    showPlanSubpage("scenarios", { replace: true });
    if(saved) showToast('Saved "' + name + '"');
  }
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    if(e.target.closest("[data-sc-save]")){
      if(!editing.name) return;
      saveDraft(editing.name);
      closeScenarioEditor(true);
      return;
    }
    if(e.target.closest("[data-sc-cancel]")){
      if(!editing.name) return;
      if(editing.key !== editing.name && draftChanged(editing.name) && !confirm('Discard the changes to "' + editing.name + '"?')) return;
      if(editing.key !== editing.name) discardDraft(editing.name);
      closeScenarioEditor(false);
    }
  });

  // v3.194.0 (item 225): renamed in place (its draft goes with it), and a note on why.
  document.addEventListener("change", function(e){
    if(!e.target.matches || !editing.name) return;
    if(e.target.matches("[data-sc-rename-inline]")){
      var done = renameScenarioTo(editing.name, e.target.value);
      if(!done){ e.target.value = editing.name; return; }
      renderScenarioEditor();
      showToast('Renamed to "' + done + '"');
    }
  });
  document.addEventListener("input", function(e){
    if(!e.target.matches || !e.target.matches("[data-sc-note]") || !editing.name) return;
    if(!state.scenarioNotes) state.scenarioNotes = {};
    var v = e.target.value.trim();
    if(v) state.scenarioNotes[editing.name] = e.target.value; else delete state.scenarioNotes[editing.name];
    e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px";
    commit(["scenarioNotes"]);
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Enter" && e.target.matches && e.target.matches("[data-sc-rename-inline]")) e.target.blur(); });
  // v3.191.0 (item 222): one change, or the buying / investing, back to as saved.
  document.addEventListener("click", function(e){
    if(!e.target.closest || !editing.name || editing.key === editing.name) return;
    var r = e.target.closest("[data-sc-reset]");
    if(r){ resetChange(editing.name, r.getAttribute("data-sc-reset")); afterScenarioChange(); return; }
    if(e.target.closest("[data-sc-reset-buy]")){ resetBuyInvest(editing.name); recalcComputedItems(); afterScenarioChange(); }
  });
  // v3.190.0 (item 221): the sheet of changes to add. A kind's button is an ordinary [data-sc-new], so the
  // handler that adds changes adds it; the sheet just closes.
  var addChangeRoot = document.getElementById("addChangeRoot");
  function renderAddSheet(){ addChangeRoot.innerHTML = addChangeSheetHtml(); var f = addChangeRoot.querySelector("[data-sc-new]:not([disabled])"); if(f) f.focus(); }
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-sc-addsheet]");
    if(!b) return;
    addSheet.open = true; addSheet.scenario = b.getAttribute("data-sc-addsheet"); renderAddSheet();
    pushActiveOverlay(function(){ addSheet.open = false; renderAddSheet(); });
  });
  addChangeRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-acs-close]") || e.target === e.target.closest("[data-acs-backdrop]")){ requestCloseActiveOverlay(); return; }
    if(e.target.closest("[data-sc-new]")) setTimeout(function(){ if(addSheet.open) requestCloseActiveOverlay(); }, 0);
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && addSheet.open){ e.preventDefault(); requestCloseActiveOverlay(); } });

  // v3.189.0 (item 220): the scenario's calculators on their own page, and back; the standalone ones.
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    if(e.target.closest("[data-sc-calc]") && editing.key){ calcFor.key = editing.key; calcFor.name = editing.name; showPage("calc"); window.scrollTo(0, 0); return; }
    if(e.target.closest("[data-calc-done]")){ calcFor.key = null; calcFor.name = null; renderCalcScenario(); showPage("scenario"); window.scrollTo(0, 0); }
  });
  document.addEventListener("input", function(e){
    var path = e.target.getAttribute && e.target.getAttribute("data-cq");
    if(!path) return;
    var parts = path.split("."), v = e.target.value;
    calcQ[parts[0]][parts[1]] = e.target.tagName === "SELECT" ? v : (v === "" ? 0 : Number(v));
    // v3.198.0: the household's dependants are kept — the lender check in Side by side counts them too.
    if(path === "bp.dependants"){ state.dependants = Math.max(0, Math.floor(Number(v) || 0)); commit(["dependants"]); }
    var out = document.querySelector('[data-cq-out="' + parts[0] + '"]');
    if(out) out.innerHTML = calcOutHtml(parts[0]);
  });
  document.addEventListener("change", function(e){
    if(e.target.matches && e.target.matches("select[data-cq]")) e.target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // v3.188.0 (item 219): unsaved changes aren't lost by a tap elsewhere, the back button or closing the app.
  function unsavedDraft(){ return !!(editing.name && editing.key !== editing.name && draftChanged(editing.name)); }
  setLeaveGuard(function(){
    if(!unsavedDraft()) return true;
    return confirm('"' + editing.name + '" has unsaved changes. Leave and keep them as a draft for later? (Cancel stays here.)');
  });
  window.addEventListener("beforeunload", function(e){ if(unsavedDraft()){ e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("keydown", function(e){
    if(document.body.getAttribute("data-current-page") !== "scenario" || !editing.name) return;
    if((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")){
      e.preventDefault();
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); // a field's change lands first
      var save = document.querySelector("#scenarioEditHead .sc-edit-actions [data-sc-save]");
      if(save && !save.disabled) save.click();
      return;
    }
    if(e.key === "Escape" && !e.defaultPrevented && !document.querySelector(".review-backdrop") && !(document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))){
      var cancel = document.querySelector("#scenarioEditHead .sc-edit-actions [data-sc-cancel]");
      if(cancel) cancel.click();
    }
  });
  // v3.187.0 (item 218): the results' fold keeps its state while the page redraws.
  document.addEventListener("toggle", function(e){ if(e.target.matches && e.target.matches("[data-sc-more]")){ editorUi.moreOpen = e.target.open; if(e.target.open && editing.key){ renderScenarioEditorChart(); renderScenarioAccountChart(editing.key); } } }, true);
  // v3.185.0 (item 216): which account the scenario is tried on, and from when.
  document.addEventListener("change", function(e){
    if(!e.target.matches) return;
    if(e.target.matches("[data-try-account]")){ tryQ.accountId = e.target.value; renderScenarioEditor(); }
    else if(e.target.matches("[data-try-settle]")){ tryQ.settleOn = e.target.value || null; renderScenarioEditor(); }
    else if(e.target.matches("[data-try-settlement]")){ tryQ.settlementHere = e.target.checked; renderScenarioEditor(); }
  });

  // ---------------- Make it real (v3.176.0, item 211) ----------------
  var makeRealRoot = document.getElementById("makeRealRoot");
  function renderMakeReal(){
    makeRealRoot.innerHTML = mrQ.open ? makeRealSheetHtml() : "";
    var f = mrQ.open && makeRealRoot.querySelector("[data-mr-apply], [data-mr-close]");
    if(f) f.focus();
  }
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-make-real]");
    if(!b) return;
    e.stopPropagation();
    mrQ.open = true; mrQ.name = b.getAttribute("data-make-real"); mrQ.removeAfter = true;
    renderMakeReal();
    pushActiveOverlay(function(){ mrQ.open = false; renderMakeReal(); });
  });
  makeRealRoot.addEventListener("change", function(e){ if(e.target.matches("[data-mr-remove]")) mrQ.removeAfter = e.target.checked; });
  makeRealRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-mr-close]") || e.target === e.target.closest("[data-mr-backdrop]")){ requestCloseActiveOverlay(); return; }
    if(!e.target.closest("[data-mr-apply]")) return;
    var name = mrQ.name, remove = mrQ.removeAfter;
    requestCloseActiveOverlay();
    withUndo('Made "' + name + '" real', function(){
      applyMakeReal(state, name, localDateStr(), genId);
      if(remove && name !== state.baselineScenario && state.scenarios.length > 1) deleteScenario(name);
      else state.scenarioChanges[name] = [];
      recalcComputedItems();
    });
    renderAll();
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && mrQ.open) requestCloseActiveOverlay(); });

  scenarioActions.openStartSheet = openStartSheet;
  scenarioActions.openScenarioEditor = openScenarioEditor;
  scenarioActions.afterScenarioChange = afterScenarioChange;
}
