// ---------------- A home being bought (November 2026) ----------------
//
// The owner, buying a home to live in: the app had no place for a purchase that hasn't settled — a deposit paid,
// a settlement date to come, costs arriving one by one — so a property was either owned or not there at all. A
// purchase is its own record (state.purchases) until it settles, then becomes an ordinary property in one step
// (settledProperty). Nothing that reads state.properties has to know about a home half-bought.
//
// A purchase: { id, what, kind ("PPOR"|"IP"), price, contractDate, settlementDate, deposit, loanAmount, rate,
//   stateCode, firstHome, depositAssetId, costs: [{ id, what, amount, paid, auto }] }
// The deposit is held (by the agent or a solicitor) from exchange to settlement: it is kept as an "Other" asset,
// "Deposit held — <name>", so every net worth figure counts it and nothing else has to (components/buying.js keeps
// it in step). A cost with `auto` is stamp duty worked out from the price, until its amount is typed.
import { calcStampDuty, purchaseCostAmount } from "./property.js";

/** @param {any} n */
function num(n){ var v = Number(n); return isFinite(v) ? v : 0; }

// The costs a purchase usually has, to start its list (each can be removed, and any other added).
export function defaultPurchaseCosts(genId){
  return [
    { id: genId("pc"), what: "Stamp duty", amount: 0, paid: false, auto: true },
    { id: genId("pc"), what: "Conveyancer", amount: 0, paid: false },
    { id: genId("pc"), what: "Building & pest inspection", amount: 0, paid: false },
    { id: genId("pc"), what: "Loan fees", amount: 0, paid: false }
  ];
}

// Stamp duty for the purchase's state, price and first-home status, or null for a state not modelled.
export function purchaseStampDuty(p){
  if(!p || !p.stateCode || !(num(p.price) > 0)) return null;
  var d = calcStampDuty(p.stateCode, num(p.price), !!p.firstHome);
  return d == null ? null : Math.round(d);
}

// A cost's amount: an auto stamp duty follows the price until one is typed.
export function costAmount(p, c){
  if(c && c.auto){ var d = purchaseStampDuty(p); if(d != null) return d; }
  return Math.max(0, num(c && c.amount));
}

function dayNumber(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : null;
}

// Everything the Buying card says, from the purchase and the cash on hand (cash accounts and offsets).
export function purchaseFigures(p, today, cashOnHand){
  var price = Math.max(0, num(p.price)), deposit = Math.max(0, num(p.deposit)), loan = Math.max(0, num(p.loanAmount));
  var costs = (p.costs || []).map(function(c){ return { id: c.id, what: c.what || "Cost", amount: costAmount(p, c), paid: !!c.paid, auto: !!c.auto }; });
  var costsPaid = costs.filter(function(c){ return c.paid; }).reduce(function(s, c){ return s + c.amount; }, 0);
  var costsToPay = costs.filter(function(c){ return !c.paid; }).reduce(function(s, c){ return s + c.amount; }, 0);
  // At settlement: the price less the deposit already paid and what the loan brings, plus the costs still to pay.
  var balanceAtSettlement = Math.max(0, price - deposit - loan);
  var cashNeeded = balanceAtSettlement + costsToPay;
  var settles = dayNumber(p.settlementDate), now = dayNumber(today);
  var days = settles != null && now != null ? Math.round(settles - now) : null;
  var cash = cashOnHand == null ? null : Math.max(0, num(cashOnHand));
  return {
    price: price, deposit: deposit, loan: loan, costs: costs, costsPaid: costsPaid, costsToPay: costsToPay,
    totalCost: price + costsPaid + costsToPay, balanceAtSettlement: balanceAtSettlement, cashNeeded: cashNeeded,
    cashOnHand: cash, short: cash == null ? null : Math.max(0, cashNeeded - cash),
    lvr: price > 0 ? loan / price : null, days: days, stampDuty: purchaseStampDuty(p),
    // Paid so far toward the whole cost: the deposit and the costs paid.
    paidSoFar: deposit + costsPaid
  };
}

