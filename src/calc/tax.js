import { state } from "../state.js";
import { AU_TAX_BRACKETS, MAX_SUPER_BASE, HELP_REPAYMENT_RATES, MLS_TIERS, MLS_FAMILY_MULTIPLIER } from "../constants.js";
import { periodsOf, resolveSharedAmount, householdYearWindow } from "./ledger.js";
import { ipNetResultAnnual } from "./property.js";
import { fmtCurrency0 } from "../lib/format.js";

export function incomeTaxAU(taxable){
  taxable = Math.max(0, Number(taxable) || 0);
  for(var i = 0; i < AU_TAX_BRACKETS.length; i++){
    var b = AU_TAX_BRACKETS[i];
    if(taxable <= b.to) return b.base + (taxable - b.from) * b.rate;
  }
  return 0;
}
export function marginalRateAU(taxable){
  taxable = Math.max(0, Number(taxable) || 0);
  for(var i = 0; i < AU_TAX_BRACKETS.length; i++){
    if(taxable <= AU_TAX_BRACKETS[i].to) return AU_TAX_BRACKETS[i].rate;
  }
  return AU_TAX_BRACKETS[AU_TAX_BRACKETS.length - 1].rate;
}
// Medicare levy low-income shade-in — approximate current singles thresholds (also indexed yearly).
export function medicareLevyAU(taxable){
  taxable = Math.max(0, Number(taxable) || 0);
  var lower = 26000, upper = 32500;
  if(taxable <= lower) return 0;
  if(taxable <= upper) return (taxable - lower) * 0.10;
  return taxable * 0.02;
}

// ---------------- Capital gains ----------------
//
// Cost basis was stored (a holding's avgCost, a property's purchasePrice) but there was no sale
// event, so the app could show an unrealised gain and had no way to say what realising it would
// cost. That's the question people actually ask before selling, and the 12-month discount is why
// the answer is rarely what they guess.
//
// A CGT event is recorded on the asset itself rather than as a separate ledger: {date, units,
// proceeds, costBase, acquired} on `asset.sales[]`. Keeping it with the asset means a sale can't
// be orphaned from the thing sold, and the asset already carries everything else about it.
//
// The discount is the whole point. Held more than 12 months, an individual's gain is halved before
// tax. "More than", not "at least" — 12 months to the day doesn't qualify, and a sale one day early
// costs half the discount, which is exactly the kind of thing worth being precise about.
export var CGT_DISCOUNT = 0.5;
export var CGT_DISCOUNT_MIN_DAYS = 366;

export function heldDays(acquired, sold){
  if(!acquired || !sold) return 0;
  var a = new Date(acquired + "T00:00:00"), b = new Date(sold + "T00:00:00");
  return Math.round((b - a) / 86400000);
}
export function qualifiesForCgtDiscount(acquired, sold){
  return heldDays(acquired, sold) >= CGT_DISCOUNT_MIN_DAYS;
}
// One sale's capital gain picture. A capital LOSS never gets the discount — the discount only ever
// applies to a gain, and halving a loss would understate a real offset.
export function saleCapitalGain(sale){
  var proceeds = Number(sale.proceeds) || 0;
  var costBase = Number(sale.costBase) || 0;
  var raw = Math.round((proceeds - costBase) * 100) / 100;
  var discounted = qualifiesForCgtDiscount(sale.acquired, sale.date) && raw > 0;
  return {
    raw: raw,
    isLoss: raw < 0,
    discountApplied: discounted,
    heldDays: heldDays(sale.acquired, sale.date),
    // What actually goes into taxable income. Losses pass through whole; gains are halved only
    // when the holding period qualifies.
    assessable: Math.round((discounted ? raw * (1 - CGT_DISCOUNT) : raw) * 100) / 100
  };
}
// Every sale recorded against this person's assets, within the window if one is given.
//
// Losses are netted against gains BEFORE the discount in the real rules; this applies the discount
// per sale instead, which is the simplification the rest of this engine is built on and is stated
// in the UI. It differs only when a discounted gain and a loss land in the same year.
export function personCapitalGains(person, opts){
  opts = opts || {};
  var people = getTaxPeople();
  var total = { assessable: 0, raw: 0, discounted: 0, sales: [] };
  state.assets.forEach(function(a){
    if(!Array.isArray(a.sales) || !a.sales.length) return;
    if(a.person ? a.person !== person : people.length > 1) return;
    a.sales.forEach(function(sale){
      if(opts.from && sale.date < opts.from) return;
      if(opts.to && sale.date > opts.to) return;
      var g = saleCapitalGain(sale);
      total.raw += g.raw;
      total.assessable += g.assessable;
      if(g.discountApplied) total.discounted += g.raw - g.assessable;
      total.sales.push({ what: a.what, date: sale.date, gain: g });
    });
  });
  total.raw = Math.round(total.raw * 100) / 100;
  total.assessable = Math.round(total.assessable * 100) / 100;
  total.discounted = Math.round(total.discounted * 100) / 100;
  return total;
}

