// ---------------- The demo household (v3.104.0) ----------------
//
// "Sample data" used to roll dice: a property 60% of the time, different people and amounts on every
// load, and no transactions, money received or balance history at all — so the demo showed $0 on
// This month, every report was empty and every chart asked you to log something. A demo is the first
// thing a new visitor sees, and it should look like a household that has used the app for a while.
//
// One fixed, invented household instead. Same people, lines and amounts every time; only the dates
// move, counted back from today, so it always looks current. About eighteen months of spending,
// pay and rent received, card repayments, account and holding balances, property values and loan
// balances, and a net worth log built from the same figures. Every name, place and amount is made
// up (CLAUDE.md: never real data).
//
// Pure: demoHousehold(today) returns a state object (run it through migrateState); demoReceipts(state,
// today) adds the pay and rent received once migrateState/recalc has worked out the take-home rows.

import { defaultPurchaseConfig } from "../state.js";

export var DEMO_PEOPLE = ["Alex", "Sam"];

// A small seeded generator, so "random-looking" spending is identical on every load.
function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function r2(n){ return Math.round(n * 100) / 100; }
function pad(n){ return String(n).padStart(2, "0"); }
function ymd(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parse(s){ return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))); }
function addDays(s, n){ var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
function monthStart(s, back){ var d = parse(s); return ymd(new Date(d.getFullYear(), d.getMonth() - back, 1)); }
function monthEnd(ym){ var d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0); return ymd(d); }
function dayIn(ym, day){ var last = Number(monthEnd(ym).slice(8, 10)); return ym + "-" + pad(Math.min(day, last)); }
function yearsAgo(s, n){ var d = parse(s); return ymd(new Date(d.getFullYear() - n, d.getMonth(), Math.min(d.getDate(), 28))); }

var MONTHS_BACK = 17; // plus the current month: eighteen months of history

// Budget lines, with the merchants their spending is logged under.
var LINES = [
  { id: "demo-groceries", what: "Groceries", category: "Groceries", classification: "Needs", account: "Credit Card", amount: 260, freq: "Weekly", merchants: ["Fern Grocer", "Corner Market", "Bank St Butcher"] },
  { id: "demo-eating", what: "Eating out", category: "Eating out", classification: "Wants", account: "Credit Card", amount: 140, freq: "Fortnightly", merchants: ["Fern Café", "Harbour Noodles", "Little Pizza Co"] },
  { id: "demo-power", what: "Electricity", category: "Utilities", classification: "Needs", account: "Everyday Account", amount: 165, freq: "Monthly", day: 9, merchants: ["Bright Energy"] },
  { id: "demo-gas", what: "Gas", category: "Utilities", classification: "Needs", account: "Everyday Account", amount: 140, freq: "Quarterly", day: 20, merchants: ["Bright Energy"] },
  { id: "demo-internet", what: "Internet", category: "Utilities", classification: "Needs", account: "Credit Card", amount: 85, freq: "Monthly", day: 3, fixed: true, merchants: ["Wavelink Broadband"] },
  { id: "demo-phones", what: "Mobile phones", category: "Utilities", classification: "Needs", account: "Credit Card", amount: 70, freq: "Monthly", day: 14, fixed: true, merchants: ["Wavelink Mobile"] },
  { id: "demo-health", what: "Health insurance", category: "Health", classification: "Needs", account: "Everyday Account", amount: 245, freq: "Monthly", day: 1, fixed: true, merchants: ["Kindly Health Fund"] },
  { id: "demo-car-ins", what: "Car insurance", category: "Car", classification: "Needs", account: "Everyday Account", amount: 95, freq: "Monthly", day: 22, fixed: true, merchants: ["Steady Insurance"] },
  { id: "demo-rego", what: "Car registration", category: "Car", classification: "Needs", account: "Everyday Account", amount: 780, freq: "Yearly", month: 3, day: 11, fixed: true, merchants: ["Transport Registry"] },
  { id: "demo-fuel", what: "Fuel", category: "Transport", classification: "Needs", account: "Credit Card", amount: 70, freq: "Weekly", merchants: ["Roadside Fuel", "Northside Servo"] },
  { id: "demo-transit", what: "Public transport", category: "Transport", classification: "Needs", account: "Credit Card", amount: 40, freq: "Weekly", merchants: ["City Transit"] },
  { id: "demo-gym", what: "Gym", category: "Personal", classification: "Wants", account: "Credit Card", amount: 32, freq: "Fortnightly", fixed: true, merchants: ["Peak Fitness"] },
  { id: "demo-streaming", what: "Streaming", category: "Subscriptions", classification: "Wants", account: "Credit Card", amount: 29, freq: "Monthly", day: 6, fixed: true, merchants: ["StreamBox"] },
  { id: "demo-clothes", what: "Clothing", category: "Shopping", classification: "Wants", account: "Credit Card", amount: 150, freq: "Monthly", day: 17, merchants: ["Thread & Co", "Outlet Shoes"] },
  { id: "demo-pets", what: "Pet care", category: "Personal", classification: "Wants", account: "Credit Card", amount: 90, freq: "Monthly", day: 25, merchants: ["Paws Vet", "Pet Barn Supplies"] },
  { id: "demo-gifts", what: "Gifts", category: "Other", classification: "Wants", account: "Credit Card", amount: 1200, freq: "Yearly", irregular: true, merchants: ["Gift Shop", "Bookworm Books"] },
  { id: "demo-travel", what: "Holidays", category: "Other", classification: "Wants", account: "Credit Card", amount: 5000, freq: "Yearly", irregular: true, merchants: ["Sky Air", "Seaside Stays"] },
  { id: "demo-contents", what: "Contents insurance", category: "Insurance", classification: "Needs", account: "Everyday Account", amount: 540, freq: "Yearly", month: 8, day: 4, fixed: true, merchants: ["Steady Insurance"] }
];

