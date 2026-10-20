import { state } from "../state.js";
import { recalcPurchase, ipProperties, loanRateOn, loanPaidOut, propertyOwnershipPct } from "./property.js";
import { scenarioTotals } from "./engine.js";
import { getTaxPeople, computePersonTax } from "./tax.js";
import { localDateStr } from "../lib/format.js";

// ---------------- Can we buy? (v3.88.0) ----------------
//
// The purchase calculator answers "what does this place cost to buy and hold". It doesn't say
// where the cash comes from, or what taking it costs. For a household whose savings sit in an
// investment loan's offset, the deposit isn't free money: every dollar out of the offset is a
// dollar more the investment loan charges interest on.
//
// Cash is drawn in this order: plain cash accounts first (they earn least), then offsets holding
// your own savings, and last an offset holding money borrowed against the investment (a split
// drawn to cash after the purchase, sitting in its own offset). Spending borrowed money on your
// own home makes that loan's interest non-deductible — what it was used for decides, not the
// property behind it — so it's taken last and its extra interest is shown as not deductible.
// Pure apart from reading state.
function r0(n){ return Math.round(n); }

export function cashSources(st){
  st = st || state;
  var out = [];
  (st.assets || []).forEach(function(a){
    if(a.category === "Cash" && Number(a.amount) > 0) out.push({ name: a.what || "Cash", amount: Number(a.amount), rate: 0, kind: "cash", deductible: false });
  });
  ipProperties().forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(loanPaidOut(l)) return;
      var off = Math.max(0, Math.min(Number(l.offsetBalance) || 0, Number(l.balance) || 0));
      if(!(off > 0)) return;
      var borrowed = !!(p.purchaseDate && l.settlementDate && l.settlementDate > p.purchaseDate);
      out.push({ name: (l.what || "Loan") + " offset", amount: off, rate: Number(loanRateOn(l, localDateStr())) || Number(l.rate) || 0,
        kind: borrowed ? "borrowed" : "offset", deductible: !borrowed, property: p });
    });
  });
  var rank = { cash: 0, offset: 1, borrowed: 2 };
  // Within offsets, the cheapest loan first: emptying it costs the least interest.
  return out.sort(function(a, b){ return rank[a.kind] - rank[b.kind] || a.rate - b.rate; });
}

// Tax back on a dollar of extra deductible interest on property p: each owner's top rate plus Medicare.
function taxBackRate(p){
  var people = getTaxPeople();
  if(!people.length) return 0;
  return people.reduce(function(s, person){
    var pct = propertyOwnershipPct(p, person, people) / 100;
    var mr = 0;
    try { mr = Number(computePersonTax(person).marginalRate) || 0; } catch(e){ mr = 0; }
    return s + pct * (mr + (mr > 0 ? 0.02 : 0));
  }, 0);
}

export function canBuy(scenario){
  var cfg = state.purchase && state.purchase[scenario];
  if(!cfg || !cfg.enabled) return null;
  var out = recalcPurchase(scenario);
  if(!out || !(out.upfrontCash > 0)) return null;
  var sources = cashSources();
  var need = out.upfrontCash, draws = [];
  sources.forEach(function(s){
    if(need <= 0) return;
    var take = Math.min(s.amount, need);
    need -= take;
    draws.push(Object.assign({}, s, { take: take, interestYearly: take * s.rate / 100 }));
  });
  var available = sources.reduce(function(t, s){ return t + s.amount; }, 0);
  var extra = draws.reduce(function(t, d){ return t + d.interestYearly; }, 0);
  var deductibleExtra = draws.reduce(function(t, d){ return t + (d.deductible ? d.interestYearly : 0); }, 0);
  var taxBack = draws.reduce(function(t, d){ return t + (d.deductible && d.property ? d.interestYearly * taxBackRate(d.property) : 0); }, 0);
  var totals = scenarioTotals(scenario);
  var left = available - out.upfrontCash;
  return {
    scenario: scenario, price: out.price != null ? out.price : Number(cfg.price) || 0, state: cfg.state,
    deposit: out.depositAmt, stampDuty: out.stampDuty, lmi: out.lmi, lmiCapitalized: !!out.lmiCapitalized,
    loan: out.loanBalance != null ? out.loanBalance : out.loanAmount, upfront: out.upfrontCash,
    repaymentMonthly: cfg.repaymentType === "IO" ? out.repaymentMonthlyIO : out.repaymentMonthlyPI,
    available: available, left: left, short: left < 0 ? -left : 0,
    draws: draws, extraInterestYearly: r0(extra), deductibleExtra: r0(deductibleExtra), nonDeductibleExtra: r0(extra - deductibleExtra),
    taxBackYearly: r0(taxBack), afterTaxCostYearly: r0(extra - taxBack),
    netMonthly: totals.netMonthly, regularNetMonthly: totals.regularNetMonthly, expensesMonthly: totals.expensesMonthly,
    bufferMonths: left > 0 && totals.expensesMonthly > 0 ? left / totals.expensesMonthly : 0,
    // Owning any property in Australia ends first-home-buyer concessions (most states' rules).
    fhbButOwns: !!cfg.firstHomeBuyer && (state.properties || []).length > 0
  };
}
export function canBuyAll(){
  return (state.scenarios || []).map(canBuy).filter(Boolean);
}
