// ---------------- Make it real (v3.176.0, item 211) ----------------
//
// The one door from a scenario back into the household. When the lease is signed or the property
// bought, the scenario's changes become ordinary rows: a new rent or the new home's costs become the
// household's housing lines (the old ones are ended today, not deleted, so their history stays), an
// investment property or a home bought joins Net worth → Property with its loan, rent and costs, and
// a line's different amount becomes its amount. What can't honestly be made real today — a change
// dated in a later year, a sale (recorded when it settles), extra repayments, investing instead — is
// listed and left alone. makeRealPlan says what would happen; applyMakeReal does exactly that. Pure
// apart from the state it's handed.

import { changesFor } from "./scenariochanges.js";
import { ipFigures } from "./scenariolegs.js";
import { recalcPurchase } from "./property.js";
import { IP_CATEGORY } from "../constants.js";

function fyOf(iso){ var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m >= 7 ? y : y - 1; }
// The day before — an old home line ends the day the new one starts, so no day counts both.
function dayBefore(iso){ var d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function money(n){ return "$" + Math.round(n).toLocaleString("en-AU"); }

function run(st, name, today, idFactory, apply){
  var id = idFactory || (function(){ var n = 0; return function(p){ return (p || "id") + "r" + (++n); }; })();
  var actions = [], skipped = [];
  var changes = changesFor(name, st);
  var homeLines = (st.shared || []).filter(function(l){ return l && l.homeCost; });
  var rowOf = function(rid){ return (st.shared || []).concat(st.income || []).find(function(r){ return r && r.id === rid; }); };
  var replaceHome = function(newLines, why){
    if(homeLines.length) actions.push("End today's home lines (" + homeLines.map(function(l){ return l.what; }).join(", ") + ") — " + why);
    newLines.forEach(function(l){ actions.push("Add " + l.what + " to Budget as where you live: " + money(Number(l.amount) || 0) + " " + String(l.freq || "Monthly").toLowerCase()); });
    if(!apply) return;
    var acct = (homeLines[0] && homeLines[0].account) || "";
    homeLines.forEach(function(l){ l.endDate = dayBefore(today); delete l.homeCost; });
    newLines.forEach(function(l){ st.shared.push(Object.assign({ id: id("exp"), classification: "Needs", category: "Housing", account: acct, irregular: false, dueMonth: null, startDate: today }, l, { homeCost: true })); });
  };
  var cfg = st.purchase && st.purchase[name], inv = st.invest && st.invest[name];
  var buying = !!(cfg && cfg.enabled && !(inv && inv.enabled));
  var later = function(c){ return (Number(c.fromYear) || 0) > 0; };

  // Where the household lives.
  var rent = changes.find(function(c){ return c.kind === "rent" && !later(c); });
  var ownRows = changes.some(function(c){ return c.kind === "home"; }) ? (st.home && st.home[name]) || [] : [];
  if(buying){
    var out = recalcPurchase(name);
    if(out){
      var lines = ownRows.filter(function(r){ return r.id !== "homeLoanRow" && Number(r.amount) > 0; }).map(function(r){ return { what: r.what, amount: Number(r.amount) || 0, freq: r.freq || "Monthly" }; });
      lines.unshift({ what: "Home loan repayment", amount: Math.round(out.repaymentMonthly * 100) / 100, freq: "Monthly" });
      replaceHome(lines, "you'll own the home you live in");
      actions.push("Add " + name + " to Net worth → Property: a home worth " + money(out.price) + " with a " + money(out.loanBalance) + " loan");
      if(apply) st.properties.push({ id: id("p"), what: name, kind: "PPOR", value: out.price, purchasePrice: out.price, purchaseDate: today,
        acquisitionCosts: [{ what: "Stamp duty", amount: Math.round(out.stampDutyForTotal || 0) }], history: [], ownership: {}, pmFee: { percent: 0, flat: 0 }, incomePaidFreq: "Monthly",
        loans: [{ id: id("loan"), what: "Home loan", balance: Math.round(out.loanBalance), rate: Number(cfg.repaymentType === "IO" ? cfg.ioRate : cfg.rate) || 0, termYears: Number(cfg.termYears) || 30, repaymentType: cfg.repaymentType || "PI" }],
        income: [], expenses: [] });
    }
  } else if(rent){
    replaceHome([{ what: rent.what || "Rent", amount: Number(rent.amount) || 0, freq: rent.freq || "Weekly" }], "you'll rent somewhere new");
  } else if(ownRows.length){
    replaceHome(ownRows.filter(function(r){ return Number(r.amount) > 0; }).map(function(r){ return { what: r.what, amount: Number(r.amount) || 0, freq: r.freq || "Monthly" }; }), "you'll live somewhere new");
  }

  changes.forEach(function(c){
    if(c.kind === "home" || (c.kind === "rent" && c === rent)) return;
    if(later(c)){ skipped.push({ text: changeText(c), why: "happens in year " + ((Number(c.fromYear) || 0) + 1) + " — make it real then" }); return; }
    if(c.kind === "rent"){ skipped.push({ text: changeText(c), why: "a second rent — only one home is made real" }); return; }
    if(c.kind === "amount"){
      var r = rowOf(c.rowId);
      if(!r){ skipped.push({ text: "A change to a line that's been deleted", why: "nothing to change" }); return; }
      actions.push(r.what + ": " + money(Number(r.amount) || 0) + " → " + money(Number(c.amount) || 0) + " " + String(r.freq || "").toLowerCase());
      if(apply) r.amount = Number(c.amount) || 0;
      return;
    }
    if(c.kind === "cost"){
      actions.push("Add " + (c.what || "a cost") + " to Budget: " + money(Number(c.amount) || 0) + " " + String(c.freq || "Monthly").toLowerCase());
      if(apply) st.shared.push({ id: id("exp"), what: c.what || "A new cost", amount: Number(c.amount) || 0, freq: c.freq || "Monthly", classification: "Needs", category: "", account: "", irregular: false, dueMonth: null, startDate: today });
      return;
    }
    if(c.kind === "ip"){
      var f = ipFigures(c, {});
      actions.push("Add " + (c.what || "the investment property") + " to Net worth → Property: " + money(f.price) + ", a " + money(f.loan) + " loan, rent " + money(Number(c.rentWeekly) || 0) + " a week");
      if(apply){
        var weeksLet = Math.max(0, 52 - (Number(c.vacancyWeeks) || 0)) / 52;
        st.properties.push({ id: id("p"), what: c.what || "Investment property", kind: "IP", state: c.state || "", value: f.price, purchasePrice: f.price, purchaseDate: today,
          acquisitionCosts: [{ what: "Stamp duty", amount: Math.round(f.stampDuty) }], history: [], ownership: c.owner ? (function(o){ var m = {}; m[o] = 100; return m; })(c.owner) : {},
          pmFee: { percent: Number(c.mgmtPct) || 0, flat: 0 }, incomePaidFreq: "Monthly",
          loans: [{ id: id("loan"), what: "Investment loan", balance: Math.round(f.loan), rate: Number(c.rate) || 0, termYears: Number(c.termYears) || 30, repaymentType: c.repaymentType === "PI" ? "PI" : "IO" }],
          income: [{ id: id("inc"), what: "Rent", amount: Math.round((Number(c.rentWeekly) || 0) * weeksLet * 100) / 100, freq: "Weekly", classification: "", account: "" }],
          expenses: [{ id: id("exp"), what: "Rates, insurance and repairs", amount: Number(c.costsYearly) || 0, freq: "Yearly", classification: "Needs", category: IP_CATEGORY, account: "" }],
          depreciationSchedule: (Number(c.depreciationYearly) || 0) > 0 ? [{ fy: fyOf(today), capitalWorks: Number(c.depreciationYearly) || 0, plant: 0 }] : [] });
      }
      return;
    }
    if(c.kind === "sell"){ skipped.push({ text: changeText(c), why: "record the sale under Net worth → Property when it settles" }); return; }
    if(c.kind === "extra"){ skipped.push({ text: changeText(c), why: "set the extra repayment with your lender; the loan's balance updates as you log it" }); return; }
  });
  if(inv && inv.enabled) skipped.push({ text: "Invest instead", why: "move the money into the investment under Net worth → Investments" });
  if(!actions.length && !skipped.length) skipped.push({ text: "Nothing in this scenario differs from today", why: "there's nothing to make real" });
  return { actions: actions, skipped: skipped };
}
function changeText(c){
  if(c.kind === "sell") return "Selling a property";
  if(c.kind === "extra") return "Extra loan repayments";
  if(c.kind === "rent") return "Rent " + money(Number(c.amount) || 0) + " " + String(c.freq || "Weekly").toLowerCase();
  if(c.kind === "ip") return c.what || "An investment property";
  if(c.kind === "cost") return c.what || "A cost";
  return "A change";
}

export function makeRealPlan(st, name, today){ return run(JSON.parse(JSON.stringify(st)), name, today, null, false); }
export function applyMakeReal(st, name, today, idFactory){ return run(st, name, today, idFactory, true); }