// The property, its loan and its manager's costs.
var IP_ID = "demo-ip", LOAN_ID = "demo-ip-loan";

export function demoHousehold(today){
  var rand = rng(20260301);
  var start = monthStart(today, MONTHS_BACK);
  var months = [];
  for(var mi = MONTHS_BACK; mi >= 0; mi--) months.push(monthStart(today, mi).slice(0, 7));
  // Month-end snapshot dates for every finished month, then today.
  var snapDates = months.slice(0, -1).map(monthEnd).concat([today]);

  // ---- Spending ----
  var transactions = [], tn = 0;
  function spend(line, date, amount){
    if(date < start || date >= today) return;
    var m = line.merchants[Math.floor(rand() * line.merchants.length)];
    transactions.push({ id: "demo-t" + (++tn), date: date, what: m, amount: r2(amount), account: line.account, linkedExpenseId: line.id });
  }
  LINES.forEach(function(line, li){
    var jitter = function(){ return line.fixed ? line.amount : line.amount * (0.8 + rand() * 0.4); };
    if(line.freq === "Weekly" || line.freq === "Fortnightly"){
      var step = line.freq === "Weekly" ? 7 : 14;
      for(var d = addDays(start, li % 6); d < today; d = addDays(d, step)) spend(line, d, jitter());
    } else if(line.irregular){
      // Two or three lumps a year, in the same months each year.
      // Shares of the year's budget by month, adding up to about the line's amount.
      var shares = line.id === "demo-travel" ? { 4: 0.3, 9: 0.45, 12: 0.25 } : { 4: 0.35, 12: 0.65 };
      months.forEach(function(ym){ var w = shares[Number(ym.slice(5, 7))]; if(w) spend(line, dayIn(ym, 10 + li % 10), line.amount * w * (0.9 + rand() * 0.2)); });
    } else {
      months.forEach(function(ym){
        var m = Number(ym.slice(5, 7));
        if(line.freq === "Quarterly" && m % 3 !== 2) return;
        if(line.freq === "Yearly" && m !== line.month) return;
        spend(line, dayIn(ym, line.day || 15), jitter());
      });
    }
  });
  transactions.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  // Card repayments: each month the card's spending from the month before, from the everyday account.
  var transfers = [];
  months.slice(1).forEach(function(ym, i){
    var prev = months[i];
    var owed = transactions.filter(function(t){ return t.account === "Credit Card" && t.date.slice(0, 7) === prev; }).reduce(function(s, t){ return s + t.amount; }, 0);
    var date = dayIn(ym, 5);
    if(date < today && owed > 0) transfers.push({ id: "demo-x" + i, date: date, amount: r2(owed), from: "Everyday Account", to: "Credit Card", what: "Card repayment" });
    var save = dayIn(ym, 16);
    if(save < today) transfers.push({ id: "demo-s" + i, date: save, amount: 1500, from: "Everyday Account", to: "High Interest Savings", what: "Monthly saving" });
  });

  // ---- Balances over time ----
  function series(fn){ return snapDates.map(function(d, i){ return { date: d, value: r2(fn(i, d)) }; }); }
  var n = snapDates.length - 1;
  var everyday = series(function(i){ return 6200 + Math.sin(i * 1.3) * 1800 + i * 40; });
  var savings = series(function(i){ return 52000 + i * 1580 + i * i * 6; });
  var offset = series(function(i){ return 18000 + i * 520; });
  var superA = series(function(i){ return 148000 * Math.pow(1.0055, i) + i * 1050; });
  var superB = series(function(i){ return 96000 * Math.pow(1.0055, i) + i * 780; });
  var ipValue = series(function(i){ return Math.round((612000 + i * 1650 + (i > 9 ? 6000 : 0)) / 1000) * 1000; })
    .filter(function(p, i){ return i % 3 === 0 || i === n; }); // revalued quarterly
  var loanBal = 452000;

  // Shares: a broad Australian ETF bought in three lots, and a global one in two.
  function priceAt(base, drift, i){ return r2(base * Math.pow(1 + drift, i) * (1 + Math.sin(i * 0.9) * 0.025)); }
  function holding(id, what, symbol, base, drift, buys){
    var hist = snapDates.map(function(d, i){
      var units = buys.filter(function(b){ return b.i <= i; }).reduce(function(s, b){ return s + b.units; }, 0);
      var price = priceAt(base, drift, i);
      return { date: d, value: r2(units * price), price: price };
    }).filter(function(p){ return p.value > 0; });
    var units = buys.reduce(function(s, b){ return s + b.units; }, 0);
    var price = priceAt(base, drift, n);
    return { id: id, what: what, category: "Shares", symbol: symbol, market: "ASX", person: "",
      quantity: units, price: price, priceUpdated: today, amount: r2(units * price),
      lots: buys.map(function(b, k){ return { id: id + "-lot" + k, date: snapDates[b.i], units: b.units, price: priceAt(base, drift, b.i), brokerage: 9.5, soldUnits: 0 }; }),
      sales: [], payouts: [], taxStatements: [], history: hist };
  }
  var shares = [
    holding("demo-vas", "Vanguard Australian Shares ETF", "VAS", 96, 0.006, [{ i: 0, units: 120 }, { i: 6, units: 80 }, { i: 12, units: 60 }]),
    holding("demo-ivv", "iShares S&P 500 ETF", "IVV", 58, 0.009, [{ i: 2, units: 150 }, { i: 10, units: 100 }])
  ];

  var last = function(h){ return h[h.length - 1].value; };
  var assets = [
    { id: "demo-cash-everyday", what: "Everyday Account", category: "Cash", amount: last(everyday), history: everyday },
    { id: "demo-cash-savings", what: "High Interest Savings", category: "Cash", amount: last(savings), history: savings }
  ].concat(shares).concat([
    { id: "demo-super-alex", what: "Superannuation", category: "Super", person: "Alex", amount: last(superA), history: superA },
    { id: "demo-super-sam", what: "Superannuation", category: "Super", person: "Sam", amount: last(superB), history: superB },
    { id: "demo-car", what: "Family car", category: "Vehicle", purchasePrice: 32000, purchaseDate: yearsAgo(today, 3), depreciationRate: 12, amount: 21500, computed: true, computedNote: "auto: declining balance", history: series(function(i){ return 21500 * Math.pow(1.01, n - i); }) }
  ]);

  // Net worth on each snapshot date, from the same figures.
  function valueOn(hist, d){ var v = null; hist.forEach(function(p){ if(p.date <= d) v = p.value; }); return v == null ? 0 : v; }
  var netWorthLog = snapDates.map(function(d, i){
    var holdingsNow = shares.reduce(function(s, h){ return s + valueOn(h.history, d); }, 0);
    return { date: d, value: r2(everyday[i].value + savings[i].value + offset[i].value + superA[i].value + superB[i].value + holdingsNow + 21500 + valueOn(ipValue, d) - loanBal) };
  }).slice(0, -1); // today's figure is live, not logged

  var homeLines = function(key, rent, rates, water, insurance, upkeep){
    return [
      { id: "homeLoanRow", what: rent ? "Rent" : "Home loan", category: "Housing", classification: "Needs", account: "Everyday Account", amount: rent || 0, freq: rent ? "Weekly" : "Monthly" },
      { id: "demo-" + key + "-rates", what: "Council rates", category: "Housing", classification: rates ? "Needs" : "N/A", account: "Everyday Account", amount: rates, freq: "Quarterly" },
      { id: "demo-" + key + "-water", what: "Water", category: "Housing", classification: "Needs", account: "Everyday Account", amount: water, freq: "Quarterly" },
      { id: "demo-" + key + "-ins", what: "Home insurance", category: "Housing", classification: insurance ? "Needs" : "N/A", account: "Everyday Account", amount: insurance, freq: "Yearly" },
      { id: "demo-" + key + "-upkeep", what: "Maintenance", category: "Housing", classification: upkeep ? "Needs" : "N/A", account: "Everyday Account", amount: upkeep, freq: "Yearly" }
    ];
  };
  var buyHouse = homeLines("house", 0, 620, 280, 1900, 2500); buyHouse[0].amount = 4650;
  var buyUnit = homeLines("unit", 0, 410, 240, 900, 1200); buyUnit[0].amount = 3350;

  // Rent paid, monthly in the renting scenario's home line.
  var rentLine = { id: "homeLoanRow", what: "Rent", merchants: ["Example Realty"], account: "Everyday Account" };
  for(var w = addDays(start, 2); w < today; w = addDays(w, 7)) transactions.push({ id: "demo-t" + (++tn), date: w, what: rentLine.merchants[0], amount: 620, account: rentLine.account, linkedExpenseId: rentLine.id });
  // The property's quarterly rates and yearly insurance, paid from the everyday account.
  months.forEach(function(ym){
    var m = Number(ym.slice(5, 7));
    if(m % 3 === 1) spend({ id: "demo-ip-rates", merchants: ["Shire Council"], account: "Everyday Account" }, dayIn(ym, 12), 520);
    if(m === 7) spend({ id: "demo-ip-ins", merchants: ["Steady Insurance"], account: "Everyday Account" }, dayIn(ym, 18), 1350);
  });
  transactions.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  var settings = {};
  settings.Alex = { dateOfBirth: yearsAgo(today, 39) };
  settings.Sam = { dateOfBirth: yearsAgo(today, 36) };

  return {
    activeScenario: "Renting", baselineScenario: "Renting",
    scenarios: ["Renting", "Buy a house", "Buy an apartment"],
    showAllPeriods: false,
    income: [
      { id: "demo-pay-alex", what: "Alex's salary (Employer A)", classification: "", account: "Everyday Account", person: "Alex", incomeType: "Gross", amount: 9800, freq: "Monthly" },
      { id: "demo-bonus-alex", what: "Alex's bonus", classification: "", account: "Everyday Account", person: "Alex", incomeType: "Gross", amount: 6000, freq: "Yearly", irregular: true, dueMonth: 8, sacrificeMode: "none", sacrificeValue: 0 },
      { id: "demo-pay-sam", what: "Sam's salary (Employer B)", classification: "", account: "Everyday Account", person: "Sam", incomeType: "Gross", amount: 7400, freq: "Monthly" }
    ],
    ip: [],
    shared: LINES.map(function(l){ var o = Object.assign({}, l); delete o.merchants; delete o.day; delete o.month; delete o.fixed; return o; }),
    home: { "Renting": homeLines("rent", 620, 0, 95, 0, 0), "Buy a house": buyHouse, "Buy an apartment": buyUnit },
    purchase: {
      "Renting": defaultPurchaseConfig(0, 20, 6, 30, "NSW", false),
      "Buy a house": defaultPurchaseConfig(1150000, 20, 6.1, 30, "NSW", true),
      "Buy an apartment": defaultPurchaseConfig(780000, 20, 6.1, 30, "VIC", true)
    },
    accounts: [
      { id: "demo-acct-everyday", name: "Everyday Account", type: "everyday", statementStartDay: 1, link: "asset:demo-cash-everyday" },
      { id: "demo-acct-savings", name: "High Interest Savings", type: "savings", statementStartDay: 1, link: "asset:demo-cash-savings" },
      { id: "demo-acct-card", name: "Credit Card", type: "credit", statementStartDay: 12, limit: 12000 },
      { id: "demo-acct-offset", name: "Offset", type: "offset", statementStartDay: 1, link: "offset:" + LOAN_ID },
      { id: "demo-acct-loan", name: "Investment loan", type: "loan", statementStartDay: 1, link: "loan:" + LOAN_ID }
    ],
    assets: assets,
    properties: [{
      id: IP_ID, what: "1 Example St", kind: "IP", state: "QLD", value: last(ipValue), landValue: 310000,
      purchasePrice: 575000, purchaseDate: yearsAgo(today, 4), history: ipValue,
      acquisitionCosts: [
        { id: "demo-ac1", what: "Stamp duty", amount: 19800 },
        { id: "demo-ac2", what: "Legal / conveyancing", amount: 1650 },
        { id: "demo-ac3", what: "Building & pest inspection", amount: 550 }
      ],
      constructionDate: "2009-06-01", constructionCost: 240000,
      pmFee: { percent: 7, flat: 0 }, incomePaidFreq: "Monthly",
      ownership: { Alex: 50, Sam: 50 },
      loans: [{
        id: LOAN_ID, what: "Investment loan", balance: loanBal, rate: 6.24, termYears: 30, settlementDate: yearsAgo(today, 4),
        repaymentType: "IO", repaymentMode: "auto", manualRepaymentAmount: 0, manualRepaymentFreq: "Monthly",
        borrowingCosts: 1840,
        offsetBalance: last(offset), offsetHistory: offset,
        balanceHistory: snapDates.map(function(d){ return { date: d, value: loanBal }; })
      }],
      income: [{ what: "Rent", account: "Offset", amount: 590, freq: "Weekly", classification: "" }],
      expenses: [
        { id: "demo-ip-ins", what: "Landlord insurance", category: "Investment property", classification: "Needs", account: "Everyday Account", amount: 1350, freq: "Yearly" },
        { id: "demo-ip-rates", what: "Council rates", category: "Investment property", classification: "Needs", account: "Everyday Account", amount: 520, freq: "Quarterly" },
        { id: "demo-ip-repairs", what: "Repairs", category: "Investment property", classification: "Needs", account: "Everyday Account", amount: 1500, freq: "Yearly" },
        { id: "pmFee6", what: "Property manager fee", category: "Investment property", classification: "Needs", account: "Offset", amount: 0, freq: "Weekly", computed: true, computedNote: "" }
      ]
    }],
    transactions: transactions,
    transfers: transfers,
    incomeLog: [],
    netWorthLog: netWorthLog,
    savingsGoals: [{ id: "demo-goal-deposit", name: "House deposit", target: 180000, by: yearsAgo(today, -2), accounts: ["High Interest Savings", "Offset"] }],
    projection: { horizonYears: 20, investReturnRate: 7, propertyAppreciationRate: 5, inflationRate: 3, rateShockPct: 0, incomeGrowthRate: 3, realTerms: true },
    tax: { sgRate: 12, settings: settings },
    lastBackupDate: addDays(today, -6),
    setupDismissed: true
  };
}

