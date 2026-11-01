import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MIGRATION_STEPS, migrateState } from "../src/state.js";
import { demoHousehold } from "../src/calc/demo.js";

// v3.203.2 (item 235a): each migration step, from the shape before it. Invented data throughout.
const step = n => MIGRATION_STEPS[n - 1];
const run = (n, s) => { step(n).run(s); return s; };
const clone = o => JSON.parse(JSON.stringify(o));

test("the steps are numbered 1, 2, 3… in order, each named, and each has a test here", function(){
  MIGRATION_STEPS.forEach(function(st, i){ assert.equal(st.n, i + 1); assert.ok(st.name && typeof st.run === "function"); });
  const src = fs.readFileSync(new URL(import.meta.url), "utf8");
  MIGRATION_STEPS.forEach(function(st){ assert.ok(src.indexOf('test("step ' + st.n + ':') !== -1, "no test for step " + st.n); });
});

test("running every step twice changes nothing the second time", function(){
  [{}, demoHousehold("2026-10-15"), { income: [{ what: "Pay", amount: 1 }], properties: [{ what: "1 Example St", acquisitionCosts: 500 }] }].forEach(function(input){
    const once = migrateState(clone(input));
    const twice = migrateState(clone(once));
    assert.deepEqual(twice, once);
  });
});

test("step 1: income rows get a super mode from the old flag, and an id", function(){
  const s = run(1, { income: [{ what: "Pay A", superIncluded: true }, { what: "Pay B" }, { what: "Net", syntheticNetFor: "x" }] });
  assert.equal(s.income[0].superMode, "Included");
  assert.equal(s.income[1].superMode, "On top");
  assert.ok(s.income[0].id && s.income[1].id);
  assert.equal(s.income[2].id, undefined, "a synthetic row is found another way");
});

test("step 2: scenarios come from the home blocks; the baseline goes first; home rows get ids", function(){
  const s = run(2, { home: { "Buy": [{ what: "Loan" }, { what: "Rates" }], "Rent": [] }, activeScenario: "Rent" });
  assert.deepEqual(s.scenarios, ["Rent", "Buy"]);
  assert.equal(s.baselineScenario, "Rent");
  assert.equal(s.home.Buy[0].id, "homeLoanRow");
  assert.ok(s.home.Buy[1].id);
  const empty = run(2, {});
  assert.deepEqual(empty.scenarios, ["Renting"]);
  assert.ok(Array.isArray(empty.home.Renting));
});

test("step 3: each scenario gets purchase settings, with older ones filled in", function(){
  const s = run(3, { scenarios: ["A", "B"], purchase: { A: { rate: 6.1 } } });
  assert.equal(s.purchase.A.repaymentType, "PI");
  assert.equal(s.purchase.A.ioRate, 6.1);
  assert.equal(s.purchase.A.lmiCapitalized, false);
  assert.equal(s.purchase.B.enabled, false);
});

test("step 4: each scenario gets invest settings; investing turns buying off", function(){
  const s = run(4, { scenarios: ["A"], purchase: { A: { enabled: true } }, invest: { A: { enabled: true, assetType: "nonsense" } } });
  assert.equal(s.invest.A.contributionMode, "auto");
  assert.ok(s.invest.A.assetType && s.invest.A.assetType !== "nonsense");
  assert.equal(s.purchase.A.enabled, false);
});

test("step 5: debts, saved reports and life events become tidy lists", function(){
  const s = run(5, { debts: [{ what: "Card" }], savedReports: [{ key: "cashflow" }, {}], lifeEvents: [{ kind: "baby" }, { what: "no kind" }] });
  assert.equal(s.debts[0].balance, 0);
  assert.equal(s.savedReports.length, 1);
  assert.equal(s.lifeEvents.length, 1);
  assert.ok(s.lifeEvents[0].id);
});

