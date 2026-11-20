// ---------------- Adding something, one question at a time (November 2026) ----------------
//
// The owner chose, of three styles mocked, one question at a time for *adding* (and floating-label boxes for editing).
// This is the flow's order and its sums: which question comes next given the answers so far, the line under a figure
// that says what it means, and the record the answers make. components/addflow.js draws a question; addflowwiring.js
// runs the dialog. Nothing here touches the DOM.
//
// Answers (`a`), all optional but a kind and a name:
//   property: kind ("PPOR"|"IP"|"buying"), name, use ("PPOR"|"IP", when buying), price, bought (a date), value,
//             hasLoan (true|false), balance, rate, repaymentType ("PI"|"IO"), termYears, freq,
//             deposit, settlementDate, loanAmount, plan (a scenario's name, when buying)
//   account:  kind ("everyday"|"savings"|"offset"|"credit"), name, loanId (an offset's loan), balance
import { calcRepaymentMonthly } from "./property.js";
import { addPurchase, purchaseFromPlan } from "./purchase.js";
import { setAccountBalance } from "./accounts.js";

/** @param {any} v */
function num(v){ var n = Number(String(v == null ? "" : v).replace(/[\s,$]/g, "")); return isFinite(n) ? n : 0; }
/** @param {any} v */
function has(v){ return v != null && String(v).trim() !== ""; }

// The questions, in order, for what's been answered so far. "check" is the last: everything, to change any of it.
export function flowSteps(flow, a){
  a = a || {};
  if(flow === "account"){
    var s = ["kind", "name"];
    if(a.kind === "offset") s.push("loan");
    s.push("balance");
    return s;
  }
  if(a.kind === "buying") return ["kind", "name", "use", "priceDeposit", "settlement", "buyLoan", "check"];
  var steps = ["kind", "name", "bought", "value", "hasLoan"];
  if(a.hasLoan === true) steps.push("loanBalance", "loanRate", "loanRepay");
  steps.push("check");
  return steps;
}
// A question that has to be answered before Next: a kind, a name (and an offset's loan).
export function stepNeeds(flow, step, a){
  a = a || {};
  if(step === "kind") return has(a.kind) ? "" : "Choose one to go on.";
  if(step === "name") return has(a.name) ? "" : (flow === "account" ? "Give it a name — the bank and the account." : "Give it a name — a street, a suburb, or \"Home\".");
  if(step === "loan") return has(a.loanId) ? "" : "Choose the loan it sits against.";
  if(step === "hasLoan") return a.hasLoan === true || a.hasLoan === false ? "" : "Choose Yes or No.";
  return "";
}
// The questions that can be left for later.
export function stepSkippable(step){ return ["bought", "value", "settlement", "buyLoan", "balance", "loanRate"].indexOf(step) !== -1; }

// The loan a purchase needs: what the price less the deposit leaves.
export function suggestedLoan(a){ var p = num(a.price), d = num(a.deposit); return p > 0 && d >= 0 && p > d ? p - d : 0; }
// A month's repayment for the loan as answered, or 0 when there's not enough to say.
export function repaymentEstimate(a){
  var bal = num(a.balance), rate = num(a.rate), years = num(a.termYears) || 30;
  if(!(bal > 0) || !(rate > 0)) return 0;
  if(a.repaymentType === "IO") return bal * rate / 100 / 12;
  return calcRepaymentMonthly(bal, rate, years, "PI");
}

