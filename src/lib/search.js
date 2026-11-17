import { state } from "../state.js";
import { fmtCurrency0, fmtDate } from "./format.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { currentScenario } from "../calc/engine.js";

// Computed income rows are regenerated, so their source identity outlives any row object.
export function incomeSearchId(row){
  var fields = ["syntheticNetFor", "syntheticRentForProperty", "syntheticOneOffFor", "syntheticEndingFor", "syntheticRefundFor"];
  var field = fields.find(function(key){ return row[key]; });
  return field ? "computed:" + JSON.stringify([field, row[field]]) : row.id || null;
}

// Rebuild destinations from current state; callers retain the stable key shown on screen.
// Never resolve a rendered result by its position in a newly computed list.
function searchEntries(){
  var results = [];
  function add(type, label, sublabel, page, extra){
    if(!label) return;
    extra = extra || {};
    var target = extra.detail;
    var key = target && target.id ? JSON.stringify([target.kind, target.id]) : null;
    results.push({ key: key, type: type, label: label, sublabel: sublabel || "", page: page, extra: extra });
  }

  // Housing lives in state.home keyed by scenario, and an investment property's costs live on the
  // property, but both are listed on the Budget tab alongside state.shared — so both are
  // searchable on the same terms. Mirrors expenses.js's budgetLineItems() without importing a
  // component into lib/; keep the two in step.
  function budgetLines(){
    var lines = (state.shared || []).concat(state.home && state.home[currentScenario()] || []);
    (state.properties || []).forEach(function(p){
      if(p.kind === "IP" && Array.isArray(p.expenses)) lines = lines.concat(p.expenses);
    });
    return lines;
  }
  // Details exposes the exact line even when its Budget group is collapsed.
  // Keep the source destination for the detail page's edit/reveal flow.
  var lines = budgetLines();
  lines.forEach(function(item){
    add("Expense", item.what, fmtCurrency0.format(Number(item.amount) || 0) + " " + (item.freq || "").toLowerCase() + (item.account ? " · " + item.account : ""),
      "expenses", item.id ? { sub: "budget", lineId: item.id, detail: { kind: "line", id: item.id } } : { sub: "budget", lineId: item.id });
  });
  (state.transactions || []).forEach(function(t){
    // Indexed by its display name, not t.what: a transaction logged against "Groceries" with no
    // description of its own is still expected to turn up when you search "groceries".
    // A dated Details destination avoids changing Spending filters to expose an older record.
    var linked = lines.find(function(l){ return l.id === t.linkedExpenseId; });
    var account = (t.account || "").trim() || (linked && linked.account) || "";
    add("Transaction", transactionDisplayName(t, lines), fmtDate(t.date, { year: true }) + " · " + fmtCurrency0.format(Number(t.amount) || 0) + (account ? " · " + account : ""),
      "expenses", { sub: "spending", detail: t.id ? { kind: "transaction", id: t.id } : null });
  });
  (state.income || []).forEach(function(i){
    var incomeId = incomeSearchId(i);
    add("Income", i.what, (i.person || i.syntheticNetFor ? (i.person || i.syntheticNetFor) + " · " : "") + fmtCurrency0.format(Number(i.amount) || 0) + " " + (i.freq || "").toLowerCase(), "income", { detail: incomeId ? { kind: "income", id: incomeId } : null });
  });
  (state.assets || []).forEach(function(a){
    add("Asset", a.what, (a.category || "") + " · " + fmtCurrency0.format(Number(a.amount) || 0) + (a.person ? " · " + a.person : ""), "assets", a.id ? { sub: a.category, detail: { kind: "asset", id: a.id } } : { sub: a.category });
  });
  (state.properties || []).forEach(function(p){
    add("Property", p.what, (p.kind || "") + " · " + fmtCurrency0.format(Number(p.value) || 0), "properties", { scrollToId: "property-card-" + p.id, detail: { kind: "property", id: p.id } });
    (p.loans || []).forEach(function(l, i){
      if(l.id) add("Loan", l.what || (p.what || "Property") + " loan" + ((p.loans || []).length > 1 ? " " + (i + 1) : ""), (p.what || "Property") + " · " + fmtCurrency0.format(Number(l.balance) || 0) + " owed", "properties", { detail: { kind: "loan", id: l.id } });
    });
  });
  (state.debts || []).forEach(function(d){
    add("Debt", d.what, fmtCurrency0.format(Number(d.balance) || 0), "accounts", d.id ? { detail: { kind: "debt", id: d.id } } : {});   // #413: debts are on Accounts
  });
  (state.accounts || []).forEach(function(a){
    add("Account", a.name, ({ everyday: "Everyday account", savings: "Savings account", offset: "Offset account", credit: "Credit card", loan: "Loan" })[a.type] || "Account", "accounts", a.id ? { detail: { kind: "account", id: a.id } } : {});
  });
  // v3.128.0: the people, each to their own page.
  var seen = Object.create(null);
  (state.income || []).forEach(function(i){
    if(i.incomeType !== "Gross" || !i.person || seen[i.person]) return;
    seen[i.person] = true;
    add("Person", i.person, "Income, tax and super", "tax", { detail: { kind: "person", id: i.person } });
  });

  (state.scenarios || []).forEach(function(name){
    add("Scenario", name, (state.scenarioNotes || {})[name] || "Planned monthly cash flow", "plan", { detail: { kind: "scenario", id: name } });
  });
  [
    { key: "action:import", label: "Import data", sublabel: "Bank, loan, broker, property, payslip, prices, spreadsheet or backup", page: "expenses", extra: { importChooser: true } },
    { key: "action:reports", label: "Reports", sublabel: "View reports and choose a download", page: "reports" },
    { key: "action:rules", label: "Import rules", sublabel: "Manage statement matching rules in Settings", page: "settings", extra: { sub: "rules" } },
    { key: "action:calculators", label: "Calculators", sublabel: "Explore purchase and investment calculations", page: "calc" }
  ].forEach(function(action){ results.push(Object.assign({ type: "Action", extra: {} }, action)); });
  return results;
}

export function searchApp(query){
  var q = (query || "").trim().toLowerCase();
  if(!q) return [];
  return searchEntries().filter(function(r){ return (r.label + " " + r.sublabel).toLowerCase().indexOf(q) !== -1; });
}

export function resolveSearchResult(key){
  if(!key) return null;
  return searchEntries().find(function(r){ return r.key === key; }) || null;
}