test("step 6: budget lines get ids and timing, and the lists and maps exist", function(){
  const s = run(6, { shared: [{ what: "Groceries", amount: 300, freq: "Monthly" }], taxYears: [], budgetGroupsCollapsed: "x" });
  assert.ok(s.shared[0].id);
  assert.equal(s.shared[0].deductible, false);
  assert.deepEqual(s.transactions, []);
  assert.deepEqual(s.taxYears, {});
  assert.deepEqual(s.budgetGroupsCollapsed, {});
});

test("step 7: empty transfers and rules that can't fire go; automatic payments get ids and answers", function(){
  const s = run(7, { transfers: [{ date: "2026-01-02", amount: 50 }, { date: "2026-01-03", amount: 0 }], importRules: [{ match: "fern", category: "Eating out" }, { match: "", category: "x" }, { match: "z" }],
    autoPayments: [{ from: "A", to: "B" }, null], dependants: "2.7" });
  assert.equal(s.transfers.length, 1);
  assert.ok(s.transfers[0].id);
  assert.equal(s.importRules.length, 1);
  assert.equal(s.autoPayments.length, 1);
  assert.deepEqual(s.autoPayments[0].answers, {});
  assert.equal(s.dependants, 2);
});

test("step 8: budget preferences default to grouped by type, the financial year", function(){
  const s = run(8, { budgetGroupBy: "colour", yearBasis: "weird", setupDismissed: "yes" });
  assert.equal(s.budgetGroupBy, "type");
  assert.equal(s.yearBasis, "financial");
  assert.equal(s.setupDismissed, false);
  assert.deepEqual(s.rollover, {});
  assert.equal(run(8, { yearBasis: "calendar" }).yearBasis, "calendar");
});

test("step 9: categories seed the defaults, drop blanks, and take in every name a line uses", function(){
  const s = run(9, { shared: [{ what: "Fern Café", category: "Coffee" }, { what: "x", category: 3 }], home: {}, properties: [] });
  assert.ok(s.categories.length > 1);
  assert.ok(s.categories.indexOf("Coffee") !== -1);
  assert.equal(s.shared[1].category, "");
  const kept = run(9, { categories: ["Mine", "", 4], shared: [], home: {}, properties: [] });
  assert.deepEqual(kept.categories, ["Mine"]);
});

test("step 10: accounts get ids, and every account name a row uses is registered", function(){
  const s = run(10, { accounts: [{ name: "Bank One Everyday", type: "everyday" }], income: [{ account: "Bank One Everyday" }], shared: [{ account: "Card A" }], properties: [] });
  assert.ok(s.accounts[0].id);
  assert.equal(s.accounts[0].statementStartDay, 1);
  assert.deepEqual(s.accounts.map(a => a.name), ["Bank One Everyday", "Card A"]);
});

test("step 11: ages unknown until told, preservation age 60, an empty net worth log", function(){
  const s = run(11, {});
  assert.deepEqual(s.fire, { currentAge: null, retireAge: null, preservationAge: 60 });
  assert.equal(s.projectionReference, null);
  assert.deepEqual(s.netWorthLog, []);
});

test("step 12: share holdings are normalised; other assets left alone", function(){
  const s = run(12, { assets: [{ category: "Shares", what: "Fund A", amount: 1000 }, { category: "Cash", what: "Savings", amount: 5 }] });
  assert.equal(s.assets[1].amount, 5);
  assert.ok(s.assets[0] && typeof s.assets[0] === "object");
});

test("step 13: projection settings filled in; income growth follows inflation", function(){
  const s = run(13, { projection: { horizonYears: 30, inflationRate: 2.5 } });
  assert.equal(s.projection.incomeGrowthRate, 2.5);
  assert.equal(s.projection.rateShockPct, 0);
  assert.equal(s.projection.realTerms, true);
  assert.equal(s.projection.investVolatility, 12);
  assert.equal(run(13, {}).projection.horizonYears, 20);
});

test("step 14: tax settings never assume cover or family thresholds", function(){
  const s = run(14, { tax: {} });
  assert.equal(s.tax.privateHospitalCover, false);
  assert.equal(s.tax.familyThresholds, false);
  assert.equal(s.tax.sgRate, 11.5);
  assert.deepEqual(s.tax.settings, {});
});

