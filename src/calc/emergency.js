import { state } from "../state.js";
import { periodsOf, resolveSharedAmount, isActiveOn, sumField } from "./ledger.js";
import { ipProperties, loanRepaymentMonthly, propertiesOffsetTotal, loanPaidOut } from "./property.js";
import { toAudAmount, currentScenario } from "./engine.js";
import { scenarioIncomeRows } from "./tax.js";
import { localDateStr } from "../lib/format.js";

// ---------------- How big an emergency fund should be (v3.94.0) ----------------
//
// An emergency fund carries the household through a stretch with no pay — a job lost, an illness —
// so it's sized on what has to keep being paid, not on everything: the essentials. Here that's the
// budget lines marked Needs (housing, utilities, groceries, insurance, transport, the pet), the home
// costs of the scenario you're living in, and what the investment property costs beyond the rent it
// keeps bringing in. Trips, eating out and subscriptions marked Wants are left out: they're what
// stops in an emergency.
//
// Each line counts at whichever is higher, its plan or what's actually been spent on it over the
// last twelve months (once at least six months are logged): an emergency fund sized on a groceries
// budget the household doesn't keep is a fund that runs out early.
//
// It's measured against cash and offset balances — money that can be spent tomorrow without selling
// anything. Shares and crypto are left out on purpose: they can be sold, but the point of the fund
// is not having to sell at whatever the market says that week.
// Pure apart from reading state.
function r0(n){ return Math.round(n); }
function r2(n){ return Math.round(n * 100) / 100; }
function shift(iso, months){ var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + months, Number(iso.slice(8, 10))); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

export var EMERGENCY_MONTHS = [3, 6, 12];
export function emergencyMonthsChoice(){
  var m = Number(state.emergency && state.emergency.months);
  return EMERGENCY_MONTHS.indexOf(m) !== -1 ? m : 6;
}

// What's been spent on each budget line over the last 12 months, and how many months that covers.
function loggedByLine(transactions, today){
  var from = shift(today, -12), out = {}, first = null;
  (transactions || []).forEach(function(t){
    if(!t.linkedExpenseId || !t.date || t.date <= from || t.date > today) return;
    out[t.linkedExpenseId] = (out[t.linkedExpenseId] || 0) + (Number(t.amount) || 0);
    if(!first || t.date < first) first = t.date;
  });
  var months = first ? Math.min(12, Math.max(0, (Date.parse(today) - Date.parse(first)) / (86400000 * 30.44))) : 0;
  return { byLine: out, months: months };
}

export function isEssential(line){ return !!line && line.classification === "Needs"; }

// { lines: [{what, category, planned, actual, counted}], groups: [{category, monthly}], monthly,
//   plannedMonthly, ipShortfall, months, target, available, coveredMonths, perPerson: [...] }
export function emergencyFund(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var scenario = opts.scenario || currentScenario();
  var months = opts.months || emergencyMonthsChoice();
  var logged = loggedByLine(state.transactions, today);
  var useActual = logged.months >= 6;
  var lines = [];
  function add(item, category, amount){
    var planned = periodsOf(amount, item.freq).monthly;
    var actual = useActual && item.id && logged.byLine[item.id] != null ? logged.byLine[item.id] / Math.max(1, logged.months) : null;
    var counted = actual != null ? Math.max(planned, actual) : planned;
    if(!(counted > 0)) return;
    lines.push({ id: item.id || "", what: item.what || "Line", category: category || item.category || "Other", planned: r2(planned), actual: actual == null ? null : r2(actual), counted: r2(counted) });
  }
  (state.shared || []).forEach(function(i){
    if(i.computed || !isEssential(i) || !isActiveOn(i, today)) return;
    add(i, i.category, resolveSharedAmount(i, scenario));
  });
  // The home you live in: rent or the home loan, rates, insurance. Essential unless marked Wants.
  ((state.home || {})[scenario] || []).forEach(function(i){
    if(i.classification === "Wants" || !isActiveOn(i, today)) return;
    add(i, i.category || "Housing", i.amount);
  });
  // An investment property keeps its rent through a job loss; what it costs beyond that rent
  // (repayments, rates, insurance, fees) still has to be found every month.
  var ipShortfall = 0;
  ipProperties().forEach(function(p){
    var rent = sumField(p.income || [], "monthly");
    var costs = sumField((p.expenses || []).filter(function(e){ return isActiveOn(e, today); }), "monthly") +
      (p.loans || []).reduce(function(s, l){ return s + (loanPaidOut(l) ? 0 : loanRepaymentMonthly(l)); }, 0);
    var gap = costs - rent;
    if(gap > 0){
      ipShortfall += gap;
      lines.push({ id: "", what: (p.what || "Investment property") + " — beyond its rent", category: "Investment property", planned: r2(gap), actual: null, counted: r2(gap) });
    }
  });
  var monthly = lines.reduce(function(s, l){ return s + l.counted; }, 0);
  var plannedMonthly = lines.reduce(function(s, l){ return s + l.planned; }, 0);
  var groups = {};
  lines.forEach(function(l){ groups[l.category] = (groups[l.category] || 0) + l.counted; });
  var available = (state.assets || []).filter(function(a){ return a.category === "Cash"; })
    .reduce(function(s, a){ return s + toAudAmount(a, Number(a.amount) || 0); }, 0) + propertiesOffsetTotal();
  // One income stopping, the others carrying on: what the fund then has to cover each month.
  var nets = scenarioIncomeRows({ scenario: scenario }).filter(function(r){ return r.syntheticNetFor; });
  var perPerson = nets.length > 1 ? nets.map(function(r){
    var others = nets.filter(function(x){ return x !== r; }).reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0);
    var draw = Math.max(0, monthly - others);
    return { person: r.syntheticNetFor, othersMonthly: r0(others), drawMonthly: r0(draw), target: r0(draw * months),
      lastsMonths: draw > 0 ? available / draw : null };
  }) : [];
  return {
    months: months, lines: lines.sort(function(a, b){ return b.counted - a.counted; }),
    groups: Object.keys(groups).map(function(k){ return { category: k, monthly: r0(groups[k]) }; }).sort(function(a, b){ return b.monthly - a.monthly; }),
    monthly: r0(monthly), plannedMonthly: r0(plannedMonthly), usedActual: useActual, ipShortfall: r0(ipShortfall),
    target: r0(monthly * months), targets: EMERGENCY_MONTHS.map(function(m){ return { months: m, target: r0(monthly * m) }; }),
    available: r0(available), coveredMonths: monthly > 0 ? available / monthly : null,
    perPerson: perPerson
  };
}
