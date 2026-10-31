import { state } from "../state.js";
import { LIQUID_CATEGORIES, MARKET_CURRENCY, IP_CATEGORY } from "../constants.js";
import { toWeekly, sumField, sumFieldForScenario, sumFieldActiveInYear, isActiveInYear, resolveSharedAmount } from "./ledger.js";
import {
  recalcPurchase, ipProperties, ipExpensesMonthly, ipLoansMonthly,
  shockedLoanRepaymentMonthly, scenarioInflatableHomeItems, calcStampDuty,
  calcLMI, calcRepaymentMonthly, purchaseActiveRate, loanBalanceAfterMonths,
  propertiesTotalEquityToday, propertiesOffsetTotal, landTaxDetailForProperty
  , loanPaidOut, propertyCostBase
} from "./property.js";
import { getTaxPeople, computePersonTax, scenarioIncomeMonthly, scenarioOneOffYearly, takeHomeAdjust, personTakeHomeParts } from "./tax.js";
import { fmtCurrency0, localDateStr, fmtDate } from "../lib/format.js";
import { dueAfterDays } from "./estimates.js";
import { projectionRatios } from "./actuals.js";
import { eventEffects } from "./lifeevents.js";
import { loggedSinceRecorded } from "./accounts.js";
import { scenarioSharedItems, changesFor } from "./scenariochanges.js";
import { legsMonthly, legsInYear } from "./scenariolegs.js";
import { isDraftKey } from "./scenariodraft.js";

// Every non-Shares asset, and every Shares holding on the ASX, is already AUD — the only
// currency this app ever mixes in is USD (US-market and Crypto holdings, see MARKET_CURRENCY).
// Converts one asset's dollar amount (its current .amount, or a historical .value from its own
// history[]) to AUD using the visitor's own stored rate (state.fx.usdAud — see state.js for how
// it gets set) before it's added into any total that spans multiple holdings/currencies at once.
// A single row's own display (the Shares table's Value/Price columns) deliberately stays in its
// native currency and never calls this — only cross-holding sums (net worth, liquid assets,
// portfolio charts, the Shares gain/loss glance) need a common currency to add correctly. No
// rate set yet: passes the amount through unconverted, same as every one of these totals behaved
// before this existed — a portfolio with no USD holdings needs no rate at all, and one that does
// but hasn't set a rate is no worse off than today rather than having its USD holdings zeroed out.
export function toAudAmount(item, amount){
  amount = Number(amount) || 0;
  if(item.category !== "Shares") return amount;
  var currency = MARKET_CURRENCY[item.market] || "AUD";
  if(currency === "AUD") return amount;
  var rate = Number(state.fx && state.fx.usdAud) || 0;
  return rate > 0 ? amount * rate : amount;
}

export function totalAssetsValue(){
  return state.assets.reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0);
}

// Anything owed outside a property loan (credit cards, personal loans, BNPL — property loans
// stay tracked on the Properties tab, already netted into propertiesTotalEquityToday()). No
// interest/repayment modeling here on purpose — just a flat balance subtracted from net worth,
// unlike a property loan's full amortization schedule. Keeping it this simple was a deliberate
// scope call, not an oversight; a fuller debt-payoff model (minimum payments, interest accrual)
// would be a real follow-up feature, not a quick addition to this one.
export function totalDebtsValue(){
  return state.debts.reduce(function(s, d){ return s + (Number(d.balance) || 0); }, 0);
}

// v3.135.0 (item 166): with what's been logged against each account since its balance was recorded.
export function totalNetWorthValue(){
  return totalAssetsValue() + propertiesTotalEquityToday() - totalDebtsValue() + loggedSinceRecorded().total;
}

// Cash + Shares (readily spendable) plus any property offset balances — the same definition
// already used by the Assets page's "Net worth if you buy" table, extracted here so the
// Dashboard's runway stat can reuse it instead of re-deriving it.
export function liquidAssetsValue(){
  return state.assets.filter(function(a){ return LIQUID_CATEGORIES.indexOf(a.category) !== -1; })
    .reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0) + propertiesOffsetTotal();
}

// How many months of expenses your liquid assets would cover at zero income — the standard
// "emergency fund" health check. Infinity reads oddly in the UI, so a scenario with $0 monthly
// expenses (nothing entered yet) reports null rather than a nonsensical number.
export function runwayMonths(monthlyExpenses){
  if(!monthlyExpenses || monthlyExpenses <= 0) return null;
  return liquidAssetsValue() / monthlyExpenses;
}

// Sums each asset/property's logged value ~30 days ago against its latest logged value, for
// comparing real month-over-month growth against a scenario's projected monthly surplus
// (scenarioTotals().netMonthly) — a reality check on whether net worth is actually tracking the
// plan. Only counts items with at least one snapshot on/before the reference date and one after
// it (or today, for the "after" side) — an item with no history at all, or only very recent
// history, doesn't silently count as $0 growth; it's just excluded from the comparison.
export function actualAssetGrowthLastMonth(){
  var today = new Date();
  var monthAgo = new Date(today.getTime());
  monthAgo.setDate(monthAgo.getDate() - 30);
  var monthAgoStr = localDateStr(monthAgo);
  var todayStr = localDateStr(today);

  function latestValueOnOrBefore(history, d){
    if(!history || !history.length) return null;
    var atOrBefore = history.filter(function(h){ return h.date <= d; });
    if(!atOrBefore.length) return null;
    return atOrBefore[atOrBefore.length - 1].value;
  }

  var trackedCount = 0;
  var deltaSum = 0;
  state.assets.forEach(function(a){
    var before = latestValueOnOrBefore(a.history, monthAgoStr);
    var after = latestValueOnOrBefore(a.history, todayStr);
    if(after == null) after = Number(a.amount) || 0; // today's live value if never explicitly logged today
    if(before == null) return; // no snapshot old enough to compare against — exclude, don't assume $0
    deltaSum += toAudAmount(a, after) - toAudAmount(a, before);
    trackedCount++;
  });

  return { deltaSum: deltaSum, trackedCount: trackedCount, hasData: trackedCount > 0 };
}

