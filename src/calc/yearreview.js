// ---------------- The guided Year in review (#396, 1/5 of #390) ----------------
//
// Reports → Year in review answers a handful of questions about the year that's finished, each with a one-line
// verdict from figures the app already works out, and a link to where it's acted on:
//   money     — what came in, what was spent, what was kept (the report's own sums)
//   networth  — net worth at the start and end of the year (calc/nwhistory.js netWorthOn)
//   leaks     — what Trim finds budgeted above spending, and the subscriptions still charging (calc/trim.js,
//               calc/subscriptions.js)
//   emergency — months of essentials that cash and offsets cover (calc/emergency.js)
//   goals     — where each savings goal stands (calc/savegoals.js)
//   checking  — official tools worth a look; static links only: nothing is looked up or sent, and nothing here says
//               anyone is eligible for anything (owner's decision on #390)
// No new financial maths: every figure is one the app already shows elsewhere. A section without enough data says
// what's missing instead of a $0.
//
// The year follows the household's setting (state.yearBasis): a financial year (the default) or a calendar year.
import { state } from "../state.js";
import { trimReport } from "./trim.js";
import { subscriptionList, subscriptionsYearly, homeLineIds } from "./subscriptions.js";
import { emergencyFund } from "./emergency.js";
import { goalsOverview } from "./savegoals.js";
import { savingsVsOffset, savingsOffsetLines } from "./savingsoffset.js";
import { financialYearOf, fyWindow, fyLabel } from "./property.js";

// The finished year to look back on: the last one before today, or the one the header's period picks when that has
// finished. { w, pw (the year before), fy (the financial year for tax-year figures), calendar }.
export function reviewYear(today, basis, headerWin){
  if(basis === "calendar"){
    var y = Number(today.slice(0, 4)) - 1;
    if(headerWin && headerWin.end < today) y = Number(headerWin.start.slice(0, 4));
    var cal = function(n){ return { start: n + "-01-01", end: n + "-12-31", label: String(n) }; };
    // The financial year that ends in it — 30 June of that calendar year — for distributions, gains and super.
    return { w: cal(y), pw: cal(y - 1), fy: y - 1, calendar: true };
  }
  var fy = financialYearOf(today) - 1;
  if(headerWin && headerWin.end < today) fy = financialYearOf(headerWin.start);
  return { w: fyWindow(fy), pw: fyWindow(fy - 1), fy: fy, calendar: false };
}
export function reviewYearSpan(y){
  return y.calendar ? "1 January to 31 December " + y.w.label : "1 July " + y.fy + " to 30 June " + (y.fy + 1);
}
export function taxYearNote(y){ return y.calendar ? " (" + fyLabel(y.fy) + ", the financial year ending in " + y.w.label + ")" : ""; }

