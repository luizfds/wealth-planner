// ---------------- Accounts and goals, wired (v3.206.1, item 237) ----------------
//
// Accounts — named money sources, their balances and statement cycles — Plan → Goals, savings goals and the
// emergency fund.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { ACCOUNT_TYPE_KEYS, accountSourceOptions, setAccountBalance, resolveLink } from "../calc/accounts.js";
import { fillAgentAccount } from "../calc/agentstatement.js";
import { emergencyFund } from "../calc/emergency.js";
import { scenarioTotals, currentScenario } from "../calc/engine.js";
import { addSavingsGoal } from "../calc/savegoals.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { readNumberField, markField, readInput } from "../lib/validate.js";
import { redraw } from "../lib/views.js";
import { state, persist, commit, genId } from "../state.js";
import { openAccounts, balanceEditing } from "./accounts.js";
import { renderCanBuy } from "./canbuy.js";
import { renderEmergencyFund, existingEmergencyGoal } from "./emergency.js";
import { renderTransactions, renderActualVsPlannedPanel, renderAccounts, addAccount, deleteAccount, renameAccountEverywhere, renderYearSpending, renderSpendingTrends, listsShowAll } from "./expenses.js";
import { showPage, showPlanSubpage } from "./nav.js";
import { renderRetirement } from "./planwiring.js";
import { renderAll, updateAccountSuggestions } from "./redraw.js";
import { goalsFireHtml } from "./retirement.js";
import { goalsSectionHtml, goalOpen } from "./savegoals.js";

var goalsBody;

// "Update balance" → Save: written to the record the balance lives in (calc/accounts.js), so net
// worth, runway and the projections move with it.
function saveAccountBalance(idx){
  var a = state.accounts[idx];
  var inp = document.querySelector('#accountsTable .acct-bal-input[data-acct-index="' + idx + '"]');
  if(!a || !inp) return;
  if(inp.value === "" || isNaN(Number(inp.value))){ inp.focus(); return; }
  if(!setAccountBalance(a, inp.value)){ showToast("Pick the loan this offset sits against first"); return; }
  delete balanceEditing[a.id];
  renderAll();
  commit(["accounts", "assets", "debts", "properties"]);
  showToast("Updated " + (a.name || "the account") + " to " + fmtCurrency0.format(Number(inp.value)));
}
// v3.129.0: Plan → Goals — the emergency fund and savings goals (from Accounts), Can we buy? and
// where financial independence stands.
function renderGoalsTab(){ renderSavingsGoals(); renderCanBuy(); var f = document.getElementById("goalsFireBody"); if(f) f.innerHTML = goalsFireHtml(); }
// ---------------- Accounts → Savings goals (v3.65.0) ----------------
var savingFrom = null; // the goal card whose field change is being saved (renderSavingsGoals keeps its editor)
function renderSavingsGoals(){
  var el = document.getElementById("savingsGoalsBody");
  if(el){
    var html = goalsSectionHtml(localDateStr(), scenarioTotals(currentScenario()).netMonthly);
    // An editor someone is working in stays in the page through the redraw (#261). Tab picks the next field before the
    // change that saves (and so redraws) fires; replacing the editor — even detaching it for a moment — dropped focus to
    // the page body. So the redraw is built aside and swapped in around that card: its header and note, the other cards
    // and the totals are new; its editor's elements never leave the page.
    // The card being worked in: the one with focus — or, while a change is saving, the one it came from (the browser has
    // already taken focus off the field and not yet given it to the next, so activeElement is the body then).
    var working = Array.prototype.find.call(el.querySelectorAll(".sgl.is-open"), function(c){ return c.contains(document.activeElement) || c === savingFrom; });
    var keepId = working && working.querySelector("[data-goal-toggle]") ? working.querySelector("[data-goal-toggle]").getAttribute("data-goal-toggle") : null;
    var aside = document.createElement("div");
    aside.innerHTML = html;
    var freshCard = keepId ? Array.prototype.find.call(aside.querySelectorAll(".sgl.is-open"), function(c){ var t = c.querySelector("[data-goal-toggle]"); return t && t.getAttribute("data-goal-toggle") === keepId; }) : null;
    var liveList = working && working.parentNode, freshList = freshCard && freshCard.parentNode;
    if(!freshCard || !liveList || liveList.parentNode !== el || !freshList || freshList.parentNode !== aside) el.innerHTML = html;
    else {
      var editor = working.querySelector(".sgl-edit");
      Array.prototype.slice.call(working.children).forEach(function(c){ if(c !== editor) c.remove(); });
      Array.prototype.slice.call(freshCard.children).forEach(function(c){ if(!c.classList.contains("sgl-edit")) working.insertBefore(c, editor); });
      working.className = freshCard.className;
      swapAround(liveList, working, freshList, freshCard);
      swapAround(el, liveList, aside, freshList);
    }
  }
  renderEmergencyFund();
}
// Replaces everything in live except `keep` with everything in fresh except its counterpart, in the same order.
function swapAround(live, keep, fresh, counterpart){
  Array.prototype.slice.call(live.children).forEach(function(c){ if(c !== keep) c.remove(); });
  var before = true;
  Array.prototype.slice.call(fresh.children).forEach(function(c){
    if(c === counterpart){ before = false; return; }
    if(before) live.insertBefore(c, keep); else live.appendChild(c);
  });
}

