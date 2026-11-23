import { confirmDialog } from "../lib/dialogs.js";
import { requestCloseActiveOverlay } from "../lib/overlaystack.js";
// ---------------- Budget tools, wired (v3.206.1, item 237) ----------------
//
// What the app notices and Ask Claude, Cash flow → Budget → Trim, a budget from history and recurring payments.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { adviceFor } from "../calc/advice.js";
import { householdSummary } from "../calc/aisummary.js";
import { proposeBudget, applyBudgetProposals } from "../calc/budgetfromhistory.js";
import { recalcComputedItems } from "../calc/engine.js";
import { learnRule } from "../calc/import-rules.js";
import { unbudgetedRecurring, risingLines, catchAllSuggestions } from "../calc/recurring.js";
import { recurringRuleManagerHtml, validateRecurringRule, approvedOccurrences, categoryInsightsHtml, upsertRecurringRule, toggleRecurringRule, deleteRecurringRule, recordApprovedOccurrences } from "./recurringrules.js";
import { setLeanLevel, leanLevel, trimReport, setLinesToSpending } from "../calc/trim.js";
import { fmtCurrency0, fmtCurrency2, localDateStr, fmtDate } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, commit, genId } from "../state.js";
import { setNoticeDismissed } from "../lib/attention.js";
import { refreshNotifPanel } from "./notifpanel.js";
import { renderAdvice, adviceUi } from "./advice.js";
import { askUi, cancelAiApproval, setAiKey, setAiModel, askClaude, setLastReview, copyPrompt, askBody } from "./askclaude.js";
import { budgetFromHistoryHtml, historyBudgetUi } from "./budgethistory.js";
import { loggableBudgetLineItems, budgetLineItems } from "./expenses.js";
import { taxUi } from "./income.js";
import { showPage, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showTaxSubpage, showPlanSubpage } from "./nav.js";
import { recurringHtml, recurringDismissed, recurringOpen, catchAllShown } from "./recurring.js";
import { renderAll } from "./redraw.js";
import { refreshAfterLedgerChange } from "./rows.js";
import { renderPeopleTab } from "./taxwiring.js";
import { renderTrim, trimUi, trimScenario } from "./trim.js";
import { renderTidy, tidyUi, currentStrays } from "./tidy.js";
import { renderBudgetSplit, budgetSplitUi, budgetSplitModel } from "./budgetsplit.js";
import { applyInboxAction } from "../calc/tidyinbox.js";
import { renderAdjust, adjustUi, adjustModel } from "./adjustplan.js";
import { applyAdjust } from "../calc/adjustplan.js";
import { classWord } from "../constants.js";
import { lineMerchants, moveTransactions, setTransactionsClass, undoChanges, markTidyOk, tidyMove, TIDY_MONTHS } from "../calc/tidy.js";

var trimBody;
var editingRecurringRule = null;

function afterTrimChange(){ recalcComputedItems(); persist(); renderAll(); }
// ---------------- Cash flow → Budget → Recurring payments (v3.66.0) ----------------
function currentRecurring(){
  return { u: unbudgetedRecurring(state.transactions, localDateStr()), r: risingLines(loggableBudgetLineItems(), state.transactions),
    c: catchAllSuggestions(loggableBudgetLineItems(), state.transactions, localDateStr()) };
}
// v3.115.0: Budget → Build from what you've spent.
function currentHistoryBudget(){ return proposeBudget(state.transactions, budgetLineItems(), localDateStr()); }
function renderBudgetFromHistory(){
  var el = document.getElementById("historyBudgetBody");
  if(!el) return;
  var r = currentHistoryBudget();
  el.innerHTML = budgetFromHistoryHtml(r);
  var cnt = document.getElementById("historyBudgetCount");
  if(cnt) cnt.textContent = r.ready && r.proposals.length ? r.proposals.length + " to add" : "";
}
function renderRecurring(force){
  var el = document.getElementById("recurringBody");
  if(!el) return;
  // Background redraws must not discard a rule while its form is being edited.
  var form = el.querySelector("#recurringRuleForm");
  if(!force && form && form.closest("details").open) return;
  var c = currentRecurring();
  el.innerHTML = recurringHtml(c.u, c.r, c.c, state.transactions) + recurringRuleManagerHtml(state.recurringRules || [], state.transactions, state.incomeLog, localDateStr(), editingRecurringRule) + categoryInsightsHtml(state.transactions, localDateStr());
  var n = c.u.filter(function(x){ return !recurringDismissed.keys["u:" + x.key]; }).length + c.r.filter(function(x){ return !recurringDismissed.keys["r:" + x.id + ":" + x.recent]; }).length + catchAllShown(c.c);
  var cnt = document.getElementById("recurringCount");
  if(cnt) cnt.textContent = n ? n + " to look at" : "";
}

