// ---------------- A scenario as a list of changes (v3.173.0, item 208) ----------------
//
// "What if we buy an investment property and rent a bigger house to live in?" — two changes against
// the household. calc/scenariochanges.js keeps a scenario's changes; this is what each new kind does
// to a month and to each projected year. Kinds (each optionally from a later year, `fromYear` 0 = now):
//
//   rent — live somewhere else at this rent:     { kind: "rent", what, amount, freq, fromYear }
//   ip   — buy an investment property:           { kind: "ip", what, price, depositPct, rate, termYears,
//          repaymentType ("PI"|"IO"), state, rentWeekly, vacancyWeeks, mgmtPct, costsYearly,
//          growthPct (blank = the projection's property rate), depreciationYearly, owner ("" = shared), fromYear }
//   cost — a cost (or, negative, a saving) the household doesn't have today: { kind: "cost", what, amount, freq, fromYear }
//   sell — sell a property you own:              { kind: "sell", propertyId, fromYear, sellingCostsPct }
//   extra — pay a loan down faster (v3.174.0):   { kind: "extra", propertyId, amount, freq, rate, fromYear } —
//          out of each month's savings, into the loan at its rate (equity, not spending)
//
// The investment property is priced the way a real one is: rent less vacancy and management, its
// costs, the loan, and the tax effect — the year's result (rent less management, costs, interest and
// depreciation) at the owner's marginal rate plus the Medicare levy; a loss comes back as a refund.
// Pure: rates, today's values and property figures come in through `ctx`.

import { periodsOf } from "./ledger.js";
import { calcRepaymentMonthly, calcStampDuty, calcLMI, loanBalanceAfterMonths } from "./property.js";

export var CHANGE_KINDS = [
  { key: "rent", label: "Rent somewhere new", hint: "Live elsewhere, at this rent — today's home costs stop in this scenario" },
  { key: "ip", label: "Buy an investment property", hint: "Rent coming in, its costs, the loan and the tax effect" },
  { key: "cost", label: "A new cost or saving", hint: "Childcare, a second car, a gym you'd stop" },
  { key: "sell", label: "Sell a property you own", hint: "Its equity becomes cash in the year you choose" },
  { key: "extra", label: "Pay a loan down faster", hint: "Extra repayments each month, saved at the loan's rate" },
  { key: "amount", label: "A line costs a different amount", hint: "A budget line or a pay that would be different" }
];
var MEDICARE = 0.02;
function r2(n){ return Math.round(n * 100) / 100; }
function num(v, d){ var n = Number(v); return isFinite(n) && v !== "" && v != null ? n : (d || 0); }

export function newChange(kind, id, ctx){
  ctx = ctx || {};
  if(kind === "rent") return { id: id, kind: "rent", what: "Rent", amount: 850, freq: "Weekly", fromYear: 0 };
  if(kind === "cost") return { id: id, kind: "cost", what: "A new cost", amount: 100, freq: "Monthly", fromYear: 0 };
  if(kind === "extra") return { id: id, kind: "extra", propertyId: (ctx.properties && ctx.properties[0] && ctx.properties[0].id) || "", amount: 500, freq: "Monthly", rate: (ctx.loanRate != null ? ctx.loanRate : 6), fromYear: 0 };
  if(kind === "sell") return { id: id, kind: "sell", propertyId: (ctx.properties && ctx.properties[0] && ctx.properties[0].id) || "", fromYear: 1, sellingCostsPct: 2.5 };
  return { id: id, kind: "ip", what: "Investment property", price: 650000, depositPct: 20, rate: 6.2, termYears: 30, repaymentType: "IO",
    state: ctx.state || "NSW", rentWeekly: 580, vacancyWeeks: 2, mgmtPct: 7, costsYearly: 4500, growthPct: "", depreciationYearly: 4000, owner: "", fromYear: 0 };
}

