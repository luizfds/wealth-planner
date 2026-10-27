import { state } from "../state.js";
import { budgetLineItems, transactionCategory, transactionAccount } from "./expenses.js";
import { transactionDisplayName, periodsOf } from "../calc/ledger.js";
import { accountBalance, rolledBalance, accountTypeLabel } from "../calc/accounts.js";
import { holdingReturns, distributionYears, cgtParcels } from "../calc/investreports.js";
import { propertyReturns, debtSchedule } from "../calc/assetreports.js";
import { toAudAmount } from "../calc/engine.js";
import { getTaxPeople, computePersonTax } from "../calc/tax.js";
import { propertyOwnershipPct } from "../calc/property.js";
import { reportChartHtml } from "../lib/reportcharts.js";
import { fmtCurrency0, fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { renderLineChart, dateAxisFormat } from "../lib/charts.js";

// ---------------- A page for every thing (v3.128.0) ----------------
//
// An account, a holding, a property, a loan, a debt, a budget line, a merchant or a person each get
// one page: what it is, its history drawn, the transactions behind it, the things it's tied to, and
// a way to its edit form where it lives. Search lands here and the lists link here. One route,
// /detail/<kind>/<id>; `detailTarget` says which.
export var detailTarget = { kind: null, id: null, from: null };
export var DETAIL_KINDS = ["account", "asset", "property", "loan", "debt", "line", "merchant", "person"];

function money(v){ return v == null ? "—" : (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v)); }
function pct(v){ return v == null ? "—" : (Math.round(v * 1000) / 10) + "%"; }
// A link to another detail page — what every list now uses.
export function detailLinkHtml(kind, id, label, cls){
  return '<button type="button" class="detail-link' + (cls ? " " + cls : "") + '" data-detail="' + kind + '" data-detail-id="' + escapeAttr(id) + '">' + escapeAttr(label) + '</button>';
}
function facts(list){
  return '<dl class="dt-facts">' + list.filter(function(f){ return f && f[1] != null && f[1] !== ""; }).map(function(f){ return '<div><dt>' + escapeAttr(f[0]) + '</dt><dd>' + f[1] + '</dd></div>'; }).join("") + '</dl>';
}
function section(title, body){ return body ? '<section class="dt-sec"><h3>' + escapeAttr(title) + '</h3>' + body + '</section>' : ""; }
function txTable(txs, opts){
  opts = opts || {};
  if(!txs.length) return '<p class="ledger-note" style="margin:0">Nothing logged yet.</p>';
  var lines = budgetLineItems();
  var shown = txs.slice().sort(function(a, b){ return (b.date || "").localeCompare(a.date || ""); }).slice(0, opts.limit || 25);
  return '<div class="table-scroll"><table class="rp-table dt-tx"><thead><tr><th scope="col">Date</th><th scope="col">What</th><th scope="col">' + (opts.third || "Category") + '</th><th class="num" scope="col">Amount</th></tr></thead><tbody>' +
    shown.map(function(t){
      var name = transactionDisplayName(t, lines);
      return '<tr><td>' + escapeAttr(fmtDate(t.date, { year: true })) + '</td><td>' + (opts.linkMerchant === false ? escapeAttr(name) : detailLinkHtml("merchant", name, name)) + '</td><td>' + escapeAttr(opts.thirdOf ? opts.thirdOf(t) : transactionCategory(t) || "") + '</td><td class="num">' + fmtCurrency2.format(Number(t.amount) || 0) + '</td></tr>';
    }).join("") + '</tbody></table></div>' + (txs.length > shown.length ? '<p class="ledger-note" style="margin:6px 0 0">The latest ' + shown.length + ' of ' + txs.length + '.</p>' : '');
}
function monthlyChart(txs, today, label){
  var t = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1), months = [];
  for(var i = 11; i >= 0; i--){ var d = new Date(t.getFullYear(), t.getMonth() - i, 1); months.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
  var by = {};
  txs.forEach(function(x){ var k = (x.date || "").slice(0, 7); by[k] = (by[k] || 0) + (Number(x.amount) || 0); });
  if(!months.some(function(m){ return by[m]; })) return "";
  var MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return reportChartHtml({ type: "columns", series: [label || "Spent"], items: months.map(function(m){ return { label: MN[Number(m.slice(5, 7)) - 1] + " " + m.slice(2, 4), a: Math.round((by[m] || 0) * 100) / 100 }; }) });
}
function findLoan(id){
  var out = null;
  (state.properties || []).forEach(function(p){ (p.loans || []).forEach(function(l, i){ if(l.id === id) out = { property: p, loan: l, index: i }; }); });
  return out;
}