export function wireAdvice(){
  // ---------------- What the app notices + Ask Claude (v3.98.0) ----------------
  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-adv-id]")) adviceUi.open[e.target.getAttribute("data-adv-id")] = e.target.open;
    if(e.target.matches && e.target.matches("[data-adv-good]")) adviceUi.goodOpen = e.target.open;
    if(e.target.matches && e.target.matches("[data-adv-away]")) adviceUi.awayOpen = e.target.open;
    if(e.target.matches && e.target.matches("[data-tax-household]")) taxUi.householdOpen = e.target.open;
  }, true);
  document.addEventListener("change", function(e){
    if(e.target.matches && e.target.matches("[data-ai-model]")) setAiModel(e.target.value);
  });
  document.addEventListener("input", function(e){
    if(e.target.matches && e.target.matches("[data-ai-q]")){ askUi.question = e.target.value; askUi.approvalPending = false; }
  });
  document.addEventListener("click", async function(e){
    if(!e.target.closest) return;
    // #305: put an observation away, or bring it back — on Insights and in the bell. Its commit redraws the lists.
    var put = e.target.closest("[data-notice-dismiss], [data-notice-restore]");
    if(put){
      var away = put.hasAttribute("data-notice-dismiss");
      setNoticeDismissed(put.getAttribute(away ? "data-notice-dismiss" : "data-notice-restore"), away);
      commit(["noticesDismissed"]);
      refreshNotifPanel();
      showToast(away ? "Put away — it comes back if its figures change" : "Back in the list");
      return;
    }
    var go = e.target.closest("[data-adv-go]");
    if(go){
      var pg = go.getAttribute("data-adv-go"), sub = go.getAttribute("data-adv-sub");
      showPage(pg);
      if(sub){
        if(pg === "dashboard") showDashboardSubpage(sub, { replace: true });
        else if(pg === "expenses") showExpensesSubpage(sub, { replace: true });
        else if(pg === "plan") showPlanSubpage(sub, { replace: true });
        else if(pg === "assets") showAssetsSubpage(sub, { replace: true });
        // v3.148.0: Tax's tabs too (the withholding-variation advice opens People).
        else if(pg === "tax"){ showTaxSubpage(sub, { replace: true }); if(sub === "people") renderPeopleTab(); }
      }
      return;
    }
    if(e.target.closest("[data-ai-save-key]")){
      var k = document.querySelector("[data-ai-key]");
      var v = k ? k.value.trim() : "";
      if(!/^sk-ant-/.test(v)){ showToast("That doesn't look like an Anthropic API key (they start sk-ant-)"); return; }
      setAiKey(v); renderAdvice(); showToast("Key saved in this browser only");
      return;
    }
    if(e.target.closest("[data-ai-forget]")){ setAiKey(""); cancelAiApproval(); renderAdvice(); showToast("Key removed from this browser"); return; }
    if(e.target.closest("[data-ai-cancel]")){ cancelAiApproval(); renderAdvice(); return; }
    if(e.target.closest("[data-ai-preview]")){
      if(askUi.preview){ cancelAiApproval(); }
      else { askUi.preview = copyPrompt(householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() }), ""); askUi.approvalPending = false; }
      renderAdvice();
      return;
    }
    // v3.99.0: the prompt for any assistant, to the clipboard; the answer pasted back.
    if(e.target.closest("[data-ai-copy]")){
      var text = copyPrompt(householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() }), "");
      if(askUi.preview !== text){
        askUi.preview = text; askUi.approvalPending = true; renderAdvice();
        showToast("Review the exact prompt, then press Copy for any AI again");
        return;
      }
      if(!(await confirmDialog("Copy the displayed financial figures for sharing with an external AI? Aggregated figures may still identify you.", {"title":"Share financial figures","accept":"Copy figures"}))){ cancelAiApproval(); renderAdvice(); return; }
      askUi.approvalPending = false;
      var fallback = function(){
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch(err){}
        document.body.removeChild(ta);
        return ok;
      };
      var done = function(ok){
        askUi.pasteOpen = true; renderAdvice();
        showToast(ok ? "Copied — paste it into any AI, then paste its answer back here" : "Couldn't copy — open the preview and copy it from there");
      };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallback()); });
      else done(fallback());
      return;
    }
    if(e.target.closest("[data-ai-paste-toggle]")){ askUi.pasteOpen = !askUi.pasteOpen; renderAdvice(); return; }
    if(e.target.closest("[data-ai-save-paste]")){
      var pa = document.querySelector("[data-ai-paste]"), src = document.querySelector("[data-ai-source]");
      var answer = pa ? pa.value.trim() : "";
      if(answer.length < 40){ showToast("Paste the assistant's whole answer first"); return; }
      setLastReview({ at: localDateStr(), question: askUi.question.trim(), text: answer, source: src ? src.value.trim().slice(0, 40) : "" });
      askUi.pasteOpen = false; askUi.preview = ""; renderAdvice();
      showToast("Answer saved on this device");
      return;
    }
    if(e.target.closest("[data-ai-ask]")){
      if(askUi.busy) return;
      var q = "";
      var summary = householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() });
      var payload = JSON.stringify(askBody(summary, q), null, 2);
      if(!askUi.approvalPending || askUi.preview !== payload){
        askUi.preview = payload; askUi.approvalPending = true; renderAdvice();
        showToast("Review the data preview, then press Confirm & send to Claude");
        return;
      }
      if(!(await confirmDialog("Send exactly the displayed aggregate financial figures to Anthropic? Financial figures can still be identifying.", {"title":"Share financial figures","accept":"Send to Anthropic"}))){ cancelAiApproval(); renderAdvice(); return; }
      var approvedPayload = askUi.preview;
      askUi.approvalPending = false;
      askUi.busy = true; askUi.error = ""; renderAdvice();
      askClaude(summary, "", approvedPayload).then(function(text){
        setLastReview({ at: localDateStr(), question: "", text: text });
        askUi.busy = false; askUi.preview = ""; renderAdvice();
      }).catch(function(err){
        askUi.busy = false;
        askUi.error = "Couldn't get a review: " + (err && err.message ? err.message : "no connection") + ".";
        renderAdvice();
      });
    }
  });
  // ---------------- Cash flow → Budget → Trim (v3.100.0) ----------------
  trimBody = document.getElementById("trimBody");
  trimBody.addEventListener("click", function(e){
    var one = e.target.closest("[data-trim-set]");
    if(one){
      var line = state.shared.find(function(l){ return l.id === one.getAttribute("data-trim-set"); });
      if(!line) return;
      var was = line.amount;
      line.amount = Number(one.getAttribute("data-trim-to")) || 0;
      afterTrimChange();
      showUndoToast((line.what || "Line") + " set to what you spend", function(){ line.amount = was; afterTrimChange(); });
      return;
    }
    if(e.target.closest("[data-trim-set-all]")){
      var rep = trimReport({ today: localDateStr() });
      var before = setLinesToSpending(state, rep.over.concat(rep.under || []));
      afterTrimChange();
      var net = rep.overYearly - (rep.underYearly || 0);
      showUndoToast(before.length + " lines set to what you spend — " + fmtCurrency0.format(Math.abs(net)) + "/yr " + (net >= 0 ? "out of" : "into") + " the plan", function(){ before.forEach(function(b){ b.l.amount = b.was; }); afterTrimChange(); });
      return;
    }
    var lv = e.target.closest("[data-trim-level]");
    if(lv){
      var ln = state.shared.find(function(l){ return l.id === lv.getAttribute("data-trim-line"); });
      if(!ln) return;
      setLeanLevel(ln, trimScenario(), lv.getAttribute("data-trim-level"));
      afterTrimChange();
      return;
    }
    if(e.target.closest("[data-trim-clear]")){
      var sc = trimScenario();
      state.shared.forEach(function(l){ var k = leanLevel(l, sc); if(k === "half" || k === "pause") setLeanLevel(l, sc, "keep"); });
      afterTrimChange();
    }
  });
  trimBody.addEventListener("change", function(e){
    if(e.target.matches("[data-trim-scenario]")){ trimUi.scenario = e.target.value; renderTrim(); return; }
    if(e.target.matches("[data-trim-flex]")){
      var l = state.shared.find(function(x){ return x.id === e.target.getAttribute("data-trim-flex"); });
      if(!l) return;
      l.flexible = !!e.target.checked;
      trimUi.markOpen = true;
      persist(); renderTrim(); renderAdvice();
    }
  });
  trimBody.addEventListener("toggle", function(e){ if(e.target.matches && e.target.matches("[data-trim-mark]")) trimUi.markOpen = e.target.open; }, true);
}