// The line under a figure that says what it means, or "".
export function liveLine(step, a, fmt){
  a = a || {};
  fmt = fmt || function(n){ return "$" + Math.round(n).toLocaleString("en-AU"); };
  var pct = function(x){ return Math.round(x * 100) + "%"; };
  if(step === "value" || step === "bought"){
    var paid = num(a.price), worth = num(a.value);
    if(step === "value" && paid > 0 && worth > 0){
      var d = worth - paid;
      return d === 0 ? "The same as you paid." : "Worth " + fmt(Math.abs(d)) + (d > 0 ? " more" : " less") + " than you paid — " + pct(Math.abs(d) / paid) + ".";
    }
    return "";
  }
  if(step === "loanBalance"){
    var b = num(a.balance), v = num(a.value);
    return b > 0 && v > 0 ? pct(b / v) + " of what it's worth." : "";
  }
  if(step === "loanRepay" || step === "loanRate"){
    var m = repaymentEstimate(a);
    return m > 0 ? "About " + fmt(m) + " a month" + (a.repaymentType === "IO" ? ", all interest." : ".") : "";
  }
  if(step === "priceDeposit"){
    var price = num(a.price), dep = num(a.deposit);
    if(!(price > 0)) return "";
    return dep > 0 ? pct(dep / price) + " down — a loan of about " + fmt(suggestedLoan(a)) + "." : "";
  }
  if(step === "buyLoan"){
    var lp = num(a.price), la = num(a.loanAmount);
    return lp > 0 && la > 0 ? pct(la / lp) + " of the price." : "";
  }
  return "";
}

// ---- What the answers make (pure but for `st`, changed in place; the caller commits) ----

// A property owned, with its loan when there is one.
export function propertyFromAnswers(a, genId){
  var ip = a.kind === "IP";
  var price = num(a.price), value = num(a.value) || price;
  var on = has(a.bought) ? String(a.bought) : "";
  var p = { id: genId("p"), what: String(a.name || "").trim() || (ip ? "Investment property" : "Home"), kind: ip ? "IP" : "PPOR",
    value: value, purchasePrice: price > 0 ? price : null, purchaseDate: on, acquisitionCosts: [],
    history: [], pmFee: ip ? { percent: 6, flat: 5.5 } : { percent: 0, flat: 0 }, incomePaidFreq: "Monthly",
    sectionsCollapsed: { acquisition: true, ownership: true, loans: true, income: true, expenses: true },
    ownership: {}, loans: [], income: [], expenses: [] };
  if(a.hasLoan === true){
    p.loans.push({ id: genId("l"), what: ip ? "Investment loan" : "Home loan", balance: num(a.balance), rate: num(a.rate),
      termYears: num(a.termYears) || 30, repaymentType: a.repaymentType === "IO" ? "IO" : "PI", repaymentMode: "auto",
      manualRepaymentAmount: 0, manualRepaymentFreq: a.freq || "Monthly", offsetBalance: 0 });
  }
  return p;
}
export function addPropertyFromAnswers(st, a, genId){
  var p = propertyFromAnswers(a, genId);
  st.properties = st.properties || [];
  st.properties.push(p);
  return p;
}
// A home being bought: a purchase (calc/purchase.js), from a scenario's plan when one was chosen, the answers on top.
export function addPurchaseFromAnswers(st, a, genId){
  var plan = a.plan && st.purchase ? st.purchase[a.plan] : null;
  var fields = Object.assign({}, plan ? purchaseFromPlan(plan, genId) : {}, { what: String(a.name || "").trim(), kind: a.use === "IP" ? "IP" : "PPOR" });
  ["price", "deposit", "rate"].forEach(function(k){ if(has(a[k])) fields[k] = num(a[k]); });
  if(has(a.loanAmount)) fields.loanAmount = num(a.loanAmount);
  else if(!has(fields.loanAmount) && suggestedLoan(a) > 0) fields.loanAmount = suggestedLoan(a);
  if(has(a.settlementDate)) fields.settlementDate = String(a.settlementDate);
  return addPurchase(st, fields, genId);
}
// An account, and its balance where it's kept (calc/accounts.js): a Cash asset, a card's debt, or a loan's offset.
export function addAccountFromAnswers(st, a, genId, today){
  var type = ["everyday", "savings", "offset", "credit"].indexOf(a.kind) !== -1 ? a.kind : "everyday";
  var acct = { id: genId("acct"), name: String(a.name || "").trim() || "Account", type: type, statementStartDay: 1, link: type === "offset" && a.loanId ? "offset:" + a.loanId : "" };
  st.accounts = st.accounts || [];
  st.accounts.push(acct);
  if(has(a.balance) && (type !== "offset" || acct.link)) setAccountBalance(acct, num(a.balance), today);
  return acct;
}
