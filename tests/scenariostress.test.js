import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig, defaultInvestConfig } from "../src/state.js";
import { scenarioTotals, computeNetWorthSeries, recalcComputedItems } from "../src/calc/engine.js";
import { calcRepaymentMonthly, recalcPurchase } from "../src/calc/property.js";
import { rateStress, breakEvenGrowth, breakEvenGrowthCached } from "../src/calc/scenariostress.js";
import { scenarioSturdinessHtml, breakEvenText } from "../src/components/dashboard.js";

// Items 252, 253. Invented household: a rental with a loan, renting where it lives, a scenario that buys.
function withHousehold(fn){
  var keys = ["properties", "assets", "purchase", "scenarios", "home", "invest", "income", "shared", "baselineScenario", "activeScenario", "scenarioChanges", "debts", "projection"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Buy"];
    state.baselineScenario = "Renting"; state.activeScenario = "Renting";
    state.scenarioChanges = {}; state.debts = [];
    state.assets = [{ category: "Cash", what: "Savings", amount: 250000 }];
    state.home = { Renting: [], Buy: [] };
    state.invest = { Renting: defaultInvestConfig(), Buy: defaultInvestConfig() };
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "VIC", false), Buy: Object.assign(defaultPurchaseConfig(800000, 20, 6, 30, "VIC", true), { otherCosts: [] }) };
    state.income = [{ id: "i1", what: "Alex — pay", incomeType: "Net", amount: 14000, freq: "Monthly" }];
    state.shared = [{ id: "s1", what: "Rent", amount: 2600, freq: "Monthly", homeCost: true }, { id: "s2", what: "Groceries", amount: 1200, freq: "Monthly" }];
    state.properties = [{ id: "ip", what: "1 Example St", kind: "IP", value: 600000, purchaseDate: "2022-03-01", ownership: {}, pmFee: { percent: 0, flat: 0 }, income: [], expenses: [],
      loans: [{ id: "a", what: "Loan A", balance: 400000, offsetBalance: 0, rate: 6, termYears: 25, repaymentType: "PI", settlementDate: "2022-03-01" }] }];
    state.projection = Object.assign({}, keep.projection, { investReturnRate: 6, propertyAppreciationRate: 4, inflationRate: 0, incomeGrowthRate: 0, rateShockPct: 0, realTerms: true, source: "plan" });
    recalcComputedItems();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}

test("a normal month if rates rise: every variable loan's repayment, the purchase's too", () => {
  withHousehold(() => {
    const ip = calcRepaymentMonthly(400000, 7, 25, "PI") - calcRepaymentMonthly(400000, 6, 25, "PI");
    const base = rateStress("Renting", 1);
    assert.equal(base.extraMonthly, Math.round(ip));
    assert.equal(base.regularNetMonthly, Math.round(scenarioTotals("Renting").regularNetMonthly - ip));
    const loan = recalcPurchase("Buy").loanBalance;
    const home = calcRepaymentMonthly(loan, 7, 30, "PI") - calcRepaymentMonthly(loan, 6, 30, "PI");
    assert.equal(rateStress("Buy", 1).extraMonthly, Math.round(ip + home), "cash came from savings, so no offset in it");
    assert.ok(rateStress("Buy", 0.5).extraMonthly < rateStress("Buy", 1).extraMonthly);
  });
});


test("rate stress: P&I offset withdrawal does not increase the repayment shock", () => {
  withHousehold(() => {
    const loan = state.properties[0].loans[0];
    loan.offsetBalance = 100000;
    const expected = calcRepaymentMonthly(400000, 7, 25, "PI") - calcRepaymentMonthly(400000, 6, 25, "PI");
    const regular = scenarioTotals("Renting").regularNetMonthly;
    for(const take of [0, 50000, 100000]){
      const t = { regularNetMonthly: regular, draw: { draws: [{ take, interestOnly: false }] } };
      assert.equal(rateStress("Renting", 1, t).extraMonthly, Math.round(expected), "P&I shock must not double count withdrawn offset");
    }
    assert.equal(rateStress("Renting", 0, { regularNetMonthly: regular, draw: { draws: [{ take: 50000, interestOnly: false }] } }).extraMonthly, 0);
  });
});

test("rate stress: IO partial and full offset withdrawals add exactly the drawn interest", () => {
  withHousehold(() => {
    const loan = state.properties[0].loans[0];
    loan.repaymentType = "IO";
    loan.offsetBalance = 100000;
    const regular = scenarioTotals("Renting").regularNetMonthly;
    for(const take of [0, 25000, 100000]){
      const t = { regularNetMonthly: regular, draw: { draws: [{ take, interestOnly: true }] } };
      const expected = (400000 - 100000 + take) / 1200;
      assert.equal(rateStress("Renting", 1, t).extraMonthly, Math.round(expected));
      assert.equal(rateStress("Renting", 0, t).extraMonthly, 0, "withdrawal alone must not create a rate-rise delta");
    }
    loan.offsetBalance = 400000;
    const fullyOffset = { regularNetMonthly: regular, draw: { draws: [{ take: 100000, interestOnly: true }] } };
    assert.equal(rateStress("Renting", 1, fullyOffset).extraMonthly, Math.round(100000 / 1200));
  });
});

