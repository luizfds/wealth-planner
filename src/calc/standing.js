// ---------------- Where you stand: Today's decision figures (#457, November 2026) ----------------
//
// At most five, each from a calculation the app already does — nothing is worked out here that isn't worked out
// elsewhere — labelled with its period and scenario, a way to where it's worked out, and "not known" (never $0) when
// there isn't what it needs:
//   cash low     the lowest the cash and offsets go in the next 12 months, a home being bought's settlement included
//                (calc/liquidity.js)
//   normal month the regular monthly surplus of the budget (scenarioTotals' regularNetMonthly)
//   runway       how many months of essentials the cash and offsets cover (calc/emergency.js)
//   rates +2%    what the loans would cost a month more, and the surplus left (calc/scenariostress.js rateStress)
//   next         how many things wait in Needs you, the first named — the same list, not a second one
// Pure: the caller gathers the inputs.

function r0(n){ return Math.round(Number(n) || 0); }

// o: { liquidity (liquidityForecast()), surplus (regularNetMonthly or null), scenario, emergency (emergencyFund() or
// null), stress (rateStress(scenario, 2) or null), hasLoans, todos: [{ title }], monthLabel(m) }
export function standingFigures(o){
  o = o || {};
  var out = [], f = o.liquidity, label = o.monthLabel || function(m){ return m.year + "-" + m.month; };
  // The cash low point — known only from a real starting balance.
  if(f && f.startCash != null && f.lowest){
    out.push({ key: "cashlow", label: "Lowest cash, next 12 months", value: r0(f.lowest.balance), tone: f.shortfall > 0 ? "bad" : f.monthsUnderReserve > 0 ? "warn" : "good",
      sub: (f.lowest.now ? "today's" : "end of " + label(f.lowest)) + (f.events && f.events.length ? " · settlement included" : ""), go: "insights" });
  } else out.push({ key: "cashlow", label: "Lowest cash, next 12 months", value: null, sub: "Record a cash or offset balance to know it", go: "accounts" });
  // A normal month.
  out.push(o.surplus == null ? { key: "month", label: "A normal month", value: null, sub: "Add income and spending to know it", go: "budget" }
    : { key: "month", label: "A normal month", value: r0(o.surplus), tone: o.surplus < 0 ? "bad" : "good", sub: (o.surplus < 0 ? "short" : "left over") + " · " + (o.scenario || "the plan"), go: "budget", perMonth: true });
  // The reserve, in months.
  var e = o.emergency;
  out.push(e && e.monthly > 0 && e.coveredMonths != null ? { key: "runway", label: "Emergency runway", value: Math.round(e.coveredMonths * 10) / 10, unit: "months",
      tone: e.coveredMonths >= (e.months || 3) ? "good" : e.coveredMonths >= 1 ? "warn" : "bad", sub: "of essentials · aim " + (e.months || 3), go: "emergency" }
    : { key: "runway", label: "Emergency runway", value: null, sub: "Mark which spending is essential to know it", go: "budget" });
  // Rates up 2% — only when there's a loan for it to be about.
  if(o.hasLoans){
    var s = o.stress;
    out.push(s ? { key: "stress", label: "If rates rise 2%", value: r0(s.extraMonthly), tone: s.regularNetMonthly < 0 ? "bad" : "warn", perMonth: true, more: true,
        sub: "a month more · " + (s.regularNetMonthly < 0 ? "short by " : "still ") + "$" + Math.abs(r0(s.regularNetMonthly)).toLocaleString("en-AU") + (s.regularNetMonthly < 0 ? "" : " left"), go: "loans" }
      : { key: "stress", label: "If rates rise 2%", value: null, sub: "Add the loans' rates to know it", go: "loans" });
  }
  // What's next: the Needs you list, not another one.
  var todos = o.todos || [];
  out.push({ key: "next", label: "Next", value: todos.length, unit: todos.length === 1 ? "thing" : "things", tone: todos.length ? "warn" : "good",
    sub: todos.length ? todos[0].title + (todos.length > 1 ? " — and " + (todos.length - 1) + " more" : "") : "Nothing waiting", go: "needs" });
  return out.slice(0, 5);
}