export function wireAccounts(){  // ---------------- Accounts: named money sources, used for credit-card statement cycles ----------------
  document.getElementById("addAccountBtn").addEventListener("click", function(){
    addAccount();
    updateAccountSuggestions();
    var nameIn = document.querySelector("#accountsTable .acct-card.is-open:last-of-type .acct-mgmt-name") || document.querySelectorAll("#accountsTable .acct-mgmt-name");
    if(nameIn && nameIn.length !== undefined) nameIn = nameIn[nameIn.length - 1];
    if(nameIn) nameIn.focus();
  });
  document.getElementById("accountsTable").addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.classList.contains("acct-bal-input")){ e.preventDefault(); saveAccountBalance(Number(e.target.getAttribute("data-acct-index"))); }
    if(e.key === "Escape" && e.target.classList.contains("acct-bal-input")){ var id = (state.accounts[Number(e.target.getAttribute("data-acct-index"))] || {}).id; delete balanceEditing[id]; renderAccounts(); }
  });
  document.addEventListener("click", function(e){
    var delAcctBtn = e.target.closest("[data-acct-del]");
    if(delAcctBtn){ deleteAccount(Number(delAcctBtn.getAttribute("data-acct-del"))); updateAccountSuggestions(); return; }
    var tog = e.target.closest("[data-acct-toggle]");
    if(tog){ var tid = tog.getAttribute("data-acct-toggle"); openAccounts[tid] = !openAccounts[tid]; renderAccounts(); return; }
    var balBtn = e.target.closest("[data-acct-bal]");
    if(balBtn){
      var bid = balBtn.getAttribute("data-acct-bal");
      balanceEditing[bid] = true; renderAccounts();
      var inp = document.querySelector('#accountsTable .acct-card[data-acct-index="' + state.accounts.findIndex(function(x){ return x.id === bid; }) + '"] .acct-bal-input');
      if(inp){ inp.focus(); inp.select(); }
      return;
    }
    var cancelBal = e.target.closest("[data-acct-bal-cancel]");
    if(cancelBal){ delete balanceEditing[cancelBal.getAttribute("data-acct-bal-cancel")]; renderAccounts(); return; }
    var saveBal = e.target.closest("[data-acct-bal-save]");
    if(saveBal){ saveAccountBalance(Number(saveBal.getAttribute("data-acct-bal-save"))); return; }
    var adopt = e.target.closest("[data-acct-adopt]");
    if(adopt){
      var link = adopt.getAttribute("data-acct-adopt");
      var src = resolveLink(link);
      state.accounts.push({ id: genId("acct"), name: src ? src.label.replace(/ — offset$/, " offset") : "Account", type: adopt.getAttribute("data-acct-adopt-type") || "savings", statementStartDay: 1, link: link });
      updateAccountSuggestions();
      renderAll();
      commit(["accounts", "assets", "debts", "properties"]);
      showToast("Added " + (src ? src.label : "the account") + " to Accounts");
      return;
    }
  });
  document.addEventListener("input", function(e){
    if(!e.target.closest("#accountsTable")) return;
    var idx = Number(e.target.getAttribute("data-acct-index"));
    var a = state.accounts[idx];
    if(!a) return;
    if(e.target.classList.contains("acct-mgmt-name")){
      // v3.204.0 (item 235b): the account's record, then the name copies on rows linked to it by id.
      renameAccountEverywhere(a, e.target.value);
      renderTransactions();
      updateAccountSuggestions();
    }
    else if(e.target.classList.contains("acct-mgmt-type")){
      a.type = ACCOUNT_TYPE_KEYS.indexOf(e.target.value) !== -1 ? e.target.value : "everyday";
      // A link only makes sense for the kinds of record this type can draw from.
      if(a.link && !accountSourceOptions(a).some(function(o){ return o.key === a.link; })) a.link = "";
      // v3.101.0: a property manager's account picks up the statement bills logged before it existed.
      if(a.type === "agent"){
        if(!a.link && (state.properties || []).length === 1 && state.properties[0].id) a.link = "property:" + state.properties[0].id;
        var filled = fillAgentAccount(state);
        if(filled) showToast(filled + " bill" + (filled === 1 ? "" : "s") + " from statements now on " + (a.name || "this account"));
      }
      renderActualVsPlannedPanel();
      commit(["accounts", "assets", "debts", "properties"]);
      // Deferred: showing/hiding the statement-day field means rebuilding #accountsTable, an
      // ancestor of this <select> that's still mid-event right now — same reentrant-DOM-mutation
      // issue as the Transactions date field above.
      setTimeout(renderAccounts, 0);
      return;
    }
    else if(e.target.classList.contains("acct-mgmt-day")){
      // #263: said, not clamped — 31 isn't quietly the 28th, and blank isn't quietly the 1st.
      var sd = readInput(e.target, { empty: "Enter the day the statement starts, 1 to 28.", min: 1, max: 28, whole: true, range: "Enter a day from 1 to 28." });
      if(!sd) return;
      a.statementStartDay = sd.value;
    }
    else if(e.target.classList.contains("acct-mgmt-autopay")){
      if(e.target.value) a.autoPayFrom = e.target.value; else delete a.autoPayFrom;
    }
    else if(e.target.classList.contains("acct-mgmt-payday")){
      // Blank is none; a day outside 1–31 is said rather than quietly removing the one that was set.
      var pd = readInput(e.target, { min: 1, max: 31, whole: true, range: "Enter a day from 1 to 31, or leave it blank." });
      if(!pd) return;
      if(pd.value == null) delete a.payDay; else a.payDay = pd.value;
    }
    else if(e.target.classList.contains("acct-mgmt-limit")){
      var lim = readInput(e.target, { min: 0, range: "A limit can't be negative — leave it blank for none." });
      if(!lim) return;
      if(lim.value == null) delete a.limit; else a.limit = lim.value;
    }
    else if(e.target.classList.contains("acct-mgmt-link")){
      a.link = e.target.value;
      if(a.type === "agent") fillAgentAccount(state);
      commit(["accounts", "assets", "debts", "properties"]);
      setTimeout(function(){ renderAll(); }, 0);
      return;
    }
    else return;
    renderActualVsPlannedPanel();
    commit(["accounts", "assets", "debts", "properties"]);
  });
  // ---------------- Categories: the spending rollup ----------------
  document.getElementById("planSubnav").addEventListener("click", function(e){
    var b = e.target.closest("[data-plan-sub]");
    if(b){ showPlanSubpage(b.getAttribute("data-plan-sub")); if(b.getAttribute("data-plan-sub") === "goals") renderGoalsTab(); }
  });  // The rail over Net worth, Accounts, Investments and Property.
  document.addEventListener("click", function(e){
    var r = e.target.closest && e.target.closest(".nw-rail-item");
    if(r) showPage(r.getAttribute("data-page"));
    var pg = e.target.closest && e.target.closest("[data-plan-sub-go]");
    if(pg){ showPage("plan"); showPlanSubpage(pg.getAttribute("data-plan-sub-go"), { replace: true }); if(pg.getAttribute("data-plan-sub-go") === "retirement") renderRetirement(); }
  });  // v3.109.0: "Show all" / "Show fewer" under a capped list (Actual vs. planned, This year so far).
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-list-all]");
    if(!b) return;
    var key = b.getAttribute("data-list-all");
    listsShowAll[key] = !listsShowAll[key];
    if(key === "avp") renderActualVsPlannedPanel();
    if(key === "ytd") renderYearSpending();
    if(key === "irr") renderActualVsPlannedPanel();
    if(key === "trend") renderSpendingTrends();
  });
}

