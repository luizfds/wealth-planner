import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { recalcComputedItems } from "../src/calc/engine.js";
import { personTakeHomeParts, monthlyPayNow, computePersonTax, incomeTaxAU, medicareLevyAU, currentTaxFy } from "../src/calc/tax.js";
import { payslipCheck } from "../src/calc/payslipcheck.js";
import { takeHomeDrift } from "../src/calc/takehome.js";
import { incomeTargets } from "../src/calc/received.js";

// v3.148.0: a payslip against the plan, and pay that ends this year. An invented household.
var SALARY = { id: "s1", what: "Salary", person: "Sam", incomeType: "Gross", amount: 6000, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 };
var ALLOWANCE = { id: "a1", what: "Site allowance", person: "Sam", incomeType: "Gross", amount: 400, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0, endDate: "2026-12-31" };
var PHONE = { id: "p1", what: "Phone reimbursement", person: "Sam", incomeType: "Net", amount: 25, freq: "Monthly" };
function withPlan(rows, fn){
  var keep = { income: state.income, incomeLog: state.incomeLog, properties: state.properties, tax: state.tax };
  try {
    state.income = rows.map(function(r){ return Object.assign({}, r); });
    state.incomeLog = []; state.properties = [];
    state.tax = Object.assign({}, state.tax, { settings: { Sam: { dateOfBirth: "1990-01-01" } } });
    recalcComputedItems();
    fn();
  } finally { Object.assign(state, keep); recalcComputedItems(); }
}
var TODAY = new Date().toISOString().slice(0, 10);

test("the monthly take-home is what withholding gives; pay that ends comes off from the day after; the year adds up", function(){
  if(TODAY > "2026-12-31") return; // the fixture's allowance has ended
  withPlan([SALARY, ALLOWANCE], function(){
    var parts = personTakeHomeParts("Sam");
    var fy = currentTaxFy(), annual = (6000 + 400) * 12;
    var withheld = annual - incomeTaxAU(annual, fy) - medicareLevyAU(annual, fy);
    assert.ok(Math.abs(parts.regularMonthly * 12 - withheld) < 1, "as a payslip pays it: the allowance in, taxed as if every pay were this one");
    assert.equal(parts.ending.length, 1);
    var e = parts.ending[0];
    assert.ok(e.monthly > 0 && e.monthly < 400 && e.share > 0 && e.share < 1);
    var total = computePersonTax("Sam").netTakeHome;
    var settle = parts.refund ? parts.refund.amount : 0;
    assert.ok(Math.abs(parts.regularMonthly * 12 - e.monthly * 12 * (1 - e.share) + settle - total) < 1, "pay received plus what settles at lodgement is the year");
    var row = state.income.find(function(i){ return i.syntheticEndingFor === "a1"; });
    assert.ok(row && row.startDate === "2027-01-01" && row.amount === -e.monthly && row.computed && row.incomeType === "Net");
    assert.equal(monthlyPayNow(parts, "2027-01-15"), Math.round((parts.regularMonthly - e.monthly) * 100) / 100, "lower once it's stopped");
    var t = incomeTargets().find(function(x){ return x.key === "net:Sam"; });
    assert.ok(Math.abs(t.monthly - monthlyPayNow(parts, TODAY)) < 0.01, "take-home received is expected at today's pay");
  });
});

test("a payslip that matches the plan says so, naming what's paid after tax", function(){
  withPlan([SALARY, PHONE], function(){
    var net = monthlyPayNow(personTakeHomeParts("Sam"), TODAY);
    var c = payslipCheck("Sam", { periodStart: "2026-10-01", periodEnd: "2026-10-31", payDate: "2026-10-24", gross: 6000, tax: Math.round((6000 - net) * 100) / 100, net: Math.round((net + 25) * 100) / 100, super: 720, sacrifice: null, ytd: {} });
    assert.equal(c.freq, "Monthly");
    assert.equal(c.expected.gross, 6000);
    assert.equal(c.lines[0].tone, "ok");
    assert.ok(c.lines.some(function(l){ return /\$25\.00 paid on top after tax — Phone reimbursement/.test(l.text); }));
    assert.deepEqual(c.loggable, { amount: Math.round((net + 25) * 100) / 100, date: "2026-10-24" });
    state.incomeLog.push({ id: "l1", target: "net:Sam", date: "2026-10-24", amount: 1 });
    assert.equal(payslipCheck("Sam", { periodStart: "2026-10-01", periodEnd: "2026-10-31", payDate: "2026-10-24", gross: 6000, tax: 1300, net: 4700, ytd: {} }).loggable, null, "already logged");
  });
});

test("a payslip with more gross says by how much", function(){
  withPlan([SALARY], function(){
    var c = payslipCheck("Sam", { periodStart: "2026-10-01", periodEnd: "2026-10-31", payDate: "2026-10-24", gross: 6600, tax: 1500, net: 5100, ytd: {} });
    assert.ok(c.lines.some(function(l){ return l.tone === "warn" && /\$600\.00 more than the plan's \$6,000\.00/.test(l.text); }));
  });
});

test("the take-home check expects what a payslip pays, not the year's take-home", function(){
  withPlan([SALARY], function(){
    var plan = monthlyPayNow(personTakeHomeParts("Sam"), TODAY);
    var d = new Date(); var months = [1, 2, 3].map(function(i){ var x = new Date(d.getFullYear(), d.getMonth() - i, 15); return x.toISOString().slice(0, 10); });
    state.incomeLog = months.map(function(m, i){ return { id: "r" + i, target: "net:Sam", date: m, amount: Math.round((plan - 400) * 100) / 100 }; });
    var drift = takeHomeDrift("Sam", TODAY);
    assert.ok(drift && Math.abs(drift.plan - plan) < 0.01);
  });
});

test("a heads-up from 45 days before pay ends, and the forecast drops it after", async function(){
  if(TODAY > "2026-12-31") return;
  const { endingPayNotifications } = await import("../src/lib/notifications.js");
  const { scenarioIncomeRows } = await import("../src/calc/tax.js");
  withPlan([SALARY, ALLOWANCE], function(){
    assert.equal(endingPayNotifications("2026-10-01").length, 0, "too early");
    var n = endingPayNotifications("2026-12-01");
    assert.equal(n.length, 1);
    assert.match(n[0].title, /Site allowance ends/);
    var ahead = scenarioIncomeRows({ scenario: state.activeScenario, withFuture: true }).find(function(r){ return r.syntheticEndingFor === "a1"; });
    assert.ok(ahead && ahead.startDate === "2027-01-01" && ahead.amount < 0, "the forecast sees it coming");
    assert.equal(scenarioIncomeRows({ scenario: state.activeScenario }).filter(function(r){ return r.syntheticEndingFor; }).length, 0, "today's totals don't take it off yet");
  });
});
