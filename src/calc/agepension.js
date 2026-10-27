// ---------------- Retirement drawdown and the Age Pension (v3.127.0) ----------------
//
// The retirement check stopped at "the pot sustains a 4% draw". What actually happens is an
// account-based pension: super moves into pension phase (earnings untaxed, payments tax-free from
// 60), a minimum share has to come out each year by age, and from Age Pension age the Age Pension
// tops up whatever the assets and income tests allow. This walks a plan year by year in today's
// dollars to 95, so the page can say what income looks like at each age and how much of it the
// pension carries.
//
// Rates are Services Australia's from 20 September 2025 (thresholds from 1 July 2025), held flat
// in today's dollars — they're indexed twice a year, roughly with prices. Pure.

export var AGE_PENSION_AGE = 67;
export var PENSION_RATES_FROM = "20 September 2025";
// Maximum basic rate with the pension and energy supplements, a fortnight.
var MAX_FN = { single: 1178.70, couple: 1777.00 };
// Assets test: full pension up to these, then $3 a fortnight less per $1,000 over.
var ASSETS_FREE = { single: { home: 321500, renter: 579500 }, couple: { home: 481500, renter: 739500 } };
var ASSETS_TAPER = 3 / 1000;
// Income test: free area a fortnight, then 50c less per dollar over (combined, for a couple).
var INCOME_FREE = { single: 218, couple: 380 };
var INCOME_TAPER = 0.5;
// Deeming: financial assets are deemed to earn this, whatever they really earn.
var DEEM = { low: 0.0075, high: 0.0275, threshold: { single: 64200, couple: 106200 } };
export var TRANSFER_BALANCE_CAP = 2000000;

// The minimum an account-based pension must pay each year, as a share of the balance on 1 July.
export function minDrawdownRate(age){
  return age < 65 ? 0.04 : age < 75 ? 0.05 : age < 80 ? 0.06 : age < 85 ? 0.07 : age < 90 ? 0.09 : age < 95 ? 0.11 : 0.14;
}

export function deemedIncome(financial, couple){
  var t = DEEM.threshold[couple ? "couple" : "single"], f = Math.max(0, financial);
  return Math.min(f, t) * DEEM.low + Math.max(0, f - t) * DEEM.high;
}

// The Age Pension a year for the household (both members, for a couple, assumed of pension age):
// { yearly, byAssets, byIncome, test } — the lower of the two tests' results wins.
// opts: { couple, homeowner, assets (assessable: everything but the home), financial (deemed),
// otherIncome (yearly, e.g. rent) }.
export function agePension(opts){
  var who = opts.couple ? "couple" : "single";
  var max = MAX_FN[who] * 26;
  var free = ASSETS_FREE[who][opts.homeowner ? "home" : "renter"];
  var byAssets = Math.max(0, max - Math.max(0, (opts.assets || 0) - free) * ASSETS_TAPER * 26);
  var incomeFn = (deemedIncome(opts.financial || 0, opts.couple) + (opts.otherIncome || 0)) / 26;
  var byIncome = Math.max(0, max - Math.max(0, incomeFn - INCOME_FREE[who]) * INCOME_TAPER * 26);
  var yearly = Math.min(byAssets, byIncome);
  return { yearly: Math.round(yearly), max: Math.round(max), byAssets: Math.round(byAssets), byIncome: Math.round(byIncome),
    test: yearly <= 0 ? "none" : byAssets < byIncome ? "assets" : byIncome < byAssets ? "income" : "neither" };
}

// Year by year from `retireAge` to 95, today's dollars. inputs:
//   currentAge, retireAge, preservationAge, accessible and super at retirement (from
//   simulateRetirementAt), realReturn, annualExpenses, couple, homeowner, otherAssets (assessable
//   but not drawn on — investment property equity, cars), otherIncome (net rent).
// Money outside super is spent first while super is locked; from preservation age super is an
// account-based pension paying at least its minimum, and anything paid beyond what's needed is
// saved back outside super. From Age Pension age the pension pays first and the pot only what's
// left. Returns { rows: [{ age, pot, superBal, outside, drawn, minimum, pension, income, short }],
// lastsTo, pensionFrom, pensionShare }.
export function drawdownPlan(inp){
  var outside = Math.max(0, inp.accessible || 0), sup = Math.max(0, inp.superBalance || 0);
  var r = inp.realReturn || 0, rows = [], lastsTo = 95, pensionFrom = null, pensionTotal = 0, needTotal = 0;
  for(var age = inp.retireAge; age <= 95; age++){
    var need = inp.annualExpenses || 0;
    var superOpen = age >= inp.preservationAge;
    var minimum = superOpen ? sup * minDrawdownRate(age) : 0;
    var pension = 0;
    if(age >= AGE_PENSION_AGE){
      var p = agePension({ couple: inp.couple, homeowner: inp.homeowner, assets: outside + sup + (inp.otherAssets || 0), financial: outside + sup, otherIncome: inp.otherIncome || 0 });
      pension = p.yearly;
      if(pension > 0 && pensionFrom == null) pensionFrom = age;
    }
    var fromPot = Math.max(0, need - pension - (inp.otherIncome || 0));
    // Super pays its minimum regardless; what it pays beyond the need goes back outside.
    var fromSuper = superOpen ? Math.max(minimum, Math.min(sup, Math.max(0, fromPot - outside))) : 0;
    fromSuper = Math.min(sup, fromSuper);
    sup -= fromSuper; outside += fromSuper;
    var fromOutside = Math.min(outside, fromPot);
    outside -= fromOutside;
    var short = Math.max(0, fromPot - fromOutside);
    if(short > 1 && lastsTo === 95) lastsTo = age;
    pensionTotal += Math.min(pension, need); needTotal += need;
    rows.push({ age: age, superBal: Math.round(sup), outside: Math.round(outside), pot: Math.round(sup + outside), drawn: Math.round(fromSuper + fromOutside),
      minimum: Math.round(minimum), pension: Math.round(pension), income: Math.round(pension + fromOutside + (inp.otherIncome || 0)), short: Math.round(short) });
    sup *= 1 + r; outside *= 1 + r;
  }
  return { rows: rows, lastsTo: lastsTo, pensionFrom: pensionFrom, pensionShare: needTotal > 0 ? pensionTotal / needTotal : 0 };
}
