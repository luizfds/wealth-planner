// ---------------- Things to tidy: one list, one card at a time (November 2026) ----------------
//
// Six places used to ask for fixes — Tidy up, Trim, Worth a look, Recurring payments, Build from what you've spent, and
// the banner — each with its own buttons and words. This is one list of cards, each one decision with two answers:
//   misfiled     a purchase on a line its shop is rarely on          (calc/tidy.js strays)        Move it / It's right
//   hint         an Essential that reads as Lifestyle, the reverse,  (calc/budgetsplit.js hints)  Fix it / It's right
//                a set-aside line spent every month
//   drift        a plan far from what's spent, either way            (calc/trim.js spendingDrift) Use typical / Keep
//   recurring    a charge repeating with no line for it              (calc/recurring.js)          Add a line / One-off
// "No" is remembered (state.tidyOk), so a card that's been answered doesn't come back; "Later" is the session's.
// Pure: inboxCards() takes the lists, applyInboxAction() the state it changes, and returns its undo.
import { moveTransactions, undoChanges, markTidyOk } from "./tidy.js";
import { periodsOf } from "./ledger.js";

function money(n){ var v = Math.round(Number(n) || 0); return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-AU"); }
function plural(n, one, many){ return n + " " + (n === 1 ? one : (many || one + "s")); }
var FREQ_WORD = { Weekly: "a week", Fortnightly: "a fortnight", Monthly: "a month", Quarterly: "a quarter", "Half-yearly": "a half-year", Yearly: "a year" };

// input: { strays, hints, drift, recurring, lines, ok }. lines: the budget lines (for names). ok: state.tidyOk.
// → cards [{ id, kind, label, title, body, facts: [[label, value], [label, value]], yes: { label, act }, no: { label, act } }].
export function inboxCards(input){
  input = input || {};
  var ok = input.ok || {}, byId = {};
  (input.lines || []).forEach(function(l){ if(l && l.id) byId[l.id] = l; });
  var name = function(id){ return (byId[id] && byId[id].what) || "a line"; };
  var out = [];
  (input.strays || []).forEach(function(s){
    out.push({ id: s.id, kind: "misfiled", label: "Looks misfiled",
      title: s.label + ", " + money(s.total) + ", is on " + name(s.fromLineId),
      body: "Your other " + plural(s.mainCount, "visit") + " there " + (s.mainCount === 1 ? "is" : "are") + " on " + name(s.toLineId) + ". Probably a slip.",
      facts: [["On", name(s.fromLineId)], ["Usually", name(s.toLineId)]],
      yes: { label: "Move to " + name(s.toLineId), act: { type: "move", ids: s.txIds, to: s.toLineId } },
      no: { label: "It's right", act: { type: "ok", key: s.id } } });
  });
  (input.hints || []).forEach(function(h){
    var kind = { "essential-lifestyle": "Essential or lifestyle?", "lifestyle-essential": "Essential or lifestyle?", "setaside-monthly": "Spent every month" }[h.kind] || "Worth a look";
    out.push({ id: h.id, kind: "hint", label: kind, title: h.what + " is " + h.text,
      body: h.kind === "setaside-monthly" ? "Set aside is for lumpy costs like trips. Every month puts it in this month's Lifestyle figure."
        : "Essential means you'd still pay it if money got tight; Lifestyle is chosen and could be cut.",
      facts: h.kind === "setaside-monthly" ? [["Now", "Set aside"], ["Spent in", (h.text.match(/\d+ of the last 12/) || ["most"])[0] + " months"]]
        : [["Now", h.kind === "essential-lifestyle" ? "Essential" : "Lifestyle"], ["Suggested", h.kind === "essential-lifestyle" ? "Lifestyle" : "Essential"]],
      yes: { label: h.fix.label, act: { type: "set", lineId: h.lineId, set: h.fix.set } },
      no: { label: "It's right", act: { type: "ok", key: h.id } } });
  });
  (input.drift || []).forEach(function(x){
    var key = "inbox:drift|" + x.id;
    if(ok[key] || !byId[x.id]) return;
    var low = x.actual > x.planned;
    out.push({ id: key, kind: "drift", label: low ? "Plan too low" : "Plan too high",
      title: x.what + ": you spend " + money(x.actual / 12) + " a month",
      body: "The plan says " + money(x.planned / 12) + ". " + (low ? "A plan below what you spend makes every month — and every scenario — look better than it is. Or is it a target?"
        : "A plan above what you spend makes every scenario look worse than it is."),
      facts: [["Plan", money(x.planned / 12) + "/mo"], ["Typical (12 months)", money(x.actual / 12) + "/mo"]],
      yes: { label: "Make the plan " + money(x.suggested) + " " + (FREQ_WORD[x.freq] || ""), act: { type: "amount", lineId: x.id, amount: x.suggested } },
      no: { label: low ? "Keep it as a target" : "Keep the plan", act: { type: "ok", key: key } } });
  });
  (input.recurring || []).forEach(function(r){
    var key = "inbox:recurring|" + r.key;
    if(ok[key]) return;
    out.push({ id: key, kind: "recurring", label: "New repeating charge",
      title: r.name + " charged " + money(r.amount) + " " + plural(r.count, "time"),
      body: "It repeats " + String(r.freq || "").toLowerCase() + " and isn't in your plan yet.",
      facts: [["Charged", money(r.amount) + " " + (FREQ_WORD[r.freq] || "")], ["About", money(r.monthly) + "/mo"]],
      yes: { label: "Add it to Lifestyle", act: { type: "addLine", line: { what: r.name, classification: "Wants", category: r.category || "", amount: r.amount, freq: r.freq }, indices: r.indices || [] } },
      no: { label: "It's a one-off", act: { type: "ok", key: key } } });
  });
  return out;
}

// What a "yes" or "no" does, on the state it's handed (st.transactions, st.shared, budget lines by id via `lineOf`).
// opts: { lineOf(id) → the line object, idFactory() → a new id }. → its undo, or null when there's nothing to do.
export function applyInboxAction(st, act, opts){
  opts = opts || {};
  if(!act) return null;
  if(act.type === "ok") return markTidyOk(st, act.key);
  if(act.type === "move"){
    var moved = moveTransactions(st.transactions, act.ids, act.to);
    return moved.length ? function(){ undoChanges(moved); } : null;
  }
  var line = act.lineId && opts.lineOf ? opts.lineOf(act.lineId) : null;
  if(act.type === "set" && line){
    var was = {};
    Object.keys(act.set).forEach(function(k){ was[k] = line[k]; });
    Object.assign(line, act.set);
    return function(){ Object.keys(was).forEach(function(k){ if(was[k] === undefined) delete line[k]; else line[k] = was[k]; }); };
  }
  if(act.type === "amount" && line){
    var before = line.amount;
    line.amount = act.amount;
    return function(){ line.amount = before; };
  }
  if(act.type === "addLine"){
    if(!Array.isArray(st.shared)) st.shared = [];
    var made = Object.assign({ id: opts.idFactory ? opts.idFactory() : "exp" + Date.now().toString(36), account: "", irregular: false, dueMonth: null }, act.line);
    var lastTx = st.transactions[(act.indices || [])[act.indices.length - 1]];
    if(lastTx && lastTx.account) made.account = lastTx.account;
    st.shared.push(made);
    var linked = (act.indices || []).map(function(i){ var t = st.transactions[i]; if(!t) return null; var w = { t: t, was: { linkedExpenseId: t.linkedExpenseId, category: t.category } }; t.linkedExpenseId = made.id; t.category = ""; return w; }).filter(Boolean);
    return function(){ undoChanges(linked); var at = st.shared.indexOf(made); if(at !== -1) st.shared.splice(at, 1); };
  }
  return null;
}
// A card's monthly effect on the plan, for a "yes" that changes an amount — what the plan would move by.
export function inboxPlanEffect(card, lineOf){
  var a = card && card.yes && card.yes.act;
  if(!a) return 0;
  if(a.type === "amount"){ var l = lineOf && lineOf(a.lineId); return l ? periodsOf(a.amount, l.freq).monthly - periodsOf(Number(l.amount) || 0, l.freq).monthly : 0; }
  if(a.type === "addLine") return periodsOf(a.line.amount, a.line.freq).monthly;
  return 0;
}
