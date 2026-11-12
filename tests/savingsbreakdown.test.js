import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, defaultPurchaseConfig, defaultInvestConfig } from "../src/state.js";
import { savingsBreakdown, scenarioTotals, recalcComputedItems, scenarioBudgetComposition } from "../src/calc/engine.js";
import { loanRepaymentMonthly } from "../src/calc/property.js";

// Item 247: the Home card's net savings, as lines that add up to it. Invented household.
function withHousehold(fn){
  var keys = ["properties", "assets", "purchase", "scenarios", "home", "invest", "income", "shared", "baselineScenario", "activeScenario", "scenarioChanges", "debts"];
  var keep = {}; keys.forEach(function(k){ keep[k] = state[k]; });
  try {
    state.scenarios = ["Renting", "Elsewhere"];
    state.baselineScenario = "Renting"; state.activeScenario = "Renting";
    state.scenarioChanges = {};
    state.debts = [];
    state.assets = [];
    state.home = { Renting: [{ id: "h1", what: "Rent", amount: 600, freq: "Weekly" }], Elsewhere: [] };
    state.invest = { Renting: defaultInvestConfig(), Elsewhere: defaultInvestConfig() };
    state.purchase = { Renting: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false), Elsewhere: defaultPurchaseConfig(0, 20, 6, 30, "NSW", false) };
    state.income = [
      { id: "i1", what: "Alex — pay", incomeType: "Net", amount: 9000, freq: "Monthly" },
      { id: "i2", what: "Sam — yearly bonus", incomeType: "Net", amount: 6000, freq: "Yearly", irregular: true }
    ];
    state.shared = [{ id: "s1", what: "Groceries", amount: 250, freq: "Weekly" }, { id: "s2", what: "Phone", amount: 80, freq: "Monthly" }];
    state.properties = [{ id: "ip", what: "1 Example St", kind: "IP", purchaseDate: "2022-03-01", ownership: {}, pmFee: { percent: 0, flat: 0 },
      income: [{ id: "r1", what: "Rent", amount: 500, freq: "Weekly" }],
      expenses: [{ id: "e1", what: "Council rates", amount: 600, freq: "Quarterly" }],
      loans: [{ id: "a", what: "Loan A", balance: 400000, offsetBalance: 0, rate: 6, termYears: 25, repaymentType: "PI", settlementDate: "2022-03-01" }] }];
    recalcComputedItems();
    fn();
  } finally { keys.forEach(function(k){ state[k] = keep[k]; }); }
}
function sum(rows){ return rows.reduce(function(s, r){ return s + r.monthly; }, 0); }

test("the lines add up to the card: a normal month, then the yearly average", function(){
  withHousehold(function(){
    var t = scenarioTotals("Renting"), b = savingsBreakdown("Renting");
    var regularIn = sum(b.income.filter(function(r){ return !r.oneOff; }));
    var oneOffIn = sum(b.income.filter(function(r){ return r.oneOff; }));
    assert.ok(Math.abs(regularIn - sum(b.out) - t.regularNetMonthly) < 0.05, "a normal month is the card");
    assert.ok(Math.abs(regularIn + oneOffIn - sum(b.out) - t.netMonthly) < 0.05, "with the bonus spread in, the projection's figure");
    assert.equal(b.regular, t.regularNetMonthly);
    assert.equal(b.average, t.netMonthly);
    assert.ok(Math.abs(b.oneOffMonthly - 500) < 0.01);
  });
});

test("an investment property's loan repayments are their own line — the cost a Budget total used to leave out", function(){
  withHousehold(function(){
    var b = savingsBreakdown("Renting");
    var labels = b.out.map(function(r){ return r.label; });
    assert.deepEqual(labels, ["Everyday spending", "Where you live", "1 Example St — running costs", "1 Example St — loan repayments"]);
    var loans = b.out[3];
    assert.equal(loans.go, "property");
    assert.ok(Math.abs(loans.monthly - loanRepaymentMonthly(state.properties[0].loans[0])) < 0.01);
    assert.ok(Math.abs(b.out[2].monthly - 200) < 0.01, "rates, a quarter at a time, as a month");
    assert.ok(b.income.some(function(r){ return /Rent/.test(r.label) && r.go === "property"; }), "the property's rent is money in");
  });
});

