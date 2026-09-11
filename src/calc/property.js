import { state } from "../state.js";
import { STAMP_DUTY_BRACKETS, FHB_RULES, LMI_BANDS } from "../constants.js";
import { periodsOf, sumField, sumFieldForScenario } from "./ledger.js";
import { localDateStr } from "../lib/format.js";

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

// Purchase price plus every itemized acquisition cost (stamp duty, legal, buyer's agent, etc. —
// see state.js's acquisitionCosts comment) — null (not $0) whenever purchasePrice isn't set, so a
// property added without one shows no capital gain/yield-on-cost figure at all rather than a
// misleading number against a $0 cost base. Shared by both functions below so "cost" always means
// the same thing in both places.
function propertyCostBase(property){
  var price = Number(property.purchasePrice);
  if(!(price > 0)) return null;
  var costsTotal = (property.acquisitionCosts || []).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
  return price + costsTotal;
}
// Current value vs. what was actually paid — distinct from the property's own history[] (a log of
// *current* value over time, which for a property added well after the actual purchase starts
// from whatever day it was first logged, never the real purchase price).
export function propertyCapitalGain(property){
  var cost = propertyCostBase(property);
  if(cost == null) return null;
  var value = Number(property.value) || 0;
  var gain = value - cost;
  return { gain: gain, pct: gain / cost };
}
// Annual rent against what was paid, not against today's value (that's the existing gross-yield
// badge) — a different question: "how is my original investment performing" vs. "would this be a
// good buy at today's price". Same null-not-$0 gating as propertyCapitalGain, same reason.
export function propertyYieldOnCost(property){
  var cost = propertyCostBase(property);
  if(cost == null) return null;
  return sumField(property.income, "yearly") / cost;
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

// ---------------- Depreciation ----------------
//
// Usually the largest deduction on an investment property, and the only one that isn't money
// leaving your account — which is exactly why it was the biggest remaining hole. Interest and
// expenses already flowed into gearing; a property claiming neither capital works nor plant was
// understating its tax benefit by thousands a year.
//
// Two separate things, deliberately kept as two fields rather than one "depreciation" number:
//
//   - Capital works (Division 43): the BUILDING. 2.5% of the original construction cost, flat,
//     for 40 years from completion. Not the purchase price — land isn't depreciable, and
//     conflating the two is the single most common way this gets overstated.
//   - Plant & equipment (Division 40): carpets, blinds, appliances, air conditioning. Declines
//     each year rather than running flat, and since 2017 is only claimable on items you bought
//     new (not on a second-hand residential property), which the UI says.
//
// Plant is modelled as a straight-line schedule over an effective life rather than diminishing
// value, because the app has no per-item asset register and averaging across a pool is closer to
// the truth than pretending to a precision it can't support.
export var CAPITAL_WORKS_RATE = 0.025;
export var CAPITAL_WORKS_YEARS = 40;

// Years elapsed since construction, used to stop the 40-year capital-works clock. An unknown or
// future date claims the full year — the conservative reading is the *other* way here (claiming
// nothing), but a blank date on a property someone has flagged as having capital works almost
// always means "I haven't filled this in yet", not "it's 41 years old".
export function capitalWorksAnnual(property, todayStr){
  var cost = Math.max(0, Number(property.constructionCost) || 0);
  if(!cost) return 0;
  var built = property.constructionDate;
  if(built){
    var years = (new Date((todayStr || localDateStr()) + "T00:00:00") - new Date(built + "T00:00:00")) / (365.25 * 86400000);
    if(years >= CAPITAL_WORKS_YEARS) return 0;
  }
  return Math.round(cost * CAPITAL_WORKS_RATE * 100) / 100;
}
export function plantDepreciationAnnual(property){
  var value = Math.max(0, Number(property.plantValue) || 0);
  var life = Math.max(1, Number(property.plantEffectiveLife) || 10);
  if(!value) return 0;
  return Math.round((value / life) * 100) / 100;
}
export function propertyDepreciationAnnual(property, todayStr){
  return Math.round((capitalWorksAnnual(property, todayStr) + plantDepreciationAnnual(property)) * 100) / 100;
}

export function propertyTaxDeductibleResultAnnual(property){
  var rentYearly = sumField(property.income, "yearly");
  var expenseYearly = sumField(property.expenses, "yearly");
  var loanInterestYearly = (property.loans || []).reduce(function(s, l){ return s + loanInterestMonthly(l) * 12; }, 0);
  // Depreciation reduces the taxable result but never touches cash flow — it's the difference
  // between what a property costs you and what it costs you after tax, and the reason a property
  // can be cash-flow negative and still worth holding.
  return rentYearly - expenseYearly - loanInterestYearly - propertyDepreciationAnnual(property);
}
// The same result WITHOUT depreciation — what actually moves through the bank account. Every
// cash-flow figure in the app uses this; only the tax result uses the one above.
export function propertyCashResultAnnual(property){
  var rentYearly = sumField(property.income, "yearly");
  var expenseYearly = sumField(property.expenses, "yearly");
  var loanInterestYearly = (property.loans || []).reduce(function(s, l){ return s + loanInterestMonthly(l) * 12; }, 0);
  return rentYearly - expenseYearly - loanInterestYearly;
}
export function ipDepreciationAnnual(){
  return state.properties.filter(function(p){ return p.kind === "IP"; })
    .reduce(function(sum, p){ return sum + propertyDepreciationAnnual(p); }, 0);
}

// One investment property's ownership split, resolved for `person`.
//
// An empty/absent map means "not told" and splits evenly across `people` — the same default the
// retired global state.tax.ipOwnership had, so an unconfigured save behaves exactly as before.
// Once any share is set the map is authoritative: a person missing from it owns none of this
// property, which is the whole point of moving the split here (one spouse's property, jointly
// held second one). Nothing normalises the shares to 100% — see propertyOwnershipTotal(): a split
// that doesn't add up is a data problem the card should show, not one to paper over by rescaling
// numbers the user typed.
export function propertyOwnershipPct(p, person, people){
  var map = p && p.ownership;
  if(map && Object.keys(map).length) return Number(map[person]) || 0;
  var n = (people || []).length;
  return n ? 100 / n : 0;
}
// Sum of the explicitly-set shares, or null when this property is on the even-split default.
// null and 100 are different answers: one means "not told", the other "told, and it adds up".
export function propertyOwnershipTotal(p){
  var map = p && p.ownership;
  if(!map || !Object.keys(map).length) return null;
  return Object.keys(map).reduce(function(sum, k){ return sum + (Number(map[k]) || 0); }, 0);
}
// Every investment property whose split doesn't add to 100% — what the UI warns on, and the only
// place the old model's silent double-counting could have hidden.
export function ipOwnershipMismatches(){
  return ipProperties().filter(function(p){
    var total = propertyOwnershipTotal(p);
    return total != null && Math.abs(total - 100) > 0.01;
  });
}
// This person's share of the whole portfolio's taxable result, property by property. Replaces
// `ipNetResultAnnual() * (onePercentage / 100)`, which could only ever apply one split to
// everything.
export function personIpResultAnnual(person, people){
  return ipProperties().reduce(function(sum, p){
    return sum + propertyTaxDeductibleResultAnnual(p) * (propertyOwnershipPct(p, person, people) / 100);
  }, 0);
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

// "How often is this loan actually paid" — reuses manualRepaymentFreq for both modes, not just
// manual ones. For a manual loan it's already load-bearing (loanRepaymentMonthly above converts
// the entered amount using this same field). For an auto loan it does nothing to the underlying
// figure — that's always a true monthly amortization/interest calc — it only controls what
// frequency the same total is *displayed* at, the way a lender might quote a mortgage as a
// weekly or fortnightly amount despite calculating and charging it monthly.
export function loanRepaymentDisplay(loan){
  var freq = loan.manualRepaymentFreq || "Monthly";
  var p = periodsOf(loanRepaymentMonthly(loan), "Monthly");
  var amount = freq === "Weekly" ? p.weekly : freq === "Fortnightly" ? p.fortnightly : p.monthly;
  return { amount: amount, freq: freq };
}

export function propertyLoanRepaymentMonthly(property){
  return (property.loans || []).reduce(function(s, l){ return s + loanRepaymentMonthly(l); }, 0);
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

// Which of a scenario's housing rows inflate each year in the projection — i.e. all of them
// except the one the purchase calculator is already paying for.
//
// The homeLoanRow is the one row whose *meaning* depends on the scenario: with the purchase leg
// switched on it's the mortgage, which computeNetWorthSeries() replaces with its own amortised
// repayment (fixed in nominal terms, as a real loan is) and so must not also count here — double
// counting the same housing cost. With the purchase leg off, the very same row is the rent, and
// dropping it left the projection ignoring a renting household's single largest expense.
//
// That was a real, silent, and large error: on a household paying $810/week, the model assumed
// $3,510/month more savings than the Dashboard's own net-savings tile showed for the same
// scenario — and it flattered precisely the scenario the "comes out ahead" headline named.
// Rent inflates, which is why it joins the inflatable set rather than fixedMonthly.
export function scenarioInflatableHomeItems(scenario){
  var homeItems = state.home[scenario] || [];
  var cfg = state.purchase[scenario];
  var investCfg = state.invest[scenario];
  // Same precedence as computeNetWorthSeries(): the invest leg wins if both are somehow on, and
  // with it on there is no purchase repayment, so the row is a housing cost like any other.
  var purchaseEnabled = !!(cfg && cfg.enabled) && !(investCfg && investCfg.enabled);
  if(!purchaseEnabled) return homeItems.slice();
  return homeItems.filter(function(i){ return i.id !== "homeLoanRow"; });
}
export function scenarioInflatableMonthly(scenario){
  return sumFieldForScenario(state.shared, scenario, "monthly") + sumField(scenarioInflatableHomeItems(scenario), "monthly");
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
// Loan Value Ratio — gross loan balance ÷ current value. Deliberately not netted against offset
// (same basis as the Usable-equity tile's own mortgageBalance): lenders price LVR off the actual
// owed balance, not what an offset account happens to be sitting on. Null (not 0) with no value
// set, so a property that's just been added shows no badge rather than a misleading "0% LVR".
export function propertyLVR(property){
  var value = Number(property.value) || 0;
  if(value <= 0) return null;
  var balance = (property.loans || []).reduce(function(s, l){ return s + (Number(l.balance) || 0); }, 0);
  return balance / value;
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
// ---- Portfolio-wide aggregates, for the Properties page's own summary/overview panel (as
// opposed to propertiesTotalEquityToday/propertiesOffsetTotal above, which mainly feed Assets'
// net-worth math) ----
export function propertiesTotalValue(){
  return state.properties.reduce(function(s, p){ return s + (Number(p.value) || 0); }, 0);
}
export function propertiesTotalMortgageBalance(){
  return state.properties.reduce(function(s, p){ return s + (p.loans || []).reduce(function(ss, l){ return ss + (Number(l.balance) || 0); }, 0); }, 0);
}
// Only IPs contribute — a PPOR has no rent to be "cash flow", same scoping as ipProperties() above.
export function propertiesNetCashFlowMonthly(){
  return ipProperties().reduce(function(s, p){ return s + propertyGearingAnnual(p) / 12; }, 0);
}
// Value-weighted (not a simple average of each property's own %) so one large, low-yield IP
// doesn't get equal say to a small, high-yield one — null (not 0) when there's no IP value to
// weight against, so the caller can show "—" instead of a misleading 0.0%.
export function propertiesWeightedGrossYield(){
  var ips = ipProperties();
  var totalValue = ips.reduce(function(s, p){ return s + (Number(p.value) || 0); }, 0);
  if(totalValue <= 0) return null;
  var totalRent = ips.reduce(function(s, p){ return s + sumField(p.income, "yearly"); }, 0);
  return totalRent / totalValue;
}
