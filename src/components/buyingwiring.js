// ---------------- Buying a home: its listeners (November 2026) — buying.js draws it ----------------
import { state, commit, genId, setState } from "../state.js";
import { purchaseFromPlan, purchasePlans, addPurchase, syncDepositAsset, settlePurchase, removePurchase, COMMON_PURCHASE_COSTS } from "../calc/purchase.js";
import { localDateStr } from "../lib/format.js";
import { showUndoToast } from "../lib/toast.js";
import { addPropertyDialogHtml, buyUi } from "./buying.js";

function findPurchase(id){ return (state.purchases || []).find(function(p){ return p.id === id; }); }

// A change, saved and redrawn, with Undo back to how it was (Settled and Remove change two lists at once).
function undoable(message, keys, change){
  var before = JSON.stringify(state);
  change();
  commit(keys);
  showUndoToast(message, function(){ setState(JSON.parse(before)); commit(keys); });
}

export function newPurchase(fields){
  var p = addPurchase(state, fields, genId);
  commit(["purchases", "assets"]);
  return p;
}

// "+ Add property" asks first. `addOwned(kind, name)` makes an owned one (propertieswiring.js, as before).
export function openAddPropertyDialog(addOwned){
  var d = document.getElementById("addPropertyDialog");
  if(!d){
    d = document.createElement("dialog"); d.id = "addPropertyDialog"; d.className = "shortcuts-dialog add-prop-dialog"; d.setAttribute("aria-label", "Add a property");
    document.body.appendChild(d);
    // A plan to start from only for one being bought.
    d.addEventListener("change", function(e){
      if(e.target.name !== "addPropStage") return;
      var plan = d.querySelector(".add-prop-plan");
      if(plan) plan.hidden = e.target.value !== "buying";
    });
  }
  d.innerHTML = addPropertyDialogHtml(purchasePlans(state));
  d.onclose = function(){
    if(d.returnValue !== "ok") return;
    var kind = (d.querySelector('input[name="addPropKind"]:checked') || {}).value === "IP" ? "IP" : "PPOR";
    var buying = (d.querySelector('input[name="addPropStage"]:checked') || {}).value === "buying";
    var name = (document.getElementById("addPropName") || {}).value || "";
    name = String(name).trim();
    if(!buying){ addOwned(kind, name); return; }
    var planName = (document.getElementById("addPropPlan") || {}).value || "";
    var plan = planName ? (state.purchase || {})[planName] : null;
    var p = newPurchase(Object.assign({ what: name || planName || "", kind: kind }, plan ? purchaseFromPlan(plan, genId) : {}));
    requestAnimationFrame(function(){
      var card = document.querySelector('.buy-card[data-purchase="' + CSS.escape(p.id) + '"]');
      if(card){ card.scrollIntoView({ behavior: "smooth", block: "start" }); var first = card.querySelector("input, select"); if(first) first.focus({ preventScroll: true }); }
    });
  };
  d.returnValue = "";
  d.showModal();
  var nameField = document.getElementById("addPropName");
  if(nameField) nameField.focus();
}

