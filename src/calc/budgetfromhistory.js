// ---------------- A budget from history (v3.115.0) ----------------
//
// After a few months of imports the app knows what the household actually spends, but the budget
// still had to be typed in line by line. This reads the spending that isn't on any budget line and
// proposes the lines that would cover it:
//   steady payees (a subscription, a direct debit) — their own line, at their usual amount and rhythm
//   everyday spending in a category (cafés, fuel) — one line per category, at its monthly average
//   anything else that adds up ($300+ a year) — its own line, at its monthly average
// Categories the budget already has a line for are left alone. Nothing is written here; applying
// creates the lines and links the transactions they came from.
//
// Pure: transactions and lines come in as arguments.
import { merchantKey } from "./import-rules.js";
import { cadenceOf } from "./recurring.js";
import { knownMerchant, cleanMerchantName } from "./merchantbook.js";

var NEEDS = ["housing", "groceries", "utilities", "health", "insurance", "transport", "car", "childcare", "education", "investment property"];
var MIN_MONTHS = 3, MIN_OWN_YEARLY = 300;

function r2(n){ return Math.round(n * 100) / 100; }
function median(a){ var s = a.slice().sort(function(x, y){ return x - y; }); var m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function addMonths(iso, n){ var d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function mostCommon(list){ var c = {}, best = "", n = 0; list.forEach(function(x){ if(!x) return; c[x] = (c[x] || 0) + 1; if(c[x] > n){ n = c[x]; best = x; } }); return best; }
function classOf(category){ return NEEDS.indexOf(String(category || "").toLowerCase()) !== -1 ? "Needs" : "Wants"; }

// { ready, months, proposals: [{ key, what, amount, freq, category, classification, account, kind, count,
//   yearly, txIds }], leftover: { count, yearly } }. kind is "steady", "category" or "merchant".
export function proposeBudget(transactions, lines, today, opts){
  opts = opts || {};
  var live = {};
  (lines || []).forEach(function(l){ if(l.id) live[l.id] = true; });
  var budgeted = {};
  (lines || []).forEach(function(l){ var c = String(l.category || "").trim().toLowerCase(); if(c) budgeted[c] = true; });
  var from = addMonths(today.slice(0, 7), -11) + "-01";
  var rows = (transactions || []).filter(function(t){
    return t && t.date && t.date >= from && t.date <= today && Number(t.amount) > 0 && !(t.linkedExpenseId && live[t.linkedExpenseId]);
  });
  var monthsSeen = {};
  (transactions || []).forEach(function(t){ if(t && t.date && t.date >= from && t.date <= today) monthsSeen[t.date.slice(0, 7)] = true; });
  var months = Object.keys(monthsSeen).length;
  var out = { ready: months >= MIN_MONTHS, months: months, proposals: [], leftover: { count: 0, yearly: 0 } };
  if(!out.ready) return out;
  var perYear = 12 / months;

  var groups = {};
  rows.forEach(function(t){
    var k = knownMerchant(t.what || "");
    var key = k ? "k:" + k.name : "m:" + (merchantKey(t.what || "") || "(none)");
    var g = groups[key] = groups[key] || { key: key, name: k ? k.name : (t.what ? cleanMerchantName(t.what) : "Spending"), known: k, items: [] };
    g.items.push(t);
  });
  var byCategory = {};
  Object.keys(groups).forEach(function(key){
    var g = groups[key];
    var category = (g.known && g.known.category) || mostCommon(g.items.map(function(t){ return t.category; }));
    var total = g.items.reduce(function(s, t){ return s + Number(t.amount); }, 0);
    var amounts = g.items.map(function(t){ return Number(t.amount); });
    var freq = cadenceOf(g.items.map(function(t){ return t.date; }));
    var med = median(amounts);
    // Subscription-steady — within 5% (or $2) four times in five — not recurring.js's looser 15%,
    // which a supermarket visited monthly for similar totals can pass.
    var steady = freq && amounts.filter(function(a){ return Math.abs(a - med) <= Math.max(2, med * 0.05); }).length >= Math.ceil(amounts.length * 0.8);
    var base = { category: category, classification: classOf(category), account: mostCommon(g.items.map(function(t){ return t.account; })),
      count: g.items.length, txIds: g.items.map(function(t){ return t.id; }).filter(Boolean) };
    if(steady){
      var per = { Weekly: 52, Fortnightly: 26, Monthly: 12, Quarterly: 4, "Half-yearly": 2, Yearly: 1 }[freq] || 12;
      out.proposals.push(Object.assign({ key: key, what: g.name, amount: r2(med), freq: freq, kind: "steady", yearly: r2(med * per) }, base));
      return;
    }
    if(category && !budgeted[category.toLowerCase()]){
      var c = byCategory[category] = byCategory[category] || { category: category, items: [], total: 0 };
      c.items = c.items.concat(g.items); c.total += total;
      return;
    }
    var yearly = total * perYear;
    if(!category && yearly >= MIN_OWN_YEARLY){
      out.proposals.push(Object.assign({ key: key, what: g.name, amount: r2(total / months), freq: "Monthly", kind: "merchant", yearly: r2(yearly) }, base));
      return;
    }
    out.leftover.count += g.items.length; out.leftover.yearly += yearly;
  });
  Object.keys(byCategory).forEach(function(cat){
    var c = byCategory[cat];
    var yearly = c.total * perYear;
    if(yearly < 100){ out.leftover.count += c.items.length; out.leftover.yearly += yearly; return; }
    out.proposals.push({ key: "c:" + cat, what: cat, amount: r2(c.total / months), freq: "Monthly", kind: "category", yearly: r2(yearly),
      category: cat, classification: classOf(cat), account: mostCommon(c.items.map(function(t){ return t.account; })),
      count: c.items.length, txIds: c.items.map(function(t){ return t.id; }).filter(Boolean) });
  });
  out.leftover.yearly = r2(out.leftover.yearly);
  out.proposals.sort(function(a, b){ return b.yearly - a.yearly; });
  return out;
}

// Adds the chosen proposals as budget lines and links the transactions each came from.
// Returns the new lines. st: { shared, transactions }.
export function applyBudgetProposals(st, proposals, idFactory){
  var byId = {};
  (st.transactions || []).forEach(function(t){ if(t.id) byId[t.id] = t; });
  return (proposals || []).map(function(p){
    var line = { id: idFactory ? idFactory() : "line_" + p.key, what: p.what, amount: p.amount, freq: p.freq, category: p.category || "",
      classification: p.classification || "Wants", account: p.account || "", irregular: false, dueMonth: null };
    st.shared.push(line);
    (p.txIds || []).forEach(function(id){ var t = byId[id]; if(t){ t.linkedExpenseId = line.id; t.category = ""; } });
    return line;
  });
}

