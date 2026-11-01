import { state } from "../state.js";
import { getTaxPeople, computePersonTax } from "./tax.js";
import { ipProperties, personIpResultAnnual, loanRateOn, loanPaidOut, calcRepaymentMonthly, propertiesTotalEquityToday } from "./property.js";
import { canBuyAll } from "./canbuy.js";
import { emergencyFund } from "./emergency.js";
import { takeHomeDrifts } from "./takehome.js";
import { monthFigures, shiftMonth, monthBounds } from "./monthdetail.js";
import { totalNetWorthValue, toAudAmount } from "./engine.js";
import { localDateStr } from "../lib/format.js";
import { trimReport } from "./trim.js";

// ---------------- What the app notices (v3.98.0) ----------------
//
// The figures were all in the app; reading them for what they mean was left to the person. Each
// rule here looks at one thing an adviser would look at — whether a purchase leaves room to
// breathe, where the cash sits once there's a home loan, tax that could arrive in the pay instead
// of a refund, super room, how the wealth is spread, the savings rate, the emergency fund — and
// says what it found, with what it's worth a year where that's a number.
//
// They're observations from the data, not advice: each says what it's based on and points at the
// page where the figures live. Pure apart from reading state; `today` is passed in.
//
// { id, area, kind: "risk"|"opportunity"|"good"|"info", title, detail, impactYearly|null, go: {page, sub} }
// area: "plan" | "cashflow" | "income" | "tax" | "investments" | "accounts"
function r0(n){ return Math.round(n); }
function money(n){ return "$" + Math.round(Math.abs(n)).toLocaleString("en-AU"); }
function leaves(n){ return n < 0 ? money(n) + " short" : money(n); }
function ym(iso){ return iso.slice(0, 7); }

// Each owner's tax rate on a dollar of this property's result (top rate + Medicare), by ownership.
function ownersRate(p, people, rates){
  var map = p.ownership || {};
  var keys = Object.keys(map);
  if(!keys.length) return people.length ? people.reduce(function(s, n){ return s + (rates[n] || 0); }, 0) / people.length : 0;
  return keys.reduce(function(s, n){ return s + (Number(map[n]) || 0) / 100 * (rates[n] || 0); }, 0);
}