export function wireBudgetHistory(){  document.getElementById("historyBudgetBody").addEventListener("change", function(e){
    var k = e.target.getAttribute && e.target.getAttribute("data-bh-key");
    if(k == null) return;
    if(e.target.checked) delete historyBudgetUi.off[k]; else historyBudgetUi.off[k] = true;
    renderBudgetFromHistory();
  });
  document.getElementById("historyBudgetBody").addEventListener("click", function(e){
    if(!e.target.closest("[data-bh-apply]")) return;
    var chosen = currentHistoryBudget().proposals.filter(function(p){ return !historyBudgetUi.off[p.key]; });
    if(!chosen.length) return;
    var before = { shared: state.shared.length, tx: state.transactions.map(function(t){ return [t.linkedExpenseId, t.category]; }) };
    var made = applyBudgetProposals(state, chosen, function(){ return genId("exp"); });
    refreshAfterLedgerChange("shared");
    renderBudgetFromHistory();
    showUndoToast("Added " + made.length + " budget line" + (made.length === 1 ? "" : "s"), function(){
      state.shared.splice(before.shared, made.length);
      state.transactions.forEach(function(t, i){ if(before.tx[i]){ t.linkedExpenseId = before.tx[i][0]; t.category = before.tx[i][1]; } });
      refreshAfterLedgerChange("shared");
      renderBudgetFromHistory();
    });
  });  // v3.95.0: a row's transactions, built only when opened.
  document.getElementById("recurringBody").addEventListener("toggle", function(e){
    if(!e.target.matches || !e.target.matches("[data-rc-tx]")) return;
    var k = e.target.getAttribute("data-rc-tx");
    if(!!recurringOpen.keys[k] === e.target.open) return;
    recurringOpen.keys[k] = e.target.open;
    renderRecurring();
    renderBudgetFromHistory();
  }, true);
  document.getElementById("recurringBody").addEventListener("click", function(e){
    var dis = e.target.closest("[data-rc-dismiss]");
    if(dis){ recurringDismissed.keys[dis.getAttribute("data-rc-dismiss")] = true; renderRecurring(); return; }
    var add = e.target.closest("[data-rc-add]");
    if(add){
      var x = currentRecurring().u.find(function(y){ return y.key === add.getAttribute("data-rc-add"); });
      if(!x) return;
      var lastTx = state.transactions[x.indices[x.indices.length - 1]] || {};
      var line = { id: genId("exp"), what: x.name, classification: "Wants", category: x.category || "", account: lastTx.account || "", amount: x.amount, freq: x.freq, irregular: false, dueMonth: null };
      state.shared.push(line);
      x.indices.forEach(function(i){ if(state.transactions[i]){ state.transactions[i].linkedExpenseId = line.id; state.transactions[i].category = ""; } });
      persist(); renderAll();
      showUndoToast("Added " + line.what + " to the budget and linked " + x.count + " charges", function(){
        x.indices.forEach(function(i){ if(state.transactions[i] && state.transactions[i].linkedExpenseId === line.id) state.transactions[i].linkedExpenseId = null; });
        state.shared = state.shared.filter(function(l){ return l.id !== line.id; });
        persist(); renderAll();
      });
      return;
    }
    var split = e.target.closest("[data-rc-split]");
    if(split){
      var sg = currentRecurring().c.find(function(y){ return y.id === split.getAttribute("data-rc-split"); });
      if(!sg) return;
      var from = loggableBudgetLineItems().find(function(l){ return l.id === sg.lineId; }) || {};
      var target = sg.existingLineId, created = null;
      if(!target){
        var cats = (state.categories || []).map(function(c){ return typeof c === "string" ? c : c && c.name; });
        var lastT = state.transactions[sg.indices[sg.indices.length - 1]] || {};
        created = { id: genId("exp"), what: sg.name, classification: "Wants", category: sg.category && cats.indexOf(sg.category) !== -1 ? sg.category : (from.category || ""),
          account: lastT.account || from.account || "", amount: Math.round(sg.monthly), freq: "Monthly", irregular: false, dueMonth: null };
        state.shared.push(created);
        target = created.id;
      }
      var rulesBefore = JSON.parse(JSON.stringify(state.importRules || []));
      sg.indices.forEach(function(i){ if(state.transactions[i]) state.transactions[i].linkedExpenseId = target; });
      if(!state.importRules) state.importRules = [];
      sg.keys.forEach(function(k){ learnRule(state.importRules, k, { linkedExpenseId: target }, function(){ return genId("rule"); }); });
      persist(); renderAll();
      showUndoToast("Moved " + sg.count + " purchases to " + (created ? created.what : sg.existingWhat) + " — future imports go there too", function(){
        sg.indices.forEach(function(i){ if(state.transactions[i] && state.transactions[i].linkedExpenseId === target) state.transactions[i].linkedExpenseId = sg.lineId; });
        if(created) state.shared = state.shared.filter(function(l){ return l.id !== created.id; });
        state.importRules = rulesBefore;
        persist(); renderAll();
      });
      return;
    }
    var up = e.target.closest("[data-rc-update]");
    if(up){
      var item = loggableBudgetLineItems().find(function(l){ return l.id === up.getAttribute("data-rc-update"); });
      if(!item) return;
      var was = item.amount, to = Number(up.getAttribute("data-rc-to"));
      item.amount = to;
      recalcComputedItems(); persist(); renderAll();
      showUndoToast((item.what || "Line") + " updated to " + fmtCurrency2.format(to), function(){ item.amount = was; recalcComputedItems(); persist(); renderAll(); });
    }
  });
  // Rule management is local-first; never post a scheduled occurrence without an explicit confirmation.
  document.getElementById("recurringBody").addEventListener("submit", function(e){
    if(e.target.id !== "recurringRuleForm") return;
    e.preventDefault();
    var form = e.target;
    var fields = new FormData(form);
    var original = (state.recurringRules || []).find(function(r){ return r.id === editingRecurringRule; });
    var rule = validateRecurringRule({
      id: original ? original.id : genId("rec"),
      what: fields.get("what"), kind: fields.get("kind"), amount: fields.get("amount"),
      frequency: fields.get("frequency"), intervalDays: fields.get("intervalDays"),
      startDate: fields.get("startDate"), endDate: fields.get("endDate"),
      category: fields.get("category"), enabled: original ? original.enabled : true
    });
    if(!rule){ showToast("Check the recurrence dates, amount and frequency."); return; }
    upsertRecurringRule(state, rule);
    editingRecurringRule = null;
    commit(["recurringRules"]); renderRecurring(true);
    showToast("Recurring rule saved locally. No transactions have been created.");
  });
  document.getElementById("recurringBody").addEventListener("click", async function(e){
    var action = e.target.closest("[data-rr-edit],[data-rr-preview],[data-rr-toggle],[data-rr-delete]");
    if(!action) return;
    var id = action.getAttribute("data-rr-edit") || action.getAttribute("data-rr-preview") ||
      action.getAttribute("data-rr-toggle") || action.getAttribute("data-rr-delete");
    var rule = (state.recurringRules || []).find(function(r){ return r.id === id; });
    if(!rule) return;
    if(action.hasAttribute("data-rr-edit")){ editingRecurringRule = id; renderRecurring(true); return; }
    if(action.hasAttribute("data-rr-toggle")){
      toggleRecurringRule(state, id);
      commit(["recurringRules"]); renderRecurring(true); return;
    }
    if(action.hasAttribute("data-rr-delete")){
      if(!(await confirmDialog("Delete this recurring rule? Previously recorded transactions will remain.", {"title":"Delete recurring rule","accept":"Delete rule","danger":true}))) return;
      deleteRecurringRule(state, id);
      if(editingRecurringRule === id) editingRecurringRule = null;
      commit(["recurringRules"]); renderRecurring(true); return;
    }
    if(rule.enabled === false){ showToast("Resume the rule before previewing occurrences."); return; }
    var today = localDateStr();
    var from = new Date(Date.parse(today + "T00:00:00Z") - 60 * 86400000).toISOString().slice(0, 10);
    var pending = approvedOccurrences(rule, state.transactions, state.incomeLog, from, today);
    if(!pending.length){ showToast("No unrecorded occurrences in the last 60 days."); return; }
    if(pending.length > 30){ showToast("Too many occurrences to approve at once. Narrow the rule interval."); return; }
    var details = pending.map(function(x){ return fmtDate(x.date, { year: true }) + " — " + x.what + " — $" + x.amount.toFixed(2); }).join("\n");
    if(!(await confirmDialog("Record these " + pending.length + " " + rule.kind.toLowerCase() + " occurrence(s)?\n\n" +
      details + "\n\nOnly confirm if these payments actually occurred. Check imported transactions to avoid double-counting.", {"title":"Record past payments","accept":"Record payments"}))) return;
    // Recompute at the write boundary: repeated clicks cannot duplicate a recorded rule/date.
    var count = recordApprovedOccurrences(state, rule, from, today);
    commit([rule.kind === "Income" ? "incomeLog" : "transactions"]); renderAll();
    showToast("Recorded " + count + " approved occurrence(s).");
  });
}

