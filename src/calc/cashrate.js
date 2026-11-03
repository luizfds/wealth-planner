import { loanRateOn, recordRateChange } from "./property.js";

// ---------------- The RBA cash rate (item 249) ----------------
//
// A scheduled job (scripts/cashrate/fetch.mjs, .github/workflows/cashrate.yml) reads the RBA's cash rate decisions
// into rates/cash-rate.json on this site — like the daily price file, so the app asks only its own site. The app
// reads it once a day into state.cashRate = { rate, effective, previous, change, seen, readOn }, says once when the
// rate has moved (`seen` is the move last answered), and offers to record the move on the household's loans, which
// it can't do by itself: a lender's rate and its start date are the lender's. A scenario's purchase or investment
// property can follow it: `rateFollowsCash` with `rateCashAt`, the cash rate its typed rate assumes — when the cash
// rate moves, the rate moves by as much, and a rate typed later is kept and moved from. Pure.

function r2(n){ return Math.round(n * 100) / 100; }
var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function pad(n){ return String(n).padStart(2, "0"); }
// "04-Nov-2026", "4/11/2026", "2026-11-04" → "2026-11-04"; anything else → null.
export function rbaDate(s){
  s = String(s || "").trim();
  var m = /^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/](\d{4})$/.exec(s);
  if(m && MONTHS[m[2].toLowerCase()]) return m[3] + "-" + pad(MONTHS[m[2].toLowerCase()]) + "-" + pad(m[1]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(m) return m[3] + "-" + pad(m[2]) + "-" + pad(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? s : null;
}
function csvRows(text){
  return String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).map(function(line){
    var out = [], cur = "", q = false;
    for(var i = 0; i < line.length; i++){
      var ch = line[i];
      if(q){ if(ch === '"' && line[i + 1] === '"'){ cur += '"'; i++; } else if(ch === '"') q = false; else cur += ch; }
      else if(ch === '"') q = true;
      else if(ch === ","){ out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}
// An RBA statistical table as CSV (A2, the decisions, or F1.1, the daily rates): a few rows describing each column,
// then a row per date. The column is the one titled "Cash Rate Target" ("New Cash Rate Target" in A2). Returns the
// rate's change points, oldest first: [{ effective, rate }]. Throws when it can't find the column or any rows, so
// the job fails where it can be seen instead of publishing nothing as if it were the news.
export function parseRbaCsv(text){
  var rows = csvRows(text);
  // The level, not the change: A2 also has a column for how far each decision moved it.
  var titles = [];
  rows.slice(0, 20).forEach(function(r){ r.forEach(function(cell, j){ if(j > 0 && /cash rate target/i.test(cell) && !/change/i.test(cell)) titles.push({ j: j, cell: cell }); }); });
  var pick = titles.find(function(t){ return /new cash rate target/i.test(t.cell); }) || titles.find(function(t){ return /^\s*cash rate target/i.test(t.cell); }) || titles[0];
  var col = pick ? pick.j : -1;
  if(col < 0) throw new Error("no \"Cash Rate Target\" column in the RBA's file");
  var points = [];
  rows.forEach(function(r){
    var d = rbaDate(r[0]);
    if(!d || r[col] == null) return;
    var v = parseFloat(String(r[col]).replace(/[^0-9.-]/g, " ").trim().split(/\s+/)[0]);
    if(isFinite(v)) points.push({ effective: d, rate: v });
  });
  if(!points.length) throw new Error("no dated rates in the RBA's file");
  points.sort(function(a, b){ return a.effective < b.effective ? -1 : a.effective > b.effective ? 1 : 0; });
  return points.filter(function(p, k){ return k === 0 || p.rate !== points[k - 1].rate; });
}
// What rates/cash-rate.json holds: the rate now, the one before it, and the last few decisions.
export function cashRateFile(points, updated){
  var cur = points[points.length - 1], prev = points.length > 1 ? points[points.length - 2] : null;
  return {
    updated: updated, source: "Reserve Bank of Australia — cash rate target",
    current: { rate: cur.rate, effective: cur.effective },
    previous: prev ? { rate: prev.rate, effective: prev.effective } : null,
    decisions: points.slice(-24).map(function(p, k, all){ var b = k ? all[k - 1] : (points.length > 24 ? points[points.length - 25] : null); return { effective: p.effective, rate: p.rate, change: b ? r2(p.rate - b.rate) : null }; })
  };
}

function daysBetween(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
// state.cashRate after reading the file on `today`. A household reading it for the first time hears about a move
// from the last six weeks, not older news.
export function cashRateFromFile(file, prev, today){
  if(!file || !file.current || !(Number(file.current.rate) >= 0) || !file.current.effective) return prev || null;
  var cur = file.current, before = file.previous;
  var change = before && isFinite(Number(before.rate)) ? r2(Number(cur.rate) - Number(before.rate)) : 0;
  var seen = prev ? prev.seen : (daysBetween(cur.effective, today) <= 45 ? null : cur.effective);
  return { rate: Number(cur.rate), effective: cur.effective, previous: before ? Number(before.rate) : null, change: change, seen: seen === undefined ? null : seen, readOn: today };
}
// The move not answered yet, or null.
export function cashRateMove(st){
  var c = st && st.cashRate;
  if(!c || !c.effective || !c.change || c.seen === c.effective) return null;
  return { rate: c.rate, previous: c.previous, change: c.change, effective: c.effective };
}
// The household's loans the move could apply to, with their rate on `date` and after it.
export function loansForMove(st, change, date){
  var out = [];
  (st.properties || []).forEach(function(p){
    (p.loans || []).forEach(function(l, i){
      if(l.endedOn) return;
      var from = loanRateOn(l, date);
      out.push({ propertyId: p.id, loanIndex: i, what: l.what || ((p.what || "Property") + " loan"), property: p.what || "", from: from, to: r2(from + change) });
    });
  });
  return out;
}
// Records the move from `date` on each loan picked ("propertyId:loanIndex"), and marks it answered.
export function recordCashRateMove(st, picks, date, today){
  var move = cashRateMove(st);
  if(!move) return 0;
  var n = 0;
  (picks || []).forEach(function(key){
    var bits = String(key).split(":"), p = (st.properties || []).find(function(x){ return x.id === bits[0]; });
    var l = p && (p.loans || [])[Number(bits[1])];
    if(!l) return;
    recordRateChange(l, date, r2(loanRateOn(l, date) + move.change), today);
    n++;
  });
  st.cashRate.seen = move.effective;
  return n;
}
// Every scenario rate set to follow the cash rate, moved to it. Returns how many moved.
export function applyCashRate(st){
  var cash = st && st.cashRate && Number(st.cashRate.rate);
  if(!(cash >= 0)) return 0;
  var n = 0;
  var follow = function(o, keys){
    if(!o || !o.rateFollowsCash) return;
    if(o.rateCashAt == null || o.rateCashAt === ""){ o.rateCashAt = cash; return; }
    var d = r2(cash - Number(o.rateCashAt));
    o.rateCashAt = cash;
    if(!d) return;
    keys.forEach(function(k){ if(o[k] != null && o[k] !== "") o[k] = r2((Number(o[k]) || 0) + d); });
    n++;
  };
  Object.keys(st.purchase || {}).forEach(function(k){ follow(st.purchase[k], ["rate", "ioRate"]); });
  Object.keys(st.scenarioChanges || {}).forEach(function(k){
    (st.scenarioChanges[k] || []).forEach(function(c){ if(c && c.kind === "ip") follow(c, ["rate"]); });
  });
  return n;
}
// The file read on `today`, taken in: state.cashRate, and every following scenario rate moved. Says what changed.
export function takeCashRateFile(st, file, today){
  var before = JSON.stringify(st.cashRate);
  st.cashRate = cashRateFromFile(file, st.cashRate, today);
  var moved = applyCashRate(st);
  var changed = JSON.stringify(st.cashRate) !== before;
  return { moved: moved, changed: changed, news: !!(moved || (changed && cashRateMove(st))) };
}
// "Not now": the move is answered without recording it anywhere.
export function setCashRateMoveAside(st){
  if(st.cashRate) st.cashRate.seen = st.cashRate.effective;
}