// What an investment property does, in a year once bought, today's dollars. ctx.marginalRate: the
// owner's marginal tax rate (0.3 for 30%), Medicare levy added here.
export function ipFigures(c, ctx){
  ctx = ctx || {};
  var price = Math.max(0, num(c.price));
  var deposit = price * Math.max(0, Math.min(100, num(c.depositPct, 20))) / 100;
  var loan = Math.max(0, price - deposit);
  var rate = num(c.rate) + num(ctx.rateShockPts);
  var repaymentMonthly = calcRepaymentMonthly(loan, rate, num(c.termYears, 30), c.repaymentType === "IO" ? "IO" : "PI");
  // Interest in its first year: a whole year of the interest-only payment, or a P&I loan's own split.
  var balAfter = loanBalanceAfterMonths(loan, rate, num(c.termYears, 30), 12, c.repaymentType === "IO" ? "IO" : "PI");
  var interestYearly = repaymentMonthly * 12 - (loan - balAfter);
  var rentYearly = Math.max(0, num(c.rentWeekly)) * Math.max(0, 52 - Math.max(0, num(c.vacancyWeeks)));
  var mgmtYearly = rentYearly * Math.max(0, num(c.mgmtPct)) / 100;
  var costsYearly = Math.max(0, num(c.costsYearly));
  var depreciationYearly = Math.max(0, num(c.depreciationYearly));
  var taxableYearly = rentYearly - mgmtYearly - costsYearly - interestYearly - depreciationYearly;
  var taxRate = num(ctx.marginalRate) + MEDICARE;
  var taxEffectYearly = -taxableYearly * taxRate; // a loss (negative result) comes back as a refund
  var stampDuty = calcStampDuty(c.state || "NSW", price, false);
  var lmi = calcLMI(loan, price > 0 ? loan / price : 0);
  var otherUpfront = num(ctx.otherUpfront, 2500);
  var cashBeforeTaxMonthly = (rentYearly - mgmtYearly - costsYearly) / 12 - repaymentMonthly;
  return {
    price: price, deposit: r2(deposit), loan: r2(loan), repaymentMonthly: r2(repaymentMonthly), interestYearly: r2(interestYearly),
    rentYearly: r2(rentYearly), mgmtYearly: r2(mgmtYearly), costsYearly: r2(costsYearly), depreciationYearly: r2(depreciationYearly),
    taxableYearly: r2(taxableYearly), taxRate: taxRate, taxEffectYearly: r2(taxEffectYearly),
    cashBeforeTaxMonthly: r2(cashBeforeTaxMonthly), cashAfterTaxMonthly: r2(cashBeforeTaxMonthly + taxEffectYearly / 12),
    upfront: r2(deposit + (stampDuty || 0) + lmi + otherUpfront), stampDuty: stampDuty || 0, lmi: r2(lmi)
  };
}

// A scenario's month once its changes have all happened: what comes in and goes out on top of the
// household (today's home lines are already left out by a scenario that rents elsewhere).
// ctx: { marginalRateFor(owner) }.
export function legsMonthly(changes, ctx){
  ctx = ctx || {};
  var out = { incomeMonthly: 0, expensesMonthly: 0, homeMonthly: 0, ipTaxMonthly: 0, upfront: 0, extraMonthly: 0 };
  (changes || []).forEach(function(c){
    if(!c) return;
    if(c.kind === "rent"){ var m = periodsOf(num(c.amount), c.freq || "Weekly").monthly; out.homeMonthly += m; out.expensesMonthly += m; }
    else if(c.kind === "cost"){ out.expensesMonthly += periodsOf(num(c.amount), c.freq || "Monthly").monthly; }
    else if(c.kind === "extra"){ var em = periodsOf(num(c.amount), c.freq || "Monthly").monthly; out.expensesMonthly += em; out.extraMonthly = (out.extraMonthly || 0) + em; }
    else if(c.kind === "ip"){
      var f = ipFigures(c, { marginalRate: ctx.marginalRateFor ? ctx.marginalRateFor(c.owner) : 0, rateShockPts: ctx.rateShockPts });
      out.incomeMonthly += (f.rentYearly + f.taxEffectYearly) / 12;
      out.ipTaxMonthly += f.taxEffectYearly / 12;
      out.expensesMonthly += (f.mgmtYearly + f.costsYearly) / 12 + f.repaymentMonthly;
      out.upfront += f.upfront;
    }
  });
  Object.keys(out).forEach(function(k){ out[k] = r2(out[k]); });
  return out;
}

