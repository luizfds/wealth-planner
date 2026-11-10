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
  var items;
  try { items = adviceFor({ today: today || localDateStr() }); } catch(e){ items = []; }
  var order = { risk: 0, opportunity: 1, info: 2 };
  return items.filter(function(a){ return a.kind !== "good" && partAllows(a.id, state); })
    .map(function(a, i){ return Object.assign({}, a, { group: "know", tone: a.kind, label: ATTENTION_LABEL[a.kind], i: i }); })
    .sort(function(a, b){ return (order[a.kind] - order[b.kind]) || (a.i - b.i); });
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
