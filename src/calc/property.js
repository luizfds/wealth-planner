import { state } from "../state.js";
import { STAMP_DUTY_BRACKETS, FHB_RULES, LMI_BANDS } from "../constants.js";
import { periodsOf, sumField } from "./ledger.js";

export function bracketDuty(brackets, price){
  // At exactly $0, no bracket's "price > b.from" matches (every table's first bracket starts
  // at from:0), so the loop falls through to the top bracket's formula and computes a large
  // negative "duty" — reachable in the app since a freshly-added scenario's purchase calculator
  // starts enabled with price 0 before the user types one in.
  if(price <= 0) return brackets[0].base;
  for(var i = 0; i < brackets.length; i++){
    var b = brackets[i];
    if(price > b.from && price <= b.to) return b.base + (price - b.from) * b.rate;
  }
  var last = brackets[brackets.length - 1];
  return last.base + (price - last.from) * last.rate;
}

export function standardStampDuty(stateCode, price){
  price = Math.max(0, Number(price) || 0);
  if(stateCode === "NSW") return bracketDuty(STAMP_DUTY_BRACKETS.NSW, price);
  if(stateCode === "VIC"){
    if(price <= 960000) return bracketDuty(STAMP_DUTY_BRACKETS.VIC, price);
    if(price <= 2000000) return price * 0.055;
    return 110000 + (price - 2000000) * 0.065;
  }
  return null; // unmodelled state — caller should let the user enter it manually
}

export function calcStampDuty(stateCode, price, isFHB){
  price = Math.max(0, Number(price) || 0);
  var standard = standardStampDuty(stateCode, price);
  if(standard === null) return null;
  if(!isFHB) return standard;
  var rule = FHB_RULES[stateCode];
  if(!rule) return standard;
  if(price <= rule.exemptUpTo) return 0;
  if(price >= rule.concessionUpTo) return standard;
  var frac = (price - rule.exemptUpTo) / (rule.concessionUpTo - rule.exemptUpTo);
  return standard * frac;
}

export function calcLMI(loanAmount, lvr){
  if(lvr <= 0.8) return 0;
  var band = LMI_BANDS.find(function(b){ return lvr <= b.upTo; }) || LMI_BANDS[LMI_BANDS.length - 1];
  return Math.max(0, loanAmount) * band.rate;
}

export function calcRepaymentMonthly(loanAmount, annualRatePct, termYears, repaymentType){
  loanAmount = Math.max(0, Number(loanAmount) || 0);
  if(repaymentType === "IO") return loanAmount * (Number(annualRatePct) || 0) / 100 / 12;
  var n = Math.max(1, Number(termYears) || 0) * 12;
  var r = (Number(annualRatePct) || 0) / 100 / 12;
  if(r <= 0) return loanAmount / n;
  return loanAmount * r / (1 - Math.pow(1 + r, -n));
}

export function purchaseActiveRate(cfg){
  return cfg.repaymentType === "IO" ? (Number(cfg.ioRate) || 0) : (Number(cfg.rate) || 0);
}

