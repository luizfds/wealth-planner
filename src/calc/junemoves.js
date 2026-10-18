import { state } from "../state.js";
import { getTaxPeople, computePersonTax, personCapitalGains, personFundStatements, lotsAverageCost, deductionRows, rowDeductionAnnual, todayTaxFy } from "./tax.js";
import { superTopUp } from "./supertopup.js";
import { toAudAmount } from "./engine.js";
import { ipProperties, propertyOwnershipPct, loanInterestMonthly, loanPaidOut, fyWindow } from "./property.js";
import { claimItems } from "./claims.js";

// ---------------- Before 30 June: the moves that save tax (v3.51.0) ----------------
//
// Four things a household can still do before the financial year ends, each worked out from
// what the app already knows, per person, with what it's worth this year:
//
//   super    — concessional cap room, and what a deductible personal contribution saves (supertopup.js)
//   losses   — holdings sitting at a loss while the year already has capital gains: selling
//              realises the loss against them. Worked out by re-running the year's capital gains
//              with the loss added, so the discount and any carried-forward losses are respected.
//   prepay   — deductible costs billed less often than monthly: paying the next one before 30 June
//              brings its deduction into this year (the 12-month prepayment rule)
//   interest — prepaying up to 12 months of investment-loan interest: the same rule, for each owner's
//              share. A timing benefit unless next year's rate will be lower, and it says so.
//
// Nothing here is advice to act; every item says what it costs and what it's worth. `today` sets
// the year and the days left.
var MEDICARE = 0.02;
function round(n){ return Math.round(n); }

export function juneMoves(person, today, items){
  items = items || claimItems();
  var fy = todayTaxFy(today);
  var w = fyWindow(fy);
  var r = computePersonTax(person, { fy: fy });
  var rate = (r.marginalRate || 0) + MEDICARE;
  var people = getTaxPeople();
  var moves = [];

  var top = superTopUp(r, 1e12, fy);
  if(top.room >= 500) moves.push({ kind: "super", title: "Super: " + "$" + top.room.toLocaleString("en-AU") + " of cap room left",
    amount: top.room, saves: top.netGain,
    detail: "A deductible personal contribution of the full room gets about $" + top.taxSaved.toLocaleString("en-AU") + " back at tax time, less $" +
      (top.contributionsTax + top.div293).toLocaleString("en-AU") + " contributions tax in the fund. It has to reach the fund by 30 June (most funds want a few days), with a notice of intent sent before you lodge — and it stays in super until preservation age." });

  var gains = personCapitalGains(person, { from: w.start, to: w.end, funds: personFundStatements(person, w) });
  if(gains.assessable > 0){
    var losers = [];
    (state.assets || []).forEach(function(a){
      if(a.category !== "Shares" || !(Number(a.quantity) > 0)) return;
      if(a.person ? a.person !== person : people.length > 1) return;
      var avg = lotsAverageCost(a) || Number(a.avgCost) || 0;
      if(!(avg > 0)) return;
      var cost = toAudAmount(a, avg * Number(a.quantity));
      var value = toAudAmount(a, (Number(a.price) || 0) * Number(a.quantity));
      if(cost - value >= 50) losers.push({ what: a.what || a.symbol, loss: cost - value });
    });
    if(losers.length){
      var totalLoss = losers.reduce(function(s, x){ return s + x.loss; }, 0);
      var settings = state.tax.settings && state.tax.settings[person];
      var prior = Math.max(0, Number(settings && settings.capitalLossCarriedForward) || 0);
      var after = personCapitalGains(person, { from: w.start, to: w.end, funds: personFundStatements(person, w), priorLosses: prior + totalLoss });
      var saved = (gains.assessable - after.assessable) * rate;
      if(saved >= 20) moves.push({ kind: "losses", title: "Losses: " + losers.length + " holding" + (losers.length === 1 ? "" : "s") + " below cost, against $" + round(gains.assessable).toLocaleString("en-AU") + " of gains this year",
        amount: round(totalLoss), saves: round(saved),
        detail: losers.sort(function(a, b){ return b.loss - a.loss; }).slice(0, 4).map(function(x){ return x.what + " ($" + round(x.loss).toLocaleString("en-AU") + " down)"; }).join(", ") +
          ". Selling realises the loss against this year's gains, worth about $" + round(saved).toLocaleString("en-AU") + " in tax. Only if you'd sell anyway: buying the same thing straight back to keep the position can be treated as a wash sale and the loss denied." });
    }
  }

  deductionRows(items, person).forEach(function(i){
    if(["Weekly", "Fortnightly", "Monthly"].indexOf(i.freq) !== -1) return;
    var due = Number(i.dueMonth) || 0;
    if(due && due >= 1 && due <= 6) return;          // already falls in this financial year
    var amt = rowDeductionAnnual(i, w);
    if(amt < 100) return;
    moves.push({ kind: "prepay", title: "Prepay: " + (i.what || "a deductible line"), amount: round(amt), saves: round(amt * rate),
      detail: "Paying the next one before 30 June brings its $" + round(amt).toLocaleString("en-AU") + " deduction into this year, about $" + round(amt * rate).toLocaleString("en-AU") +
        " sooner — it covers up to twelve months ahead. The saving is timing, not extra, unless your rate next year is lower." });
  });

  ipProperties().forEach(function(p){
    var pct = propertyOwnershipPct(p, person, people);
    if(!pct) return;
    var yearly = (p.loans || []).reduce(function(s, l){ return s + (loanPaidOut(l, w.end) ? 0 : loanInterestMonthly(l) * 12); }, 0) * pct / 100;
    if(yearly < 500) return;
    moves.push({ kind: "interest", title: "Prepay interest: " + (p.what || "investment loan") + " (your " + pct + "%)", amount: round(yearly), saves: round(yearly * rate),
      detail: "Paying up to twelve months of interest in advance before 30 June brings about $" + round(yearly).toLocaleString("en-AU") + " of deductions into this year for your share. Lenders usually only allow it on a fixed-rate loan, it takes the cash now, and the saving is timing — worth it mainly when this year's income (a bonus, a sale) is unusually high." });
  });

  var daysLeft = Math.max(0, Math.round((Date.parse(w.end) - Date.parse(today)) / 86400000));
  return { fy: fy, daysLeft: daysLeft, marginal: rate, moves: moves.sort(function(a, b){
    // Real savings before timing ones, then the bigger first: prepaying moves a deduction, it
    // doesn't make one, so it never outranks a move that actually lowers the tax.
    var timing = function(m){ return m.kind === "prepay" || m.kind === "interest" ? 1 : 0; };
    return timing(a) - timing(b) || (b.saves || 0) - (a.saves || 0);
  }) };
}

// May and June: the window the panel opens itself in.
export function inJuneWindow(today){
  var m = Number(String(today).slice(5, 7));
  return m === 5 || m === 6;
}
