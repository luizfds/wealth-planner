// Dashboard → Benchmarks (v3.35.0+). Four ways of answering "is this good?":
//   How you compare  — against published Australian figures for people your age (item 67)
//   Investments      — your shares against an index and a fixed rate, same cash flows (item 68)
//   Your targets     — goals you set, with progress (item 69)
//   Property         — each property against its suburb's median growth and yield (item 70)
// Each section is an HTML builder over a plain data object (testable, see render-smoke) plus a
// gather function that reads state.
import { state } from "../state.js";
import { BENCHMARKS } from "../constants.js";
import { getTaxPeople, computePersonTax, ageOnDate } from "../calc/tax.js";
import { scenarioTotals, totalNetWorthValue, toAudAmount } from "../calc/engine.js";
import { periodsOf } from "../calc/ledger.js";
import { superComparison, netWorthComparison, retirementComparison, housingComparison, relativeText, cagr, propertyMarketComparison } from "../calc/benchmarks.js";
import { sumField } from "../calc/ledger.js";
import { shareFlows, xirr, fixedRateValue, indexValue, priceDatesNeeded, benchmarkPriceOn, parseBenchmarkSymbol, setBenchmarkPrice } from "../calc/performance.js";
import { persist, genId } from "../state.js";
import { GOAL_KINDS, goalKindInfo, goalProgress, monthFraction } from "../calc/goals.js";
import { computeNetWorthSeries, runwayMonths } from "../calc/engine.js";
import { transactionsInMonth } from "../calc/ledger.js";
import { transactionCategory } from "./expenses.js";
import { fmtCurrency0, fmtPercent1, localDateStr, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

function esc(t){ return escapeAttr(String(t == null ? "" : t)); }
function short(v){
  var a = Math.abs(v), s = v < 0 ? "-" : "";
  if(a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
  if(a >= 1e4) return s + "$" + Math.round(a / 1e3) + "k";
  return fmtCurrency0.format(v);
}

// A bar from 0 with the value filled and the references as ticks. `max` leaves headroom so a value
// just past a tick doesn't sit on the edge.
export function compareBarHtml(value, refs, opts){
  opts = opts || {};
  var max = Math.max(value, 0, Math.max.apply(null, refs.map(function(r){ return r.value; }))) * 1.12 || 1;
  var pct = function(v){ return Math.max(0, Math.min(100, v / max * 100)).toFixed(1) + "%"; };
  return '<div class="bm-bar" role="img" aria-label="' + esc(opts.label || "") + '">' +
    '<span class="bm-fill' + (opts.tone ? " " + opts.tone : "") + '" style="width:' + pct(value) + '"></span>' +
    refs.map(function(r){ return '<span class="bm-tick" style="left:' + pct(r.value) + '" title="' + esc(r.label + ": " + r.text) + '"><i>' + esc(r.label) + '</i></span>'; }).join("") +
  '</div>';
}

// ---------------- How you compare (item 67) ----------------
export function gatherHousehold(){
  var today = localDateStr();
  var people = getTaxPeople();
  var settings = (state.tax && state.tax.settings) || {};
  var fireAge = state.fire && state.fire.currentAge != null && state.fire.currentAge !== "" ? Number(state.fire.currentAge) : null;
  var supers = state.assets.filter(function(a){ return a.category === "Super"; });
  var personRows = people.map(function(p){
    var age = ageOnDate(settings[p] && settings[p].dateOfBirth, today);
    if(age == null && people.length === 1) age = fireAge;
    var mine = supers.filter(function(a){ return a.person === p || (!a.person && people.length === 1); });
    return { name: p, age: age, super: mine.reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0), hasSuper: mine.length > 0 };
  });
  var ages = personRows.map(function(r){ return r.age; }).filter(function(a){ return a != null; });
  if(!people.length && fireAge != null) ages = [fireAge];
  var t = scenarioTotals(state.activeScenario);
  // Gross household income: Gross rows as entered, Net rows as they are (slightly understates the
  // gross, so the housing share reads slightly high — said in the note).
  var grossYearly = state.income.filter(function(i){ return !i.computed; }).reduce(function(s, i){
    return s + periodsOf(Number(i.amount) || 0, i.freq).yearly;
  }, 0);
  var buying = !!(state.purchase && state.purchase[state.activeScenario] && state.purchase[state.activeScenario].enabled);
  return {
    people: personRows,
    oldestAge: ages.length ? Math.max.apply(null, ages) : null,
    netWorth: totalNetWorthValue(),
    totalSuper: supers.reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0),
    couple: people.length > 1,
    savingsRate: t.incomeMonthly > 0 ? t.rate : null,
    housing: housingComparison(t.homeMonthly * 12, grossYearly, buying),
    scenario: state.activeScenario
  };
}
function row(title, value, bar, verdict, source){
  return '<div class="bm-row"><div class="bm-row-head"><span class="bm-row-title">' + title + '</span><b class="bm-row-value">' + value + '</b></div>' +
    bar + '<p class="bm-verdict">' + verdict + '</p>' + (source ? '<p class="bm-source">' + source + '</p>' : '') + '</div>';
}
export function householdCompareHtml(d){
  var out = [];
  d.people.forEach(function(p){
    if(!p.hasSuper) return;
    var c = superComparison(p.super, p.age);
    if(!c){
      out.push(row(esc(p.name) + "'s super", fmtCurrency0.format(p.super), "",
        "Add " + esc(p.name) + "'s date of birth (Tax → People) to compare with people the same age.", ""));
      return;
    }
    out.push(row(esc(p.name) + "'s super <small>age " + p.age + "</small>", fmtCurrency0.format(p.super),
      compareBarHtml(p.super, [{ label: "median", value: c.median, text: fmtCurrency0.format(c.median) }, { label: "avg", value: c.average, text: fmtCurrency0.format(c.average) }],
        { label: "Super against the median and average for ages " + c.band, tone: c.aboveMedian ? "good" : "low" }),
      relativeText(p.super, c.median) + "the median for ages " + c.band + " (" + fmtCurrency0.format(c.median) + "); the average is " + fmtCurrency0.format(c.average) +
        ", pulled up by large balances. " + (c.aboveAverage ? "Above both." : c.aboveMedian ? "Above the median, below the average." : "Below the median."),
      esc(BENCHMARKS.super.source)));
  });
  if(d.totalSuper > 0){
    var r = retirementComparison(d.totalSuper, d.couple);
    var years = d.oldestAge != null ? Math.max(0, 67 - d.oldestAge) : null;
    out.push(row((d.couple ? "Combined super" : "Super") + " vs a comfortable retirement", fmtPercent1.format(r.share),
      compareBarHtml(d.totalSuper, [{ label: "modest", value: r.modest, text: fmtCurrency0.format(r.modest) }, { label: "comfortable", value: r.comfortable, text: fmtCurrency0.format(r.comfortable) }],
        { label: "Super against the ASFA lump sums at 67", tone: r.share >= 1 ? "good" : "" }),
      fmtCurrency0.format(d.totalSuper) + " of the " + fmtCurrency0.format(r.comfortable) + " ASFA says a " + (d.couple ? "couple" : "single person") +
        " who owns their home needs at 67 for a comfortable retirement (modest: " + fmtCurrency0.format(r.modest) + ")" +
        (years != null ? ", with " + years + " year" + (years === 1 ? "" : "s") + " of contributions and growth still to come." : ". Today's dollars."),
      esc(BENCHMARKS.retirement.source)));
  }
  var nw = netWorthComparison(d.netWorth, d.oldestAge);
  if(nw){
    out.push(row("Household net worth", short(d.netWorth),
      compareBarHtml(Math.max(0, d.netWorth), [{ label: "avg", value: nw.mean, text: fmtCurrency0.format(nw.mean) }], { label: "Net worth against the average for the age band", tone: nw.vsMean >= 1 ? "good" : "low" }),
      relativeText(d.netWorth, nw.mean) + "the average household led by someone " + nw.band + " (" + fmtCurrency0.format(nw.mean) + " in 2019-20). An average, so a few very wealthy households lift it: " +
        "across all ages the median was " + fmtCurrency0.format(BENCHMARKS.netWorth.overallMedian) + " against an average of " + fmtCurrency0.format(BENCHMARKS.netWorth.overallMean) + ". It's the latest the ABS has published; wealth has grown since.",
      esc(BENCHMARKS.netWorth.source)));
  } else if(d.netWorth){
    out.push(row("Household net worth", short(d.netWorth), "", "Add a date of birth (or your age on Insights → Financial independence) to compare with households your age.", ""));
  }
  if(d.savingsRate != null){
    var sr = BENCHMARKS.savingRatio.value;
    out.push(row("Savings rate <small>" + esc(d.scenario) + "</small>", fmtPercent1.format(d.savingsRate),
      compareBarHtml(Math.max(0, d.savingsRate), [{ label: "Australia", value: sr, text: fmtPercent1.format(sr) }], { label: "Savings rate against the national household saving ratio", tone: d.savingsRate >= sr ? "good" : "low" }),
      "Australian households saved " + fmtPercent1.format(sr) + " of their after-tax income. Close to your figure in spirit — take-home pay less spending — though the ABS counts some things (super, imputed rent) that a budget doesn't.",
      esc(BENCHMARKS.savingRatio.source)));
  }
  if(d.housing){
    out.push(row("Housing cost <small>" + esc(d.scenario) + "</small>", fmtPercent1.format(d.housing.share) + " of income",
      compareBarHtml(d.housing.share, [{ label: d.housing.tenure === "renters" ? "renters" : "mortgage", value: d.housing.ref, text: fmtPercent1.format(d.housing.ref) }],
        { label: "Housing cost as a share of gross income", tone: d.housing.share <= d.housing.ref ? "good" : "low" }),
      "Australian " + d.housing.tenure + " spent " + fmtPercent1.format(d.housing.ref) + " of gross household income on housing. 30% is the usual line for housing stress. Rows entered as take-home pay count as they are, so yours reads a little high.",
      esc(BENCHMARKS.housingShare.source)));
  }
  if(!out.length) return '<p class="fire-note">Add income, super and your date of birth and this compares them with published Australian figures for people your age.</p>';
  return out.join("");
}

