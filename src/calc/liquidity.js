// ---------------- Cash, month by month, through a settlement (#454, November 2026) ----------------
//
// The 12-month cash flow forecast (calc/cashflow.js) says what each month adds or takes; this carries a balance through
// it — starting from the cash and offsets held today — and puts each home being bought in its settlement month: the
// cash to bring (calc/purchase.js — the price less the deposit already paid, less what the lender releases net of the
// fees it keeps, plus the costs still to pay; so the deposit, the lender's deductions, the duty and the fees each land
// exactly once), then the new loan's repayments from the month after. A rate rise (+1% or +2%) is added to every loan,
// the new one included. It says the lowest balance and when, what of today's cash is set aside for settlement (not
// emergency money), and which months fall under the emergency reserve — and only says there's a shortfall when the
// balance actually goes below nothing. What it assumes and what's missing are listed, never filled in as $0.
import { projectRemaining } from "./projects.js";
import { purchaseFigures } from "./purchase.js";
import { calcRepaymentMonthly } from "./property.js";

/** @param {any} v */
function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function r2(n){ return Math.round(n * 100) / 100; }
function ym(iso){ var m = /^(\d{4})-(\d{2})/.exec(String(iso || "")); return m ? { year: +m[1], month: +m[2] } : null; }
function idx(start, at){ return (at.year - start.year) * 12 + (at.month - start.month); }

// o: { months: [{ year, month, net, items }] (monthlyCashFlowForecast), startCash (null when there's no balance to start
// from), purchases, loans: [{ balance, rate }] (today's loans), stressPct (0, 1, 2), reserveTarget, today }
export function liquidityForecast(o){
  o = o || {};
  var months = o.months || [], stress = num(o.stressPct), today = o.today || "";
  var assumptions = [], missing = [];
  if(!months.length) return { months: [], lowest: null, events: [], assumptions: assumptions, missing: ["Add income and expenses for a month-by-month forecast."] };
  var start = { year: months[0].year, month: months[0].month };
  var known = o.startCash != null;
  if(!known) missing.push("No cash or offset balance recorded — the months below start from $0, so read the changes, not the balances.");
  // A rate rise costs about the balance × the rise a year on every loan (interest only — a repayment that's fixed
  // stays fixed until it resets, so this is the most it adds).
  var loanStress = stress > 0 ? (o.loans || []).reduce(function(s, l){ return s + Math.max(0, num(l.balance)) * stress / 100 / 12; }, 0) : 0;
  if(stress > 0) assumptions.push("Rates " + stress + "% higher on every loan from this month: about $" + Math.round(loanStress).toLocaleString("en-AU") + " a month more on today's loans.");

  // Each purchase: its settlement month, the cash to bring, and the new loan's repayment after it.
  var events = [];
  (o.purchases || []).forEach(function(p){
    var f = purchaseFigures(p, today, null), at = ym(p.settlementDate), name = p.what || "The home being bought";
    if(!at){ missing.push(name + " has no settlement date, so its cash to bring isn't placed in a month."); return; }
    var i = idx(start, at);
    if(i < 0 || i >= months.length){ if(i >= months.length) assumptions.push(name + " settles after these 12 months."); return; }
    var rate = num(p.rate) + stress;
    var repay = f.borrowed > 0 && num(p.rate) > 0 ? calcRepaymentMonthly(f.borrowed, rate, 30, "PI") : null;
    if(f.borrowed > 0 && repay == null) missing.push(name + " has no loan rate, so its repayments aren't counted.");
    events.push({ index: i, what: name, cashToBring: r2(f.cashNeeded), repayment: repay == null ? 0 : r2(repay), loan: f.borrowed, toConfirm: f.toConfirm, unclassified: f.unclassified });
    if(f.toConfirm) assumptions.push(name + ": " + f.toConfirm + " cost" + (f.toConfirm === 1 ? " is" : "s are") + " still to come and counted as $0 until the bill.");
    if(repay != null) assumptions.push(name + ": a 30-year principal-and-interest loan of $" + Math.round(f.borrowed).toLocaleString("en-AU") + " at " + r2(rate) + "% from the month after settlement.");
    assumptions.push(name + ": anything that stops at settlement (rent you pay now, say) carries on unless its budget line has an end date.");
  });

  var bal = known ? num(o.startCash) : 0, out = [], lowest = { balance: bal, index: -1 };
  months.forEach(function(m, i){
    var flow = num(m.net) - loanStress, lines = [];
    events.forEach(function(e){
      if(e.index === i){ flow -= e.cashToBring; lines.push({ what: e.what + " settles — cash to bring", amount: -e.cashToBring }); }
      if(i > e.index && e.repayment > 0){ flow -= e.repayment; if(i === e.index + 1) lines.push({ what: e.what + " — loan repayments begin", amount: -e.repayment }); }
    });
    (o.projects || []).forEach(function(p){
      var at = ym(p.month);
      if(!at || at.year !== m.year || at.month !== m.month) return;
      var remaining = projectRemaining(p, o.transactions);
      if(remaining){ flow -= remaining; lines.push({ what:p.name, amount:-remaining }); }
    });
    bal = r2(bal + flow);
    out.push({ year: m.year, month: m.month, net: r2(flow), balance: bal, items: (m.items || []).concat(lines) });
    if(bal < lowest.balance) lowest = { balance: bal, index: i };
  });

  // Cash already spoken for: what each settlement in these months needs is set aside, not emergency money.
  var earmarked = r2(events.reduce(function(s, e){ return s + e.cashToBring; }, 0));
  var reserveTarget = o.reserveTarget == null ? null : num(o.reserveTarget);
  var available = known ? r2(num(o.startCash) - earmarked) : null;
  var under = reserveTarget > 0 ? out.filter(function(m){ return m.balance < reserveTarget; }).length : 0;
  return {
    months: out, events: events, earmarked: earmarked, available: available, reserveTarget: reserveTarget, monthsUnderReserve: under,
    lowest: { balance: lowest.balance, year: lowest.index < 0 ? start.year : out[lowest.index].year, month: lowest.index < 0 ? start.month : out[lowest.index].month, now: lowest.index < 0 },
    // Said only when the balance actually goes below nothing, and only from a real starting balance.
    shortfall: known && lowest.balance < 0 ? r2(-lowest.balance) : 0,
    startCash: known ? r2(num(o.startCash)) : null, assumptions: assumptions, missing: missing
  };
}
