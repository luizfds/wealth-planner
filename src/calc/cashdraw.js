import { state } from "../state.js";
import { ipProperties, loanRateOn, loanPaidOut, propertyOwnershipPct } from "./property.js";
import { getTaxPeople, computePersonTax } from "./tax.js";
import { localDateStr } from "../lib/format.js";

// ---------------- Where cash for a purchase comes from (item 248) ----------------
//
// Moved out of "Can we buy?" (v3.88.0) so a scenario's own figures draw cash the same way. A deposit isn't free
// money for a household whose savings sit in an investment loan's offset: every dollar out of the offset is a dollar
// more the loan charges interest on. Cash is drawn in this order: plain cash accounts first (they earn least), then
// offsets holding your own savings, and last an offset holding money borrowed against the investment (a split drawn
// to cash after the purchase, sitting in its own offset). Spending borrowed money on your own home makes that loan's
// interest non-deductible — what it was used for decides, not the property behind it — so it's taken last and its
// extra interest is shown as not deductible. Pure apart from reading state.
export function cashSources(st){
  st = st || state;
  var out = [];
  (st.assets || []).forEach(function(a){
    if(a.category === "Cash" && Number(a.amount) > 0) out.push({ name: a.what || "Cash", amount: Number(a.amount), rate: 0, kind: "cash", deductible: false });
  });
  ipProperties().forEach(function(p){
    (p.loans || []).forEach(function(l){
      if(loanPaidOut(l)) return;
      var off = Math.max(0, Math.min(Number(l.offsetBalance) || 0, Number(l.balance) || 0));
      if(!(off > 0)) return;
      var borrowed = !!(p.purchaseDate && l.settlementDate && l.settlementDate > p.purchaseDate);
      out.push({ name: (l.what || "Loan") + " offset", amount: off, rate: Number(loanRateOn(l, localDateStr())) || Number(l.rate) || 0,
        kind: borrowed ? "borrowed" : "offset", deductible: !borrowed, property: p, loanId: l.id || "",
        // Item 256: an interest-only repayment IS the interest, so it rises; a P&I repayment stays the same and the
        // loan shrinks slower instead.
        interestOnly: l.repaymentType === "IO" });
    });
  });
  var rank = { cash: 0, offset: 1, borrowed: 2 };
  // Within offsets, the cheapest loan first: emptying it costs the least interest.
  return out.sort(function(a, b){ return rank[a.kind] - rank[b.kind] || a.rate - b.rate; });
}

// Tax back on a dollar of extra deductible interest on property p: each owner's top rate plus Medicare.
function taxBackRate(p, marginal){
  var people = getTaxPeople();
  if(!people.length) return 0;
  return people.reduce(function(s, person){
    var pct = propertyOwnershipPct(p, person, people) / 100;
    var mr = marginal(person);
    return s + pct * (mr + (mr > 0 ? 0.02 : 0));
  }, 0);
}

// `amount` of cash taken in that order: what each source gives, the interest the offsets stop saving (a year), how
// much of it is deductible, and the tax back on that part. Item 256: on a P&I loan that interest isn't money out —
// the repayment is the same, the loan shrinks slower — so it's split into the cash part and the slower paydown. Asking for more than there is takes it all; `short` says
// by how much.
export function drawFor(amount){
  var sources = cashSources();
  var need = Math.max(0, Number(amount) || 0), draws = [];
  sources.forEach(function(s){
    if(need <= 0) return;
    var take = Math.min(s.amount, need);
    need -= take;
    draws.push(Object.assign({}, s, { take: take, interestYearly: take * s.rate / 100 }));
  });
  var rates = {};
  var marginal = function(person){
    if(rates[person] == null){
      try { rates[person] = Number(computePersonTax(person).marginalRate) || 0; } catch(e){ rates[person] = 0; }
    }
    return rates[person];
  };
  var extra = draws.reduce(function(t, d){ return t + d.interestYearly; }, 0);
  var cash = draws.reduce(function(t, d){ return t + (d.interestOnly ? d.interestYearly : 0); }, 0);
  var deductible = draws.reduce(function(t, d){ return t + (d.deductible ? d.interestYearly : 0); }, 0);
  var taxBack = draws.reduce(function(t, d){ return t + (d.deductible && d.property && d.interestYearly > 0 ? d.interestYearly * taxBackRate(d.property, marginal) : 0); }, 0);
  return {
    draws: draws, available: sources.reduce(function(t, s){ return t + s.amount; }, 0), short: need > 0 ? need : 0,
    extraInterestYearly: extra, deductibleYearly: deductible, nonDeductibleYearly: extra - deductible, taxBackYearly: taxBack,
    // Item 256: of the extra interest, what comes out as money (interest-only loans) and what slows a P&I loan's paydown.
    cashInterestYearly: cash, slowerPaydownYearly: extra - cash
  };
}
