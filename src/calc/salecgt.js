// ---------------- Tax on a sale, and what a lender allows (v3.186.0, item 217) ----------------
//
// saleCgt — the capital gains tax when a scenario sells a property, the way the rentvesting calculators
// do it: the gain (sale less selling costs less the cost base), halved when held more than a year, and
// nothing on the home lived in. A former home rented out stays exempt for up to six years after moving
// out; past that, the share of the time owned beyond those six years is taxed. An estimate: the rule that
// resets the cost base to the market value when a home is first rented out isn't applied (it usually
// lowers the gain), and an accountant confirms the real figure.
//
// serviceability — whether a lender would likely lend: every loan's repayments, the new ones and the
// household's own, assessed principal-and-interest at its rate plus a buffer (3 points), against
// take-home pay plus most of the rent (80%) less living costs.
//
// Pure: everything comes in as arguments; tax through taxOf(gain) so the caller's tax model decides.

import { calcRepaymentMonthly } from "./property.js";

function dayNum(iso){ var p = String(iso).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
function plusYears(iso, n){ return (Number(iso.slice(0, 4)) + n) + iso.slice(4); }
function r2(n){ return Math.round(n * 100) / 100; }

// inp: { sale, sellingCosts, costBase, bought, sold, use: "never" | "home" | "former", movedOut, taxOf(taxableGain) }
// → { gain, taxedShare, discounted, taxable, tax }
export function saleCgt(inp){
  var gain = Math.max(0, (Number(inp.sale) || 0) - (Number(inp.sellingCosts) || 0) - (Number(inp.costBase) || 0));
  var share = 1;
  if(inp.use === "home") share = 0;
  else if(inp.use === "former" && inp.movedOut){
    var exemptUntil = plusYears(inp.movedOut, 6);
    if(inp.sold <= exemptUntil) share = 0;
    else {
      // Owned from purchase (or, unknown, from moving out) to sale; taxed for the part past six years away.
      var from = inp.bought || inp.movedOut, owned = dayNum(inp.sold) - dayNum(from);
      share = owned > 0 ? Math.min(1, (dayNum(inp.sold) - dayNum(exemptUntil)) / owned) : 1;
    }
  }
  var held = !inp.bought || dayNum(inp.sold) - dayNum(inp.bought) > 365;
  var taxable = gain * share * (held ? 0.5 : 1);
  var tax = taxable > 0 && inp.taxOf ? Math.max(0, inp.taxOf(taxable)) : 0;
  return { gain: r2(gain), taxedShare: share, discounted: held, taxable: r2(taxable), tax: r2(tax) };
}

export var SERVICE_BUFFER = 3;
export var RENT_COUNTED = 0.8;
// inp: { incomeMonthly (after tax), rentMonthly, livingMonthly, loans: [{ balance, rate, termYears }], buffer }
// → { assessedMonthly, surplus, ok }
export function serviceability(inp){
  var buffer = inp.buffer != null ? Number(inp.buffer) : SERVICE_BUFFER;
  var assessed = (inp.loans || []).reduce(function(s, l){
    var bal = Number(l.balance) || 0;
    return bal > 0 ? s + calcRepaymentMonthly(bal, (Number(l.rate) || 0) + buffer, Number(l.termYears) || 30, "PI") : s;
  }, 0);
  var surplus = (Number(inp.incomeMonthly) || 0) + (Number(inp.rentMonthly) || 0) * RENT_COUNTED - (Number(inp.livingMonthly) || 0) - assessed;
  return { assessedMonthly: r2(assessed), surplus: r2(surplus), ok: surplus >= 0 };
}