// { title, kicker, html, history: [{date, value}] | null, edit: { label, to } | null } or null when
// the thing isn't there (deleted, or a stale link).
export function detailView(kind, id, today){
  today = today || localDateStr();
  if(kind === "account"){
    var acct = (state.accounts || []).find(function(a){ return a.id === id; });
    if(!acct) return null;
    var bal = accountBalance(acct), rolled = rolledBalance(acct, { today: today, accountOf: transactionAccount });
    var txs = (state.transactions || []).filter(function(t){ return transactionAccount(t) === acct.name; });
    var moves = (state.transfers || []).filter(function(t){ return t.from === acct.name || t.to === acct.name; });
    var src = bal.source;
    var tied = src && src.record ? (src.kind === "asset" ? detailLinkHtml("asset", src.record.id, src.record.what || "Holding") : src.kind === "debt" ? detailLinkHtml("debt", src.record.id, src.record.what || "Debt")
      : src.kind === "loan" || src.kind === "offset" ? detailLinkHtml("loan", src.record.id, "the loan") : src.kind === "property" ? detailLinkHtml("property", src.record.id, src.record.what || "Property") : "") : "";
    return { title: acct.name || "Account", kicker: accountTypeLabel(acct.type), history: bal.history,
      html: facts([["Balance", money(rolled.balance)], ["Last recorded", bal.date ? money(bal.balance) + " on " + fmtDate(bal.date, { year: true }) : "Not yet"],
        ["Logged since", rolled.count ? rolled.count + " item" + (rolled.count === 1 ? "" : "s") + ", " + money(rolled.moved) : null], ["Person", escapeAttr(acct.person || "")], ["Its balance is", tied]]) +
        section("Spending on this account", monthlyChart(txs, today) + txTable(txs, { third: "Category" })) +
        section("Transfers", moves.length ? '<ul class="dt-list">' + moves.slice(-10).reverse().map(function(m){ return '<li>' + escapeAttr(fmtDate(m.date, { year: true })) + ' — ' + escapeAttr(m.from === acct.name ? "to " + m.to : "from " + m.from) + ' <b>' + money(m.amount) + '</b></li>'; }).join("") + '</ul>' : ""),
      edit: { label: "Edit on Accounts", to: { page: "accounts" } } };
  }
  if(kind === "asset"){
    var a = (state.assets || []).find(function(x){ return x.id === id; });
    if(!a) return null;
    var html = facts([["Value", money(toAudAmount(a, Number(a.amount) || 0))], ["Category", escapeAttr(a.category || "")], ["Person", escapeAttr(a.person || "")],
      a.category === "Shares" ? ["Units", a.quantity != null ? escapeAttr(String(a.quantity)) : null] : null, a.category === "Shares" && a.price ? ["Price", fmtCurrency2.format(Number(a.price))] : null]);
    if(a.category === "Shares"){
      var hr = holdingReturns([a], { today: today, toAud: toAudAmount, benchmark: state.benchmark }).rows[0];
      if(hr) html += section("Returns", facts([["Cost still held", money(hr.cost)], ["Unrealised", money(hr.gain)], ["Income", money(hr.income)], ["Realised", money(hr.realised)], ["Total return", money(hr.total)], ["A year, with income", pct(hr.annual)], ["Benchmark", pct(hr.bench)]]));
      var lots = (a.lots || []).filter(function(l){ return l.date; });
      if(lots.length) html += section("Purchase lots", '<div class="table-scroll"><table class="rp-table"><thead><tr><th scope="col">Bought</th><th class="num" scope="col">Units</th><th class="num" scope="col">Price</th><th class="num" scope="col">Sold</th></tr></thead><tbody>' +
        lots.map(function(l){ return '<tr><td>' + escapeAttr(fmtDate(l.date, { year: true })) + '</td><td class="num">' + escapeAttr(String(l.units)) + '</td><td class="num">' + fmtCurrency2.format(Number(l.price) || 0) + '</td><td class="num">' + escapeAttr(String(l.soldUnits || 0)) + '</td></tr>'; }).join("") + '</tbody></table></div>');
      var dy = distributionYears([a], toAudAmount);
      if(dy.length) html += section("Distributions", '<ul class="dt-list">' + dy.map(function(y){ return '<li>' + y.label + ' <b>' + money(y.total) + '</b>' + (y.credit ? ' (' + money(y.credit) + ' franking)' : '') + '</li>'; }).join("") + '</ul>');
      var cg = cgtParcels([a], { today: today, toAud: toAudAmount });
      if(cg.realised.length) html += section("Sales", '<ul class="dt-list">' + cg.realised.map(function(y){ return '<li>' + y.label + ': net capital gain <b>' + money(y.net.net) + '</b></li>'; }).join("") + '</ul>');
    }
    return { title: a.what || a.symbol || "Holding", kicker: a.category || "Asset", history: a.history || [], html: html,
      edit: { label: "Edit on Investments", to: { page: "assets", sub: a.category || "summary" } } };
  }
  if(kind === "property"){
    var p = (state.properties || []).find(function(x){ return x.id === id; });
    if(!p) return null;
    var pr = propertyReturns([p], { today: today, rateOf: function(){ return 0; } })[0];
    var people = getTaxPeople();
    return { title: p.what || "Property", kicker: p.kind === "IP" ? "Investment property" : "Home", history: p.history || [],
      html: facts([["Value", money(pr.value)], ["Paid, with costs", money(pr.cost)], ["Loans", money(pr.loans)], ["Equity (with offsets)", money(pr.equity)], ["Loan to value", pct(pr.lvr)],
          pr.ip ? ["Rent a year", money(pr.rent)] : null, pr.ip ? ["Gross yield", pct(pr.grossYield)] : null, ["Value growth, 12 months", money(pr.growth)], ["Growth a year since purchase", pct(pr.growthPa)]]) +
        section("Loans", (p.loans || []).length ? '<ul class="dt-list">' + p.loans.map(function(l, i){ return '<li>' + detailLinkHtml("loan", l.id, l.what || "Loan " + (i + 1)) + ' <b>' + money(Number(l.balance) || 0) + '</b> at ' + (Number(l.rate) || 0) + '%</li>'; }).join("") + '</ul>' : "") +
        section("Owners", p.kind === "IP" && people.length ? '<ul class="dt-list">' + people.map(function(n){ return '<li>' + detailLinkHtml("person", n, n) + ' ' + Math.round(propertyOwnershipPct(p, n, people)) + '%</li>'; }).join("") + '</ul>' : ""),
      edit: { label: "Edit on Property", to: { page: "properties", scrollToId: "property-card-" + p.id } } };
  }
  if(kind === "loan"){
    var f = findLoan(id);
    if(!f) return null;
    var row = debtSchedule([Object.assign({}, f.property, { loans: [f.loan] })], [], { today: today }).rows[0] || {};
    var d = debtSchedule([], [], { today: today });
    return { title: f.loan.what || (f.property.what || "Property") + " loan", kicker: "Loan", history: f.loan.balanceHistory || [],
      html: facts([["Owed", money(Number(f.loan.balance) || 0)], ["Offset", money(Number(f.loan.offsetBalance) || 0)], ["Rate", (Number(f.loan.rate) || 0) + "%"], ["Repayment a month", money(row.monthly)],
          ["Interest " + d.thisLabel + " so far", money(row.interestThisYear)], ["Interest " + d.lastLabel, money(row.interestLastYear)], ["Deductible share", row.deductibleShare != null ? pct(row.deductibleShare) : null],
          ["Paid off", row.interestOnly ? "Interest only" : row.payoff ? fmtDate(row.payoff, { year: true }) : "Not at this rate"], ["Property", detailLinkHtml("property", f.property.id, f.property.what || "Property")]]),
      edit: { label: "Edit on Property", to: { page: "properties", scrollToId: "property-card-" + f.property.id } } };
  }
  if(kind === "debt"){
    var db = (state.debts || []).find(function(x){ return x.id === id; });
    if(!db) return null;
    return { title: db.what || "Debt", kicker: "Debt", history: db.history || [], html: facts([["Owed", money(Number(db.balance) || 0)]]),
      edit: { label: "Edit on Investments", to: { page: "assets", sub: "summary" } } };
  }
  if(kind === "line"){
    var line = budgetLineItems().find(function(l){ return l.id === id; });
    if(!line) return null;
    var ltx = (state.transactions || []).filter(function(t){ return t.linkedExpenseId === id; });
    var per = periodsOf(Number(line.amount) || 0, line.freq);
    var yearAgo = (Number(today.slice(0, 4)) - 1) + today.slice(4);
    var spent12 = ltx.filter(function(t){ return t.date > yearAgo && t.date <= today; }).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    return { title: line.what || "Budget line", kicker: "Budget line", history: null,
      html: facts([["Planned", money(Number(line.amount) || 0) + " " + escapeAttr(String(line.freq || "").toLowerCase())], ["A year", money(per.yearly)], ["Spent in the last 12 months", money(spent12)],
          ["Category", escapeAttr(line.category || "")], ["Needs or wants", escapeAttr(line.classification || "")], ["Account", line.account ? escapeAttr(line.account) : null]]) +
        section("Month by month", monthlyChart(ltx, today)) + section("Transactions", txTable(ltx)),
      edit: { label: "Edit on Cash flow", to: { page: "expenses", sub: "budget", lineId: id } } };
  }
  if(kind === "merchant"){
    var lines = budgetLineItems();
    var mtx = (state.transactions || []).filter(function(t){ return transactionDisplayName(t, lines) === id; });
    if(!mtx.length) return null;
    var total = mtx.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    var cats = {};
    mtx.forEach(function(t){ var c = transactionCategory(t) || "Uncategorised"; cats[c] = (cats[c] || 0) + 1; });
    var used = {};
    mtx.forEach(function(t){ if(t.linkedExpenseId) used[t.linkedExpenseId] = true; });
    var usedLines = lines.filter(function(l){ return used[l.id]; });
    return { title: id, kicker: "Merchant", history: null,
      html: facts([["Spent", money(total)], ["Times", String(mtx.length)], ["Average", money(total / mtx.length)], ["First", fmtDate(mtx.reduce(function(m, t){ return t.date < m ? t.date : m; }, mtx[0].date), { year: true })],
          ["Filed as", escapeAttr(Object.keys(cats).join(", "))], ["Budget lines", usedLines.map(function(l){ return detailLinkHtml("line", l.id, l.what || "Line"); }).join(", ")]]) +
        section("Month by month", monthlyChart(mtx, today)) + section("Transactions", txTable(mtx, { linkMerchant: false, third: "Account", thirdOf: transactionAccount })),
      edit: null };
  }
  if(kind === "person"){
    if(getTaxPeople().indexOf(id) === -1) return null;
    var t = computePersonTax(id);
    var inc = (state.income || []).filter(function(i){ return i.person === id && !i.computed && !i.syntheticNetFor && !i.syntheticOneOffFor; });
    var sup = (state.assets || []).filter(function(a){ return a.category === "Super" && a.person === id; });
    var owns = (state.properties || []).filter(function(p){ return p.kind === "IP"; });
    return { title: id, kicker: "Person", history: null,
      html: facts([["Taxable income", money(t.taxable)], ["Income tax and Medicare", money(t.totalTax)], ["Marginal rate", pct(t.marginalRate)], ["Refund (or bill, −)", money(t.refund)],
          ["Concessional super", money(t.totalConcessional) + " of " + money(t.capAvailable)]]) +
        section("Income", inc.length ? '<ul class="dt-list">' + inc.map(function(i){ return '<li>' + escapeAttr(i.what || "Income") + ' <b>' + money(Number(i.amount) || 0) + '</b> ' + escapeAttr(String(i.freq || "").toLowerCase()) + '</li>'; }).join("") + '</ul>' : "") +
        section("Super", sup.length ? '<ul class="dt-list">' + sup.map(function(a){ return '<li>' + detailLinkHtml("asset", a.id, a.what || "Super") + ' <b>' + money(Number(a.amount) || 0) + '</b></li>'; }).join("") + '</ul>' : "") +
        section("Property shares", owns.length ? '<ul class="dt-list">' + owns.map(function(p){ return '<li>' + detailLinkHtml("property", p.id, p.what || "Property") + ' ' + Math.round(propertyOwnershipPct(p, id, getTaxPeople())) + '%</li>'; }).join("") + '</ul>' : ""),
      edit: { label: "Edit on Tax", to: { page: "tax" } } };
  }
  return null;
}

