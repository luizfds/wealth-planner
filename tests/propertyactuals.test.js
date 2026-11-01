import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { propertyYearActual, actualFyFor } from "../src/calc/propertyactuals.js";

// v3.209.0 (item 241): a property's financial year so far, as it went. Invented property and amounts.
function setup(){
  var p = { id: "ip1", what: "1 Example St", kind: "IP", value: 500000,
    income: [{ what: "Rent", amount: 520, freq: "Weekly" }],
    expenses: [{ id: "ins", what: "Landlord insurance", amount: 1200, freq: "Yearly" }, { id: "wr", what: "Water rates", amount: 800, freq: "Yearly" }],
    loans: [],
    agentStatements: [
      { id: "s1", date: "2026-07-31", rent: 2000, water: 50, fees: 150, waterRates: 0, others: [], net: 1900, incomeId: "i1", txIds: [] },
      { id: "s2", date: "2026-08-31", rent: 2000, water: 0, fees: 150, waterRates: 190, others: [], net: 1660, incomeId: "i2", txIds: ["t2"] },
      { id: "s0", date: "2026-06-30", rent: 2000, water: 0, fees: 150, waterRates: 0, others: [], net: 1850, incomeId: "i0", txIds: [] }
    ] };
  var st = {
    properties: [p],
    incomeLog: [
      { id: "i1", date: "2026-07-31", amount: 1900, target: "rent:ip1" },   // a statement's payment — counted through the statement
      { id: "i2", date: "2026-08-31", amount: 1660, target: "rent:ip1" },
      { id: "i0", date: "2026-06-30", amount: 1850, target: "rent:ip1" },   // last year
      { id: "d1", date: "2026-09-15", amount: 600, target: "rent:ip1" },    // received directly, no statement
      { id: "x1", date: "2026-09-15", amount: 999, target: "salary:alex" }  // not this property
    ],
    transactions: [
      { id: "t1", date: "2026-08-10", amount: 1200, linkedExpenseId: "ins" },
      { id: "t2", date: "2026-08-31", amount: 190, linkedExpenseId: "wr" },  // paid by the agent, from statement s2
      { id: "t3", date: "2026-09-01", amount: 75, linkedExpenseId: "groceries" }, // another line
      { id: "t4", date: "2026-06-01", amount: 300, linkedExpenseId: "ins" }  // last year
    ]
  };
  return { p: p, st: st };
}

test("the year so far: statements' rent and fees, rent received without one, payments against the property's lines", function(){
  const { p, st } = setup();
  const a = propertyYearActual(p, 2026, "2026-09-30", st, []);
  const row = k => a.rows.find(r => r.key === k);
  assert.equal(row("rent").actual, 2000 + 50 + 2000 + 600, "rent and water recovered from statements, plus the direct receipt");
  assert.equal(row("expenses").actual, -(150 + 150 + 1200 + 190), "agency fees, the insurance and the bill the agent paid");
  assert.equal(a.statements, 2);
  assert.equal(a.received, 1);
  assert.equal(a.payments, 2);
  assert.equal(a.wholeYear, false);
  assert.ok(a.share > 0.24 && a.share < 0.26, "1 July to 30 Sept is about a quarter of the year");
  // The plan for the same days: 520 × 52 a year, a quarter of it.
  assert.ok(Math.abs(row("rent").plan - 520 * 52 * a.share) < 1);
  assert.ok(Math.abs(row("expenses").plan + 2000 * a.share) < 1);
  assert.equal(a.net, a.rows.reduce((s, r) => s + r.actual, 0));
  assert.equal(a.nothingLogged, false);
});

test("a finished year is the whole year; a year not started yet is nothing; nothing logged says so", function(){
  const { p, st } = setup();
  assert.equal(propertyYearActual(p, 2026, "2027-08-01", st, []).wholeYear, true);
  assert.equal(propertyYearActual(p, 2027, "2027-03-01", st, []), null);
  const empty = propertyYearActual({ id: "ip2", kind: "IP", income: [], expenses: [], loans: [] }, 2026, "2026-09-30", st, []);
  assert.equal(empty.nothingLogged, true);
  assert.equal(empty.net, 0);
});

test("which financial year: today's, or the chosen period's once it's over", function(){
  assert.equal(actualFyFor("2027-06-30", "2026-11-01"), 2026);
  assert.equal(actualFyFor("2026-06-30", "2026-11-01"), 2025);
});