export { currentHistoryBudget, renderBudgetFromHistory, renderRecurring };

// ---------------- Money → Budget → Tidy up (November 2026) ----------------
// Every change is one commit with an undo; a move can also create a line and teach the import, and the undo takes
// back all three.
function tidyOpenGroup(){
  if(!tidyUi.lineId || tidyUi.openKey == null) return null;
  return lineMerchants(state.transactions, tidyUi.lineId, { today: localDateStr() }).find(function(g){ return g.key === tidyUi.openKey; }) || null;
}
function tidyTicked(g){ return g ? g.txIds.filter(function(id){ return tidyUi.picked[id] !== false; }) : []; }
function tidyResetShop(){ tidyUi.picked = {}; tidyUi.moveTo = ""; tidyUi.newName = ""; }
function tidyLineName(id){ var l = budgetLineItems().find(function(x){ return x.id === id; }); return (l && l.what) || "the line"; }
function openTidyAt(lineId, key){
  tidyUi.lineId = lineId || ""; tidyUi.openKey = key == null ? null : key; tidyResetShop();
  var card = document.getElementById("tidyCard");
  if(card) card.open = true;
  renderTidy();
  var target = key != null ? document.querySelector('#tidyBody .tidy-shop.open') : document.querySelector("#tidyBody .tidy-pick");
  var focusEl = key != null ? document.querySelector('#tidyBody .tidy-shop.open .tidy-shop-head') : document.querySelector("#tidyBody [data-tidy-line]");
  if(focusEl) focusEl.focus({ preventScroll: true });
  alignTo(target);
}
// Straight there, then again once the page settles. A smooth scroll aims once at the start: views drawn as they come
// into sight, and a row folding back into its list, then move the target — on a phone it ended 600px past it.
function alignTo(target){
  if(!target || !target.scrollIntoView) return;
  target.scrollIntoView({ block: "start" });
  [120, 450].forEach(function(ms){
    setTimeout(function(){
      if(!target.isConnected) return;
      var top = target.getBoundingClientRect().top;
      if(top < 40 || top > window.innerHeight / 2) target.scrollIntoView({ block: "start" });
    }, ms);
  });
}
// Move one misfiled purchase group (by its id) — or all of them (null) — to its usual line; with an undo.
function tidyMoveStrays(id){
  var all = currentStrays();
  var chosen = id == null ? all : all.filter(function(s){ return s.id === id; });
  if(!chosen.length) return;
  var undo = [];
  chosen.forEach(function(s){ undo = undo.concat(moveTransactions(state.transactions, s.txIds, s.toLineId)); });
  commit(["transactions"]);
  showUndoToast(chosen.length === 1 ? "Moved " + chosen[0].label + " to " + tidyLineName(chosen[0].toLineId) : "Moved " + undo.length + " purchases to their usual lines",
    function(){ undoChanges(undo); commit(["transactions"]); });
}
function tidyKeepStray(id){
  var undoOk = markTidyOk(state, id);
  commit(["tidyOk"]);
  showUndoToast("Kept where it is — it won't be asked again", function(){ undoOk(); commit(["tidyOk"]); });
}
export function wireTidy(){
  var body = document.getElementById("tidyBody");
  body.addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b || b.disabled) return;
    if(b.hasAttribute("data-tidy-move") || b.hasAttribute("data-tidy-move-all")){ tidyMoveStrays(b.hasAttribute("data-tidy-move-all") ? null : b.getAttribute("data-tidy-move")); return; }
    if(b.hasAttribute("data-tidy-ok")){ tidyKeepStray(b.getAttribute("data-tidy-ok")); return; }
    if(b.hasAttribute("data-tidy-see")){ openTidyAt(b.getAttribute("data-tidy-see"), b.getAttribute("data-tidy-key")); return; }
    if(b.hasAttribute("data-tidy-pick")){ openTidyAt(b.getAttribute("data-tidy-pick"), null); return; }
    if(b.hasAttribute("data-tidy-more")){ tidyUi.showAllStrays = !tidyUi.showAllStrays; renderTidy(); return; }
    if(b.hasAttribute("data-tidy-shop")){
      var k = b.getAttribute("data-tidy-shop");
      tidyUi.openKey = tidyUi.openKey === k ? null : k; tidyResetShop();
      renderTidy();
      var head = body.querySelector('[data-tidy-shop="' + CSS.escape(k) + '"]');
      if(head) head.focus();
      return;
    }
    var g = tidyOpenGroup();
    if(!g) return;
    if(b.hasAttribute("data-tidy-tick")){
      var on = b.getAttribute("data-tidy-tick") === "all";
      g.txIds.forEach(function(x){ if(on) delete tidyUi.picked[x]; else tidyUi.picked[x] = false; });
      renderTidy();
      return;
    }
    var ids = tidyTicked(g);
    if(!ids.length) return;
    if(b.hasAttribute("data-tidy-class")){
      var cls = b.getAttribute("data-tidy-class");
      var undoC = setTransactionsClass(state.transactions, ids, cls);
      commit(["transactions"]);
      showUndoToast(ids.length + (ids.length === 1 ? " purchase" : " purchases") + " at " + g.label + (cls ? " counted as " + classWord(cls) : " back to counting as the line does"),
        function(){ undoChanges(undoC); commit(["transactions"]); });
      return;
    }
    if(b.hasAttribute("data-tidy-apply-move")){
      if(!tidyUi.moveTo) return;
      var source = budgetLineItems().find(function(l){ return l.id === tidyUi.lineId; });
      var isNew = tidyUi.moveTo === "__new";
      var r = tidyMove(state, ids, isNew ? null : tidyUi.moveTo, {
        newLine: isNew ? { source: source, what: tidyUi.newName || ((source && source.what ? source.what : "Line") + " – " + g.label), cls: tidyUi.newClass, months: TIDY_MONTHS, id: genId("exp") } : null,
        teach: tidyUi.teach && !!g.key, idFactory: function(){ return genId("rule"); } });
      var touched = r.made ? ["transactions", "shared", "importRules"] : ["transactions", "importRules"];
      var whereTo = r.made ? r.made.what : tidyLineName(r.lineId);
      tidyResetShop();
      if(ids.length === g.txIds.length) tidyUi.openKey = null;
      commit(touched);
      showUndoToast("Moved " + ids.length + " at " + g.label + " to " + whereTo + (r.made ? " (a new line, " + fmtCurrency0.format(r.made.amount) + "/mo)" : "") + (r.taught ? " — future statements file it there too" : ""),
        function(){ r.undo(); commit(touched); });
    }
  });
  body.addEventListener("change", function(e){
    var t = e.target;
    if(t.matches("[data-tidy-line]")){ tidyUi.lineId = t.value; tidyUi.openKey = null; tidyResetShop(); renderTidy(); var sel = body.querySelector("[data-tidy-line]"); if(sel) sel.focus(); return; }
    if(t.matches("[data-tidy-to]")){ tidyUi.moveTo = t.value; renderTidy(); var to = body.querySelector(tidyUi.moveTo === "__new" ? "[data-tidy-new-name]" : "[data-tidy-to]"); if(to) to.focus(); return; }
    if(t.matches("[data-tidy-new-class]")){ tidyUi.newClass = t.value; return; }
    if(t.matches("[data-tidy-teach]")){ tidyUi.teach = !!t.checked; return; }
    if(t.matches("[data-tidy-tx]")){
      var id = t.getAttribute("data-tidy-tx");
      if(t.checked) delete tidyUi.picked[id]; else tidyUi.picked[id] = false;
      renderTidy();
      var again = body.querySelector('[data-tidy-tx="' + CSS.escape(id) + '"]');
      if(again) again.focus();
    }
  });
  body.addEventListener("input", function(e){ if(e.target.matches("[data-tidy-new-name]")) tidyUi.newName = e.target.value; });
  // Move / It's right inside an open budget line (tidyStraysForLineHtml): the line's editor closes first — on a phone a
  // sheet — so the list isn't rebuilt under it, then the same as in Tidy up.
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-tidy-row-move], [data-tidy-row-ok]");
    if(!b) return;
    e.preventDefault();
    var move = b.getAttribute("data-tidy-row-move"), keep = b.getAttribute("data-tidy-row-ok");
    var act = function(){ if(move) tidyMoveStrays(move); else tidyKeepStray(keep); };
    if(b.closest(".m-row.open")) requestCloseActiveOverlay().then(function(closed){ if(closed !== false) act(); });
    else act();
  });
  // "Tidy this line →" from an open budget row (Budget) or a line's breakdown (Transactions).
  document.addEventListener("click", function(e){
    var open = e.target.closest("[data-tidy-open]");
    if(!open) return;
    e.preventDefault();
    var lineId = open.getAttribute("data-tidy-open");
    var go = function(){
      var card = document.getElementById("tidyCard");
      // From Transactions: the Budget tab shows first (synchronously — same page, no view transition).
      if(card && card.closest("[hidden]")) showExpensesSubpage("budget");
      openTidyAt(lineId, null);
    };
    // From inside an open budget line — on a phone a sheet over the page — the sheet closes first (through its history
    // entry), then Tidy up opens; opened behind the sheet, the link looked like it did nothing.
    if(open.closest(".m-row.open")){
      // Two frames: the closed row folds back into its list first, so the scroll is measured on the page as it will be.
      requestCloseActiveOverlay().then(function(closed){ if(closed !== false) requestAnimationFrame(function(){ requestAnimationFrame(go); }); });
      return;
    }
    go();
  });
}

