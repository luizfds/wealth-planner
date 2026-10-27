import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { netWorthList } from "../src/calc/networthlist.js";

test("one list of everything owned and owed, grouped, with offsets as cash and loans as debts", () => {
  const st = {
    assets: [{ id: "a1", what: "Savings", category: "Cash", amount: 20000 }, { id: "a2", what: "Fund A", symbol: "AAA", category: "Shares", amount: 15000 },
      { id: "a3", what: "Super", category: "Super", person: "Alex", amount: 90000 }, { id: "a4", what: "Car", category: "Vehicle", amount: 12000 },
      { id: "a5", what: "US fund", category: "Shares", market: "US", amount: 1000 }],
    properties: [{ id: "p1", what: "1 Example St", kind: "IP", value: 600000, loans: [{ id: "l1", balance: 400000, offsetBalance: 30000 }, { id: "l2", balance: 50000, endedOn: "2020-01-01" }] }],
    debts: [{ id: "d1", what: "Card", balance: 1500 }, { id: "d2", what: "Paid", balance: 0 }]
  };
  const l = netWorthList(st, (a, v) => a.market === "US" ? v * 1.5 : v);
  assert.deepEqual(l.groups.map(g => g.key), ["cash", "invest", "super", "property", "other", "debts"]);
  const g = k => l.groups.find(x => x.key === k);
  assert.equal(g("cash").total, 50000); assert.equal(g("invest").total, 16500);
  assert.deepEqual(g("debts").rows.map(r => [r.kind, r.value]), [["loan", -400000], ["debt", -1500]]);
  assert.equal(l.total, 20000 + 30000 + 16500 + 90000 + 12000 + 600000 - 400000 - 1500);
  assert.equal(g("invest").rows[0].sub, "AAA");
  assert.deepEqual(netWorthList({}).groups, []);
});
