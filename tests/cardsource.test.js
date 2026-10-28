import test from "node:test";
import assert from "node:assert/strict";
import { oddCardRepayments, usualCardSource } from "../src/calc/bills.js";

const accounts = [
  { name: "Everyday", type: "everyday" }, { name: "Home loan", type: "loan" }, { name: "Home loan offset", type: "offset" },
  { name: "Card A", type: "credit" }, { name: "Card B", type: "credit" }
];
const transfers = [
  { id: "x1", date: "2026-08-21", from: "Home loan offset", to: "Card A", amount: 900 },
  { id: "x2", date: "2026-09-21", from: "Home loan offset", to: "Card A", amount: 800 },
  { id: "x3", date: "2026-10-21", from: "Home loan", to: "Card A", amount: 700 },
  { id: "x4", date: "2026-10-22", from: "Everyday", to: "Home loan offset", amount: 50 }
];

test("a card's usual source is its direct-debit account, else where its repayments came from", () => {
  assert.equal(usualCardSource(accounts[3], accounts, transfers), "Home loan offset");
  assert.equal(usualCardSource(Object.assign({}, accounts[3], { autoPayFrom: "Everyday" }), accounts, transfers), "Everyday");
  assert.equal(usualCardSource(accounts[4], accounts, transfers), "");
});

test("a card repayment logged from a loan or another card is found, with where it should have come from", () => {
  const odd = oddCardRepayments(accounts, transfers.concat([{ id: "x5", date: "2026-10-23", from: "Card B", to: "Card A", amount: 10 }]));
  assert.deepEqual(odd.map((o) => [o.transfer.id, o.fromType, o.usual]), [["x3", "loan", "Home loan offset"], ["x5", "credit", "Home loan offset"]]);
  assert.equal(oddCardRepayments(accounts, transfers.slice(0, 2)).length, 0);
});

test("repayment days passed with nothing logged are found, with the cycle's charges and the usual account", async () => {
  const { unloggedCardRepayments } = await import("../src/calc/bills.js");
  const accts = [{ name: "Home loan offset", type: "offset" }, { name: "Card A", type: "credit", statementStartDay: 8, autoPayFrom: "Home loan offset" }];
  const tx = [{ id: "t1", date: "2026-09-12", account: "Card A", amount: 120 }, { id: "t2", date: "2026-10-02", account: "Card A", amount: 80 }, { id: "t3", date: "2026-10-12", account: "Card A", amount: 50 }];
  const tr = [{ id: "x1", date: "2026-08-21", from: "Home loan offset", to: "Card A", amount: 300 }];
  const out = unloggedCardRepayments(accts, tx, tr, "2026-10-29");
  assert.deepEqual(out.map((o) => [o.date, o.amount, o.from, o.direct]), [["2026-10-21", 200, "Home loan offset", true]]);
  const logged = tr.concat([{ id: "x2", date: "2026-10-21", from: "Home loan offset", to: "Card A", amount: 200 }]);
  assert.equal(unloggedCardRepayments(accts, tx, logged, "2026-10-29").length, 0);
});
