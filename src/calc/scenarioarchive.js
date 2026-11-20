// ---------------- Archived scenarios (November 2026) ----------------
//
// The owner: "I'm planning to delete some, but might need them back." Archiving takes a scenario out of the
// household's scenarios — off every list, chart and comparison, so nothing that reads st.scenarios has to know — and
// keeps everything that made it what it was, to restore as it was. Pure: `st` is the state, changed in place; the
// caller commits.
//
// st.scenarioArchive: [{ name, archivedOn, home, purchase, invest, changes, note, overrides: [{ list, id, value }],
//   includedBy: [{ scenario, change }] }]
// What a scenario is, besides its name in st.scenarios (the same parts a rename moves — components/scenarios.js):
// its home rows, purchase and investing plans, its changes, its note, a budget or income line varied for it
// (scenarioOverrides, by the row's id), and another scenario's change that includes it. A draft being edited is
// left behind, as a delete leaves it.
import { discardDraft } from "./scenariodraft.js";

var OVERRIDE_LISTS = ["shared", "income"];
function copy(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

// Why it can't be archived, or "" when it can.
export function archiveBlocker(st, name){
  if((st.scenarios || []).indexOf(name) === -1) return "There's no scenario called that.";
  if(name === st.baselineScenario) return "Your current situation stays — it's what every scenario changes.";
  if((st.scenarios || []).length <= 1) return "You need at least one scenario.";
  return "";
}

export function archiveScenario(st, name, today){
  if(archiveBlocker(st, name)) return null;
  var entry = { name: name, archivedOn: today, home: copy((st.home || {})[name]), purchase: copy((st.purchase || {})[name]),
    invest: copy((st.invest || {})[name]), changes: copy((st.scenarioChanges || {})[name]), note: (st.scenarioNotes || {})[name], overrides: [], includedBy: [] };
  OVERRIDE_LISTS.forEach(function(list){
    (st[list] || []).forEach(function(row){
      if(!row || !row.scenarioOverrides || !(name in row.scenarioOverrides)) return;
      if(row.id) entry.overrides.push({ list: list, id: row.id, value: copy(row.scenarioOverrides[name]) });
      delete row.scenarioOverrides[name];
    });
  });
  Object.keys(st.scenarioChanges || {}).forEach(function(k){
    if(k === name) return;
    st.scenarioChanges[k] = (st.scenarioChanges[k] || []).filter(function(c){
      if(c && c.kind === "include" && c.scenario === name){ entry.includedBy.push({ scenario: k, change: copy(c) }); return false; }
      return true;
    });
  });
  st.scenarios = st.scenarios.filter(function(s){ return s !== name; });
  if(st.home) delete st.home[name];
  if(st.purchase) delete st.purchase[name];
  if(st.invest) delete st.invest[name];
  if(st.scenarioChanges) delete st.scenarioChanges[name];
  if(st.scenarioNotes) delete st.scenarioNotes[name];
  discardDraft(name, st);
  if(st.activeScenario === name) st.activeScenario = st.baselineScenario || st.scenarios[0];
  st.scenarioArchive = (st.scenarioArchive || []).concat([entry]);
  return entry;
}

// The name it comes back under: its own, or "<name> (2)" when another scenario has taken it since.
export function restoredName(st, name){
  var taken = function(n){ return (st.scenarios || []).some(function(s){ return String(s).toLowerCase() === String(n).toLowerCase(); }); };
  if(!taken(name)) return name;
  for(var i = 2; ; i++) if(!taken(name + " (" + i + ")")) return name + " (" + i + ")";
}

// Back as it was, under restoredName. A line it varied, or a scenario that included it, that's gone since stays gone.
export function restoreScenario(st, index){
  var entry = (st.scenarioArchive || [])[index];
  if(!entry) return null;
  var name = restoredName(st, entry.name);
  st.scenarios = (st.scenarios || []).concat([name]);
  st.home = st.home || {}; st.purchase = st.purchase || {}; st.invest = st.invest || {}; st.scenarioChanges = st.scenarioChanges || {};
  if(entry.home !== undefined) st.home[name] = copy(entry.home);
  if(entry.purchase !== undefined) st.purchase[name] = copy(entry.purchase);
  if(entry.invest !== undefined) st.invest[name] = copy(entry.invest);
  if(entry.changes !== undefined) st.scenarioChanges[name] = copy(entry.changes);
  if(entry.note){ st.scenarioNotes = st.scenarioNotes || {}; st.scenarioNotes[name] = entry.note; }
  (entry.overrides || []).forEach(function(o){
    var row = (st[o.list] || []).find(function(r){ return r && r.id === o.id; });
    if(!row) return;
    row.scenarioOverrides = row.scenarioOverrides || {};
    row.scenarioOverrides[name] = copy(o.value);
  });
  (entry.includedBy || []).forEach(function(x){
    if((st.scenarios || []).indexOf(x.scenario) === -1) return;
    st.scenarioChanges[x.scenario] = (st.scenarioChanges[x.scenario] || []).concat([Object.assign(copy(x.change), { scenario: name })]);
  });
  st.scenarioArchive = st.scenarioArchive.filter(function(e, i){ return i !== index; });
  return name;
}

// Gone for good.
export function deleteArchived(st, index){
  st.scenarioArchive = (st.scenarioArchive || []).filter(function(e, i){ return i !== index; });
}