// ---------------- Investments against a benchmark (item 68) ----------------
// ASX-listed, AUD-priced ETFs only, so no currency enters the comparison. "Other" takes any ASX code.
export var BENCHMARK_PRESETS = [
  { symbol: "IOZ", label: "Australia — ASX 200 (IOZ)" },
  { symbol: "VAS", label: "Australia — ASX 300 (VAS)" },
  { symbol: "IVV", label: "US — S&P 500 (IVV)" },
  { symbol: "VGS", label: "World ex-Australia (VGS)" },
  { symbol: "NDQ", label: "US — Nasdaq 100 (NDQ)" },
  { symbol: "VDHG", label: "Diversified high growth (VDHG)" }
];
export function gatherInvestments(){
  var today = localDateStr();
  var bm = state.benchmark;
  var sym = bm.symbol || "IOZ";
  var sf = shareFlows(state.assets, toAudAmount);
  var invested = sf.flows.reduce(function(s, f){ return s + (f.amount < 0 ? -f.amount : 0); }, 0);
  var withdrawn = sf.flows.reduce(function(s, f){ return s + (f.amount > 0 ? f.amount : 0); }, 0);
  var rate = (Number(bm.fixedRate) || 0) / 100;
  var store = (bm.prices && bm.prices[sym]) || {};
  var idx = sf.flows.length ? indexValue(sf.flows, function(d){ return benchmarkPriceOn(bm, sym, d); }, store.now) : null;
  return {
    symbol: sym, today: today, flows: sf.flows, value: sf.value, invested: invested, withdrawn: withdrawn,
    included: sf.included, excluded: sf.excluded, firstDate: sf.flows.length ? sf.flows[0].date : null,
    myRate: xirr(sf.flows, sf.value, today), fixedRate: rate,
    payoutTotal: sf.payouts.reduce(function(s, f){ return s + f.amount; }, 0), payoutCount: sf.payouts.length,
    myRateWithIncome: sf.payouts.length ? xirr(sf.flows.concat(sf.payouts).sort(function(x, y){ return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; }), sf.value, today) : null,
    fixedValue: sf.flows.length ? fixedRateValue(sf.flows, rate, today) : null,
    index: idx, indexRate: idx && idx.value != null ? xirr(sf.flows, idx.value, today) : null,
    dates: priceDatesNeeded(sf.flows), prices: store
  };
}
function pctPa(r){ return r == null ? "—" : (r >= 0 ? "" : "−") + fmtPercent1.format(Math.abs(r)) + " a year"; }
export function investmentsHtml(d){
  var presetKnown = BENCHMARK_PRESETS.some(function(p){ return p.symbol === d.symbol; });
  var controls = '<div class="bm-controls">' +
    '<label>Compare with <select data-bm-symbol>' + BENCHMARK_PRESETS.map(function(p){ return '<option value="' + p.symbol + '"' + (p.symbol === d.symbol ? " selected" : "") + '>' + esc(p.label) + '</option>'; }).join("") +
      '<option value="__other"' + (presetKnown ? "" : " selected") + '>Other ASX code…</option></select></label>' +
    (presetKnown ? "" : '<label>ASX code <input type="text" data-bm-other value="' + esc(d.symbol) + '" maxlength="8" style="width:80px;text-transform:uppercase"></label>') +
    '<label>and a fixed <input type="number" step="0.5" min="0" max="30" data-bm-rate value="' + Math.round(d.fixedRate * 1000) / 10 + '" style="width:64px"> % a year</label>' +
  '</div>';
  if(!d.flows.length){
    return controls + '<p class="fire-note">Add purchase lots to your share holdings (Net worth → Investments → Shares → a holding → Purchase lots) and this compares what your money did against the same dollars, on the same dates, in ' + esc(d.symbol) + ' and at a fixed rate.' +
      (d.excluded.length ? " Holdings without lots: " + esc(d.excluded.join(", ")) + "." : "") + '</p>';
  }
  var bars = [{ label: "Your shares", value: d.value, rate: d.myRate, cls: "mine" }];
  if(d.index && d.index.value != null) bars.push({ label: "Same money in " + d.symbol, value: d.index.value, rate: d.indexRate, cls: "index" });
  bars.push({ label: "Same money at " + fmtPercent1.format(d.fixedRate), value: d.fixedValue, rate: d.fixedRate, cls: "fixed" });
  var max = Math.max.apply(null, bars.map(function(b){ return b.value; }).concat([1]));
  var barHtml = bars.map(function(b){
    return '<div class="bm-perf-row ' + b.cls + '"><span class="bm-perf-label">' + esc(b.label) + '</span>' +
      '<span class="bm-perf-track"><span class="bm-perf-fill" style="width:' + Math.max(0, b.value / max * 100).toFixed(1) + '%"></span></span>' +
      '<span class="bm-perf-value">' + fmtCurrency0.format(b.value) + '<small>' + pctPa(b.rate) + '</small></span></div>';
  }).join("");
  var verdict = "";
  if(d.index && d.index.value != null){
    var diff = d.value - d.index.value;
    verdict = '<p class="bm-verdict"><b>' + (diff >= 0 ? fmtCurrency0.format(diff) + " ahead of " : fmtCurrency0.format(-diff) + " behind ") + esc(d.symbol) + '</b> on the same dollars and dates' +
      (d.myRate != null && d.indexRate != null ? " (" + pctPa(d.myRate) + " against " + pctPa(d.indexRate) + ")." : ".") + '</p>';
  }
  var missing = d.index && d.index.missing ? d.index.missing : [];
  var prices = '<details class="tax-advanced bm-prices"' + (missing.length ? " open" : "") + '><summary>' + esc(d.symbol) + ' prices — ' +
      (missing.length ? missing.length + " of " + (d.dates.length + 1) + " still needed" : "all " + (d.dates.length + 1) + " in") + '</summary>' +
    '<p class="ledger-note help" style="margin:8px 0">The close on each date you bought or sold, and today. Type them, or copy the Google Sheets formulas, paste them into a sheet, and paste the Symbol and Price columns back below.</p>' +
    '<div class="bm-price-grid">' + d.dates.concat(["now"]).map(function(dt){
      var v = d.prices[dt];
      return '<label><span>' + (dt === "now" ? "Today" + (d.prices.nowDate ? " (" + esc(fmtDate(d.prices.nowDate)) + ")" : "") : esc(fmtDate(dt))) + '</span><input type="number" step="0.01" min="0" data-bm-price="' + dt + '" value="' + (v > 0 ? v : "") + '" placeholder="price"></label>';
    }).join("") + '</div>' +
    '<div class="bm-paste"><button type="button" class="btn btn-sm btn-ghost" data-bm-copy>⧉ Copy Google Sheets formulas</button>' +
    '<textarea data-bm-paste rows="3" placeholder="' + esc(d.symbol) + '@2024-03-01&#9;31.42"></textarea>' +
    '<button type="button" class="btn btn-sm" data-bm-paste-apply>Use pasted prices</button></div></details>';
  return controls +
    '<p class="bm-verdict">' + fmtCurrency0.format(d.invested) + ' put in since ' + esc(fmtDate(d.firstDate)) + (d.withdrawn ? ', ' + fmtCurrency0.format(d.withdrawn) + ' taken out' : '') + ', worth ' + fmtCurrency0.format(d.value) + ' today.</p>' +
    '<div class="bm-perf">' + barHtml + '</div>' + verdict +
    (d.payoutCount ? '<p class="bm-verdict">With the ' + d.payoutCount + ' distribution' + (d.payoutCount === 1 ? '' : 's') + ' you\'ve logged (' + fmtCurrency0.format(d.payoutTotal) + ' in cash), your return is <b>' + pctPa(d.myRateWithIncome) + '</b>. The index figure above is price only, so compare that one with your price-only ' + pctPa(d.myRate) + '.</p>' : '') +
    prices +
    '<p class="bm-source help">Money-weighted returns. The bars are price only on both sides, so distributions don\'t tilt the comparison.' +
      (d.excluded.length ? ' Not included (no purchase lots): ' + esc(d.excluded.join(", ")) + '.' : '') + '</p>';
}
// The Benchmarks tab's own paste box: only benchmark rows, for the current symbol or any other.
export function applyBenchmarkPaste(text){
  var n = 0, today = localDateStr();
  String(text || "").split(/\r?\n/).forEach(function(line){
    var parts = line.trim().split(/\t+|,+|\s+/);
    if(parts.length < 2) return;
    var bm = parseBenchmarkSymbol(parts[0].replace(/^["']|["']$/g, ""));
    var price = parseFloat(parts[parts.length - 1].replace(/[^0-9.\-]/g, ""));
    if(!bm || !(price > 0)) return;
    setBenchmarkPrice(state.benchmark, bm.symbol, bm.date, price, today);
    n++;
  });
  if(n) persist();
  return n;
}
export function setBenchmarkField(kind, key, value){
  var bm = state.benchmark;
  if(kind === "symbol"){
    var sym = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
    if(sym) bm.symbol = sym;
  } else if(kind === "rate"){
    var r = Number(value);
    if(isFinite(r) && r >= 0) bm.fixedRate = r;
  } else if(kind === "price"){
    setBenchmarkPrice(bm, bm.symbol, key, value, localDateStr());
  }
  persist();
}

// ---------------- Your own targets (item 69) ----------------
export function gatherTargets(){
  var today = localDateStr();
  var active = state.activeScenario;
  var t = scenarioTotals(active);
  var cats = {};
  transactionsInMonth(state.transactions, today.slice(0, 7)).forEach(function(tx){
    var c = transactionCategory(tx);
    if(c) cats[c] = (cats[c] || 0) + (Number(tx.amount) || 0);
  });
  var seriesCache = null;
  var ctx = {
    savingsRate: t.incomeMonthly > 0 ? t.rate : null,
    netWorth: totalNetWorthValue(),
    runwayMonths: runwayMonths(t.expensesMonthly),
    superTotal: state.assets.filter(function(a){ return a.category === "Super"; }).reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0),
    categoryMonthToDate: cats,
    monthFraction: monthFraction(today),
    // The active scenario's projection, in today's dollars, at the end of the year containing the date.
    projectedNetWorthAt: function(date){
      var yrs = Math.max(0, Math.ceil((Date.parse(date) - Date.parse(today)) / (365.25 * 86400000)));
      if(yrs > 60) return null;
      if(!seriesCache || seriesCache.length <= yrs) seriesCache = computeNetWorthSeries(active, Math.max(1, yrs, 20), { realTerms: true });
      var pt = seriesCache.find(function(p){ return p.x === yrs; });
      return pt ? pt.y : null;
    }
  };
  return {
    goals: state.goals.map(function(g){ return { goal: g, progress: goalProgress(g, ctx) }; }),
    categories: (state.categories || []).slice().sort(),
    scenario: active
  };
}
function goalValue(kind, v){
  if(v == null) return "—";
  if(kind === "savingsRate") return fmtPercent1.format(v);
  if(kind === "emergencyFund") return (Math.round(v * 10) / 10) + " mo";
  return fmtCurrency0.format(v);
}
var STATUS_TEXT = { met: "Met", "on-track": "On track", behind: "Not yet", within: "Within", "ahead-of-pace": "Ahead of pace", over: "Over", unknown: "No data yet", unset: "Set a target" };
var STATUS_TONE = { met: "good", "on-track": "good", within: "good", behind: "", "ahead-of-pace": "low", over: "bad", unknown: "", unset: "" };
export function targetsHtml(d){
  var rows = d.goals.map(function(x, i){
    var g = x.goal, p = x.progress, info = goalKindInfo(g.kind) || { label: g.kind, unit: "" };
    var title = g.kind === "categorySpend" ? esc(g.category || "a category") + " <small>per month</small>" : esc(info.label);
    var targetInput = g.kind === "savingsRate"
      ? '<input type="number" step="1" min="0" max="100" data-goal-target="' + i + '" value="' + (g.target ? Math.round(g.target * 1000) / 10 : "") + '" aria-label="Target %"> %'
      : (info.unit === "$" || info.unit === "$/mo" ? '$ <input type="number" step="any" min="0" data-goal-target="' + i + '" value="' + (g.target || "") + '" aria-label="Target">' :
        '<input type="number" step="0.5" min="0" data-goal-target="' + i + '" value="' + (g.target || "") + '" aria-label="Target months"> months');
    var lowerBetter = g.kind === "categorySpend";
    var tone = STATUS_TONE[p.status] || "";
    var extra = "";
    if(g.kind === "netWorth") extra = ' <label class="goal-by">by <input type="date" data-goal-by="' + i + '" value="' + esc(g.by || "") + '"></label>' +
      (p.projected != null ? '<span class="goal-note">' + esc(d.scenario) + ' projects ' + fmtCurrency0.format(p.projected) + ' by then</span>' : '');
    if(lowerBetter && p.pace != null) extra = '<span class="goal-note">' + fmtCurrency0.format(p.pace) + ' would be on pace today</span>';
    return '<div class="goal-row">' +
      '<div class="goal-head"><span class="bm-row-title">' + title + '</span><span class="goal-status ' + tone + '">' + STATUS_TEXT[p.status] + '</span>' +
        '<button type="button" class="icon-btn goal-del" data-goal-del="' + i + '" aria-label="Remove this target" title="Remove">✕</button></div>' +
      '<div class="bm-bar"><span class="bm-fill ' + (tone || (lowerBetter ? "" : "")) + '" style="width:' + Math.max(0, Math.min(100, (p.pct || 0) * 100)).toFixed(1) + '%"></span>' +
        (lowerBetter && p.pace != null && p.target > 0 ? '<span class="bm-tick" style="left:' + Math.min(100, p.pace / p.target * 100).toFixed(1) + '%" title="On pace"><i>pace</i></span>' : '') + '</div>' +
      '<div class="goal-foot"><b>' + goalValue(g.kind, p.current) + '</b> of <span class="goal-target">' + targetInput + '</span>' + extra + '</div>' +
    '</div>';
  }).join("");
  var kindOpts = GOAL_KINDS.map(function(k){ return '<option value="' + k.kind + '">' + esc(k.label) + '</option>'; }).join("");
  var catOpts = d.categories.map(function(c){ return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join("");
  return (rows || '<p class="fire-note">Set targets of your own — a savings rate, a net worth by a date, months of expenses in cash, super, or a monthly cap on a spending category — and see how far along each is.</p>') +
    '<div class="goal-add"><select data-goal-kind aria-label="Kind of target">' + kindOpts + '</select>' +
      '<select data-goal-category aria-label="Category" hidden>' + (catOpts || '<option value="">No categories yet</option>') + '</select>' +
      '<button type="button" class="btn btn-sm" data-goal-add>+ Add target</button></div>';
}
export function addGoal(kind, category){
  var info = goalKindInfo(kind);
  if(!info) return;
  var g = { id: genId("goal"), kind: kind, target: kind === "savingsRate" ? info.placeholder / 100 : info.placeholder };
  if(kind === "categorySpend"){ if(!category) return false; g.category = category; }
  state.goals.push(g);
  persist();
  return true;
}
export function setGoalField(i, field, value){
  var g = state.goals[i];
  if(!g) return;
  if(field === "target"){
    var v = Number(value);
    g.target = !(v >= 0) || value === "" ? "" : (g.kind === "savingsRate" ? v / 100 : v);
  } else if(field === "by") g.by = value || "";
  persist();
}
export function removeGoal(i){
  var g = state.goals.splice(i, 1)[0];
  persist();
  return g;
}

// ---------------- Property against its suburb (item 70) ----------------
// The suburb figures are typed in from wherever you trust (CoreLogic, Domain, realestate.com.au
// suburb profiles, your agent's appraisal) with where and when — the app never fetches them.
export function gatherPropertyMarket(){
  var today = localDateStr();
  return { properties: state.properties.map(function(p){
    var value = Number(p.value) || 0;
    var rentYearly = p.kind === "IP" ? sumField(p.income || [], "yearly") : 0;
    var mine = {
      growthPa: cagr(p.purchasePrice, p.purchaseDate, value, today),
      yield: p.kind === "IP" && value > 0 && rentYearly > 0 ? rentYearly / value : null,
      rentWeekly: rentYearly / 52
    };
    return { id: p.id, name: p.what || "Property", kind: p.kind, value: value, purchaseDate: p.purchaseDate || "",
      hasPurchase: Number(p.purchasePrice) > 0 && !!p.purchaseDate, mine: mine, market: p.market || {},
      cmp: propertyMarketComparison(mine, p.market) };
  }) };
}
function pp(v){ return v == null ? "—" : (v < 0 ? "−" : "") + fmtPercent1.format(Math.abs(v)); }
function marketInput(id, field, value, attrs){
  return '<input type="' + (attrs.type || "number") + '" data-pm-id="' + esc(id) + '" data-pm-field="' + field + '" value="' + esc(value == null ? "" : value) + '"' +
    (attrs.step ? ' step="' + attrs.step + '"' : '') + (attrs.placeholder ? ' placeholder="' + esc(attrs.placeholder) + '"' : '') + ' aria-label="' + esc(attrs.label) + '">';
}
export function propertyMarketHtml(d){
  if(!d.properties.length) return '<p class="fire-note">Add a property and this compares its growth, yield and rent with its suburb.</p>';
  return d.properties.map(function(p){
    var m = p.market, c = p.cmp, rows = [];
    var growthVerdict = c.growth ? (c.growth.diff >= 0 ? "ahead of" : "behind") + " the suburb by " + pp(Math.abs(c.growth.diff)) + " a year" : "";
    rows.push('<div class="pm-row"><span class="pm-label">Growth a year</span><span class="pm-mine">' + (p.hasPurchase ? pp(p.mine.growthPa) : '<i>add purchase price and date</i>') +
      '</span><span class="pm-market">' + marketInput(p.id, "growthPa", m.growthPa, { step: "0.1", placeholder: "e.g. 6.5", label: "Suburb median growth % a year" }) + ' %</span>' +
      (growthVerdict ? '<span class="pm-verdict ' + (c.growth.diff >= 0 ? "good" : "low") + '">' + growthVerdict + '</span>' : '') + '</div>');
    if(p.kind === "IP"){
      var yieldVerdict = c.yield ? (c.yield.diff >= 0 ? "above" : "below") + " the suburb by " + pp(Math.abs(c.yield.diff)) : "";
      rows.push('<div class="pm-row"><span class="pm-label">Gross yield</span><span class="pm-mine">' + pp(p.mine.yield) +
        '</span><span class="pm-market">' + marketInput(p.id, "yield", m.yield, { step: "0.1", placeholder: "e.g. 4.2", label: "Suburb median gross yield %" }) + ' %</span>' +
        (yieldVerdict ? '<span class="pm-verdict ' + (c.yield.diff >= 0 ? "good" : "low") + '">' + yieldVerdict + '</span>' : '') + '</div>');
      var rentVerdict = c.rent ? (c.rent.ratio >= 1 ? fmtPercent1.format(c.rent.ratio - 1) + " above" : fmtPercent1.format(1 - c.rent.ratio) + " below") + " the median rent" : "";
      rows.push('<div class="pm-row"><span class="pm-label">Rent a week</span><span class="pm-mine">' + (p.mine.rentWeekly > 0 ? fmtCurrency0.format(p.mine.rentWeekly) : "—") +
        '</span><span class="pm-market">$ ' + marketInput(p.id, "rentWeekly", m.rentWeekly, { step: "5", placeholder: "e.g. 580", label: "Suburb median weekly rent" }) + '</span>' +
        (rentVerdict ? '<span class="pm-verdict ' + (c.rent.ratio >= 1 ? "good" : "low") + '">' + rentVerdict + '</span>' : '') + '</div>');
    }
    return '<div class="pm-prop"><div class="pm-head"><b>' + esc(p.name) + '</b>' +
        marketInput(p.id, "suburb", m.suburb, { type: "text", placeholder: "Suburb, e.g. Springfield QLD", label: "Suburb" }) + '</div>' +
      '<div class="pm-cols"><span></span><span>Yours</span><span>Suburb median</span><span></span></div>' + rows.join("") +
      '<div class="pm-source">Source ' + marketInput(p.id, "source", m.source, { type: "text", placeholder: "CoreLogic, Domain…", label: "Where the suburb figures are from" }) +
        ' as of ' + marketInput(p.id, "asOf", m.asOf, { type: "month", label: "Month the suburb figures describe" }) + '</div>' +
      (p.hasPurchase ? '<p class="bm-source help">Yours: from the purchase price on ' + esc(fmtDate(p.purchaseDate)) + ' to today\'s value, compounded. Compare it with the suburb\'s rate over a similar stretch.</p>' : '') +
    '</div>';
  }).join("");
}
export function setPropertyMarketField(id, field, value){
  var p = state.properties.find(function(x){ return x.id === id; });
  if(!p) return;
  if(!p.market || typeof p.market !== "object") p.market = {};
  if(value === "" || value == null) delete p.market[field];
  else p.market[field] = ["growthPa", "yield", "rentWeekly"].indexOf(field) !== -1 ? Number(value) : String(value);
  persist();
}

// ---------------- Render ----------------
var SECTIONS = [];
// Later sections register themselves here (investments, targets, property) so the page order is
// one list: [{id, title, sub, html: function(){}}].
export function registerBenchmarkSection(section){ SECTIONS.push(section); }
registerBenchmarkSection({ id: "household", title: "How you compare", sub: "published Australian figures, people your age",
  html: function(){ return householdCompareHtml(gatherHousehold()); } });

registerBenchmarkSection({ id: "investments", title: "Your shares against the market", sub: "the same dollars on the same dates",
  html: function(){ return investmentsHtml(gatherInvestments()); } });

registerBenchmarkSection({ id: "targets", title: "Your targets", sub: "goals you set",
  html: function(){ return targetsHtml(gatherTargets()); } });

registerBenchmarkSection({ id: "property", title: "Property against its suburb", sub: "growth, yield and rent",
  html: function(){ return propertyMarketHtml(gatherPropertyMarket()); } });

export function renderBenchmarks(){
  var el = document.getElementById("benchmarksBody");
  if(!el || el.closest(".dashboard-subpage").hidden) return;
  el.innerHTML = SECTIONS.map(function(s){
    return '<section class="panel bm-panel" id="bm-' + s.id + '"><h3>' + s.title + ' <span style="font-weight:400;color:var(--ink-soft)">— ' + s.sub + '</span></h3>' + s.html() + '</section>';
  }).join("");
}