// ---------------- Dividends & franking credits ----------------
//
// Shares were tracked by quantity and price, so the app knew what a holding was worth and knew
// nothing about what it paid. That's half of what a share portfolio is for, and all of what it
// contributes to a tax return.
//
// Franking is the part worth modelling carefully, because it's the part that surprises people.
// An Australian company pays 30% tax before distributing, so a franked dividend arrives with a
// credit for tax already paid. You declare the GROSSED-UP amount (cash + credit) as income, then
// subtract the credit from your tax bill. The consequences run both ways and neither is obvious:
//
//   - Above a 30% marginal rate, a fully franked dividend still costs you tax (the top-up).
//   - Below it — and especially at 0%, e.g. in retirement — the credit is REFUNDABLE in Australia,
//     so the dividend can pay you more than it distributed.
//
// Showing the cash figure alone, or treating the credit as a nice extra, gets both of those wrong.
export var COMPANY_TAX_RATE = 0.30;

// The imputation credit attached to a dividend: the company tax already paid on the franked
// portion. cash * rate/(1-rate) — the standard gross-up, not cash * rate, because the cash is what
// is left AFTER the company paid, not the pre-tax profit.
export function frankingCredit(cashDividend, frankedPct){
  var cash = Math.max(0, Number(cashDividend) || 0);
  var franked = Math.max(0, Math.min(100, frankedPct == null ? 100 : Number(frankedPct) || 0)) / 100;
  return Math.round(cash * franked * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE)) * 100) / 100;
}
// One holding's yearly dividend picture. Per-unit times units held, so it follows the holding's
// size instead of going stale the moment units are bought or sold.
export function holdingDividend(asset){
  var units = Math.max(0, Number(asset.quantity) || 0);
  var cash = Math.round(units * (Number(asset.dividendPerUnit) || 0) * 100) / 100;
  var credit = frankingCredit(cash, asset.frankedPct);
  return {
    cash: cash,
    credit: credit,
    // What you declare: cash plus the credit. Forgetting the gross-up understates taxable income
    // and overstates the benefit.
    grossedUp: Math.round((cash + credit) * 100) / 100,
    frankedPct: asset.frankedPct == null ? 100 : asset.frankedPct
  };
}
// Every Shares holding attributed to this person. An unattributed holding follows the same rule as
// an unattributed deduction: it belongs to the only person, or to nobody when there are two.
export function personDividends(person){
  var people = getTaxPeople();
  return state.assets.filter(function(a){
    if(a.category !== "Shares" || !(Number(a.dividendPerUnit) || 0)) return false;
    if(!a.person) return people.length <= 1;
    return a.person === person;
  }).reduce(function(acc, a){
    var d = holdingDividend(a);
    acc.cash += d.cash;
    acc.credit += d.credit;
    acc.grossedUp += d.grossedUp;
    return acc;
  }, { cash: 0, credit: 0, grossedUp: 0 });
}

// ---------------- Work-related deductions ----------------
//
// Any budget line can be flagged deductible and attributed to a person — a laptop, a professional
// subscription, union fees, a home-office share, a donation, last year's tax agent fee. Until this
// existed the app tracked those expenses precisely and then threw the information away at tax time,
// which is the gap worth closing: the data was already being typed in.
//
// Two fields on the row, not one. `deductible` is the flag; `deductiblePct` is how much of it is
// work-related, because the honest answer for a phone bill or a car is rarely 100% and a flag alone
// would either overstate the claim or push people to keep a second set of numbers somewhere else.
//
// Deductions reduce *taxable* income, which means they also reduce the Medicare levy and — because
// surcharge and repayment income are both built on taxable income — can move the MLS tier and the
// HELP rate. That cascade is the reason this is computed inside the tax chain rather than presented
// as a standalone "you could claim $X" note.
// The list of budget lines that might be flagged deductible has to come from
// components/expenses.js's budgetLineItems() — it walks state.shared, the active scenario's housing
// and every investment property — and calc/ can't import a component. Rather than making every
// caller of computePersonTax pass it (there are callers in four files, and a deduction silently
// vanishing wherever one forgot would be the worst possible failure mode for a tax figure),
// app.js registers a provider once at startup. Same shape as nav.js's setOverlayCleanup.
//
// Unset — which is how the unit tests run — means no deductions, so every existing test and every
// caller behaves exactly as it did before this existed.
var deductibleItemsProvider = null;
export function setDeductibleItemsProvider(fn){ deductibleItemsProvider = fn; }
function deductibleItemsFor(opts){
  if(opts && opts.deductibleItems) return opts.deductibleItems;
  return deductibleItemsProvider ? deductibleItemsProvider() : null;
}

