// ---------------- Buying a home: its listeners (November 2026) — buying.js draws it ----------------
import { state, commit, genId, setState } from "../state.js";
import { purchaseFromPlan, purchasePlans, addPurchase, syncDepositAsset, settlePurchase, removePurchase } from "../calc/purchase.js";
import { localDateStr } from "../lib/format.js";
import { showUndoToast } from "../lib/toast.js";
import { addPropertyDialogHtml } from "./buying.js";

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
      if(NUMBER_FIELDS[field]){ var n = Number(v); v = v === "" || !isFinite(n) || n < 0 ? "" : n; }
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
      var a = Number(e.target.value);
      cost.amount = e.target.value === "" || !isFinite(a) || a < 0 ? 0 : a;
      // A typed amount is the cost's own; cleared, stamp duty goes back to being worked out.
      if(!(cost.amount > 0) && (cost.auto || /stamp duty/i.test(cost.what || ""))) cost.auto = true; else delete cost.auto;
    } else if(cf === "what") cost.what = e.target.value;
    commit(["purchases"]);
  });
  body.addEventListener("click", function(e){
    var card = e.target.closest("[data-purchase]");
    var p = card && findPurchase(card.getAttribute("data-purchase"));
    if(!p) return;
    if(e.target.closest("[data-buy-cost-add]")){
      p.costs = p.costs || [];
      var c = { id: genId("pc"), what: "", amount: 0, paid: false };
      p.costs.push(c);
      commit(["purchases"]);
      var input = document.getElementById("buy-" + p.id + "-" + c.id + "-what");
      if(input) input.focus();
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