export function recalcPurchase(scenario){
  var cfg = state.purchase[scenario];
  if(!cfg) return null;
  var price = Math.max(0, Number(cfg.price) || 0);
  var depositAmt = price * (Math.max(0, Math.min(100, Number(cfg.depositPct) || 0)) / 100);
  var loanAmount = Math.max(0, price - depositAmt);
  // LVR (and so the LMI premium tier) is always based on the loan before any capitalization —
  // matching how lenders actually price it: the premium is set by the LVR you're borrowing at,
  // then optionally added on top of that same loan, not the other way around.
  var lvr = price > 0 ? loanAmount / price : 0;
  var stampDuty = calcStampDuty(cfg.state, price, cfg.firstHomeBuyer);
  var lmi = calcLMI(loanAmount, lvr);
  var lmiCapitalized = !!cfg.lmiCapitalized;
  // The actual balance you'd owe and repay against — most lenders capitalize LMI onto the loan
  // by default rather than requiring it as extra cash, so this (not the pre-LMI loanAmount) is
  // what repayments should be calculated on whenever that's how this scenario is set up.
  var loanBalance = lmiCapitalized ? loanAmount + lmi : loanAmount;
  var otherTotal = (cfg.otherCosts || []).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
  var stampDutyForTotal = stampDuty === null ? (Number(cfg.manualStampDuty) || 0) : stampDuty;
  var upfrontCash = depositAmt + stampDutyForTotal + otherTotal + (lmiCapitalized ? 0 : lmi);
  var repaymentMonthlyPI = calcRepaymentMonthly(loanBalance, cfg.rate, cfg.termYears, "PI");
  var repaymentMonthlyIO = calcRepaymentMonthly(loanBalance, cfg.ioRate, cfg.termYears, "IO");
  var repaymentMonthly = cfg.repaymentType === "IO" ? repaymentMonthlyIO : repaymentMonthlyPI;
  return {
    price: price, depositAmt: depositAmt, loanAmount: loanAmount, loanBalance: loanBalance, lvr: lvr,
    stampDuty: stampDuty, stampDutyForTotal: stampDutyForTotal, lmi: lmi, lmiCapitalized: lmiCapitalized,
    otherTotal: otherTotal, upfrontCash: upfrontCash, repaymentMonthly: repaymentMonthly,
    repaymentMonthlyPI: repaymentMonthlyPI, repaymentMonthlyIO: repaymentMonthlyIO,
    repaymentPeriods: periodsOf(repaymentMonthly, "Monthly")
  };
}

export function propertyGearingAnnual(property){
  var rentYearly = sumField(property.income, "yearly");
  var expenseYearly = sumField(property.expenses, "yearly");
  var loanYearly = (property.loans || []).reduce(function(s, l){ return s + loanRepaymentMonthly(l) * 12; }, 0);
  return rentYearly - expenseYearly - loanYearly;
}

// Only the interest portion of a loan repayment is tax-deductible — principal repayment just
// reduces the liability, it's not a loss. An offset account reduces the balance interest is
// charged on — the same offset balance is also netted against the loan for equity purposes
// (see propertyEquityToday), since offsetBalance is the single source of truth for that money.
// Don't also enter it as a separate Cash asset, or it'll be counted twice.
export function loanInterestMonthlyAtRate(loan, ratePts){
  var interestBalance = Math.max(0, (Number(loan.balance) || 0) - (Number(loan.offsetBalance) || 0));
  var monthlyRate = ratePts / 100 / 12;
  return interestBalance * monthlyRate;
}
export function loanInterestMonthly(loan){
  return loanInterestMonthlyAtRate(loan, Number(loan.rate) || 0);
}

export function propertyTaxDeductibleResultAnnual(property){
  var rentYearly = sumField(property.income, "yearly");
  var expenseYearly = sumField(property.expenses, "yearly");
  var loanInterestYearly = (property.loans || []).reduce(function(s, l){ return s + loanInterestMonthly(l) * 12; }, 0);
  return rentYearly - expenseYearly - loanInterestYearly;
}

export function ipNetResultAnnual(){
  return state.properties.filter(function(p){ return p.kind === "IP"; })
    .reduce(function(sum, p){ return sum + propertyTaxDeductibleResultAnnual(p); }, 0);
}

export function loanBalanceAfterMonths(principal, annualRatePct, termYears, monthsElapsed, repaymentType){
  var n = Math.max(1, Number(termYears) || 0) * 12;
  if(monthsElapsed >= n) return 0;
  if(repaymentType === "IO") return Math.max(0, Number(principal) || 0);
  var r = (Number(annualRatePct) || 0) / 100 / 12;
  if(r <= 0) return Math.max(0, principal - (principal / n) * monthsElapsed);
  var pow = Math.pow(1 + r, monthsElapsed);
  var M = calcRepaymentMonthly(principal, annualRatePct, termYears);
  return Math.max(0, principal * pow - M * ((pow - 1) / r));
}