var NUMBER_FIELDS = { price: 1, deposit: 1, loanAmount: 1, rate: 1 };
// A money field shows "575,000" (lib/field.js): read "$575,000" as 575000. Blank, or not a number, is "".
function amountOf(v){ var t = String(v == null ? "" : v).replace(/[\s,$]/g, ""); var n = Number(t); return t === "" || !isFinite(n) || n < 0 ? "" : n; }
export function wireBuying(){
  var body = document.getElementById("buyingBody");
  if(!body) return;
  body.addEventListener("change", function(e){
    var card = e.target.closest("[data-purchase]");
    var p = card && findPurchase(card.getAttribute("data-purchase"));
    if(!p) return;
    var field = e.target.getAttribute("data-buy-field");
    if(field){
      var v = e.target.value;
      if(NUMBER_FIELDS[field]) v = amountOf(v);
      if(field === "firstHome") v = v === "yes";
      if(field === "kind") v = v === "IP" ? "IP" : "PPOR";
      p[field] = v;
      var keys = ["purchases"];
      if(field === "deposit" || field === "what"){ syncDepositAsset(state, p, genId); keys.push("assets"); }
      commit(keys);
      return;
    }
    var row = e.target.closest("[data-buy-cost]");
    var cost = row && (p.costs || []).find(function(c){ return c.id === row.getAttribute("data-buy-cost"); });
    var cf = e.target.getAttribute("data-cost-field");
    if(!cost || !cf) return;
    if(cf === "paid") cost.paid = e.target.checked;
    else if(cf === "amount"){
      var a = amountOf(e.target.value);
      cost.amount = a === "" ? 0 : a;
      // A typed amount is the cost's own; cleared, stamp duty goes back to being worked out. An amount that's come
      // isn't still to come.
      if(!(cost.amount > 0) && (cost.auto || /stamp duty/i.test(cost.what || ""))) cost.auto = true; else delete cost.auto;
      if(cost.amount > 0) cost.tbc = false;
    } else if(cf === "what") cost.what = e.target.value;
    else if(cf === "tbc") cost.tbc = e.target.checked;
    else if(cf === "kind"){ cost.kind = e.target.value === "loan" ? "loan" : "purchase"; if(cost.kind !== "loan") cost.financed = false; }
    // Added to the loan: borrowed at settlement, so not something paid in cash.
    else if(cf === "financed"){ cost.financed = e.target.value === "loan"; if(cost.financed) cost.paid = false; }
    commit(["purchases"]);
  });
  // Which costs are open stays open through a redraw (a cost edited redraws the card).
  body.addEventListener("toggle", function(e){
    var d = e.target;
    if(d && d.matches && d.matches("details[data-buy-cost]")) buyUi.open[d.getAttribute("data-buy-cost")] = d.open;
  }, true);
  body.addEventListener("click", function(e){
    var card = e.target.closest("[data-purchase]");
    var p = card && findPurchase(card.getAttribute("data-purchase"));
    if(!p) return;
    // Edit / the settlement chip: open "The purchase" and put the cursor in that field.
    var editBtn = e.target.closest("[data-buy-edit]");
    if(editBtn){
      var fold = card.querySelector(".buy-fold");
      if(fold) fold.open = true;
      var target = card.querySelector('[data-buy-field="' + editBtn.getAttribute("data-buy-edit") + '"]');
      if(target){ target.scrollIntoView({ behavior: "smooth", block: "center" }); target.focus({ preventScroll: true }); }
      return;
    }
    // One of the usual costs, named and filed (calc/purchase.js), or another: it opens ready for its amount (its name).
    var quick = e.target.closest("[data-buy-cost-quick]");
    if(quick || e.target.closest("[data-buy-cost-add]")){
      var preset = quick ? COMMON_PURCHASE_COSTS.find(function(q){ return q.what === quick.getAttribute("data-buy-cost-quick"); }) : null;
      p.costs = p.costs || [];
      var c = Object.assign({ id: genId("pc"), what: "", amount: 0, paid: false, kind: "purchase", financed: false, tbc: false }, preset || {});
      p.costs.push(c);
      buyUi.open[c.id] = true;
      commit(["purchases"]);
      var input = document.getElementById("buy-" + p.id + "-" + c.id + (preset ? "-amount" : "-what"));
      if(input){ input.scrollIntoView({ behavior: "smooth", block: "center" }); input.focus({ preventScroll: true }); }
      return;
    }
    var del = e.target.closest("[data-buy-cost-del]");
    if(del){
      var rowId = del.closest("[data-buy-cost]").getAttribute("data-buy-cost");
      var gone = (p.costs || []).find(function(x){ return x.id === rowId; });
      undoable("Removed " + ((gone && gone.what) || "the cost"), ["purchases"], function(){ p.costs = p.costs.filter(function(x){ return x.id !== rowId; }); });
      return;
    }
    if(e.target.closest("[data-buy-settled]")){
      undoable((p.what || "The home") + " is settled — it's on Property now", ["purchases", "properties", "assets"], function(){
        settlePurchase(state, p, localDateStr(), genId);
      });
      return;
    }
    if(e.target.closest("[data-buy-remove]")){
      undoable("Removed " + (p.what || "the purchase"), ["purchases", "assets"], function(){
        removePurchase(state, p);
      });
    }
  });
}
