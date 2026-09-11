import { state } from "../state.js";
import { toAudAmount, totalDebtsValue, totalNetWorthValue, liquidAssetsValue, scenarioTotals } from "./engine.js";
import { propertyIlliquidEquityToday } from "./property.js";
import { getTaxPeople, computePersonTax } from "./tax.js";

// ---------------- Financial independence, the Australian way ----------------
//
// The reason this is its own module rather than three more lines in the Dashboard: in Australia
// "how far am I from FIRE?" is not one question, it's two, and the second is the one that bites.
//
//   1. Will the pot ever be big enough?           — the 4% rule, which the app already had
//   2. Can you *reach* preservation age on it?    — super is locked until 60, so retiring at 52
//                                                   means funding eight years from money that
//                                                   isn't super. That's the bridge.
//
// A plan can pass (1) comfortably and still be impossible, because most of the wealth is behind
// the preservation-age wall. Reporting a single "progress %" against total net worth — which is
// what this app did until now — hides exactly that, and hides it in the optimistic direction.
//
// Everything here works in **today's dollars** (a real return, not a nominal one), so every
// figure is directly comparable to the expenses the user actually typed in. That also sidesteps
// the nominal-series-vs-real-target mismatch the projection chart still has.

// Preservation age is 60 for everyone born on or after 1 July 1964 — i.e. anyone with a
// meaningful number of working years left. Kept configurable anyway: it costs one field, and a
// hardcoded constant in a planning tool invites nobody to check whether it still applies to them.
export var DEFAULT_PRESERVATION_AGE = 60;

export function fireSettings(){
  var f = state.fire || {};
  return {
    currentAge: f.currentAge == null || f.currentAge === "" ? null : Number(f.currentAge),
    retireAge: f.retireAge == null || f.retireAge === "" ? null : Number(f.retireAge),
    preservationAge: f.preservationAge == null || f.preservationAge === "" ? DEFAULT_PRESERVATION_AGE : Number(f.preservationAge)
  };
}

// Which money can actually fund an early retirement, and which only looks like it can.
//
// Three traps avoided here, all of which the old single-number version fell into:
//   - Super is not accessible wealth before preservation age, however large it is.
//   - The home you live in isn't either. Selling it means buying or renting another, so its
//     equity funds nothing. Only *investment* property equity counts.
//   - propertyEquityToday() already folds in the offset balance, and liquidAssetsValue() counts
//     offsets too — so combining those two double-counts every offset dollar. This uses the
//     *illiquid* equity helper for the property side, leaving offsets to the liquid side alone.
export function fireWealthSplit(){
  var superValue = 0, vehicleOther = 0;
  state.assets.forEach(function(a){
    var value = toAudAmount(a, a.amount);
    var cat = a.category || "Other";
    if(cat === "Super") superValue += value;
    else if(cat !== "Cash" && cat !== "Shares") vehicleOther += value;
  });
  var ipEquity = 0, pporEquity = 0;
  state.properties.forEach(function(p){
    var equity = propertyIlliquidEquityToday(p);
    if(p.kind === "IP") ipEquity += equity; else pporEquity += equity;
  });
  // Debts (credit cards, personal loans) come off the accessible side — they're claims on the
  // money you'd be living on, not on super.
  var debts = totalDebtsValue();
  return {
    accessible: liquidAssetsValue() + ipEquity - debts,
    superValue: superValue,
    ipEquity: ipEquity,
    pporEquity: pporEquity,
    vehicleOther: vehicleOther,
    debts: debts,
    // What the old panel measured progress against, kept so the UI can show the difference rather
    // than silently restating a number the user has already read and formed expectations about.
    totalNetWorth: totalNetWorthValue()
  };
}

// Real (inflation-adjusted) return: what the portfolio actually gains in purchasing power. Using
// the nominal rate here and an un-inflated expense figure is the exact mismatch that made the
// projection chart's FI year three years early.
export function realReturnRate(){
  var nominal = (Number(state.projection.investReturnRate) || 0) / 100;
  var inflation = (Number(state.projection.inflationRate) || 0) / 100;
  return (1 + nominal) / (1 + inflation) - 1;
}

// Net annual super contributions across everyone with income — employer SG plus salary sacrifice,
// after the 15% contributions tax, which is what actually lands in the account.
export function annualSuperContributions(){
  return getTaxPeople().reduce(function(sum, person){
    var t = computePersonTax(person);
    return sum + (t.superNet || 0);
  }, 0);
}