export function loanRepaymentMonthly(loan){
  if(loan.repaymentMode === "manual") return periodsOf(Number(loan.manualRepaymentAmount) || 0, loan.manualRepaymentFreq || "Monthly").monthly;
  // An interest-only repayment IS the interest owed, so an offset (which reduces interest
  // charged) reduces it too. A P&I repayment is fixed by the bank regardless of any offset —
  // the offset just makes more of each fixed repayment go to principal, paying the loan down
  // faster — so it stays based on the full balance.
  if(loan.repaymentType === "IO") return loanInterestMonthly(loan);
  return calcRepaymentMonthly(loan.balance, loan.rate, loan.termYears, loan.repaymentType);
}

// Projection-only: applies the Rate Shock stress-test to a real loan's rate. Manual-repayment
// loans have no rate to shock, so their entered figure is left as-is.
export function shockedLoanRepaymentMonthly(loan, shockPts){
  if(loan.repaymentMode === "manual") return periodsOf(Number(loan.manualRepaymentAmount) || 0, loan.manualRepaymentFreq || "Monthly").monthly;
  var shockedRate = (Number(loan.rate) || 0) + shockPts;
  if(loan.repaymentType === "IO") return loanInterestMonthlyAtRate(loan, shockedRate);
  return calcRepaymentMonthly(loan.balance, shockedRate, loan.termYears, loan.repaymentType);
}

// Only Investment Property costs are "kept in every scenario" for cash-flow purposes — a PPOR's costs
// are out of scope here since they'd double up with whichever scenario's own home cost is being compared.
export function ipProperties(){ return state.properties.filter(function(p){ return p.kind === "IP"; }); }
export function ipExpensesMonthly(){ return ipProperties().reduce(function(s, p){ return s + sumField(p.expenses, "monthly"); }, 0); }
export function ipLoansMonthly(){ return ipProperties().reduce(function(s, p){ return s + p.loans.reduce(function(ss, l){ return ss + loanRepaymentMonthly(l); }, 0); }, 0); }
export function ipExpenseItemsForClassification(){
  var items = [];
  ipProperties().forEach(function(p){
    items = items.concat(p.expenses);
    p.loans.forEach(function(l){ items.push({ what: l.what, classification: "Needs", amount: loanRepaymentMonthly(l), freq: "Monthly" }); });
  });
  return items;
}

export function scenarioInflatableMonthly(scenario){
  var homeItems = state.home[scenario] || [];
  var homeNonLoan = homeItems.filter(function(i){ return i.id !== "homeLoanRow"; });
  return sumField(state.shared, "monthly") + sumField(homeNonLoan, "monthly");
}

// Property equity is split into two pieces with very different liquidity:
// - offset balance: real cash sitting in a linked transaction account — instantly
//   spendable/withdrawable, so it's treated as liquid alongside Cash/Shares.
// - illiquid equity (value minus the FULL loan balance): only accessible by selling
//   or refinancing the property.
// propertyEquityToday() is their sum — the "how much of this property do I own outright"
// figure — but don't ALSO enter the offset balance as a separate Cash asset (see the
// Offset field's tooltip), or it'll be counted twice.
export function propertyOffsetTotal(property){
  return (property.loans || []).reduce(function(s, l){ return s + (Number(l.offsetBalance) || 0); }, 0);
}
export function propertyIlliquidEquityToday(property){
  var loanTotal = (property.loans || []).reduce(function(s, l){ return s + (Number(l.balance) || 0); }, 0);
  return (Number(property.value) || 0) - loanTotal;
}
export function propertyEquityToday(property){
  return propertyIlliquidEquityToday(property) + propertyOffsetTotal(property);
}
export function propertiesOffsetTotal(){
  return state.properties.reduce(function(s, p){ return s + propertyOffsetTotal(p); }, 0);
}
export function propertiesIlliquidEquityToday(){
  return state.properties.reduce(function(s, p){ return s + propertyIlliquidEquityToday(p); }, 0);
}
export function propertiesTotalEquityToday(){
  return state.properties.reduce(function(s, p){ return s + propertyEquityToday(p); }, 0);
}
