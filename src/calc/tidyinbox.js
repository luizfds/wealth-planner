// ---------------- Things to tidy: one list, one card at a time (November 2026) ----------------
//
// Six places used to ask for fixes — Tidy up, Trim, Worth a look, Recurring payments, Build from what you've spent, and
// the banner — each with its own buttons and words. This is one list of cards, each one decision with two answers:
//   misfiled     a purchase on a line its shop is rarely on          (calc/tidy.js strays)        Move it / It's right
//   hint         an Essential that reads as Lifestyle, the reverse,  (calc/budgetsplit.js hints)  Fix it / It's right
//                a set-aside line spent every month
//   drift        a plan far from what's spent, either way            (calc/trim.js spendingDrift) Use typical / Keep
//   recurring    a charge repeating with no line for it              (calc/recurring.js)          Add a line / One-off
//   stopped      a bill not paid for a while, with no end date       (calc/bills.js stopped)      It ended then / Still going
//   property     a transaction that reads like a property's          (calc/propertymoney.js)      Link it / Not this property
//   propline     a rates or insurance line, with more than one property it could be for         Our home / The investment
// "No" is remembered (state.tidyOk), so a card that's been answered doesn't come back; "Later" is the session's.
// Pure: inboxCards() takes the lists, applyInboxAction() the state it changes, and returns its undo.
import { moveTransactions, undoChanges, markTidyOk } from "./tidy.js";
import { linkTransaction, setLineProperty, purchaseCostChoices, shortDate } from "./propertymoney.js";
import { periodsOf } from "./ledger.js";

function money(n){ var v = Math.round(Number(n) || 0); return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-AU"); }
function plural(n, one, many){ return n + " " + (n === 1 ? one : (many || one + "s")); }
var FREQ_WORD = { Weekly: "a week", Fortnightly: "a fortnight", Monthly: "a month", Quarterly: "a quarter", "Half-yearly": "a half-year", Yearly: "a year" };

// input: { strays, hints, drift, recurring, stopped, property, propLines, lines, ok }. lines: the budget lines (for names). ok: state.tidyOk.
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
      body: (s.typed && s.typed.length ? "You described it as “" + s.typed.join("”, “") + "” — check it's the same shop before moving it. " : "") +
        "Your other " + plural(s.mainCount, "visit") + " there " + (s.mainCount === 1 ? "is" : "are") + " on " + name(s.toLineId) + "." + (s.typed && s.typed.length ? "" : " Probably a slip."),
      facts: [["On", name(s.fromLineId)], ["Usually", name(s.toLineId)]],
      yes: { label: "Move to " + name(s.toLineId), act: { type: "move", ids: s.txIds, to: s.toLineId } },
      no: { label: "It's right", act: { type: "ok", key: s.id } } });
  });
  // November 2026: for a property? A purchase's card can pick which of its costs (`picks`, `pick` the guess).
  (input.property || []).forEach(function(x){
    var t = x.t, amt = money(t.amount), purchase = x.to.kind === "purchase";
    var picks = purchase ? purchaseCostChoices(x.to.purchase).map(function(c){ return { value: c.id, label: c.what }; }).concat([{ value: "new", label: "+ New cost" }]) : null;
    var target = purchase ? { type: "purchase", id: x.to.id, cost: x.cost || "new" } : { type: "property", id: x.to.id, lineId: x.lineId || "" };
    out.push({ id: x.id, kind: "property", label: "For a property?",
      title: "“" + (t.what || "A transaction") + "” " + amt + " on " + shortDate(t.date) + " — for " + (purchase ? "the " + x.to.name + " purchase" : x.to.name) + "?",
      body: purchase ? "It looks like a cost of buying " + x.to.name + (x.to.purchase.settlementDate ? " (settles " + shortDate(x.to.purchase.settlementDate) + ")" : "") + ". Linked, it's kept out of your spending and marks the cost paid."
        : "Linked, it counts in " + x.to.name + "'s year and its tax schedule, not your household budget.",
      facts: [["Now", x.now], ["Would be", x.to.name + " · " + (purchase ? "purchase" : (x.lineWhat || "other cost"))]],
      picks: picks, pick: purchase ? (x.cost || "new") : "", why: x.why,
      yes: { label: purchase ? "Link to the purchase" : "Link to " + x.to.name, act: { type: "linkProp", index: x.index, target: target } },
      no: { label: "Not this property", act: { type: "ok", key: x.id } } });
  });
  (input.propLines || []).forEach(function(x){
    var l = x.line;
    out.push({ id: x.id, kind: "propline", label: "A line for a property?",
      title: (l.what || "A line") + " — which property is this line for?",
      body: "A line for a property wears its chip and shows on its page" + (x.investment ? "; for an investment, it counts on its tax schedule" : "") + ".",
      facts: [["Line", (l.what || "A line") + " · " + money(l.amount) + " " + (FREQ_WORD[l.freq] || "")], ["Paid from", l.account || "—"]],
      why: "“" + (l.what || "") + "” is a property's cost and you have more than one.",
      yes: { label: x.home.name + (x.home.kind === "investment" ? "" : " (our home)"), act: { type: "lineProp", lineId: l.id, propertyId: x.home.id } },
      no: x.investment ? { label: x.investment.name, act: { type: "lineProp", lineId: l.id, propertyId: x.investment.id } } : { label: "Not a property's", act: { type: "ok", key: x.id } } });
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
  // November 2026: from Bills' "Stopped?" list — asked here, once, with the other things to tidy.
  (input.stopped || []).forEach(function(x){
    var key = "inbox:stopped|" + x.id;
    if(ok[key] || !byId[x.id] || !x.last) return;
    out.push({ id: key, kind: "stopped", label: "Stopped?",
      title: x.what + " hasn't been paid since " + longDate(x.last),
      body: "It's left off the Bills calendar until a payment comes. If it ended — a cancelled membership, a bill now paid another way — end the line there, so the plan stops counting it.",
      facts: [["Last paid", longDate(x.last)], ["Line", name(x.id)]],
      yes: { label: "It ended then", act: { type: "set", lineId: x.id, set: { endDate: x.last } } },
      no: { label: "It's still going", act: { type: "ok", key: key } } });
  });
  return out;
}
var MONTH_WORDS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function longDate(iso){ return Number(String(iso).slice(8, 10)) + " " + MONTH_WORDS[Number(String(iso).slice(5, 7)) - 1] + " " + String(iso).slice(0, 4); }

// What a "yes" or "no" does, on the state it's handed (st.transactions, st.shared, budget lines by id via `lineOf`).
// opts: { lineOf(id) → the line object, idFactory() → a new id }. → its undo, or null when there's nothing to do.
export function applyInboxAction(st, act, opts){
  opts = opts || {};
  if(!act) return null;
  if(act.type === "ok") return markTidyOk(st, act.key);
  if(act.type === "linkProp"){ var lt = st.transactions[act.index]; return lt ? linkTransaction(st, lt, act.target, opts) : null; }
  if(act.type === "lineProp"){ var pl = (st.shared || []).find(function(l){ return l && l.id === act.lineId; }); return pl ? setLineProperty(st, pl, act.propertyId) : null; }
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
