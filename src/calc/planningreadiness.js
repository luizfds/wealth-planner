import { dueAfterDays, PROPERTY_DUE_DAYS } from "./estimates.js";

// Pure, non-blocking planning readiness: a profile can be useful before every field is filled.
// "Missing" means no record was entered, not that the household has no assets or debts.
export function planningReadiness(s, today){
  s = s || {};
  const current = typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : "";
  const assets = (s.assets || []).length + (s.properties || []).length;
  const loans = (s.debts || []).length + (s.properties || []).reduce(function(n,p){ return n + ((p && p.loans) || []).length; }, 0);
  const goals = (s.goals || []).length + (s.savingsGoals || []).length +
    (s.fire && Number(s.fire.retireAge) > 0 ? 1 : 0);
  const steps = [
    { key: "income", label: "Income", done: (s.income || []).length > 0, page: "expenses", sub: "income" },
    { key: "expenses", label: "Expenses", done: (s.shared || []).length > 0 || (s.transactions || []).length > 0, page: "expenses", sub: "budget" },
    { key: "assets", label: "Assets and property", done: assets > 0, page: "networth" },
    { key: "loans", label: "Loans and debts", done: loans > 0, page: "networth", optional: true },
    { key: "goals", label: "Goals", done: goals > 0, page: "plan", sub: "goals", optional: true }
  ];
  const done = steps.filter(function(x){ return x.done; }).length;
  const saved = typeof s.savedAt === "string" ? s.savedAt.slice(0,10) : "";
  const stale = !!(saved && current && /^\d{4}-\d{2}-\d{2}$/.test(saved) &&
    (Date.parse(current + "T00:00:00Z") - Date.parse(saved + "T00:00:00Z")) > 90 * 86400000);
  return { steps, done, total: steps.length, complete: done === steps.length,
    missing: steps.filter(function(x){ return !x.done; }).map(function(x){ return x.label; }),
    stale, savedAt: saved || null };
}
export function reportDisclosure(s, today, rep){
  const readiness = planningReadiness(s, today);
  const assumptions = [
    "Figures are calculated from recorded and modelled inputs; they are not guaranteed outcomes.",
    "A missing entry does not mean its true balance or cash flow is zero.",
    "Budgets and forecasts may use estimated frequencies, growth rates, tax rules or scenario assumptions.",
    "Imported transactions and asset prices may be incomplete or out of date."
  ];
  const warnings = readiness.missing.length ? ["Unentered sections: " + readiness.missing.join(", ") + "."] : [];
  if(readiness.stale) warnings.push("Last saved data is more than 90 days old; review values before making decisions.");
  // A recent save is not evidence that a valuation was recently verified.
  const valuations = (s.assets || []).map(function(a){ return { row: a, due: dueAfterDays(a, today) }; })
    .concat((s.properties || []).map(function(p){ return { row: p, due: PROPERTY_DUE_DAYS }; }));
  const outdated = valuations.filter(function(v){
    if(v.due == null) return false;
    const history = (v.row.history || []).filter(function(h){ return h && h.date; });
    const last = history.length ? history[history.length - 1].date : null;
    const age = last ? (Date.parse(today + "T00:00:00Z") - Date.parse(last + "T00:00:00Z")) / 86400000 : NaN;
    return !Number.isFinite(age) || age < 0 || age >= v.due;
  }).length;
  if(outdated) warnings.push(outdated + " asset or property valuation(s) are due an update or lack a valid verification date; a recent save does not verify their values.");
  if(rep && rep.note) assumptions.push(String(rep.note));
  return { asOf: today, progress: readiness.done + "/" + readiness.total,
    lastSaved: readiness.savedAt || "Not available", warnings, assumptions };
}
export function reportDisclosureRows(info){
  return [
    ["Report metadata", "Value"],
    ["As of", info.asOf],
    ["Profile sections entered", info.progress],
    ["Last saved", info.lastSaved],
    ...info.warnings.map(function(x){ return ["Data quality", x]; }),
    ...info.assumptions.map(function(x){ return ["Assumption / limitation", x]; })
  ];
}
