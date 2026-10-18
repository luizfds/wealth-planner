import { fireSettings, fireWealthSplit, realReturnRate, annualSuperContributions, simulateRetirementAt, fireAnnualExpenses, fireAnnualSavings, earliestWorkableRetirementAge } from "./fire.js";

// ---------------- The retirement plan (v3.73.0) ----------------
//
// calc/fire.js already answers "can we retire at N": the accessible money has to bridge to
// preservation age, then everything has to sustain a 4% draw. This puts the levers on it — the
// age, what retirement costs, extra saving, extra super — and works out what each one is worth in
// years, so the page can say "what changes it" in the only unit that matters.
//
// levers: { retireAge, annualExpenses, extraSavingsMonthly, extraSuperYearly, realReturn }
export function retirementInputs(levers){
  levers = levers || {};
  var base = {
    split: fireWealthSplit(),
    realReturn: levers.realReturn != null ? levers.realReturn : realReturnRate(),
    annualExpenses: levers.annualExpenses != null ? levers.annualExpenses : fireAnnualExpenses(),
    annualSavings: fireAnnualSavings() + (Number(levers.extraSavingsMonthly) || 0) * 12,
    // Extra concessional super lands after 15% contributions tax.
    superContributions: annualSuperContributions() + (Number(levers.extraSuperYearly) || 0) * 0.85
  };
  var s = fireSettings();
  base.currentAge = s.currentAge;
  base.preservationAge = s.preservationAge;
  return base;
}

export function retirementPlan(levers){
  levers = levers || {};
  var inp = retirementInputs(levers);
  if(inp.currentAge == null) return { needsAge: true };
  var earliest = earliestWorkableRetirementAge(inp);
  var age = levers.retireAge != null ? levers.retireAge : (fireSettings().retireAge != null ? fireSettings().retireAge : (earliest || 60));
  var run = simulateRetirementAt(age, inp);
  // What each lever is worth: the earliest age with that one change on top of the current settings.
  var with_ = function(extra){ return earliestWorkableRetirementAge(Object.assign({}, inp, extra)); };
  var levers_ = [
    { key: "save", label: "Save $500 more a month", age: with_({ annualSavings: inp.annualSavings + 6000 }) },
    { key: "spend", label: "Spend 10% less in retirement", age: with_({ annualExpenses: inp.annualExpenses * 0.9 }) },
    { key: "super", label: "Put $10,000 a year more into super", age: with_({ superContributions: inp.superContributions + 8500 }) },
    { key: "return", label: "Earn 1% a year more", age: with_({ realReturn: inp.realReturn + 0.01 }) }
  ].map(function(l){ return Object.assign(l, { years: earliest != null && l.age != null ? earliest - l.age : null }); });
  return { needsAge: false, inputs: inp, earliest: earliest, age: age, run: run, levers: levers_,
    fiNumber: Math.round(inp.annualExpenses * 25), progress: inp.annualExpenses > 0 ? (inp.split.accessible + inp.split.superValue) / (inp.annualExpenses * 25) : null };
}
