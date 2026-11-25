// ---------------- Buying a home: its listeners (November 2026) — buying.js draws it ----------------
import { state, commit, genId, setState } from "../state.js";
import { syncDepositAsset, settlePurchase, removePurchase, setCostPaid, COMMON_PURCHASE_COSTS } from "../calc/purchase.js";
import { localDateStr } from "../lib/format.js";
import { showUndoToast } from "../lib/toast.js";
import { buyUi, purchaseCardFigures } from "./buying.js";
import { linkTransaction, purchaseFromTransactions, moveToProperty } from "../calc/propertymoney.js";
import { currentScenario } from "../calc/engine.js";
import { markTidyOk } from "../calc/tidy.js";
import { settleUi, settlementSheetHtml } from "./propertymoney.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";

// November 2026: a transaction linked to a purchase's cost, or unlinked from it — one commit, with Undo.
var LINK_KEYS = ["transactions", "purchases", "accounts"];
function linkUndoable(t, target, message){
  var undo = linkTransaction(state, t, target, { genId: genId, giveBack: function(p, c){ setCostPaid(state, p, c, false, undefined, localDateStr()); } });
  commit(LINK_KEYS);
  showUndoToast(message, function(){ undo(); commit(LINK_KEYS); });
}
// A rent line still running — offered to end at settlement (state.shared, and the household's own scenario rows).
function rentLines(){
  var out = [], scen = currentScenario();
  (state.shared || []).forEach(function(l, i){ if(l && /\brent\b/i.test(l.what || "") && !l.endDate) out.push({ ref: "shared:" + i, line: l, what: l.what }); });
  ((state.home && state.home[scen]) || []).forEach(function(l, i){ if(l && /\brent\b/i.test(l.what || "") && !l.endDate) out.push({ ref: "home:" + i, line: l, what: l.what }); });
  out.forEach(function(r){ var last = (state.transactions || []).filter(function(t){ return t && t.linkedExpenseId && t.linkedExpenseId === r.line.id; }).map(function(t){ return t.date; }).sort().pop(); r.last = last || ""; });
  return out;
}
function settleHost(){
  var host = document.getElementById("settleHost");
  if(!host){ host = document.createElement("div"); host.id = "settleHost"; document.body.appendChild(host); }
  return host;
}
function renderSettle(){
  var host = settleHost(), p = settleUi.open && findPurchase(settleUi.open);
  host.innerHTML = p ? settlementSheetHtml(purchaseFromTransactions(state, p).purchase, state, rentLines(), purchaseCardFigures(p)) : "";
  return host;
}
function openSettle(p){
  settleUi.open = p.id;
  var host = renderSettle();
  pushActiveOverlay(function(){ settleUi.open = null; renderSettle(); var b = document.querySelector('[data-purchase="' + p.id + '"] [data-buy-settled]'); if(b) b.focus({ preventScroll: true }); });
  var first = host.querySelector("[data-settle-go]");
  if(first) first.focus({ preventScroll: true });
}
function settleNow(p){
  var rents = rentLines().filter(function(r){ return settleUi.endRent[r.ref] !== false; });
  var fed = purchaseFromTransactions(state, p).purchase;
  var name = p.what || "The home";
  settleUi.open = null;
  requestCloseActiveOverlay();
  undoable(name + " is settled — it's on Property now", ["purchases", "properties", "assets", "transactions", "shared", "home", "projects", "trips"], function(){
    var prop = settlePurchase(state, fed, localDateStr(), genId);
    moveToProperty(state, p.id, prop.id, fed);
    (state.projects || []).concat(state.trips || []).forEach(function(event){
      if(event.purchaseId === p.id){ event.purchaseId = prop.id; event.propertyName = prop.what; }
    });
    rents.forEach(function(r){ r.line.endDate = settleUi.rentDate[r.ref] || p.settlementDate || localDateStr(); });
  });
}
export function wireSettlement(){
  document.addEventListener("click", function(e){
    if(!settleUi.open) return;
    var p = findPurchase(settleUi.open);
    if(e.target.closest("[data-settle-close]") || e.target === e.target.closest("[data-settle-backdrop]")){ requestCloseActiveOverlay(); return; }
    if(!p) return;
    if(e.target.closest("[data-settle-go]")){ settleNow(p); return; }
    var link = e.target.closest("[data-settle-link]");
    if(link){
      var t = state.transactions[Number(link.getAttribute("data-settle-link"))];
      if(t){ linkUndoable(t, { type: "purchase", id: p.id, cost: link.getAttribute("data-settle-link-cost") || "new" }, "Linked to " + (p.what || "the purchase")); renderSettle(); }
    }
  });
  document.addEventListener("change", function(e){
    if(!settleUi.open) return;
    var a = e.target.getAttribute && e.target.getAttribute("data-settle-endrent");
    if(a){ settleUi.endRent[a] = e.target.checked; return; }
    var d = e.target.getAttribute && e.target.getAttribute("data-settle-rentdate");
    if(d) settleUi.rentDate[d] = e.target.value;
  });
}