export function deductionRows(items, person){
  return (items || []).filter(function(i){
    if(!i.deductible) return false;
    // A row with no person attributed belongs to whoever is being computed only when there's
    // exactly one person — otherwise it's ambiguous and silently loading it onto the first person
    // would be worse than asking.
    if(!i.deductiblePerson) return getTaxPeople().length <= 1;
    return i.deductiblePerson === person;
  });
}
// The claimable amount of one row, per year: its annual cost times its work-related share.
export function rowDeductionAnnual(item){
  var pct = item.deductiblePct == null ? 100 : Math.max(0, Math.min(100, Number(item.deductiblePct) || 0));
  return periodsOf(Number(item.amount) || 0, item.freq).yearly * (pct / 100);
}
export function personDeductionsAnnual(person, items){
  return deductionRows(items, person).reduce(function(sum, item){
    return sum + rowDeductionAnnual(item);
  }, 0);
}

// ---------------- Medicare levy surcharge ----------------
//
// The levy you pay for NOT having private hospital cover. Modelled because the app has every input
// the question needs — income, and whether you hold cover — and it's the one tax figure that's
// directly actionable: "is private hospital cover worth it" is answerable by comparing the
// surcharge against a policy premium, and until now the app couldn't do either side of that.
//
// Flat on the whole income like HELP, not marginal: crossing a tier costs the full step.
export function mlsThresholds(family){
  var mult = family ? MLS_FAMILY_MULTIPLIER : 1;
  return MLS_TIERS.map(function(t){ return { from: t.from * mult, rate: t.rate, label: t.label }; });
}
export function mlsTierFor(surchargeIncome, family){
  var income = Math.max(0, Number(surchargeIncome) || 0);
  var tiers = mlsThresholds(family);
  var current = tiers[0];
  for(var i = 0; i < tiers.length; i++){
    if(income >= tiers[i].from) current = tiers[i];
    else break;
  }
  return current;
}
// hasCover short-circuits the whole thing: holding hospital cover means no surcharge at any income.
export function medicareSurchargeAnnual(surchargeIncome, hasCover, family){
  if(hasCover) return 0;
  var income = Math.max(0, Number(surchargeIncome) || 0);
  return Math.round(income * mlsTierFor(income, family).rate * 100) / 100;
}
// What the next tier would cost — the number that makes "should I get cover" answerable, since
// crossing a tier is a step, not a slope.
export function mlsNextTier(surchargeIncome, family){
  var income = Math.max(0, Number(surchargeIncome) || 0);
  var tiers = mlsThresholds(family);
  for(var i = 0; i < tiers.length; i++){
    if(tiers[i].from > income){
      return {
        at: tiers[i].from,
        rate: tiers[i].rate,
        away: tiers[i].from - income,
        stepCost: Math.round((tiers[i].from * tiers[i].rate - income * mlsTierFor(income, family).rate) * 100) / 100
      };
    }
  }
  return null;
}