// What the changes do in projection year `year` (1 = the coming twelve months), for the projection:
// { savingsMonthly } added to that year's monthly surplus (nominal), { lump } added to (or taken from)
// cash at the start of it, { equity, debt } the property side at the year's end (nominal).
// ctx: { inflationRate, propRate, marginalRateFor(owner), rateShockPts, sold: { [propertyId]: { proceeds, cashMonthly } } }.
export function legsInYear(changes, year, ctx){
  ctx = ctx || {};
  var infl = Math.pow(1 + num(ctx.inflationRate), year);
  var out = { savingsMonthly: 0, lump: 0, equity: 0, debt: 0, inflatableMonthly: 0 };
  (changes || []).forEach(function(c){
    if(!c) return;
    var from = Math.max(0, Math.floor(num(c.fromYear)));
    var startYear = from + 1; // "now" is the first projected year
    if(c.kind === "rent" || c.kind === "cost"){
      if(year < startYear) return;
      var m = periodsOf(num(c.amount), c.freq || "Monthly").monthly;
      out.savingsMonthly -= m * infl;
      out.inflatableMonthly += m;
      return;
    }
    if(c.kind === "ip"){
      if(year < startYear) return;
      var g = c.growthPct !== "" && c.growthPct != null ? num(c.growthPct) / 100 : num(ctx.propRate);
      var rate = num(c.rate) + num(ctx.rateShockPts), term = num(c.termYears, 30), type = c.repaymentType === "IO" ? "IO" : "PI";
      var f = ipFigures(c, { marginalRate: ctx.marginalRateFor ? ctx.marginalRateFor(c.owner) : 0, rateShockPts: ctx.rateShockPts });
      // Bought at the start of its year, at the price grown to then; the loan is fixed in dollars from there.
      var atBuy = Math.pow(1 + g, from), loan = f.loan * atBuy, repay = f.repaymentMonthly * atBuy;
      if(year === startYear) out.lump -= f.upfront * atBuy;
      var held = year - startYear; // whole years held before this one
      var balStart = loanBalanceAfterMonths(loan, rate, term, held * 12, type), balEnd = loanBalanceAfterMonths(loan, rate, term, (held + 1) * 12, type);
      var interest = repay * 12 - (balStart - balEnd);
      var rent = f.rentYearly * infl, mgmt = f.mgmtYearly * infl, costs = f.costsYearly * infl;
      var taxable = rent - mgmt - costs - interest - f.depreciationYearly;
      out.savingsMonthly += (rent - mgmt - costs) / 12 - repay - taxable * f.taxRate / 12;
      var value = f.price * Math.pow(1 + g, year);
      out.equity += value - balEnd;
      out.debt += balEnd;
      return;
    }
    if(c.kind === "extra"){
      if(year < startYear) return;
      // Each month's extra comes out of savings and pays the loan down; what's been paid in, with the
      // interest it saved (the loan's rate), is equity — capped at what the loan owed.
      var em = periodsOf(num(c.amount), c.freq || "Monthly").monthly, i = num(c.rate) / 100 / 12, n = (year - startYear + 1) * 12;
      var fv = i > 0 ? em * (Math.pow(1 + i, n) - 1) / i : em * n;
      var cap = ctx.loanBalanceAt ? ctx.loanBalanceAt(c.propertyId, year) : Infinity;
      var kept = Math.min(fv, cap);
      out.savingsMonthly -= kept >= cap ? 0 : em;
      out.equity += kept;
      out.debt -= kept;
      return;
    }
    if(c.kind === "sell"){
      var s = ctx.sold && ctx.sold[c.propertyId];
      if(!s) return;
      if(year === startYear) out.lump += s.proceedsAt(year);
      if(year >= startYear) out.savingsMonthly -= s.cashMonthly * infl;
    }
  });
  return out;
}

// In words, for the scenario's list.
export function changeSummary(c, ctx){
  ctx = ctx || {};
  var money = ctx.money || function(n){ return "$" + Math.round(n).toLocaleString("en-AU"); };
  var when = num(c.fromYear) > 0 ? " · from year " + (num(c.fromYear) + 1) : "";
  if(c.kind === "rent") return "Rent " + money(num(c.amount)) + " " + String(c.freq || "Weekly").toLowerCase() + when;
  if(c.kind === "cost") return (c.what || "A cost") + ": " + money(num(c.amount)) + " " + String(c.freq || "Monthly").toLowerCase() + when;
  if(c.kind === "ip") return (c.what || "Investment property") + ": " + money(num(c.price)) + " in " + (c.state || "NSW") + ", rent " + money(num(c.rentWeekly)) + "/week" + when;
  if(c.kind === "extra") return "Pay " + ((ctx.propertyName && ctx.propertyName(c.propertyId)) || "the loan") + " down by " + money(num(c.amount)) + " " + String(c.freq || "Monthly").toLowerCase() + " extra" + when;
  if(c.kind === "sell") return "Sell " + ((ctx.propertyName && ctx.propertyName(c.propertyId)) || "a property") + " in year " + (num(c.fromYear) + 1);
  return "";
}