function findPurchase(id){ return (state.purchases || []).find(function(p){ return p.id === id; }); }

// A change, saved and redrawn, with Undo back to how it was (Settled and Remove change two lists at once).
function undoable(message, keys, change){
  var before = JSON.stringify(state);
  change();
  commit(keys);
  showUndoToast(message, function(){ setState(JSON.parse(before)); commit(keys); });
}

var NUMBER_FIELDS = { price: 1, deposit: 1, loanAmount: 1, rate: 1, grossLoan: 1 };
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
    // #452: paid from an account comes off its balance (and goes back if unticked) — so the account's figures redraw too.
    var moneyKeys = ["purchases", "accounts", "assets", "debts", "properties"];
    if(cf === "paid"){ setCostPaid(state, p, cost, e.target.checked, undefined, localDateStr()); commit(moneyKeys); return; }
    if(cf === "paidFrom"){ setCostPaid(state, p, cost, !!cost.paid, e.target.value || "", localDateStr()); commit(moneyKeys); return; }
    if(cf === "amount"){
      var a = amountOf(e.target.value);
      cost.amount = a === "" ? 0 : a;
      // A typed amount is the cost's own; cleared, stamp duty goes back to being worked out. An amount that's come
      // isn't still to come.
      if(!(cost.amount > 0) && (cost.auto || /stamp duty/i.test(cost.what || ""))) cost.auto = true; else delete cost.auto;
      if(cost.amount > 0) cost.tbc = false;
    } else if(cf === "what") cost.what = e.target.value;
    else if(cf === "tbc") cost.tbc = e.target.checked;
    else if(cf === "kind"){ cost.kind = e.target.value === "loan" ? "loan" : "purchase"; if(cost.kind !== "loan" && cost.financed){ cost.financed = false; cost.withheld = true; } }
    // Paid with: cash (yours), taken by the lender from the money it releases, or added to the loan (and taken back) —
    // the last two aren't cash, so not ticked off as paid (an account it came from gets it back).
    else if(cf === "paidWith"){
      var how = e.target.value;
      cost.financed = how === "loan" && cost.kind === "loan";
      cost.withheld = how === "withheld" || (how === "loan" && !cost.financed);
      if(cost.financed || cost.withheld){ setCostPaid(state, p, cost, false, undefined, localDateStr()); commit(moneyKeys); return; }
    }
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
      // One of the usual ones knows what it's for; another says once it's chosen (flagged until then, #452).
      var c = Object.assign({ id: genId("pc"), what: "", amount: 0, paid: false, kind: "", financed: false, tbc: false }, preset || {});
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
    // November 2026: Settled opens a check first — the cost base from the transactions, the loan, what changes.
    if(e.target.closest("[data-buy-settled]")){ openSettle(p); return; }
    var unlink = e.target.closest("[data-buy-unlink]");
    if(unlink){
      var ut = state.transactions[Number(unlink.getAttribute("data-buy-unlink"))];
      if(ut) linkUndoable(ut, { type: "oneoff" }, "Unlinked — it's a one-off again");
      return;
    }
    var sug = e.target.closest("[data-buy-suggest]");
    if(sug){
      var st2 = state.transactions[Number(sug.getAttribute("data-buy-suggest"))];
      if(st2) linkUndoable(st2, { type: "purchase", id: p.id, cost: sug.getAttribute("data-buy-suggest-cost") || "new" }, "Linked to " + (p.what || "the purchase"));
      return;
    }
    var sugNo = e.target.closest("[data-buy-suggest-no]");
    if(sugNo){
      var undoOk = markTidyOk(state, sugNo.getAttribute("data-buy-suggest-no"));
      commit(["tidyOk"]);
      showUndoToast("Not this purchase — it won't be asked again", function(){ if(undoOk) undoOk(); commit(["tidyOk"]); });
      return;
    }
    if(e.target.closest("[data-buy-remove]")){
      undoable("Removed " + (p.what || "the purchase"), ["purchases", "assets"], function(){
        removePurchase(state, p);
      });
    }
  });
}
