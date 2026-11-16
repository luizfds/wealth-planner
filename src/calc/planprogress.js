// ---------------- Monthly progress against next year's plan (#400, 5/5 of #390) ----------------
//
// Each goal saved from next year's plan (calc/nextyearplan.js: plannedMonthly, planYear) against the plan's line —
// where its balance should be by now: its balance the day the plan was saved (planStart, on planFrom), plus what the
// plan gives it a month for every month since. The owner's choices (#390):
//   - measured from the day it was saved; a goal saved before that was recorded falls back to the start of its plan
//     year, read from balance history, and says so when there's none
//   - behind (or ahead) when it's off the line by more than 10% of the progress planned so far, and at least $100
//   - behind, it suggests both: the monthly amount from now that still lands on the goal's date, and the month it
//     gets there at the pace so far
// A forecast to the plan year's end at the pace so far, beside the plan's own. Balances are the goal's accounts' as
// Goals reads them (calc/savegoals.js goalStatus — a card or loan owed counts against it). A balance not recorded
// lately is said, not filled in; so is an account that's gone.
//
// Behind the household's opt-in (state.planCheckIn), checked by the callers: the month review and the bell.
import { state } from "../state.js";
import { goalStatus, monthsBetween, addMonths } from "./savegoals.js";
import { accountBalance } from "./accounts.js";

export var STALE_DAYS = 45;      // a balance older than this is called out
var TOLERANCE = 0.1, FLOOR = 100;

function r2(n){ return Math.round(n * 100) / 100 || 0; }
function daysBetween(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

// The plan year a goal belongs to, from its label: "FY26/27" → 1 July 2026 to 30 June 2027; "2026" → the calendar year.
export function planYearBounds(label){
  var fy = /^FY(\d{2})\/(\d{2})$/.exec(label || "");
  if(fy) return { start: "20" + fy[1] + "-07-01", end: "20" + fy[2] + "-06-30" };
  if(/^\d{4}$/.test(label || "")) return { start: label + "-01-01", end: label + "-12-31" };
  return null;
}

// A goal's balance on a date, from its accounts' recorded history: the last record on or before it, each account.
// null when an account has none.
function balanceOn(goal, date){
  var total = 0, ok = true;
  (goal.accounts || []).forEach(function(n){
    var a = (state.accounts || []).find(function(x){ return x.name === n; });
    var b = a ? accountBalance(a) : null;
    var pts = b ? (b.history || []).filter(function(h){ return h && h.date <= date; }).sort(function(x, y){ return x.date < y.date ? -1 : 1; }) : [];
    if(!pts.length){ ok = false; return; }
    var v = Number(pts[pts.length - 1].value) || 0;
    total += b.owed ? -v : v;
  });
  return ok ? total : null;
}
// The goal's accounts whose latest balance is older than STALE_DAYS.
function staleAccounts(goal, today){
  return (goal.accounts || []).filter(function(n){
    var a = (state.accounts || []).find(function(x){ return x.name === n; });
    var b = a ? accountBalance(a) : null;
    return b && b.balance != null && (!b.date || daysBetween(b.date, today) > STALE_DAYS);
  });
}

export function isPlanned(g){ return !!g && g.plannedMonthly != null && !!g.planYear; }

// One goal's progress. status: "on-track" | "ahead" | "behind" | "done" | "early" (under a month in) | "no-data".
export function goalProgress(g, today){
  var year = planYearBounds(g.planYear);
  var s = goalStatus(g, today);
  var out = { id: g.id, name: g.name || "Savings goal", target: r2(Number(g.target) || 0), by: g.by || "", planned: r2(Number(g.plannedMonthly) || 0),
    planYear: g.planYear, yearEnd: year ? year.end : null, from: null, fromYearStart: false, start: null, actual: s.current, expected: null, gap: null,
    tolerance: null, monthsIn: 0, pace: null, forecast: null, planAtYearEnd: null, adjust: null, status: "no-data", problem: "", stale: staleAccounts(g, today) };
  if(s.missing.length){ out.problem = "No balance for " + s.missing.join(", ") + "."; return out; }
  // Where it started: as saved, or the plan year's start from history.
  var from = g.planFrom, start = g.planStart != null ? Number(g.planStart) : null;
  if(!from || start == null){
    out.fromYearStart = true;
    from = year ? year.start : null;
    start = from ? balanceOn(g, from) : null;
    if(start == null){ out.problem = "No balance was recorded when the plan started, so there's nothing to measure from."; return out; }
  }
  out.from = from; out.start = r2(start);
  if(s.left <= 0){ out.status = "done"; return out; }
  var monthsIn = monthsBetween(from, today);
  out.monthsIn = Math.round(monthsIn * 10) / 10;
  var cap = function(v){ return Math.min(v, out.target); };
  out.expected = r2(cap(start + out.planned * monthsIn));
  out.gap = r2(out.actual - out.expected);
  out.tolerance = r2(Math.max(FLOOR, TOLERANCE * Math.max(0, out.expected - start)));
  if(year) out.planAtYearEnd = r2(cap(start + out.planned * monthsBetween(from, year.end)));
  if(monthsIn < 1){ out.status = "early"; return out; }
  out.pace = r2((out.actual - start) / monthsIn);
  if(year) out.forecast = r2(cap(out.actual + out.pace * monthsBetween(today, year.end)));
  out.status = out.gap < -out.tolerance ? "behind" : out.gap > out.tolerance ? "ahead" : "on-track";
  if(out.status === "behind"){
    var left = out.target - out.actual, monthsLeft = g.by ? monthsBetween(today, g.by) : 0;
    out.adjust = {
      monthly: monthsLeft > 0 ? r2(left / monthsLeft) : null,
      extra: monthsLeft > 0 ? r2(Math.max(0, left / monthsLeft - out.planned)) : null,
      reach: out.pace > 0 ? addMonths(today, left / out.pace) : null
    };
  }
  return out;
}

// Every planned goal, and what needs a look: { goals, behind, noData, stale (goals with an old balance), attention }.
export function planProgress(today){
  var goals = (state.savingsGoals || []).filter(isPlanned).map(function(g){ return goalProgress(g, today); });
  var behind = goals.filter(function(p){ return p.status === "behind"; }).length;
  var noData = goals.filter(function(p){ return p.status === "no-data"; }).length;
  var stale = goals.filter(function(p){ return p.stale.length && p.status !== "done"; }).length;
  return { goals: goals, behind: behind, noData: noData, stale: stale, attention: behind + noData + stale > 0 };
}

// The household's opt-in. Returns whether it changed; the caller saves with commit(["planCheckIn"]).
export function setPlanCheckIn(st, on){
  on = on === true;
  if(st.planCheckIn === on) return false;
  st.planCheckIn = on;
  return true;
}
