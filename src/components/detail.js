import { ASSET_PAGE_TITLES } from "../constants.js";
import { balanceForecastHtml, renderBalanceForecastChart } from "./dailyforecast.js";
import { state } from "../state.js";
import { budgetLineItems, transactionCategory, transactionAccount, lineStatus } from "./expenses.js";
import { transactionDisplayName, periodsOf, resolveSharedAmount } from "../calc/ledger.js";
import { accountBalance, rolledBalance, accountTypeLabel } from "../calc/accounts.js";
import { holdingReturns, distributionYears, cgtParcels } from "../calc/investreports.js";
import { propertyReturns, debtSchedule } from "../calc/assetreports.js";
import { toAudAmount, scenarioTotals, currentScenario } from "../calc/engine.js";
import { getTaxPeople, computePersonTax } from "../calc/tax.js";
import { propertyOwnershipPct } from "../calc/property.js";
import { reportChartHtml, fitReportCharts } from "../lib/reportcharts.js";
import { fmtCurrency0, fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { renderLineChart, dateAxisFormat } from "../lib/charts.js";
import { incomeSearchId } from "../lib/search.js";
import { emptyStateHtml } from "../lib/empty.js";
import { classWord } from "../constants.js";
import { potFor, potTrips } from "../calc/budgetsplit.js";
import { typicalMonthly } from "../calc/adjustplan.js";
import { lineMerchants } from "../calc/tidy.js";
import { currentStrays } from "./tidy.js";

// ---------------- A page for every thing (v3.128.0) ----------------
//
// An account, a holding, a property, a loan, a debt, a budget line, a merchant or a person each get
// one page: what it is, its history drawn, the transactions behind it, the things it's tied to, and
// a way to its edit form where it lives. Search lands here and the lists link here. One route,
// /detail/<kind>/<id>; `detailTarget` says which.
export var detailTarget = { kind: null, id: null, from: null };
export var DETAIL_KINDS = ["scenario", "transaction", "income", "account", "asset", "property", "loan", "debt", "line", "merchant", "person"];

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
  if(!txs.length) return emptyStateHtml("Nothing logged yet.", { done: true });
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
// A line's last twelve months (this one, so far, lighter) against its plan a month — a dashed line; a month over it red.
function twelveMonthsHtml(txs, today, planMonthly){
  var t = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1), months = [];
  for(var i = 11; i >= 0; i--){ var d = new Date(t.getFullYear(), t.getMonth() - i, 1); months.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
  var by = {};
  txs.forEach(function(x){ var k = (x.date || "").slice(0, 7); by[k] = (by[k] || 0) + (Number(x.amount) || 0); });
  if(!months.some(function(m){ return by[m]; })) return emptyStateHtml("Nothing spent on this line in the last 12 months.", { done: true });
  var MN = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var max = Math.max(planMonthly || 0, Math.max.apply(null, months.map(function(m){ return by[m] || 0; }))) * 1.08 || 1;
  var over = months.slice(0, 11).filter(function(m){ return planMonthly > 0 && (by[m] || 0) > planMonthly + 0.5; }).length;
  var label = "Spent each month for the last 12 months" + (planMonthly > 0 ? ", against a plan of " + money(planMonthly) + " a month; over it in " + over + " of the 11 finished months" : "") + ". " +
    months.map(function(m){ return FULL[Number(m.slice(5, 7)) - 1] + " " + money(by[m] || 0); }).join(", ") + ".";
  return '<div class="dt-12" role="img" aria-label="' + escapeAttr(label) + '">' +
    (planMonthly > 0 ? '<span class="dt-12-plan" style="bottom:' + Math.round(planMonthly / max * 100) + '%"></span>' : '') +
    months.map(function(m, k){
      var v = by[m] || 0, cls = k === 11 ? " now" : (planMonthly > 0 && v > planMonthly + 0.5 ? " over" : "");
      return '<span class="dt-12-bar' + cls + '" style="height:' + Math.max(v > 0 ? 2 : 0, Math.round(v / max * 100)) + '%"></span>';
    }).join("") + '</div><div class="dt-12-key" aria-hidden="true">' + months.map(function(m){ return '<span>' + MN[Number(m.slice(5, 7)) - 1] + '</span>'; }).join("") + '</div>';
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
  if(kind === "scenario"){
    if((state.scenarios || []).indexOf(id) === -1) return null;
    var totals = scenarioTotals(id);
    return { title: id, kicker: "Scenario", history: null, edit: null,
      html: facts([["Income / month", money(totals.incomeMonthly)], ["Expenses / month", money(totals.expensesMonthly)],
        ["Left / month", money(totals.netMonthly)], ["Notes", escapeAttr((state.scenarioNotes || {})[id] || "")]]) };
  }
  if(kind === "transaction"){
    var transaction = (state.transactions || []).find(function(t){ return t.id === id; });
    if(!transaction) return null;
    var linkedLine = budgetLineItems().find(function(l){ return l.id === transaction.linkedExpenseId; });
    return { title: transactionDisplayName(transaction, budgetLineItems()), kicker: "Transaction", history: null, edit: null,
      html: facts([["Date", escapeAttr(fmtDate(transaction.date, { year: true }))], ["Amount", money(transaction.amount)],
        ["Account", escapeAttr(transactionAccount(transaction) || "")], ["Category", escapeAttr(transactionCategory(transaction) || "")],
        ["Budget line", linkedLine ? detailLinkHtml("line", linkedLine.id, linkedLine.what) : null], ["Notes", escapeAttr(transaction.notes || "")]]) };
  }
  if(kind === "income"){
    var income = (state.income || []).find(function(i){ return incomeSearchId(i) === id; });
    if(!income) return null;
    return { title: income.what || "Income", kicker: "Income", history: null, edit: null,
      html: facts([["Person", escapeAttr(income.person || income.syntheticNetFor || "")], ["Amount", money(income.amount)], ["Frequency", escapeAttr(income.freq || "")],
        ["Type", escapeAttr(income.incomeType || "")], ["Account", escapeAttr(income.account || "")], ["How it is calculated", escapeAttr(income.computedNote || "")]]) };
  }
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
        // v3.180.0 (item 206): an everyday account's next 90 days, day by day.
        (acct.type === "everyday" ? section("The next 90 days", balanceForecastHtml(acct, today)) : "") +
        section("Spending on this account", monthlyChart(txs, today) + txTable(txs, { third: "Category" })) +
        section("Transfers", moves.length ? '<ul class="dt-list">' + moves.slice(-10).reverse().map(function(m){ return '<li>' + escapeAttr(fmtDate(m.date, { year: true })) + ' — ' + escapeAttr(m.from === acct.name ? "to " + m.to : "from " + m.from) + ' <b>' + money(m.amount) + '</b></li>'; }).join("") + '</ul>' : ""),
      edit: { label: "Manage on Bank accounts", to: { page: "accounts", scrollToId: "acct-card-" + id } } };
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
      edit: { label: "Manage on " + (ASSET_PAGE_TITLES[a.category] || "Investments"), to: { page: "assets", sub: a.category || "Cash" } } };
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
      edit: { label: "Manage on Property", to: { page: "properties", scrollToId: "property-card-" + p.id } } };
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
      edit: { label: "Manage on Property", to: { page: "properties", scrollToId: "property-card-" + f.property.id } } };
  }
  if(kind === "debt"){
    var db = (state.debts || []).find(function(x){ return x.id === id; });
    if(!db) return null;
    return { title: db.what || "Debt", kicker: "Debt", history: db.history || [], html: facts([["Owed", money(Number(db.balance) || 0)]]),
      edit: { label: "Manage on Bank accounts", to: { page: "accounts", scrollToId: "debtsTable" } } };
  }
  if(kind === "line"){
    var line = budgetLineItems().find(function(l){ return l.id === id; });
    if(!line) return null;
    var ltx = (state.transactions || []).filter(function(t){ return t.linkedExpenseId === id; });
    var yearAgo = (Number(today.slice(0, 4)) - 1) + today.slice(4);
    var spent12 = ltx.filter(function(t){ return t.date > yearAgo && t.date <= today; }).reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0);
    // November 2026 (calc/budgetsplit.js): a set-aside line is a pot — what's in it, what went in and out, and the trips.
    var potHtml = "";
    if(line.irregular && !line.computed){
      var pot = potFor(line, state.transactions, today);
      var trips = potTrips(line, state.trips, state.transactions);
      potHtml = section("The pot", '<div class="dt-pot"><span>In the pot</span><b class="' + (pot.short ? "over" : "") + '">' + (pot.short ? money(-pot.balance) + " short" : money(pot.balance)) + '</b>' +
          '<small>' + money(pot.monthly) + ' a month goes in; spending comes out. Judged over the year, never against this month.</small></div>' +
          facts([[line.potFrom ? "Held on " + fmtDate(pot.from, { year: true }) : "Started empty on " + fmtDate(pot.from, { year: true }), money(pot.start)], ["Put in since", "+" + money(pot.putIn)], ["Spent since", "−" + money(pot.spent)]])) +
        (trips.length ? section("Trips", '<ul class="dt-list">' + trips.map(function(x){
          return '<li>' + escapeAttr(x.trip.name || "Trip") + ' <small>' + escapeAttr(fmtDate(x.trip.from) + (x.trip.to && x.trip.to !== x.trip.from ? " – " + fmtDate(x.trip.to, { year: true }) : "")) + '</small> <b>' + money(x.spent) + '</b></li>';
        }).join("") + '</ul>') : "");
    }
    // November 2026: a line, opened — one place for this month, the year against the plan, where it goes, what's recent
    // and every action (Make the plan typical, Edit, Log spend, Tidy).
    var scen = currentScenario();
    var planMonthly = periodsOf(resolveSharedAmount(line, scen), line.freq).monthly;
    var typ = typicalMonthly(line, state.transactions, today, planMonthly);
    var strayList = currentStrays(today).filter(function(x){ return x.fromLineId === id; });
    var st = lineStatus(line, strayList.length ? (function(){ var o = {}; o[id] = strayList.length; return o; })() : null);
    var chips = '<div class="dt-chips"><span>' + escapeAttr(line.classification ? classWord(line.classification) : "Other") + '</span><span>' + (line.irregular ? "Set aside" : "Every month") + '</span><span>Plan ' + money(planMonthly) + '/mo</span>' +
      (line.category ? '<span>' + escapeAttr(line.category) + '</span>' : '') + '</div>';
    var nowHtml = line.irregular || line.computed ? "" : section("This month", '<div class="dt-now"><b>' + money(st.spent) + '</b> <span>of ' + money(st.target) + '</span>' + st.html + '</div>');
    var typicalNote = typ.monthsSpent ? '<p class="dt-typical">Typically <b>' + money(typ.monthly) + '</b> a month' + (typ.monthsOver ? ' · over the plan in ' + typ.monthsOver + ' of ' + typ.months : '') + '</p>' : '';
    var where = lineMerchants(state.transactions, id, { today: today }).slice(0, 6);
    var strayKeys = {};
    strayList.forEach(function(x){ strayKeys[x.key] = budgetLineItems().find(function(l){ return l.id === x.toLineId; }); });
    var perMonth = Math.max(1, typ.months || 12);
    var whereTop = where.length ? where[0].total : 0;
    var whereHtml = where.length > 1 ? '<ul class="dt-where">' + where.map(function(g){
      var usual = strayKeys[g.key];
      return '<li><span class="dt-where-name">' + escapeAttr(g.label) + (usual ? ' <span class="dt-usually">usually ' + escapeAttr(usual.what || "another line") + '</span>' : '') + '</span>' +
        '<span class="bh-track"><span class="bh-fill needs" style="width:' + (whereTop > 0 ? Math.round(g.total / whereTop * 100) : 0) + '%"></span></span><b>' + money(g.total / perMonth) + '</b></li>';
    }).join("") + '</ul>' : "";
    var recent = ltx.slice().sort(function(a, b){ return String(b.date).localeCompare(String(a.date)); });
    var yearStart = (Number(today.slice(0, 4)) - 1) + today.slice(4, 7) + "-01";
    var recentHtml = recent.length ? '<ul class="dt-recent">' + recent.slice(0, 4).map(function(t){
      return '<li><span>' + escapeAttr(fmtDate(t.date)) + '</span><span class="dt-recent-what">' + escapeAttr(transactionDisplayName(t, budgetLineItems())) + '</span><b>' + fmtCurrency2.format(Number(t.amount) || 0) + '</b></li>';
    }).join("") + '</ul><button type="button" class="link-btn" data-sv data-sv-line="' + escapeAttr(id) + '" data-sv-from="' + yearStart + '" data-sv-to="' + today + '">All ' + recent.length + ' in Spending →</button>'
      : emptyStateHtml("Nothing logged on this line yet.", { attrs: { "data-line-log": id }, label: "Log spend" });
    var typicalAmount = Math.round(typ.monthly / (periodsOf(1, line.freq).monthly || 1));
    var offerTypical = !line.computed && typ.months >= 3 && typ.monthsSpent > 0 && Math.abs(typ.monthly - planMonthly) >= 1;
    var actions = line.computed ? "" : '<div class="dt-actions">' +
      (offerTypical ? '<button type="button" class="btn btn-primary" data-line-typical="' + escapeAttr(id) + '" data-line-typical-amount="' + typicalAmount + '">Make the plan ' + money(typ.monthly) + '/mo</button>' : '') +
      '<button type="button" class="btn" data-detail-edit>Edit line</button>' +
      '<button type="button" class="btn" data-line-log="' + escapeAttr(id) + '">Log spend</button>' +
      '<button type="button" class="btn" data-tidy-open="' + escapeAttr(id) + '">Tidy' + (strayList.length ? ' (' + strayList.length + ')' : '') + '</button></div>';
    return { title: line.what || "Budget line", kicker: line.irregular ? "Set aside" : "Budget line", history: null,
      html: chips + nowHtml + potHtml +
        section("Last 12 months", twelveMonthsHtml(ltx, today, planMonthly) + typicalNote) +
        (whereHtml ? section("Where it goes", '<p class="dt-typical">A month, on average</p>' + whereHtml) : "") +
        section("Recent", recentHtml) + actions +
        facts([["Planned", money(Number(line.amount) || 0) + " " + escapeAttr(String(line.freq || "").toLowerCase())], ["Spent in the last 12 months", money(spent12)],
          ["Counted otherwise", (function(){
            // Budget → Tidy up: purchases that count as the other one themselves.
            var own = ltx.filter(function(t){ return (t.classification === "Needs" || t.classification === "Wants") && t.classification !== line.classification; }).length;
            return own ? own + ' purchase' + (own === 1 ? '' : 's') : null;
          })()], ["Account", line.account ? escapeAttr(line.account) : null]]),
      edit: { label: "Edit on Money", to: { page: "expenses", sub: "budget", lineId: id } } };
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
    var inc = (state.income || []).filter(function(i){ return i.person === id && !i.computed && !i.syntheticNetFor && !i.syntheticOneOffFor && !i.syntheticRefundFor && !i.syntheticEndingFor; });
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
  return '<div class="dt-head"><span class="dt-kicker">' + escapeAttr(v.kicker) + '</span><h2>' + escapeAttr(v.title) + '</h2>' +
    (v.edit ? '<button type="button" class="btn btn-sm btn-ghost dt-edit" data-detail-edit>' + escapeAttr(v.edit.label) + ' →</button>' : '') + '</div>' +
    (v.history && v.history.length > 1 ? '<div class="dt-chart" id="detailChart"></div>' : '') + v.html;
}

export function renderDetailPage(){
  var el = typeof document !== "undefined" && document.getElementById("detailBody");
  if(!el) return;
  el.innerHTML = detailPageHtml();
  fitReportCharts(el);
  var v = detailTarget.kind ? detailView(detailTarget.kind, detailTarget.id) : null;
  var title = document.getElementById("pageTitle");
  if(title && v) title.textContent = v.kicker;
  if(detailTarget.kind === "account"){
    var fa = (state.accounts || []).find(function(a){ return a.id === detailTarget.id; });
    if(fa && fa.type === "everyday") renderBalanceForecastChart(fa);
  }
  var host = document.getElementById("detailChart");
  if(host && v && v.history){
    var pts = v.history.filter(function(h){ return h && h.date; }).slice().sort(function(a, b){ return a.date < b.date ? -1 : 1; })
      .map(function(h){ return { x: Date.parse(h.date + "T00:00:00"), y: Number(h.value) || 0 }; });
    renderLineChart(host, [{ label: v.title, colorClass: "series-color-0", points: pts }], { height: 200, stepped: true, baseline: "auto",
      yFormat: function(x){ return fmtCurrency0.format(x); }, xFormat: dateAxisFormat(pts), ariaLabel: v.title + " over time" });
  }
}
