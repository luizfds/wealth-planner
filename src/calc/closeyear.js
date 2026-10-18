import { periodsOf, appendHistorySnapshot } from "./ledger.js";
import { rentalSchedule, rentLineFor, RENT_LINES } from "./taxyear.js";
import { fyWindow } from "./property.js";

// ---------------- Close the year (v3.48.0) ----------------
//
// Once a year's figures are in — the agent's summary typed over the rental schedule, a year of
// transactions logged against the budget — the plan for next year should start from what actually
// happened rather than from last year's guesses. This compares the two line by line and, for the
// lines picked, rewrites the plan's amounts, keeping the old amount in each row's history.
//
// Pure: takes the state pieces it needs, returns plain data, and the apply functions mutate only
// the rows they're handed.

// Lines the plan can't set directly: interest comes from the loans, borrowing costs from their
// settlement papers, depreciation from the QS schedule. They're compared, but not applied.
var DERIVED = ["interest", "borrowing", "capitalWorks", "capitalAllowances"];

function yearlyOf(row){ return periodsOf(Number(row.amount) || 0, row.freq).yearly; }
function perYear(freq){ return periodsOf(1, freq || "Yearly").yearly || 1; }
function round2(n){ return Math.round(n * 100) / 100; }

// The rental schedule's actuals against the rows behind each line.
export function rentalComparison(property, fy){
  var sch = rentalSchedule(property, fy);
  return sch.lines.filter(function(l){ return l.actual != null && (l.actual || l.model); }).map(function(l){
    var rows = l.key === "rent" ? (property.income || []).map(function(r, i){ return i; })
      : (property.expenses || []).map(function(r, i){ return { r: r, i: i }; })
          .filter(function(x){ return !x.r.computed && rentLineFor(x.r) === l.key; }).map(function(x){ return x.i; });
    // A line fed by a computed row (the agent's fee, worked out from the rent) is set where that
    // row is computed, not here — adding a row for it would count the fee twice.
    var computedFeeds = l.key !== "rent" && (property.expenses || []).some(function(r){ return r.computed && rentLineFor(r) === l.key; });
    var derived = DERIVED.indexOf(l.key) !== -1 || l.key === "otherIncome" || computedFeeds;
    var action = derived ? null : rows.length ? "set" : (l.actual > 0 && !l.income ? "add" : null);
    return { key: l.key, label: l.label, income: l.income, planned: l.model, actual: l.actual,
      diff: round2(l.actual - l.model), rows: rows, action: action };
  });
}

// Sets each picked line's rows to the year's actual — spread across several rows in proportion to
// what they were — or adds a yearly row for a line the plan had nothing for.
export function applyRentalComparison(property, fy, keys, today){
  var changed = 0;
  rentalComparison(property, fy).forEach(function(c){
    if(keys.indexOf(c.key) === -1 || !c.action) return;
    var list = c.key === "rent" ? property.income : property.expenses;
    if(c.action === "add"){
      var label = (RENT_LINES.find(function(l){ return l.key === c.key; }) || {}).label || "Other expenses";
      list.push({ what: label, amount: round2(c.actual), freq: "Yearly", rentLine: c.key, classification: "Wants", category: "Investment property", account: "" });
      changed++;
      return;
    }
    var rows = c.rows.map(function(i){ return list[i]; });
    var total = rows.reduce(function(s, r){ return s + yearlyOf(r); }, 0);
    rows.forEach(function(r){
      var share = total > 0 ? yearlyOf(r) / total : 1 / rows.length;
      setYearly(r, c.actual * share, fy, today);
      changed++;
    });
  });
  return changed;
}

function setYearly(row, yearly, fy, today){
  if(!Array.isArray(row.history)) row.history = [];
  // Keep where it was: with no history yet, the old amount is recorded as of the closed year's start.
  if(!row.history.length) row.history.push({ date: fyWindow(fy).start, value: Number(row.amount) || 0 });
  row.amount = round2(yearly / perYear(row.freq));
  appendHistorySnapshot(row.history, row.amount, today);
}

// Months of the year the transactions actually cover — logging that started in October covers
// nine months, and a raw total would read as a 25% underspend on every line.
export function loggedMonths(transactions, fy, today){
  var w = fyWindow(fy);
  var dates = (transactions || []).map(function(t){ return t.date; }).filter(function(d){ return d && d >= w.start && d <= w.end; }).sort();
  if(!dates.length) return 0;
  var start = dates[0] > w.start ? dates[0] : w.start;
  var end = today && today < w.end ? today : w.end;
  var months = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(end.slice(5, 7)) - Number(start.slice(5, 7))) + 1;
  return Math.max(1, Math.min(12, months));
}

// Budget lines against what was logged to them in the year, scaled up to twelve months when the
// logging covered fewer. Only lines that had anything logged — a line with no transactions says
// nothing about whether its plan was right.
export function budgetComparison(items, transactions, fy, today){
  var w = fyWindow(fy);
  var months = loggedMonths(transactions, fy, today);
  var byLine = {};
  (transactions || []).forEach(function(t){
    if(!t.linkedExpenseId || !t.date || t.date < w.start || t.date > w.end) return;
    byLine[t.linkedExpenseId] = (byLine[t.linkedExpenseId] || 0) + (Number(t.amount) || 0);
  });
  var rows = (items || []).filter(function(i){ return i.id && !i.computed && byLine[i.id] != null; }).map(function(i){
    var logged = round2(byLine[i.id]);
    // Scaled only for something paid through the year; a yearly or quarterly bill logged once in
    // nine months is a whole year's (or quarter's) bill, not three-quarters of one.
    var frequent = ["Weekly", "Fortnightly", "Monthly"].indexOf(i.freq) !== -1;
    var actual = months && frequent ? round2(logged * 12 / months) : logged;
    var planned = round2(yearlyOf(i));
    return { id: i.id, what: i.what || "Line", planned: planned, logged: logged, actual: actual, diff: round2(actual - planned),
      off: planned > 0 ? Math.abs(actual - planned) / planned : 1 };
  });
  return { months: months, rows: rows };
}

// The household's own budget lines: a property's costs are budget lines too, but they're closed
// through its rental schedule, where the agent's summary is the better figure.
export function householdBudgetLines(items, properties){
  var propIds = {};
  (properties || []).forEach(function(p){ (p.expenses || []).forEach(function(e){ if(e.id) propIds[e.id] = true; }); });
  return (items || []).filter(function(i){ return !propIds[i.id]; });
}
export function applyBudgetComparison(items, transactions, fy, ids, today){
  var cmp = budgetComparison(items, transactions, fy, today);
  var changed = 0;
  cmp.rows.forEach(function(r){
    if(ids.indexOf(r.id) === -1) return;
    var item = items.find(function(i){ return i.id === r.id; });
    if(!item) return;
    setYearly(item, Math.max(0, r.actual), fy, today);
    changed++;
  });
  return changed;
}
