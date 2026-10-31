// ---------------- Start from a question (v3.174.0, item 209) ----------------
//
// "What are you weighing?" — six common choices, each a handful of questions with sensible defaults,
// turned into a scenario built from the same changes a person could add by hand (calc/scenariolegs.js)
// or the purchase / invest calculators. Pure: answers in, a scenario description out; the caller adds it.
//
// buildScenario(key, answers, ctx) → { name, changes: [...], purchase?: {...}, invest?: {...}, home?: [rows] }
// ctx: { renting (today's home is rented), properties (the household's), state (its state code), idFactory }

export var TEMPLATES = [
  { key: "buyHome", label: "Buy a home to live in", hint: "Stop renting (or move): a home loan, stamp duty and the costs of owning" },
  { key: "rentvest", label: "Buy an investment property", hint: "Keep living where you are, or rent somewhere new — and own one to rent out" },
  { key: "rentElsewhere", label: "Rent somewhere else", hint: "A bigger place, a cheaper one, a different suburb" },
  { key: "upgrade", label: "Move to a bigger home", hint: "Sell the one you own and buy, or rent somewhere bigger" },
  { key: "investInstead", label: "Invest instead", hint: "Put a lump sum and a monthly amount into shares or super" },
  { key: "payDown", label: "Pay the loan down faster", hint: "Extra repayments each month, and what they save" }
];

// The questions for a choice, with defaults worked out from the household where they can be.
export function questionsFor(key, ctx){
  ctx = ctx || {};
  var st = ctx.state || "NSW";
  var props = (ctx.properties || []).map(function(p){ return [p.id, p.what || "A property"]; });
  var owned = (ctx.properties || []).filter(function(p){ return p.kind !== "IP"; }).map(function(p){ return [p.id, p.what || "Your home"]; });
  var withLoans = (ctx.properties || []).filter(function(p){ return (p.loans || []).length; }).map(function(p){ return [p.id, p.what || "A property"]; });
  var STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
  var q = function(k, label, type, value, extra){ return Object.assign({ key: k, label: label, type: type, value: value }, extra || {}); };
  if(key === "buyHome") return [
    q("name", "Call it", "text", "Buy a home"), q("price", "Price", "number", 900000), q("depositPct", "Deposit %", "number", 20),
    q("state", "State", "select", st, { options: STATES }), q("rate", "Interest %", "number", 6.0), q("firstHomeBuyer", "First home buyer", "select", "no", { options: [["no", "No"], ["yes", "Yes"]] })
  ];
  if(key === "rentvest") return [
    q("name", "Call it", "text", "Investment property"), q("price", "Price", "number", 650000), q("state", "State", "select", st, { options: STATES }),
    q("rentWeekly", "Rent it would earn a week", "number", null, { placeholder: "about 4% of the price a year" }),
    q("depositPct", "Deposit %", "number", 20), q("repaymentType", "Loan", "select", "IO", { options: [["IO", "Interest only"], ["PI", "Principal & interest"]] }),
    q("newRentWeekly", "Rent somewhere new a week (blank to stay)", "number", "")
  ];
  if(key === "rentElsewhere") return [
    q("name", "Call it", "text", "Rent somewhere else"), q("rentWeekly", "Rent a week", "number", 750), q("fromYear", "From", "select", "0", { options: [["0", "Now"], ["1", "In a year"], ["2", "In two years"]] })
  ];
  if(key === "upgrade") return ctx.renting || !owned.length ? [
    q("name", "Call it", "text", "A bigger place"), q("rentWeekly", "Rent a week", "number", 900)
  ] : [
    q("name", "Call it", "text", "A bigger home"), q("sellId", "Sell", "select", owned[0][0], { options: owned }), q("price", "Price of the new home", "number", 1300000),
    q("depositPct", "Deposit %", "number", 20), q("state", "State", "select", st, { options: STATES }), q("fromYear", "When", "select", "0", { options: [["0", "Now"], ["1", "In a year"], ["2", "In two years"]] })
  ];
  if(key === "investInstead") return [
    q("name", "Call it", "text", "Invest instead"), q("initialAmount", "Lump sum now", "number", 50000), q("monthly", "A month from then", "number", 1000),
    q("assetType", "Into", "select", "Shares", { options: [["Shares", "Shares / ETFs"], ["Crypto", "Crypto"], ["Other", "Other investment"]] })
  ];
  if(key === "payDown") return [
    q("name", "Call it", "text", "Pay the loan down faster"), q("propertyId", "Loan on", "select", withLoans.length ? withLoans[0][0] : "", { options: withLoans.length ? withLoans : [["", "No property loans yet"]] }),
    q("amount", "Extra a month", "number", 500), q("rate", "Its interest %", "number", 6.0)
  ];
  return [];
}

