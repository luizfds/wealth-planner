import { state } from "../state.js";
import { STAMP_DUTY_BRACKETS, FHB_RULES, LMI_BANDS, LAND_TAX_BRACKETS } from "../constants.js";
import { periodsOf, sumField, sumFieldForScenario, isoDayNumber, overlapDaysInclusive, householdYearWindow } from "./ledger.js";
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
// Capital works deductions claimed since purchase come off the CGT cost base — for a property
// acquired after 7:30pm on 13 May 1997 (s 110-45(1B) ITAA 1997). Every dollar of building
// depreciation claimed is a dollar more capital gain on sale, so leaving it out understates the
// gain by the whole sum of the deductions. Counted to `todayStr`: whole financial years from the
// one the property was bought in, plus the elapsed share of the current one. Plant isn't part of
// this — it's a separate asset with its own (Division 40) treatment.
//
// Needs a purchase date: without one there's no telling how many years have been claimed, and
// guessing would move the gain by thousands, so it returns 0 and the card says why.
export var CGT_CAPITAL_WORKS_REDUCTION_FROM = "1997-05-13";
export function capitalWorksClaimedToDate(property, todayStr){
  var bought = property && property.purchaseDate;
  if(!bought || bought < CGT_CAPITAL_WORKS_REDUCTION_FROM) return 0;
  var today = todayStr || localDateStr();
  if(bought > today) return 0;
  var total = 0;
  for(var fy = financialYearOf(bought); fy <= financialYearOf(today); fy++){
    var amt = propertyDepreciationForFy(property, fy).capitalWorks;
    var w = fyWindow(fy);
    if(today < w.end){
      amt = amt * overlapDaysInclusive(w.start, today, w.start, today) / overlapDaysInclusive(w.start, w.end, w.start, w.end);
    }
    total += amt;
  }
  return Math.round(total * 100) / 100;
}
export function propertyCapitalGain(property, todayStr){
  var cost = propertyCostBase(property);
  if(cost == null) return null;
  var reduction = capitalWorksClaimedToDate(property, todayStr);
  var costBase = cost - reduction;
  var value = Number(property.value) || 0;
  var gain = value - costBase;
  // pct stays against what was actually paid: "how much has this grown" is a question about the
  // money that went in, and a cost base shrunk by deductions would flatter it.
  return { gain: gain, pct: gain / cost, costBase: costBase, capitalWorksReduction: reduction, paid: cost };
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
// Second-hand plant is not claimable. For residential property bought under a contract made after
// 7:30pm on 9 May 2017, plant & equipment that was already in the property — previously used by
// someone else — can't be depreciated by the new owner (s 40-27 ITAA 1997). That is most
// investment properties bought since, and a quantity surveyor's report still values the items,
// which is exactly how a figure that isn't claimable ends up typed into a field that claims it.
//
// The value is kept, not zeroed: scrapping or replacing an item gives a capital loss of its
// remaining value, and it counts in the CGT calculation on sale.
export function plantIsClaimable(property){
  return !(property && property.plantSecondHand);
}
export function plantDepreciationAnnual(property){
  if(!plantIsClaimable(property)) return 0;
  var value = Math.max(0, Number(property.plantValue) || 0);
  var life = Math.max(1, Number(property.plantEffectiveLife) || 10);
  if(!value) return 0;
  return Math.round((value / life) * 100) / 100;
}
// ---------------- Depreciation for a year ----------------
//
// The two functions above are RATES — what a full year of ownership claims. A tax return needs what
// a particular year actually claims, and the two differ in exactly the years people ask about:
//
//   - the first year, which only runs from the purchase date (a property bought on 31 January has
//     151 days of FY24/25, not 365);
//   - the year the 40-year capital works period ends;
//   - any property with more than one building component — the original build and a later
//     renovation each run their own 40 years from their own completion, so one constructionCost
//     can't represent them.
//
// The last one has no good formula answer, and doesn't need one: a quantity surveyor's report
// prints the claim for every year. So a property can carry that table (depreciationSchedule:
// [{fy, capitalWorks, plant}], fy = the year the financial year starts in) and a year it lists is
// taken from it verbatim. Years it doesn't list fall back to the formula, pro-rated by the days the
// property was held and the capital works period was running.
export function financialYearOf(iso){
  var y = Number(String(iso).slice(0, 4)), m = Number(String(iso).slice(5, 7));
  return m >= 7 ? y : y - 1;
}
export function fyLabel(fy){
  return "FY" + String(fy % 100).padStart(2, "0") + "/" + String((fy + 1) % 100).padStart(2, "0");
}
export function fyWindow(fy){
  return { start: fy + "-07-01", end: (fy + 1) + "-06-30", label: fyLabel(fy) };
}
function scheduleRowFor(property, fy){
  var rows = Array.isArray(property && property.depreciationSchedule) ? property.depreciationSchedule : [];
  for(var i = 0; i < rows.length; i++){ if(Number(rows[i].fy) === fy) return rows[i]; }
  return null;
}
// One whole financial year's claim: { capitalWorks, plant, source }.
export function propertyDepreciationForFy(property, fy){
  var w = fyWindow(fy);
  var row = scheduleRowFor(property, fy);
  if(row){
    return {
      capitalWorks: Math.max(0, Number(row.capitalWorks) || 0),
      plant: plantIsClaimable(property) ? Math.max(0, Number(row.plant) || 0) : 0,
      source: "schedule"
    };
  }
  var fyDays = overlapDaysInclusive(w.start, w.end, w.start, w.end);
  var held = property && property.purchaseDate ? property.purchaseDate : "";
  if(held && held > w.end) return { capitalWorks: 0, plant: 0, source: "formula" };
  // Capital works runs 40 years from completion; the last claimable day is the day before the
  // 40th anniversary. No construction date means no end, same as capitalWorksAnnual().
  var cwRate = Math.round(Math.max(0, Number(property && property.constructionCost) || 0) * CAPITAL_WORKS_RATE * 100) / 100;
  var cwLast = "";
  if(property && property.constructionDate){
    var p = property.constructionDate.split("-").map(Number);
    cwLast = new Date(Date.UTC(p[0] + CAPITAL_WORKS_YEARS, p[1] - 1, p[2] - 1)).toISOString().slice(0, 10);
  }
  var cwDays = overlapDaysInclusive(w.start, w.end, held || w.start, cwLast || w.end);
  var plantDays = overlapDaysInclusive(w.start, w.end, held || w.start, w.end);
  return {
    capitalWorks: Math.round(cwRate * cwDays / fyDays * 100) / 100,
    plant: Math.round(plantDepreciationAnnual(property) * plantDays / fyDays * 100) / 100,
    source: "formula"
  };
}
// Any window: each financial year it touches, weighted by the days it shares with the window. A
// financial-year window is exactly one year's claim; a calendar year is half of two.
export function propertyDepreciationForWindow(property, win){
  win = win || householdYearWindow();
  var out = { capitalWorks: 0, plant: 0, source: "formula" };
  for(var fy = financialYearOf(win.start); fy <= financialYearOf(win.end); fy++){
    var w = fyWindow(fy);
    var shared = overlapDaysInclusive(w.start, w.end, win.start, win.end);
    var fyDays = overlapDaysInclusive(w.start, w.end, w.start, w.end);
    var d = propertyDepreciationForFy(property, fy);
    out.capitalWorks += d.capitalWorks * shared / fyDays;
    out.plant += d.plant * shared / fyDays;
    if(d.source === "schedule") out.source = "schedule";
  }
  out.capitalWorks = Math.round(out.capitalWorks * 100) / 100;
  out.plant = Math.round(out.plant * 100) / 100;
  out.total = Math.round((out.capitalWorks + out.plant) * 100) / 100;
  return out;
}
// This year's claim — what the tax result uses. `todayStr` picks the year (tests pin it).
export function propertyDepreciationAnnual(property, todayStr){
  return propertyDepreciationForWindow(property, householdYearWindow(todayStr)).total;
}

// ---------------- Borrowing costs ----------------
//
// LMI, the lender's establishment/settlement fee, mortgage registration, a valuation the lender
// required, a broker's fee — the cost of taking the LOAN out, as distinct from the cost of buying
// the PROPERTY. The difference matters both ways: purchase costs (stamp duty on the transfer,
// conveyancing) go into the CGT cost base and are never deducted; borrowing costs are deducted and
// never go into the cost base. Typed into acquisitionCosts — the only place they had — they did the
// wrong thing on both counts.
//
// The ATO rule: more than $100 in total is deducted over five years from the day the loan was
// taken out, or over the loan's term if that's shorter, apportioned by DAYS. $100 or less is
// deducted in full in the year it was paid. This follows the ATO's own deductible borrowing
// expenses calculator line for line — the period runs from settlement to the same date five years
// later, each financial year gets total x its days / the period's days rounded to the cent, and the
// cent or so lost to rounding goes into the first year (or comes off the last if rounding
// overshot), so the schedule adds back to exactly what was paid.
//
// Stored as one total rather than an itemised list: only the total enters the rule, and the loan
// editor is already the busiest form in the app. The lender's settlement letter or first loan
// statement has the items. Not modelled yet: writing off what's left when the loan is refinanced
// or paid out early (ROADMAP item 37).
export var BORROWING_COSTS_YEARS = 5;
export var BORROWING_COSTS_IMMEDIATE_LIMIT = 100;

function addYearsIso(iso, years){
  var p = iso.split("-").map(Number);
  // Date.UTC rolls 29 Feb onto 1 Mar in a non-leap target year, which is what DATE() does in the
  // ATO's spreadsheet too.
  var d = new Date(Date.UTC(p[0] + years, p[1] - 1, p[2]));
  return d.toISOString().slice(0, 10);
}
// The whole schedule, one entry per Australian financial year: [{fy, start, end, days, amount}].
// Empty when there's nothing to spread (no costs, or no settlement date to spread them from).
export function borrowingCostsSchedule(loan){
  var total = Math.round((Number(loan && loan.borrowingCosts) || 0) * 100) / 100;
  var settled = loan && loan.settlementDate;
  if(!(total > 0) || !settled || isNaN(isoDayNumber(settled))) return [];
  var fy0 = financialYearOf(settled);
  if(total <= BORROWING_COSTS_IMMEDIATE_LIMIT){
    return [{ fy: fy0, start: fy0 + "-07-01", end: (fy0 + 1) + "-06-30", days: 1, amount: total }];
  }
  var term = Number(loan.borrowingTermYears) || 0;
  var years = term > 0 && term < BORROWING_COSTS_YEARS ? term : BORROWING_COSTS_YEARS;
  // A whole number of years steps the calendar, like the ATO's DATE(year + n, month, day); a
  // fractional term can't, so it's taken in average-length days.
  var periodEndExcl = Math.round(years) === years
    ? addYearsIso(settled, years)
    : new Date((isoDayNumber(settled) + Math.round(years * 365.25)) * 86400000).toISOString().slice(0, 10);
  var periodDays = isoDayNumber(periodEndExcl) - isoDayNumber(settled);
  var lastDay = new Date((isoDayNumber(periodEndExcl) - 1) * 86400000).toISOString().slice(0, 10);
  var rows = [];
  for(var fy = fy0; fy <= financialYearOf(lastDay); fy++){
    var start = fy + "-07-01", end = (fy + 1) + "-06-30";
    var days = overlapDaysInclusive(start, end, settled, lastDay);
    rows.push({ fy: fy, start: start, end: end, days: days, amount: Math.round(total * days / periodDays * 100) / 100 });
  }
  var residual = Math.round((total - rows.reduce(function(s, r){ return s + r.amount; }, 0)) * 100) / 100;
  if(residual > 0) rows[0].amount = Math.round((rows[0].amount + residual) * 100) / 100;
  else if(residual < 0) rows[rows.length - 1].amount = Math.round((rows[rows.length - 1].amount + residual) * 100) / 100;
  // Paid out or refinanced before the spread finished: whatever hasn't been deducted yet is
  // deductible in the financial year the loan ended, and nothing after (v3.27.0). The new loan's
  // own costs start their own five years on the new loan.
  var ended = loan.endedOn;
  if(ended && !isNaN(isoDayNumber(ended)) && ended >= settled && ended < lastDay){
    var endFy = financialYearOf(ended);
    var before = rows.filter(function(r){ return r.fy < endFy; });
    var claimed = before.reduce(function(s, r){ return s + r.amount; }, 0);
    var last = rows.find(function(r){ return r.fy === endFy; });
    if(last){
      last.amount = Math.round((total - claimed) * 100) / 100;
      last.writtenOff = true;
      before.push(last);
    }
    rows = before;
  }
  return rows;
}
// What's deductible in one window. A financial-year window lines up with one schedule row exactly;
// a calendar-year window (a household that thinks in calendar years) takes each financial year's
// amount in proportion to the days it shares with the window.
export function borrowingCostsDeduction(loan, win){
  win = win || householdYearWindow();
  return Math.round(borrowingCostsSchedule(loan).reduce(function(sum, r){
    var shared = overlapDaysInclusive(r.start, r.end, win.start, win.end);
    var fyDays = overlapDaysInclusive(r.start, r.end, r.start, r.end);
    return sum + (shared >= fyDays ? r.amount : r.amount * shared / fyDays);
  }, 0) * 100) / 100;
}
export function propertyBorrowingCostsDeduction(property, win){
  return (property.loans || []).reduce(function(s, l){ return s + borrowingCostsDeduction(l, win); }, 0);
}

export function propertyTaxDeductibleResultAnnual(property){
  var rentYearly = sumField(property.income, "yearly");
  var expenseYearly = sumField(property.expenses, "yearly");
  var loanInterestYearly = (property.loans || []).reduce(function(s, l){ return s + loanInterestMonthly(l) * 12; }, 0);
  // Depreciation reduces the taxable result but never touches cash flow — it's the difference
  // between what a property costs you and what it costs you after tax, and the reason a property
  // can be cash-flow negative and still worth holding.
  // Borrowing costs are the same kind of thing: deducted over years, paid once at settlement.
  return rentYearly - expenseYearly - loanInterestYearly - propertyDepreciationAnnual(property) -
    propertyBorrowingCostsDeduction(property);
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
// That was a real, silent, and large error: on a household paying $***/week, the model assumed
// $***REMOVED***/month more savings than the Dashboard's own net-savings tile showed for the same
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

// ---------------- Land tax ----------------
// See LAND_TAX_BRACKETS in constants.js for the tables, the year they're from, and what's
// deliberately out of scope.

// Land tax on one *aggregated* taxable land value, for one state. Returns 0 below the threshold
// and null for a state with no table — null rather than 0 because "we don't have Tasmania's
// scale" and "you owe nothing" are different answers, and showing the second when you mean the
// first is exactly the kind of quiet wrong number this app tries not to produce.
export function calcLandTax(stateCode, aggregatedLandValue){
  var brackets = LAND_TAX_BRACKETS[stateCode];
  if(!brackets) return null;
  var value = Math.max(0, Number(aggregatedLandValue) || 0);
  // Highest bracket whose floor the value reaches. Walking down rather than up so the first
  // match is the right one without needing each bracket to carry its own upper bound.
  var band = null;
  for(var i = brackets.length - 1; i >= 0; i--){
    if(value >= brackets[i].from){ band = brackets[i]; break; }
  }
  if(!band) return 0;
  return Math.max(0, band.base + band.rate * (value - band.from));
}

// Which properties are actually assessed: investment properties only. A principal home is exempt
// in NSW, VIC and QLD alike, so a PPOR neither pays land tax nor pushes the investments further up
// the scale by being aggregated with them. That exemption is the single biggest reason a buy
// scenario doesn't change this number — worth knowing when comparing rent against buy.
export function landTaxableProperties(){
  return (state.properties || []).filter(function(p){
    return p.kind === "IP" && LAND_TAX_BRACKETS[p.state] && (Number(p.landValue) || 0) > 0;
  });
}

// The whole picture, grouped the way the assessment actually arrives: one per state, on the sum of
// that state's land values.
//
// `share` apportions each state's bill back to its individual properties by land value, which is
// what lets a per-property expense row exist at all. The apportionment is presentational — the
// liability is genuinely joint and genuinely non-linear, so a property's share is not what it
// would pay standing alone. It's the only split that adds back up to the real total, which is the
// property that matters for every rollup downstream.
export function landTaxByState(){
  var byState = {};
  landTaxableProperties().forEach(function(p){
    var s = p.state;
    if(!byState[s]) byState[s] = { state: s, landValue: 0, properties: [] };
    byState[s].landValue += Number(p.landValue) || 0;
    byState[s].properties.push(p);
  });
  return Object.keys(byState).map(function(s){
    var group = byState[s];
    var tax = calcLandTax(s, group.landValue) || 0;
    return {
      state: s,
      landValue: group.landValue,
      tax: tax,
      properties: group.properties.map(function(p){
        var lv = Number(p.landValue) || 0;
        var share = group.landValue > 0 ? lv / group.landValue : 0;
        return { id: p.id, what: p.what, landValue: lv, share: share, tax: tax * share };
      })
    };
  });
}

// One property's apportioned annual land tax, with the context needed to describe it honestly.
// `tax` on its own is not self-explanatory once more than one property is aggregated: two $700k
// NSW blocks each owe nothing alone but $*** each together, so a row captioned "land tax on
// $700,000" would name a figure that is $0 by that description. Callers get the group's combined
// value and count so they can say which of the two situations they are in.
export function landTaxDetailForProperty(propertyId){
  var detail = null;
  landTaxByState().forEach(function(group){
    group.properties.forEach(function(p){
      if(p.id !== propertyId) return;
      detail = {
        state: group.state,
        tax: p.tax,
        share: p.share,
        landValue: p.landValue,
        groupLandValue: group.landValue,
        groupCount: group.properties.length
      };
    });
  });
  return detail;
}
// One property's apportioned annual land tax.
export function landTaxForProperty(propertyId){
  var detail = landTaxDetailForProperty(propertyId);
  return detail ? detail.tax : 0;
}

// Total annual land tax across every state, for the Properties page's portfolio summary.
export function totalLandTax(){
  return landTaxByState().reduce(function(sum, g){ return sum + g.tax; }, 0);
}
