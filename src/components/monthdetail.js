import { state } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { fmtCurrency0, fmtCurrency2, localDateStr } from "../lib/format.js";
import { monthDetail, monthTrend, shiftMonth } from "../calc/monthdetail.js";
import { ipLoansMonthly } from "../calc/property.js";
import { budgetLineItems, transactionCategory } from "./expenses.js";

// ---------------- Reports → Month in detail (v3.81.0) ----------------
var NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function label(ym){ return NAMES[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4); }
function short(ym){ return NAMES[Number(ym.slice(5, 7)) - 1].slice(0, 3); }
// Session-only: which month is shown, and which categories are opened up.
export var monthDetailUi = { ym: "", open: {} };
export function shownMonth(){
  if(!monthDetailUi.ym) monthDetailUi.ym = shiftMonth(localDateStr().slice(0, 7), -1);
  return monthDetailUi.ym;
}

function money(v){ return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v)); }
function vsUsual(now, usual, goodWhenHigher){
  if(!usual) return '<small>no usual yet</small>';
  var d = now - usual, good = goodWhenHigher ? d >= 0 : d <= 0;
  if(Math.abs(d) < 1) return '<small>about usual</small>';
  return '<small class="' + (good ? "up" : "down") + '">' + (d > 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(d)) + ' vs usual ' + fmtCurrency0.format(usual) + '</small>';
}

export function monthDetailData(ym){
  var lines = budgetLineItems(), byId = {};
  lines.forEach(function(l){ byId[l.id] = l; });
  return monthDetail(state, ym, {
    categoryOf: transactionCategory,
    lineOf: function(t){ return byId[t.linkedExpenseId] || null; },
    monthlyBills: lines.filter(function(l){ return l.freq === "Monthly" && !l.irregular && !l.computed; }),
    loanMonthly: ipLoansMonthly(),
    today: localDateStr()
  });
}