// One person's income for surcharge purposes, computed WITHOUT calling computePersonTax — which
// would recurse, since computePersonTax needs the household total to pick a family tier.
//
// Deliberately a small duplicate of the taxable-income line in computePersonTax rather than a
// shared helper: pulling that apart would mean threading five intermediate values through two
// functions to save four lines, and this is the only other caller.
function personSurchargeIncome(person, opts){
  var inc = personIncomeBreakdown(person, opts);
  var settings = personTaxSettings(person);
  var people = getTaxPeople();
  var ownershipPct = (state.tax.ipOwnership && state.tax.ipOwnership[person] != null)
    ? Number(state.tax.ipOwnership[person])
    : (people.length ? 100 / people.length : 0);
  var sacrifice = Math.max(0, Number(settings.superSacrificeAnnual) || 0) + (inc.autoSacrifice || 0);
  var taxable = Math.max(0, inc.baseGross - sacrifice + ipNetResultAnnual() * (ownershipPct / 100));
  return Math.max(0, taxable + sacrifice);
}
// Combined surcharge income across everyone with a Gross row.
//
// This is what family thresholds are actually tested against: the ATO sets the *tier* from the
// couple's combined income, then each spouse pays the surcharge on their own income at that tier.
// Testing each person's income against the doubled threshold separately — the obvious reading, and
// what this shipped with for about ten minutes — understates it badly: two people on $150k each are
// a $300k household, comfortably in Tier 3, but neither one reaches the $194k family Tier 1 alone.
export function householdSurchargeIncome(opts){
  return getTaxPeople().reduce(function(sum, person){
    return sum + personSurchargeIncome(person, opts);
  }, 0);
}

// ---------------- HELP / HECS ----------------
//
// A compulsory repayment is a real deduction from take-home, withheld from every pay like tax is.
// Until this existed the app had no concept of it at all, so every net figure on every page —
// take-home, savings rate, the projection, the FIRE bridge — was too high for anyone carrying a
// debt. That's the reason this went first of the tax items: it corrects numbers already on screen
// rather than adding a new one.
//
// The rate is a flat percentage of the WHOLE repayment income, not marginal (see
// HELP_REPAYMENT_RATES). One dollar over a threshold costs the difference on every dollar you
// earn, which is worth surfacing rather than burying.
export function helpRepaymentRate(repaymentIncome){
  var income = Math.max(0, Number(repaymentIncome) || 0);
  var rate = 0;
  for(var i = 0; i < HELP_REPAYMENT_RATES.length; i++){
    if(income >= HELP_REPAYMENT_RATES[i].from) rate = HELP_REPAYMENT_RATES[i].rate;
    else break;
  }
  return rate;
}
// The next threshold up and what crossing it costs — null once you're in the top band. The cost is
// the jump in the whole-income repayment, not the rate difference, because that's the number that
// actually leaves your account.
export function helpNextThreshold(repaymentIncome){
  var income = Math.max(0, Number(repaymentIncome) || 0);
  for(var i = 0; i < HELP_REPAYMENT_RATES.length; i++){
    var band = HELP_REPAYMENT_RATES[i];
    if(band.from > income){
      return {
        at: band.from,
        rate: band.rate,
        away: band.from - income,
        stepCost: Math.round((band.from * band.rate - income * helpRepaymentRate(income)) * 100) / 100
      };
    }
  }
  return null;
}
// What's actually repaid this year: the rate applied to repayment income, but never more than the
// balance outstanding. The cap matters — a final year's repayment is whatever is left, not a full
// year's percentage, and without it the app would keep "repaying" a debt that's already gone.
export function helpRepaymentAnnual(repaymentIncome, balance){
  var owed = Math.max(0, Number(balance) || 0);
  if(!owed) return 0;
  var raw = Math.max(0, Number(repaymentIncome) || 0) * helpRepaymentRate(repaymentIncome);
  return Math.round(Math.min(raw, owed) * 100) / 100;
}

// Income rows that represent spendable money: every non-Gross row, which means the Net rows the
// user typed plus the synthetic "<person> — net" rows recalcComputedItems() derives from the Gross
// ones. Gross rows are excluded so their pre-tax amount isn't counted alongside the net figure
// already derived from it.
//
// **This is the baseline view only.** The synthetic rows are computed once, from each Gross row's
// plain `amount`, so they can't see a per-scenario override. Anything that needs a particular
// scenario's income must call scenarioIncomeMonthly() instead, which re-runs the tax chain against
// that scenario's amounts. See its comment for why the synthetic rows aren't simply duplicated
// per scenario.
export function effectiveIncomeItems(){
  return state.income.filter(function(i){ return i.incomeType !== "Gross"; });
}

