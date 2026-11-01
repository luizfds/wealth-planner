// ---------------- Accounts linked by id (v3.204.0, item 235b) ----------------
//
// A row that says which account money moved through used to carry only the account's name, a string
// key nothing enforced: renaming an account meant walking every array that might name it, and an array
// forgotten there kept the old name for good. Now each link carries the account's id beside the name:
//
//   row.account → row.accountId      (budget lines, income, transactions, money received, home rows,
//                                       a property's income and costs, import rules)
//   transfer / automatic payment .from → .fromId, .to → .toId
//   a credit card's .autoPayFrom → .autoPayFromId     an import rule's .transferAccount → .transferAccountId
//   a savings goal's .accounts (names) → .accountIds  a saved view's filter.account → filter.accountId
//   a month review's statements { name: amount } → statementsById { id: amount }
//
// The id says which account; the name beside it is a copy, kept current: a rename (renameAccount) writes the
// new name onto every row linked to the account by id, so no list of "arrays that might name it" has to be
// remembered at rename time — the links are found once, by everyAccountLink, and tested. Deleting an account
// leaves its name on its rows, so they still say where the money went; adding an account of the same name
// again picks them back up, as before.
//
// accountFor / linkedName / isLinkedTo read a link; link writes one (setRowAccount in calc/accounts.js for the
// app's state). Pure: everything takes the state.

export var ID_FIELD = { account: "accountId", from: "fromId", to: "toId", autoPayFrom: "autoPayFromId", transferAccount: "transferAccountId" };
export function idField(field){ return ID_FIELD[field] || field + "Id"; }

function accountsOf(st){ return (st && st.accounts) || []; }
export function accountById(id, st){ return id ? accountsOf(st).find(function(a){ return a && a.id === id; }) || null : null; }
export function accountByName(name, st){
  var n = String(name || "").trim();
  return n ? accountsOf(st).find(function(a){ return a && a.name === n; }) || null : null;
}
// The account a row's link points at: its id's account, unless its name says another (an edit by name), or none.
export function accountFor(row, field, st){
  if(!row) return null;
  field = field || "account";
  var byId = accountById(row[idField(field)], st), byName = accountByName(row[field], st);
  // The same rule as linkAllByName: a name that says another account is an edit not yet linked.
  if(byId && byId.name === String(row[field] || "")) return byId;
  return byName || (String(row[field] || "").trim() ? byId : null);
}
// What to call it: the account's name now, else the name kept on the row.
export function linkedName(row, field, st){
  if(!row) return "";
  field = field || "account";
  var a = accountFor(row, field, st);
  return a ? a.name : String(row[field] || "");
}
// Whether a row's link is to this account (an account, its id or its name).
export function isLinkedTo(row, field, target, st){
  if(!row || !target) return false;
  field = field || "account";
  var a = typeof target === "object" ? target : accountById(target, st) || accountByName(target, st);
  if(a) { var mine = accountFor(row, field, st); return !!mine && mine.id === a.id; }
  return linkedName(row, field, st) === String(target);
}
// Point a row at an account, by its name or id ("" clears the link). The name is kept as the snapshot.
export function link(row, field, nameOrId, st){
  field = field || "account";
  var a = accountById(nameOrId, st) || accountByName(nameOrId, st);
  if(a){ row[field] = a.name; row[idField(field)] = a.id; }
  else { row[field] = String(nameOrId || ""); delete row[idField(field)]; }
  return row;
}

// Every link in a state: [{ row, field }], plus the lists keyed some other way.
export function everyAccountLink(st){
  var out = [];
  var rows = function(list, field){ (list || []).forEach(function(r){ if(r && typeof r === "object") out.push({ row: r, field: field }); }); };
  rows(st.income, "account"); rows(st.shared, "account"); rows(st.transactions, "account"); rows(st.incomeLog, "account");
  Object.keys(st.home || {}).forEach(function(k){ rows(st.home[k], "account"); });
  (st.properties || []).forEach(function(p){ rows(p.income, "account"); rows(p.expenses, "account"); });
  rows(st.transfers, "from"); rows(st.transfers, "to");
  rows(st.autoPayments, "from"); rows(st.autoPayments, "to");
  rows(st.accounts, "autoPayFrom");
  rows(st.importRules, "account"); rows(st.importRules, "transferAccount");
  return out;
}

