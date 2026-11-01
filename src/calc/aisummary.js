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
// What "Ask Claude" sends: the figures that matter for a review, with everything that identifies
// the household swapped for labels before it leaves — people become Partner A and B, the property
// "Investment property 1" (its state kept, its address and suburb not), scenarios "Scenario 1…",
// accounts "Account 1…", holdings by ticker. Merchants, employers and account numbers are never
// included. The text is shown to the person before it's sent; this builds it, the component sends
// it only on their say-so. Pure apart from reading state.
function m(n){ var v = Math.round(Number(n) || 0); return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-AU"); }
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

export function householdSummary(findings, opts){
  opts = opts || {};
  var today = opts.today || "";
  var scrub = anonymiser(state);
  var L = [];
  var people = getTaxPeople();
  L.push("Australian household. Figures are in AUD, from the planning app's own records.");
  L.push("");
  L.push("INCOME");
  people.forEach(function(n){
    var t = null; try { t = computePersonTax(n); } catch(e){}
    var gross = (state.income || []).filter(function(r){ return r.person === n && r.incomeType === "Gross"; })
      .reduce(function(s, r){ return s + periodsOf(Number(r.amount) || 0, r.freq).yearly; }, 0);
    var net = (scenarioIncomeRows({ scenario: currentScenario() }) || []).find(function(r){ return r.syntheticNetFor === n; });
    L.push("- " + n + ": gross " + m(gross) + "/yr; planned take-home " + (net ? m(net.amount) + "/mo" : "n/a") +
      (t ? "; marginal rate " + pct(t.marginalRate || 0) + "; concessional super " + m(t.totalConcessional) + " of a " + m(t.capAvailable) + " cap (incl. carry-forward)" : ""));
  });
  var cur = String(today).slice(0, 7), inn = 0, out = 0, months = 0;
  for(var i = 1; i <= 12; i++){ var f = monthFigures(state, shiftMonth(cur, -i)); if(f.count || f.in){ months++; inn += f.in; out += f.out; } }
  if(months) L.push("- Logged over the last " + months + " months: " + m(inn) + " in, " + m(out) + " spent (loan repayments drawn from offsets not included in spending).");
  L.push("");
  L.push("SPENDING (budget, monthly)");
  var byCat = {};
  (state.shared || []).forEach(function(l){
    if(l.computed) return;
    var k = (l.classification || "?") + " · " + (l.category || "Other");
    byCat[k] = (byCat[k] || 0) + periodsOf(Number(l.amount) || 0, l.freq).monthly;
  });
  Object.keys(byCat).sort(function(a, b){ return byCat[b] - byCat[a]; }).slice(0, 18).forEach(function(k){ L.push("- " + k + ": " + m(byCat[k])); });
  var home = ((state.home || {})[currentScenario()] || []).reduce(function(s, l){ return s + periodsOf(Number(l.amount) || 0, l.freq).monthly; }, 0);
  L.push("- Housing in the current scenario (rent or home loan and its costs): " + m(home));
  L.push("");
  L.push("ASSETS AND DEBTS");
  L.push("- Net worth: " + m(totalNetWorthValue()));
  var byAsset = {};
  (state.assets || []).forEach(function(a){ var k = a.category || "Other"; byAsset[k] = (byAsset[k] || 0) + toAudAmount(a, Number(a.amount) || 0); });
  Object.keys(byAsset).forEach(function(k){ L.push("- " + k + ": " + m(byAsset[k])); });
  var holdings = (state.assets || []).filter(function(a){ return a.category === "Shares" && Number(a.amount) > 0; })
    .map(function(a){ return (a.symbol || "?") + " " + m(toAudAmount(a, Number(a.amount) || 0)); });
  if(holdings.length) L.push("- Holdings: " + holdings.join(", "));
  (state.debts || []).forEach(function(d){ if(Number(d.balance) > 0) L.push("- Debt: " + m(d.balance) + (d.rate ? " at " + d.rate + "%" : "")); });
  ipProperties().forEach(function(p, i){
    var rent = (p.income || []).reduce(function(s, r){ return s + periodsOf(Number(r.amount) || 0, r.freq).yearly; }, 0);
    var costs = (p.expenses || []).reduce(function(s, r){ return s + periodsOf(Number(r.amount) || 0, r.freq).yearly; }, 0);
    L.push("- Investment property " + (i + 1) + " (" + (p.state || "AU") + "): value " + m(p.value) + ", bought " + m(p.purchasePrice) + (p.purchaseDate ? " in " + p.purchaseDate.slice(0, 4) : "") + ", rent " + m(rent) + "/yr, costs " + m(costs) + "/yr");
    (p.loans || []).forEach(function(l, j){
      if(loanPaidOut(l)) return;
      L.push("  - Loan " + (j + 1) + ": " + m(l.balance) + " at " + (loanRateOn(l, today) || l.rate) + "% " + (l.repaymentType || "") + ", offset " + m(l.offsetBalance) + ", used to invest " + Math.round(loanInvestShare(l) * 100) + "%" +
        (p.purchaseDate && l.settlementDate && l.settlementDate > p.purchaseDate ? ", drawn after the purchase" : ""));
    });
  });
  var ef = null; try { ef = emergencyFund({ today: today }); } catch(e){}
  if(ef && ef.monthly) L.push("- Essentials about " + m(ef.monthly) + "/mo; cash and offsets " + m(ef.available));
  L.push("");
  L.push("SCENARIOS");
  (state.scenarios || []).forEach(function(s){
    var t = scenarioTotals(s), c = null;
    try { c = canBuy(s); } catch(e){}
    var line = "- " + s + ": a normal month leaves " + m(t.regularNetMonthly);
    if(c) line += "; buying for " + m(c.price) + " in " + (c.state || "?") + ", cash needed " + m(c.upfront) + ", left after " + m(c.left) + ", new loan " + m(c.loan) + " at " + m(c.repaymentMonthly) + "/mo, investment interest up " + m(c.extraInterestYearly) + "/yr";
    L.push(line + (s === currentScenario() ? " (current)" : ""));
  });
  if(findings && findings.length){
    L.push("");
    L.push("WHAT THE APP'S OWN RULES FOUND");
    findings.forEach(function(a){ L.push("- [" + a.kind + "] " + a.title + ": " + a.detail); });
  }
  return scrub(L.join("\n"));
}