// ---------------- Money → Budget: things to tidy, a card at a time (November 2026) ----------------
// One inbox for misfiled purchases, Essential/Lifestyle and set-aside hints, plans far from spending and new repeating
// charges (calc/tidyinbox.js). Each answer is one commit with an undo; "no" is remembered, Later lasts the session.
var INBOX_TOUCHES = { move: ["transactions"], set: ["shared", "home"], amount: ["shared", "home"], addLine: ["shared", "transactions"], ok: ["tidyOk"] };
function focusInbox(){
  var b = document.querySelector("#bhInboxBody [data-inbox-yes]") || document.querySelector("#budgetSplitBody [data-inbox-toggle]");
  if(b) b.focus({ preventScroll: true });
}
export function wireBudgetSplit(){
  var body = document.getElementById("budgetSplitBody");
  body.addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b) return;
    if(b.hasAttribute("data-inbox-toggle")){ budgetSplitUi.inboxOpen = !budgetSplitUi.inboxOpen; renderBudgetSplit(); focusInbox(); return; }
    if(b.getAttribute("data-bs-more") === "pots"){ budgetSplitUi.allPots = !budgetSplitUi.allPots; renderBudgetSplit(); return; }
    var later = b.getAttribute("data-inbox-later");
    if(later){ budgetSplitUi.later[later] = true; renderBudgetSplit(); focusInbox(); return; }
    var yes = b.getAttribute("data-inbox-yes"), no = b.getAttribute("data-inbox-no");
    if(!yes && !no) return;
    var card = budgetSplitModel().inbox.find(function(c){ return c.id === (yes || no); });
    if(!card) return;
    var answer = yes ? card.yes : card.no;
    var lines = loggableBudgetLineItems();
    var undo = applyInboxAction(state, answer.act, { lineOf: function(id){ return lines.find(function(l){ return l.id === id; }); }, idFactory: function(){ return genId("exp"); } });
    if(!undo) return;
    var touched = INBOX_TOUCHES[answer.act.type] || ["*"];
    commit(touched);
    focusInbox();
    showUndoToast(answer.act.type === "ok" ? "Kept as it is — it won't be asked again" : answer.label + " — done", function(){ undo(); commit(touched); focusInbox(); });
  });
}

