import { state, genId } from "../state.js";
import { appendHistorySnapshot } from "./ledger.js";
import { localDateStr } from "../lib/format.js";
import { linkedName, link, accountFor } from "./accountlinks.js";

// v3.204.0 (item 235b): a row's account, read and written through its id (calc/accountlinks.js) — the
// app's own state. Pure code that takes a state uses linkedName/link from accountlinks.js with it.
export function rowAccount(row, field){ return linkedName(row, field || "account", state); }
export function rowAccountRecord(row, field){ return accountFor(row, field || "account", state); }
export function setRowAccount(row, field, nameOrId){ return link(row, field || "account", nameOrId, state); }

// ---------------- Accounts with balances (v3.56.0) ----------------
//
// An account used to be a name and a statement day — somewhere transactions were tagged, with no
// idea how much was in it. The money itself lived elsewhere: a Cash asset on the Assets page, an
// offset balance typed on a property's loan, a debt row under Assets → Debts. Three pages to keep
// one bank account current, and nothing joined the account a payment came out of to its balance.
//
// An account now has a type and a *balance source*: the record that already holds its money and
// that net worth, the projections and the loan maths already read. The balance is stored once, in
// that record, so nothing downstream changes — the account is just the one place to see and update
// it. `link` is "asset:<id>" (a Cash asset), "debt:<id>", "offset:<loanId>" or "loan:<loanId>".
//
// A credit card's limit is a property of the card, not money owed — it lives on the account
// (`limit`) and is never counted anywhere.
export var ACCOUNT_TYPES = [
  { key: "everyday", label: "Everyday", sources: ["asset"] },
  { key: "savings", label: "Savings", sources: ["asset"] },
  { key: "offset", label: "Offset", sources: ["offset"] },
  { key: "credit", label: "Credit card", sources: ["debt"] },
  { key: "loan", label: "Loan", sources: ["loan", "debt"] },
  // v3.101.0: a property manager — not money the household holds, but where the property's bills
  // are paid from: the agent takes them out of the rent before paying the rest over. It has no
  // balance; `link` is "property:<id>", the property whose rent it collects.
  { key: "agent", label: "Property manager", sources: ["property"] }
];
export var ACCOUNT_TYPE_KEYS = ACCOUNT_TYPES.map(function(t){ return t.key; });
export function accountTypeLabel(type){
  var t = ACCOUNT_TYPES.find(function(x){ return x.key === type; });
  return t ? t.label : "Everyday";
}
// Money owed rather than held: a card or a loan. Their balance is shown as owed and counts against.
export function isOwedType(type){ return type === "credit" || type === "loan"; }
export function isAgentType(type){ return type === "agent"; }

// The account a property's manager pays its bills from: the agent account linked to that property,
// else the only agent account there is. Null when there's none (or several and none linked).
export function agentAccountFor(st, propertyId){
  var agents = ((st || state).accounts || []).filter(function(a){ return a && a.type === "agent" && a.name; });
  return agents.find(function(a){ return a.link === "property:" + propertyId; }) ||
    (agents.length === 1 && !agents[0].link ? agents[0] : null);
}
// The names of every property-manager account, for telling "paid by the agent" apart.
export function agentAccountNames(accounts){
  var out = {};
  (accounts || []).forEach(function(a){ if(a && a.type === "agent" && a.name) out[a.name] = true; });
  return out;
}

// Item 245: the account for a property loan — the one linked to it, else a new Loan account linked to it, named after
// the loan. Returns its name.
export function loanAccountFor(loanId, s){
  s = s || state;
  var hit = (s.accounts || []).find(function(a){ return a.link === "loan:" + loanId; });
  if(hit) return hit.name;
  var x = allLoans(s).find(function(y){ return y.loan.id === loanId; });
  if(!x) return "";
  var base = x.loan.what || ((x.property.what || "Property") + " loan"), name = base, n = 2;
  while((s.accounts || []).some(function(a){ return a.name === name; })) name = base + " " + n++;
  if(!Array.isArray(s.accounts)) s.accounts = [];
  s.accounts.push({ id: genId("acct"), name: name, type: "loan", statementStartDay: 1, link: "loan:" + loanId });
  return name;
}
function allLoans(s){
  var out = [];
  ((s || state).properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l){ if(l.id) out.push({ loan: l, property: p }); });
  });
  return out;
}
function cashAssets(s){ return ((s || state).assets || []).filter(function(a){ return a.category === "Cash"; }); }