// Every load (a migration step) and before a rename: each link's id made right. The name copy is kept
// current by renameAccount, so on load the two disagree only where a row was edited by its name (an
// account picked from a list, typed into a field): then the name says which account, and the id follows.
//   name is the id's account's name      → as it is
//   name is another account's name       → linked to that account (an edit)
//   name matches no account, id is valid → the id's account, its name written back
//   no account either way, or no name    → a plain name, unlinked (a deleted account keeps its name)
// Goals, saved views and month statements are edited by name the same way, so their ids follow the names.
export function linkAllByName(st){
  everyAccountLink(st).forEach(function(x){
    var id = idField(x.field), name = String(x.row[x.field] || "");
    var byId = accountById(x.row[id], st), byName = accountByName(name, st);
    if(byId && byId.name === name) return;
    if(byName){ x.row[id] = byName.id; return; }
    if(byId && name.trim()){ x.row[x.field] = byId.name; return; }
    delete x.row[id];
  });
  (st.savingsGoals || []).forEach(function(g){
    if(!g || typeof g !== "object") return;
    g.accountIds = (Array.isArray(g.accounts) ? g.accounts : []).map(function(n){ var a = accountByName(n, st); return a ? a.id : null; }).filter(Boolean);
  });
  (st.txViews || []).forEach(function(v){
    var f = v && v.filter;
    if(!f) return;
    var a = accountByName(f.account, st);
    if(a) f.accountId = a.id; else delete f.accountId;
  });
  Object.keys(st.monthReviews || {}).forEach(function(ym){
    var rec = st.monthReviews[ym];
    if(!rec || !rec.statements || typeof rec.statements !== "object") return;
    rec.statementsById = {};
    Object.keys(rec.statements).forEach(function(n){ var a = accountByName(n, st); if(a) rec.statementsById[a.id] = rec.statements[n]; });
  });
  return st;
}

// A savings goal's accounts, now: the accounts its ids point at (and, for one whose account is gone, its kept name).
export function goalAccounts(goal, st){
  var ids = Array.isArray(goal.accountIds) ? goal.accountIds : [];
  var found = ids.map(function(id){ return accountById(id, st); }).filter(Boolean);
  if(!ids.length) found = (goal.accounts || []).map(function(n){ return accountByName(n, st); }).filter(Boolean);
  return found;
}

// Rename: edits made by name are linked first, then the account's own record, then every copy of its
// name — on the rows, goals, saved views and statements linked to it by id. Nothing is matched by name.
export function renameAccount(st, account, newName){
  linkAllByName(st);
  var oldName = account.name;
  account.name = newName;
  everyAccountLink(st).forEach(function(x){ if(x.row[idField(x.field)] === account.id) x.row[x.field] = newName; });
  (st.savingsGoals || []).forEach(function(g){
    if(!g || !Array.isArray(g.accountIds) || g.accountIds.indexOf(account.id) === -1) return;
    g.accounts = (g.accounts || []).map(function(n){ return n === oldName ? newName : n; });
  });
  (st.txViews || []).forEach(function(v){ var f = v && v.filter; if(f && f.accountId === account.id) f.account = newName; });
  Object.keys(st.monthReviews || {}).forEach(function(ym){
    var rec = st.monthReviews[ym];
    if(!rec || !rec.statementsById || rec.statementsById[account.id] == null) return;
    if(rec.statements){ delete rec.statements[oldName]; rec.statements[newName] = rec.statementsById[account.id]; }
  });
  return st;
}