// ---------------- Per-scenario income ----------------
//
// An income row can carry the same sparse `scenarioOverrides` map that state.shared[] rows have
// (see resolveSharedAmount) — "one partner drops to three days in the Buy scenario", "the pay rise
// doesn't arrive", "six months off". Until this existed every scenario shared one income figure,
// so the Scenarios page could only ever compare housing costs.
//
// Income is harder than an expense, because a Gross row's amount is an *input to the tax engine*,
// not a number you can vary at the end: change it and the marginal rate, the Medicare levy, the
// SG, the concessional cap and Division 293 all move with it. So the override is applied at the
// bottom of the chain — every read of a Gross row's amount goes through resolveSharedAmount — and
// the whole computation is re-run per scenario.
//
// The alternative, storing a synthetic net row per person *per scenario* in state.income, was
// rejected: it would put N×M computed rows in the list on the Income page, and the synthetic rows
// are a display artifact rather than the source of truth for any total.
//
// `opts.includeRow` lets a caller drop rows for reasons of its own — the projection uses it to
// honour `endDate` year by year, and it has to reach inside the tax chain rather than filter
// afterwards, or a salary that ends in three years would keep paying tax forever.
// `opts` ({ scenario, includeRow }) is optional throughout the tax chain below. Omitted, every
// function behaves exactly as it did before per-scenario income existed — the row's plain
// `amount`, nothing filtered — which is what keeps the Income page, the FIRE module and the tax
// panels working unchanged.
function rowAmountFor(row, opts){
  return resolveSharedAmount(row, opts && opts.scenario);
}
function rowIncluded(row, opts){
  return !opts || !opts.includeRow || opts.includeRow(row);
}

// One scenario's spendable income as ledger-shaped rows — the single definition of "what does this
// scenario earn", used both for the monthly total and by the cash-flow forecast, which needs the
// rows themselves so it can place a quarterly bonus in the month it actually lands.
//
// Two kinds come back:
//   - the non-Gross rows the user typed, scenario-resolved like any other ledger row. Returned as
//     shallow copies when an override applies, never mutated in place — these are live state
//     objects and a caller summing them must not be able to edit the user's data.
//   - one synthetic Monthly row per person, carrying net take-home recomputed against *this*
//     scenario's gross amounts. state.income's own synthetic rows are skipped here precisely
//     because this recomputes what they hold; theirs is the baseline, this is per scenario.
export function scenarioIncomeRows(opts){
  var rows = [];
  state.income.forEach(function(row){
    if(row.incomeType === "Gross" || row.syntheticNetFor) return;
    if(!rowIncluded(row, opts)) return;
    var amount = rowAmountFor(row, opts);
    rows.push(amount === row.amount ? row : Object.assign({}, row, { amount: amount }));
  });
  getTaxPeople().forEach(function(person){
    var net = computePersonTax(person, opts).netTakeHome;
    // Every person with a Gross row gets a row even at $0 — a scenario where somebody stops
    // working is a real answer, and dropping the row would make it indistinguishable from a
    // person who was never there.
    rows.push({
      what: person + " — net income",
      amount: Math.round((net / 12) * 100) / 100,
      freq: "Monthly",
      computed: true,
      syntheticNetFor: person
    });
  });
  return rows;
}
export function scenarioIncomeMonthly(opts){
  return scenarioIncomeRows(opts).reduce(function(sum, row){
    return sum + periodsOf(row.amount, row.freq).monthly;
  }, 0);
}

export function getTaxPeople(){
  var seen = {};
  var order = [];
  state.income.forEach(function(i){
    if(i.incomeType === "Gross" && i.person){
      if(!seen[i.person]){ seen[i.person] = true; order.push(i.person); }
    }
  });
  return order;
}

// A "Gross" income row's Amount either already has super folded into it ("Included"), has
// super paid on top of it ("On top"), or isn't super-eligible at all ("N/A" — dividends,
// sole-trader income, government benefits). Uncapped: ignores the Maximum Super Contribution
// Base, which applies per-person across all their rows combined, not per row — see
// personSuperRows() for that.
export function rowSuperSplitUncapped(annual, superMode, sgRate){
  if(superMode === "N/A") return { sg: 0, cashPortion: annual, superApplies: false };
  if(superMode === "Included"){
    var rowSg = annual * sgRate / (1 + sgRate);
    return { sg: rowSg, cashPortion: annual - rowSg, superApplies: true };
  }
  return { sg: annual * sgRate, cashPortion: annual, superApplies: true };
}

