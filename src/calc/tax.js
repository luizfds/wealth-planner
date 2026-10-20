import { state } from "../state.js";
import { AU_TAX_BRACKETS, MAX_SUPER_BASE, HELP_REPAYMENT_RATES, MLS_TIERS, MLS_FAMILY_MULTIPLIER, WFH_FIXED_RATES, TAX_YEARS, MLS_RATES } from "../constants.js";
import { periodsOf, resolveSharedAmount, householdYearWindow, isActiveOn, overlapDaysInclusive } from "./ledger.js";
import { ipNetResultAnnual, personIpResultAnnual, ipProperties, propertyOwnershipPct } from "./property.js";
import { incomeStatementTotals, interestIncome, recordedDeductionsByLabel, rentalSchedule, yearDeductions } from "./taxyear.js";
import { deductionYearFraction, rowDeductionAnnual, setClaimItemsProvider, claimItems } from "./claims.js";
export { deductionYearFraction, rowDeductionAnnual };
import { fmtCurrency0, localDateStr } from "../lib/format.js";

// ---------------- Which year's tables ----------------
//
// Every rate below is read from TAX_YEARS for a financial year. The default is the household's
// current year (householdYearWindow), so the tax card and every net figure use this year's rates;
// computePersonTax takes opts.fy to work out another year — the tax-year worksheet does that for
// the year being lodged. A year past the newest table borrows it and says so (`assumed`).
export function fyOfDate(iso){
  var y = Number(String(iso).slice(0, 4)), m = Number(String(iso).slice(5, 7));
  return m >= 7 ? y : y - 1;
}
export function currentTaxFy(){
  return fyOfDate(householdYearWindow().start);
}
// The financial year today is in, whatever period is picked in the header — for the things that
// are about now: Before 30 June, Checks' "last finished year", which years can be closed.
export function todayTaxFy(today){
  return fyOfDate(today || localDateStr());
}
export function taxTablesFor(fy){
  if(fy == null) fy = currentTaxFy();
  if(TAX_YEARS[fy]) return Object.assign({ fy: fy, assumed: false }, TAX_YEARS[fy]);
  var years = Object.keys(TAX_YEARS).map(Number).sort(function(a, b){ return a - b; });
  var use = fy < years[0] ? years[0] : years[years.length - 1];
  return Object.assign({}, TAX_YEARS[use], { fy: fy, assumed: true, borrowedFrom: use });
}

