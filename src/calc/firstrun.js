import { state, genId } from "../state.js";
import { setAccountBalance } from "./accounts.js";

// ---------------- First-run setup (v3.74.0) ----------------
//
// The setup checklist on Home says what's missing; this fills it in, in one sitting, for someone
// opening the app for the first time: who's in the household, their accounts and balances, pay,
// housing and the everyday costs most households have. Everything it writes is an ordinary row,
// edited on its page afterwards like any other. applyFirstRun() takes the answers and writes them.
export var COMMON_COSTS = [
  { what: "Groceries", category: "Groceries", classification: "Needs" },
  { what: "Electricity & gas", category: "Utilities", classification: "Needs" },
  { what: "Phone & internet", category: "Utilities", classification: "Needs" },
  { what: "Insurance (health, car, contents)", category: "Insurance", classification: "Needs" },
  { what: "Transport & fuel", category: "Transport", classification: "Needs" },
  { what: "Subscriptions", category: "Subscriptions", classification: "Wants" },
  { what: "Eating out", category: "Eating out", classification: "Wants" }
];

// answers: { people: [{ name, age, pay, payFreq }], accounts: [{ name, type, balance }],
//   housing: { kind: "rent" | "loan" | "none", amount, freq }, costs: [{ what, amount }] } (monthly)
export function applyFirstRun(answers, today){
  answers = answers || {};
  var made = { people: 0, accounts: 0, lines: 0 };
  var people = (answers.people || []).filter(function(p){ return p && String(p.name || "").trim(); });
  people.forEach(function(p, i){
    var name = String(p.name).trim();
    var pay = Number(p.pay) || 0;
    state.income.push({ id: genId("inc"), what: name + "'s pay", classification: "", category: "", account: "", amount: pay, freq: p.payFreq || "Yearly",
      person: name, incomeType: "Gross", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 });
    if(i === 0 && Number(p.age) > 0){ if(!state.fire) state.fire = {}; state.fire.currentAge = Number(p.age); }
    made.people++;
  });
  var firstAccount = "";
  (answers.accounts || []).forEach(function(a){
    var name = String(a.name || "").trim();
    if(!name || state.accounts.some(function(x){ return x.name === name; })) return;
    var acct = { id: genId("acct"), name: name, type: a.type || "everyday", statementStartDay: 1, link: "" };
    state.accounts.push(acct);
    // An offset needs a loan to sit against, so its balance waits for the property to be added.
    if(a.balance !== "" && a.balance != null && !isNaN(Number(a.balance))) setAccountBalance(acct, Math.abs(Number(a.balance)), today);
    if(!firstAccount && acct.type !== "credit") firstAccount = name;
    made.accounts++;
  });
  var h = answers.housing || {};
  // v3.172.0 (item 207): where the household lives is a budget line like any other (a scenario that
  // moves house replaces it — calc/scenariochanges.js).
  if(h.kind && h.kind !== "none" && Number(h.amount) > 0){
    var what = h.kind === "rent" ? "Rent" : "Home loan";
    var row = state.shared.find(function(r){ return r.homeCost && /rent|home loan/i.test(r.what || ""); });
    if(row){ row.amount = Number(h.amount); row.freq = h.freq || "Monthly"; row.what = what; if(firstAccount && !row.account) row.account = firstAccount; }
    else state.shared.push({ id: genId("exp"), what: what, classification: "Needs", category: "Housing", account: firstAccount || "", amount: Number(h.amount), freq: h.freq || "Monthly", irregular: false, dueMonth: null, homeCost: true });
    made.lines++;
  }
  (answers.costs || []).forEach(function(c){
    if(!(Number(c.amount) > 0)) return;
    var preset = COMMON_COSTS.find(function(x){ return x.what === c.what; }) || {};
    state.shared.push({ id: genId("exp"), what: c.what, classification: preset.classification || "Needs", category: preset.category || "", account: firstAccount,
      amount: Number(c.amount), freq: c.freq || "Monthly", irregular: false, dueMonth: null });
    made.lines++;
  });
  // v3.161.0 (item 191): a part ticked shows straight away; one left unticked shows once one is added.
  if(answers.own){
    if(!state.parts) state.parts = {};
    ["property", "shares"].forEach(function(k){ if(answers.own[k] === true) state.parts[k] = "on"; });
  }
  state.firstRunDone = true;
  return made;
}

// Offer the setup on load only to an app with nothing in it, once: no income, budget lines,
// accounts, holdings or properties, and the setup neither finished nor closed before.
export function shouldOfferFirstRun(s){
  s = s || state;
  if(s.firstRunDone || s.firstRunSkipped) return false;
  var empty = function(a){ return !Array.isArray(a) || !a.length; };
  var homeSet = Object.keys(s.home || {}).some(function(k){ return (s.home[k] || []).some(function(r){ return Number(r.amount) > 0; }); });
  return empty(s.income) && empty(s.shared) && empty(s.accounts) && empty(s.assets) && empty(s.properties) && empty(s.transactions) && !homeSet;
}
