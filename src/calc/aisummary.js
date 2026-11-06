import { state } from "../state.js";
import { getTaxPeople, computePersonTax, scenarioIncomeRows } from "./tax.js";
import { ipProperties, loanRateOn, loanPaidOut, loanInvestShare } from "./property.js";
import { scenarioTotals, toAudAmount, totalNetWorthValue, currentScenario } from "./engine.js";
import { periodsOf } from "./ledger.js";
import { emergencyFund } from "./emergency.js";
import { monthFigures, shiftMonth } from "./monthdetail.js";
import { canBuy } from "./canbuy.js";

// ---------------- A summary of the household for a written review (v3.98.0) ----------------
//
// External AI summaries are constructed from fixed, numeric/enum-derived fields only.
// User-entered names, notes, labels, account identifiers and arbitrary free text are excluded.
// Generic labels are pseudonymisation, not anonymisation: even financial combinations can
// identify a household. A separate preview and explicit confirmation are required before sharing.
// Pure apart from reading state.
function m(n){ var v = Math.round(Number(n) || 0); return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-AU"); }
function safeRegion(s){ return ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"].includes(s) ? s : "AU"; }
function pct(n){ return (Math.round(n * 1000) / 10) + "%"; }

// [from, to] pairs, longest first, applied to every line of text that came from the app.
export function anonymiser(st){
  st = st || state;
  var pairs = [];
  var people = getTaxPeople();
  var labels = ["Partner A", "Partner B", "Person C", "Person D"];
  people.forEach(function(n, i){
    var to = labels[i] || ("Person " + (i + 1));
    pairs.push([n, to]);
    // Short forms used in holding names ("IVV (Mari)").
    if(n.length > 4) pairs.push([n.slice(0, 4), to]);
    n.split(/\s+/).forEach(function(part){ if(part.length > 2 && part !== n) pairs.push([part, to]); });
  });
  (st.properties || []).forEach(function(p, i){
    if(p.what) pairs.push([p.what, "Investment property " + (i + 1)]);
    (p.loans || []).forEach(function(l, j){ if(l.what) pairs.push([l.what, "Property " + (i + 1) + " loan " + (j + 1)]); });
  });
  (st.scenarios || []).forEach(function(s, i){ pairs.push([s, "Scenario " + (i + 1)]); });
  (st.accounts || []).forEach(function(a, i){ if(a.name) pairs.push([a.name, "Account " + (i + 1)]); });
  (st.assets || []).forEach(function(a){ if(a.what && a.symbol) pairs.push([a.what, a.symbol]); });
  pairs = pairs.filter(function(p){ return p[0] && p[0].length >= 3; });
  pairs.sort(function(a, b){ return b[0].length - a[0].length; });
  return function(text){
    var s = String(text || "");
    pairs.forEach(function(p){ s = s.split(p[0]).join(p[1]); });
    return s;
  };
}

// The other way, for showing the answer: each label back to the name it stood for, on this device.
export function deanonymiser(st){
  st = st || state;
  var back = [];
  var labels = ["Partner A", "Partner B", "Person C", "Person D"];
  getTaxPeople().forEach(function(n, i){ back.push([labels[i] || ("Person " + (i + 1)), n]); });
  (st.properties || []).forEach(function(p, i){
    if(p.what) back.push(["Investment property " + (i + 1), p.what]);
    (p.loans || []).forEach(function(l, j){ if(l.what) back.push(["Property " + (i + 1) + " loan " + (j + 1), l.what]); });
  });
  (st.scenarios || []).forEach(function(sc, i){ back.push(["Scenario " + (i + 1), sc]); });
  (st.accounts || []).forEach(function(a, i){ if(a.name) back.push(["Account " + (i + 1), a.name]); });
  back.sort(function(a, b){ return b[0].length - a[0].length; });
  return function(text){
    var out = String(text || "");
    back.forEach(function(p){
      var re = new RegExp("\\b" + p[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b(?!\\d)", "g");
      out = out.replace(re, p[1]);
    });
    return out;
  };
}

// The only externally shared fields are aggregate numbers and fixed labels from this
// explicit allowlist. No account, property, loan, holding, person or scenario rows leave.
export const AI_SUMMARY_FIELDS = Object.freeze([
  "householdGrossAnnual", "budgetNeedsMonthly", "budgetWantsMonthly",
  "budgetUnclassifiedMonthly", "housingMonthly", "netWorth",
  "cashAssets", "investmentAssets", "otherAssets",
  "essentialMonthly", "liquidReserve", "findingRiskCount",
  "findingOpportunityCount", "findingGoodCount"
]);

export function aiAggregateSnapshot(findings, opts){
  opts = opts || {};
  var today = opts.today || "";
  var result = Object.fromEntries(AI_SUMMARY_FIELDS.map(function(k){ return [k, 0]; }));
  var income = (state.income || []).filter(function(r){ return r.incomeType === "Gross"; });
  result.householdGrossAnnual = income.reduce(function(sum, r){
    return sum + periodsOf(Number(r.amount) || 0, r.freq).yearly;
  }, 0);
  (state.shared || []).forEach(function(l){
    if(l.computed) return;
    var key = l.classification === "Needs" ? "budgetNeedsMonthly" :
      l.classification === "Wants" ? "budgetWantsMonthly" : "budgetUnclassifiedMonthly";
    result[key] += periodsOf(Number(l.amount) || 0, l.freq).monthly;
  });
  result.housingMonthly = ((state.home || {})[currentScenario()] || []).reduce(function(sum, l){
    return sum + periodsOf(Number(l.amount) || 0, l.freq).monthly;
  }, 0);
  result.netWorth = totalNetWorthValue();
  (state.assets || []).forEach(function(a){
    var amount = toAudAmount(a, Number(a.amount) || 0);
    var key = a.category === "Cash" ? "cashAssets" :
      ["Shares", "Super", "Crypto"].includes(a.category) ? "investmentAssets" : "otherAssets";
    result[key] += amount;
  });
  var ef = null;
  try { ef = emergencyFund({ today: today }); } catch(e){}
  if(ef){
    result.essentialMonthly = Number(ef.monthly) || 0;
    result.liquidReserve = Number(ef.available) || 0;
  }
  (findings || []).forEach(function(a){
    if(a.kind === "risk") result.findingRiskCount++;
    else if(a.kind === "opportunity") result.findingOpportunityCount++;
    else if(a.kind === "good") result.findingGoodCount++;
  });
  // Exclude non-finite outputs instead of transmitting invalid or coerced identifiers.
  return Object.fromEntries(AI_SUMMARY_FIELDS.map(function(k){
    return [k, Number.isFinite(result[k]) ? result[k] : null];
  }));
}

export function householdSummary(findings, opts){
  var data = aiAggregateSnapshot(findings, opts);
  var labels = {
    householdGrossAnnual: "Household gross income / yr",
    budgetNeedsMonthly: "Essential-classified budget / mo",
    budgetWantsMonthly: "Discretionary-classified budget / mo",
    budgetUnclassifiedMonthly: "Unclassified budget / mo",
    housingMonthly: "Current scenario housing budget / mo",
    netWorth: "Net worth",
    cashAssets: "Cash assets",
    investmentAssets: "Investments and super assets",
    otherAssets: "Other assets",
    essentialMonthly: "Estimated essential expenses / mo",
    liquidReserve: "Cash and offset reserve",
    findingRiskCount: "Risk findings (count)",
    findingOpportunityCount: "Opportunity findings (count)",
    findingGoodCount: "Positive findings (count)"
  };
  return [
    "Australian household, AUD. Aggregated planning estimates only.",
    "These figures are pseudonymised, not anonymous; combinations may still identify a household.",
    "No person, property, loan, account, holding, scenario names or free-text notes are included."
  ].concat(AI_SUMMARY_FIELDS.map(function(k){
    return "- " + labels[k] + ": " + (data[k] === null ? "unavailable" :
      k.endsWith("Count") ? String(data[k]) : m(data[k]));
  })).join("\n");
}