export function incomeTaxAU(taxable, fy){
  taxable = Math.max(0, Number(taxable) || 0);
  var brackets = taxTablesFor(fy).brackets;
  for(var i = 0; i < brackets.length; i++){
    var b = brackets[i];
    if(taxable <= b.to) return b.base + (taxable - b.from) * b.rate;
  }
  return 0;
}
export function marginalRateAU(taxable, fy){
  taxable = Math.max(0, Number(taxable) || 0);
  var brackets = taxTablesFor(fy).brackets;
  for(var i = 0; i < brackets.length; i++){
    if(taxable <= brackets[i].to) return brackets[i].rate;
  }
  return brackets[brackets.length - 1].rate;
}
// Medicare levy with the singles low-income shade-in: nil to the lower threshold, 10c per dollar
// above it until that equals 2%, then 2% of the whole income.
export function medicareLevyAU(taxable, fy){
  taxable = Math.max(0, Number(taxable) || 0);
  var m = taxTablesFor(fy).medicare;
  if(taxable <= m.lower) return 0;
  if(taxable <= m.upper) return (taxable - m.lower) * 0.10;
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
// ---------------- Purchase lots (parcels) ----------------
//
// A holding bought in several goes is several assets for CGT: each purchase (a "parcel") has its
// own cost and its own acquisition date, and whether a sale gets the 12-month discount is decided
// parcel by parcel. An average cost and one acquisition date can't say that — selling 3,000 units
// bought across six trades over four months needs to know which trades, because at a sale a year
// later the newest parcels can still be under 12 months old while the oldest aren't.
//
// asset.lots[] = {id, date, units, price, brokerage, soldUnits}. soldUnits is how many of this
// parcel past sales have used up, so the next sale knows where to start. Sales match parcels
// first-in, first-out — the order the ATO accepts by default when you can't identify the specific
// shares sold, and the one that usually maximises the discount.
function round2(n){ return Math.round(n * 100) / 100; }
export function lotCost(lot){
  return (Number(lot.units) || 0) * (Number(lot.price) || 0) + (Number(lot.brokerage) || 0);
}
export function lotRemainingUnits(lot){
  return Math.max(0, Math.round(((Number(lot.units) || 0) - (Number(lot.soldUnits) || 0)) * 1e8) / 1e8);
}
function lotsOldestFirst(asset){
  return (Array.isArray(asset && asset.lots) ? asset.lots : []).slice().sort(function(a, b){
    return (a.date || "").localeCompare(b.date || "");
  });
}
export function lotsUnitsAvailable(asset){
  return lotsOldestFirst(asset).reduce(function(s, l){ return s + lotRemainingUnits(l); }, 0);
}
// The parcels a FIFO sale of `units` would use, without changing anything. Each parcel's cost is
// its share of the lot's cost INCLUDING brokerage — brokerage on the purchase is part of the cost
// base. Returns {parcels} or {error} when the lots don't hold that many units.
export function fifoParcels(asset, units){
  var need = Math.max(0, Number(units) || 0);
  var parcels = [];
  lotsOldestFirst(asset).forEach(function(lot){
    if(need <= 1e-9) return;
    var rem = lotRemainingUnits(lot);
    if(rem <= 0) return;
    var take = Math.min(rem, need);
    parcels.push({ lotId: lot.id, acquired: lot.date || "", units: take,
      costBase: round2(lotCost(lot) * take / (Number(lot.units) || 1)) });
    need = Math.round((need - take) * 1e8) / 1e8;
  });
  if(need > 1e-9) return { error: "Your purchase lots only hold " + lotsUnitsAvailable(asset) + " unsold units.", parcels: parcels };
  return { parcels: parcels };
}
// The remaining lots' cost per unit — what "Avg cost" means once lots are kept, so the holding's
// gain/loss figure and the sale form's default stay consistent with the parcels.
export function lotsAverageCost(asset){
  var units = 0, cost = 0;
  (Array.isArray(asset && asset.lots) ? asset.lots : []).forEach(function(l){
    var rem = lotRemainingUnits(l);
    if(!(rem > 0) || !(Number(l.units) > 0)) return;
    units += rem;
    cost += lotCost(l) * rem / Number(l.units);
  });
  return units > 0 ? Math.round(cost / units * 10000) / 10000 : null;
}

// One sale's capital gain picture. A capital LOSS never gets the discount — the discount only ever
// applies to a gain, and halving a loss would understate a real offset.
//
// A sale with parcels is several CGT events in one: proceeds are shared across the parcels by
// units, and each parcel's gain is discounted (or not) on its own acquisition date. Besides the
// headline figures, every sale reports its gains split into discountable / not discountable and
// its losses, which is what netting across a whole year needs (personCapitalGains).
export function saleCapitalGain(sale){
  var proceeds = Number(sale.proceeds) || 0;
  var parts;
  if(Array.isArray(sale.parcels) && sale.parcels.length){
    var totalUnits = sale.parcels.reduce(function(s, p){ return s + (Number(p.units) || 0); }, 0) || 1;
    var allocated = 0;
    parts = sale.parcels.map(function(p, i){
      // The last parcel takes whatever's left, so the parts add back to the proceeds to the cent.
      var share = i === sale.parcels.length - 1 ? round2(proceeds - allocated) : round2(proceeds * (Number(p.units) || 0) / totalUnits);
      allocated = round2(allocated + share);
      return { acquired: p.acquired || "", units: Number(p.units) || 0, proceeds: share, costBase: Number(p.costBase) || 0 };
    });
  } else {
    parts = [{ acquired: sale.acquired || "", units: Number(sale.units) || 0, proceeds: proceeds, costBase: Number(sale.costBase) || 0 }];
  }
  var out = { raw: 0, assessable: 0, discountableGain: 0, otherGain: 0, loss: 0, parts: [], heldDays: null, discountApplied: false };
  parts.forEach(function(p){
    var raw = round2(p.proceeds - p.costBase);
    var days = heldDays(p.acquired, sale.date);
    var disc = raw > 0 && qualifiesForCgtDiscount(p.acquired, sale.date);
    out.raw = round2(out.raw + raw);
    // What goes into taxable income for this sale on its own. Losses pass through whole; gains are
    // halved only when the parcel's holding period qualifies.
    out.assessable = round2(out.assessable + (disc ? raw * (1 - CGT_DISCOUNT) : raw));
    if(raw > 0 && disc) out.discountableGain = round2(out.discountableGain + raw);
    else if(raw > 0) out.otherGain = round2(out.otherGain + raw);
    else out.loss = round2(out.loss - raw);
    if(disc) out.discountApplied = true;
    out.heldDays = out.heldDays == null ? days : Math.min(out.heldDays, days);
    out.parts.push({ acquired: p.acquired, units: p.units, proceeds: p.proceeds, costBase: p.costBase, raw: raw, heldDays: days, discountApplied: disc });
  });
  out.isLoss = out.raw < 0;
  if(out.heldDays == null) out.heldDays = 0;
  return out;
}
// The year's capital gains for one person, netted the way a return nets them (ATO method
// statement, CGT schedule): every capital loss for the year — then losses carried forward from
// earlier years — comes off gains that DON'T get the discount first, then off gains that do, and
// only what's left of the discountable gains is halved. Doing it the other way round (discount each
// sale, then subtract losses) wastes half of every loss set against a discounted gain.
//
// Gains come from recorded sales (split into discountable / not by each parcel's holding period)
// and from fund tax statements (18H, of which "other method" isn't discountable). If losses are
// bigger than gains, what's left is a net capital loss to carry forward — never deducted from
// other income, and never discounted.
//
// opts: {from, to} bounds the sales, {funds} is the person's personFundStatements() for the same
// window (passed in so computePersonTax doesn't work it out twice), {priorLosses} overrides the
// carried-forward figure in the person's tax settings.
export function personCapitalGains(person, opts){
  opts = opts || {};
  var people = getTaxPeople();
  var sales = [];
  var discountable = 0, other = 0, losses = 0;
  state.assets.forEach(function(a){
    if(!Array.isArray(a.sales) || !a.sales.length) return;
    if(a.person ? a.person !== person : people.length > 1) return;
    a.sales.forEach(function(sale){
      if(opts.from && sale.date < opts.from) return;
      if(opts.to && sale.date > opts.to) return;
      var g = saleCapitalGain(sale);
      discountable += g.discountableGain;
      other += g.otherGain;
      losses += g.loss;
      sales.push({ what: a.what, date: sale.date, gain: g });
    });
  });
  var f = opts.funds;
  if(f){
    discountable += f.capitalGainDiscountable;
    other += f.capitalGainOther;
  }
  var settings = state.tax && state.tax.settings && state.tax.settings[person];
  var prior = opts.priorLosses != null ? Math.max(0, Number(opts.priorLosses) || 0)
    : Math.max(0, Number(settings && settings.capitalLossCarriedForward) || 0);
  var totalGains = round2(discountable + other);
  var available = losses + prior;
  var offOther = Math.min(available, other);
  available -= offOther;
  var offDiscountable = Math.min(available, discountable);
  available -= offDiscountable;
  var discountableLeft = discountable - offDiscountable;
  var discount = discountableLeft * CGT_DISCOUNT;
  var net = round2((other - offOther) + discountableLeft - discount);
  // Losses used: current-year losses first, then the prior ones, so what's carried forward out is
  // whatever remains of either.
  var used = offOther + offDiscountable;
  return {
    assessable: net,
    // 18H on a return: the year's gains before losses and the discount.
    totalGains: totalGains,
    raw: round2(totalGains - losses),
    discounted: round2(discount),
    currentLosses: round2(losses),
    priorLossesApplied: round2(Math.max(0, used - losses)),
    lossCarriedForward: round2(available),
    discountableGain: round2(discountable),
    otherGain: round2(other),
    sales: sales
  };
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
// ---------------- Annual tax statements (ETFs, managed funds) ----------------
//
// An ETF isn't a company paying a dividend. It's a trust passing through whatever it earned, and its
// annual tax statement (an AMMA statement, under the attribution regime) splits that into the labels
// myTax asks for: 13U non-primary production income, 13C franked distributions, 13Q franking
// credits, 18H/18A capital gains the fund made, 20E/20M foreign income, 20O foreign tax already
// paid — plus an AMIT cost base adjustment, which isn't income at all but changes the cost base of
// the units. An S&P 500 ETF is almost all foreign income and fund capital gains; modelling it as
// "dividend per unit, 100% franked" gets every one of those labels wrong.
//
// asset.taxStatements[] = {fy, u13, c13, q13, h18, discount18, other18, e20, m20, o20, cash,
// cbIncrease, cbDecrease, units}. fy is the year the financial year starts in. Copied straight
// from the statement; a year with a statement replaces that holding's dividend-per-unit estimate.
function overlapFraction(fy, win){
  if(!win) return 1;
  var s = fy + "-07-01", e = (fy + 1) + "-06-30";
  var shared = overlapDaysInclusive(s, e, win.start, win.end);
  var fyDays = overlapDaysInclusive(s, e, s, e);
  return fyDays > 0 ? shared / fyDays : 0;
}
function statementsTouching(asset, win){
  return (Array.isArray(asset && asset.taxStatements) ? asset.taxStatements : []).filter(function(st){
    return overlapFraction(Number(st.fy), win) > 0;
  });
}
function holdingBelongsTo(a, person, people){
  if(!a.person) return people.length <= 1;
  return a.person === person;
}
// Everything this person's fund statements put on a return for the window.
export function personFundStatements(person, win){
  var people = getTaxPeople();
  var out = { nonPrimary: 0, franked: 0, credit: 0, foreign: 0, fito: 0, cash: 0,
    capitalGainGross: 0, capitalGainDiscountable: 0, capitalGainOther: 0, capitalGainNet: 0, funds: [] };
  state.assets.forEach(function(a){
    if(a.category !== "Shares" || !holdingBelongsTo(a, person, people)) return;
    statementsTouching(a, win).forEach(function(st){
      var f = overlapFraction(Number(st.fy), win);
      var n = function(k){ return (Number(st[k]) || 0) * f; };
      out.nonPrimary += n("u13");
      out.franked += n("c13");
      out.credit += n("q13");
      out.foreign += n("m20");
      out.fito += n("o20");
      out.cash += n("cash");
      out.capitalGainGross += n("h18");
      // 18H is gross: a discounted gain appears in it grossed back up, so the discountable part is
      // 18H less the "other method" gains, and it's halved again (or netted against losses) at the
      // household level — exactly what myTax does with the two labels.
      out.capitalGainOther += n("other18");
      out.capitalGainDiscountable += Math.max(0, n("h18") - n("other18"));
      out.capitalGainNet += n("discount18") + n("other18");
      if(out.funds.indexOf(a.what) === -1) out.funds.push(a.what);
    });
  });
  Object.keys(out).forEach(function(k){ if(typeof out[k] === "number") out[k] = Math.round(out[k] * 100) / 100; });
  // What enters taxable income from the statement's income labels (capital gains go through CGT).
  out.income = Math.round((out.nonPrimary + out.franked + out.credit + out.foreign) * 100) / 100;
  return out;
}
// The AMIT cost base adjustment per unit accrued before `dateStr`: shortfall (increase) less excess
// (decrease), each divided by the units held at that statement. A sale adds this to its cost base.
export function amitCostBaseAdjustmentPerUnit(asset, dateStr){
  return (Array.isArray(asset && asset.taxStatements) ? asset.taxStatements : []).reduce(function(sum, st){
    var fyEnd = (Number(st.fy) + 1) + "-06-30";
    var units = Number(st.units) || 0;
    if(!(units > 0) || fyEnd >= (dateStr || "")) return sum;
    return sum + ((Number(st.cbIncrease) || 0) - (Number(st.cbDecrease) || 0)) / units;
  }, 0);
}

// Every Shares holding attributed to this person. An unattributed holding follows the same rule as
// an unattributed deduction: it belongs to the only person, or to nobody when there are two.
// A holding with an annual tax statement for the year is left out — the statement is the real
// figure, and counting the estimate too would declare the same distribution twice.
// Distributions actually received (v3.38.0): asset.payouts = [{id, date, cash, credit}] — the cash
// that landed and the franking credit on the statement. In a named year they replace the
// per-unit estimate for that holding (a tax statement still wins: it has the labels); the rest of
// the time a holding with no per-unit figure uses its last twelve months of payouts as the rate.
export function payoutsBetween(asset, start, end){
  return (Array.isArray(asset && asset.payouts) ? asset.payouts : []).filter(function(p){
    return p && p.date && p.date >= start && p.date <= end;
  }).reduce(function(acc, p){
    acc.cash += Number(p.cash) || 0;
    acc.credit += Number(p.credit) || 0;
    acc.count++;
    return acc;
  }, { cash: 0, credit: 0, count: 0 });
}
function trailingYearPayouts(asset, todayIso){
  var t = String(todayIso);
  var start = (Number(t.slice(0, 4)) - 1) + t.slice(4);
  return payoutsBetween(asset, start, t);
}
export function personDividends(person, win, opts){
  opts = opts || {};
  var people = getTaxPeople();
  var today = opts.today || localDateStr();
  return state.assets.filter(function(a){
    if(a.category !== "Shares") return false;
    if(win && statementsTouching(a, win).length) return false;
    if(!(Number(a.dividendPerUnit) || 0) && !(Array.isArray(a.payouts) && a.payouts.length)) return false;
    if(!a.person) return people.length <= 1;
    return a.person === person;
  }).reduce(function(acc, a){
    var d;
    var actual = opts.yearMode && win ? payoutsBetween(a, win.start, win.end) : null;
    if(actual && actual.count){
      d = { cash: actual.cash, credit: actual.credit };
      acc.actualCount += actual.count;
    } else if(Number(a.dividendPerUnit) || 0){
      d = holdingDividend(a);
    } else {
      var tr = trailingYearPayouts(a, today);
      d = { cash: tr.cash, credit: tr.credit };
    }
    acc.cash += d.cash;
    acc.credit += d.credit;
    acc.grossedUp += Math.round((d.cash + d.credit) * 100) / 100;
    return acc;
  }, { cash: 0, credit: 0, grossedUp: 0, actualCount: 0 });
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
export function setDeductibleItemsProvider(fn){ deductibleItemsProvider = fn; setClaimItemsProvider(fn); }
function deductibleItemsFor(opts){
  if(opts && opts.deductibleItems) return opts.deductibleItems;
  return deductibleItemsProvider ? deductibleItemsProvider() : null;
}

export function deductionRows(items, person){
  return (items || []).filter(function(i){
    if(!i.deductible) return false;
    // Claimed against an investment property (v3.45.0): it goes on that property's rental
    // schedule and reaches each owner through their share, not as a personal deduction.
    if(i.claimProperty) return false;
    // A row with no person attributed belongs to whoever is being computed only when there's
    // exactly one person — otherwise it's ambiguous and silently loading it onto the first person
    // would be worse than asking.
    if(!i.deductiblePerson) return getTaxPeople().length <= 1;
    return i.deductiblePerson === person;
  });
}
// deductionYearFraction() and rowDeductionAnnual() moved to calc/claims.js (v3.45.0) so the
// property side can use them too; re-exported here for existing callers.
// The year's claims grouped by return label: {D2: 1450, D5: 1203.71, ...}. A row with no label is
// D5, the label most employee claims belong on.
export function deductionsByLabel(person, items, win){
  var out = {};
  deductionRows(items, person).forEach(function(item){
    var code = item.deductionLabel || "D5";
    out[code] = (out[code] || 0) + rowDeductionAnnual(item, win);
  });
  Object.keys(out).forEach(function(k){ out[k] = Math.round(out[k] * 100) / 100; });
  return out;
}

// ---------------- Working from home: the fixed-rate method ----------------
//
// The method nearly every employee uses: hours actually worked from home x a rate per hour that
// covers energy, internet, phone and stationery. The hours are a record kept during the year (a
// timesheet or diary — an estimate isn't accepted), so they're entered per financial year rather
// than as a rate that rolls forward. The amount lands on D5.
//
// The rate covers those running costs, so a budget line for any of them that's ALSO flagged as a
// deduction is a double claim; wfhOverlapRows() finds the likely ones by name so the card can say so.
export function wfhRateForFy(fy){
  if(WFH_FIXED_RATES[fy] != null) return { rate: WFH_FIXED_RATES[fy], assumed: false };
  var years = Object.keys(WFH_FIXED_RATES).map(Number).sort(function(a, b){ return a - b; });
  var latest = years[years.length - 1];
  return { rate: WFH_FIXED_RATES[fy < years[0] ? years[0] : latest], assumed: true };
}
export function wfhDeduction(person, win){
  var settings = state.tax && state.tax.settings && state.tax.settings[person];
  var hoursMap = (settings && settings.wfhHours) || {};
  var total = 0, hours = 0, assumed = false;
  var fy0 = Number(String(win.start).slice(5, 7)) >= 7 ? Number(win.start.slice(0, 4)) : Number(win.start.slice(0, 4)) - 1;
  var fy1 = Number(String(win.end).slice(5, 7)) >= 7 ? Number(win.end.slice(0, 4)) : Number(win.end.slice(0, 4)) - 1;
  for(var fy = fy0; fy <= fy1; fy++){
    var h = Math.max(0, Number(hoursMap[fy]) || 0);
    if(!h) continue;
    var r = wfhRateForFy(fy);
    var f = overlapFraction(fy, win);
    hours += h * f;
    total += h * r.rate * f;
    assumed = assumed || r.assumed;
  }
  return { hours: Math.round(hours * 100) / 100, amount: Math.round(total * 100) / 100, assumed: assumed };
}
var WFH_COVERED = /\b(internet|nbn|broadband|phone|mobile|telco|electric|electricity|energy|power bill|gas|stationery|printer|ink)\b/i;
export function wfhOverlapRows(person, items){
  return deductionRows(items, person).filter(function(i){
    return WFH_COVERED.test(String(i.what || "")) || WFH_COVERED.test(String(i.category || ""));
  });
}
export function personDeductionsAnnual(person, items, win){
  return deductionRows(items, person).reduce(function(sum, item){
    return sum + rowDeductionAnnual(item, win);
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
export function mlsThresholds(family, fy){
  var single = taxTablesFor(fy).mls.single;
  var mult = family ? MLS_FAMILY_MULTIPLIER : 1;
  return [
    { from: 0, rate: MLS_RATES[0], label: "Base tier" },
    { from: single[0] * mult, rate: MLS_RATES[1], label: "Tier 1" },
    { from: single[1] * mult, rate: MLS_RATES[2], label: "Tier 2" },
    { from: single[2] * mult, rate: MLS_RATES[3], label: "Tier 3" }
  ];
}
// The tables list each tier's top as "$101,000 or less", so a tier starts a dollar above the one
// before: income exactly at a threshold is still the lower tier.
export function mlsTierFor(surchargeIncome, family, fy){
  var income = Math.max(0, Number(surchargeIncome) || 0);
  var tiers = mlsThresholds(family, fy);
  var current = tiers[0];
  for(var i = 1; i < tiers.length; i++){
    if(income > tiers[i].from) current = tiers[i];
    else break;
  }
  return current;
}
export function mlsTierIndex(income, family, fy){
  return ["Base tier", "Tier 1", "Tier 2", "Tier 3"].indexOf(mlsTierFor(income, family, fy).label);
}
// hasCover short-circuits the whole thing: holding hospital cover means no surcharge at any income.
export function medicareSurchargeAnnual(surchargeIncome, hasCover, family, fy){
  if(hasCover) return 0;
  var income = Math.max(0, Number(surchargeIncome) || 0);
  return Math.round(income * mlsTierFor(income, family, fy).rate * 100) / 100;
}
// What the next tier would cost — the number that makes "should I get cover" answerable, since
// crossing a tier is a step, not a slope.
export function mlsNextTier(surchargeIncome, family, fy){
  var income = Math.max(0, Number(surchargeIncome) || 0);
  var tiers = mlsThresholds(family, fy);
  for(var i = 1; i < tiers.length; i++){
    if(tiers[i].from >= income){
      var at = tiers[i].from + 1;
      return {
        at: at,
        rate: tiers[i].rate,
        away: at - income,
        stepCost: Math.round((at * tiers[i].rate - income * mlsTierFor(income, family, fy).rate) * 100) / 100
      };
    }
  }
  return null;
}

// ---------------- Private health insurance rebate ----------------
//
// The rebate on hospital and extras premiums is income-tested on the same tiers as the surcharge
// (family income for a family policy). Insurers apply it up front at whatever tier you told them;
// the return then works out the tier you were actually in and claws back — or pays — the
// difference. Tell the insurer one tier too low and the "refund" shrinks at tax time, which is
// exactly the kind of surprise this app exists to take out of July.
//
// Modelled at household level: annual premiums the rebate applies to, and the tier claimed with
// the insurer (-1 = no rebate taken up front). Under-65 rates only — the app has no ages.
// ageBand: "u65" (default), "a65" (65-69) or "a70" (70 and over) — the oldest person covered.
export function phiRebateRate(tierIndex, fy, ageBand){
  if(tierIndex < 0) return 0;
  var band = ageBand || "u65";
  return taxTablesFor(fy).phi.periods.reduce(function(sum, p){ return sum + p.share * p.rates[band][tierIndex] / 100; }, 0);
}
// The age band of the oldest person with a date of birth, as at 1 July of the year (v3.30.0). The
// rebate is set by the oldest person covered; the app takes everyone with a tax card to be on the
// policy, and with no dates of birth assumes under 65 — and says so.
export function ageOnDate(dob, onIso){
  if(!dob) return null;
  var b = String(dob).split("-").map(Number), o = String(onIso).split("-").map(Number);
  var age = o[0] - b[0];
  if(o[1] < b[1] || (o[1] === b[1] && o[2] < b[2])) age--;
  return age;
}
export function phiAgeBand(fy){
  var y = fy == null ? currentTaxFy() : fy;
  var oldest = null;
  getTaxPeople().forEach(function(person){
    var st = state.tax && state.tax.settings && state.tax.settings[person];
    var age = ageOnDate(st && st.dateOfBirth, y + "-07-01");
    if(age != null && (oldest == null || age > oldest)) oldest = age;
  });
  return { band: oldest == null ? "u65" : oldest >= 70 ? "a70" : oldest >= 65 ? "a65" : "u65", oldestAge: oldest, known: oldest != null };
}
// What the policy costs a year before the rebate (v3.47.0). Typed, or — when a budget line is
// marked as the policy — read from that line: a budget line is what you actually pay, which is
// after the rebate your insurer applies, so it's grossed back up at the tier you claim with them.
export function phiPremiumsAnnual(fy){
  var lineId = state.tax && state.tax.phiLineId;
  if(lineId){
    var line = claimItems().find(function(i){ return i.id === lineId; });
    if(line){
      var paid = periodsOf(Number(line.amount) || 0, line.freq).yearly;
      var claimed = state.tax.phiTierClaimed == null ? 0 : Number(state.tax.phiTierClaimed);
      var rate = phiRebateRate(claimed, fy, phiAgeBand(fy).band);
      return Math.round(paid / (1 - rate) * 100) / 100;
    }
  }
  return Math.max(0, Number(state.tax && state.tax.phiPremiums) || 0);
}
export function phiLine(){
  var lineId = state.tax && state.tax.phiLineId;
  return lineId ? (claimItems().find(function(i){ return i.id === lineId; }) || null) : null;
}
export function phiRebateAdjustment(opts){
  opts = opts || {};
  var premiums = phiPremiumsAnnual(opts.fy);
  if(!premiums) return null;
  var fy = opts.fy;
  var family = !!(state.tax && state.tax.familyThresholds);
  var income = householdSurchargeIncome(opts);
  var actualTier = mlsTierIndex(income, family, fy);
  var claimed = state.tax.phiTierClaimed == null ? 0 : Number(state.tax.phiTierClaimed);
  var age = phiAgeBand(fy);
  var entitled = Math.round(premiums * phiRebateRate(actualTier, fy, age.band) * 100) / 100;
  var received = Math.round(premiums * phiRebateRate(claimed, fy, age.band) * 100) / 100;
  return {
    premiums: premiums, actualTier: actualTier, claimedTier: claimed,
    entitled: entitled, received: received,
    // Positive = owed back at tax time (claimed too low a tier); negative = paid to you.
    adjustment: Math.round((received - entitled) * 100) / 100,
    income: income, family: family, ageBand: age.band, ageKnown: age.known
  };
}

// One person's income for surcharge purposes, computed WITHOUT calling computePersonTax — which
// would recurse, since computePersonTax needs the household total to pick a family tier.
//
// Deliberately a small duplicate of the taxable-income line in computePersonTax rather than a
// shared helper: pulling that apart would mean threading five intermediate values through two
// functions to save four lines, and this is the only other caller.
function personSurchargeIncome(person, opts){
  // A named year: that year's actual taxable income (from its record), computed without the
  // household-level pieces so it can't recurse back here.
  if(opts && opts.fy != null && !opts._inner){
    var r = computePersonTax(person, Object.assign({}, opts, { _inner: true }));
    return Math.max(0, r.surchargeIncome);
  }
  var inc = personIncomeBreakdown(person, opts);
  var settings = personTaxSettings(person);
  var people = getTaxPeople();
  var sacrifice = Math.max(0, Number(settings.superSacrificeAnnual) || 0) + (inc.autoSacrifice || 0);
  var taxable = Math.max(0, inc.baseGross - sacrifice + personIpResultAnnual(person, people));
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
// FY24/25 and earlier: one rate on the whole income. From FY25/26: marginal bands, plus 10% of the
// whole income at the top. helpRepaymentRaw() is the one place that knows both shapes.
function helpRepaymentRaw(income, fy){
  var h = taxTablesFor(fy).help;
  if(h.kind === "flat") return income * helpRepaymentRate(income, fy);
  if(income > h.wholeAbove) return income * h.wholeRate;
  var amt = 0;
  h.bands.forEach(function(b){ if(income > b.over) amt = b.base + (income - b.over) * b.rate; });
  return amt;
}
// The rate that applies to your NEXT dollar — under the flat system that's the whole-income rate,
// under the marginal one it's the band's rate (or the 10% top rate).
export function helpRepaymentRate(repaymentIncome, fy){
  var income = Math.max(0, Number(repaymentIncome) || 0);
  var h = taxTablesFor(fy).help;
  if(h.kind === "flat"){
    var rate = 0;
    for(var i = 0; i < h.rates.length; i++){
      if(income >= h.rates[i].from) rate = h.rates[i].rate;
      else break;
    }
    return rate;
  }
  if(income > h.wholeAbove) return h.wholeRate;
  var r = 0;
  h.bands.forEach(function(b){ if(income > b.over) r = b.rate; });
  return r;
}
// The next threshold up. Under the flat system crossing it is a step on every dollar (stepCost);
// under the marginal one it only changes the rate on dollars above it, except the top threshold,
// where 10% of the whole income takes over — still continuous, so stepCost is the change at that
// point, close to nil. `marginal` tells the note which sentence to use.
export function helpNextThreshold(repaymentIncome, fy){
  var income = Math.max(0, Number(repaymentIncome) || 0);
  var h = taxTablesFor(fy).help;
  if(h.kind === "flat"){
    for(var i = 0; i < h.rates.length; i++){
      var band = h.rates[i];
      if(band.from > income){
        return {
          at: band.from, rate: band.rate, away: band.from - income, marginal: false,
          stepCost: Math.round((band.from * band.rate - income * helpRepaymentRate(income, fy)) * 100) / 100
        };
      }
    }
    return null;
  }
  var points = h.bands.map(function(b){ return { at: b.over + 1, rate: b.rate }; }).concat([{ at: h.wholeAbove + 1, rate: h.wholeRate }]);
  for(var j = 0; j < points.length; j++){
    if(points[j].at > income){
      return { at: points[j].at, rate: points[j].rate, away: points[j].at - income, marginal: true,
        stepCost: Math.round((helpRepaymentRaw(points[j].at, fy) - helpRepaymentRaw(income, fy)) * 100) / 100 };
    }
  }
  return null;
}
// What's actually repaid this year, never more than the balance outstanding. The cap matters — a
// final year's repayment is whatever is left, not a full year's amount, and without it the app
// would keep "repaying" a debt that's already gone.
export function helpRepaymentAnnual(repaymentIncome, balance, fy){
  var owed = Math.max(0, Number(balance) || 0);
  if(!owed) return 0;
  var raw = helpRepaymentRaw(Math.max(0, Number(repaymentIncome) || 0), fy);
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
// Default: the row counts if it hasn't ended. A caller with its own idea of "when" — the
// projection, asking about a specific future year — passes includeRow and wins outright.
//
// Without the default, an income row with a past end date went on being taxed and counted forever,
// the same bug sumField had on the expense side.
function rowIncluded(row, opts){
  if(opts && opts.includeRow) return opts.includeRow(row);
  return isActiveOn(row, localDateStr());
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
    if(row.incomeType === "Gross" || row.syntheticNetFor || row.syntheticOneOffFor) return;
    if(!rowIncluded(row, opts)) return;
    var amount = rowAmountFor(row, opts);
    rows.push(amount === row.amount ? row : Object.assign({}, row, { amount: amount }));
  });
  getTaxPeople().forEach(function(person){
    var split = personOneOffSplit(person, opts);
    // Every person with a Gross row gets a row even at $0 — a scenario where somebody stops
    // working is a real answer, and dropping the row would make it indistinguishable from a
    // person who was never there.
    rows.push({
      what: person + " — net income",
      amount: Math.round((split.regularNet / 12 + takeHomeAdjust(person)) * 100) / 100,
      freq: "Monthly",
      computed: true,
      syntheticNetFor: person
    });
    // v3.80.0: each bonus after tax, once a year in its own month (see personOneOffSplit).
    split.oneOffs.forEach(function(o){
      rows.push({ what: (o.row.what || "Bonus") + " (after tax)", amount: o.net, freq: "Yearly", dueMonth: o.row.dueMonth || null,
        computed: true, oneOff: true, syntheticOneOffFor: o.row.id || "", person: person });
    });
  });
  return rows;
}
// ---------------- What actually lands (v3.87.0) ----------------
//
// Take-home is worked out from gross pay and the tax tables, and real pay can sit a steady amount
// off it: extra withholding (which comes back as a refund), salary sacrifice, a share plan or an
// after-tax deduction taken before the money lands. tax.settings[person].takeHomeAdjust is that
// difference per month, applied to the regular take-home only — cash flow and projections follow
// what arrives; the tax figures still come from gross.
export function takeHomeAdjust(person){
  var s = state.tax && state.tax.settings && state.tax.settings[person];
  var v = Number(s && s.takeHomeAdjust);
  return isFinite(v) ? v : 0;
}

// ---------------- One-off income (v3.80.0) ----------------
//
// A bonus paid once a year is a Gross row marked irregular. Its tax isn't separable by itself —
// it's taxed at the top of everything else — so its after-tax amount is the difference it makes:
// take-home with it, less take-home without it. What's left is regular pay, the figure a monthly
// payslip actually looks like. The parts add back up exactly to the full-year take-home, so yearly
// totals (net worth, projections, the tax card) don't move; only where in the year the money lands.
export function isOneOffIncome(row){ return !!(row && row.irregular && row.incomeType === "Gross"); }
export function personOneOffSplit(person, opts){
  var total = computePersonTax(person, opts).netTakeHome;
  var base = opts && opts.includeRow ? opts.includeRow : function(r){ return isActiveOn(r, localDateStr()); };
  var oneOffRows = state.income.filter(function(r){ return r.person === person && isOneOffIncome(r) && base(r) && periodsOf(rowAmountFor(r, opts), r.freq).yearly > 0; });
  var oneOffs = oneOffRows.map(function(r){
    var without = computePersonTax(person, Object.assign({}, opts || {}, { includeRow: function(x){ return x !== r && base(x); } })).netTakeHome;
    return { row: r, net: Math.round((total - without) * 100) / 100 };
  });
  var regular = total - oneOffs.reduce(function(t, o){ return t + o.net; }, 0);
  return { total: total, regularNet: regular, oneOffs: oneOffs };
}
// What's in a scenario's income that doesn't arrive monthly, as a yearly amount.
export function scenarioOneOffYearly(opts){
  return scenarioIncomeRows(opts).reduce(function(t, r){ return r.oneOff || r.irregular ? t + periodsOf(Number(r.amount) || 0, r.freq).yearly : t; }, 0);
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
    state.tax.settings[person] = { superSacrificeAnnual: 0, concessionalCap: 30000, carryForward: 0, helpBalance: 0, capitalLossCarriedForward: 0 };
  }
  // Back-fill for a settings object saved before a field existed, rather than only seeding on
  // first creation — otherwise an existing person keeps `undefined` forever and every read has to
  // guard for it.
  var st = state.tax.settings[person];
  if(st.helpBalance == null) st.helpBalance = 0;
  // Net capital losses from earlier years (v3.23.0), as shown on last year's notice of assessment.
  if(st.capitalLossCarriedForward == null) st.capitalLossCarriedForward = 0;
  // Hours worked from home, per financial year (v3.24.0): {2025: 1240}. Keyed by year because the
  // hours are a record of a year, not a rate that carries on.
  if(!st.wfhHours || typeof st.wfhHours !== "object") st.wfhHours = {};
  return st;
}

export function computePersonTax(person, opts){
  var inc = personIncomeBreakdown(person, opts);
  var gross = inc.baseGross;
  var settings = personTaxSettings(person);
  var people = getTaxPeople();
  // Per property now, not one global percentage times the whole portfolio — see
  // personIpResultAnnual(). ownershipPct survives only as a display figure: the blended share of
  // the portfolio's result this person ends up carrying, which is what the card's note reports.
  var ipShare = personIpResultAnnual(person, people);
  var ipTotal = ipNetResultAnnual();
  var ownershipPct = ipTotal !== 0 ? (ipShare / ipTotal) * 100 : (people.length ? 100 / people.length : 0);
  var manualSacrifice = Math.max(0, Number(settings.superSacrificeAnnual) || 0);
  var autoSacrifice = inc.autoSacrifice || 0;
  var sacrifice = manualSacrifice + autoSacrifice;
  // Work-related deductions from budget lines flagged on the Expenses page (see deductionRows).
  // The caller supplies the lines because assembling them walks state.shared, the active scenario's
  // housing and every investment property — that's components/expenses.js's budgetLineItems(), and
  // calc/ can't import a component.
  var deductibleItems = deductibleItemsFor(opts);
  // The same year the capital gains below are bounded to, so a claim that stopped partway through
  // it counts for the part it covered — see deductionYearFraction().
  // The year being computed: the household's current year unless opts.fy asks for another (the
  // tax-year worksheet). Rates, the deduction window, CGT events and fund statements all follow it.
  var fy = opts && opts.fy != null ? Number(opts.fy) : currentTaxFy();
  var taxYearWindow = opts && opts.fy != null
    ? { start: fy + "-07-01", end: (fy + 1) + "-06-30", label: "FY" + String(fy % 100).padStart(2, "0") + "/" + String((fy + 1) % 100).padStart(2, "0") }
    : householdYearWindow();
  var lineDeductions = deductibleItems ? personDeductionsAnnual(person, deductibleItems, taxYearWindow) : 0;
  var byLabel = deductibleItems ? deductionsByLabel(person, deductibleItems, taxYearWindow) : {};
  // A named year (the worksheet) uses that year's record wherever one exists — see calc/taxyear.js.
  // Each piece falls back to the model on its own, so a half-filled record is still a full answer.
  var yearMode = opts && opts.fy != null;
  var statements = yearMode ? incomeStatementTotals(fy, person) : null;
  if(statements){
    // An income statement's gross is already after salary sacrifice, so nothing comes off it again.
    gross = statements.gross;
    manualSacrifice = 0; autoSacrifice = 0; sacrifice = 0;
  }
  var interest = yearMode ? interestIncome(fy, person) : 0;
  if(yearMode){
    // The rent schedule for that year: actuals typed from the year's documents, the model for any
    // line left blank, and that year's borrowing costs and depreciation rather than this year's.
    ipShare = ipProperties().reduce(function(sum, p){
      return sum + rentalSchedule(p, fy).net * (propertyOwnershipPct(p, person, people) / 100);
    }, 0);
  }
  // v3.47.0: the year's flagged budget lines, each of which can be left out, plus typed claims.
  var yearDed = yearMode ? yearDeductions(fy, person, deductibleItems ? deductionRows(deductibleItems, person) : []) : null;
  if(yearDed){
    byLabel = Object.assign({}, yearDed.byLabel);
    lineDeductions = yearDed.total;
  }
  var wfh = wfhDeduction(person, taxYearWindow);
  if(wfh.amount > 0) byLabel.D5 = Math.round(((byLabel.D5 || 0) + wfh.amount) * 100) / 100;
  var deductions = lineDeductions + wfh.amount;
  var wfhOverlap = wfh.amount > 0 && deductibleItems ? wfhOverlapRows(person, deductibleItems) : [];
  // Dividends enter taxable income GROSSED UP (cash + franking credit); the credit then comes off
  // the tax bill below. Adding only the cash would understate the income and overstate the benefit.
  var dividends = personDividends(person, taxYearWindow, { yearMode: yearMode });
  // Fund tax statements for the same year: their income labels go straight into taxable income,
  // their franking credit is refundable like a dividend's, and 20O foreign tax paid comes off the
  // bill as a (non-refundable) foreign income tax offset.
  var funds = personFundStatements(person, taxYearWindow);
  // Capital gains within the household's year. Bounded to the year because a CGT event belongs to
  // the year it happened in — unlike every other figure here, which is a rate, a sale is a
  // one-off, and carrying last year's sale into this year's estimate would be plainly wrong.
  var cgtWindow = taxYearWindow;
  var capitalGains = personCapitalGains(person, { from: cgtWindow.start, to: cgtWindow.end, funds: funds });
  var taxable = Math.max(0, gross - sacrifice + ipShare - deductions + dividends.grossedUp + funds.income +
    capitalGains.assessable + interest);
  var incomeTax = incomeTaxAU(taxable, fy);
  var medicare = medicareLevyAU(taxable, fy);
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
  // A named year with income statements knows the real income-test additions: reportable fringe
  // benefits, reportable super contributions (RESC — salary sacrifice shows here) and any net
  // investment loss, each added back to taxable income. That is the ATO's definition for the HELP
  // repayment, the surcharge/rebate tiers and Division 293 alike (v3.29.0). The model keeps its
  // simpler forms below, which say so in the UI.
  var incomeTestAdditions = statements
    ? statements.rfba + statements.resc + Math.max(0, -ipShare)
    : null;
  var repaymentIncome = incomeTestAdditions != null
    ? Math.max(0, taxable + incomeTestAdditions)
    : Math.max(0, gross + Math.max(0, ipShare));
  var helpRepayment = helpRepaymentAnnual(repaymentIncome, helpBalance, fy);
  // The surcharge IS a tax, unlike the HELP repayment below — so it belongs in totalTax and in the
  // effective rate. Computed after sacrifice because surcharge income adds the sacrifice back.
  var surchargeIncome = incomeTestAdditions != null ? Math.max(0, taxable + incomeTestAdditions) : Math.max(0, taxable + sacrifice);
  // The tier comes from the household's combined income when family thresholds apply; the rate is
  // then charged on this person's own income. See householdSurchargeIncome() for why.
  var tierIncome = isFamily ? (opts && opts._inner ? surchargeIncome : householdSurchargeIncome(opts)) : surchargeIncome;
  var medicareSurcharge = hasCover ? 0
    : Math.round(surchargeIncome * mlsTierFor(tierIncome, isFamily, fy).rate * 100) / 100;
  // The franking credit is a REFUNDABLE offset in Australia — it can take the bill below zero and
  // be paid out, which is why this isn't clamped at 0. That's the case that matters most (a
  // low-income or retired shareholder), and clamping would quietly delete it.
  // Foreign income tax offset: credit for tax the fund already paid overseas. Non-refundable, so it
  // can bring the income tax and levy to zero but not below. Under $1,000 it's claimed in full with
  // no limit calculation — the case for any ordinary ETF holding.
  var fito = Math.min(funds.fito, Math.max(0, incomeTax + medicare));
  // Private health rebate adjustment: the household's figure, shared evenly between the people
  // filing (the ATO splits it by each person's share of the premiums, which the app doesn't keep).
  var phi = opts && opts._inner ? null : phiRebateAdjustment(yearMode ? { fy: fy } : { scenario: opts && opts.scenario });
  var phiShare = phi ? Math.round(phi.adjustment / Math.max(1, phi.family ? people.length : 1) * 100) / 100 : 0;
  var totalTax = incomeTax + medicare + medicareSurcharge - dividends.credit - funds.credit - fito + phiShare;
  // Part of take-home, not of "tax": it's a repayment of a debt, not a tax, and totalTax feeds the
  // effective-rate figure where lumping it in would overstate what the ATO keeps. But it does come
  // out of the same pay, so every downstream net figure has to see it.
  // The dividend CASH is real money arriving; the credit is settled through the tax bill above, so
  // adding the grossed-up figure here would count it twice.
  var netTakeHome = gross - sacrifice - totalTax - helpRepayment + dividends.cash + funds.cash;
  // netTakeHome already folds in the property's tax effect evenly across the year — but a tax
  // refund from a negative-geared loss (or a bill from a positively-geared profit) doesn't
  // actually arrive that way unless the PAYG withholding was varied; by default it's a lump sum
  // after lodging a return. payslipTakeHome is what would actually land each pay cycle with
  // withholding unaffected by the property, so the gap between the two numbers is the answer to
  // "how much am I really saving/paying" — surfaced in personBreakdownHtml, not folded silently
  // into the one blended figure used everywhere else in the app.
  var taxableWithoutIp = Math.max(0, gross - sacrifice - deductions);
  var payslipTakeHome = gross - sacrifice - incomeTaxAU(taxableWithoutIp, fy) - medicareLevyAU(taxableWithoutIp, fy) -
    (hasCover ? 0 : Math.max(0, taxableWithoutIp + sacrifice) * mlsTierFor(tierIncome, isFamily, fy).rate) -
    helpRepaymentAnnual(Math.max(0, gross), helpBalance, fy);
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
  var div293Income = taxable + lowTaxContributions + (statements ? statements.rfba + Math.max(0, -ipShare) : 0);
  var div293Threshold = 250000;
  var div293ExcessIncome = Math.max(0, div293Income - div293Threshold);
  var div293Tax = Math.min(lowTaxContributions, div293ExcessIncome) * 0.15;
  return {
    gross: gross, packageTotal: inc.packageTotal, ipShare: ipShare, ownershipPct: ownershipPct,
    sacrifice: sacrifice, manualSacrifice: manualSacrifice, autoSacrifice: autoSacrifice, taxable: taxable,
    deductions: deductions, deductionsByLabel: byLabel, wfh: wfh,
    wfhOverlap: wfhOverlap.map(function(i){ return i.what; }),
    capitalGains: capitalGains.assessable, capitalGainsRaw: capitalGains.raw,
    capitalGainsDiscount: capitalGains.discounted, capitalGainSales: capitalGains.sales,
    capitalGainsTotal: capitalGains.totalGains, capitalLossesApplied: capitalGains.currentLosses + capitalGains.priorLossesApplied,
    capitalLossCarriedForward: capitalGains.lossCarriedForward, priorCapitalLossesApplied: capitalGains.priorLossesApplied,
    capitalGainsYear: cgtWindow.label,
    dividendCash: dividends.cash, frankingCredit: dividends.credit, dividendGrossedUp: dividends.grossedUp,
    funds: funds, fundIncome: funds.income, fundFrankingCredit: funds.credit, fito: fito,
    fy: fy, taxTablesAssumed: taxTablesFor(fy).assumed, phi: phi, phiAdjustment: phiShare,
    interestIncome: interest, incomeStatements: statements, ipShareForYear: ipShare,
    // What comes back (positive) or is owed (negative) on assessment: tax withheld less the tax and
    // levies, credits and offsets already netted in totalTax, and any compulsory HELP repayment.
    // Only known once income statements give the withholding.
    refund: statements ? Math.round((statements.withheld - totalTax - helpRepayment) * 100) / 100 : null,
    fundCapitalGain: funds.capitalGainNet,
    // The number people actually want: what the dividend is worth after tax. Negative top-up above
    // a 30% marginal rate, positive refund below it.
    dividendNet: Math.round((dividends.cash + dividends.credit - (dividends.grossedUp * marginalRateAU(taxable, fy))) * 100) / 100,
    // What the deductions are actually worth: tax saved at the marginal rate, not the deduction
    // itself. "I claimed $2,000" and "I got $2,000 back" is the single most common confusion about
    // deductions, and the panel exists to not repeat it.
    deductionsWorth: Math.round(deductions * marginalRateAU(taxable + deductions, fy) * 100) / 100,
    incomeTax: incomeTax, medicare: medicare, totalTax: totalTax, netTakeHome: netTakeHome,
    payslipTakeHome: payslipTakeHome, ipTaxEffect: ipTaxEffect,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    medicareSurcharge: medicareSurcharge, surchargeIncome: surchargeIncome, tierIncome: tierIncome,
    hasPrivateCover: hasCover, familyThresholds: isFamily,
    mlsTier: mlsTierFor(tierIncome, isFamily, fy),
    mlsNext: mlsNextTier(tierIncome, isFamily, fy),
    // What holding cover is worth, in the only unit that makes the decision: the surcharge you'd
    // pay without it. Always computed, even when cover IS held, so the panel can say what it's
    // saving you rather than only what it would cost.
    mlsIfUncovered: Math.round(surchargeIncome * mlsTierFor(tierIncome, isFamily, fy).rate * 100) / 100,
    helpBalance: helpBalance, helpRepayment: helpRepayment, repaymentIncome: repaymentIncome,
    helpRate: helpBalance > 0 ? helpRepaymentRate(repaymentIncome, fy) : 0,
    helpNext: helpBalance > 0 ? helpNextThreshold(repaymentIncome, fy) : null,
    helpBalanceAfter: Math.max(0, helpBalance - helpRepayment),
    sg: sg, totalConcessional: totalConcessional, capAvailable: capAvailable, capExceeded: capExceeded,
    contributionsTax: contributionsTax, superNet: superNet, marginalRate: marginalRateAU(taxable, fy),
    div293Income: div293Income, div293Tax: div293Tax, superOverCap: inc.superOverCap
  };
}