export function wireGoals(){  // ---------------- Accounts → Emergency fund (v3.94.0) ----------------
  document.getElementById("emergencyBody").addEventListener("click", function(e){
    var m = e.target.closest("[data-ef-months]");
    if(m){
      if(!state.emergency) state.emergency = {};
      state.emergency.months = Number(m.getAttribute("data-ef-months"));
      persist(); renderEmergencyFund();
      return;
    }
    if(e.target.closest("[data-ef-goal]")){
      var f = emergencyFund();
      var g = existingEmergencyGoal();
      if(g){ var was = g.target; g.target = f.target; commit(["savingsGoals"]);
        showUndoToast(g.name + " set to " + fmtCurrency0.format(f.target), function(){ g.target = was; commit(["savingsGoals"]); });
        return; }
      var accts = state.accounts.filter(function(a){ return a.type === "savings" || a.type === "offset"; }).map(function(a){ return a.name; });
      var ng = addSavingsGoal({ name: "Emergency fund", target: f.target, accounts: accts });
      goalOpen[ng.id] = true;
      commit(["savingsGoals"]);
      showUndoToast("Emergency fund goal added — on " + (accts.length ? accts.join(", ") : "no accounts yet; tick them on the goal"), function(){
        state.savingsGoals = state.savingsGoals.filter(function(x){ return x.id !== ng.id; }); commit(["savingsGoals"]);
      });
    }
  });
  goalsBody = document.getElementById("savingsGoalsBody");
  goalsBody.addEventListener("click", function(e){
    if(e.target.closest("[data-goal-add]")){
      var g = addSavingsGoal({ name: "New goal", target: 0, accounts: state.accounts.filter(function(a){ return a.type === "savings"; }).map(function(a){ return a.name; }) });
      goalOpen[g.id] = true;
      commit(["savingsGoals"]);
      var nameIn = goalsBody.querySelector('.sgl.is-open [data-goal-field="name"]');
      if(nameIn){ nameIn.focus(); nameIn.select(); }
      return;
    }
    var tog = e.target.closest("[data-goal-toggle]");
    // Through the views (lib/views.js), so the redraw keeps focus on the toggle (lib/keepui.js).
    if(tog){ var id = tog.getAttribute("data-goal-toggle"); goalOpen[id] = !goalOpen[id]; redraw(["savingsGoals"]); return; }
    var del = e.target.closest("[data-goal-del]");
    if(del){
      var i = Number(del.getAttribute("data-goal-del"));
      var gone = state.savingsGoals.splice(i, 1)[0];
      commit(["savingsGoals"]);
      if(gone) showUndoToast("Goal deleted", function(){ state.savingsGoals.splice(i, 0, gone); commit(["savingsGoals"]); });
    }
  });
  goalsBody.addEventListener("change", function(e){
    var t = e.target, i = t.getAttribute("data-goal-index");
    if(i == null) return;
    var g = state.savingsGoals[Number(i)];
    if(!g) return;
    if(t.hasAttribute("data-goal-acct")){
      var n = t.getAttribute("data-goal-acct");
      g.accounts = g.accounts.filter(function(x){ return x !== n; });
      if(t.checked) g.accounts.push(n);
    } else {
      var f = t.getAttribute("data-goal-field");
      // #263: a target is saved only when it reads — blank was saved as 0 and a negative clamped to 0.
      if(f === "target"){
        var read = readNumberField(t.value, { badInput: !!(t.validity && t.validity.badInput), empty: "Enter a target — the amount the goal is for.", min: 0, range: "A target can't be negative." });
        if(!markField(t, read)) return;
        g.target = read.value;
      }
      else if(f === "by") g.by = t.value || "";
      else if(f === "name") g.name = t.value.trim() || "Savings goal";
    }
    savingFrom = t.closest(".sgl");
    try { commit(["savingsGoals"]); } finally { savingFrom = null; }
  });
}

export { renderGoalsTab, renderSavingsGoals };
