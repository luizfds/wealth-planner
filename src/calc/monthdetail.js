import { merchantGroupKey } from "./merchants.js";

// ---------------- Month in detail (v3.81.0) ----------------
//
// The month review compares a month with the plan; this compares it with *you*. A plan says "you
// budgeted $600 for eating out"; your own history says "you usually spend $450, and this month was
// $1,100 — nine dinners, one of them $310". So the baseline is the median of the months before it
// (the median, so one holiday doesn't make every other month look frugal), counted only over
// months that actually have spending logged, and the findings are ranked by dollars.
//
// Money in is what's been logged as received (pay, rent from statements, bonuses, refunds) plus
// distributions on holdings. Money out is logged spending, refunds netted. Transfers between your
// own accounts are neither. Loan repayments go between accounts and the lender, not through
// spending, so the planned figure is shown beside "left" rather than mixed into it.
//
// Pure: state comes in as `st`; categoryOf / lineOf resolve a transaction through its budget line.

export function monthBounds(ym){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return { start: ym + "-01", end: ym + "-" + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0") };
}
export function shiftMonth(ym, n){
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + "-" + String(m + 1).padStart(2, "0");
}
function r2(n){ return Math.round(n * 100) / 100; }
export function median(xs){
  var a = (xs || []).filter(function(x){ return typeof x === "number" && !isNaN(x); }).slice().sort(function(p, q){ return p - q; });
  if(!a.length) return 0;
  var mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
function inMonth(d, ym){ return typeof d === "string" && d.slice(0, 7) === ym; }

// What came in during a month, by kind: regular pay, rent, one-offs (bonuses, refunds), distributions.
export function moneyIn(st, ym){
  var by = { pay: 0, rent: 0, oneOff: 0, other: 0, payouts: 0 }, items = [];
  (st.incomeLog || []).forEach(function(r){
    if(!inMonth(r.date, ym)) return;
    var a = Number(r.amount) || 0, t = String(r.target || "");
    var kind = /^net:/.test(t) ? "pay" : /^rent:/.test(t) ? "rent" : /^(oneoff|refund):/.test(t) ? "oneOff" : "other";
    by[kind] += a;
    items.push({ date: r.date, amount: a, what: r.what || "", target: t, kind: kind });
  });
  (st.assets || []).forEach(function(as){
    (as.payouts || []).forEach(function(p){
      if(!inMonth(p.date, ym)) return;
      var a = Number(p.cash) || 0;
      by.payouts += a;
      items.push({ date: p.date, amount: a, what: (as.what || as.symbol || "Holding") + " distribution", kind: "payouts" });
    });
  });
  var total = by.pay + by.rent + by.oneOff + by.other + by.payouts;
  Object.keys(by).forEach(function(k){ by[k] = r2(by[k]); });
  return { total: r2(total), by: by, items: items };
}

function spendIn(st, ym){ return (st.transactions || []).filter(function(t){ return inMonth(t.date, ym); }); }

// One month's figures, without the comparison: { ym, in, out, left, count }.
export function monthFigures(st, ym){
  var tx = spendIn(st, ym);
  var out = tx.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
  var inn = moneyIn(st, ym);
  return { ym: ym, in: inn.total, regularIn: r2(inn.total - inn.by.oneOff), out: r2(out), left: r2(inn.total - out), count: tx.length };
}

// The months a baseline is built from: up to `n` before `ym` that look properly logged — at least
// ten transactions, so a month where only a couple of bills were entered doesn't drag "usual" down.
export var MIN_LOGGED = 10;
export function baselineMonths(st, ym, n){
  n = n || 6;
  var out = [];
  for(var i = 1; i <= 24 && out.length < n; i++){
    var m = shiftMonth(ym, -i);
    if(spendIn(st, m).length >= MIN_LOGGED) out.push(m);
  }
  return out;
}

function keyOf(t, lineOf){
  var k = merchantGroupKey(t.what || "");
  if(k) return k;
  var l = lineOf ? lineOf(t) : null;
  return l && l.what ? "line:" + l.what.toLowerCase() : "";
}
function nameOf(t, lineOf){ var l = lineOf ? lineOf(t) : null; return t.what || (l && l.what) || "A purchase"; }
// A regular bill (a line paid on a schedule, not marked irregular) is never news by itself: rent is
// always the biggest payment, and a renamed rent payment isn't a new payee.
function onRegularLine(t, lineOf){ var l = lineOf ? lineOf(t) : null; return !!(l && !l.irregular); }

export function monthDetail(st, ym, opts){
  opts = opts || {};
  var categoryOf = opts.categoryOf || function(t){ return t.category || ""; };
  var lineOf = opts.lineOf || function(){ return null; };
  var base = baselineMonths(st, ym, opts.baseline || 6);
  // The month still running: compare with the usual *by this day*, and don't call anything missing
  // or low — the month isn't over.
  var today = opts.today || "";
  var b0 = monthBounds(ym);
  var inProgress = !!today && today >= b0.start && today < b0.end;
  var share = inProgress ? Number(today.slice(8, 10)) / Number(b0.end.slice(8, 10)) : 1;
  var tx = spendIn(st, ym);
  var fig = monthFigures(st, ym);
  var inn = moneyIn(st, ym);
  var baseFigs = base.map(function(m){ return monthFigures(st, m); });
  var usual = {
    in: r2(median(baseFigs.map(function(f){ return f.in; }))),
    regularIn: r2(median(baseFigs.map(function(f){ return f.regularIn; }))),
    out: r2(median(baseFigs.map(function(f){ return f.out; }))),
    left: r2(median(baseFigs.map(function(f){ return f.left; }))),
    count: Math.round(median(baseFigs.map(function(f){ return f.count; })))
  };
  if(inProgress) Object.keys(usual).forEach(function(k){ usual[k] = k === "count" ? Math.round(usual[k] * share) : r2(usual[k] * share); });

  // Categories: this month against the median of the same category in the baseline months.
  var cat = {};
  function bucket(name){ return cat[name] || (cat[name] = { name: name, amount: 0, count: 0, ids: [], hist: base.map(function(){ return 0; }), histCount: base.map(function(){ return 0; }) }); }
  tx.forEach(function(t){ var c = bucket(categoryOf(t) || "Uncategorised"); c.amount += Number(t.amount) || 0; c.count++; c.ids.push(t.id); });
  base.forEach(function(m, i){
    spendIn(st, m).forEach(function(t){ var c = bucket(categoryOf(t) || "Uncategorised"); c.hist[i] += Number(t.amount) || 0; c.histCount[i]++; });
  });
  var categories = Object.keys(cat).map(function(k){
    var c = cat[k];
    var usualAmt = r2(median(c.hist) * share), usualCount = Math.round(median(c.histCount) * share);
    return { name: c.name, amount: r2(c.amount), usual: usualAmt, diff: r2(c.amount - usualAmt), count: c.count, usualCount: usualCount, ids: c.ids };
  }).filter(function(c){ return c.amount !== 0 || c.usual !== 0; })
    .sort(function(a, b){ return Math.abs(b.diff) - Math.abs(a.diff); });

  var findings = [];
  // 1. Categories that moved, by dollars — at least $50 and a quarter of usual either way.
  categories.forEach(function(c){
    if(Math.abs(c.diff) < 50 || (c.usual > 0 && Math.abs(c.diff) < c.usual * 0.25)) return;
    if(inProgress && c.diff < 0) return;
    findings.push({ kind: c.diff > 0 ? "up" : "down", weight: Math.abs(c.diff), category: c.name, ids: c.ids,
      text: c.name + " " + (c.diff > 0 ? "$" + Math.round(c.diff) + " more" : "$" + Math.round(-c.diff) + " less") + " than usual ($" + Math.round(c.amount) + " against a usual $" + Math.round(c.usual) +
        (c.count !== c.usualCount ? "; " + c.count + " transaction" + (c.count === 1 ? "" : "s") + " against a usual " + c.usualCount : "") + ")" });
  });
  // 2. Big single spends — the largest this month, called out when nothing in the baseline was bigger.
  var baseMax = 0;
  base.forEach(function(m){ spendIn(st, m).forEach(function(t){ if(!onRegularLine(t, lineOf)) baseMax = Math.max(baseMax, Number(t.amount) || 0); }); });
  tx.filter(function(t){ return !onRegularLine(t, lineOf); }).sort(function(a, b){ return (Number(b.amount) || 0) - (Number(a.amount) || 0); }).slice(0, 3).forEach(function(t, i){
    var a = Number(t.amount) || 0;
    if(a < 200) return;
    var biggest = a > baseMax && base.length;
    if(!biggest && i > 0) return;
    findings.push({ kind: "big", weight: a * (biggest ? 1 : 0.5), ids: [t.id],
      text: nameOf(t, lineOf) + " $" + Math.round(a) + (biggest ? " — your largest one-off spend in " + base.length + " month" + (base.length === 1 ? "" : "s") : " — the biggest this month") });
  });
  // 3. New payees: places not paid in the baseline months, $50 or more this month.
  var seen = {};
  base.forEach(function(m){ spendIn(st, m).forEach(function(t){ var k = keyOf(t, lineOf); if(k) seen[k] = true; }); });
  var fresh = {};
  tx.forEach(function(t){
    var k = keyOf(t, lineOf);
    if(!k || seen[k] || onRegularLine(t, lineOf)) return;
    var f = fresh[k] || (fresh[k] = { name: nameOf(t, lineOf), amount: 0, ids: [] });
    f.amount += Number(t.amount) || 0; f.ids.push(t.id);
  });
  Object.keys(fresh).map(function(k){ return fresh[k]; }).filter(function(f){ return f.amount >= 50; })
    .sort(function(a, b){ return b.amount - a.amount; }).slice(0, 3).forEach(function(f){
      findings.push({ kind: "new", weight: f.amount * 0.6, ids: f.ids, text: "New: " + f.name + " $" + Math.round(f.amount) + (f.ids.length > 1 ? " (" + f.ids.length + " payments)" : "") });
    });
  // 4. Money in that isn't regular — so a bonus month doesn't read as a cheap month.
  inn.items.filter(function(i){ return i.kind === "oneOff" || i.kind === "payouts"; }).forEach(function(i){
    findings.push({ kind: "in", weight: i.amount * 0.8, text: "One-off in: " + (i.what || "money in") + " $" + Math.round(i.amount) });
  });
  if(!inProgress && usual.regularIn > 0 && fig.regularIn > 0 && Math.abs(fig.regularIn - usual.regularIn) >= Math.max(200, usual.regularIn * 0.1)){
    var dIn = fig.regularIn - usual.regularIn;
    findings.push({ kind: dIn > 0 ? "in" : "down-in", weight: Math.abs(dIn) * 0.9, text: "Regular money in $" + Math.round(Math.abs(dIn)) + (dIn > 0 ? " more" : " less") + " than usual ($" + Math.round(fig.regularIn) + " against $" + Math.round(usual.regularIn) + ")" });
  }
  // 5. Trips in the month.
  (st.trips || []).forEach(function(tr){
    var b = monthBounds(ym);
    if(!tr.from || tr.from > b.end || (tr.to || tr.from) < b.start) return;
    var spent = tx.filter(function(t){ return t.date >= tr.from && t.date <= (tr.to || tr.from) && t.linkedExpenseId === tr.lineId; }).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    findings.push({ kind: "trip", weight: spent * 0.7, text: "Trip: " + tr.name + " $" + Math.round(spent) });
  });
  // 6. Regular bills that usually come and didn't, or came twice.
  var lineMonths = {};
  base.slice(0, 4).forEach(function(m){
    var per = {};
    spendIn(st, m).forEach(function(t){ if(t.linkedExpenseId) per[t.linkedExpenseId] = (per[t.linkedExpenseId] || 0) + 1; });
    Object.keys(per).forEach(function(id){ (lineMonths[id] = lineMonths[id] || []).push(per[id]); });
  });
  var thisPer = {};
  tx.forEach(function(t){ if(t.linkedExpenseId) thisPer[t.linkedExpenseId] = (thisPer[t.linkedExpenseId] || 0) + 1; });
  (inProgress ? [] : opts.monthlyBills || []).forEach(function(l){
    var hist = lineMonths[l.id] || [];
    if(hist.length >= 3 && hist.every(function(n){ return n === 1; })){
      if(!thisPer[l.id]) findings.push({ kind: "missing", weight: (Number(l.amount) || 0) * 0.5 + 1, text: (l.what || "A bill") + " usually comes every month — nothing logged this month" });
      else if(thisPer[l.id] >= 2) findings.push({ kind: "twice", weight: (Number(l.amount) || 0) * 0.5 + 1, text: (l.what || "A bill") + " came " + thisPer[l.id] + " times this month (usually once)" });
    }
  });
  findings.sort(function(a, b){ return b.weight - a.weight; });
  // One purchase, one finding: a new payee that's also the month's biggest spend is said once.
  var told = {};
  findings = findings.filter(function(f){
    if(f.kind !== "big" && f.kind !== "new") return true;
    var ids = f.ids || [];
    if(ids.length && ids.every(function(id){ return told[id]; })) return false;
    ids.forEach(function(id){ told[id] = true; });
    return true;
  });

  // A month with far fewer transactions than usual is probably only partly logged.
  var partial = !inProgress && usual.count >= 10 && fig.count < usual.count * 0.5;
  return {
    ym: ym, figures: fig, usual: usual, baseline: base, moneyIn: inn, categories: categories,
    findings: findings, partial: partial, inProgress: inProgress, throughDay: inProgress ? Number(today.slice(8, 10)) : null,
    loanMonthly: r2(Number(opts.loanMonthly) || 0)
  };
}

// The last `n` months ending at `ym`, oldest first, for the strip at the top.
export function monthTrend(st, ym, n){
  var out = [];
  for(var i = (n || 12) - 1; i >= 0; i--) out.push(monthFigures(st, shiftMonth(ym, -i)));
  return out;
}