export function monthDetailHtml(){
  var ym = shownMonth();
  var d = monthDetailData(ym);
  var f = d.figures, u = d.usual;
  var lines = budgetLineItems(), byId = {};
  lines.forEach(function(l){ byId[l.id] = l; });
  var thisMonth = localDateStr().slice(0, 7);
  var trend = monthTrend(state, ym, 12);
  var maxAbs = trend.reduce(function(m, t){ return Math.max(m, Math.abs(t.left)); }, 1);
  var strip = '<div class="md-strip" role="list" aria-label="Left over, month by month">' + trend.map(function(t){
    var h = Math.round(Math.abs(t.left) / maxAbs * 100);
    return '<button type="button" class="md-bar' + (t.ym === ym ? " on" : "") + (t.left < 0 ? " neg" : "") + (t.count ? "" : " empty") + '" data-md-open="' + t.ym + '" role="listitem" title="' + escapeAttr(label(t.ym) + ": in " + fmtCurrency0.format(t.in) + ", out " + fmtCurrency0.format(t.out) + ", left " + money(t.left)) + '">' +
      '<span class="md-bar-fill" style="height:' + Math.max(h, t.count ? 3 : 0) + '%"></span><span class="md-bar-l">' + short(t.ym) + '</span></button>';
  }).join("") + '</div>';
  var head = '<div class="md-head"><button type="button" class="icon-btn" data-md-step="-1" aria-label="Previous month">‹</button><h2>' + escapeAttr(label(ym)) + '</h2>' +
    '<button type="button" class="icon-btn" data-md-step="1" aria-label="Next month"' + (ym >= thisMonth ? ' disabled' : '') + '>›</button></div>';
  if(!f.count && !f.in){
    return '<section class="rp-sheet md">' + head + strip + '<p class="ledger-note">Nothing logged for ' + escapeAttr(label(ym)) + '. Import a statement for it on Cash flow → Spending.</p></section>';
  }
  var soFar = d.inProgress ? '<p class="ledger-note md-sofar">' + escapeAttr(label(ym)) + ' so far, up to day ' + d.throughDay + ' — “usual” here is a normal month up to the same day.</p>' : '';
  var base = d.baseline.length ? 'Usual is the middle of ' + d.baseline.length + ' month' + (d.baseline.length === 1 ? '' : 's') + ' before it (' + d.baseline.map(short).reverse().join(", ") + ').' : 'No earlier months logged yet, so there\'s no usual to compare with.';
  var tiles = '<div class="md-tiles">' +
    '<div><span>Money in</span><b>' + fmtCurrency0.format(f.in) + '</b>' + vsUsual(f.in, u.in, true) + '</div>' +
    '<div><span>Money out</span><b>' + fmtCurrency0.format(f.out) + '</b>' + vsUsual(f.out, u.out, false) + '</div>' +
    '<div><span>Left</span><b class="' + (f.left < 0 ? "down" : "") + '">' + money(f.left) + '</b>' + vsUsual(f.left, u.left, true) + '</div></div>';
  var inBits = [["Pay", d.moneyIn.by.pay], ["Rent (after the agent)", d.moneyIn.by.rent], ["Bonuses & refunds", d.moneyIn.by.oneOff], ["Distributions", d.moneyIn.by.payouts], ["Other", d.moneyIn.by.other]]
    .filter(function(b){ return b[1]; }).map(function(b){ return '<span>' + escapeAttr(b[0]) + ' <b>' + fmtCurrency0.format(b[1]) + '</b></span>'; }).join("");
  var findings = d.findings.slice(0, 8).map(function(x){
    return '<li class="md-f md-f-' + x.kind + '">' + escapeAttr(x.text) + '</li>';
  }).join("");
  var cats = d.categories.map(function(c){
    var open = monthDetailUi.open[c.name];
    var rows = open ? (state.transactions || []).filter(function(t){ return c.ids.indexOf(t.id) !== -1; }).sort(function(a, b){ return (Number(b.amount) || 0) - (Number(a.amount) || 0); }).map(function(t){
      var l = byId[t.linkedExpenseId];
      return '<li><span>' + escapeAttr(t.date.slice(8)) + '</span><span>' + escapeAttr(t.what || (l && l.what) || "—") + '</span><b>' + fmtCurrency2.format(Number(t.amount) || 0) + '</b></li>';
    }).join("") : "";
    return '<li class="md-cat"><button type="button" data-md-cat="' + escapeAttr(c.name) + '" aria-expanded="' + !!open + '"><span>' + escapeAttr(c.name) + '</span><b>' + money(c.amount) + '</b>' +
      '<small class="' + (Math.abs(c.diff) < 1 ? "" : c.diff > 0 ? "down" : "up") + '">' + (c.usual || c.diff ? (Math.abs(c.diff) < 1 ? "usual" : (c.diff > 0 ? "+" : "−") + fmtCurrency0.format(Math.abs(c.diff))) : "") + '</small></button>' +
      (open ? (rows ? '<ul class="md-tx">' + rows + '</ul>' : '<p class="ledger-note md-none">Nothing this month — usually about ' + fmtCurrency0.format(c.usual) + '.</p>') : '') + '</li>';
  }).join("");
  return '<section class="rp-sheet md">' + head + strip + soFar + tiles +
    (inBits ? '<div class="md-in">' + inBits + '</div>' : '') +
    (d.loanMonthly ? '<p class="ledger-note md-loan">Not in money out: about ' + fmtCurrency0.format(d.loanMonthly) + ' a month of loan repayments go straight from the offset to the lender (part of it is paying the loan down).</p>' : '') +
    (d.partial ? '<p class="tax-cap-note warn">Only ' + f.count + ' transactions logged, against a usual ' + u.count + ' — this month looks only partly logged.</p>' : '') +
    (findings ? '<h3 class="md-h">What was different</h3><ul class="md-findings">' + findings + '</ul>' : '<h3 class="md-h">What was different</h3><p class="ledger-note">Nothing stands out — a usual month.</p>') +
    '<h3 class="md-h">By category <small>tap one to see its transactions</small></h3><ul class="md-cats">' + cats + '</ul>' +
    '<p class="ledger-note rp-note">' + escapeAttr(base) + ' Money in is what\'s been logged as received plus distributions; money out is logged spending with refunds netted. Transfers between your own accounts are in neither.</p>' +
  '</section>';
}