// What an account's balance can come from, for its type — every record of the right kind, with the
// ones another account already uses marked so the picker can say so.
export function accountSourceOptions(account){
  var type = ACCOUNT_TYPES.find(function(t){ return t.key === account.type; }) || ACCOUNT_TYPES[0];
  var used = {};
  (state.accounts || []).forEach(function(a){ if(a !== account && a.link) used[a.link] = a.name || "another account"; });
  var out = [];
  type.sources.forEach(function(kind){
    if(kind === "asset") cashAssets().forEach(function(a){ if(a.id) out.push({ key: "asset:" + a.id, label: a.what || "Cash", usedBy: used["asset:" + a.id] }); });
    if(kind === "debt") (state.debts || []).forEach(function(d){ if(d.id) out.push({ key: "debt:" + d.id, label: d.what || "Debt", usedBy: used["debt:" + d.id] }); });
    if(kind === "offset") allLoans().forEach(function(x){ out.push({ key: "offset:" + x.loan.id, label: (x.loan.what || x.property.what || "Loan") + " — offset", usedBy: used["offset:" + x.loan.id] }); });
    if(kind === "loan") allLoans().forEach(function(x){ out.push({ key: "loan:" + x.loan.id, label: x.loan.what || x.property.what || "Loan", usedBy: used["loan:" + x.loan.id] }); });
    if(kind === "property") (state.properties || []).forEach(function(p){ if(p.id) out.push({ key: "property:" + p.id, label: p.what || "Property", usedBy: used["property:" + p.id] }); });
  });
  return out;
}

// The record behind a link, or null if it's gone (deleted on the Assets page, say).
export function resolveLink(link, s){
  s = s || state;
  if(!link || typeof link !== "string") return null;
  var i = link.indexOf(":"), kind = link.slice(0, i), id = link.slice(i + 1);
  if(kind === "asset"){ var a = cashAssets(s).find(function(x){ return x.id === id; }); return a ? { kind: kind, record: a, label: a.what || "Cash" } : null; }
  if(kind === "debt"){ var d = (s.debts || []).find(function(x){ return x.id === id; }); return d ? { kind: kind, record: d, label: d.what || "Debt" } : null; }
  if(kind === "property"){ var p = (s.properties || []).find(function(x){ return x.id === id; }); return p ? { kind: kind, record: p, label: p.what || "Property" } : null; }
  if(kind === "offset" || kind === "loan"){
    var hit = allLoans(s).find(function(x){ return x.loan.id === id; });
    return hit ? { kind: kind, record: hit.loan, property: hit.property, label: (hit.loan.what || hit.property.what || "Loan") + (kind === "offset" ? " — offset" : "") } : null;
  }
  return null;
}

function historyOf(src){
  if(!src) return [];
  var r = src.record;
  if(src.kind === "offset") return r.offsetHistory || [];
  if(src.kind === "loan") return r.balanceHistory || [];
  return r.history || [];
}
function valueOf(src){
  if(!src) return null;
  var r = src.record;
  if(src.kind === "asset") return Number(r.amount) || 0;
  if(src.kind === "debt") return Number(r.balance) || 0;
  if(src.kind === "offset") return Number(r.offsetBalance) || 0;
  return Number(r.balance) || 0;
}