export function adviceFor(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var out = [];
  var add = function(x){ out.push(x); };
  var people = getTaxPeople();
  var tax = {}, rates = {};
  people.forEach(function(n){
    try { tax[n] = computePersonTax(n); } catch(e){ tax[n] = null; }
    var mr = tax[n] ? Number(tax[n].marginalRate) || 0 : 0;
    rates[n] = mr ? mr + 0.02 : 0;
  });

  // ---- Buying: does the purchase leave room, and what changes once it's done ----
  var buys = [];
  try { buys = canBuyAll(); } catch(e){ buys = []; }
  var drifts = {};
  takeHomeDrifts(today).forEach(function(d){ drifts[d.person] = d; });
  var driftMonthly = Object.keys(drifts).reduce(function(s, k){ return s + drifts[k].gap; }, 0);
  buys.forEach(function(c){
    var cfg = state.purchase[c.scenario] || {};
    var rate = Number(cfg.repaymentType === "IO" ? cfg.ioRate : cfg.rate) || 0;
    var shocked = calcRepaymentMonthly(c.loan, rate + 2, cfg.termYears, cfg.repaymentType);
    var shockExtra = Math.max(0, shocked - c.repaymentMonthly);
    var real = c.regularNetMonthly + driftMonthly;
    var stressed = real - shockExtra;
    if(c.short > 0){
      add({ id: "buy-short:" + c.scenario, area: "plan", kind: "risk", title: c.scenario + ": " + money(c.short) + " short of the cash at settlement",
        detail: "It needs " + money(c.upfront) + " up front and cash and offsets hold " + money(c.available) + ".", impactYearly: null, go: { page: "plan", sub: "scenarios" } });
    }
    if(stressed < 500){
      add({ id: "buy-stress:" + c.scenario, area: "plan", kind: "risk", title: c.scenario + " leaves little room",
        detail: "A normal month would leave " + leaves(c.regularNetMonthly) + "." +
          (driftMonthly < -50 ? " With pay as it actually lands (" + money(driftMonthly) + "/mo below the plan) it's " + leaves(real) + "." : "") +
          " If rates rose 2 points, repayments would be " + money(shockExtra) + "/mo higher" + (stressed < 0 ? ", leaving " + money(stressed) + " short every month." : ", leaving " + money(stressed) + ".") +
          " Trips, eating out and other wants would have to carry the difference.",
        impactYearly: null, go: { page: "plan", sub: "scenarios" } });
    } else {
      add({ id: "buy-ok:" + c.scenario, area: "plan", kind: "good", title: c.scenario + " holds up under a rate rise",
        detail: "A normal month leaves " + leaves(c.regularNetMonthly) + "; with rates 2 points higher, still " + leaves(stressed) + ".", impactYearly: null, go: { page: "plan", sub: "scenarios" } });
    }
    // Borrowed money in the deposit: its interest stops being deductible.
    if(c.nonDeductibleExtra > 0){
      add({ id: "buy-borrowed:" + c.scenario, area: "plan", kind: "risk", title: c.scenario + ": the deposit would use borrowed money",
        detail: money(c.draws.filter(function(d){ return d.kind === "borrowed"; }).reduce(function(s, d){ return s + d.take; }, 0)) + " comes from an offset holding money borrowed against the investment. Spent on your own home, that loan's interest (about " + money(c.nonDeductibleExtra) + "/yr) stops being deductible. Paying that loan down and borrowing the amount on the home loan instead may be cleaner — a question for your accountant before settlement.",
        impactYearly: c.nonDeductibleExtra, go: { page: "plan", sub: "scenarios" } });
    }
  });

  // ---- Where the cash sits: an investment loan's offset vs a home loan's ----
  var ipOffsets = [];
  ipProperties().forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(loanPaidOut(l)) return;
      var off = Math.min(Number(l.offsetBalance) || 0, Number(l.balance) || 0);
      var borrowed = !!(p.purchaseDate && l.settlementDate && l.settlementDate > p.purchaseDate);
      if(off > 0 && !borrowed) ipOffsets.push({ p: p, l: l, off: off, rate: Number(loanRateOn(l, today)) || Number(l.rate) || 0 });
    });
  });
  var ipCash = ipOffsets.reduce(function(s, x){ return s + x.off; }, 0);
  if(ipCash > 10000){
    var afterTax = ipOffsets.reduce(function(s, x){ return s + x.off * x.rate / 100 * (1 - ownersRate(x.p, people, rates)); }, 0);
    var effRate = afterTax / ipCash * 100;
    var buy = buys[0];
    if(buy){
      var cfgB = state.purchase[buy.scenario] || {};
      var homeRate = Number(cfgB.rate) || 0;
      // What's left in the investment offsets after the deposit, if moved to the home loan's.
      var left = Math.max(0, buy.left);
      var stay = Math.min(left, ipCash);
      var gain = stay * homeRate / 100 - stay * effRate / 100;
      if(gain > 200) add({ id: "offset-move", area: "plan", kind: "opportunity", title: "After buying, move the cash to the home loan's offset",
        detail: "Cash in the investment loan's offset saves interest you'd otherwise claim back — worth about " + effRate.toFixed(1) + "% a year after tax. In the new home loan's offset it saves interest that isn't deductible, the full " + homeRate.toFixed(2) + "%. On the " + money(stay) + " left after " + buy.scenario + "'s settlement, that's about " + money(gain) + " a year.",
        impactYearly: r0(gain), go: { page: "plan", sub: "scenarios" } });
    } else {
      add({ id: "offset-rate", area: "accounts", kind: "info", title: "Your offset cash earns about " + effRate.toFixed(1) + "% after tax",
        detail: money(ipCash) + " sits against the investment loan, saving interest that would otherwise be deducted. That's a safe return, but a home loan's offset would be worth the full rate — worth knowing if you buy.",
        impactYearly: null, go: { page: "accounts" } });
    }
  }

  // ---- Tax that could come in the pay: a PAYG withholding variation ----
  people.forEach(function(n){
    var ip = personIpResultAnnual(n, people);
    if(!(ip < 0) || !rates[n]) return;
    // v3.148.0: already arranged (Tax → People's tick) — nothing to suggest.
    var st = state.tax && state.tax.settings && state.tax.settings[n];
    if(st && st.withholdingVariation) return;
    var refund = -ip * rates[n];
    if(refund < 1200) return;
    add({ id: "payg:" + n, area: "tax", kind: "opportunity", title: n + ": get the rental's tax benefit in each pay",
      detail: "The rental's loss of " + money(ip) + " a year on " + n + "'s share comes back at tax time — about " + money(refund) + " in a refund. A PAYG withholding variation (an ATO form) lets the employer withhold less instead: about " + money(refund / 12) + " more a month in the pay, the same tax overall. Once it's in place, tick “Pay already allows for the rental’s loss” for " + n + " in Tax → People and the plan's monthly take-home follows.",
      impactYearly: null, go: { page: "tax", sub: "people" } });
  });

  // ---- Super: concessional room ----
  people.forEach(function(n){
    var t = tax[n];
    if(!t) return;
    var room = Math.max(0, (Number(t.capAvailable) || 0) - (Number(t.totalConcessional) || 0));
    if(room < 5000 || !rates[n]) return;
    var contribRate = (Number(t.div293Income) || 0) > 250000 ? 0.30 : 0.15;
    var save = room * Math.max(0, rates[n] - contribRate);
    if(save < 500) return;
    add({ id: "super-room:" + n, area: "tax", kind: "opportunity", title: n + " has " + money(room) + " of concessional super room",
      detail: "Contributions inside the cap are taxed at " + Math.round(contribRate * 100) + "% instead of " + Math.round(rates[n] * 100) + "% — using all of it would save about " + money(save) + " in tax. It's locked away until preservation age" + (buys.length ? ", so it competes with the deposit: worth weighing after the purchase" : "") + ". Unused carry-forward room expires after five years.",
      impactYearly: r0(save), go: { page: "tax" } });
  });

  // ---- How the wealth is spread ----
  var nw = totalNetWorthValue();
  var propEq = propertiesTotalEquityToday();
  var shares = (state.assets || []).filter(function(a){ return a.category === "Shares"; });
  var sharesVal = shares.reduce(function(s, a){ return s + toAudAmount(a, Number(a.amount) || 0); }, 0);
  if(nw > 0 && propEq / nw > 0.7 && sharesVal < propEq * 0.15){
    add({ id: "concentration", area: "investments", kind: "info", title: "Most of your wealth is one property",
      detail: "Property equity is " + Math.round(propEq / nw * 100) + "% of net worth; shares are " + money(sharesVal) + ". A single property is one suburb and one tenant — regular buys of a broad fund would spread it, over time.",
      impactYearly: null, go: { page: "assets" } });
  }
  var tiny = shares.filter(function(a){ return (Number(a.quantity) || 0) > 0 && toAudAmount(a, Number(a.amount) || 0) < 300; });
  if(tiny.length >= 2){
    add({ id: "tiny-holdings", area: "investments", kind: "info", title: tiny.length + " holdings worth under $300 each",
      detail: tiny.map(function(a){ return a.what || a.symbol; }).join(", ") + " — " + money(tiny.reduce(function(s, a){ return s + toAudAmount(a, Number(a.amount) || 0); }, 0)) + " in all. Each one is another line on the tax return when sold and another price to track; selling them when it suits the tax year would simplify things.",
      impactYearly: null, go: { page: "assets", sub: "Shares" } });
  }

  // ---- The last twelve whole months: what came in and what was kept ----
  var cur = ym(today), inn = 0, outM = 0, months = 0;
  for(var i = 1; i <= 12; i++){
    var f = monthFigures(state, shiftMonth(cur, -i));
    if(!f.count && !f.in) continue;
    months++; inn += f.in; outM += f.out;
  }
  if(months >= 6 && inn > 0){
    var rate = (inn - outM) / inn;
    add({ id: "savings-rate", area: "cashflow", kind: rate >= 0.2 ? "good" : rate < 0.05 ? "risk" : "info",
      title: "You kept " + Math.round(rate * 100) + "% of what came in",
      detail: "Over the last " + months + " months: " + money(inn) + " in, " + money(outM) + " spent. " + (rate >= 0.2 ? "That's a strong rate — before loan repayments taken straight from an offset, which aren't in spending." : rate < 0.05 ? "Almost nothing is being kept; the Wants lines are where it usually comes back." : "Loan repayments taken straight from an offset aren't in spending, so the real figure is a little lower."),
      impactYearly: null, go: { page: "expenses", sub: "spending", filter: { direction: "out", from: shiftMonth(cur, -12) + "-01", to: monthBounds(shiftMonth(cur, -1)).end } } });
    // Wants: where the discretionary money goes.
    var lines = {};
    (state.shared || []).forEach(function(l){ if(l.id) lines[l.id] = l; });
    var from = shiftMonth(cur, -12) + "-01", to = cur + "-01", byCat = {}, wants = 0;
    (state.transactions || []).forEach(function(t){
      if(!t.date || t.date < from || t.date >= to) return;
      var l = lines[t.linkedExpenseId];
      if(!l || l.classification !== "Wants") return;
      var v = Number(t.amount) || 0;
      wants += v;
      var k = l.category || l.what || "Other";
      byCat[k] = (byCat[k] || 0) + v;
    });
    if(wants > 0 && outM > 0){
      var top = Object.keys(byCat).map(function(k){ return { k: k, v: byCat[k] }; }).sort(function(a, b){ return b.v - a.v; }).slice(0, 3);
      add({ id: "wants", area: "cashflow", kind: "info", title: "Wants were " + Math.round(wants / outM * 100) + "% of spending",
        detail: money(wants * 12 / months) + " a year, led by " + top.map(function(x){ return x.k + " (" + money(x.v * 12 / months) + ")"; }).join(", ") + ". Trimming them by a tenth would free about " + money(wants * 12 / months * 0.1) + " a year.",
        impactYearly: null, go: { page: "expenses", sub: "budget" } });
    }
  }

  // ---- Emergency fund ----
  var ef = null;
  try { ef = emergencyFund({ today: today }); } catch(e){ ef = null; }
  if(ef && ef.monthly > 0 && ef.coveredMonths != null){
    if(ef.coveredMonths < 3) add({ id: "ef-low", area: "accounts", kind: "risk", title: "Cash covers " + ef.coveredMonths.toFixed(1) + " months of essentials",
      detail: "Essentials run about " + money(ef.monthly) + " a month; three months is " + money(ef.monthly * 3) + ". Building that before anything else protects every other plan.", impactYearly: null, go: { page: "accounts" } });
    else if(buys.some(function(c){ return c.left < ef.monthly * 6; })){
      var tight = buys.filter(function(c){ return c.left < ef.monthly * 6; }).map(function(c){ return c.scenario; });
      add({ id: "ef-after-buy", area: "plan", kind: "risk", title: "After buying, less than six months of essentials left",
        detail: tight.join(", ") + " would leave less than " + money(ef.monthly * 6) + " in cash and offsets. Six months of essentials is a common floor with a mortgage.", impactYearly: null, go: { page: "accounts" } });
    } else add({ id: "ef-ok", area: "accounts", kind: "good", title: "Emergency fund: about " + (ef.coveredMonths >= 24 ? Math.round(ef.coveredMonths / 12) + " years" : Math.round(ef.coveredMonths) + " months") + " of essentials",
      detail: money(ef.available) + " in cash and offsets against " + money(ef.monthly) + " a month of essentials.", impactYearly: null, go: { page: "accounts" } });
  }

  // ---- Pay landing off the plan ----
  Object.keys(drifts).forEach(function(n){
    var d = drifts[n];
    add({ id: "takehome:" + n, area: "income", kind: "info", title: n + "'s pay is landing " + money(d.gap) + "/mo " + (d.gap < 0 ? "below" : "above") + " the plan",
      detail: "Three months running. " + (d.gap < 0 ? "Usually extra withholding (it comes back as a refund) or something taken from pay. " : "") + "Every projection and scenario uses the plan's figure until it's updated.",
      impactYearly: r0(d.gap * 12), go: { page: "expenses", sub: "income" } });
  });

  // ---- v3.100.0: the plan carrying more than is spent, and what trimming would do to a purchase ----
  var trim = null;
  try { trim = trimReport({ today: today }); } catch(e){ trim = null; }
  if(trim && trim.overYearly >= 1000){
    add({ id: "plan-padding", area: "cashflow", kind: "opportunity", title: "The plan budgets " + money(trim.overYearly) + " a year more than you spend",
      detail: trim.over.slice(0, 3).map(function(x){ return x.what + " (" + money(x.planned) + " budgeted, " + money(x.actual) + " spent)"; }).join(", ") + (trim.over.length > 3 ? " and " + (trim.over.length - 3) + " more" : "") +
        ". Every scenario plans with these amounts, so each one looks about " + money(trim.overYearly / 12) + " a month worse than it is. Cash flow → Budget → Trim sets them to what you actually spend.",
      impactYearly: null, go: { page: "expenses", sub: "budget" } });
  }
  if(trim && trim.flexibleYearly > 0){
    buys.forEach(function(c){
      if(!out.some(function(x){ return x.id === "buy-stress:" + c.scenario; })) return;
      var half = trim.flexibleYearly / 24;
      add({ id: "buy-lean:" + c.scenario, area: "plan", kind: "info", title: c.scenario + " run lean: about " + money(half) + "/mo more",
        detail: "Halving the flexible lines (" + trim.flexible.slice(0, 3).map(function(f){ return f.what; }).join(", ") + (trim.flexible.length > 3 ? "…" : "") + ") in this scenario would leave about " + leaves(c.regularNetMonthly + half) + " in a normal month. Cash flow → Budget → Trim runs it lean without touching your budget.",
        impactYearly: null, go: { page: "expenses", sub: "budget" } });
    });
  }

  var order = { risk: 0, opportunity: 1, info: 2, good: 3 };
  return out.sort(function(a, b){ return order[a.kind] - order[b.kind] || (Math.abs(b.impactYearly || 0) - Math.abs(a.impactYearly || 0)); });
}
export function adviceForArea(area, opts){ return adviceFor(opts).filter(function(a){ return a.area === area; }); }