function money(v){ return (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-AU"); }

// Official places worth a look, as links. Owner's decision on #390: no lookups, no eligibility claims.
export var WORTH_CHECKING = [
  { label: "Unclaimed money", detail: "Money held by ASIC from old bank accounts, shares and life policies.", url: "https://moneysmart.gov.au/find-unclaimed-money" },
  { label: "Lost and unclaimed super", detail: "Super the ATO holds, or accounts you've forgotten — through myGov.", url: "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/keeping-track-of-your-super/find-lost-super" },
  { label: "Concessions and payments", detail: "Services Australia's payment and service finder.", url: "https://www.servicesaustralia.gov.au/payment-and-service-finder" }
];

// The guided sections. `f` is what the report already worked out: { tin, tout, pin, pout, start, end } where start
// and end are netWorthOn() results ({ total, partial }) at the day before the year and its last day.
export function yearReviewSections(y, f, today){
  var out = [], label = y.w.label;
  // 1. Where the money went.
  if(f.tin || f.tout){
    // #397: kept as the reconciliation has it — after loan interest, which isn't in Spending — so the headline and
    // "How it adds up" say the same.
    var interest = f.reconcile && f.reconcile.interest ? f.reconcile.interest.total : 0;
    var kept = f.tin - f.tout - interest;
    out.push({ key: "money", title: "Where the money went", tone: kept >= 0 ? "good" : "warn",
      verdict: money(f.tin) + " came in and " + money(f.tout) + " was spent" + (interest ? ", with " + money(interest) + " of loan interest and fees" : "") +
        (f.tin > 0 ? ": " + (kept >= 0 ? money(kept) + " kept, " + Math.round(kept / f.tin * 100) + "% of it." : money(-kept) + " more went out than came in.") : "."),
      detail: f.pin || f.pout ? "The year before: " + money(f.pin) + " in, " + money(f.pout) + " spent." : "", go: "expenses/spending", label: "Go to Spending →",
      reconcile: f.reconcile || null });
  } else out.push({ key: "money", title: "Where the money went", tone: "empty", empty: "Nothing came in or went out in " + label + " that was logged — a bank statement for the year fills this in.", go: "expenses/spending", label: "Go to Spending →" });
  // 2. Net worth.
  var s = f.start, e = f.end;
  // Nothing recorded at either end reads as $0 to $0 — that's a missing year, not a flat one.
  if(s && e && !s.total && !e.total && !s.partial.length && !e.partial.length){
    out.push({ key: "networth", title: "Net worth", tone: "empty", empty: "No balances were recorded for " + label + " — accounts, assets and loans with their balances fill this in.", go: "networth", label: "Go to Net worth →" });
  } else if(s && e && !s.partial.length && !e.partial.length){
    var d = e.total - s.total;
    out.push({ key: "networth", title: "Net worth", tone: d >= 0 ? "good" : "warn",
      verdict: "From " + money(s.total) + " to " + money(e.total) + " — " + (d >= 0 ? "up " : "down ") + money(Math.abs(d)) + ".", go: "networth", label: "Go to Net worth →" });
  } else {
    var missing = [].concat((s && s.partial) || [], (e && e.partial) || []).filter(function(n, i, a){ return n && a.indexOf(n) === i; });
    out.push({ key: "networth", title: "Net worth", tone: "empty",
      empty: "Not every balance was recorded at the start and end of " + label + (missing.length ? " (" + missing.slice(0, 4).join(", ") + (missing.length > 4 ? " and " + (missing.length - 4) + " more" : "") + ")" : "") + ", so the change isn't worked out. Recording balances as the year goes fills this in.",
      go: "networth", label: "Go to Net worth →" });
  }
  // 3. Quiet money leaks — as things stand today.
  var trim = null, subs = [];
  try { trim = trimReport({ today: today }); } catch(err){ trim = null; }
  try { subs = subscriptionList(state.transactions || [], today, state.subscriptionNotes || {}, { homeLines: homeLineIds(state) }).filter(function(x){ return !x.stopped && !x.ignored; }); } catch(err){ subs = []; }
  var subsYearly = subscriptionsYearly(subs), bits = [];
  if(trim && trim.overYearly >= 300) bits.push("the budget plans " + money(trim.overYearly) + " a year more than is spent");
  if(subs.length) bits.push(subs.length + " subscription" + (subs.length === 1 ? "" : "s") + " cost " + money(subsYearly) + " a year");
  if(trim && trim.duplicates && trim.duplicates.length) bits.push(trim.duplicates.length + " kind" + (trim.duplicates.length === 1 ? "" : "s") + " of subscription paid for twice");
  if(bits.length) out.push({ key: "leaks", title: "Quiet money leaks", tone: "info", verdict: "Today, " + bits.join("; ") + ".", detail: "Worth a look before the new year starts.", go: "expenses/budget", label: "Go to Trim →" });
  else if(trim && trim.months >= 3) out.push({ key: "leaks", title: "Quiet money leaks", tone: "good", verdict: "Nothing stands out: the budget matches what's spent, and no repeating charge looks forgotten.", go: "expenses/budget", label: "Go to Trim →" });
  else out.push({ key: "leaks", title: "Quiet money leaks", tone: "empty", empty: "A few months of spending logged against the budget lets Trim find what's planned but not spent, and the subscriptions still charging.", go: "expenses/budget", label: "Go to Trim →" });
  // 4. Emergency fund — today.
  var ef = null;
  try { ef = emergencyFund({ today: today }); } catch(err){ ef = null; }
  if(ef && ef.monthly > 0 && ef.coveredMonths != null){
    var enough = ef.coveredMonths >= ef.months;
    out.push({ key: "emergency", title: "Emergency fund", tone: enough ? "good" : "warn",
      verdict: "Cash and offsets cover about " + (ef.coveredMonths >= 24 ? Math.round(ef.coveredMonths / 12) + " years" : Math.round(ef.coveredMonths * 10) / 10 + " months") + " of essentials today — " +
        (enough ? "at or above the " + ef.months + "-month target." : money(ef.target - ef.available) + " short of " + ef.months + " months (" + money(ef.target) + ")."),
      detail: "3, 6 and 12 months of essentials: " + ef.targets.map(function(t){ return money(t.target); }).join(", ") + ".", go: "plan/goals", label: "Go to the emergency fund →" });
  } else out.push({ key: "emergency", title: "Emergency fund", tone: "empty", empty: "Mark the budget lines you couldn't stop paying as Needs, and record cash balances, to see how many months they'd cover.", go: "expenses/budget", label: "Go to Budget →" });
  // #398: savings account vs offset, under the emergency fund — only where there's a loan to offset.
  var so = null;
  try { so = savingsVsOffset(today); } catch(err){ so = null; }
  if(so && so.offsets.length){
    var emSec = out[out.length - 1];
    emSec.offsetCompare = { best: so.best, offsets: so.offsets, accounts: so.accounts, lines: savingsOffsetLines(so), missing: so.missing };
  }
  // 5. Goals — today.
  var go = null;
  try { go = goalsOverview(today, null); } catch(err){ go = null; }
  if(go && go.goals.length){
    var count = function(st){ return go.goals.filter(function(g){ return st.indexOf(g.status) !== -1; }).length; };
    var done = count(["done"]), ok = count(["on-track", "possible", "moving"]), behind = count(["behind"]), open = go.goals.length - done - ok - behind;
    var parts = [];
    if(done) parts.push(done + " reached");
    if(ok) parts.push(ok + " on track");
    if(behind) parts.push(behind + " behind");
    if(open) parts.push(open + " with no date or pace yet");
    out.push({ key: "goals", title: "Goals", tone: behind ? "warn" : "good", verdict: go.goals.length + " savings goal" + (go.goals.length === 1 ? "" : "s") + ": " + parts.join(", ") + ".",
      detail: go.neededMonthly > 0 ? "Together they need about " + money(go.neededMonthly) + " a month to land on their dates." : "", go: "plan/goals", label: "Go to Goals →" });
  } else out.push({ key: "goals", title: "Goals", tone: "empty", empty: "No savings goals yet — a goal with a date says what to put aside each month.", go: "plan/goals", label: "Set a goal →" });
  // 6. Worth checking.
  out.push({ key: "checking", title: "Worth checking", tone: "info", verdict: "Official places to look for money that's yours — these open the official sites; the app doesn't look anything up or send anything.", links: WORTH_CHECKING });
  return out;
}

// Whether a finished year has anything logged in it — for the "ready" nudge on Home.
export function yearHasData(y){
  var inWin = function(r){ return r && r.date >= y.w.start && r.date <= y.w.end; };
  return (state.transactions || []).some(inWin) || (state.incomeLog || []).some(inWin);
}
