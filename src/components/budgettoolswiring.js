// ---------------- Budget tools, wired (v3.206.1, item 237) ----------------
//
// What the app notices and Ask Claude, Cash flow → Budget → Trim, a budget from history and recurring payments.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { adviceFor } from "../calc/advice.js";
import { householdSummary } from "../calc/aisummary.js";
import { proposeBudget, applyBudgetProposals } from "../calc/budgetfromhistory.js";
import { recalcComputedItems } from "../calc/engine.js";
import { learnRule } from "../calc/import-rules.js";
import { unbudgetedRecurring, risingLines, catchAllSuggestions } from "../calc/recurring.js";
import { setLeanLevel, leanLevel, trimReport } from "../calc/trim.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, genId } from "../state.js";
import { renderAdvice, adviceUi } from "./advice.js";
import { askUi, setAiKey, setAiModel, askClaude, setLastReview, copyPrompt } from "./askclaude.js";
import { budgetFromHistoryHtml, historyBudgetUi } from "./budgethistory.js";
import { loggableBudgetLineItems, budgetLineItems } from "./expenses.js";
import { taxUi } from "./income.js";
import { showPage, showAssetsSubpage, showDashboardSubpage, showExpensesSubpage, showTaxSubpage, showPlanSubpage } from "./nav.js";
import { recurringHtml, recurringDismissed, recurringOpen, catchAllShown } from "./recurring.js";
import { renderAll } from "./redraw.js";
import { refreshAfterLedgerChange } from "./rows.js";
import { renderPeopleTab } from "./taxwiring.js";
import { renderTrim, trimUi, trimScenario } from "./trim.js";

var trimBody;

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
function renderRecurring(){
  var el = document.getElementById("recurringBody");
  if(!el) return;
  var c = currentRecurring();
  el.innerHTML = recurringHtml(c.u, c.r, c.c, state.transactions);
  var n = c.u.filter(function(x){ return !recurringDismissed.keys["u:" + x.key]; }).length + c.r.filter(function(x){ return !recurringDismissed.keys["r:" + x.id + ":" + x.recent]; }).length + catchAllShown(c.c);
  var cnt = document.getElementById("recurringCount");
  if(cnt) cnt.textContent = n ? n + " to look at" : "";
}

export function wireAdvice(){
  // ---------------- What the app notices + Ask Claude (v3.98.0) ----------------
  document.addEventListener("toggle", function(e){
    if(e.target.matches && e.target.matches("[data-adv-id]")) adviceUi.open[e.target.getAttribute("data-adv-id")] = e.target.open;
    if(e.target.matches && e.target.matches("[data-adv-good]")) adviceUi.goodOpen = e.target.open;
    if(e.target.matches && e.target.matches("[data-tax-household]")) taxUi.householdOpen = e.target.open;
  }, true);
  document.addEventListener("change", function(e){
    if(e.target.matches && e.target.matches("[data-ai-model]")) setAiModel(e.target.value);
  });
  document.addEventListener("input", function(e){
    if(e.target.matches && e.target.matches("[data-ai-q]")) askUi.question = e.target.value;
  });
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var go = e.target.closest("[data-adv-go]");
    if(go){
      var pg = go.getAttribute("data-adv-go"), sub = go.getAttribute("data-adv-sub");
      showPage(pg);
      if(sub){
        if(pg === "dashboard") showDashboardSubpage(sub);
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
    if(e.target.closest("[data-ai-forget]")){ setAiKey(""); askUi.preview = ""; renderAdvice(); showToast("Key removed from this browser"); return; }
    if(e.target.closest("[data-ai-preview]")){
      askUi.preview = askUi.preview ? "" : copyPrompt(householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() }), askUi.question.trim());
      renderAdvice();
      return;
    }
    // v3.99.0: the prompt for any assistant, to the clipboard; the answer pasted back.
    if(e.target.closest("[data-ai-copy]")){
      var text = copyPrompt(householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() }), askUi.question.trim());
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
      var q = askUi.question.trim();
      var summary = householdSummary(adviceFor({ today: localDateStr() }), { today: localDateStr() });
      askUi.busy = true; askUi.error = ""; renderAdvice();
      askClaude(summary, q).then(function(text){
        setLastReview({ at: localDateStr(), question: q, text: text });
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
      var before = rep.over.map(function(x){ var l = state.shared.find(function(y){ return y.id === x.id; }); return l ? { l: l, was: l.amount, to: x.suggested } : null; }).filter(Boolean);
      before.forEach(function(b){ b.l.amount = b.to; });
      afterTrimChange();
      showUndoToast(before.length + " lines set to what you spend — " + fmtCurrency0.format(rep.overYearly) + "/yr out of the plan", function(){ before.forEach(function(b){ b.l.amount = b.was; }); afterTrimChange(); });
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
}

export { currentHistoryBudget, renderBudgetFromHistory, renderRecurring };
