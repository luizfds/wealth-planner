// ---------------- Where you stand: Today's decision figures (#457, November 2026) ----------------
//
// At most four, each from a calculation the app already does — nothing is worked out here that isn't worked out
// elsewhere — labelled with its period, a way to where it's worked out, and "not known" (never $0) when there isn't
// what it needs:
//   left         what's left this month: money received less money spent (calc/monthreview.js), its spending
//                against the plan under it
//   cash low     the lowest the cash and offsets go in the next 12 months, a home being bought's settlement included
//                (calc/liquidity.js)
//   runway       how many months of essentials the cash and offsets cover (calc/emergency.js)
//   rates +2%    what the loans would cost a month more, and the surplus left (calc/scenariostress.js rateStress)
// The app assessment (November 2026): each figure once on Today. The planned monthly surplus is Plans' own tile (with
// how it's worked out), and how many things wait is Needs you's count — so neither is here as well.
// Pure: the caller gathers the inputs.

function r0(n){ return Math.round(Number(n) || 0); }

// o: { month: { left, spent, planned, label } or null (nothing planned or logged), liquidity (liquidityForecast()),
// emergency (emergencyFund() or null), stress (rateStress(scenario, 2) or null), hasLoans, monthLabel(m) }
export function standingFigures(o){
  o = o || {};
  var out = [], f = o.liquidity, label = o.monthLabel || function(m){ return m.year + "-" + m.month; };
  // The cash low point — known only from a real starting balance.
  if(f && f.startCash != null && f.lowest){
    out.push({ key: "cashlow", label: "Lowest cash, next 12 months", value: r0(f.lowest.balance), tone: f.shortfall > 0 ? "bad" : f.monthsUnderReserve > 0 ? "warn" : "good",
      sub: (f.lowest.now ? "today's" : "end of " + label(f.lowest)) + (f.events && f.events.length ? " · settlement included" : ""), go: "forecast" });
  } else out.push({ key: "cashlow", label: "Lowest cash, next 12 months", value: null, sub: "Record a cash or offset balance to know it", go: "accounts" });
  // What's left this month: received less spent — first, it's what most people open Today for.
  var m = o.month;
  out.unshift(m && m.left == null ? { key: "left", label: "Left " + (m.label || "this month"), value: null, sub: "Log money received to know it", go: "income" }
    : m ? { key: "left", label: "Left " + (m.label || "this month"), value: r0(m.left), tone: m.left < 0 ? "bad" : "good",
      sub: "$" + r0(m.spent).toLocaleString("en-AU") + (m.planned > 0 ? " of $" + r0(m.planned).toLocaleString("en-AU") : "") + " spent", go: "spending" }
    : { key: "left", label: "Left this month", value: null, sub: "Add income and spending to know it", go: "budget" });
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
  return out.slice(0, 4);
}
