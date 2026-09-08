import { state } from "../state.js";
import { periodsOf, resolveSharedAmount, resolvedDueMonth, freqStepMonths } from "./ledger.js";
import { effectiveIncomeItems } from "./tax.js";
import { ipProperties, ipLoansMonthly } from "./property.js";

// ---------------- 12-month cash flow forecast ----------------
// Every other total in this app (scenarioTotals, the sticky-header "Monthly Cash" figure, the
// Actual vs. planned panel) smooths every item — whatever its frequency
// alike — into a flat monthly-equivalent average. That's the right number for "what does this
// cost per month on average", but it hides real shape: a Yearly house-insurance bill or a Yearly
// bonus doesn't actually land evenly across 12 months, it lands once, in one specific month. This
// forecast instead classifies every income/expense item into one of three buckets and only
// smooths the ones that are actually smooth:
//   - "lumpy"   — anything billed less often than monthly (Quarterly, Half-yearly, Yearly), not
//                 marked irregular, with a resolvable due month (explicit
//                 or inferred — see resolvedDueMonth()). Placed at full amount in its real
//                 month(s), not smoothed at all.
//   - "reserve" — marked item.irregular (Extras, misc, property maintenance — spends that happen
//                 but on no predictable schedule). Smoothed into every month as a savings-style
//                 set-aside, same as before, since there's no real month to place it in.
//   - "baseline"— everything else (Weekly/Fortnightly/Monthly items, and any lumpy-frequency
//                 item with no resolvable due month yet) — smoothed, same as scenarioTotals().
function monthlyEquivalent(amount, freq){ return periodsOf(amount, freq).monthly; }

function classifyItem(item, transactions){
  if(item.irregular) return "reserve";
  if(freqStepMonths(item.freq) > 1){
    return resolvedDueMonth(item, transactions) ? "lumpy" : "baseline";
  }
  return "baseline";
}
function toEntries(list, side, transactions){
  return list.map(function(item){
    return {
      what: item.what, side: side, amount: Number(item.amount) || 0, freq: item.freq,
      dueMonth: resolvedDueMonth(item, transactions), bucket: classifyItem(item, transactions)
    };
  });
}
// Gathers every ledger item that feeds cash flow for the given scenario — income (already netted
// of tax via effectiveIncomeItems(), so Gross rows aren't double-counted against their own
// synthetic net row), shared expenses (respecting any scenario override), this scenario's home
// costs, and each investment property's own expenses (matching ipExpensesMonthly()'s scope).
// Deliberately does NOT also walk each property's own p.income rows: effectiveIncomeItems()
// already carries a synthetic "<property> — Rent" row per IP (always Monthly, recalculated from
// sumField(p.income, "monthly") by recalcComputedItems() — see calc/engine.js) which is what
// every other total in this app treats as "the" rent figure; including the raw p.income rows
// here too would double-count it. Loan repayments are always Monthly and never lumpy, so they're
// added as a straight baseline total below rather than walked item-by-item.
function collectCashFlowEntries(scenario){
  var txns = state.transactions;
  var sharedResolved = state.shared.map(function(item){
    var amt = resolveSharedAmount(item, scenario);
    return amt === item.amount ? item : Object.assign({}, item, { amount: amt });
  });
  var entries = toEntries(effectiveIncomeItems(), "income", txns)
    .concat(toEntries(sharedResolved, "expense", txns))
    .concat(toEntries(state.home[scenario] || [], "expense", txns));
  ipProperties().forEach(function(p){
    entries = entries.concat(toEntries(p.expenses, "expense", txns));
  });
  return entries;
}
// True when a lumpy item's cycle includes the given calendar month (1-12): every step-th month
// counting from its own due month. Yearly needs no special case — a step of 12 can only ever hit
// the due month itself.
function lumpyHitsMonth(entry, monthNum){
  var step = freqStepMonths(entry.freq);
  return ((monthNum - entry.dueMonth) % step + step) % step === 0;
}
export function monthlyCashFlowForecast(monthsAhead){
  monthsAhead = monthsAhead || 12;
  var entries = collectCashFlowEntries(state.activeScenario);
  var baselineIncome = 0, baselineExpense = 0, reserveIncome = 0, reserveExpense = 0;
  var lumpyEntries = [];
  entries.forEach(function(e){
    if(e.bucket === "lumpy"){ lumpyEntries.push(e); return; }
    var m = monthlyEquivalent(e.amount, e.freq);
    if(e.bucket === "reserve"){
      if(e.side === "income") reserveIncome += m; else reserveExpense += m;
    } else if(e.side === "income") baselineIncome += m; else baselineExpense += m;
  });
  // Loan repayments (this scenario's home loan is already in state.home[scenario] above as a
  // regular row; investment-property loans are a separate, always-Monthly total scenarioTotals()
  // also adds on top of ipExpensesMonthly()) are always Monthly and never lumpy/irregular, so
  // they belong in the baseline as a straight addition rather than needing their own per-item
  // "entry" — matches ipLoansMonthly()'s own existing scope exactly, so this forecast's baseline
  // agrees with scenarioTotals()'s netMonthly rather than silently omitting a real cost.
  baselineExpense += ipLoansMonthly();
  var baselineNet = baselineIncome - baselineExpense + reserveIncome - reserveExpense;
  var today = new Date();
  var months = [];
  for(var i = 0; i < monthsAhead; i++){
    var d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    var monthNum = d.getMonth() + 1;
    var hitting = lumpyEntries.filter(function(e){ return lumpyHitsMonth(e, monthNum); });
    var lumpyIncome = hitting.filter(function(e){ return e.side === "income"; }).reduce(function(s, e){ return s + e.amount; }, 0);
    var lumpyExpense = hitting.filter(function(e){ return e.side === "expense"; }).reduce(function(s, e){ return s + e.amount; }, 0);
    months.push({
      year: d.getFullYear(), month: monthNum,
      net: Math.round((baselineNet + lumpyIncome - lumpyExpense) * 100) / 100,
      items: hitting.map(function(e){ return { what: e.what, side: e.side, amount: e.amount }; })
    });
  }
  return {
    baselineNet: Math.round(baselineNet * 100) / 100,
    reserveIncome: Math.round(reserveIncome * 100) / 100,
    reserveExpense: Math.round(reserveExpense * 100) / 100,
    months: months
  };
}