// Employer SG isn't compulsory on ordinary-time earnings above the Maximum Super Contribution
// Base — this app doesn't model separate employers, so the cap is applied once per person
// across all their Gross rows combined (the common case: multiple rows from the same job,
// e.g. base salary + bonus). When the cap bites, every row's super shrinks proportionally to
// its uncapped share, and "Included" rows give the freed-up amount back as cash (the package
// total the user entered doesn't change, just how it splits).
export function personSuperRows(person, opts){
  var sgRate = (Number(state.tax.sgRate) || 11.5) / 100;
  var rows = state.income.filter(function(i){
    return i.incomeType === "Gross" && i.person === person && rowIncluded(i, opts);
  });
  var uncapped = rows.map(function(row){
    var annual = periodsOf(rowAmountFor(row, opts), row.freq).yearly;
    return { row: row, annual: annual, split: rowSuperSplitUncapped(annual, row.superMode || "On top", sgRate) };
  });
  var ordinaryEarnings = uncapped.reduce(function(s, r){ return s + (r.split.superApplies ? r.split.cashPortion : 0); }, 0);
  var uncappedTotalSg = uncapped.reduce(function(s, r){ return s + r.split.sg; }, 0);
  var overCap = ordinaryEarnings > MAX_SUPER_BASE;
  var scale = (overCap && uncappedTotalSg > 0) ? (MAX_SUPER_BASE * sgRate) / uncappedTotalSg : 1;
  var finalRows = uncapped.map(function(r){
    if(!r.split.superApplies || !overCap) return { row: r.row, annual: r.annual, sg: r.split.sg, cashPortion: r.split.cashPortion };
    var cappedSg = r.split.sg * scale;
    var cashPortion = r.row.superMode === "Included" ? (r.annual - cappedSg) : r.annual;
    return { row: r.row, annual: r.annual, sg: cappedSg, cashPortion: cashPortion };
  });
  return { rows: finalRows, overCap: overCap, ordinaryEarnings: ordinaryEarnings };
}

export function incomeRowSuperNote(item){
  if(item.incomeType !== "Gross" || item.computed) return "";
  var mode = item.superMode || "On top";
  if(mode === "N/A") return "No super applies to this income";
  var info = personSuperRows(item.person);
  var match = info.rows.find(function(r){ return r.row === item; });
  if(!match) return "";
  var freqKey = item.freq.toLowerCase();
  var cashInFreq = periodsOf(match.cashPortion, "Yearly")[freqKey];
  var sgInFreq = periodsOf(match.sg, "Yearly")[freqKey];
  var base = mode === "Included"
    ? (fmtCurrency0.format(cashInFreq) + " salary + " + fmtCurrency0.format(sgInFreq) + " super")
    : ("+ " + fmtCurrency0.format(sgInFreq) + " super on top");
  return info.overCap ? (base + " (MSCB cap applied)") : base;
}

export function personIncomeBreakdown(person, opts){
  var info = personSuperRows(person, opts);
  var baseGross = 0, sg = 0, packageTotal = 0, autoSacrifice = 0;
  info.rows.forEach(function(r){
    var row = r.row;
    packageTotal += r.annual;
    sg += r.sg;
    baseGross += r.cashPortion;
    var rowSacrifice = 0;
    if(row.sacrificeMode === "percent"){
      rowSacrifice = r.cashPortion * (Math.max(0, Math.min(100, Number(row.sacrificeValue) || 0)) / 100);
    } else if(row.sacrificeMode === "amount"){
      rowSacrifice = periodsOf(Number(row.sacrificeValue) || 0, row.freq).yearly;
    }
    autoSacrifice += Math.max(0, Math.min(rowSacrifice, r.cashPortion));
  });
  return { baseGross: baseGross, sg: sg, packageTotal: packageTotal, autoSacrifice: autoSacrifice, superOverCap: info.overCap };
}

export function personTaxSettings(person){
  if(!state.tax.settings[person]){
    state.tax.settings[person] = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0, helpBalance: 0 };
  }
  // Back-fill for a settings object saved before a field existed, rather than only seeding on
  // first creation — otherwise an existing person keeps `undefined` forever and every read has to
  // guard for it.
  var st = state.tax.settings[person];
  if(st.helpBalance == null) st.helpBalance = 0;
  return st;
}

