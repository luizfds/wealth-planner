import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { typicalMonthly, adjustRows, adjustEffect, applyAdjust } from "../src/calc/adjustplan.js";

const TODAY = "2026-11-20";
const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const lines = () => [
  { id: "shop", what: "Online shopping", classification: "Wants", amount: 250, freq: "Monthly" },
  { id: "food", what: "Groceries", classification: "Needs", amount: 300, freq: "Weekly" },
  { id: "fee", what: "Card fee", classification: "Needs", amount: 150, freq: "Monthly" },
  { id: "new", what: "New gym", classification: "Wants", amount: 50, freq: "Monthly", startDate: "2026-08-01" },
  { id: "old", what: "Old", classification: "Wants", amount: 10, freq: "Monthly", endDate: "2026-01-01" },
  { id: "pmFee", what: "Worked out", amount: 99, freq: "Monthly", computed: true }
];
let n = 0;
const tx = (line, ym, amount) => ({ id: "x" + (++n), linkedExpenseId: line, date: ym + "-10", amount });
function txs(){
  n = 0;
  const out = [];
  months.forEach((m, i) => { out.push(tx("shop", m, i < 11 ? 530 : 530)); out.push(tx("food", m, 1300)); });
  out.push(tx("fee", "2024-05", 150));
  ["2026-08", "2026-09", "2026-10"].forEach(m => out.push(tx("new", m, 50)));
  out.push(tx("shop", "2026-11", 999)); // this month isn't over: left out
  return out;
}

test("typicalMonthly: the last 12 full months, or fewer for a line that started later", () => {
  const t = typicalMonthly(lines()[0], txs(), TODAY, 250);
  assert.deepEqual([t.monthly, t.months, t.monthsSpent, t.monthsOver], [530, 12, 12, 12]);
  assert.deepEqual(typicalMonthly(lines()[3], txs(), TODAY, 50).months, 3);
  const fee = typicalMonthly(lines()[2], txs(), TODAY, 150);
  assert.deepEqual([fee.monthly, fee.months, fee.monthsSpent], [0, 12, 0]);
});

test("adjustRows: furthest first, far only when it matters, the amount in the line's own frequency", () => {
  const rows = adjustRows(lines(), txs(), TODAY);
  assert.deepEqual(rows.map(r => r.id), ["shop", "fee", "food", "new"], "ended and worked-out lines are left out");
  const shop = rows[0];
  assert.deepEqual([shop.planMonthly, shop.typical, shop.far, shop.amount, shop.note], [250, 530, true, 530, "over the plan 12 of 12 months"]);
  assert.equal(rows[1].note, "nothing logged in 12 months — paid somewhere else?");
  assert.equal(rows[1].far, false, "nothing logged isn't spending $0 — a bill paid elsewhere");
  const food = rows.find(r => r.id === "food");
  assert.equal(food.far, false, "$1,300 against a weekly $300 ($1,300/mo) is on plan");
  assert.equal(food.amount, 300);
  assert.equal(rows.find(r => r.id === "new").far, false);
});

test("adjustEffect and applyAdjust: what the picks change, set, and undone", () => {
  const ls = lines(), rows = adjustRows(ls, txs(), TODAY);
  const picked = { shop: true, fee: true };
  assert.deepEqual(adjustEffect(rows, picked), { delta: 130, count: 2 });
  const r = applyAdjust(rows, picked, id => ls.find(l => l.id === id));
  assert.equal(r.count, 2);
  assert.deepEqual([ls[0].amount, ls[2].amount], [530, 0]);
  r.undo();
  assert.deepEqual([ls[0].amount, ls[2].amount], [250, 150]);
});