test("a scenario that lives elsewhere still adds up: its own changes are a line", function(){
  withHousehold(function(){
    state.scenarioChanges = { Elsewhere: [{ id: "c1", kind: "rent", amount: 700, freq: "Weekly" }] };
    var t = scenarioTotals("Elsewhere"), b = savingsBreakdown("Elsewhere");
    var regularIn = sum(b.income.filter(function(r){ return !r.oneOff; }));
    assert.ok(Math.abs(regularIn - sum(b.out) - t.regularNetMonthly) < 0.05);
    var ch = b.out.find(function(r){ return r.label === "This scenario's changes"; });
    assert.ok(ch && Math.abs(ch.monthly - 700 * 52 / 12) < 0.05, "the rent there, as its own line");
  });
});


test("Needs/Wants includes loans once and reconciles both scenarios to their regular month",function(){
  withHousehold(function(){
    state.shared[0].classification="Needs";state.shared[1].classification="Wants";
    state.home.Elsewhere=[{id:"homeLoanRow",what:"New mortgage",amount:3000,freq:"Monthly",classification:"Needs"}];
    state.scenarioChanges.Elsewhere=[{id:"move",kind:"home"}];
    const a=scenarioBudgetComposition("Renting"), b=scenarioBudgetComposition("Elsewhere");
    for(const [name,c] of [["Renting",a],["Elsewhere",b]]){
      const t=scenarioTotals(name);
      assert.ok(Math.abs(c.needs+c.wants+c.other-t.expensesMonthly)<0.02);
      assert.ok(Math.abs(c.income-c.expenses-c.buffer)<0.02);
      assert.ok(Math.abs(c.buffer-t.regularNetMonthly)<0.01);
      assert.equal(c.wants,80);
    }
    assert.ok(Math.abs(b.needs-a.needs-(3000-600*52/12))<0.02,"new mortgage replaces rent, not added twice");
    state.shared[1].scenarioOverrides={Elsewhere:100};
    assert.equal(scenarioBudgetComposition("Elsewhere").wants,100);
  });
});
test("a scenario deficit and unclassified allocations remain visible",function(){
  withHousehold(function(){
    state.shared.push({id:"large",what:"Sample allocation",amount:20000,freq:"Monthly",classification:"Savings"});
    const c=scenarioBudgetComposition("Renting");
    assert.ok(c.other>=20000);assert.ok(c.buffer<0);
    assert.ok(Math.abs(c.needs+c.wants+c.other+c.buffer-c.income)<0.02);
  });
});

test("a purchase's computed repayment replaces today's rent in Needs",function(){
  withHousehold(function(){
    state.shared.push({id:"rent",what:"Current rent",homeCost:true,classification:"Needs",amount:2000,freq:"Monthly"});
    state.home.Renting=[];
    state.purchase.Elsewhere=defaultPurchaseConfig(800000,20,6,30,"NSW",true);
    state.purchase.Elsewhere.enabled=true;
    state.scenarioChanges.Elsewhere=[{id:"move",kind:"home"}];
    state.home.Elsewhere=[{id:"homeLoanRow",what:"Home loan",amount:0,freq:"Monthly",classification:"Needs"}];
    recalcComputedItems();
    const c=scenarioBudgetComposition("Elsewhere"), t=scenarioTotals("Elsewhere");
    assert.ok(state.home.Elsewhere[0].amount>0,"purchase repayment computed");
    assert.ok(Math.abs(c.needs+c.wants+c.other-t.expensesMonthly)<0.02);
    assert.ok(c.needs>=state.home.Elsewhere[0].amount,"mortgage is included as Needs");
    assert.ok(Math.abs(c.income-c.expenses-c.buffer)<0.02);
  });
});