export function computePersonTax(person, opts){
  var inc = personIncomeBreakdown(person, opts);
  var gross = inc.baseGross;
  var settings = personTaxSettings(person);
  var people = getTaxPeople();
  var ownershipPct = (state.tax.ipOwnership && state.tax.ipOwnership[person] != null)
    ? Number(state.tax.ipOwnership[person])
    : (people.length ? 100 / people.length : 0);
  var ipShare = ipNetResultAnnual() * (ownershipPct / 100);
  var manualSacrifice = Math.max(0, Number(settings.superSacrificeAnnual) || 0);
  var autoSacrifice = inc.autoSacrifice || 0;
  var sacrifice = manualSacrifice + autoSacrifice;
  // Work-related deductions from budget lines flagged on the Expenses page (see deductionRows).
  // The caller supplies the lines because assembling them walks state.shared, the active scenario's
  // housing and every investment property — that's components/expenses.js's budgetLineItems(), and
  // calc/ can't import a component.
  var deductibleItems = deductibleItemsFor(opts);
  var deductions = deductibleItems ? personDeductionsAnnual(person, deductibleItems) : 0;
  // Dividends enter taxable income GROSSED UP (cash + franking credit); the credit then comes off
  // the tax bill below. Adding only the cash would understate the income and overstate the benefit.
  var dividends = personDividends(person);
  // Capital gains within the household's year. Bounded to the year because a CGT event belongs to
  // the year it happened in — unlike every other figure here, which is a rate, a sale is a
  // one-off, and carrying last year's sale into this year's estimate would be plainly wrong.
  var cgtWindow = householdYearWindow();
  var capitalGains = personCapitalGains(person, { from: cgtWindow.start, to: cgtWindow.end });
  var taxable = Math.max(0, gross - sacrifice + ipShare - deductions + dividends.grossedUp + capitalGains.assessable);
  var incomeTax = incomeTaxAU(taxable);
  var medicare = medicareLevyAU(taxable);
  // HELP repayment income is deliberately NOT taxable income. It adds back the two things the tax
  // system lets you subtract but the repayment system doesn't: reportable super contributions
  // (salary sacrifice) and a net investment loss. Working it through for this app's own terms:
  //
  //   taxable          = gross - sacrifice + ipShare
  //   repaymentIncome  = taxable + sacrifice + max(0, -ipShare)
  //                    = gross + ipShare + max(0, -ipShare)
  //                    = gross + max(0, ipShare)
  //
  // i.e. salary sacrificing does not reduce what you repay, and neither does negative gearing —
  // which is exactly the trap people are surprised by, and the reason to show the figure rather
  // than let them infer it from taxable income.
  // Income for surcharge purposes: taxable income plus reportable super contributions, the same
  // simplification Division 293 already uses here (see div293Income below) — it ignores reportable
  // fringe benefits and net investment losses, which is stated in the UI rather than hidden.
  var hasCover = !!state.tax.privateHospitalCover;
  var isFamily = !!state.tax.familyThresholds;
  var helpBalance = Math.max(0, Number(settings.helpBalance) || 0);
  var repaymentIncome = Math.max(0, gross + Math.max(0, ipShare));
  var helpRepayment = helpRepaymentAnnual(repaymentIncome, helpBalance);
  // The surcharge IS a tax, unlike the HELP repayment below — so it belongs in totalTax and in the
  // effective rate. Computed after sacrifice because surcharge income adds the sacrifice back.
  var surchargeIncome = Math.max(0, taxable + sacrifice);
  // The tier comes from the household's combined income when family thresholds apply; the rate is
  // then charged on this person's own income. See householdSurchargeIncome() for why.
  var tierIncome = isFamily ? householdSurchargeIncome(opts) : surchargeIncome;
  var medicareSurcharge = hasCover ? 0
    : Math.round(surchargeIncome * mlsTierFor(tierIncome, isFamily).rate * 100) / 100;
  // The franking credit is a REFUNDABLE offset in Australia — it can take the bill below zero and
  // be paid out, which is why this isn't clamped at 0. That's the case that matters most (a
  // low-income or retired shareholder), and clamping would quietly delete it.
  var totalTax = incomeTax + medicare + medicareSurcharge - dividends.credit;
  // Part of take-home, not of "tax": it's a repayment of a debt, not a tax, and totalTax feeds the
  // effective-rate figure where lumping it in would overstate what the ATO keeps. But it does come
  // out of the same pay, so every downstream net figure has to see it.
  // The dividend CASH is real money arriving; the credit is settled through the tax bill above, so
  // adding the grossed-up figure here would count it twice.
  var netTakeHome = gross - sacrifice - totalTax - helpRepayment + dividends.cash;
  // netTakeHome already folds in the property's tax effect evenly across the year — but a tax
  // refund from a negative-geared loss (or a bill from a positively-geared profit) doesn't
  // actually arrive that way unless the PAYG withholding was varied; by default it's a lump sum
  // after lodging a return. payslipTakeHome is what would actually land each pay cycle with
  // withholding unaffected by the property, so the gap between the two numbers is the answer to
  // "how much am I really saving/paying" — surfaced in personBreakdownHtml, not folded silently
  // into the one blended figure used everywhere else in the app.
  var taxableWithoutIp = Math.max(0, gross - sacrifice - deductions);
  var payslipTakeHome = gross - sacrifice - incomeTaxAU(taxableWithoutIp) - medicareLevyAU(taxableWithoutIp) -
    (hasCover ? 0 : Math.max(0, taxableWithoutIp + sacrifice) * mlsTierFor(tierIncome, isFamily).rate) -
    helpRepaymentAnnual(Math.max(0, gross), helpBalance);
  var ipTaxEffect = netTakeHome - payslipTakeHome;
  var sg = inc.sg;
  var totalConcessional = sg + sacrifice;
  var capAvailable = (Number(settings.concessionalCap) || 30000) + (Number(settings.carryForward) || 0);
  var capExceeded = Math.max(0, totalConcessional - capAvailable);
  var contributionsTax = Math.min(totalConcessional, capAvailable) * 0.15;
  var superNet = totalConcessional - contributionsTax;
  // Division 293: an extra 15% on low-tax (concessional, within-cap) super contributions once
  // "income for surcharge purposes" exceeds $250k. Simplified to taxable income + those
  // contributions, which covers the common case without modelling reportable fringe benefits
  // or net investment losses — consistent with the rest of this tax engine's stated scope.
  var lowTaxContributions = Math.min(totalConcessional, capAvailable);
  var div293Income = taxable + lowTaxContributions;
  var div293Threshold = 250000;
  var div293ExcessIncome = Math.max(0, div293Income - div293Threshold);
  var div293Tax = Math.min(lowTaxContributions, div293ExcessIncome) * 0.15;
  return {
    gross: gross, packageTotal: inc.packageTotal, ipShare: ipShare, ownershipPct: ownershipPct,
    sacrifice: sacrifice, manualSacrifice: manualSacrifice, autoSacrifice: autoSacrifice, taxable: taxable,
    deductions: deductions,
    capitalGains: capitalGains.assessable, capitalGainsRaw: capitalGains.raw,
    capitalGainsDiscount: capitalGains.discounted, capitalGainSales: capitalGains.sales,
    capitalGainsYear: cgtWindow.label,
    dividendCash: dividends.cash, frankingCredit: dividends.credit, dividendGrossedUp: dividends.grossedUp,
    // The number people actually want: what the dividend is worth after tax. Negative top-up above
    // a 30% marginal rate, positive refund below it.
    dividendNet: Math.round((dividends.cash + dividends.credit - (dividends.grossedUp * marginalRateAU(taxable))) * 100) / 100,
    // What the deductions are actually worth: tax saved at the marginal rate, not the deduction
    // itself. "I claimed $2,000" and "I got $2,000 back" is the single most common confusion about
    // deductions, and the panel exists to not repeat it.
    deductionsWorth: Math.round(deductions * marginalRateAU(taxable + deductions) * 100) / 100,
    incomeTax: incomeTax, medicare: medicare, totalTax: totalTax, netTakeHome: netTakeHome,
    payslipTakeHome: payslipTakeHome, ipTaxEffect: ipTaxEffect,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    medicareSurcharge: medicareSurcharge, surchargeIncome: surchargeIncome, tierIncome: tierIncome,
    hasPrivateCover: hasCover, familyThresholds: isFamily,
    mlsTier: mlsTierFor(tierIncome, isFamily),
    mlsNext: mlsNextTier(tierIncome, isFamily),
    // What holding cover is worth, in the only unit that makes the decision: the surcharge you'd
    // pay without it. Always computed, even when cover IS held, so the panel can say what it's
    // saving you rather than only what it would cost.
    mlsIfUncovered: Math.round(surchargeIncome * mlsTierFor(tierIncome, isFamily).rate * 100) / 100,
    helpBalance: helpBalance, helpRepayment: helpRepayment, repaymentIncome: repaymentIncome,
    helpRate: helpBalance > 0 ? helpRepaymentRate(repaymentIncome) : 0,
    helpNext: helpBalance > 0 ? helpNextThreshold(repaymentIncome) : null,
    helpBalanceAfter: Math.max(0, helpBalance - helpRepayment),
    sg: sg, totalConcessional: totalConcessional, capAvailable: capAvailable, capExceeded: capExceeded,
    contributionsTax: contributionsTax, superNet: superNet, marginalRate: marginalRateAU(taxable),
    div293Income: div293Income, div293Tax: div293Tax, superOverCap: inc.superOverCap
  };
}