test("step 15: the rest of the settings, notes and logs exist; receipt files are never kept", function(){
  const s = run(15, { receiptFiles: { a: 1 }, trips: [{ from: "2026-01-01" }, {}], savingsGoals: [{ name: "Trip", target: -5 }, 3], projection: {} });
  assert.equal(s.receiptFiles, undefined);
  assert.equal(s.trips.length, 1);
  assert.equal(s.savingsGoals.length, 1);
  assert.equal(s.savingsGoals[0].target, 0);
  assert.ok(s.savingsGoals[0].id);
  assert.equal(s.benchmark.symbol, "IOZ");
  assert.equal(s.autoPrices.on, true);
  assert.equal(s.projection.source, "plan");
  assert.deepEqual(s.incomeLog, []);
});

test("step 16: income rows get salary sacrifice and pay-day fields, unset", function(){
  const s = run(16, { income: [{ what: "Pay", amount: 1 }] });
  assert.equal(s.income[0].sacrificeMode, "none");
  assert.equal(s.income[0].payDay, null);
  assert.equal(s.income[0].payAnchor, "");
});

test("step 17: properties get every list and setting; a lump-sum cost becomes a row", function(){
  const s = run(17, { properties: [{ what: "1 Example St", kind: "Unit", acquisitionCosts: 12000, loans: [{ balance: 300000 }], expenses: [{ what: "Rates" }] }] });
  const p = s.properties[0];
  assert.equal(p.kind, "IP");
  assert.equal(p.acquisitionCosts.length, 1);
  assert.equal(p.acquisitionCosts[0].amount, 12000);
  assert.equal(p.loans[0].repaymentType, "PI");
  assert.equal(p.loans[0].termYears, 30);
  assert.ok(p.expenses[0].id);
  assert.equal(p.sectionsCollapsed.loans, true);
  assert.deepEqual(p.ownership, {});
  assert.deepEqual(run(17, { properties: [{ acquisitionCosts: 0 }] }).properties[0].acquisitionCosts, []);
});

test("step 18: once, the old portfolio-wide ownership goes onto each investment property", function(){
  const s = run(18, { tax: { ipOwnership: { Alex: 60, Sam: 40 } }, properties: [{ kind: "IP", ownership: {} }, { kind: "PPOR", ownership: {} }, { kind: "IP", ownership: { Sam: 100 } }] });
  assert.deepEqual(s.properties[0].ownership, { Alex: 60, Sam: 40 });
  assert.deepEqual(s.properties[1].ownership, {});
  assert.deepEqual(s.properties[2].ownership, { Sam: 100 });
  assert.equal(s.tax.ipOwnership, undefined);
  assert.equal(s.ipOwnershipPerProperty, true);
});

test("step 19: once, investment-property costs without a category get the investment property one", function(){
  const s = run(19, { categories: ["Food"], properties: [{ kind: "IP", expenses: [{ what: "Rates", category: "" }, { what: "Strata", category: "Mine" }] }] });
  assert.ok(s.properties[0].expenses[0].category);
  assert.equal(s.properties[0].expenses[1].category, "Mine");
  assert.equal(s.categories.length, 2);
  assert.equal(s.ipCategorySeeded, true);
  s.properties[0].expenses[0].category = "";
  run(19, s);
  assert.equal(s.properties[0].expenses[0].category, "", "cleared by hand, it stays cleared");
});

test("step 20: once, the old single investment property becomes a property with its rent and costs", function(){
  const s = run(20, { income: [{ id: "rentIncome", what: "Unit - Rent", amount: 500, freq: "Weekly", account: "Bank One" }],
    ip: [{ id: "pmFee6", what: "PM fee" }, { what: "Strata" }], properties: [], pmFee: { percent: 7 } });
  assert.equal(s.properties.length, 1);
  assert.equal(s.properties[0].what, "Unit");
  assert.equal(s.properties[0].income[0].amount, 500);
  assert.deepEqual(s.properties[0].expenses.map(e => e.what), ["Strata", "PM fee"]);
  assert.equal(s.properties[0].pmFee.percent, 7);
  assert.deepEqual(s.income, []);
  assert.equal(s.propertiesMigratedFromIp, true);
});