test("rate stress: multiple loans count IO draw once and never add P&I draw", () => {
  withHousehold(() => {
    const loans = state.properties[0].loans;
    loans[0].offsetBalance = 50000;
    loans.push({ id: "b", what: "Loan B", balance: 120000, offsetBalance: 80000, rate: 6, termYears: 20, repaymentType: "IO" });
    const regular = scenarioTotals("Renting").regularNetMonthly;
    const piRise = calcRepaymentMonthly(400000, 7, 25, "PI") - calcRepaymentMonthly(400000, 6, 25, "PI");
    const ioRise = (120000 - 80000 + 30000) / 1200;
    const t = { regularNetMonthly: regular, draw: { draws: [
      { take: 40000, interestOnly: false }, { take: 30000, interestOnly: true }
    ] } };
    assert.equal(rateStress("Renting", 1, t).extraMonthly, Math.round(piRise + ioRise));
    assert.equal(rateStress("Renting", 0, t).extraMonthly, 0);
  });
});

test("break-even growth: at that rate the purchase ends ten years on level with the household", () => {
  withHousehold(() => {
    const be = breakEvenGrowth("Buy", 10);
    assert.ok(be && be.pct != null && be.against === "Renting");
    const target = computeNetWorthSeries("Renting", 10)[10].y;
    const at = g => computeNetWorthSeries("Buy", 10, { homeGrowthPct: g })[10].y;
    assert.ok(at(be.pct + 0.2) > target && at(be.pct - 0.2) < target, "the answer sits where the two cross");
    assert.equal(breakEvenGrowth("Renting", 10), null, "the household itself has nothing to break even with");
    assert.equal(breakEvenGrowthCached("Buy", 10, "k"), breakEvenGrowthCached("Buy", 10, "k"));
    assert.equal(breakEvenText({ pct: 4.3 }), "4.3%/yr");
    assert.equal(breakEvenText({ below: -5 }), "even if they fall");
  });
});

test("on the card: both rate steps, and a place for the break-even", () => {
  withHousehold(() => {
    const html = scenarioSturdinessHtml("Buy", scenarioTotals("Buy"));
    assert.match(html, /If rates rise 0\.5% · 1%/);
    assert.match(html, /data-card-breakeven="Buy"/);
    assert.match(html, /Matches Renting in 10 yrs if prices grow/);
    assert.doesNotMatch(scenarioSturdinessHtml("Renting", scenarioTotals("Renting")), /data-card-breakeven/);
  });
});

test("dashboard risk signals flag negative cash flow and inadequate essential reserves", async () => {
  const { dashboardRiskSignals, dashboardRiskSignalsHtml } = await import("../src/components/dashboard.js");
  const emergency = { monthly: 3000, available: 2000, target: 18000, months: 6, unclassified: ["Groceries"] };
  const warnings = dashboardRiskSignals({ regularNetMonthly: -200 }, emergency, false);
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /negative/);
  assert.match(warnings[1], /6-month target/);
  assert.match(warnings[2], /classification/);
  assert.match(dashboardRiskSignalsHtml(warnings), /aria-label="Financial decision risks"/);
  assert.deepEqual(dashboardRiskSignals({ regularNetMonthly: 500 }, { ...emergency, available: 20000, unclassified: [] }, false), []);
  assert.match(dashboardRiskSignals({ netMonthly: 0 }, { ...emergency, monthly: 0 }, true)[0], /Add income/);
});

test("scenario trade-off comparison uses shared calculation totals and baseline differences", async () => {
  const { scenarioTradeoffRows, scenarioTradeoffHtml } = await import("../src/components/dashboard.js");
  const totals = {
    Rent: { regularNetMonthly: 1500, netMonthly: 2000, homeMonthly: 2500, expensesMonthly: 4000 },
    Buy: { regularNetMonthly: -300, netMonthly: 100, homeMonthly: 4300, expensesMonthly: 5800 }
  };
  const rows = scenarioTradeoffRows(["Rent", "Buy"], name => totals[name], "Rent");
  assert.equal(rows[0].monthlyDifference, 0);
  assert.equal(rows[1].monthly, -300);
  assert.equal(rows[1].monthlyDifference, -1800);
  assert.equal(rows[1].expenseDifference, 1800);
  const html = scenarioTradeoffHtml(rows, "Rent");
  assert.match(html, /<caption>Normal-month cash flow/);
  assert.match(html, /scope="row"/);
  assert.match(html, /−\$300/);
  assert.match(html, /Positive cost difference means more spending/);
  assert.equal(scenarioTradeoffHtml([rows[0]], "Rent"), "");
});

