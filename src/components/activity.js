import { state, deviceId } from "../state.js";
import { whoText } from "../calc/activity.js";
import { getTaxPeople } from "../calc/tax.js";
import { escapeAttr } from "../lib/html.js";
import { devicePerson } from "../lib/activity.js";

// ---------------- Who changed what (v3.171.0, item 202) — calc/activity.js decides ----------------
// Settings → Preferences: whose device this is, and the last changes from every device, newest
// first, a day at a time, each with Undo where it can be undone.
export var activityUi = { shown: 40 };

function dayLabel(iso, today){
  var d = iso.slice(0, 10);
  if(d === today) return "Today";
  var y = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  if(d === y) return "Yesterday";
  return new Date(Date.parse(d + "T00:00:00Z")).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
function timeText(iso){ try { return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }); } catch(e){ return ""; } }

export function activityHtml(list, opts){
  opts = opts || {};
  list = list || [];
  var me = opts.device || deviceId(), name = opts.name != null ? opts.name : devicePerson();
  var today = opts.today || new Date().toISOString().slice(0, 10);
  var people = opts.people || getTaxPeople();
  var nameField = '<div class="act-name"><label for="actName">This device is used by</label>' +
    '<input id="actName" type="text" data-act-name maxlength="40" list="actPeople" value="' + escapeAttr(name) + '" placeholder="Your name">' +
    '<datalist id="actPeople">' + people.map(function(p){ return '<option value="' + escapeAttr(p) + '">'; }).join("") + '</datalist>' +
    '<small>Kept on this device only. Your changes carry this name, so whoever you sync with can see who made them.</small></div>';
  if(!list.length) return nameField + '<p class="ledger-note" style="margin:12px 0 0">No changes logged yet. Each edit made here — and on any device you sync with — shows up here for 90 days.</p>';
  var shown = list.slice(0, activityUi.shown), lastDay = "";
  var rows = shown.map(function(e){
    var day = dayLabel(e.at, today), head = day !== lastDay ? '<h4 class="act-day">' + escapeAttr(day) + '</h4>' : '';
    lastDay = day;
    var who = whoText(e, me);
    return head + '<div class="act-row' + (e.undone ? " is-undone" : "") + '">' +
      '<span class="act-time">' + escapeAttr(timeText(e.at)) + '</span>' +
      '<span class="act-main"><span class="act-what">' + escapeAttr(e.what) + '</span><small>' + escapeAttr(e.section || "") + ' · ' + escapeAttr(who) + (e.detail ? ' · ' + escapeAttr(e.detail) : '') + '</small></span>' +
      (e.undone ? '<span class="act-undone">Undone</span>' : e.undo ? '<button type="button" class="btn btn-sm btn-ghost" data-act-undo="' + escapeAttr(e.id) + '" aria-label="Undo: ' + escapeAttr(e.what) + '">Undo</button>' : '') +
    '</div>';
  }).join("");
  return nameField + '<div class="act-list">' + rows + '</div>' +
    (list.length > shown.length ? '<button type="button" class="btn btn-sm btn-ghost" data-act-more>Show ' + Math.min(40, list.length - shown.length) + ' more</button>' : '');
}
export function renderActivity(){
  var el = typeof document !== "undefined" && document.getElementById("activityBody");
  if(!el) return;
  var focused = document.activeElement && document.activeElement.id === "actName";
  if(focused) return; // don't redraw the name field from under someone typing in it
  el.innerHTML = activityHtml(state.activity);
}
