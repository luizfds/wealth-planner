import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { netWorthCheck, interestForMonth, gapReading } from "../src/calc/nwcheck.js";

// Invented: $5,000 pay in, $3,000 spent on the card, the card paid down, a loan with an offset,
// some shares and super, all recorded at both month ends.
function household(){
  return {
    incomeLog: [{ date: "2026-03-20", amount: 5000, target: "net:Alex" }],
    transactions: [{ id: "t", date: "2026-03-10", amount: 3000, what: "Fern Cafe" }],
    assets: [
      { what: "Bank One", category: "Cash", amount: 1000, history: [{ date: "2026-02-28", value: 1000 }, { date: "2026-03-31", value: 900 }] },
      { what: "Fern Fund", category: "Shares", amount: 10500, history: [{ date: "2026-02-28", value: 10000 }, { date: "2026-03-31", value: 10500 }] },
      { what: "Alex super", category: "Super", amount: 50800, history: [{ date: "2026-02-28", value: 50000 }, { date: "2026-03-31", value: 50800 }] },
      { what: "New saver", category: "Cash", amount: 400, history: [{ date: "2026-03-15", value: 400 }] }
    ],
    debts: [{ what: "Card", balance: 1500, history: [{ date: "2026-02-28", value: 1000 }, { date: "2026-03-31", value: 1500 }] }],
    properties: [{ what: "1 Example St", value: 500000, history: [{ date: "2026-02-28", value: 500000 }, { date: "2026-03-31", value: 500000 }],
      loans: [{ what: "Loan", balance: 300000, rate: 6, offsetBalance: 0,
        balanceHistory: [{ date: "2026-02-28", value: 300500 }, { date: "2026-03-31", value: 300000 }],
        offsetHistory: [{ date: "2026-02-28", value: 100000 }, { date: "2026-03-31", value: 101540 }] }] }]
  };
}

test("interest on what's owed less the offset, for the days in the month", function(){
  assert.equal(interestForMonth(household(), "2026-03"), Math.round(200500 * 0.06 / 365 * 31 * 100) / 100);
});

test("kept, market and interest against how net worth moved", function(){
  var st = household();
  var c = netWorthCheck("2026-03", { state: st, today: "2026-04-10" });
  assert.equal(c.kept, 2000);
  assert.equal(c.invest, 500);
  assert.equal(c.super, 800);
  assert.equal(c.other, 0);
  // Cash side actual: bank −100, card −500, loan +500 (paid down), offset +1,540 = +1,440.
  assert.equal(c.cashSide, 1440);
  assert.equal(c.actualChange, 1440 + 500 + 800);
  assert.equal(c.expectedChange, Math.round((2000 - c.interest + 1300) * 100) / 100);
  assert.equal(c.started.join(), "New saver", "first recorded mid-month: listed, not counted");
  assert.match(gapReading(c), c.addsUp ? /^Adds up/ : /^Net worth rose/);
});

test("a gap is named, and balances not recorded near month end are listed", function(){
  var st = household();
  st.transactions.push({ id: "x", date: "2026-03-12", amount: 2500, what: "Logged twice" });
  st.debts[0].history = [{ date: "2026-02-28", value: 1000 }, { date: "2026-03-10", value: 1500 }];
  var c = netWorthCheck("2026-03", { state: st, today: "2026-04-10" });
  assert.equal(c.addsUp, false);
  assert.ok(c.gap > 2000);
  assert.match(gapReading(c), /rose \$[\d,]+ more/);
  assert.deepEqual(c.stale, ["Card"]);
});
