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
