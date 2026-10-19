import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { statementTotals, logAgentStatement, removeAgentStatement, statementsForFy, waterRatesLine } from "../src/calc/agentstatement.js";

function fixture(){
  var p = { id: "p1", what: "1 Example St", kind: "IP", income: [{ what: "Rent", amount: 500, freq: "Weekly", account: "Bank One" }],
    expenses: [{ id: "pm", what: "Agent fee", computed: true }, { id: "wr", what: "Water rates" }, { id: "mt", what: "Maintenance" }] };
  return { st: { incomeLog: [], transactions: [], properties: [p] }, p: p };
}

test("a statement adds up: in, out, and what reached you", function(){
  assert.deepEqual(statementTotals({ rent: 2000, water: 120.5, fees: 125.5, waterRates: 300, others: [{ amount: 95 }] }), { moneyIn: 2120.5, moneyOut: 520.5, net: 1600 });
});

test("logging one writes rent received and the bills paid from it, and undoes cleanly", function(){
  var f = fixture();
  assert.equal(waterRatesLine(f.p).id, "wr");
  var rec = logAgentStatement(f.st, f.p, { date: "2026-03-01", rent: 2000, water: 120, fees: 126, waterRates: 300, others: [{ lineId: "mt", amount: 94, what: "Plumber" }], account: "Bank One" });
  assert.equal(rec.net, 1600);
  assert.deepEqual(f.st.incomeLog.map(function(r){ return [r.target, r.amount, r.account]; }), [["rent:p1", 1600, "Bank One"]]);
  assert.deepEqual(f.st.transactions.map(function(t){ return [t.linkedExpenseId, t.amount, t.account]; }), [["wr", 300, ""], ["mt", 94, ""]]);
  assert.equal(f.p.agentStatements.length, 1);
  assert.equal(removeAgentStatement(f.st, f.p, rec.id), true);
  assert.equal(f.st.incomeLog.length + f.st.transactions.length + f.p.agentStatements.length, 0);
});

test("an empty statement writes nothing", function(){
  var f = fixture();
  assert.equal(logAgentStatement(f.st, f.p, { date: "2026-03-01" }), null);
  assert.equal(f.st.incomeLog.length, 0);
});

test("a financial year's statements add up to the annual summary", function(){
  var f = fixture();
  logAgentStatement(f.st, f.p, { date: "2026-06-30", rent: 1000, fees: 60 });
  logAgentStatement(f.st, f.p, { date: "2026-07-01", rent: 1000, water: 50, fees: 60, waterRates: 200 });
  logAgentStatement(f.st, f.p, { date: "2026-08-01", rent: 1000, fees: 60 });
  var s = statementsForFy(f.p, 2026);
  assert.deepEqual(s, { count: 2, rent: 2000, water: 50, fees: 120, waterRates: 200, other: 0, net: 1730 });
});