test("scenario comparison shows essential runway from reserve calculator and warns about liquidity limits", async () => {
  const { scenarioTradeoffRows, scenarioTradeoffHtml } = await import("../src/components/dashboard.js");
  const totals = {
    Current: { regularNetMonthly: 1000, homeMonthly: 1500, expensesMonthly: 3200 },
    Purchase: { regularNetMonthly: -500, homeMonthly: 3500, expensesMonthly: 5200 }
  };
  const reserves = {
    Current: { monthly: 2000, available: 12000, coveredMonths: 6, target: 12000, unclassified: [] },
    Purchase: { monthly: 4000, available: 12000, coveredMonths: 3, target: 24000, unclassified: ["Housing"] }
  };
  const rows = scenarioTradeoffRows(["Current", "Purchase"], name => totals[name], "Current", name => reserves[name]);
  assert.equal(rows[1].reserve.essentialMonthly, 4000);
  assert.equal(rows[1].reserve.coveredMonths, 3);
  assert.equal(rows[1].monthlyDifference, -1500);
  const html = scenarioTradeoffHtml(rows, "Current");
  assert.match(html, /Essential runway/);
  assert.match(html, /6 mo/);
  assert.match(html, /3 mo/);
  assert.match(html, /check classifications/);
  assert.match(html, /not a forecast of cash left after a future purchase/);
  const missing = scenarioTradeoffRows(["Current", "Purchase"], name => totals[name], "Current",
    () => ({ monthly: 0, available: 0, coveredMonths: null, target: 0, unclassified: [] }));
  assert.match(scenarioTradeoffHtml(missing, "Current"), /Essential runway<\/th>/);
  assert.match(scenarioTradeoffHtml(missing, "Current"), /<td>—<\/td>/);
});

test("scenario comparison distinguishes upfront commitments from cash funding gaps", async () => {
  const { scenarioTradeoffRows, scenarioTradeoffHtml } = await import("../src/components/dashboard.js");
  const totals = {
    Stay: { regularNetMonthly: 800, homeMonthly: 2000, expensesMonthly: 3000, cashOut: 0, draw: null },
    Buy: { regularNetMonthly: -400, homeMonthly: 4000, expensesMonthly: 5200, cashOut: 90000, draw: { short: 25000 } },
    Invest: { regularNetMonthly: 300, homeMonthly: 2100, expensesMonthly: 3500, cashOut: 15000, draw: { short: 0 } }
  };
  const rows = scenarioTradeoffRows(["Stay", "Buy", "Invest"], name => totals[name], "Stay");
  assert.equal(rows[0].upfrontCash, 0);
  assert.equal(rows[1].upfrontCash, 90000);
  assert.equal(rows[1].fundingShortfall, 25000);
  assert.equal(rows[2].fundingShortfall, 0);
  const html = scenarioTradeoffHtml(rows, "Stay");
  assert.match(html, /Upfront cash/);
  assert.match(html, /Funding gap/);
  assert.match(html, /25,000 short/);
  assert.match(html, /cash sources cannot fully cover/);
  assert.match(html, /not a forecast of cash left/);
});

test("scenario funding table has a header for every value and preserves column order", async () => {
  const { scenarioTradeoffRows, scenarioTradeoffHtml } = await import("../src/components/dashboard.js");
  const totals = {
    Stay: { regularNetMonthly: 1000, homeMonthly: 1000, expensesMonthly: 2000, cashOut: 0 },
    Buy: { regularNetMonthly: -100, homeMonthly: 3200, expensesMonthly: 4000, cashOut: 60000, draw: { short: 10000 } }
  };
  const reserves = {
    Stay: { monthly: 1200, available: 12000, coveredMonths: 10, unclassified: [] },
    Buy: { monthly: 2800, available: 12000, coveredMonths: 12 / 2.8, unclassified: [] }
  };
  const rows = scenarioTradeoffRows(["Stay", "Buy"], name => totals[name], "Stay", name => reserves[name]);
  const html = scenarioTradeoffHtml(rows, "Stay");
  const headers = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m => m[1]);
  assert.deepEqual(headers, ["Scenario", "Net / mo", "Difference / mo", "Home / mo",
    "Costs difference / mo", "Upfront cash", "Funding gap", "Essential / mo", "Cash + offsets", "Essential runway"]);
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  const cells = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  assert.equal(cells.length, 2);
  cells.forEach(m => assert.equal((m[1].match(/<(?:td|th)\b/g) || []).length, headers.length));
  assert.match(cells[1][1], /10,000 short/);
});
