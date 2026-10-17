// Super top-up before 30 June (v3.42.0). A personal contribution you claim as a deduction counts
// toward the concessional cap like salary sacrifice: it comes off taxable income, and the fund
// takes 15% contributions tax (30% for income over the Division 293 threshold). Pure apart from
// the tax tables; `r` is computePersonTax(person) for the year.
import { incomeTaxAU, medicareLevyAU } from "./tax.js";

export var DIV293_THRESHOLD = 250000;
export function superTopUp(r, amount, fy){
  var room = Math.max(0, (Number(r.capAvailable) || 0) - (Number(r.totalConcessional) || 0));
  var want = Math.max(0, Number(amount) || 0);
  var x = Math.min(want, room);
  var t = Math.max(0, Number(r.taxable) || 0);
  var after = Math.max(0, t - x);
  var taxSaved = (incomeTaxAU(t, fy) + medicareLevyAU(t, fy)) - (incomeTaxAU(after, fy) + medicareLevyAU(after, fy));
  var contributionsTax = x * 0.15;
  // The deduction lowers taxable income but adds the same to low-tax contributions, so income for
  // Division 293 purposes doesn't move; the extra 15% applies to the part of it over the threshold.
  var over = Math.max(0, (Number(r.div293Income) || 0) - DIV293_THRESHOLD);
  var alreadyTaxed = Math.min(Math.min(Number(r.totalConcessional) || 0, Number(r.capAvailable) || 0), over);
  var div293 = Math.min(x, Math.max(0, over - alreadyTaxed)) * 0.15;
  return {
    room: Math.round(room), amount: Math.round(x), overRoom: Math.max(0, Math.round(want - room)),
    taxSaved: Math.round(taxSaved), contributionsTax: Math.round(contributionsTax), div293: Math.round(div293),
    superAdded: Math.round(x - contributionsTax - div293),
    outOfPocket: Math.round(x - taxSaved),
    netGain: Math.round(taxSaved - contributionsTax - div293)
  };
}
