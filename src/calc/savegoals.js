import { state, genId } from "../state.js";
import { accountBalance } from "./accounts.js";

// ---------------- Savings goals tied to accounts (v3.65.0) ----------------
//
// A goal is a target amount by a date, measured on real account balances — the house-deposit
// savings account, the offset, an emergency-fund account — so its progress moves when a balance is
// updated, not when someone remembers to type a number into the goal. Separate from the benchmark
// goals (savings rate, spend in a category) in state.goals, which measure behaviour, not a balance.
//
// state.savingsGoals = [{ id, name, target, by: "YYYY-MM-DD" | "", accounts: [accountName], startAmount? }]
function round(n){ return Math.round(n * 100) / 100; }
function monthsBetween(a, b){
  var y = Number(b.slice(0, 4)) - Number(a.slice(0, 4)), m = Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  var d = Number(b.slice(8, 10)) - Number(a.slice(8, 10));
  return Math.max(0, y * 12 + m + d / 30);
}
function addMonths(iso, n){
  var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + Math.ceil(n), 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function addSavingsGoal(g){
  if(!Array.isArray(state.savingsGoals)) state.savingsGoals = [];
  var rec = { id: genId("sg"), name: g.name || "Savings goal", target: Math.max(0, Number(g.target) || 0), by: g.by || "", accounts: (g.accounts || []).slice() };
  state.savingsGoals.push(rec);
  return rec;
}

// The balance the goal counts: its accounts' balances added up (what a card or loan owes counts
// against it). Plus the pace — how fast those balances have actually grown, from their history over
// the last few months — so "on track" is about what's happening, not only what's planned.
export function goalStatus(goal, today, opts){
  opts = opts || {};
  var accounts = (state.accounts || []).filter(function(a){ return (goal.accounts || []).indexOf(a.name) !== -1; });
  var current = 0, missing = [];
  var series = {};
  accounts.forEach(function(a){
    var b = accountBalance(a);
    if(b.balance == null){ missing.push(a.name); return; }
    current += b.owed ? -b.balance : b.balance;
    (b.history || []).forEach(function(h){ series[a.name] = series[a.name] || []; series[a.name].push({ date: h.date, value: b.owed ? -h.value : h.value }); });
  });
  (goal.accounts || []).forEach(function(n){ if(!accounts.some(function(a){ return a.name === n; })) missing.push(n); });
  var target = Number(goal.target) || 0;
  var left = Math.max(0, target - current);
  var months = goal.by ? monthsBetween(today, goal.by) : null;
  var neededMonthly = months != null ? (months > 0 ? left / months : (left > 0 ? left : 0)) : null;
  // Pace: each account's change between its oldest snapshot in the last ~6 months and its newest,
  // per month, added up. Needs at least ~3 weeks between the two to mean anything.
  var pace = null, span = 0;
  Object.keys(series).forEach(function(n){
    var pts = series[n].filter(function(p){ return monthsBetween(p.date, today) <= 6.5; }).sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    if(pts.length < 2) return;
    var m = monthsBetween(pts[0].date, pts[pts.length - 1].date);
    if(m < 0.7) return;
    pace = (pace || 0) + (pts[pts.length - 1].value - pts[0].value) / m;
    span = Math.max(span, m);
  });
  var projected = pace != null && pace > 0 && left > 0 ? addMonths(today, left / pace) : null;
  var surplus = opts.surplusMonthly;
  var status = left <= 0 ? "done"
    : neededMonthly == null ? (pace != null && pace > 0 ? "moving" : "open")
    : pace != null ? (pace >= neededMonthly * 0.95 ? "on-track" : "behind")
    : (surplus != null && surplus >= neededMonthly ? "possible" : "behind");
  // v3.146.0: past the target, by how much — `times` is how many targets' worth is there.
  var over = target > 0 && current > target ? round(current - target) : 0;
  return { id: goal.id, name: goal.name, target: round(target), current: round(current), left: round(left), pct: target > 0 ? Math.min(1, Math.max(0, current / target)) : 0,
    over: over, times: target > 0 ? Math.round(current / target * 10) / 10 : null,
    by: goal.by || "", months: months == null ? null : Math.round(months * 10) / 10, neededMonthly: neededMonthly == null ? null : round(neededMonthly),
    pace: pace == null ? null : round(pace), paceMonths: Math.round(span * 10) / 10, projected: projected, status: status, missing: missing, accounts: (goal.accounts || []).slice() };
}

// Every goal, plus whether the plan's monthly surplus covers what all of them need together.
export function goalsOverview(today, surplusMonthly){
  var list = (state.savingsGoals || []).map(function(g){ return goalStatus(g, today, { surplusMonthly: surplusMonthly }); });
  // v3.146.0: where a goal's surplus could go — the unfinished goal it would finish soonest (one kept
  // in other accounts; moving money between a goal's own accounts changes nothing), else an offset
  // account it isn't already in, where it brings the loan's interest down.
  list.forEach(function(g){
    if(!(g.over > 0)) return;
    var others = list.filter(function(o){ return o !== g && o.status !== "done" && o.left > 0 && !o.accounts.some(function(a){ return g.accounts.indexOf(a) !== -1; }); })
      .sort(function(a, b){ return a.left - b.left; });
    if(others.length) g.surplusTo = { kind: "goal", name: others[0].name, amount: round(Math.min(g.over, others[0].left)), finishes: g.over >= others[0].left };
    else {
      var offset = (state.accounts || []).find(function(a){ return a.type === "offset" && g.accounts.indexOf(a.name) === -1; });
      if(offset) g.surplusTo = { kind: "offset", name: offset.name, amount: g.over };
    }
  });
  var needed = list.reduce(function(s, g){ return s + (g.status !== "done" && g.neededMonthly ? g.neededMonthly : 0); }, 0);
  return { goals: list, neededMonthly: round(needed), surplusMonthly: surplusMonthly == null ? null : round(surplusMonthly),
    covered: surplusMonthly == null ? null : surplusMonthly >= needed };
}
