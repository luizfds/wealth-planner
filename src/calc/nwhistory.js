import { state } from "../state.js";
import { valueOn } from "./history.js";
import { toAudAmount } from "./engine.js";
import { loanBalance } from "./property.js";

// ---------------- Net worth on a past date (v3.67.0) ----------------
//
// The same rules the net-worth chart on Investments uses (components/assets.js), as a pure function
// so the Reports statement can put "a month ago" and "a year ago" beside today: each asset, property
// value and debt at its last recorded value on or before the date; something with no record by
// then counts nothing (it wasn't tracked yet). Loans at their recorded balance where one exists
// (Accounts records them since v3.56.0), else today's. `partial` lists what had no record yet,
// so a comparison can say it isn't like for like.
function at(history, current, date, today){
  if(!history || !history.length) return date >= today ? (Number(current) || 0) : null;
  return valueOn(history, date);
}
export function netWorthOn(date, today){
  var parts = { assets: {}, property: 0, offsets: 0, loans: 0, debts: 0 };
  var partial = [];
  (state.assets || []).forEach(function(a){
    var v = at(a.history, a.amount, date, today);
    if(v == null){ if(Number(a.amount)) partial.push(a.what || a.category || "an asset"); return; }
    var c = a.category || "Other";
    parts.assets[c] = (parts.assets[c] || 0) + toAudAmount(a, v);
  });
  (state.properties || []).forEach(function(p){
    var v = at(p.history, p.value, date, today);
    if(v == null){ partial.push(p.what || "a property"); return; }
    parts.property += Number(v) || 0;
    (p.loans || []).forEach(function(l){
      var bal = l.balanceHistory && l.balanceHistory.length ? valueOn(l.balanceHistory, date) : null;
      if(bal == null) bal = loanBalance(l);
      var off = l.offsetHistory && l.offsetHistory.length ? valueOn(l.offsetHistory, date) : null;
      if(off == null) off = Number(l.offsetBalance) || 0;
      parts.loans += Math.max(0, Number(bal) || 0);
      parts.offsets += Math.min(Number(off) || 0, Math.max(0, Number(bal) || 0));
    });
  });
  (state.debts || []).forEach(function(d){
    var v = at(d.history, d.balance, date, today);
    if(v == null){ if(Number(d.balance)) partial.push(d.what || "a debt"); return; }
    parts.debts += Number(v) || 0;
  });
  var assetsTotal = Object.keys(parts.assets).reduce(function(s, k){ return s + parts.assets[k]; }, 0);
  var total = assetsTotal + parts.property + parts.offsets - parts.loans - parts.debts;
  return { date: date, total: Math.round(total * 100) / 100, parts: parts, partial: partial };
}
export function shiftDate(iso, months){
  var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + months, d = Number(iso.slice(8, 10));
  var last = new Date(y, m + 1, 0).getDate();
  var dt = new Date(y, m, Math.min(d, last));
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
}