test("step 21: once, property assets become properties", function(){
  // It says so in a toast — a page this test doesn't have, so a stand-in for the few calls it makes.
  const el = () => ({ appendChild(){}, classList: { add(){}, remove(){} }, remove(){} });
  const keep = [globalThis.document, globalThis.requestAnimationFrame];
  globalThis.document = { getElementById: el, createElement: el }; globalThis.requestAnimationFrame = function(){};
  let s;
  try { s = run(21, { assets: [{ category: "Property", what: "Unit", amount: 400000 }, { category: "Cash", amount: 5 }], properties: [] }); }
  finally { globalThis.document = keep[0]; globalThis.requestAnimationFrame = keep[1]; }
  assert.equal(s.properties.length, 1);
  assert.equal(s.properties[0].value, 400000);
  assert.equal(s.assets.length, 1);
  assert.equal(s.assetPropertiesMigrated, true);
});

test("step 22: scenarios as sealed sandboxes — a map of changes, an old per-row amount moved in", function(){
  const s = run(22, { scenarios: ["Today", "Bigger"], baselineScenario: "Today", home: { Today: [], Bigger: [] }, purchase: {}, invest: {},
    shared: [{ id: "g", what: "Groceries", amount: 800, freq: "Monthly", scenarioOverrides: { Bigger: 950 } }], income: [], properties: [] });
  assert.ok(s.scenarioChanges && typeof s.scenarioChanges === "object");
  assert.ok(!s.shared[0].scenarioOverrides, "nothing per scenario left on the row");
  assert.ok((s.scenarioChanges.Bigger || []).some(c => c.kind === "amount" && c.rowId === "g" && c.amount === 950));
});

test("step 23: every account link gets the account's id; goals, saved views and statements follow", function(){
  const s = run(23, {
    accounts: [{ id: "a1", name: "Bank One Everyday", type: "everyday" }, { id: "a2", name: "Card A", type: "credit", autoPayFrom: "Bank One Everyday" }],
    shared: [{ what: "Groceries", account: "Card A" }, { what: "Gym", account: "Gone Bank" }], income: [], transactions: [{ account: "Bank One Everyday" }],
    transfers: [{ from: "Bank One Everyday", to: "Card A", amount: 5, date: "2026-01-01" }], autoPayments: [], importRules: [{ match: "fern", account: "Card A", transferAccount: "" }],
    savingsGoals: [{ name: "Trip", accounts: ["Bank One Everyday", "Gone Bank"] }], txViews: [{ name: "v", filter: { account: "Card A" } }],
    monthReviews: { "2026-10": { statements: { "Card A": 812.5 } } }, home: {}, properties: [] });
  assert.equal(s.shared[0].accountId, "a2");
  assert.equal(s.shared[1].accountId, undefined, "no account of that name: the name stays, unlinked");
  assert.equal(s.shared[1].account, "Gone Bank");
  assert.equal(s.transactions[0].accountId, "a1");
  assert.deepEqual([s.transfers[0].fromId, s.transfers[0].toId], ["a1", "a2"]);
  assert.equal(s.accounts[1].autoPayFromId, "a1");
  assert.equal(s.importRules[0].accountId, "a2");
  assert.deepEqual(s.savingsGoals[0].accountIds, ["a1"]);
  assert.equal(s.txViews[0].filter.accountId, "a2");
  assert.deepEqual(s.monthReviews["2026-10"].statementsById, { a2: 812.5 });
  // Linked, a row's kept name follows the account.
  s.accounts[1].name = "Card B";
  run(23, s);
  assert.equal(s.shared[0].account, "Card B");
});
