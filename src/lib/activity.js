// ---------------- Who changed what, on this device (v3.171.0, item 202) — calc/activity.js decides ----------------
//
// Whose device this is (kept here, never in the data), and the watcher that turns a burst of edits
// into log entries: a little after the last save, if someone has touched the page in the last few
// seconds, what changed since the last look is logged under their name. Changes nobody made here
// (a price refresh, a copy pulled from sync, a restored backup) only move the look.

import { state, deviceId, persist, onSaved, onStateReplaced, genId } from "../state.js";
import { diffForLog, entriesFor, pruneActivity } from "../calc/activity.js";

var KEY = "wealthPlanner.devicePerson";
var QUIET_MS = 1500, TOUCH_MS = 8000;
var last = null, timer = null, lastTouch = 0;

export function devicePerson(){ try { return localStorage.getItem(KEY) || ""; } catch(e){ return ""; } }
export function setDevicePerson(name){ try { if(name) localStorage.setItem(KEY, name); else localStorage.removeItem(KEY); } catch(e){} }

function copy(){ var c = JSON.parse(JSON.stringify(state)); delete c.activity; return c; }
// What's there now is the starting point — nothing in it is anyone's edit.
export function rebaselineActivity(){ last = copy(); }

export function noteChanges(){
  timer = null;
  if(!last){ rebaselineActivity(); return 0; }
  var now = copy();
  var touched = Date.now() - lastTouch < TOUCH_MS;
  var changes = touched ? diffForLog(last, now) : [];
  last = now;
  if(!changes.length) return 0;
  var entries = entriesFor(changes, { by: devicePerson(), device: deviceId(), idFactory: function(){ return genId("act"); } });
  state.activity = pruneActivity(entries.concat(state.activity || []));
  persist();
  return entries.length;
}

export function startActivityLog(){
  if(typeof document === "undefined") return;
  rebaselineActivity();
  ["pointerdown", "keydown", "input", "change"].forEach(function(t){ document.addEventListener(t, function(){ lastTouch = Date.now(); }, true); });
  onSaved(function(){ clearTimeout(timer); timer = setTimeout(noteChanges, QUIET_MS); });
  onStateReplaced(function(){ clearTimeout(timer); timer = null; rebaselineActivity(); });
}
