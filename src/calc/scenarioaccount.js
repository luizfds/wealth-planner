// ---------------- Try a scenario on an account (v3.185.0, item 216) ----------------
//
// PocketSmith's scenarios are layers on an account's forecast. Here: an everyday account's next 90 days
// (calc/dailyforecast.js), with a scenario laid over it from a settlement day — the cash it needs that
// day, then what it changes on the days it happens: a new rent or cost on its rhythm, an investment
// property's rent in each week and its loan and costs each month, a home bought's repayments and costs,
// the money put into investing instead. A scenario that lives elsewhere stops today's home bills from the
// day it moves. Changes dated later, at an age not reached or waiting on cash aren't in a 90-day window.

import { forecastInputs, dailyBalance } from "./dailyforecast.js";
import { scenarioLegChanges, isCashTriggered } from "./engine.js";
import { livesElsewhere } from "./scenariochanges.js";
import { ipFigures } from "./scenariolegs.js";
import { recalcPurchase } from "./property.js";

function addDays(iso, n){ var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonths(iso, n){
  var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, day = Number(iso.slice(8, 10));
  var ty = y + Math.floor(m / 12), tm = ((m % 12) + 12) % 12, last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return ty + "-" + String(tm + 1).padStart(2, "0") + "-" + String(Math.min(day, last)).padStart(2, "0");
}
var STEPS = { Weekly: [7, 0], Fortnightly: [14, 0], Monthly: [0, 1], Quarterly: [0, 3], "Half-yearly": [0, 6], Yearly: [0, 12] };
// Every date from `start` (itself included) on the rhythm, up to `end`.
export function datesOn(start, freq, end){
  var st = STEPS[freq] || STEPS.Monthly, out = [], i = 0, d = start;
  while(d <= end && i < 400){ out.push(d); i++; d = st[0] ? addDays(start, st[0] * i) : addMonths(start, st[1] * i); }
  return out;
}
function every(start, freq, end, amount, what, kind){
  return datesOn(start, freq, end).map(function(d){ return { date: d, amount: amount, what: what, kind: kind }; });
}

// { events, removed, settlement } — what the scenario adds to the account from `settleOn`, which home
// bill lines it stops (by id), and the cash it needs on the day. The deposit usually comes from savings,
// not the everyday account, so it's only in the events with opts.settlementHere.
// opts: { taxEffect(owner, taxable), settlementHere }.
export function scenarioEvents(st, key, settleOn, end, opts){
  opts = opts || {};
  var ev = [], removed = {}, settlement = 0;
  var settle = function(amount, what){ settlement += amount; if(opts.settlementHere) ev.push({ date: settleOn, amount: -amount, what: what, kind: "scenario" }); };
  if(livesElsewhere(key, st)) (st.shared || []).forEach(function(l){ if(l && l.homeCost && l.id) removed[l.id] = true; });
  scenarioLegChanges(key).forEach(function(c){
    if(isCashTriggered(c) || (Number(c.fromYear) || 0) > 0) return;
    var amt = Number(c.amount) || 0;
    if(c.kind === "rent") ev = ev.concat(every(settleOn, c.freq || "Weekly", end, -amt, c.what || "Rent", "scenario"));
    else if(c.kind === "cost") ev = ev.concat(every(settleOn, c.freq || "Monthly", end, -amt, c.what || "A cost", "scenario"));
    else if(c.kind === "extra") ev = ev.concat(every(settleOn, c.freq || "Monthly", end, -amt, "Extra repayment", "scenario"));
    else if(c.kind === "ip"){
      var f = ipFigures(c, { taxEffect: opts.taxEffect ? function(tx){ return opts.taxEffect(c.owner, tx); } : null });
      var name = c.what || "Investment property";
      settle(f.upfront, name + " — settlement");
      var weekly = (f.rentYearly - f.mgmtYearly) / 52;
      ev = ev.concat(every(addDays(settleOn, 7), "Weekly", end, weekly, name + " — rent", "scenario"));
      ev = ev.concat(every(addMonths(settleOn, 1), "Monthly", end, -f.repaymentMonthly, name + " — loan", "scenario"));
      ev = ev.concat(every(addMonths(settleOn, 1), "Monthly", end, -f.costsYearly / 12, name + " — costs", "scenario"));
    }
  });
  var cfg = st.purchase && st.purchase[key], inv = st.invest && st.invest[key];
  if(cfg && cfg.enabled && !(inv && inv.enabled)){
    var out = recalcPurchase(key);
    if(out){
      settle(out.upfrontCash, "Home — settlement");
      (st.home[key] || []).forEach(function(r){
        var first = r.id === "homeLoanRow" ? addMonths(settleOn, 1) : settleOn;
        if(Number(r.amount) > 0) ev = ev.concat(every(first, r.freq || "Monthly", end, -Number(r.amount), r.what || "Home cost", "scenario"));
      });
    }
  } else if(livesElsewhere(key, st)){
    (st.home[key] || []).forEach(function(r){ if(Number(r.amount) > 0) ev = ev.concat(every(settleOn, r.freq || "Monthly", end, -Number(r.amount), r.what || "Home cost", "scenario")); });
  }
  if(inv && inv.enabled){
    if(Number(inv.initialAmount) > 0) settle(Number(inv.initialAmount), "Invested");
    var monthly = inv.contributionMode === "manual" ? Number(inv.monthlyContribution) || 0 : 0;
    if(monthly > 0) ev = ev.concat(every(addMonths(settleOn, 1), "Monthly", end, -monthly, "Invested each month", "scenario"));
  }
  return { events: ev, removed: removed, settlement: Math.round(settlement) };
}

// The account's 90 days today, and with the scenario: { today, scenario } as dailyBalance gives them.
export function scenarioOnAccount(st, key, account, today, settleOn, opts){
  opts = opts || {};
  var days = opts.days || 90, end = addDays(today, days);
  var base = forecastInputs(st, account, today, days, opts);
  if(base.start == null) return null;
  var layer = scenarioEvents(st, key, settleOn, end, opts);
  var kept = base.events.filter(function(e){ return !(e.id && layer.removed[e.id] && e.date >= settleOn); });
  var mk = function(events){ return dailyBalance({ start: base.start, today: today, days: days, events: events, spendDaily: base.spendDaily, buffer: account.buffer }); };
  return { today: mk(base.events), scenario: mk(kept.concat(layer.events)), settleOn: settleOn, settlement: layer.settlement };
}
