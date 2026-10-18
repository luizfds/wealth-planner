import { fyWindow } from "./property.js";

// ---------------- Mid-year withholding check (v3.50.0) ----------------
//
// "Am I heading for a refund or a bill?" answered before 30 June rather than after it. A payslip's
// year-to-date figures say what's been earned and withheld so far; the rest of the year is the plan's
// gross minus what's already been paid, withheld at the same average rate the year has run at so
// far. Against that, the year's tax as the worksheet would work it out.
//
// The average rate is the honest simplification: pay as you go withholding is roughly proportional
// over a year, but a bonus withheld at a flat higher rate, or a pay rise late in the year, moves it.
// The UI says so rather than pretending to precision.
//
// ytd = {asOf: "YYYY-MM-DD", gross, withheld}; r = computePersonTax(person, {fy}); returns null when
// there's nothing usable.
export function projectWithholding(ytd, r, fy){
  if(!ytd || !ytd.asOf || !(Number(ytd.gross) > 0) || !r) return null;
  var w = fyWindow(fy);
  if(ytd.asOf < w.start || ytd.asOf > w.end) return { stale: true, asOf: ytd.asOf, fy: fy };
  var gross = Number(ytd.gross) || 0, withheld = Math.max(0, Number(ytd.withheld) || 0);
  var rate = withheld / gross;
  var planGross = Math.max(0, Number(r.gross) || 0);
  var remaining = Math.max(0, planGross - gross);
  var projectedWithheld = withheld + remaining * rate;
  var tax = (Number(r.totalTax) || 0) + (Number(r.helpRepayment) || 0);
  var days = Math.round((Date.parse(ytd.asOf) - Date.parse(w.start)) / 86400000) + 1;
  var yearDays = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 86400000) + 1;
  var round = function(n){ return Math.round(n * 100) / 100; };
  return {
    stale: false, asOf: ytd.asOf, fy: fy,
    elapsed: days / yearDays,
    rate: rate,
    planGross: round(planGross),
    // The payslip already passing the plan's whole-year gross says the plan is out of date.
    aheadOfPlan: gross > planGross + 1,
    projectedWithheld: round(projectedWithheld),
    tax: round(tax),
    outcome: round(projectedWithheld - tax)   // positive: a refund; negative: a bill
  };
}
