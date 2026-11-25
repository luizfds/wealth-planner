// #454: cash month by month through a settlement (calc/liquidity.js). Invented figures only.
import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { liquidityForecast } from "../src/calc/liquidity.js";
import { calcRepaymentMonthly } from "../src/calc/property.js";

const months = (net, n) => Array.from({ length: n || 12 }, (_, i) => ({ year: 2026 + Math.floor((10 + i) / 12), month: (10 + i) % 12 + 1, net: net, items: [] }));
const purchase = { id: "b1", what: "3 Example Ave", price: 640000, deposit: 64000, loanAmount: 576000, rate: 6, settlementDate: "2027-02-12",
  costs: [{ id: "a", what: "Transfer registration", amount: 2000, kind: "purchase" }, { id: "b", what: "Conveyancer", amount: 1500, kind: "purchase", paid: true }] };

test("the balance carried month by month; settlement lands once, in its month; repayments start the month after", function(){
  const f = liquidityForecast({ months: months(1000), startCash: 20000, purchases: [purchase], loans: [], stressPct: 0, reserveTarget: 10000, today: "2026-11-20" });
  assert.equal(f.months.length, 12);
  assert.deepEqual([f.months[0].year, f.months[0].month], [2026, 11]);
  // Nov, Dec, Jan: +1000 each. Feb: +1000 − (640,000 − 64,000 − 576,000 + 2,000 still to pay) = −1000. The paid cost and
  // the deposit (paid already) aren't in it again.
  assert.deepEqual(f.months.slice(0, 4).map(m => m.balance), [21000, 22000, 23000, 22000]);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].cashToBring, 2000);
  const repay = Math.round(calcRepaymentMonthly(576000, 6, 30, "PI") * 100) / 100;
  assert.equal(f.events[0].repayment, repay);
  assert.equal(f.months[4].net, Math.round((1000 - repay) * 100) / 100, "March: the loan's first repayment");
  assert.match(f.months[3].items.map(i => i.what).join(), /3 Example Ave settles — cash to bring/);
  assert.equal(f.earmarked, 2000);
  assert.equal(f.available, 18000, "what settlement needs is set aside, not emergency money");
});

test("a rate rise costs more on every loan, the new one included", function(){
  const base = liquidityForecast({ months: months(1000), startCash: 20000, purchases: [purchase], loans: [{ balance: 300000, rate: 6 }], stressPct: 0, today: "2026-11-20" });
  const up = liquidityForecast({ months: months(1000), startCash: 20000, purchases: [purchase], loans: [{ balance: 300000, rate: 6 }], stressPct: 2, today: "2026-11-20" });
  assert.equal(up.months[0].net, 1000 - 500, "2% on $300,000 is $500 a month");
  assert.ok(up.events[0].repayment > base.events[0].repayment);
  assert.match(up.assumptions.join(" "), /Rates 2% higher on every loan/);
});

test("a shortfall is said only when the balance goes below nothing, from a real balance", function(){
  const short = liquidityForecast({ months: months(-3000), startCash: 5000, purchases: [], loans: [], stressPct: 0, reserveTarget: 4000, today: "2026-11-20" });
  assert.equal(short.lowest.balance, 5000 - 36000);
  assert.equal(short.shortfall, 31000);
  assert.equal(short.monthsUnderReserve, 12);
  const fine = liquidityForecast({ months: months(500), startCash: 5000, purchases: [], loans: [], stressPct: 0, reserveTarget: 4000, today: "2026-11-20" });
  assert.equal(fine.shortfall, 0);
  assert.equal(fine.monthsUnderReserve, 0);
  assert.equal(fine.lowest.now, true, "never lower than today");
  const unknown = liquidityForecast({ months: months(-3000), startCash: null, purchases: [], loans: [], today: "2026-11-20" });
  assert.equal(unknown.shortfall, 0, "no balance to start from — no alarm");
  assert.match(unknown.missing.join(" "), /No cash or offset balance recorded/);
});

test("what's missing is said, never filled in: no settlement date, no rate, costs still to come; one after the horizon", function(){
  const f = liquidityForecast({ months: months(0), startCash: 1000, today: "2026-11-20", purchases: [
    Object.assign({}, purchase, { id: "x", what: "No date", settlementDate: "" }),
    Object.assign({}, purchase, { id: "y", what: "No rate", rate: "", costs: [{ id: "t", what: "Settlement fee", kind: "loan", tbc: true, amount: 0 }] }),
    Object.assign({}, purchase, { id: "z", what: "Later", settlementDate: "2028-06-01" })] });
  assert.match(f.missing.join(" | "), /No date has no settlement date/);
  assert.match(f.missing.join(" | "), /No rate has no loan rate/);
  assert.match(f.assumptions.join(" | "), /No rate: 1 cost is still to come/);
  assert.match(f.assumptions.join(" | "), /Later settles after these 12 months/);
  assert.equal(f.events.length, 1);
});

test("event payments use their own months and leave the remainder in the default month", function(){
  const project = { id: "home", name: "Furnishing", budget: 12000, month: "2027-01", items: [
    { id: "sofa", name: "Sofa", budget: 3000, paymentDate: "2026-12-22" },
    { id: "bed", name: "Bed", budget: 2500, paymentDate: "2027-01-12" },
    { id: "fridge", name: "Fridge", budget: 1500 }
  ] };
  const deposit = { project: "home", eventItemId: "sofa", amount: 2350, date: "2026-11-12" };
  const options = { months: months(0, 4), startCash: 35000, today: "2026-11-25", projects: [project] };
  const forecast = tx => liquidityForecast({ ...options, transactions: tx }).months;
  const base = forecast([deposit]);
  assert.deepEqual(base.map(m => m.net), [0, -650, -9000, 0]);
  assert.deepEqual(base[2].items, [
    { what: "Furnishing · Bed", amount: -2500 },
    { what: "Furnishing · remaining budget", amount: -6500 }
  ]);
  const payment = { project: "home", eventItemId: "sofa", amount: 400, date: "2026-11-24" };
  assert.deepEqual(forecast([deposit, payment]).map(m => m.net), [0, -250, -9000, 0]);
  payment.date = "2026-11-26";
  const future = forecast([deposit, payment]);
  assert.deepEqual(future.map(m => m.net), [-400, -250, -9000, 0]);
  assert.equal(future[0].items[0].what, "Furnishing · Sofa (recorded)");
});

test("overdue event payments start this month and later payments don't fall into the fallback month", function(){
  const project = { id: "event", name: "Event", budget: 1000, month: "2026-12", items: [
    { id: "late", name: "Overdue", budget: 300, paymentDate: "2026-10-10" },
    { id: "later", name: "Later", budget: 500, paymentDate: "2028-01-10" }
  ] };
  const f = liquidityForecast({ months: months(0, 3), projects: [project] });
  assert.deepEqual(f.months.map(m => m.net), [-300, -200, 0]);
});