// ---------------- Money → Budget → Adjust the plan (November 2026) ----------------
// Picks are this session's; Save sets every picked line to its typical amount — one commit, one undo.
export function wireAdjust(){
  var body = document.getElementById("adjustBody");
  body.addEventListener("click", function(e){
    var b = e.target.closest("button");
    if(!b || b.disabled) return;
    var f = b.getAttribute("data-adjust-filter");
    if(f){ adjustUi.filter = f; renderAdjust(); var c = body.querySelector('[data-adjust-filter="' + f + '"]'); if(c) c.focus(); return; }
    var pick = b.getAttribute("data-adjust-pick");
    if(pick){
      if(adjustUi.picked[pick]) delete adjustUi.picked[pick]; else adjustUi.picked[pick] = true;
      renderAdjust();
      var again = body.querySelector('[data-adjust-pick="' + CSS.escape(pick) + '"]');
      if(again) again.focus();
      return;
    }
    if(b.hasAttribute("data-adjust-save")){
      var lines = loggableBudgetLineItems();
      var r = applyAdjust(adjustModel().rows, adjustUi.picked, function(id){ return lines.find(function(l){ return l.id === id; }); });
      if(!r.count) return;
      adjustUi.picked = {};
      commit(["shared", "home"]);
      showUndoToast(r.count + " line" + (r.count === 1 ? "" : "s") + " set to what you typically spend", function(){ r.undo(); commit(["shared", "home"]); });
    }
  });
  // "Adjust the plan →" in the Lines bar: open the card and bring it into view.
  document.addEventListener("click", function(e){
    if(!e.target.closest("[data-adjust-open]")) return;
    var card = document.getElementById("adjustCard");
    if(!card) return;
    card.open = true;
    renderAdjust();
    alignTo(card);
    var first = body.querySelector("[data-adjust-filter]");
    if(first) first.focus({ preventScroll: true });
  });
}
