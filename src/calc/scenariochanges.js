// ---------------- Scenarios as sealed sandboxes (v3.172.0, item 207) ----------------
//
// The household is the only truth, and every page shows it. A scenario lives on Plan → Scenarios:
// a name and a list of changes against the household, kept in state.scenarioChanges[name] — never
// on the household's own rows. Before this a scenario was spread over four pages: budget and income
// rows carried a per-scenario amount (scenarioOverrides), today's home costs sat inside the "Current
// situation" scenario rather than in Budget, and the scenario picked on Plan changed figures on Home
// and Cash flow.
//
// Changes, so far (208 adds more):
//   { id, kind: "amount", rowId, amount } — a budget or income row costs (or pays) this much here
//   { id, kind: "home" }                  — this scenario lives elsewhere: its housing is its own rows
//                                           (state.home[name]) and today's home lines are left out
// Today's home lines are ordinary budget lines marked homeCost: true.
//
// Pure apart from reading `state`; migrateScenarios takes the copy it changes.

import { state } from "../state.js";

export function changesFor(name, st){
  st = st || state;
  var all = st.scenarioChanges && st.scenarioChanges[name];
  return Array.isArray(all) ? all : [];
}
// A row's amount in a scenario: the scenario's own figure for it, else the row's.
export function amountChangeFor(name, rowId, st){
  if(!name || rowId == null) return null;
  var c = changesFor(name, st).find(function(x){ return x && x.kind === "amount" && x.rowId === rowId; });
  return c ? c.amount : null;
}
export function livesElsewhere(name, st){
  return changesFor(name, st).some(function(x){ return x && x.kind === "home"; });
}
// The household's budget lines as a scenario sees them: today's home lines are left out by a
// scenario that lives somewhere else.
export function scenarioSharedItems(name, st){
  st = st || state;
  var lines = st.shared || [];
  return livesElsewhere(name, st) ? lines.filter(function(l){ return !(l && l.homeCost); }) : lines;
}