// The property it becomes once it has settled: its value and purchase price the price, bought on the settlement
// date, its costs the acquisition costs, and the loan drawn from that day.
export function settledProperty(p, today, genId){
  var price = Math.max(0, num(p.price)), on = p.settlementDate || today;
  var loan = Math.max(0, num(p.loanAmount)), ip = p.kind === "IP";
  return {
    id: genId("p"), what: p.what || "Home", kind: ip ? "IP" : "PPOR", value: price, purchasePrice: price || null, purchaseDate: on,
    acquisitionCosts: (p.costs || []).map(function(c){ return { id: genId("ac"), what: c.what || "Cost", amount: costAmount(p, c) }; }).filter(function(c){ return c.amount > 0; }),
    history: price > 0 ? [{ date: on, value: price }] : [], ownership: {}, state: p.stateCode || "",
    pmFee: ip ? { percent: 6, flat: 5.5 } : { percent: 0, flat: 0 }, incomePaidFreq: "Monthly",
    loans: loan > 0 ? [{ id: genId("loan"), what: "Home loan", balance: loan, rate: num(p.rate), termYears: 30, repaymentType: "PI", settlementDate: on }] : [],
    income: [], expenses: []
  };
}

// A scenario's purchase plan (state.purchase[scenario]) as a new purchase's starting figures — its price, deposit,
// rate, state, first-home status and its own cost estimates, each still to pay (the owner had one in a scenario).
export function purchaseFromPlan(plan, genId){
  if(!plan) return {};
  var price = Math.max(0, num(plan.price)), pct = num(plan.depositPct);
  var deposit = price > 0 && pct > 0 ? Math.round(price * pct / 100) : 0;
  var costs = [{ id: genId("pc"), what: "Stamp duty", amount: 0, paid: false, auto: true }].concat((plan.otherCosts || []).map(function(c){
    return { id: genId("pc"), what: c.what || "Cost", amount: Math.round(purchaseCostAmount(c, plan, price)), paid: false };
  }).filter(function(c){ return c.amount > 0; }));
  return { price: price || "", deposit: deposit || "", loanAmount: price > 0 && deposit ? Math.max(0, price - deposit) : "",
    rate: num(plan.rate) || "", stateCode: plan.state || "", firstHome: !!plan.firstHomeBuyer, costs: costs };
}

// The scenarios with a purchase plan, to start a purchase from: [{ name, plan }].
export function purchasePlans(st){
  var plans = (st && st.purchase) || {};
  return Object.keys(plans).filter(function(name){ var c = plans[name]; return c && c.enabled && num(c.price) > 0; })
    .map(function(name){ return { name: name, plan: plans[name] }; });
}

// ---- Changing the household (pure: `st` is the state, changed in place; the caller commits) ----

// The deposit is held from exchange to settlement: an "Other" asset kept in step with the purchase.
export function syncDepositAsset(st, p, genId){
  st.assets = st.assets || [];
  var i = st.assets.findIndex(function(a){ return a && a.id === p.depositAssetId; });
  var amount = Math.max(0, num(p.deposit));
  if(!(amount > 0)){ if(i !== -1) st.assets.splice(i, 1); delete p.depositAssetId; return; }
  var what = "Deposit held — " + (p.what || "a home");
  if(i === -1){
    p.depositAssetId = p.depositAssetId || genId("dep");
    st.assets.push({ id: p.depositAssetId, what: what, category: "Other", amount: amount, history: [], depositFor: p.id });
  } else { st.assets[i].what = what; st.assets[i].amount = amount; }
}

export function addPurchase(st, fields, genId){
  var p = Object.assign({ id: genId("buy"), what: "", kind: "PPOR", price: "", deposit: "", loanAmount: "", rate: "", contractDate: "", settlementDate: "", stateCode: "", firstHome: false }, fields || {});
  if(!Array.isArray(p.costs) || !p.costs.length) p.costs = defaultPurchaseCosts(genId);
  st.purchases = st.purchases || [];
  st.purchases.push(p);
  syncDepositAsset(st, p, genId);
  return p;
}

// It settles: an ordinary property in its place, and the deposit's no longer held apart.
export function settlePurchase(st, p, today, genId){
  var prop = settledProperty(p, today, genId);
  removePurchase(st, p);
  st.properties = st.properties || [];
  st.properties.push(prop);
  return prop;
}

export function removePurchase(st, p){
  st.assets = (st.assets || []).filter(function(a){ return !(a && p.depositAssetId && a.id === p.depositAssetId); });
  st.purchases = (st.purchases || []).filter(function(x){ return x !== p && x.id !== p.id; });
}