function n(v, d){ var x = Number(v); return v === "" || v == null || !isFinite(x) ? d : x; }
// Typical running costs of owning a home, from its price — a start the person can change.
export function homeRunningCosts(price){
  return [
    { id: "homeLoanRow", what: "Home loan", classification: "Needs", account: "", amount: 0, freq: "Monthly" },
    { what: "Council rates", classification: "Needs", account: "", amount: Math.round(price * 0.0025 / 4), freq: "Quarterly" },
    { what: "Home insurance", classification: "Needs", account: "", amount: Math.round(Math.max(1200, price * 0.0015)), freq: "Yearly" },
    { what: "Maintenance", classification: "Needs", account: "", amount: Math.round(price * 0.01 / 12), freq: "Monthly", irregular: true }
  ];
}

export function buildScenario(key, a, ctx){
  ctx = ctx || {};
  a = a || {};
  var id = ctx.idFactory || (function(){ var i = 0; return function(){ return "t" + (++i); }; })();
  var out = { name: String(a.name || "").trim() || (TEMPLATES.find(function(t){ return t.key === key; }) || {}).label || "Scenario", changes: [] };
  var purchase = function(price, depositPct, stateCode, rate, fhb){
    return { enabled: true, price: price, depositPct: depositPct, state: stateCode, rate: rate, ioRate: rate, termYears: 30, firstHomeBuyer: !!fhb, repaymentType: "PI", syncRepayment: true };
  };
  if(key === "buyHome"){
    var price = n(a.price, 900000);
    out.purchase = purchase(price, n(a.depositPct, 20), a.state || ctx.state || "NSW", n(a.rate, 6), a.firstHomeBuyer === "yes");
    out.home = homeRunningCosts(price);
  } else if(key === "rentvest"){
    var p = n(a.price, 650000);
    out.changes.push({ id: id(), kind: "ip", what: "Investment property", price: p, depositPct: n(a.depositPct, 20), rate: 6.2, termYears: 30,
      repaymentType: a.repaymentType === "PI" ? "PI" : "IO", state: a.state || ctx.state || "NSW",
      rentWeekly: n(a.rentWeekly, Math.round(p * 0.04 / 52 / 5) * 5), vacancyWeeks: 2, mgmtPct: 7, costsYearly: Math.round(p * 0.007),
      depreciationYearly: 4000, growthPct: "", owner: "", fromYear: 0 });
    if(n(a.newRentWeekly, 0) > 0) out.changes.unshift({ id: id(), kind: "rent", what: "Rent", amount: n(a.newRentWeekly, 0), freq: "Weekly", fromYear: 0 });
  } else if(key === "rentElsewhere"){
    out.changes.push({ id: id(), kind: "rent", what: "Rent", amount: n(a.rentWeekly, 750), freq: "Weekly", fromYear: n(a.fromYear, 0) });
  } else if(key === "upgrade"){
    if(!a.sellId){
      out.changes.push({ id: id(), kind: "rent", what: "Rent", amount: n(a.rentWeekly, 900), freq: "Weekly", fromYear: 0 });
    } else {
      var np = n(a.price, 1300000);
      out.changes.push({ id: id(), kind: "sell", propertyId: a.sellId, fromYear: n(a.fromYear, 0), sellingCostsPct: 2.5 });
      out.purchase = purchase(np, n(a.depositPct, 20), a.state || ctx.state || "NSW", 6.0, false);
      out.home = homeRunningCosts(np);
    }
  } else if(key === "investInstead"){
    var kind = ["Shares", "Crypto", "Other"].indexOf(a.assetType) !== -1 ? a.assetType : "Shares";
    out.invest = { enabled: true, assetType: kind, initialAmount: n(a.initialAmount, 0),
      contributionMode: "manual", monthlyContribution: n(a.monthly, 0), growthRatePct: { Shares: 8, Crypto: 12, Other: 6 }[kind] };
  } else if(key === "payDown"){
    out.changes.push({ id: id(), kind: "extra", propertyId: a.propertyId || "", amount: n(a.amount, 500), freq: "Monthly", rate: n(a.rate, 6), fromYear: 0 });
  }
  return out;
}
