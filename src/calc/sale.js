// What selling an investment property would leave you (v3.39.0). Pure apart from the tax tables.
//
// Sale price, less the agent and the other selling costs, less the loans paid out at that date,
// is the cash. The capital gain is that same net sale price against the cost base — purchase price
// and acquisition costs, less the capital works claimed up to the sale (they come off the cost
// base, s 110-45(1B)). Each owner takes their share of the gain, halves it if the property was
// held more than twelve months, and pays tax on it at their own rates in the year of sale.
import { propertyCostBase, capitalWorksClaimedToDate, loanBalanceAfterMonths, loanPaidOut } from "./property.js";
import { incomeTaxAU, medicareLevyAU, fyOfDate } from "./tax.js";

function daysBetween(a, b){ return (Date.parse(b) - Date.parse(a)) / 86400000; }

// o = { today, saleDate, salePrice (optional — else grown from today's value), growthPct,
//       agentPct, otherCosts, owners: [{ name, pct, taxable }] }
export function saleScenario(p, o){
  var years = Math.max(0, daysBetween(o.today, o.saleDate) / 365.25);
  var months = Math.round(years * 12);
  var value = Number(p.value) || 0;
  var salePrice = Number(o.salePrice) > 0 ? Number(o.salePrice) : Math.round(value * Math.pow(1 + (Number(o.growthPct) || 0) / 100, years));
  var agent = salePrice * (Number(o.agentPct) || 0) / 100;
  var selling = Math.round(agent + (Number(o.otherCosts) || 0));
  var loans = (p.loans || []).reduce(function(s, l){
    if(loanPaidOut(l, o.saleDate)) return s;
    return s + loanBalanceAfterMonths(Number(l.balance) || 0, Number(l.rate) || 0, l.termYears, months, l.repaymentType);
  }, 0);
  loans = Math.round(loans);
  var paid = propertyCostBase(p);
  var cwReduction = paid == null ? 0 : capitalWorksClaimedToDate(p, o.saleDate);
  var costBase = paid == null ? null : paid - cwReduction;
  var gain = costBase == null ? null : salePrice - selling - costBase;
  var discount = !!p.purchaseDate && daysBetween(p.purchaseDate, o.saleDate) > 365;
  var fy = fyOfDate(o.saleDate);
  var cashBeforeTax = salePrice - selling - loans;
  var owners = (o.owners || []).map(function(w){
    var share = (Number(w.pct) || 0) / 100;
    var gainShare = gain == null ? null : gain * share;
    var assessable = gainShare == null || gainShare <= 0 ? 0 : (discount ? gainShare / 2 : gainShare);
    var base = Math.max(0, Number(w.taxable) || 0);
    var tax = assessable > 0
      ? (incomeTaxAU(base + assessable, fy) + medicareLevyAU(base + assessable, fy)) - (incomeTaxAU(base, fy) + medicareLevyAU(base, fy))
      : 0;
    tax = Math.round(tax);
    return { name: w.name, share: share, gain: gainShare, assessable: Math.round(assessable), tax: tax,
      loss: gainShare != null && gainShare < 0 ? -gainShare : 0,
      cash: Math.round(cashBeforeTax * share - tax) };
  });
  return {
    saleDate: o.saleDate, fy: fy, salePrice: salePrice, sellingCosts: selling, loanPayout: loans,
    cashBeforeTax: cashBeforeTax, paid: paid, capitalWorksReduction: Math.round(cwReduction), costBase: costBase,
    gain: gain == null ? null : Math.round(gain), discount: discount, owners: owners,
    tax: owners.reduce(function(s, w){ return s + w.tax; }, 0),
    cashAfterTax: owners.length ? owners.reduce(function(s, w){ return s + w.cash; }, 0) : cashBeforeTax
  };
}
