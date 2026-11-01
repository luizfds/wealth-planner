import { genId } from "../state.js";
import { financialYearOf } from "./property.js";
import { agentAccountFor } from "./accounts.js";

// ---------------- A property manager's statement in one step (v3.79.0) ----------------
//
// A monthly statement is one document: rent collected, the tenant's water usage passed back, the
// manager's fee and statement fee, any bills they paid out of the rent (water rates, a plumber),
// and what's left paid to you. Entering it used to be four separate jobs on three pages. Here it's
// one record on the property, which writes:
//   - what was paid to you, as rent received (the same "rent as the agent pays it" the Income page
//     logs), on the account it landed in;
//   - each bill paid out of the rent, as a transaction on that property's cost line, with no
//     account (the money never passed through one of yours);
// and keeps the statement itself, so a year's statements add up to the agent's annual summary.
// The manager's fee isn't logged as a transaction: it's a computed line, worked out from the rent.

function money(v){ return Math.round((Number(v) || 0) * 100) / 100; }

export function statementTotals(s){
  var others = (s.others || []).reduce(function(t, o){ return t + money(o.amount); }, 0);
  var moneyIn = money(s.rent) + money(s.water);
  var moneyOut = money(s.fees) + money(s.waterRates) + others;
  return { moneyIn: money(moneyIn), moneyOut: money(moneyOut), net: money(moneyIn - moneyOut) };
}

// The property's water-rates line, by name.
export function waterRatesLine(p){
  return (p.expenses || []).find(function(e){ return !e.computed && /water/i.test(e.what || ""); }) || null;
}

// Writes a statement into st (the app state) for property p. Returns the stored record, or null
// when there's nothing in it. `s`: { date, rent, water, fees, waterRates, others: [{ lineId, amount, what }], account }.
export function logAgentStatement(st, p, s){
  var t = statementTotals(s);
  if(!(t.moneyIn > 0) && !(t.moneyOut > 0)) return null;
  var rec = { id: genId("ast"), date: s.date, rent: money(s.rent), water: money(s.water), fees: money(s.fees), waterRates: money(s.waterRates),
    others: (s.others || []).filter(function(o){ return money(o.amount) > 0; }).map(function(o){ return { lineId: o.lineId || "", amount: money(o.amount), what: String(o.what || "") }; }),
    net: t.net, incomeId: null, txIds: [] };
  if(!Array.isArray(st.incomeLog)) st.incomeLog = [];
  if(!Array.isArray(st.transactions)) st.transactions = [];
  if(t.net > 0){
    var inc = { id: genId("in"), date: s.date, amount: t.net, what: "Statement " + s.date, account: String(s.account || ""), target: "rent:" + p.id };
    st.incomeLog.push(inc);
    rec.incomeId = inc.id;
  }
  var water = waterRatesLine(p);
  var bills = [];
  if(rec.waterRates > 0) bills.push({ lineId: water ? water.id : "", amount: rec.waterRates, what: "Water rates (paid by agent)" });
  rec.others.forEach(function(o){ bills.push({ lineId: o.lineId, amount: o.amount, what: (o.what || "Paid by agent") }); });
  // v3.101.0: tagged with the property manager's account when there is one, so the bills read as
  // paid from the rent — not a direct debit to chase, not money leaving the household's accounts.
  var agent = agentAccountFor(st, p.id);
  bills.forEach(function(b){
    var tx = { id: genId("t"), date: s.date, amount: b.amount, what: b.what, linkedExpenseId: b.lineId || null, account: agent ? agent.name : "", category: b.lineId ? "" : "Investment property" };
    st.transactions.push(tx);
    rec.txIds.push(tx.id);
  });
  if(!Array.isArray(p.agentStatements)) p.agentStatements = [];
  p.agentStatements.push(rec);
  p.agentStatements.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return rec;
}

// Bills logged from statements before a property manager account existed carry no account. Gives
// them the property's agent account now. Returns how many it filled. Only blanks are touched — a
// bill someone re-tagged by hand keeps what they chose.
export function fillAgentAccount(st){
  var n = 0;
  (st.properties || []).forEach(function(p){
    var agent = agentAccountFor(st, p.id);
    if(!agent) return;
    var ids = {};
    (p.agentStatements || []).forEach(function(r){ (r.txIds || []).forEach(function(id){ ids[id] = true; }); });
    (st.transactions || []).forEach(function(t){ if(ids[t.id] && !t.account){ t.account = agent.name; n++; } });
  });
  return n;
}

// Takes a statement back out, with everything it wrote.
export function removeAgentStatement(st, p, id){
  var i = (p.agentStatements || []).findIndex(function(r){ return r.id === id; });
  if(i === -1) return false;
  var rec = p.agentStatements[i];
  st.incomeLog = (st.incomeLog || []).filter(function(r){ return r.id !== rec.incomeId; });
  st.transactions = (st.transactions || []).filter(function(t){ return rec.txIds.indexOf(t.id) === -1; });
  p.agentStatements.splice(i, 1);
  return true;
}

// A financial year's statements added up — what the agent's annual summary will say.
export function statementsForFy(p, fy){
  var out = { count: 0, rent: 0, water: 0, fees: 0, waterRates: 0, other: 0, net: 0 };
  (p.agentStatements || []).forEach(function(r){
    if(financialYearOf(r.date) !== fy) return;
    out.count++;
    out.rent += r.rent; out.water += r.water; out.fees += r.fees; out.waterRates += r.waterRates;
    out.other += (r.others || []).reduce(function(t, o){ return t + o.amount; }, 0);
    out.net += r.net;
  });
  Object.keys(out).forEach(function(k){ if(k !== "count") out[k] = money(out[k]); });
  return out;
}

// v3.208.0 (item 240): a property's most recent statement, by date (null when none is logged).
export function latestStatement(p){
  return ((p && p.agentStatements) || []).reduce(function(best, r){ return !best || String(r.date || "") >= String(best.date || "") ? r : best; }, null);
}
