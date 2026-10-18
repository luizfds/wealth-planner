import { periodsOf, householdYearWindow, overlapDaysInclusive } from "./ledger.js";

// ---------------- Claims: what a budget line deducts, and against what (v3.45.0) ----------------
//
// A budget line flagged deductible is claimed either by a person (deductiblePerson — a personal
// deduction on their return) or against an investment property (claimProperty — a line on that
// property's rental schedule, reaching each owner through their ownership share). The second is how
// a cost paid from the household budget but belonging to the rental — a landlord insurance policy
// on the family card, the property's share of the tax agent's fee — gets onto the right return
// without moving it out of the budget it's actually paid from.
//
// The list of budget lines comes from components/expenses.js's budgetLineItems(), registered once
// at startup (calc/ can't import a component) — through tax.js's setDeductibleItemsProvider, so the
// two can't disagree about which lines exist.
var claimItemsProvider = null;
export function setClaimItemsProvider(fn){ claimItemsProvider = fn; }
export function claimItems(){ return claimItemsProvider ? (claimItemsProvider() || []) : []; }

// The share of a tax year a row was claimable for, 0-1.
//
// A tax return covers a year, and a claim can stop (or start) partway through it. Two different
// reasons, so two different fields:
//
//   - endDate: the expense itself stopped (a subscription cancelled in March).
//   - deductibleFrom / deductibleUntil: the expense carries on but stopped being CLAIMABLE — the
//     home-office share of rent stops the day an employer starts providing an office, while the
//     rent goes on being paid. Using endDate for that would stop the rent in every budget view.
//
// Before this, a row whose endDate had passed claimed $0 — including for the tax year it ended in,
// which is the year someone is most likely to be lodging. A line that stopped on 30 September
// claimed nothing for the July-September it was genuinely incurred.
export function deductionYearFraction(item, win){
  if(!win || !win.start || !win.end) return 1;
  var yearDays = overlapDaysInclusive(win.start, win.end, win.start, win.end);
  // The claim can't start before the expense does (v3.32.0): the later of the two.
  var fromCandidates = [item && item.deductibleFrom, item && item.startDate].filter(Boolean).sort();
  var from = fromCandidates.length ? fromCandidates[fromCandidates.length - 1] : "";
  var untilCandidates = [item && item.endDate, item && item.deductibleUntil].filter(Boolean).sort();
  var until = untilCandidates.length ? untilCandidates[0] : "";
  var days = overlapDaysInclusive(win.start, win.end, from || win.start, until || win.end);
  return yearDays > 0 ? days / yearDays : 0;
}
// The claimable amount of one row for a tax year: its annual cost, times its work-related share,
// times the part of the year it was claimable for. `win` defaults to the household's current year,
// the same window computePersonTax() uses for capital gains.
export function rowDeductionAnnual(item, win){
  var pct = item.deductiblePct == null ? 100 : Math.max(0, Math.min(100, Number(item.deductiblePct) || 0));
  var fraction = deductionYearFraction(item, win || householdYearWindow());
  return periodsOf(Number(item.amount) || 0, item.freq).yearly * (pct / 100) * fraction;
}
// The budget lines claimed against one property.
export function propertyClaimLines(propertyId, items){
  return (items || claimItems()).filter(function(i){ return i.deductible && i.claimProperty && i.claimProperty === propertyId; });
}
// What they deduct in a year (the household's current year unless `win` names one).
export function propertyClaimsAnnual(propertyId, win, items){
  return propertyClaimLines(propertyId, items).reduce(function(s, i){ return s + rowDeductionAnnual(i, win); }, 0);
}
