// ---------------- One place for what needs attention (#305, docs/design/attention.md) ----------------
//
// Everything that asks for attention is one list in two groups, built here:
//   To do          — something with a date or an action (lib/notifications.js: a bill due, a return to lodge,
//                    a month to review, transactions to review, a balance to update…)
//   Worth knowing  — an observation from the figures (calc/advice.js: Watch, Opportunity, Worth knowing)
// The bell shows both groups; Home's To do shows the first few of the first; Home → Insights reads the second
// in full. "On track" asks for nothing, so it is not here — it stays a fold on Insights.
import { getNotifications } from "./notifications.js";
import { adviceFor } from "../calc/advice.js";
import { partAllows } from "../calc/parts.js";
import { state } from "../state.js";
import { localDateStr } from "./format.js";
import { escapeAttr } from "./html.js";

// The observations, worked out once per pass. One save redraws Insights, a page's line and the bell's badge, and
// each asked calc/advice.js afresh — the scenario comparisons three times over. The speed budget's transfer step
// went from about 40% of a full redraw to 57% (its limit is 60%) when the line was added. The answer is kept for
// the rest of the current task and dropped before the next, so nothing reads a stale one.
var adviceMemo = null;
export function adviceNow(today){
  var day = today || localDateStr();
  if(adviceMemo && adviceMemo.day === day) return adviceMemo.items;
  var items;
  try { items = adviceFor({ today: day }); } catch(e){ items = []; }
  adviceMemo = { day: day, items: items };
  if(typeof setTimeout === "function") setTimeout(function(){ adviceMemo = null; }, 0);
  return items;
}

// One vocabulary. In the To do group an item is Urgent when it is overdue or days from its date (severity
// "bad"), a To do when it is waiting on you ("warn"), and a Reminder when it is only telling you ("info": the
// week's recap, a rate change recorded, a return that isn't due for months).
export var ATTENTION_LABEL = { urgent: "Urgent", todo: "To do", reminder: "Reminder", risk: "Watch", opportunity: "Opportunity", info: "Worth knowing" };
var SEVERITY_ORDER = { bad: 0, warn: 1, info: 2 };

export function todoItems(){
  // getNotifications() puts unread first, then by date; within each, the most pressing leads.
  return getNotifications().map(function(n, i){
    var tone = n.severity === "bad" ? "urgent" : n.severity === "warn" ? "todo" : "reminder";
    return Object.assign({}, n, { group: "todo", tone: tone, label: ATTENTION_LABEL[tone], i: i });
  }).sort(function(a, b){
    return (Number(a.read) - Number(b.read)) || (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (a.i - b.i);
  });
}
export function knowItems(today){
  var items = adviceNow(today);
  var order = { risk: 0, opportunity: 1, info: 2 };
  return items.filter(function(a){ return a.kind !== "good" && partAllows(a.id, state) && !isDismissed(a); })
    .map(function(a, i){ return Object.assign({}, a, { group: "know", tone: a.kind, label: ATTENTION_LABEL[a.kind], i: i }); })
    .sort(function(a, b){ return (order[a.kind] - order[b.kind]) || (a.i - b.i); });
}
// ---------------- Putting an observation away (#305, step 3) ----------------
// An Opportunity or a Worth knowing can be dismissed; a Watch can't — a scenario short of cash goes when it is
// fixed. A dismissed one is remembered by the title it had, so it comes back when its figures (its title) change.
export function canDismiss(a){ return !!a && (a.kind === "opportunity" || a.kind === "info"); }
export function isDismissed(a, st){
  var d = (st || state).noticesDismissed;
  return canDismiss(a) && !!d && d[a.id] === a.title;
}
// What is put away right now, for Insights' "put away" fold.
export function dismissedItems(today){
  var items = adviceNow(today);
  return items.filter(function(a){ return partAllows(a.id, state) && isDismissed(a); });
}
// The edit itself: the caller saves it with commit(["noticesDismissed"]). Entries for notices no longer raised,
// or whose title has moved on, are dropped as it goes.
export function setNoticeDismissed(id, on, today){
  var items = adviceNow(today);
  var byId = {};
  items.forEach(function(a){ byId[a.id] = a; });
  var d = state.noticesDismissed;   // always an object: defaultState() and migration step 27
  if(!d || typeof d !== "object") return {};
  Object.keys(d).forEach(function(k){ if(!byId[k] || byId[k].title !== d[k]) delete d[k]; });
  if(on && canDismiss(byId[id])) d[id] = byId[id].title; else delete d[id];
  return d;
}
export function attentionItems(today){
  return { todo: todoItems(), know: knowItems(today) };
}
// Home's To do: the same items in the same words, most pressing first. Bills due and the week's recap are
// To dos too, but Home's Bills and Your week cards beside this one already show them.
var ON_HOME_ALREADY = { duebill: true, bill: true, week: true };
export function homeTodoItems(){
  return todoItems().filter(function(n){ return !ON_HOME_ALREADY[n.type]; })
    .map(function(n, i){ return { n: n, i: i }; })
    .sort(function(a, b){ return (SEVERITY_ORDER[a.n.severity] - SEVERITY_ORDER[b.n.severity]) || (a.i - b.i); })
    .map(function(x){ return x.n; });
}

// ---------------- One line per page (#305, step 2) ----------------
// A page shows one line — "3 to look at" — in place of a stack of notices, and only for what is about that
// view: an item belongs to the page and tab it sends you to, and one with no tab to the page's first tab. So
// Tax's two notices about pay count on People, not on every Tax tab.
var FIRST_TAB = { expenses: "budget", tax: "year", plan: "scenarios", assets: "summary" };
// What the page itself already shows in full stays off its line — on Tax, each person's super room is the
// Top up box on their card (v3.158.0, item 188).
var SHOWN_ON_PAGE = { tax: /^super-room:/ };
export function itemView(n){
  return n.group === "know" ? { page: n.go && n.go.page, sub: n.go && n.go.sub } : { page: n.page, sub: n.sub };
}
export function belongsToView(n, view){
  var v = itemView(n);
  if(!v.page || !view || v.page !== view.page) return false;
  // Home has its own To do card and Insights; Checks and storage ("accounts" with a tab) live under Review and Settings.
  if(v.page === "dashboard" || (v.page === "accounts" && v.sub)) return false;
  if(n.group === "know" && SHOWN_ON_PAGE[view.page] && SHOWN_ON_PAGE[view.page].test(n.id)) return false;
  var first = FIRST_TAB[view.page];
  return v.sub ? v.sub === view.sub : (!first || !view.sub || view.sub === first);
}
export function viewItems(view, today){
  var all = attentionItems(today), here = function(n){ return belongsToView(n, view); };
  return { todo: all.todo.filter(here), know: all.know.filter(here) };
}
// The line itself: how many, and the first of them. components/attentionline.js places it on the page.
export function attentionLineHtml(items){
  var all = items.todo.concat(items.know);
  if(!all.length) return "";
  var top = all[0];
  var loud = all.some(function(n){ return n.tone === "urgent" || n.tone === "risk"; });
  return '<button type="button" class="attn-line' + (loud ? " loud" : "") + '" data-attn-line aria-haspopup="dialog">' +
    '<span class="attn-count">' + all.length + ' to look at</span>' +
    '<span class="attn-top">' + escapeAttr(top.title) + '</span><span class="attn-go" aria-hidden="true">›</span></button>';
}
