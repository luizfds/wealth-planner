// ---------------- Adding something, one question at a time: the dialog (November 2026) ----------------
//
// "+ Add property" and "+ Add account" open it (propertieswiring.js, accountswiring.js). It draws one question at a
// time (addflow.js), keeps the answers as they're typed, and on the last question makes the record (calc/addflow.js)
// and commits it. Closing with something answered asks first. Enter is Next; Escape is Close.
import { state, commit, genId } from "../state.js";
import { recalcComputedItems } from "../calc/engine.js";
import { flowSteps, stepNeeds, liveLine, addPropertyFromAnswers, addPurchaseFromAnswers, addAccountFromAnswers, addPersonFromAnswers, expenseFieldsFromAnswers, addHoldingFromAnswers } from "../calc/addflow.js";
import { getTaxPeople } from "../calc/tax.js";
import { purchasePlans } from "../calc/purchase.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { confirmDialog } from "../lib/dialogs.js";
import { addFlowUi, addFlowHtml } from "./addflow.js";
import { propertyEditing } from "./properties.js";

function dialog(){
  var d = document.getElementById("addFlowDialog");
  if(d) return d;
  d = document.createElement("dialog");
  d.id = "addFlowDialog"; d.className = "add-flow"; d.setAttribute("aria-labelledby", "addFlowQ");
  document.body.appendChild(d);
  d.addEventListener("submit", function(e){ e.preventDefault(); next(); });
  d.addEventListener("click", onClick);
  d.addEventListener("input", onInput);
  d.addEventListener("change", onInput);
  // Escape: the same as ✕ — asks first when something's been answered.
  d.addEventListener("cancel", function(e){ e.preventDefault(); close(); });
  return d;
}

// What the open question's fields say, into the answers.
function readAnswers(){
  var d = dialog(), a = addFlowUi.answers;
  d.querySelectorAll("[data-af]").forEach(function(el){
    var key = el.getAttribute("data-af");
    if(el.type === "radio"){ if(el.checked) a[key] = key === "hasLoan" ? el.value === "yes" : el.value; return; }
    a[key] = el.value;
  });
  return a;
}
function steps(){ return flowSteps(addFlowUi.flow, addFlowUi.answers); }

function draw(focusWhat){
  var d = dialog();
  d.innerHTML = addFlowHtml(addFlowUi);
  // The answer, ready to type — or the error's field, or the chosen option; a question with none, its heading.
  var target = focusWhat === "heading" ? null : d.querySelector('.af-choices input:checked, .af-big, .af-form .fbox-control, .af-choices input:not([disabled])');
  (target || d.querySelector("#addFlowQ")).focus({ preventScroll: true });
}

// November 2026: also a person, a budget line (`ctx`: { section, group, category, onAdd(fields) } — rows.js makes the row)
// and a share holding (`ctx`: { person, onAdd(holding) }), and `onPerson(row)` after a person is added (taxwiring.js).
var flowCtx = {};
export function openAddFlow(flow, ctx){
  flowCtx = ctx || {};
  var loans = [], linked = {}, anyLoan = false;
  (state.accounts || []).forEach(function(a){ if(a && a.link) linked[a.link] = true; });
  (state.properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(l.id && !l.endedOn) anyLoan = true;
      if(l.id && !l.endedOn && !linked["offset:" + l.id]) loans.push({ id: l.id, label: (l.what || "Loan") + " — " + (p.what || "Property"), sub: fmtCurrency0.format(Number(l.balance) || 0) + " owing" });
    });
  });
  var people = [];
  try { people = getTaxPeople(); } catch(e){ people = []; }
  Object.assign(addFlowUi, { flow: ["account", "person", "expense", "holding"].indexOf(flow) !== -1 ? flow : "property", step: 0, answers: {}, error: "", returnToCheck: false,
    plans: flow === "property" || !flow ? purchasePlans(state) : [], loans: loans, anyLoan: anyLoan, people: people,
    accounts: (state.accounts || []).filter(function(a){ return a && a.name && a.type !== "agent"; }).map(function(a){ return a.name; }), category: flowCtx.category || "" });
  if(flow === "holding" && flowCtx.person) addFlowUi.answers.person = flowCtx.person;
  var d = dialog();
  d.returnValue = "";
  d.showModal();
  draw();
}

function go(to){
  addFlowUi.error = "";
  addFlowUi.step = Math.max(0, Math.min(to, steps().length - 1));
  draw();
}
function next(){
  var a = readAnswers(), list = steps(), step = list[addFlowUi.step];
  var need = stepNeeds(addFlowUi.flow, step, Object.assign({ taken: addFlowUi.people }, a));
  if(need){ addFlowUi.error = need; draw(); return; }
  if(addFlowUi.step >= list.length - 1){ finish(); return; }
  // From the check screen to one answer and back: Done returns there — unless the answer added questions (a loan).
  if(addFlowUi.returnToCheck){
    addFlowUi.returnToCheck = false;
    var after = steps(), fresh = after.length !== list.length || after.some(function(s, k){ return s !== list[k]; });
    if(!fresh){ go(after.length - 1); return; }
  }
  go(addFlowUi.step + 1);
}

