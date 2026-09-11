import { state } from "../state.js";
import { AU_TAX_BRACKETS, MAX_SUPER_BASE, HELP_REPAYMENT_RATES } from "../constants.js";
import { periodsOf, resolveSharedAmount } from "./ledger.js";
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
  var taxable = Math.max(0, gross - sacrifice + ipShare);
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
  var helpBalance = Math.max(0, Number(settings.helpBalance) || 0);
  var repaymentIncome = Math.max(0, gross + Math.max(0, ipShare));
  var helpRepayment = helpRepaymentAnnual(repaymentIncome, helpBalance);
  var totalTax = incomeTax + medicare;
  // Part of take-home, not of "tax": it's a repayment of a debt, not a tax, and totalTax feeds the
  // effective-rate figure where lumping it in would overstate what the ATO keeps. But it does come
  // out of the same pay, so every downstream net figure has to see it.
  var netTakeHome = gross - sacrifice - totalTax - helpRepayment;
  // netTakeHome already folds in the property's tax effect evenly across the year — but a tax
  // refund from a negative-geared loss (or a bill from a positively-geared profit) doesn't
  // actually arrive that way unless the PAYG withholding was varied; by default it's a lump sum
  // after lodging a return. payslipTakeHome is what would actually land each pay cycle with
  // withholding unaffected by the property, so the gap between the two numbers is the answer to
  // "how much am I really saving/paying" — surfaced in personBreakdownHtml, not folded silently
  // into the one blended figure used everywhere else in the app.
  var taxableWithoutIp = Math.max(0, gross - sacrifice);
  var payslipTakeHome = gross - sacrifice - incomeTaxAU(taxableWithoutIp) - medicareLevyAU(taxableWithoutIp) -
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
    incomeTax: incomeTax, medicare: medicare, totalTax: totalTax, netTakeHome: netTakeHome,
    payslipTakeHome: payslipTakeHome, ipTaxEffect: ipTaxEffect,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    helpBalance: helpBalance, helpRepayment: helpRepayment, repaymentIncome: repaymentIncome,
    helpRate: helpBalance > 0 ? helpRepaymentRate(repaymentIncome) : 0,
    helpNext: helpBalance > 0 ? helpNextThreshold(repaymentIncome) : null,
    helpBalanceAfter: Math.max(0, helpBalance - helpRepayment),
    sg: sg, totalConcessional: totalConcessional, capAvailable: capAvailable, capExceeded: capExceeded,
    contributionsTax: contributionsTax, superNet: superNet, marginalRate: marginalRateAU(taxable),
    div293Income: div293Income, div293Tax: div293Tax, superOverCap: inc.superOverCap
  };
}