// Assets whose logged value is stale (>=30 days old) or that have never been logged at all —
// a nudge, not an error: the app has no way to push a notification when it's closed (no
// backend), so this only surfaces on load/whenever the Dashboard re-renders.
// v3.114.0: due on each kind's own rhythm (calc/estimates.js DUE_DAYS) — super about twice a year, a
// car valued from its price never — not every asset every 30 days.
export function staleAssets(){
  var todayMs = Date.now();
  var today = localDateStr();
  var result = [];
  state.assets.forEach(function(a){
    var due = dueAfterDays(a, today);
    if(due == null) return;
    var hist = a.history;
    var lastDate = hist && hist.length ? hist[hist.length - 1].date : null;
    var days = lastDate ? Math.floor((todayMs - new Date(lastDate + "T00:00:00").getTime()) / (24 * 60 * 60 * 1000)) : null;
    // label (v3.32.1): two people's "Superannuation" were indistinguishable in the banner.
    if(days == null || days >= due) result.push({ what: a.what, label: a.person ? a.what + " — " + a.person : a.what, days: days });
  });
  return result;
}

function addYearsIso(iso, years){
  return (Number(String(iso).slice(0, 4)) + years) + String(iso).slice(4);
}
// v3.173.0 (item 208): what a scenario's own changes need from the household — each owner's marginal
// rate (a shared property splits evenly, so it's their average) and, for a sale, what the property
// brings in the year it's sold and the cash it stops making.
var LEG_KINDS = { rent: 1, ip: 1, cost: 1, sell: 1, extra: 1 };
// v3.183.0 (item 214): a change can start in a year (fromYear), at an age (when: "age", whenAge) or when cash
// reaches an amount (when: "cash", whenCash). An age becomes its year here; with no age known it never
// starts. Cash is decided year by year inside computeNetWorthSeries. Copies — the saved changes stay as typed.
export function scenarioLegChanges(scenario){
  var age = currentAgeOrNull();
  return changesFor(scenario).filter(function(c){ return c && LEG_KINDS[c.kind]; }).map(function(c){
    if(c.when !== "age") return c;
    if(age == null || !isFinite(Number(c.whenAge))) return Object.assign({}, c, { never: true });
    return Object.assign({}, c, { fromYear: Math.max(0, Math.round(Number(c.whenAge) - age)) });
  }).filter(function(c){ return !c.never; });
}
export function isCashTriggered(c){ return !!(c && c.when === "cash" && c.kind !== "sell" && Number(c.whenCash) > 0); }
// v3.177.0 (item 204): a scenario can carry its own assumptions — an "assume" change (return, inflation,
// a rate rise) laid over the household's projection settings. Everything the projection reads goes
// through this, so a what-if kept as a scenario draws exactly what the sliders showed.
function currentAgeOrNull(){ var a = state.fire && state.fire.currentAge; return a == null || a === "" || !isFinite(Number(a)) ? null : Number(a); }
export function projectionFor(scenario){
  var base = state.projection || {};
  var a = changesFor(scenario).find(function(c){ return c && c.kind === "assume"; });
  if(!a) return base;
  var out = Object.assign({}, base);
  ["investReturnRate", "inflationRate", "rateShockPct"].forEach(function(k){ if(a[k] != null && a[k] !== "" && isFinite(Number(a[k]))) out[k] = Number(a[k]); });
  return out;
}
// The projection year a "retire" change stops pay from (1 = the coming twelve months), or null.
export function retireYearFor(scenario, currentAge){
  var r = changesFor(scenario).find(function(c){ return c && c.kind === "retire"; });
  if(!r || currentAge == null || !isFinite(Number(r.age))) return null;
  return Math.max(1, Math.round(Number(r.age) - currentAge) + 1);
}
export function scenarioLegContext(scenario){
  var proj = projectionFor(scenario);
  var people = getTaxPeople(), rates = {};
  var rateOf = function(person){
    if(!(person in rates)){ var t = null; try { t = computePersonTax(person, { scenario: scenario }); } catch(e){} rates[person] = t ? Number(t.marginalRate) || 0 : 0; }
    return rates[person];
  };
  var marginalRateFor = function(owner){
    if(owner && people.indexOf(owner) !== -1) return rateOf(owner);
    return people.length ? people.reduce(function(sum, p){ return sum + rateOf(p); }, 0) / people.length : 0;
  };
  // v3.176.0: the tax effect in full — each owner's tax with the property's result against without
  // (so the Medicare levy surcharge, the brackets and the offsets all count), shared evenly when it's
  // the household's. Remembered by the figure, to the nearest $10: the projection asks every year.
  var taxMemo = {};
  var totalTaxOf = function(person, extra){
    var t = null;
    try { t = computePersonTax(person, extra ? { scenario: scenario, extraIpResult: extra } : { scenario: scenario }); } catch(e){}
    return t ? Number(t.totalTax) || 0 : 0;
  };
  var taxEffectFor = function(owner, taxableYearly){
    var owners = owner && people.indexOf(owner) !== -1 ? [owner] : people;
    if(!owners.length) return 0;
    var key = owners.join("|") + ":" + Math.round(taxableYearly / 10);
    if(key in taxMemo) return taxMemo[key];
    var share = taxableYearly / owners.length, effect = 0;
    owners.forEach(function(p){ effect += totalTaxOf(p, 0) - totalTaxOf(p, share); });
    return (taxMemo[key] = effect);
  };
  var propRate = (Number(proj.propertyAppreciationRate) || 0) / 100, rateShockPts = Number(proj.rateShockPct) || 0, todayStr = localDateStr();
  var sold = {};
  changesFor(scenario).forEach(function(c){
    if(!c || c.kind !== "sell") return;
    var p = (state.properties || []).find(function(x){ return x.id === c.propertyId; });
    if(!p) return;
    var rentYearly = sumField(p.income || [], "yearly"), expYearly = sumField(p.expenses || [], "yearly");
    var loanMonthly = (p.loans || []).reduce(function(s2, l){ return s2 + shockedLoanRepaymentMonthly(l, rateShockPts); }, 0);
    var costBase = propertyCostBase(p);
    sold[p.id] = {
      cashMonthly: (rentYearly - expYearly) / 12 - loanMonthly,
      proceedsAt: function(year){
        var value = (Number(p.value) || 0) * Math.pow(1 + propRate, year);
        var debt = (p.loans || []).reduce(function(s3, l){ return loanPaidOut(l, addYearsIso(todayStr, year)) ? s3 : s3 + loanBalanceAfterMonths(l.balance, (Number(l.rate) || 0) + rateShockPts, l.termYears, year * 12, l.repaymentType); }, 0);
        var selling = value * (Number(c.sellingCostsPct) || 0) / 100;
        // Capital gains tax on an investment property held over a year: half the gain at the owners' rate.
        var gain = costBase != null && p.kind === "IP" ? Math.max(0, value - selling - costBase) : 0;
        var cgt = gain * 0.5 * (marginalRateFor("") + 0.02);
        return value - debt - selling - cgt;
      }
    };
  });
  // v3.174.0: what a property's loans still owe in a projected year — the most extra repayments can pay off.
  var loanBalanceAt = function(propertyId, year){
    var p = (state.properties || []).find(function(x){ return x.id === propertyId; });
    if(!p) return Infinity;
    return (p.loans || []).reduce(function(sum, l){ return loanPaidOut(l, addYearsIso(todayStr, year)) ? sum : sum + Math.max(0, loanBalanceAfterMonths(l.balance, (Number(l.rate) || 0) + rateShockPts, l.termYears, year * 12, l.repaymentType) - (Number(l.offsetBalance) || 0)); }, 0);
  };
  return { marginalRateFor: marginalRateFor, taxEffectFor: taxEffectFor, propRate: propRate, inflationRate: (Number(proj.inflationRate) || 0) / 100, rateShockPts: rateShockPts, sold: sold, loanBalanceAt: loanBalanceAt };
}
export function computeNetWorthSeries(scenario, horizonYears, opts){
  var cfg = state.purchase[scenario];
  var investCfg = state.invest[scenario];
  var investEnabled = !!(investCfg && investCfg.enabled);
  // Invest wins if a scenario's stored state somehow has both legs enabled (shouldn't happen —
  // the UI keeps them mutually exclusive, and migrateState() resolves it the same way on load —
  // but this keeps the math itself correct regardless of how state got here).
  var purchaseEnabled = !!(cfg && cfg.enabled) && !investEnabled;
  var proj = projectionFor(scenario);
  var propRate = (Number(proj.propertyAppreciationRate) || 0) / 100;
  // A scenario can override the global growth rate (e.g. to reflect its own state's
  // long-run average) via cfg.propertyGrowthRate; null/unset falls back to the global rate.
  var homePropRate = (cfg && cfg.propertyGrowthRate != null && cfg.propertyGrowthRate !== "")
    ? (Number(cfg.propertyGrowthRate) || 0) / 100
    : propRate;
  var investRate = (Number(proj.investReturnRate) || 0) / 100;
  var inflationRate = (Number(proj.inflationRate) || 0) / 100;
  // opts.realTerms lets a caller pin the basis explicitly — the projection-accuracy panel compares
  // a stored reference series against real logged net worth, which is nominal by nature, so it
  // must not be silently deflated by whatever the preference happens to be today.
  var realTerms = opts && opts.realTerms != null ? !!opts.realTerms : proj.realTerms !== false;
  var rateShock = (Number(proj.rateShockPct) || 0) / 100;
  var monthlyInvestRate = Math.pow(1 + investRate, 1 / 12) - 1;

  // Debts have no growth/repayment schedule of their own (see totalDebtsValue()) — folded into
  // the starting portfolio balance as a flat reduction, same treatment as any other liquid
  // asset/liability that isn't a property loan or the purchase/invest leg's own math.
  var nonPropertyAssets = totalAssetsValue() - totalDebtsValue() + loggedSinceRecorded().total;

  var price = purchaseEnabled ? Math.max(0, Number(cfg.price) || 0) : 0;
  var depositAmt = purchaseEnabled ? price * (Math.max(0, Math.min(100, Number(cfg.depositPct) || 0)) / 100) : 0;
  var loanAmount0 = Math.max(0, price - depositAmt);
  var rate = purchaseEnabled ? purchaseActiveRate(cfg) + rateShock * 100 : 0;
  var term = purchaseEnabled ? cfg.termYears : 0;
  var repaymentMonthly = purchaseEnabled ? calcRepaymentMonthly(loanAmount0, rate, term, cfg.repaymentType) : 0;

  var upfrontCash = 0;
  if(purchaseEnabled){
    var lvr0 = price > 0 ? loanAmount0 / price : 0;
    var stampDuty0 = calcStampDuty(cfg.state, price, cfg.firstHomeBuyer);
    var lmi0 = calcLMI(loanAmount0, lvr0);
    var otherTotal0 = (cfg.otherCosts || []).reduce(function(s, c){ return s + (Number(c.amount) || 0); }, 0);
    var stampDutyForTotal0 = stampDuty0 === null ? (Number(cfg.manualStampDuty) || 0) : stampDuty0;
    upfrontCash = depositAmt + stampDutyForTotal0 + lmi0 + otherTotal0;
  }
  // The invest leg's initial lump sum is money reallocated out of today's non-property assets
  // (the same way upfrontCash above leaves the liquid portfolio to become a deposit) — subtract
  // it from portfolio's starting point so it isn't compounded in both buckets at once.
  var investGrowthMonthly = investEnabled ? Math.pow(1 + (Number(investCfg.growthRatePct) || 0) / 100, 1 / 12) - 1 : 0;
  var investInitial = investEnabled ? Math.max(0, Number(investCfg.initialAmount) || 0) : 0;
  var investBalance = investInitial;
  var portfolio = nonPropertyAssets - upfrontCash - investInitial;
  // v3.183.0 (item 214): the money a deposit can come from — cash, shares and offsets (liquidAssetsValue,
  // as "cash at settlement" counts it) — followed beside the portfolio, which also holds super. A change
  // waiting on cash looks at this.
  var cashTrack = liquidAssetsValue() + loggedSinceRecorded().total - upfrontCash - investInitial;

  var rateShockPts = Number(proj.rateShockPct) || 0;
  var ipLoansMonthlyShocked = ipProperties().reduce(function(s, p){
    return s + p.loans.reduce(function(ss, l){ return ss + shockedLoanRepaymentMonthly(l, rateShockPts); }, 0);
  }, 0);
  var fixedMonthly = ipLoansMonthlyShocked + repaymentMonthly;
  // Income grew at 0% for the whole horizon until now — not as a modelling choice but because
  // scenarioTotals() was read once, before the loop. Against expenses inflating every year that
  // had the surplus shrinking annually and going negative partway through a 20-year horizon. The
  // default matches inflation, so the surplus at least holds its real value.
  var incomeGrowthRate = (Number(proj.incomeGrowthRate) || 0) / 100;
  var todayStr = localDateStr();

  // Income and inflatable expenses are now summed per year rather than once, because a row can
  // stop (item.endDate). Both are computed from the same year index so a row that ends drops out
  // of both the series and the surplus on the same boundary.
  // Scenario-resolved, and the end-date filter is handed *into* the tax chain rather than applied
  // to its output: a salary that ends in three years has to stop being taxed, not just stop being
  // counted, or the remaining income keeps paying tax on money nobody earns.
  function activeIncomeMonthlyAt(year){
    return scenarioIncomeMonthly({
      scenario: scenario,
      includeRow: function(row){ return isActiveInYear(row, year, todayStr); },
      // v3.149.0: a projection year is a whole year — a row is in it or not (includeRow decides).
      wholeYears: true
    });
  }
  // v3.52.0: on "actuals", income and living costs carry the monthly differences measured on the
  // lines that have been logged (calc/actuals.js); everything else stays as planned.
  var ratios = (opts && opts.ratios) || projectionRatios();
  function activeInflatableMonthlyAt(year){
    return (sumFieldActiveInYear(scenarioSharedItems(scenario), "monthly", year, todayStr, function(item){
        return resolveSharedAmount(item, scenario);
      }) +
      sumFieldActiveInYear(scenarioInflatableHomeItems(scenario), "monthly", year, todayStr) + (ratios.spendDelta || 0)) +
      ipProperties().reduce(function(sum, p){
        return sum + sumFieldActiveInYear(p.expenses, "monthly", year, todayStr);
      }, 0);
  }

  // v3.125.0: a range of outcomes runs this hundreds of times with a different sequence of returns
  // each time (calc/outcomes.js) — opts.investReturns[year] and opts.propertyReturns[year] replace
  // the steady rates for that year, and opts.cache keeps the per-year income and costs (which don't
  // depend on returns, and are the slow part) between runs.
  var investPath = opts && opts.investReturns, propPath = opts && opts.propertyReturns, cache = opts && opts.cache;
  // v3.126.0: life events (calc/lifeevents.js), in today's dollars, inflated to the year they land.
  var events = opts && opts.events ? opts.events : (state.lifeEvents || []), thisYear = Number(todayStr.slice(0, 4));
  var propFactor = 1;
  var points = [];
  // The rows whose dates decide whether they count in a year; a year's key is which of them do.
  var datedRows = [].concat(state.income || [], scenarioSharedItems(scenario), scenarioInflatableHomeItems(scenario),
    ipProperties().reduce(function(a, p){ return a.concat(p.expenses || [], p.income || []); }, [])).filter(function(r){ return r && (r.startDate || r.endDate); });
  var yearKey = function(y){ return datedRows.map(function(r){ return isActiveInYear(r, y, todayStr) ? "1" : "0"; }).join(""); };
  var lastYearKey = null, lastYc = null;
  var allLegs = scenarioLegChanges(scenario), legCtx = allLegs.length ? scenarioLegContext(scenario) : null;
  // v3.183.0 (item 214): a change waiting on cash joins the year cash first reaches its amount (at the
  // year's start); until then it isn't in. triggers[id] = the year it started, or null if it never did.
  var pending = allLegs.filter(isCashTriggered), legs = allLegs.filter(function(c){ return !isCashTriggered(c); });
  var triggers = {};
  pending.forEach(function(c){ triggers[c.id] = null; });
  var soldFrom = {};
  var retireYear = (opts && opts.retireYear != null) ? opts.retireYear : retireYearFor(scenario, opts && opts.currentAge != null ? opts.currentAge : currentAgeOrNull());
  legs.forEach(function(c){ if(c.kind === "sell" && legCtx.sold[c.propertyId]) soldFrom[c.propertyId] = Math.max(0, Math.floor(Number(c.fromYear) || 0)) + 1; });
  for(var year = 0; year <= horizonYears; year++){
    if(year > 0 && pending.length){
      pending = pending.filter(function(c){
        if(cashTrack < Number(c.whenCash)) return true;
        triggers[c.id] = year;
        legs = legs.concat([Object.assign({}, c, { fromYear: year - 1 })]);
        return false;
      });
    }
    var lg = legs.length && year > 0 ? legsInYear(legs, year, legCtx) : null;
    if(year > 0 && propPath) propFactor *= 1 + (propPath[year] != null ? propPath[year] : propRate);
    if(year > 0){
      var yc = cache && cache[year];
      if(!yc){
        // v3.180.1: a year's income and costs only differ from the year before when a dated row starts
        // or stops — otherwise the year before's (the tax worked out again for every year was most of
        // a series' time, and Plan → Scenarios draws one per scenario on every click).
        var key = yearKey(year);
        yc = key === lastYearKey && lastYc ? lastYc : { inflatable: activeInflatableMonthlyAt(year), income: activeIncomeMonthlyAt(year) };
        lastYearKey = key; lastYc = yc;
        if(cache) cache[year] = yc;
      }
      var inflatableThisYear = yc.inflatable * Math.pow(1 + inflationRate, year);
      var incomeThisYear = (yc.income + (ratios.incomeDelta || 0)) * Math.pow(1 + incomeGrowthRate, year);
      // v3.177.0: retired — pay stops, and living costs come out of what's been saved.
      if(retireYear && year >= retireYear) incomeThisYear = 0;
      if(investPath && investPath[year] != null) monthlyInvestRate = Math.pow(1 + investPath[year], 1 / 12) - 1;
      var ev = events.length ? eventEffects(events, year, thisYear) : null;
      var savingsThisYear = incomeThisYear - fixedMonthly - inflatableThisYear - (ev ? ev.yearly / 12 * Math.pow(1 + inflationRate, year) : 0);
      if(ev && ev.lump){ portfolio += ev.lump * Math.pow(1 + inflationRate, year); cashTrack += ev.lump * Math.pow(1 + inflationRate, year); }
      // v3.173.0: the scenario's own changes — rent elsewhere, an investment property, a cost, a sale.
      if(lg){ savingsThisYear += lg.savingsMonthly; portfolio += lg.lump; cashTrack += lg.lump; }
      // "auto" mode redirects the scenario's own real monthly surplus into the invest leg's
      // growth rate instead of the generic portfolio rate — not an extra contribution on top of
      // it, which would double-count the same money. "manual" pins a fixed figure instead, and
      // whatever's left of the actual surplus still compounds in the generic portfolio as usual.
      var investContribThisYear = investEnabled
        ? (investCfg.contributionMode === "manual" ? (Number(investCfg.monthlyContribution) || 0) : savingsThisYear)
        : 0;
      for(var m = 0; m < 12; m++){
        portfolio = portfolio * (1 + monthlyInvestRate) + (savingsThisYear - investContribThisYear);
        cashTrack = cashTrack * (1 + monthlyInvestRate) + (savingsThisYear - investContribThisYear);
        if(investEnabled) investBalance = investBalance * (1 + investGrowthMonthly) + investContribThisYear;
      }
    }
    var propGrowth = propPath ? propFactor : Math.pow(1 + propRate, year);
    var homeValue = price * (propPath ? propFactor * Math.pow((1 + homePropRate) / (1 + propRate), year) : Math.pow(1 + homePropRate, year));
    var loanBal = purchaseEnabled ? loanBalanceAfterMonths(loanAmount0, rate, term, year * 12, cfg.repaymentType) : 0;
    var homeEquity = purchaseEnabled ? (homeValue - loanBal) : 0;
    var propertiesEquitySum = state.properties.reduce(function(sum, p){
      if(soldFrom[p.id] && year >= soldFrom[p.id]) return sum; // sold in this scenario
      var val = (Number(p.value) || 0) * propGrowth;
      var loanNet = (p.loans || []).reduce(function(s, l){
        // v3.41.0: nothing owed from the year a "Paid out on" date has passed.
        if(loanPaidOut(l, addYearsIso(todayStr, year))) return s;
        var bal = loanBalanceAfterMonths(l.balance, (Number(l.rate) || 0) + rateShockPts, l.termYears, year * 12, l.repaymentType);
        return s + Math.max(0, bal - (Number(l.offsetBalance) || 0));
      }, 0);
      return sum + (val - loanNet);
    }, 0);
    var nominal = homeEquity + portfolio + investBalance + propertiesEquitySum + (lg ? lg.equity : 0);
    // Today's dollars by default. A nominal series is arithmetically fine and completely unusable
    // as a plan: "$6,379,600 at year 20" can't be weighed against the expenses actually typed in,
    // because those are in today's money and that isn't. Deflating by the same inflation rate the
    // model already applies to expenses puts every figure on one scale.
    // v3.34.0: the parts as well as the sum, on the same basis, for the Projections milestones and
    // the year-by-year download. Charts only read x and y.
    var deflate = realTerms ? Math.pow(1 + inflationRate, year) : 1;
    var propertiesDebt = state.properties.reduce(function(sum, p){
      if(soldFrom[p.id] && year >= soldFrom[p.id]) return sum;
      return sum + (p.loans || []).reduce(function(s, l){
        if(loanPaidOut(l, addYearsIso(todayStr, year))) return s;
        return s + Math.max(0, loanBalanceAfterMonths(l.balance, (Number(l.rate) || 0) + rateShockPts, l.termYears, year * 12, l.repaymentType) - (Number(l.offsetBalance) || 0));
      }, 0);
    }, 0);
    points.push({
      x: year, y: nominal / deflate,
      investments: (portfolio + investBalance) / deflate,
      propertyEquity: (homeEquity + propertiesEquitySum + (lg ? lg.equity : 0)) / deflate,
      debt: (loanBal + propertiesDebt + (lg ? lg.debt : 0)) / deflate
    });
  }
  points.triggers = triggers;
  return points;
}