// Pay, bonus and rent received, on the same dates each month, at what the plan says arrives (within
// a few dollars). Needs the take-home rows migrateState/recalc adds, so it runs on the live state
// afterwards with incomeTargets() (calc/received.js): [{ key, monthly, yearly? }].
export function demoReceipts(st, today, targets){
  var rand = rng(4242);
  var start = monthStart(today, MONTHS_BACK);
  var log = [], n = 0;
  var months = [];
  for(var mi = MONTHS_BACK; mi >= 0; mi--) months.push(monthStart(today, mi).slice(0, 7));
  function add(date, amount, what, account, target){
    if(date >= start && date < today && amount > 0) log.push({ id: "demo-in" + (++n), date: date, amount: r2(amount), what: what, account: account, target: target });
  }
  (targets || []).forEach(function(t, k){
    var kind = t.key.slice(0, t.key.indexOf(":"));
    months.forEach(function(ym){
      if(kind === "net") add(dayIn(ym, 15 + k), t.monthly + (rand() - 0.5) * 6, "Pay — " + t.key.slice(4), "Everyday Account", t.key);
      else if(kind === "rent") add(dayIn(ym, 8), t.monthly, "Rent from Example Realty", "Offset", t.key);
      else if(kind === "oneoff" && ym.slice(5, 7) === "09") add(dayIn(ym, 20), t.yearly, "Bonus", "Everyday Account", t.key);
    });
  });
  log.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  st.incomeLog = log;
  return log;
}
