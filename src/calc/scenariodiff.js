import { state } from "../state.js";
import { scenarioTotals, currentScenario, scenarioLegChanges, scenarioLegContext } from "./engine.js";
import { recalcPurchase } from "./property.js";
import { periodsOf, sumFieldForScenario } from "./ledger.js";
import { scenarioSharedItems, livesElsewhere } from "./scenariochanges.js";
import { legsMonthly } from "./scenariolegs.js";

// ---------------- What a scenario changes each month (item 257) ----------------
//
// Against the household as it is: what the scenario adds to a month's spending and what it takes away, line by line,
// each marked fixed (a loan, rates, insurance, a lease), partly fixed (water, energy — a service charge and use) or
// budgeted (maintenance, a new cost), with how often it's really paid. The lines add up to the difference in the two
// months' spending (scenarioTotals' expensesMonthly); anything the lines don't name is one "Other changes" line, so
// they always do. Then what of a new loan's repayment is principal — kept, as equity — and so what owning costs above
// what it replaces, and what isn't in the month at all. Pure apart from reading state.

function r2(n){ return Math.round(n * 100) / 100; }
// How a cost behaves, from its name: what's set by someone else, what's partly use, what's a budget.
export function costKind(name, isLoan){
  var s = String(name || "").toLowerCase();
  if(isLoan || /\b(loan|mortgage|repayment)\b/.test(s)) return "fixed";
  if(/\b(rent|lease|rates|council|strata|body corp|owners corp|insurance|levy|levies)\b/.test(s)) return "fixed";
  if(/\b(water|electric|electricity|gas|energy|power|internet)\b/.test(s)) return "partly";
  return "budgeted";
}
function line(label, monthly, kind, row){
  var freq = row && row.freq ? String(row.freq) : "Monthly";
  var each = row ? Math.abs(Number(row.amount) || 0) : Math.abs(monthly);
  return { label: label, monthly: r2(monthly), kind: kind, freq: freq, each: r2(each) };
}

export function scenarioMonthlyChange(scenario){
  var base = currentScenario();
  if(!scenario || scenario === base) return null;
  var t = scenarioTotals(scenario), b = scenarioTotals(base);
  var added = [], gone = [];
  // Where it lives: its own home's lines (a home it buys: the repayment synced in, rates, insurance…).
  var cfg = state.purchase && state.purchase[scenario], inv = state.invest && state.invest[scenario];
  var buys = !!(cfg && cfg.enabled && !(inv && inv.enabled));
  (state.home[scenario] || []).forEach(function(r){
    var m = periodsOf(Number(r.amount) || 0, r.freq).monthly;
    if(Math.abs(m) < 0.005) return;
    var isLoan = r.id === "homeLoanRow" && buys;
    added.push(line(isLoan ? "Loan repayment" : (r.what || "Home cost"), m, costKind(r.what, isLoan), r));
  });
  // …and today's home lines (rent, its water) are gone when it lives somewhere else.
  if(livesElsewhere(scenario)){
    scenarioSharedItems(base).filter(function(l){ return l && l.homeCost; }).forEach(function(l){
      var m = sumFieldForScenario([l], base, "monthly");
      if(Math.abs(m) >= 0.005) gone.push(line(l.what || "Home cost", -m, costKind(l.what), l));
    });
  }
  // A budget line it costs differently.
  var mine = {};
  scenarioSharedItems(scenario).forEach(function(l){ if(l && l.id) mine[l.id] = l; });
  scenarioSharedItems(base).forEach(function(l){
    if(!l || !l.id || l.homeCost || !mine[l.id]) return;
    var d = sumFieldForScenario([l], scenario, "monthly") - sumFieldForScenario([l], base, "monthly");
    if(Math.abs(d) < 0.005) return;
    (d > 0 ? added : gone).push(line(l.what || "A budget line", d, costKind(l.what), null));
  });
  // Its own changes: rent somewhere new, a cost, an investment property, extra repayments.
  var legs = scenarioLegChanges(scenario);
  if(legs.length){
    var ctx = scenarioLegContext(scenario);
    legs.forEach(function(c){
      if(c.kind === "once" || c.kind === "sell" || (c.endMonth != null && (c.kind === "rent" || c.kind === "cost"))) return;
      var m = legsMonthly([c], ctx).expensesMonthly;
      if(Math.abs(m) < 0.005) return;
      var label = c.kind === "rent" ? (c.what || "Rent") : c.kind === "ip" ? (c.what || "Investment property") + " — its loan and costs"
        : c.kind === "extra" ? "Extra loan repayments" : (c.what || "A new cost");
      var kind = c.kind === "rent" || c.kind === "ip" ? "fixed" : c.kind === "extra" ? "budgeted" : costKind(c.what);
      (m > 0 ? added : gone).push(line(label, m, kind, c.kind === "ip" ? null : c));
    });
  }
  // An interest-only loan's emptied offset (item 256): its repayment rises.
  if(t.drawInterestMonthly > 0.005) added.push(line("Interest on cash taken from an offset", t.drawInterestMonthly, "fixed", null));
  var extra = t.expensesMonthly - b.expensesMonthly;
  var listed = added.concat(gone).reduce(function(s, x){ return s + x.monthly; }, 0);
  if(Math.abs(extra - listed) >= 0.5) (extra - listed > 0 ? added : gone).push(line("Other changes", extra - listed, "budgeted", null));
  // Of the new loan's repayment, what pays it down in the first year: the month's interest on the whole balance.
  var principal = 0, price = 0;
  if(buys){
    var p = recalcPurchase(scenario);
    price = p ? p.price : 0;
    var repay = added.filter(function(x){ return x.label === "Loan repayment"; }).reduce(function(s, x){ return s + x.monthly; }, 0);
    if(p && repay > 0 && cfg.repaymentType !== "IO") principal = Math.max(0, repay - p.loanBalance * (Number(cfg.rate) || 0) / 1200);
  }
  // Maintenance a home this price is likely to need: half a percent of its value a year at the least.
  var maint = added.filter(function(x){ return /maint|repair/i.test(x.label); }).reduce(function(s, x){ return s + x.monthly; }, 0);
  var light = price > 0 && maint * 12 < price * 0.005 ? { yearly: r2(maint * 12), floorYearly: Math.round(price * 0.005), toYearly: Math.round(price * 0.01) } : null;
  var sum = function(list, kind){ return r2(list.filter(function(x){ return !kind || x.kind === kind; }).reduce(function(s, x){ return s + x.monthly; }, 0)); };
  return {
    against: base, added: added, gone: gone,
    addedMonthly: sum(added), goneMonthly: sum(gone), extraMonthly: r2(extra),
    fixedMonthly: sum(added, "fixed"), partlyMonthly: sum(added, "partly"), budgetedMonthly: sum(added, "budgeted"),
    principalMonthly: r2(principal), costAboveMonthly: r2(extra - principal),
    slowerPaydownMonthly: r2((t.drawSlowerPaydownYearly || 0) / 12), taxBackMonthly: r2((t.drawTaxBackYearly || 0) / 12),
    incomeChangeMonthly: r2(t.incomeMonthly - (t.drawTaxBackYearly || 0) / 12 - b.incomeMonthly),
    maintenanceLight: light
  };
}
