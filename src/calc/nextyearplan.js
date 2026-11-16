// ---------------- Next year's plan from goals (#399, 4/5 of #390) ----------------
//
// At the end of the guided Year in review: a few goals for the year ahead, each with the monthly amount it needs, and
// one monthly surplus shared between them so the same dollar isn't promised twice. The owner's choices (#390):
//   - three kinds, all ordinary savings goals on account balances (calc/savegoals.js), so nothing new is tracked:
//       emergency — the emergency fund to 3, 6 or 12 months of essentials, on the savings and offset accounts
//       save      — an amount by a date, on the accounts chosen
//       debt      — a card or loan down to $0 by a date (an owed balance counts against a goal)
//   - the surplus is the lower of the budget's regular monthly surplus and last year's actual kept per month
//     (#397's reconciliation), and the plan says which
//   - goals are funded in the order they're put in, each in full until the surplus runs out; one that doesn't fit
//     says when it would get there on what's left
// Drafts live in the page until they're saved (components/reports.js); savePlan() adds them as savings goals with the
// monthly amount the plan gave each and the year it's for (plannedMonthly, planYear — #400 measures against them).
import { state } from "../state.js";
import { scenarioTotals, currentScenario } from "./engine.js";
import { emergencyFund } from "./emergency.js";
import { goalStatus, addSavingsGoal } from "./savegoals.js";
import { reviewYear } from "./yearreview.js";
import { reconcileYear } from "./reconcile.js";
import { financialYearOf, fyLabel } from "./property.js";

export var PLAN_KINDS = [
  { key: "emergency", label: "Emergency fund" },
  { key: "save", label: "Save an amount" },
  { key: "debt", label: "Pay off a card or loan" }
];
export var EMERGENCY_CHOICES = [3, 6, 12];

function r2(n){ return Math.round(n * 100) / 100 || 0; }

// The monthly surplus the plan shares: the lower of the budget's and last year's actual. { planned, actual (or null
// when last year had nothing coming in), monthly (never below 0), basis: "planned" | "actual" }.
export function planSurplus(today, opts){
  opts = opts || {};
  var planned = 0;
  try { planned = scenarioTotals(currentScenario()).regularNetMonthly || 0; } catch(e){ planned = 0; }
  var actual = null;
  try {
    var y = reviewYear(today, state.yearBasis, null);
    var r = reconcileYear(y.w, { today: today, classOf: opts.classOf, budgetLines: opts.budgetLines });
    if(r.moneyIn > 0) actual = r.kept / 12;
  } catch(e){ actual = null; }
  var useActual = actual != null && actual < planned;
  var monthly = Math.max(0, useActual ? actual : planned);
  return { planned: r2(planned), actual: actual == null ? null : r2(actual), monthly: r2(monthly), basis: useActual ? "actual" : "planned" };
}

// The year the plan is for: the household year under way.
export function planYearLabel(today){
  return state.yearBasis === "calendar" ? today.slice(0, 4) : fyLabel(financialYearOf(today));
}

// Accounts a goal can sit on, by kind: an emergency fund or savings on money accounts, a payoff on what's owed.
export function planAccounts(kind){
  var owed = { credit: true, loan: true };
  return (state.accounts || []).filter(function(a){
    if(!a || a.type === "agent") return false;
    return kind === "debt" ? !!owed[a.type] : !owed[a.type];
  }).map(function(a){ return a.name; });
}