function onClick(e){
  var t = e.target;
  if(t.closest("[data-af-close]")){ close(); return; }
  if(t.closest("[data-af-back]")){ readAnswers(); addFlowUi.returnToCheck = false; go(addFlowUi.step - 1); return; }
  if(t.closest("[data-af-skip]")){
    // Left for later: this question's fields go back to blank.
    dialog().querySelectorAll(".af-form [data-af]").forEach(function(el){ if(el.type !== "radio") delete addFlowUi.answers[el.getAttribute("data-af")]; });
    addFlowUi.error = ""; addFlowUi.step = Math.min(addFlowUi.step + 1, steps().length - 1); draw(); return;
  }
  var gotoBtn = t.closest("[data-af-goto]");
  if(gotoBtn){ var i = steps().indexOf(gotoBtn.getAttribute("data-af-goto")); if(i !== -1){ addFlowUi.returnToCheck = true; go(i); } return; }
  var chip = t.closest("[data-af-chip]");
  if(chip){
    readAnswers();
    var key = chip.getAttribute("data-af-chip"), value = chip.getAttribute("data-af-value");
    if(key === "plan"){
      // A scenario's purchase: its price and deposit to start from (its costs come with it when it's added).
      var plan = (state.purchase || {})[value] || {};
      var price = Number(plan.price) || 0, pct = Number(plan.depositPct) || 0;
      addFlowUi.answers.plan = value;
      if(price > 0) addFlowUi.answers.price = price;
      if(price > 0 && pct > 0) addFlowUi.answers.deposit = Math.round(price * pct / 100);
      if(Number(plan.rate) > 0) addFlowUi.answers.rate = Number(plan.rate);
    } else addFlowUi.answers[key] = value;
    addFlowUi.error = "";
    draw();
  }
}
// As it's typed: the answers kept, and the line under the figure says what it means now.
function onInput(){
  var a = readAnswers(), step = steps()[addFlowUi.step];
  var live = dialog().querySelector("#addFlowLive");
  if(live) live.textContent = liveLine(step, a, function(x){ return fmtCurrency0.format(x); });
}

function answeredAnything(){
  var a = addFlowUi.answers;
  return Object.keys(a).some(function(k){ return a[k] != null && String(a[k]).trim() !== ""; });
}
function close(){
  var d = dialog();
  readAnswers();
  if(!answeredAnything()){ d.close("cancel"); return; }
  confirmDialog("Discard this " + ({ account: "new account", person: "new person", expense: "budget line", holding: "holding" }[addFlowUi.flow] || (addFlowUi.answers.kind === "buying" ? "purchase" : "new property")) + "? Nothing's been added yet.",
    { title: "Discard it?", accept: "Discard", cancel: "Keep going" }).then(function(yes){ if(yes) d.close("cancel"); else draw(); });
}

// The last question: the record made and saved, the dialog closed, and the new thing shown — open, for the rest.
function finish(){
  var a = Object.assign({}, readAnswers()), d = dialog(), selector;
  if(addFlowUi.flow === "person"){
    var row = addPersonFromAnswers(state, a, genId);
    d.close("ok");
    if(flowCtx.onPerson) flowCtx.onPerson(row); else commit(["income", "tax"]);
    return;
  }
  if(addFlowUi.flow === "expense"){
    d.close("ok");
    if(flowCtx.onAdd) flowCtx.onAdd(expenseFieldsFromAnswers(a));
    return;
  }
  if(addFlowUi.flow === "holding"){
    var h = addHoldingFromAnswers(state, a);
    d.close("ok");
    if(flowCtx.onAdd) flowCtx.onAdd(h); else commit(["assets"]);
    return;
  }
  if(addFlowUi.flow === "account"){
    var acct = addAccountFromAnswers(state, a, genId, localDateStr());
    commit(["accounts", "assets", "debts", "properties"]);
    selector = '#accountsTable [data-acct-toggle="' + CSS.escape(acct.id) + '"]';
  } else if(a.kind === "buying"){
    var p = addPurchaseFromAnswers(state, a, genId);
    commit(["purchases", "assets"]);
    selector = '.buy-card[data-purchase="' + CSS.escape(p.id) + '"]';
  } else {
    var prop = addPropertyFromAnswers(state, a, genId);
    propertyEditing[prop.id] = true; // added: its fields open, for the rest (offset, rent, tax…)
    recalcComputedItems();
    commit(["properties"]);
    selector = '#property-card-' + CSS.escape(prop.id);
  }
  d.close("ok");
  requestAnimationFrame(function(){
    var el = document.querySelector(selector);
    if(!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if(!el.matches("button, a, input, select, textarea")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  });
}
