// ---------------- Editing a scenario on its own page (v3.181.0, item 212) ----------------
//
// A scenario is edited as a draft: opening its page copies everything that makes it up — its changes,
// its purchase and invest calculators and its own home rows — under a draft key beside it (the same
// state.purchase / state.invest / state.home / state.scenarioChanges maps, so every control on the
// page works on the draft unchanged). Nothing else in the app looks at the draft: it isn't in
// state.scenarios, so the cards, the comparison and the projection keep showing the saved scenario.
// Save copies the draft back over the scenario; Cancel drops it. A draft left behind (the page closed,
// the app reloaded) waits to be picked up again.

import { state } from "../state.js";

export var DRAFT_PREFIX = "Draft · ";
var PARTS = ["purchase", "invest", "home", "scenarioChanges"];
function copy(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }

export function draftKey(name){ return DRAFT_PREFIX + name; }
export function isDraftKey(key){ return String(key).indexOf(DRAFT_PREFIX) === 0; }
export function hasDraft(name, st){
  st = st || state;
  return PARTS.some(function(p){ return st[p] && Object.prototype.hasOwnProperty.call(st[p], draftKey(name)); });
}
// Open (or pick up) the draft; returns its key.
export function openDraft(name, st){
  st = st || state;
  var key = draftKey(name);
  if(hasDraft(name, st)) return key;
  PARTS.forEach(function(p){
    if(!st[p] || typeof st[p] !== "object") st[p] = {};
    if(st[p][name] !== undefined) st[p][key] = copy(st[p][name]);
  });
  return key;
}
// Whether the draft says anything the saved scenario doesn't.
export function draftChanged(name, st){
  st = st || state;
  if(!hasDraft(name, st)) return false;
  var key = draftKey(name);
  return PARTS.some(function(p){ return JSON.stringify((st[p] || {})[key]) !== JSON.stringify((st[p] || {})[name]); });
}
export function saveDraft(name, st){
  st = st || state;
  if(!hasDraft(name, st)) return false;
  var key = draftKey(name);
  PARTS.forEach(function(p){
    if(!st[p]) return;
    if(st[p][key] !== undefined) st[p][name] = st[p][key];
    delete st[p][key];
  });
  return true;
}
export function discardDraft(name, st){
  st = st || state;
  var key = draftKey(name);
  PARTS.forEach(function(p){ if(st[p]) delete st[p][key]; });
}
// A renamed or deleted scenario takes its draft with it.
export function renameDraft(oldName, name, st){
  st = st || state;
  var a = draftKey(oldName), b = draftKey(name);
  PARTS.forEach(function(p){ if(st[p] && st[p][a] !== undefined){ st[p][b] = st[p][a]; delete st[p][a]; } });
}

// ---- What changed since it was opened (v3.191.0, item 222) ----
function savedChange(name, id, st){ var list = ((st || state).scenarioChanges || {})[name] || []; return list.find(function(c){ return c && c.id === id; }) || null; }
// "new" (not in the saved scenario), "changed", or "same".
export function changeStatus(name, id, st){
  st = st || state;
  var draft = ((st.scenarioChanges || {})[draftKey(name)] || []).find(function(c){ return c && c.id === id; });
  var saved = savedChange(name, id, st);
  if(!saved) return "new";
  return JSON.stringify(saved) === JSON.stringify(draft) ? "same" : "changed";
}
// The fields of a change that differ from the saved one.
export function changedFields(name, id, st){
  st = st || state;
  var draft = ((st.scenarioChanges || {})[draftKey(name)] || []).find(function(c){ return c && c.id === id; }) || {};
  var saved = savedChange(name, id, st);
  if(!saved) return {};
  var out = {};
  Object.keys(Object.assign({}, saved, draft)).forEach(function(k){ if(JSON.stringify(saved[k]) !== JSON.stringify(draft[k])) out[k] = true; });
  return out;
}
// Put one change back as saved — or, if it's new, take it out.
export function resetChange(name, id, st){
  st = st || state;
  var key = draftKey(name), list = (st.scenarioChanges || {})[key];
  if(!Array.isArray(list)) return;
  var i = list.findIndex(function(c){ return c && c.id === id; }), saved = savedChange(name, id, st);
  if(i === -1) return;
  if(saved) list[i] = copy(saved); else list.splice(i, 1);
}
// Whether buying / investing / the home's own costs differ from saved, and putting them back.
export function buyInvestChanged(name, st){
  st = st || state;
  var key = draftKey(name);
  return ["purchase", "invest", "home"].some(function(p){ return JSON.stringify((st[p] || {})[key]) !== JSON.stringify((st[p] || {})[name]); });
}
export function resetBuyInvest(name, st){
  st = st || state;
  var key = draftKey(name);
  ["purchase", "invest", "home"].forEach(function(p){ if(st[p] && st[p][name] !== undefined) st[p][key] = copy(st[p][name]); });
}
