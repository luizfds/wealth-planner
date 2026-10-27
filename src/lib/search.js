import { state } from "../state.js";
import { fmtCurrency0 } from "./format.js";
import { transactionDisplayName } from "../calc/ledger.js";

// Cross-page search over the app's main named records. Nothing here is indexed/cached — every
// call rebuilds the list fresh from `state`, which is fine at the sizes this app deals with (a
// household's expenses/transactions/assets, not a database) and means results are never stale.
// A household with months of transactions and a dozen-plus budget lines spread across Income,
// Expenses, Assets and Properties otherwise has no way to find "that $85 charge" except knowing
// which page to look on — this exists to remove that "which page was it on" step entirely.
//
// Each result carries enough to navigate there: `page` (and optionally `sub` for an Assets
// category, or `scrollToId` for a DOM id to scroll to once on that page) — see app.js's
// search-result click handler for how these get interpreted. Row-level scroll targeting is only
// wired up for Properties today (its cards already have stable ids from the portfolio-overview
// jump-nav) — everywhere else a match still gets you to the right page/subpage, just not
// scrolled to the exact row, since most of the other record types have no stable per-row DOM id
// to target yet.
export function searchApp(query){
  var q = (query || "").trim().toLowerCase();
  if(!q) return [];
  var results = [];
  function add(type, label, sublabel, page, extra){
    if(!label || label.toLowerCase().indexOf(q) === -1) return;
    results.push({ type: type, label: label, sublabel: sublabel || "", page: page, extra: extra || {} });
  }

  // Housing lives in state.home keyed by scenario, and an investment property's costs live on the
  // property, but both are listed on the Budget tab alongside state.shared — so both are
  // searchable on the same terms. Mirrors expenses.js's budgetLineItems() without importing a
  // component into lib/; keep the two in step.
  function budgetLines(){
    var lines = (state.shared || []).concat(state.home && state.home[state.activeScenario] || []);
    (state.properties || []).forEach(function(p){
      if(p.kind === "IP" && Array.isArray(p.expenses)) lines = lines.concat(p.expenses);
    });
    return lines;
  }
  // sub + lineId, because "expenses" alone is no longer a destination: the page has two subtabs and
  // its budget groups start collapsed, so landing on it without both leaves the thing you searched
  // for off-screen inside a closed card, with nothing saying where it went.
  budgetLines().forEach(function(item){
    add("Expense", item.what, fmtCurrency0.format(Number(item.amount) || 0) + " " + (item.freq || "").toLowerCase(),
      "expenses", item.id ? { sub: "budget", lineId: item.id, detail: { kind: "line", id: item.id } } : { sub: "budget", lineId: item.id });
  });
  (state.transactions || []).forEach(function(t){
    // Indexed by its display name, not t.what: a transaction logged against "Groceries" with no
    // description of its own is still expected to turn up when you search "groceries".
    // Transactions are listed on the Spending subtab, not Budget — without naming it, searching a
    // transaction took you to whichever subtab happened to be open, usually the one that doesn't
    // list transactions at all.
    add("Transaction", transactionDisplayName(t, budgetLines()), (t.date || "") + " · " + fmtCurrency0.format(Number(t.amount) || 0),
      "expenses", { sub: "spending" });
  });
  (state.income || []).forEach(function(i){
    add("Income", i.what, (i.person ? i.person + " · " : "") + fmtCurrency0.format(Number(i.amount) || 0) + " " + (i.freq || "").toLowerCase(), "income");
  });
  (state.assets || []).forEach(function(a){
    add("Asset", a.what, (a.category || "") + " · " + fmtCurrency0.format(Number(a.amount) || 0), "assets", a.id ? { sub: a.category, detail: { kind: "asset", id: a.id } } : { sub: a.category });
  });
  (state.properties || []).forEach(function(p){
    add("Property", p.what, (p.kind || "") + " · " + fmtCurrency0.format(Number(p.value) || 0), "properties", { scrollToId: "property-card-" + p.id, detail: { kind: "property", id: p.id } });
    (p.loans || []).forEach(function(l, i){
      if(l.id) add("Loan", l.what || (p.what || "Property") + " loan" + ((p.loans || []).length > 1 ? " " + (i + 1) : ""), fmtCurrency0.format(Number(l.balance) || 0) + " owed", "properties", { detail: { kind: "loan", id: l.id } });
    });
  });
  (state.debts || []).forEach(function(d){
    add("Debt", d.what, fmtCurrency0.format(Number(d.balance) || 0), "assets", d.id ? { sub: "summary", detail: { kind: "debt", id: d.id } } : { sub: "summary" });
  });
  (state.accounts || []).forEach(function(a){
    add("Account", a.name, ({ everyday: "Everyday account", savings: "Savings account", offset: "Offset account", credit: "Credit card", loan: "Loan" })[a.type] || "Account", "accounts", a.id ? { detail: { kind: "account", id: a.id } } : {});
  });
  // v3.128.0: the people, each to their own page.
  var seen = {};
  (state.income || []).forEach(function(i){
    if(i.incomeType !== "Gross" || !i.person || seen[i.person]) return;
    seen[i.person] = true;
    add("Person", i.person, "Income, tax and super", "tax", { detail: { kind: "person", id: i.person } });
  });

  return results;
}