// A draft as a goal: { goal: { id, name, target, by, accounts }, problem: "" | what's missing }.
// draft: { id, kind, months?, name?, amount?, by?, accounts?, account? }
export function draftGoal(d, today){
  var goal = { id: d.id, name: "", target: 0, by: d.by || "", accounts: [] }, problem = "";
  if(d.kind === "emergency"){
    var ef = null;
    try { ef = emergencyFund({ today: today }); } catch(e){ ef = null; }
    var months = EMERGENCY_CHOICES.indexOf(Number(d.months)) !== -1 ? Number(d.months) : 6;
    goal.name = "Emergency fund — " + months + " months";
    goal.target = ef && ef.monthly > 0 ? r2(ef.monthly * months) : 0;
    goal.accounts = (d.accounts && d.accounts.length ? d.accounts : (state.accounts || []).filter(function(a){ return a && (a.type === "savings" || a.type === "offset"); }).map(function(a){ return a.name; }));
    if(!(goal.target > 0)) problem = "Mark the budget lines you couldn't stop paying as Needs first, so the fund has a size.";
    else if(!goal.accounts.length) problem = "Add a savings or offset account for the fund to sit in.";
  } else if(d.kind === "debt"){
    goal.name = "Pay off " + (d.account || "a debt");
    goal.target = 0;
    goal.accounts = d.account ? [d.account] : [];
    if(!d.account) problem = "Choose the card or loan.";
  } else {
    goal.name = String(d.name || "").trim() || "Savings goal";
    goal.target = Number(d.amount) > 0 ? r2(Number(d.amount)) : 0;
    goal.accounts = (d.accounts || []).slice();
    if(!(goal.target > 0)) problem = "Enter the amount to save.";
    else if(!goal.accounts.length) problem = "Choose the account it builds up in.";
  }
  if(!problem && !goal.by) problem = "Choose the date to reach it by.";
  else if(!problem && goal.by <= today) problem = "Choose a date after today.";
  return { goal: goal, problem: problem };
}

// The month a balance gets there at `monthly` a month, from today: "YYYY-MM", or null when it never does.
function reachMonth(today, left, monthly){
  if(!(monthly > 0)) return null;
  var n = Math.ceil(left / monthly);
  var d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// The surplus shared in order. rows: [{ id, kind, name, target, by, current, left, needed, given, status, reach,
// problem }] — status "done" (already there), "funded", "partial", "unfunded", or "problem" (a draft that isn't
// complete, which takes nothing).
export function allocatePlan(drafts, surplusMonthly, today){
  var remaining = Math.max(0, Number(surplusMonthly) || 0);
  var rows = drafts.map(function(d){
    var g = draftGoal(d, today);
    var row = { id: d.id, kind: d.kind, name: g.goal.name, target: g.goal.target, by: g.goal.by, accounts: g.goal.accounts, current: 0, left: 0, needed: 0, given: 0, status: "problem", reach: null, problem: g.problem };
    if(g.problem) return row;
    var s = goalStatus(g.goal, today);
    row.current = s.current; row.left = s.left;
    if(s.missing.length){ row.problem = "No balance recorded for " + s.missing.join(", ") + "."; return row; }
    if(s.left <= 0){ row.status = "done"; return row; }
    row.needed = r2(s.neededMonthly || 0);
    row.given = r2(Math.min(row.needed, remaining));
    remaining = r2(remaining - row.given);
    row.status = row.given >= row.needed - 0.005 ? "funded" : row.given > 0 ? "partial" : "unfunded";
    row.reach = row.status === "funded" ? null : reachMonth(today, s.left, row.given);
    return row;
  });
  var used = rows.reduce(function(s, r){ return s + r.given; }, 0);
  return { rows: rows, surplus: r2(Math.max(0, Number(surplusMonthly) || 0)), used: r2(used), left: r2(remaining) };
}

// Adds each complete row as a savings goal, with what the plan gave it a month and the year it's for. Returns the
// goals added. The caller saves with commit(["savingsGoals"]).
export function savePlan(plan, today){
  var year = planYearLabel(today);
  return plan.rows.filter(function(r){ return r.status !== "problem" && r.status !== "done"; }).map(function(r){
    var g = addSavingsGoal({ name: r.name, target: r.target, by: r.by, accounts: r.accounts });
    g.plannedMonthly = r.given;
    g.planYear = year;
    // #400 measures progress from here: the day it was saved and the balance its accounts held.
    g.planFrom = today;
    g.planStart = r.current;
    return g;
  });
}