export function detailPageHtml(today){
  var v = detailTarget.kind ? detailView(detailTarget.kind, detailTarget.id, today) : null;
  if(!v) return '<p class="ledger-note">That isn\'t here any more — it may have been renamed or deleted.</p><button type="button" class="btn btn-sm" data-detail-back>Back</button>';
  return '<div class="dt-head"><button type="button" class="link-btn dt-back" data-detail-back>← Back</button><span class="dt-kicker">' + escapeAttr(v.kicker) + '</span><h2>' + escapeAttr(v.title) + '</h2>' +
    (v.edit ? '<button type="button" class="btn btn-sm btn-ghost dt-edit" data-detail-edit>' + escapeAttr(v.edit.label) + ' →</button>' : '') + '</div>' +
    (v.history && v.history.length > 1 ? '<div class="dt-chart" id="detailChart"></div>' : '') + v.html;
}

export function renderDetailPage(){
  var el = typeof document !== "undefined" && document.getElementById("detailBody");
  if(!el) return;
  el.innerHTML = detailPageHtml();
  var v = detailTarget.kind ? detailView(detailTarget.kind, detailTarget.id) : null;
  var title = document.getElementById("pageTitle");
  if(title && v) title.textContent = v.kicker;
  var host = document.getElementById("detailChart");
  if(host && v && v.history){
    var pts = v.history.filter(function(h){ return h && h.date; }).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; })
      .map(function(h){ return { x: Date.parse(h.date + "T00:00:00"), y: Number(h.value) || 0 }; });
    renderLineChart(host, [{ label: v.title, colorClass: "series-color-0", points: pts }], { height: 200, stepped: true, baseline: "auto",
      yFormat: function(x){ return fmtCurrency0.format(x); }, xFormat: dateAxisFormat(pts), ariaLabel: v.title + " over time" });
  }
}
