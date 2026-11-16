// ---------------- Savings account vs offset (#398, 3/5 of #390) ----------------
//
// The same dollar earns interest in a savings account, or saves it in a loan's offset. What each is worth a year:
//   savings account  its rate, less the holder's tax — the person on the account, or split evenly across the
//                    household's people when it's the household's
//   home loan offset the loan's full rate: the interest it saves isn't deductible, so nothing is lost to tax
//   investment loan  the loan's rate less the owners' tax: the interest it saves would have been claimed back
//                    (the same owners' rate the advice rule uses, calc/advice.js ownersRate)
// A rate is entered per cash account (asset.interestRate, the owner's choice on #390) and never fetched or assumed;
// an account without one is listed, not guessed. Redraw isn't counted as cash, and these are estimates: access,
// conditions and bonus-rate rules differ by account.
import { state } from "../state.js";
import { getTaxPeople, computePersonTax } from "./tax.js";
import { loanRateOn, loanPaidOut } from "./property.js";
import { ownersRate } from "./advice.js";

function r2(n){ return Math.round(n * 100) / 100 || 0; }

// Each person's tax on a dollar of interest: their top rate plus the Medicare levy, as the advice rules take it.
function personRates(){
  var people = getTaxPeople(), rates = {};
  people.forEach(function(n){
    var t = null;
    try { t = computePersonTax(n); } catch(e){ t = null; }
    var mr = t ? Number(t.marginalRate) || 0 : 0;
    rates[n] = mr ? mr + 0.02 : 0;
  });
  return { people: people, rates: rates };
}

// { accounts: [{ name, balance, rate, holder, taxRate, afterTax, yearly }], offsets: [{ name, rate, deductible,
//   effective }], missing: [names], best: the offset worth most, or null }. Rates are % a year.
export function savingsVsOffset(today){
  var pr = personRates(), people = pr.people, rates = pr.rates;
  var even = people.length ? people.reduce(function(s, n){ return s + (rates[n] || 0); }, 0) / people.length : 0;
  var accounts = [], missing = [];
  (state.assets || []).filter(function(a){ return a && a.category === "Cash" && Number(a.amount) > 0; }).forEach(function(a){
    if(a.interestRate == null || a.interestRate === ""){ missing.push(a.what || "A cash account"); return; }
    var rate = Number(a.interestRate) || 0;
    var holder = a.person && people.indexOf(a.person) !== -1 ? a.person : "";
    var tax = holder ? rates[holder] || 0 : even;
    var afterTax = rate * (1 - tax);
    accounts.push({ name: a.what || "Cash", balance: r2(Number(a.amount)), rate: rate, holder: holder, taxRate: r2(tax * 100), afterTax: r2(afterTax), yearly: r2(Number(a.amount) * afterTax / 100) });
  });
  var offsets = [];
  (state.properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l){
      // Paid out, or nothing owing: an offset against no balance saves nothing.
      if(loanPaidOut(l, today) || !(Number(l.balance) > 0)) return;
      var rate = Number(loanRateOn(l, today)) || Number(l.rate) || 0;
      if(!(rate > 0)) return;
      var deductible = p.kind === "IP";
      var effective = deductible ? rate * (1 - ownersRate(p, people, rates)) : rate;
      offsets.push({ name: l.what || ((p.what || "A property") + "'s loan"), property: p.what || "", rate: r2(rate), deductible: deductible, effective: r2(effective) });
    });
  });
  var best = offsets.slice().sort(function(a, b){ return b.effective - a.effective; })[0] || null;
  return { accounts: accounts, offsets: offsets, missing: missing, best: best };
}

// One line per account against the best offset: which is worth more a year on that balance, and by how much.
export function savingsOffsetLines(c){
  if(!c.best) return [];
  return c.accounts.map(function(a){
    var offsetYearly = a.balance * c.best.effective / 100;
    return { name: a.name, balance: a.balance, savingsYearly: a.yearly, offsetYearly: r2(offsetYearly), gain: r2(offsetYearly - a.yearly) };
  });
}