// { balance, owed, date, history, source } — balance null when the account has nothing behind it
// yet. `date` is when it was last updated, from the record's history.
export function accountBalance(account){
  var src = resolveLink(account.link);
  if(!src) return { balance: null, owed: isOwedType(account.type), date: null, history: [], source: null };
  // A property manager holds no balance of the household's: the source is only which property.
  if(src.kind === "property") return { balance: null, owed: false, date: null, history: [], source: src };
  var h = historyOf(src);
  return { balance: valueOf(src), owed: isOwedType(account.type), date: h.length ? h[h.length - 1].date : null, history: h, source: src };
}

// v3.112.0: the balance today, from the last one recorded (a statement's closing balance, or typed)
// plus everything logged against the account since — spending and refunds, money received, transfers
// in and out. A card or loan owes: spending adds to it, a repayment takes it down. Loans are left as
// recorded (their repayments go straight to the lender, not through logged transactions), and so is an
// account with nothing recorded yet. opts.accountOf(t) names a transaction's account (default
// t.account); opts.today bounds what counts.
// { balance, recorded, date, moved, count }
export function rolledBalance(account, opts){
  opts = opts || {};
  var b = accountBalance(account);
  var out = { balance: b.balance, recorded: b.balance, date: b.date, moved: 0, count: 0 };
  if(b.balance == null || !b.date || !b.source || b.source.kind === "loan" || b.source.kind === "property") return out;
  var name = account.name, today = opts.today || localDateStr(), since = b.date;
  var accountOf = opts.accountOf || function(t){ return t.account || ""; };
  var inWindow = function(d){ return d && d > since && d <= today; };
  var net = 0;
  (state.transactions || []).forEach(function(t){ if(inWindow(t.date) && accountOf(t) === name){ net -= Number(t.amount) || 0; out.count++; } });
  (state.incomeLog || []).forEach(function(r){ if(inWindow(r.date) && r.account === name){ net += Number(r.amount) || 0; out.count++; } });
  (state.transfers || []).forEach(function(x){
    if(!inWindow(x.date)) return;
    if(x.to === name){ net += Number(x.amount) || 0; out.count++; }
    if(x.from === name){ net -= Number(x.amount) || 0; out.count++; }
  });
  out.moved = Math.round((b.owed ? -net : net) * 100) / 100;
  out.balance = Math.round((b.balance + out.moved) * 100) / 100;
  return out;
}

// ---- Net worth on what's been logged since (v3.135.0, item 166) ----
// Each account's balance moves with everything logged against it since its balance was recorded
// (rolledBalance). The records net worth reads still hold the recorded figure, so this is the
// difference, by record ("asset:<id>", "debt:<id>", "offset:<loanId>"), signed as it moves net
// worth: spending on a card adds to what's owed, so it takes net worth down. calc/ can't import a
// component, so the app registers how a transaction names its account (a line's default account
// counts) — unset, t.account.
var accountOfProvider = null;
export function setAccountOfProvider(fn){ accountOfProvider = fn; }
export function loggedSinceRecorded(today){
  var s = state;
  var byRecord = {}, total = 0;
  (s.accounts || []).forEach(function(a){
    var r = rolledBalance(a, { today: today, accountOf: accountOfProvider || undefined });
    if(!r.count || !r.moved) return;
    var src = resolveLink(a.link, s);
    if(!src || !src.record || !src.record.id) return;
    var delta = isOwedType(a.type) ? -r.moved : r.moved;
    var key = src.kind + ":" + src.record.id;
    byRecord[key] = Math.round(((byRecord[key] || 0) + delta) * 100) / 100;
    total += delta;
  });
  return { byRecord: byRecord, total: Math.round(total * 100) / 100 };
}

