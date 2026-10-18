import { state } from "../state.js";
import { periodsOf } from "./ledger.js";
import { incomeTargets, receivedFor } from "./received.js";
import { claimItems } from "./claims.js";
import { localDateStr } from "../lib/format.js";

// ---------------- The plan against what's actually happening (v3.52.0) ----------------
//
// The projection and the FI date have always run on planned figures. Once a few months of money
// received (calc/received.js) and spending logged against the budget exist, they can run on what's
// really happening instead: the plan, corrected by the differences actually measured.
//
//   income: received − planned, over the regular income lines that had anything logged
//   spend:  logged − planned, over the regular budget lines that had anything logged, plus one-offs
//
// Only lines with evidence move, and they move by their own difference — not by a ratio applied to
// everything. A household that logs groceries but not the rent direct debit hasn't stopped paying
// rent, and scaling the rent by the groceries' underspend would read gaps in the logging as
// savings. Irregular and less-than-monthly lines (a $20,000 travel reserve, a yearly bill) are left
// out too: a few months says nothing about them. The ratios are kept for the explanation.
//
// Window: the last six complete calendar months, starting no earlier than the first month with
// anything logged. Needs three months of both to be "available".
export var MIN_MONTHS = 3, MAX_MONTHS = 6;

function monthStart(ym){ return ym + "-01"; }
function monthEnd(ym){ var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return ym + "-" + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0"); }
function addMonths(ym, n){ var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + "-" + String(m + 1).padStart(2, "0"); }
function monthsBetween(a, b){ return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1; }

export function actualRatios(today, items){
  today = today || localDateStr();
  items = items || claimItems();
  var last = addMonths(today.slice(0, 7), -1);
  var firstIncome = (state.incomeLog || []).map(function(r){ return r.date; }).filter(Boolean).sort()[0];
  var firstSpend = (state.transactions || []).map(function(t){ return t.date; }).filter(Boolean).sort()[0];
  var none = { available: false, months: 0, incomeMonths: 0, spendMonths: 0 };
  if(!firstIncome || !firstSpend) return Object.assign(none, { incomeMonths: firstIncome ? 1 : 0, spendMonths: firstSpend ? 1 : 0 });
  var start = addMonths(last, -(MAX_MONTHS - 1));
  var first = (firstIncome > firstSpend ? firstIncome : firstSpend).slice(0, 7);
  if(first > start) start = first;
  var months = start > last ? 0 : monthsBetween(start, last);
  var from = monthStart(start), to = monthEnd(last);
  // Each line is measured from the first month it has anything logged — logging that began in
  // August says nothing about June, and counting June's plan against it would read as a 50% saving.
  var monthsFrom = function(date){ var m = date.slice(0, 7); if(m < start) m = start; return Math.max(1, monthsBetween(m, last)); };
  // Income: regular targets with anything received in the window.
  var incPlanned = 0, incReceived = 0, incLines = 0, incDelta = 0;
  incomeTargets().forEach(function(t){
    if(t.irregular || t.kind === "payout") return;
    var rows = receivedFor(t.key, from, to);
    if(!rows.length) return;
    incLines++;
    var n = monthsFrom(rows.map(function(r){ return r.date; }).sort()[0]);
    var got = rows.reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
    incPlanned += t.monthly * n; incReceived += got;
    incDelta += got / n - t.monthly;
  });
  // Spending: regular lines with anything logged, plus one-offs (over the months anything was logged).
  var byLine = {}, firstByLine = {}, oneOffs = 0, firstAny = null;
  (state.transactions || []).forEach(function(t){
    if(!t.date || t.date < from || t.date > to) return;
    var amt = Number(t.amount) || 0;
    if(!firstAny || t.date < firstAny) firstAny = t.date;
    if(t.linkedExpenseId){
      byLine[t.linkedExpenseId] = (byLine[t.linkedExpenseId] || 0) + amt;
      if(!firstByLine[t.linkedExpenseId] || t.date < firstByLine[t.linkedExpenseId]) firstByLine[t.linkedExpenseId] = t.date;
    } else oneOffs += amt;
  });
  var spPlanned = 0, spLogged = oneOffs, spLines = 0;
  var spDelta = firstAny ? oneOffs / monthsFrom(firstAny) : 0;
  (items || []).forEach(function(i){
    if(byLine[i.id] == null) return;
    // A lumpy line (a travel reserve, a yearly bill) is left out: a few months say nothing about it.
    if(i.irregular || ["Weekly", "Fortnightly", "Monthly"].indexOf(i.freq) === -1) return;
    spLines++;
    var n = monthsFrom(firstByLine[i.id]);
    var plan = periodsOf(Number(i.amount) || 0, i.freq).monthly;
    spPlanned += plan * n; spLogged += byLine[i.id];
    spDelta += byLine[i.id] / n - plan;
  });
  // Enough to go on: three months of each since logging actually started.
  var firstIncomeIn = (state.incomeLog || []).map(function(r){ return r.date; }).filter(function(d){ return d && d >= from && d <= to; }).sort()[0];
  var incomeMonths = firstIncomeIn ? monthsFrom(firstIncomeIn) : 0;
  var spendMonths = firstAny ? monthsFrom(firstAny) : 0;
  months = Math.min(incomeMonths || months, spendMonths || months);
  var round = function(n){ return Math.round(n * 1000) / 1000; };
  return {
    available: incomeMonths >= MIN_MONTHS && spendMonths >= MIN_MONTHS && incPlanned > 0 && spPlanned > 0,
    incomeMonths: incomeMonths, spendMonths: spendMonths,
    months: months, from: from, to: to,
    incomeRatio: incPlanned > 0 ? round(incReceived / incPlanned) : 1,
    spendRatio: spPlanned > 0 ? round(spLogged / spPlanned) : 1,
    incomeLines: incLines, spendLines: spLines,
    incomeDeltaMonthly: Math.round(incDelta * 100) / 100,
    spendDeltaMonthly: Math.round(spDelta * 100) / 100,
    incomeReceivedMonthly: months ? incReceived / months : 0, incomePlannedMonthly: months ? incPlanned / months : 0,
    spendLoggedMonthly: months ? spLogged / months : 0, spendPlannedMonthly: months ? spPlanned / months : 0
  };
}

// The ratios the projection should use: the actuals when asked for and available, the plan otherwise.
// The monthly corrections the projection and the FI date should use: zero on "Plan", or when
// there isn't enough logged yet.
export function projectionRatios(opts){
  var none = { incomeDelta: 0, spendDelta: 0, actuals: false };
  if(!(state.projection && state.projection.source === "actuals")) return none;
  var a = (opts && opts.ratios) || actualRatios();
  if(!a.available) return none;
  return { incomeDelta: a.incomeDeltaMonthly, spendDelta: a.spendDeltaMonthly, actuals: true };
}