// One run of the plan at a given retirement age, in today's dollars.
//
// Conservative on both sides of the ledger: contributions land at the end of a year (so they
// don't compound for a year they weren't there), withdrawals come out at the start (so they
// don't earn a year's growth on the way out).
export function simulateRetirementAt(retireAge, opts){
  opts = opts || {};
  var settings = fireSettings();
  var currentAge = opts.currentAge != null ? opts.currentAge : settings.currentAge;
  var preservationAge = opts.preservationAge != null ? opts.preservationAge : settings.preservationAge;
  if(currentAge == null || retireAge == null) return null;

  var split = opts.split || fireWealthSplit();
  var r = opts.realReturn != null ? opts.realReturn : realReturnRate();
  var annualExpenses = opts.annualExpenses != null ? opts.annualExpenses : fireAnnualExpenses(opts.scenario);
  var annualSavings = opts.annualSavings != null ? opts.annualSavings : fireAnnualSavings(opts.scenario);
  var superContrib = opts.superContributions != null ? opts.superContributions : annualSuperContributions();

  var accessible = split.accessible;
  var superValue = split.superValue;

  // Phase 1 — still working.
  for(var age = currentAge; age < retireAge; age++){
    accessible = accessible * (1 + r) + annualSavings;
    superValue = superValue * (1 + r) + superContrib;
  }
  var accessibleAtRetire = accessible;

  // Phase 2 — the bridge. Living off accessible wealth alone; super keeps growing, untouched.
  var bridgeYears = Math.max(0, preservationAge - retireAge);
  var bridgeSurvives = true;
  for(var y = 0; y < bridgeYears; y++){
    accessible = accessible - annualExpenses;
    if(accessible < 0){ bridgeSurvives = false; accessible = 0; }
    accessible = accessible * (1 + r);
    superValue = superValue * (1 + r);
  }

  // Phase 3 — super unlocks and the whole pot has to sustain the 4% draw.
  var potAtPreservation = accessible + superValue;
  var targetFI = annualExpenses * 25;
  return {
    retireAge: retireAge,
    bridgeYears: bridgeYears,
    accessibleAtRetire: accessibleAtRetire,
    bridgeNeeded: annualExpenses * bridgeYears,
    bridgeSurvives: bridgeSurvives,
    accessibleAtPreservation: accessible,
    superAtPreservation: superValue,
    potAtPreservation: potAtPreservation,
    targetFI: targetFI,
    potSustains: potAtPreservation >= targetFI,
    passes: bridgeSurvives && potAtPreservation >= targetFI
  };
}

// Annual living costs, today's dollars — the same definition the 4% target has always used:
// the scenario's shared plus housing costs, excluding investment property (a business-like
// expense funded by its own rent).
export function fireAnnualExpenses(scenario){
  var t = scenarioTotals(scenario || state.activeScenario);
  return (t.sharedMonthly + t.homeMonthly) * 12;
}
// After-tax cash surplus. effectiveIncomeItems() (via scenarioTotals) already excludes Gross rows
// in favour of the synthetic net-of-tax-and-super rows, so this is spendable money and employer
// super is *not* in it — which is why super is contributed separately in the simulation above
// rather than double-counted here.
export function fireAnnualSavings(scenario){
  return scenarioTotals(scenario || state.activeScenario).netMonthly * 12;
}

// The earliest age at which both tests pass. Returns null when no age up to the cap works, which
// is a real answer — "not on these numbers" — and better than a reassuring one.
export function earliestWorkableRetirementAge(opts){
  opts = opts || {};
  var settings = fireSettings();
  var currentAge = opts.currentAge != null ? opts.currentAge : settings.currentAge;
  if(currentAge == null) return null;
  var cap = opts.maxAge != null ? opts.maxAge : 75;
  // Hoisted so a 50-age search doesn't re-derive the same wealth split and rates 50 times.
  var shared = {
    split: opts.split || fireWealthSplit(),
    realReturn: opts.realReturn != null ? opts.realReturn : realReturnRate(),
    annualExpenses: opts.annualExpenses != null ? opts.annualExpenses : fireAnnualExpenses(opts.scenario),
    annualSavings: opts.annualSavings != null ? opts.annualSavings : fireAnnualSavings(opts.scenario),
    superContributions: opts.superContributions != null ? opts.superContributions : annualSuperContributions(),
    currentAge: currentAge,
    preservationAge: opts.preservationAge != null ? opts.preservationAge : settings.preservationAge
  };
  for(var age = currentAge; age <= cap; age++){
    var run = simulateRetirementAt(age, shared);
    if(run && run.passes) return age;
  }
  return null;
}