// Records a balance on the account's source, creating one first if it has none: a Cash asset for an
// everyday or savings account, a debt for a card or a loan. An offset needs a loan to sit against,
// so it can't be created here — returns false and the caller says so.
export function setAccountBalance(account, value, dateStr){
  var v = Math.round((Number(value) || 0) * 100) / 100;
  dateStr = dateStr || localDateStr();
  var src = resolveLink(account.link);
  if(isAgentType(account.type) || (src && src.kind === "property")) return false;
  if(!src){
    if(account.type === "offset") return false;
    if(isOwedType(account.type)){
      var d = { id: genId("debt"), what: account.name || "Card", balance: 0, history: [] };
      if(!Array.isArray(state.debts)) state.debts = [];
      state.debts.push(d);
      account.link = "debt:" + d.id;
    } else {
      var a = { id: genId("as"), what: account.name || "Cash", category: "Cash", amount: 0, person: account.person || "", history: [] };
      state.assets.push(a);
      account.link = "asset:" + a.id;
    }
    src = resolveLink(account.link);
  }
  var r = src.record;
  if(src.kind === "asset"){ r.amount = v; if(!Array.isArray(r.history)) r.history = []; appendHistorySnapshot(r.history, v, dateStr); }
  else if(src.kind === "debt"){ r.balance = v; if(!Array.isArray(r.history)) r.history = []; appendHistorySnapshot(r.history, v, dateStr); }
  else if(src.kind === "offset"){ r.offsetBalance = v; if(!Array.isArray(r.offsetHistory)) r.offsetHistory = []; appendHistorySnapshot(r.offsetHistory, v, dateStr); }
  else { r.balance = v; if(!Array.isArray(r.balanceHistory)) r.balanceHistory = []; appendHistorySnapshot(r.balanceHistory, v, dateStr); }
  return true;
}

// Every balance the household has, whether or not an account is attached to it — so the Accounts
// page can say "cash held" and "owed" in full, and list what still has no account.
export function accountsOverview(opts){
  var accounts = (state.accounts || []).map(function(a){
    var bal = accountBalance(a);
    // v3.112.0: today's balance, rolled forward from the last recorded one.
    var rolled = rolledBalance(a, opts);
    if(rolled.count) bal = Object.assign({}, bal, { balance: rolled.balance });
    return { account: a, bal: bal, rolled: rolled };
  });
  var linked = {};
  accounts.forEach(function(x){ if(x.bal.source) linked[x.account.link] = true; });
  var loose = [];
  cashAssets().forEach(function(a){ if(a.id && !linked["asset:" + a.id]) loose.push({ link: "asset:" + a.id, label: a.what || "Cash", value: Number(a.amount) || 0, owed: false, suggest: "savings" }); });
  (state.debts || []).forEach(function(d){ if(d.id && !linked["debt:" + d.id]) loose.push({ link: "debt:" + d.id, label: d.what || "Debt", value: Number(d.balance) || 0, owed: true, suggest: /card/i.test(d.what || "") ? "credit" : "loan" }); });
  allLoans().forEach(function(x){
    if(!linked["loan:" + x.loan.id] && !x.loan.endedOn) loose.push({ link: "loan:" + x.loan.id, label: x.loan.what || x.property.what || "Loan", value: Number(x.loan.balance) || 0, owed: true, suggest: "loan" });
    if(!linked["offset:" + x.loan.id] && Number(x.loan.offsetBalance) > 0) loose.push({ link: "offset:" + x.loan.id, label: (x.loan.what || x.property.what || "Loan") + " — offset", value: Number(x.loan.offsetBalance) || 0, owed: false, suggest: "offset" });
  });
  var held = 0, owed = 0;
  accounts.forEach(function(x){ if(x.bal.balance == null) return; if(x.bal.owed) owed += x.bal.balance; else held += x.bal.balance; });
  loose.forEach(function(l){ if(l.owed) owed += l.value; else held += l.value; });
  return { accounts: accounts, loose: loose, held: Math.round(held * 100) / 100, owed: Math.round(owed * 100) / 100 };
}

// The migration that sets `type` and `link` on old saves lives in state.js (migrateAccounts) — state.js
// can't import calc modules — and has to agree with ACCOUNT_TYPES and resolveLink above.
