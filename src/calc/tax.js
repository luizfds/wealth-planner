import { state } from "../state.js";
import { AU_TAX_BRACKETS, MAX_SUPER_BASE } from "../constants.js";
import { periodsOf } from "./ledger.js";
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

export function effectiveIncomeItems(){
  return state.income.filter(function(i){ return i.incomeType !== "Gross"; });
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
export function personSuperRows(person){
  var sgRate = (Number(state.tax.sgRate) || 11.5) / 100;
  var rows = state.income.filter(function(i){ return i.incomeType === "Gross" && i.person === person; });
  var uncapped = rows.map(function(row){
    var annual = periodsOf(row.amount, row.freq).yearly;
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

export function personIncomeBreakdown(person){
  var info = personSuperRows(person);
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
    state.tax.settings[person] = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0 };
  }
  return state.tax.settings[person];
}

export function computePersonTax(person){
  var inc = personIncomeBreakdown(person);
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
  var totalTax = incomeTax + medicare;
  var netTakeHome = gross - sacrifice - totalTax;
  // netTakeHome already folds in the property's tax effect evenly across the year — but a tax
  // refund from a negative-geared loss (or a bill from a positively-geared profit) doesn't
  // actually arrive that way unless the PAYG withholding was varied; by default it's a lump sum
  // after lodging a return. payslipTakeHome is what would actually land each pay cycle with
  // withholding unaffected by the property, so the gap between the two numbers is the answer to
  // "how much am I really saving/paying" — surfaced in personBreakdownHtml, not folded silently
  // into the one blended figure used everywhere else in the app.
  var taxableWithoutIp = Math.max(0, gross - sacrifice);
  var payslipTakeHome = gross - sacrifice - incomeTaxAU(taxableWithoutIp) - medicareLevyAU(taxableWithoutIp);
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
    sg: sg, totalConcessional: totalConcessional, capAvailable: capAvailable, capExceeded: capExceeded,
    contributionsTax: contributionsTax, superNet: superNet, marginalRate: marginalRateAU(taxable),
    div293Income: div293Income, div293Tax: div293Tax, superOverCap: inc.superOverCap
  };
}
