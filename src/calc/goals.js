// Your own targets (v3.36.0). Pure: the caller hands in the current figures (ctx) and gets back
// progress and a status per goal.
//
// Kinds:
//   savingsRate    target is a fraction (0.25), higher is better
//   netWorth       target in today's dollars, optional `by` (YYYY-MM-DD) — "on track" when the
//                  active scenario's projection reaches it by then
//   emergencyFund  target in months of expenses covered by liquid assets
//   superBalance   target dollars across everyone's super
//   categorySpend  a monthly cap for one spending category — lower is better, paced through the month
export var GOAL_KINDS = [
  { kind: "savingsRate", label: "Savings rate", unit: "%", placeholder: 25 },
  { kind: "netWorth", label: "Net worth", unit: "$", placeholder: 1000000 },
  { kind: "emergencyFund", label: "Emergency fund", unit: "months", placeholder: 6 },
  { kind: "superBalance", label: "Super, everyone combined", unit: "$", placeholder: 500000 },
  { kind: "categorySpend", label: "Monthly spending cap for a category", unit: "$/mo", placeholder: 800 }
];
export function goalKindInfo(kind){
  return GOAL_KINDS.find(function(k){ return k.kind === kind; }) || null;
}
// ctx: { savingsRate, netWorth, runwayMonths, superTotal, categoryMonthToDate: {name: $},
//        monthFraction (0..1 through this month), projectedNetWorthAt(dateStr) → number|null }
export function goalProgress(goal, ctx){
  var target = Number(goal.target) || 0;
  if(!(target > 0)) return { current: null, target: target, pct: 0, status: "unset" };
  var current, pct, status;
  switch(goal.kind){
    case "savingsRate":
      current = ctx.savingsRate;
      if(current == null) return { current: null, target: target, pct: 0, status: "unknown" };
      pct = current / target;
      status = current >= target ? "met" : "behind";
      break;
    case "netWorth":
      current = ctx.netWorth;
      pct = current / target;
      if(current >= target) status = "met";
      else if(goal.by && ctx.projectedNetWorthAt){
        var proj = ctx.projectedNetWorthAt(goal.by);
        status = proj == null ? "behind" : proj >= target ? "on-track" : "behind";
        return { current: current, target: target, pct: pct, status: status, projected: proj };
      } else status = "behind";
      break;
    case "emergencyFund":
      current = ctx.runwayMonths;
      if(current == null) return { current: null, target: target, pct: 0, status: "unknown" };
      pct = current / target;
      status = current >= target ? "met" : "behind";
      break;
    case "superBalance":
      current = ctx.superTotal || 0;
      pct = current / target;
      status = current >= target ? "met" : "behind";
      break;
    case "categorySpend":
      current = (ctx.categoryMonthToDate || {})[goal.category] || 0;
      pct = current / target;
      var pace = target * (ctx.monthFraction == null ? 1 : ctx.monthFraction);
      status = current > target ? "over" : current > pace + 0.5 ? "ahead-of-pace" : "within";
      return { current: current, target: target, pct: pct, status: status, pace: pace };
    default:
      return { current: null, target: target, pct: 0, status: "unknown" };
  }
  return { current: current, target: target, pct: pct, status: status };
}
// How far through the month `today` is, counting today as spent: the 15th of a 30-day month is 0.5.
export function monthFraction(today){
  var y = +today.slice(0, 4), m = +today.slice(5, 7), d = +today.slice(8, 10);
  var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d / days;
}
