// ---------------- Accounts and goals, wired (v3.206.1, item 237) ----------------
//
// Accounts — named money sources, their balances and statement cycles — Plan → Goals, savings goals and the
// emergency fund.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order. What it shares with app.js it reaches through `app` (lib/appctx.js).
import { ACCOUNT_TYPE_KEYS, accountSourceOptions, setAccountBalance, resolveLink } from "../calc/accounts.js";
import { fillAgentAccount } from "../calc/agentstatement.js";
import { emergencyFund } from "../calc/emergency.js";
import { scenarioTotals, currentScenario } from "../calc/engine.js";
import { addSavingsGoal } from "../calc/savegoals.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist, commit, genId } from "../state.js";
import { openAccounts, balanceEditing } from "./accounts.js";
import { renderCanBuy } from "./canbuy.js";
import { renderEmergencyFund, existingEmergencyGoal } from "./emergency.js";
import { renderTransactions, renderActualVsPlannedPanel, renderAccounts, addAccount, deleteAccount, renameAccountEverywhere, renderYearSpending, renderSpendingTrends, listsShowAll } from "./expenses.js";
import { renderHomeSummary } from "./home.js";
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
}// v3.129.0: Plan → Goals — the emergency fund and savings goals (from Accounts), Can we buy? and
// where financial independence stands.
function renderGoalsTab(){ renderSavingsGoals(); renderCanBuy(); var f = document.getElementById("goalsFireBody"); if(f) f.innerHTML = goalsFireHtml(); }
// ---------------- Accounts → Savings goals (v3.65.0) ----------------
function renderSavingsGoals(){
  var el = document.getElementById("savingsGoalsBody");
  if(el) el.innerHTML = goalsSectionHtml(localDateStr(), scenarioTotals(currentScenario()).netMonthly);
  renderEmergencyFund();
}

export function wireAccounts(){  // ---------------- Accounts: named money sources, used for credit-card statement cycles ----------------
  document.getElementById("addAccountBtn").addEventListener("click", function(){
    addAccount();
    updateAccountSuggestions();
    var nameIn = document.querySelector("#accountsTable .acct-card.is-open:last-of-type .acct-mgmt-name") || document.querySelectorAll("#accountsTable .acct-mgmt-name");
    if(nameIn && nameIn.length !== undefined) nameIn = nameIn[nameIn.length - 1];
    if(nameIn) nameIn.focus();
  });  document.getElementById("accountsTable").addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.classList.contains("acct-bal-input")){ e.preventDefault(); saveAccountBalance(Number(e.target.getAttribute("data-acct-index"))); }
    if(e.key === "Escape" && e.target.classList.contains("acct-bal-input")){ var id = (state.accounts[Number(e.target.getAttribute("data-acct-index"))] || {}).id; delete balanceEditing[id]; renderAccounts(); }
  });  document.addEventListener("click", function(e){
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
  });  document.addEventListener("input", function(e){
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
      a.statementStartDay = Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1));
    }
    else if(e.target.classList.contains("acct-mgmt-autopay")){
      if(e.target.value) a.autoPayFrom = e.target.value; else delete a.autoPayFrom;
    }
    else if(e.target.classList.contains("acct-mgmt-payday")){
      var pd = parseInt(e.target.value, 10);
      if(pd >= 1 && pd <= 31) a.payDay = pd; else delete a.payDay;
    }
    else if(e.target.classList.contains("acct-mgmt-limit")){
      var lim = e.target.value === "" ? null : Number(e.target.value);
      if(lim == null || !(lim >= 0)) delete a.limit; else a.limit = lim;
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
      if(g){ var was = g.target; g.target = f.target; persist(); renderSavingsGoals(); renderHomeSummary();
        showUndoToast(g.name + " set to " + fmtCurrency0.format(f.target), function(){ g.target = was; persist(); renderSavingsGoals(); renderHomeSummary(); });
        return; }
      var accts = state.accounts.filter(function(a){ return a.type === "savings" || a.type === "offset"; }).map(function(a){ return a.name; });
      var ng = addSavingsGoal({ name: "Emergency fund", target: f.target, accounts: accts });
      goalOpen[ng.id] = true;
      persist(); renderSavingsGoals(); renderHomeSummary();
      showUndoToast("Emergency fund goal added — on " + (accts.length ? accts.join(", ") : "no accounts yet; tick them on the goal"), function(){
        state.savingsGoals = state.savingsGoals.filter(function(x){ return x.id !== ng.id; }); persist(); renderSavingsGoals(); renderHomeSummary();
      });
    }
  });  goalsBody = document.getElementById("savingsGoalsBody");  goalsBody.addEventListener("click", function(e){
    if(e.target.closest("[data-goal-add]")){
      var g = addSavingsGoal({ name: "New goal", target: 0, accounts: state.accounts.filter(function(a){ return a.type === "savings"; }).map(function(a){ return a.name; }) });
      goalOpen[g.id] = true;
      persist(); renderSavingsGoals(); renderHomeSummary();
      var nameIn = goalsBody.querySelector('.sgl.is-open [data-goal-field="name"]');
      if(nameIn){ nameIn.focus(); nameIn.select(); }
      return;
    }
    var tog = e.target.closest("[data-goal-toggle]");
    if(tog){ var id = tog.getAttribute("data-goal-toggle"); goalOpen[id] = !goalOpen[id]; renderSavingsGoals(); return; }
    var del = e.target.closest("[data-goal-del]");
    if(del){
      var i = Number(del.getAttribute("data-goal-del"));
      var gone = state.savingsGoals.splice(i, 1)[0];
      persist(); renderSavingsGoals(); renderHomeSummary();
      if(gone) showUndoToast("Goal deleted", function(){ state.savingsGoals.splice(i, 0, gone); persist(); renderSavingsGoals(); renderHomeSummary(); });
    }
  });  goalsBody.addEventListener("change", function(e){
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
      if(f === "target") g.target = Math.max(0, Number(t.value) || 0);
      else if(f === "by") g.by = t.value || "";
      else if(f === "name") g.name = t.value.trim() || "Savings goal";
    }
    persist(); renderSavingsGoals(); renderHomeSummary();
  });
}

export { renderGoalsTab, renderSavingsGoals };