// Set, or clear (amount null), a row's amount in a scenario.
export function setAmountChange(name, rowId, amount, idFactory, st){
  st = st || state;
  if(!st.scenarioChanges) st.scenarioChanges = {};
  var list = st.scenarioChanges[name] = changesFor(name, st).slice();
  var i = list.findIndex(function(x){ return x.kind === "amount" && x.rowId === rowId; });
  if(amount == null){ if(i !== -1) list.splice(i, 1); return null; }
  if(i !== -1){ list[i] = Object.assign({}, list[i], { amount: amount }); return list[i]; }
  var c = { id: idFactory ? idFactory() : "chg" + Date.now().toString(36), kind: "amount", rowId: rowId, amount: amount };
  list.push(c);
  return c;
}
// "This scenario lives elsewhere": its own home rows replace today's home lines.
export function setLivesElsewhere(name, idFactory, st){
  st = st || state;
  if(livesElsewhere(name, st)) return;
  if(!st.scenarioChanges) st.scenarioChanges = {};
  st.scenarioChanges[name] = changesFor(name, st).concat([{ id: idFactory ? idFactory() : "chg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: "home" }]);
}
// Today's home lines, copied as a scenario's own home rows (a copy of the baseline starts from them).
export function homeRowsFromBudget(st){
  st = st || state;
  return (st.shared || []).filter(function(l){ return l && l.homeCost; }).map(function(l){
    var r = JSON.parse(JSON.stringify(l));
    delete r.homeCost; delete r.receipts;
    return r;
  });
}
export function removeChange(name, id, st){
  st = st || state;
  var list = changesFor(name, st);
  var i = list.findIndex(function(x){ return x.id === id; });
  if(i === -1) return null;
  st.scenarioChanges[name] = list.slice(0, i).concat(list.slice(i + 1));
  return list[i];
}
// Renaming, copying and deleting a scenario carry its changes.
export function renameScenarioChanges(oldName, name, st){
  st = st || state;
  if(!st.scenarioChanges || !(oldName in st.scenarioChanges)) return;
  st.scenarioChanges[name] = st.scenarioChanges[oldName];
  delete st.scenarioChanges[oldName];
}
export function cloneScenarioChanges(from, name, idFactory, st){
  st = st || state;
  if(!st.scenarioChanges) st.scenarioChanges = {};
  st.scenarioChanges[name] = changesFor(from, st).map(function(c){ return Object.assign({}, JSON.parse(JSON.stringify(c)), { id: idFactory ? idFactory() : c.id + "c" }); });
}
export function deleteScenarioChanges(name, st){
  st = st || state;
  if(st.scenarioChanges) delete st.scenarioChanges[name];
}

// The one-time move into this shape (st.scenarioModel = 2 once done):
// - every row's scenarioOverrides become "amount" changes in their scenarios;
// - today's home rows (the baseline scenario's) become budget lines marked homeCost — kept under
//   their ids, so transactions logged against them stay linked; untouched $0 placeholders go;
// - every other scenario lives elsewhere (its own home rows), so each gets a "home" change.
// A baseline that is itself buying (its purchase leg on) keeps its home rows: its loan repayment
// is the calculator's, and moving it would cut that link. Returns what moved, for the record.
export function migrateScenarios(st, idFactory){
  var out = { amounts: 0, homeLines: 0, homeChanges: 0 };
  if(!st || st.scenarioModel >= 2) return out;
  var gen = idFactory || (function(){ var n = 0; return function(p){ return (p || "id") + "m" + (++n) + Date.now().toString(36); }; })();
  if(!st.scenarioChanges || typeof st.scenarioChanges !== "object") st.scenarioChanges = {};
  var scenarios = Array.isArray(st.scenarios) ? st.scenarios : [];
  var known = {};
  scenarios.forEach(function(s){ known[s] = true; });
  var add = function(name, c){ (st.scenarioChanges[name] = st.scenarioChanges[name] || []).push(c); };
  [st.shared || [], st.income || []].forEach(function(rows){
    rows.forEach(function(r){
      if(!r || !r.scenarioOverrides) return;
      if(r.id == null) r.id = gen(rows === st.income ? "inc" : "exp");
      Object.keys(r.scenarioOverrides).forEach(function(name){
        var v = r.scenarioOverrides[name];
        if(v == null || !known[name]) return;
        add(name, { id: gen("chg"), kind: "amount", rowId: r.id, amount: Number(v) || 0 });
        out.amounts++;
      });
      delete r.scenarioOverrides;
    });
  });
  var base = st.baselineScenario && known[st.baselineScenario] ? st.baselineScenario : null;
  var baseBuying = base && st.purchase && st.purchase[base] && st.purchase[base].enabled && !(st.invest && st.invest[base] && st.invest[base].enabled);
  if(base && !baseBuying && st.home && Array.isArray(st.home[base])){
    var linked = {};
    (st.transactions || []).forEach(function(t){ if(t && t.linkedExpenseId) linked[t.linkedExpenseId] = true; });
    if(!Array.isArray(st.shared)) st.shared = [];
    st.home[base].forEach(function(r){
      if(!r) return;
      if(!(Number(r.amount) > 0) && !(r.id && linked[r.id])) return;
      var line = Object.assign({}, r, { homeCost: true, category: r.category || "Housing", classification: r.classification || "Needs" });
      if(line.id == null) line.id = gen("exp");
      delete line.computed; delete line.computedNote;
      st.shared.push(line);
      out.homeLines++;
    });
    st.home[base] = [];
  }
  scenarios.forEach(function(name){
    if(name === base && !baseBuying) return;
    if(name === base) return;
    if(!livesElsewhere(name, st)){ add(name, { id: gen("chg"), kind: "home" }); out.homeChanges++; }
  });
  st.scenarioModel = 2;
  return out;
}