export function recalcComputedItems(){
  state.properties.forEach(function(p){
    if(p.kind !== "IP") return;
    var pmFeeItem = p.expenses.find(function(i){ return i.id === "pmFee6"; });
    if(!pmFeeItem){
      // Born with the same category migrateState seeds onto every other investment-property cost:
      // this row is created here at runtime rather than by the migration, so without it a brand-new
      // property's PM fee would be the one line sitting under "Uncategorised" in the rollups.
      pmFeeItem = { id: "pmFee6", what: "Property Manager Fee", classification: "Needs", category: IP_CATEGORY, account: "", amount: 0, freq: "Weekly", computed: true, computedNote: "" };
      p.expenses.push(pmFeeItem);
    }
    var rentWeekly = toWeekly(sumField(p.income, "yearly") / 52, "Weekly");
    var pmPercent = p.pmFee.percent;
    var pmFlat = p.pmFee.flat;
    var pmFlatWeekly = pmFlat * 12 / 52; // pmFlat is a flat $/month fee; this row's frequency is Weekly
    pmFeeItem.amount = Math.round((rentWeekly * (pmPercent / 100) + pmFlatWeekly) * 100) / 100;
    pmFeeItem.freq = "Weekly";
    pmFeeItem.computedNote = "auto: " + pmPercent + "% of rent + $" + pmFlat.toFixed(2) + "/mo";

    // Land tax, on the same computed-row footing as the PM fee above and for the same reason: it
    // is derived from other fields, so typing it in by hand would go stale the moment land value
    // or the portfolio changes. Unlike the PM fee it is not a function of *this* property alone —
    // it is this property's apportioned share of one aggregated per-state assessment (see
    // landTaxByState) — which is exactly why it cannot be a figure the user maintains per row.
    //
    // Yearly, because that is how it is assessed and how the notice arrives; every rollup in the
    // app converts frequencies anyway, so this is the frequency that needs no explaining.
    var landTaxItem = p.expenses.find(function(i){ return i.id === "landTaxAuto"; });
    var landTaxDetail = landTaxDetailForProperty(p.id);
    var landTax = Math.round((landTaxDetail ? landTaxDetail.tax : 0) * 100) / 100;
    if(!landTaxItem){
      // Only created once there is something to show. A $0 row on every property that has not had
      // a land value entered yet would be five lines of noise across the Budget page saying
      // nothing — and unlike the PM fee, most portfolios legitimately owe no land tax at all.
      if(landTax <= 0) return;
      landTaxItem = { id: "landTaxAuto", what: "Land Tax", classification: "Needs", category: IP_CATEGORY, account: "", amount: 0, freq: "Yearly", computed: true, computedNote: "" };
      p.expenses.push(landTaxItem);
    }
    landTaxItem.amount = landTax;
    landTaxItem.freq = "Yearly";
    // Two different sentences, because the number means two different things. Alone, it is the tax
    // on this property's land. Aggregated, it is a share of one combined assessment — and naming
    // this property's own land value there would caption the figure with a value that, by itself,
    // owes nothing at all.
    landTaxItem.computedNote = landTaxDetail && landTaxDetail.groupCount > 1
      ? "auto: share of " + p.state + " land tax on $" + Math.round(landTaxDetail.groupLandValue).toLocaleString("en-AU") + " combined land value across " + landTaxDetail.groupCount + " properties"
      : "auto: " + p.state + " land tax on $" + Math.round(Number(p.landValue) || 0).toLocaleString("en-AU") + " land value";
  });
  // v3.181.0: and any scenario being edited (its draft, calc/scenariodraft.js), so its loan row follows its calculator.
  state.scenarios.concat(Object.keys(state.purchase || {}).filter(isDraftKey)).forEach(function(scenario){
    var cfg = state.purchase[scenario];
    var loanRow = (state.home[scenario] || []).find(function(i){ return i.id === "homeLoanRow"; });
    if(!loanRow) return;
    if(cfg && cfg.enabled && cfg.syncRepayment){
      var out = recalcPurchase(scenario);
      loanRow.amount = Math.round(out.repaymentMonthly * 100) / 100;
      loanRow.freq = "Monthly";
      loanRow.computed = true;
      loanRow.computedNote = "auto: from purchase calculator above";
    } else if(loanRow.computed){
      loanRow.computed = false;
    }
  });

  var people = getTaxPeople();
  state.income = state.income.filter(function(i){ return !(i.syntheticNetFor && people.indexOf(i.syntheticNetFor) === -1); });
  var liveOneOffs = {}, liveRefunds = {}, liveEnding = {};
  people.forEach(function(person){
    // v3.80.0: regular take-home only; each bonus gets its own yearly row below.
    // v3.145.0: and a rental's tax saving split out as the refund it arrives in (personTakeHomeParts).
    var split = personTakeHomeParts(person);
    var adj = takeHomeAdjust(person);
    var monthly = split.regularMonthly;
    var existing = state.income.find(function(i){ return i.syntheticNetFor === person; });
    var note = "auto: what " + person + "'s payslip pays now, after tax & super (tax as withheld)" +
      (function(){ var bits = [].concat(split.oneOffs.length ? ["bonuses"] : [], split.ending.length ? ["pay that stops"] : [], split.refund ? ["what settles at lodgement"] : []);
        return bits.length ? " — " + bits.join(", ").replace(/, ([^,]*)$/, " and $1") + " are rows of their own" : ""; })() +
      (adj ? " — set to what actually lands, " + (adj < 0 ? "−" : "+") + "$" + Math.round(Math.abs(adj)).toLocaleString("en-AU") + "/mo against the tax estimate" : "");
    if(existing){
      existing.amount = monthly;
      existing.freq = "Monthly";
      existing.computed = true;
      existing.computedNote = note;
    } else {
      state.income.push({
        syntheticNetFor: person, computed: true, what: person + " — Net income (after tax & super)",
        classification: "", account: "", incomeType: "Net", amount: monthly, freq: "Monthly",
        computedNote: note
      });
    }
    split.oneOffs.forEach(function(o){
      var id = o.row.id;
      if(!id) return;
      liveOneOffs[id] = true;
      var row = state.income.find(function(i){ return i.syntheticOneOffFor === id; });
      var fields = { what: (o.row.what || "Bonus") + " — after tax", amount: o.net, freq: "Yearly", irregular: true, dueMonth: o.row.dueMonth || null,
        computed: true, incomeType: "Net", person: person, account: o.row.account || "",
        computedNote: "auto: " + (o.row.what || "this bonus") + " after tax, at " + person + "'s top rate — lands once a year" };
      if(row) Object.assign(row, fields);
      else state.income.push(Object.assign({ syntheticOneOffFor: id, classification: "" }, fields));
    });
    // v3.148.0 / v3.151.0: pay that stops within the year — the monthly take-home includes it while
    // it's paid, as a payslip does; this row takes it off from the day after it stops.
    split.ending.forEach(function(e){
      var id = e.row.id;
      if(!id) return;
      liveEnding[id] = true;
      var er = state.income.find(function(i){ return i.syntheticEndingFor === id; });
      var from = new Date(Date.parse(e.endDate + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
      var ef = { what: (e.row.what || "Pay") + " ends " + fmtDate(e.endDate) + " — after tax", amount: -e.monthly, freq: "Monthly", startDate: from, endDate: "", computed: true, incomeType: "Net", person: person, account: e.row.account || "",
        computedNote: "auto: " + (e.row.what || "this pay") + " stops after " + fmtDate(e.endDate) + " — take-home is this much lower from then" };
      if(er) Object.assign(er, ef);
      else state.income.push(Object.assign({ syntheticEndingFor: id, classification: "" }, ef));
    });
    // v3.145.0 / v3.151.0: what settles at lodgement — the rental's loss, the bonus taxed above
    // what was withheld, pay that stopped, deductions — once a year when the refund (or bill) lands.
    if(split.refund){
      liveRefunds[person] = true;
      var refundRow = state.income.find(function(i){ return i.syntheticRefundFor === person; });
      var amt = split.refund.amount, isRefund = amt >= 0;
      var why = [];
      if(split.refund.rental > 0) why.push("the investment property's loss (" + fmtCurrency0.format(split.refund.rental) + ")");
      why.push("tax on the whole year against what each pay withholds");
      var refundFields = { what: person + (isRefund ? " — Tax refund at lodgement" : " — Tax to pay at lodgement"), amount: amt, freq: "Yearly", irregular: true, dueMonth: split.refund.dueMonth,
        computed: true, incomeType: "Net", person: person,
        computedNote: "auto: " + (isRefund ? "what comes back" : "what's owed") + " when " + person + "'s return is lodged — " + why.join(" and ") + ". Not in any payslip" };
      if(refundRow) Object.assign(refundRow, refundFields);
      else state.income.push(Object.assign({ syntheticRefundFor: person, classification: "", account: "" }, refundFields));
    }
  });
  state.income = state.income.filter(function(i){ return !i.syntheticOneOffFor || liveOneOffs[i.syntheticOneOffFor]; });
  state.income = state.income.filter(function(i){ return !i.syntheticRefundFor || liveRefunds[i.syntheticRefundFor]; });
  state.income = state.income.filter(function(i){ return !i.syntheticEndingFor || liveEnding[i.syntheticEndingFor]; });

  var ipPropertyIds = state.properties.filter(function(p){ return p.kind === "IP"; }).map(function(p){ return p.id; });
  state.income = state.income.filter(function(i){ return !(i.syntheticRentForProperty && ipPropertyIds.indexOf(i.syntheticRentForProperty) === -1); });
  state.properties.filter(function(p){ return p.kind === "IP"; }).forEach(function(p){
    var monthlyRent = Math.round(sumField(p.income, "monthly") * 100) / 100;
    var existingRent = state.income.find(function(i){ return i.syntheticRentForProperty === p.id; });
    var note = "auto: rent for " + p.what + " — edit in Net worth → Property";
    if(existingRent){
      existingRent.amount = monthlyRent;
      existingRent.freq = "Monthly";
      existingRent.computed = true;
      existingRent.computedNote = note;
    } else {
      state.income.push({
        syntheticRentForProperty: p.id, computed: true, what: p.what + " — Rent",
        classification: "", account: "", incomeType: "Net", amount: monthlyRent, freq: "Monthly",
        computedNote: note
      });
    }
  });

  state.assets.forEach(function(a){
    if(a.category !== "Vehicle") return;
    var price = Number(a.purchasePrice) || 0;
    var rate = Number(a.depreciationRate) || 0;
    if(!a.purchaseDate || price <= 0){ a.computed = false; return; }
    var years = Math.max(0, (Date.now() - new Date(a.purchaseDate + "T00:00:00").getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    a.amount = Math.max(0, Math.round(price * Math.pow(1 - rate / 100, years)));
    a.computed = true;
    a.computedNote = "auto: " + rate + "%/yr declining balance from " + fmtCurrency0.format(price) + " (" + fmtDate(a.purchaseDate) + ")";
  });
}

// The household as it is now — the scenario marked Current situation. Selecting another scenario to
// study it must not change figures that describe today (the header, Home, goal dates, the emergency
// fund); those read this, and only scenario comparisons read state.activeScenario.
export function currentScenario(){
  var b = state.baselineScenario;
  return b && (state.scenarios || []).indexOf(b) !== -1 ? b : state.activeScenario;
}

export function scenarioTotals(scenario){
  // Per-scenario: an income row can carry the same scenarioOverrides map a shared expense can, and
  // a Gross row's override re-runs the whole tax computation (see scenarioIncomeMonthly). Before
  // this, every scenario shared one income figure and the Scenarios page could only compare
  // housing costs.
  var incomeMonthly = scenarioIncomeMonthly({ scenario: scenario });
  var ipMonthly = ipExpensesMonthly() + ipLoansMonthly();
  // v3.172.0: today's home lines are left out by a scenario that lives somewhere else.
  var sharedMonthly = sumFieldForScenario(scenarioSharedItems(scenario), scenario, "monthly");
  var homeMonthly = sumField(state.home[scenario], "monthly");
  var expensesMonthly = ipMonthly + sharedMonthly + homeMonthly;
  // v3.173.0 (item 208): the scenario's own changes, once they've all happened — rent elsewhere, an
  // investment property (its rent, costs, loan and tax effect), a new cost; a sale takes away what
  // that property brings in and costs.
  var legs = scenarioLegChanges(scenario), legUpfront = 0, legTax = 0;
  if(legs.length){
    var lctx = scenarioLegContext(scenario);
    var lm = legsMonthly(legs, lctx);
    incomeMonthly += lm.incomeMonthly; expensesMonthly += lm.expensesMonthly; homeMonthly += lm.homeMonthly;
    legUpfront = lm.upfront; legTax = lm.ipTaxMonthly;
    legs.forEach(function(c){
      var sold = c.kind === "sell" && lctx.sold[c.propertyId];
      if(sold) incomeMonthly -= sold.cashMonthly;
    });
  }
  var netMonthly = incomeMonthly - expensesMonthly;
  // v3.80.0: what of that arrives once a year rather than monthly (bonuses), so the headline can
  // say what a normal month leaves. netMonthly stays the year's average for projections.
  var oneOffYearly = scenarioOneOffYearly({ scenario: scenario });
  return {
    incomeMonthly: incomeMonthly, ipMonthly: ipMonthly, sharedMonthly: sharedMonthly,
    homeMonthly: homeMonthly, expensesMonthly: expensesMonthly, changesUpfront: legUpfront, changesTaxMonthly: legTax,
    netMonthly: netMonthly, netYearly: netMonthly * 12,
    oneOffYearly: oneOffYearly, regularNetMonthly: netMonthly - oneOffYearly / 12,
    rate: incomeMonthly > 0 ? netMonthly / incomeMonthly : 0
  };
}
