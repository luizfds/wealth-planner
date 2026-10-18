import { state, genId } from "../state.js";
import { periodsOf, sumField, householdYearWindow, selectedMonth, monthPhrase } from "./ledger.js";
import { localDateStr } from "../lib/format.js";
import { getTaxPeople } from "./tax.js";

// ---------------- Income received (v3.46.0) ----------------
//
// Transactions only ever recorded money going out (or coming back as a refund), so the app could
// say how this month's spending compared with the plan but had nothing to say about pay, rent or
// distributions. This is the other half: money in, logged against what it was planned as.
//
// It deliberately isn't state.transactions. Every spending figure in the app sums that array, and a
// salary instalment counted as negative spending is exactly the failure the bank import's comments
// warn about. Received money lives in state.incomeLog = [{id, date, amount, what, account, target}].
//
// A target is one of:
//   "net:<person>"   take-home pay — what lands from all of a person's Gross rows, so it's
//                    planned against their after-tax net income row, not the gross figures
//   "income:<id>"    a Net income row, received as-is
//   "rent:<propId>"  an investment property's rent, as the agent pays it (after their fees)
//   "payout:<i>"     a distribution on holding state.assets[i] — written to that holding's
//                    payouts (v3.38.0), where it already counts toward the return and the tax year
export function incomeTargets(){
  var out = [];
  getTaxPeople().forEach(function(person){
    var net = (state.income || []).find(function(i){ return i.syntheticNetFor === person; });
    out.push({ key: "net:" + person, label: person + " — take-home pay", kind: "net",
      monthly: net ? periodsOf(Number(net.amount) || 0, net.freq).monthly : 0, irregular: false });
  });
  (state.income || []).forEach(function(i){
    if(i.computed || i.syntheticNetFor || i.syntheticRentForProperty || i.incomeType === "Gross" || !i.id) return;
    out.push({ key: "income:" + i.id, label: i.what || "Income", kind: "income",
      monthly: periodsOf(Number(i.amount) || 0, i.freq).monthly, irregular: !!i.irregular,
      yearly: periodsOf(Number(i.amount) || 0, i.freq).yearly, account: i.account || "" });
  });
  (state.properties || []).forEach(function(p){
    if(p.kind !== "IP" || !(p.income || []).length) return;
    // What the agent actually pays out: rent less their computed fee.
    var fees = (p.expenses || []).filter(function(e){ return e.computed && /^pmFee/.test(e.id || ""); });
    out.push({ key: "rent:" + p.id, label: (p.what || "Property") + " — rent", kind: "rent",
      monthly: sumField(p.income, "monthly") - sumField(fees, "monthly"), irregular: false,
      account: (p.income[0] && p.income[0].account) || "" });
  });
  (state.assets || []).forEach(function(a, i){
    // Crypto pays nothing to log; a holding sold down to nothing has nothing left to pay.
    if(a.category !== "Shares" || a.market === "Crypto" || !(Number(a.quantity) > 0)) return;
    var perUnit = Number(a.dividendPerUnit) || 0;
    out.push({ key: "payout:" + i, label: (a.what || a.symbol || "Holding") + " — distribution", kind: "payout",
      monthly: perUnit * Number(a.quantity) / 12, irregular: true, yearly: perUnit * Number(a.quantity) });
  });
  return out;
}

function inWindow(date, start, end){ return !!date && date >= start && date <= end; }
function monthBounds(monthStr){
  monthStr = monthStr || selectedMonth();
  var y = Number(monthStr.slice(0, 4)), m = Number(monthStr.slice(5, 7));
  var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: monthStr + "-01", end: monthStr + "-" + String(last).padStart(2, "0") };
}

// Everything received against one target in a window, newest first: [{id, date, amount, what, payout?}].
export function receivedFor(key, start, end){
  if(key.indexOf("payout:") === 0){
    var a = state.assets[Number(key.slice(7))];
    return ((a && a.payouts) || []).filter(function(p){ return inWindow(p.date, start, end); })
      .map(function(p){ return { id: p.id, date: p.date, amount: Number(p.cash) || 0, what: p.what || "", payout: true }; })
      .sort(function(x, y){ return x.date < y.date ? 1 : -1; });
  }
  return (state.incomeLog || []).filter(function(r){ return r.target === key && inWindow(r.date, start, end); })
    .slice().sort(function(x, y){ return x.date < y.date ? 1 : -1; });
}

// Each target with what was planned and what arrived. A regular line is judged on this month; an
// irregular one (a bonus, a distribution) on the household's year, because a month says nothing
// about something paid twice a year.
export function incomeActuals(monthStr){
  var explicit = !!monthStr;
  monthStr = monthStr || selectedMonth();
  var mb = monthBounds(monthStr);
  var yw = householdYearWindow();
  return incomeTargets().map(function(t){
    var win = t.irregular ? { start: yw.start, end: yw.end } : mb;
    var rows = receivedFor(t.key, win.start, win.end);
    var received = rows.reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
    var planned = t.irregular ? (t.yearly != null ? t.yearly : t.monthly * 12) : t.monthly;
    return Object.assign({}, t, { period: t.irregular ? yw.label : (explicit ? "this month" : monthPhrase(monthStr)), planned: Math.round(planned * 100) / 100,
      received: Math.round(received * 100) / 100, rows: rows });
  });
}

// Records money received. Returns the record (or the payout) so the caller can undo it.
export function logIncomeReceived(entry){
  var key = String(entry.target || "");
  var amount = Math.abs(Number(entry.amount) || 0);
  var date = entry.date || localDateStr();
  if(!key || !(amount > 0)) return null;
  if(key.indexOf("payout:") === 0){
    var a = state.assets[Number(key.slice(7))];
    if(!a) return null;
    if(!Array.isArray(a.payouts)) a.payouts = [];
    var p = { id: genId("po"), date: date, cash: amount, credit: 0 };
    if(entry.what) p.what = String(entry.what);
    a.payouts.push(p);
    return { id: p.id, payout: true, target: key };
  }
  if(!Array.isArray(state.incomeLog)) state.incomeLog = [];
  var r = { id: genId("in"), date: date, amount: amount, what: String(entry.what || ""), account: String(entry.account || ""), target: key };
  state.incomeLog.push(r);
  return r;
}

// Removes a received record by id, wherever it lives. Returns a restore function, or null.
export function deleteIncomeReceived(id){
  var log = state.incomeLog || [];
  var i = log.findIndex(function(r){ return r.id === id; });
  if(i !== -1){
    var removed = log.splice(i, 1)[0];
    return function(){ state.incomeLog.splice(Math.min(i, state.incomeLog.length), 0, removed); };
  }
  for(var a = 0; a < (state.assets || []).length; a++){
    var list = state.assets[a].payouts || [];
    var j = list.findIndex(function(p){ return p.id === id; });
    if(j !== -1){
      var asset = state.assets[a], gone = list.splice(j, 1)[0];
      return function(){ asset.payouts.splice(Math.min(j, asset.payouts.length), 0, gone); };
    }
  }
  return null;
}
