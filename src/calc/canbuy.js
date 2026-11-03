import { state } from "../state.js";
import { recalcPurchase } from "./property.js";
import { cashSources, drawFor } from "./cashdraw.js";
import { scenarioTotals } from "./engine.js";

// ---------------- Can we buy? (v3.88.0) ----------------
//
// The purchase calculator answers "what does this place cost to buy and hold". It doesn't say where the cash comes
// from, or what taking it costs — calc/cashdraw.js does (item 248 moved it there, so a scenario's own monthly figure
// counts the same interest this shows). Pure apart from reading state.
function r0(n){ return Math.round(n); }
export { cashSources };

export function canBuy(scenario){
  var cfg = state.purchase && state.purchase[scenario];
  if(!cfg || !cfg.enabled) return null;
  var out = recalcPurchase(scenario);
  if(!out || !(out.upfrontCash > 0)) return null;
  var d = drawFor(out.upfrontCash);
  var draws = d.draws, available = d.available;
  var extra = d.extraInterestYearly, deductibleExtra = d.deductibleYearly, taxBack = d.taxBackYearly;
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
