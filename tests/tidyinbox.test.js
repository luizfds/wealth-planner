import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { inboxCards, applyInboxAction, inboxPlanEffect } from "../src/calc/tidyinbox.js";

const lines = () => [
  { id: "pet", what: "Biscuit", classification: "Needs", amount: 100, freq: "Monthly" },
  { id: "home", what: "Home & garden", classification: "Wants", amount: 50, freq: "Monthly" },
  { id: "shop", what: "Online shopping", classification: "Wants", amount: 250, freq: "Monthly" },
  { id: "cafe", what: "Cafés", classification: "Wants", amount: 200, freq: "Monthly", irregular: true }
];
const input = (st) => ({
  lines: st.shared,
  strays: [{ id: "hardware co|pet", label: "Hardware Co", total: 103, fromLineId: "pet", toLineId: "home", txIds: ["t1"], count: 1, mainCount: 10 }],
  hints: [{ id: "hint:setaside-monthly|cafe", kind: "setaside-monthly", lineId: "cafe", what: "Cafés", text: "set aside, but spent in 12 of the last 12 months", fix: { label: "Make it every month", set: { irregular: false } } }],
  drift: [{ id: "shop", what: "Online shopping", freq: "Monthly", planned: 3000, actual: 6360, gap: 3360, suggested: 530 }],
  recurring: [{ key: "streamio", name: "Streamio", freq: "Monthly", amount: 15, count: 3, monthly: 15, category: "Subscriptions", indices: [1, 2] }],
  ok: st.tidyOk
});
const fresh = () => ({ shared: lines(), tidyOk: {}, transactions: [{ id: "t1", linkedExpenseId: "pet", amount: 103 }, { id: "t2", amount: 15, category: "x" }, { id: "t3", amount: 15, account: "Card A" }] });

test("inboxCards: one card per thing, in order, each with two answers", () => {
  const st = fresh();
  const cards = inboxCards(input(st));
  assert.deepEqual(cards.map(c => c.kind), ["misfiled", "hint", "drift", "recurring"]);
  assert.equal(cards[0].title, "Hardware Co, $103, is on Biscuit");
  assert.equal(cards[0].yes.label, "Move to Home & garden");
  assert.equal(cards[1].label, "Spent every month");
  assert.deepEqual(cards[2].facts, [["Plan", "$250/mo"], ["Typical (12 months)", "$530/mo"]]);
  assert.equal(cards[2].label, "Plan too low");
  assert.equal(cards[2].no.label, "Keep it as a target");
  assert.equal(cards[3].title, "Streamio charged $15 3 times");
  assert.ok(cards.every(c => c.yes.act && c.no.act && c.no.act.type === "ok"));
});

test("each yes does its thing and its undo puts it back", () => {
  const st = fresh();
  const lineOf = id => st.shared.find(l => l.id === id);
  const cards = inboxCards(input(st));
  let u = applyInboxAction(st, cards[0].yes.act, { lineOf });
  assert.equal(st.transactions[0].linkedExpenseId, "home"); u(); assert.equal(st.transactions[0].linkedExpenseId, "pet");
  u = applyInboxAction(st, cards[1].yes.act, { lineOf });
  assert.equal(lineOf("cafe").irregular, false); u(); assert.equal(lineOf("cafe").irregular, true);
  assert.equal(Math.round(inboxPlanEffect(cards[2], lineOf)), 280);
  u = applyInboxAction(st, cards[2].yes.act, { lineOf });
  assert.equal(lineOf("shop").amount, 530); u(); assert.equal(lineOf("shop").amount, 250);
  u = applyInboxAction(st, cards[3].yes.act, { lineOf, idFactory: () => "new1" });
  const made = lineOf("new1");
  assert.deepEqual([made.what, made.classification, made.amount, made.freq, made.account], ["Streamio", "Wants", 15, "Monthly", "Card A"]);
  assert.deepEqual([st.transactions[1].linkedExpenseId, st.transactions[2].linkedExpenseId, st.transactions[1].category], ["new1", "new1", ""]);
  u(); assert.ok(!lineOf("new1")); assert.equal(st.transactions[1].category, "x"); assert.ok(!st.transactions[2].linkedExpenseId);
});

test("a no is remembered, so the card doesn't come back; its undo brings it back", () => {
  const st = fresh();
  const cards = inboxCards(input(st));
  const undos = cards.map(c => applyInboxAction(st, c.no.act, {}));
  assert.equal(Object.keys(st.tidyOk).length, 4);
  assert.deepEqual(inboxCards(input(st)).map(c => c.kind), ["misfiled", "hint"], "strays and hints are filtered by their own calc with ok; drift and recurring here");
  undos.forEach(u => u());
  assert.equal(Object.keys(st.tidyOk).length, 0);
  assert.equal(applyInboxAction(st, { type: "amount", lineId: "gone", amount: 1 }, { lineOf: () => undefined }), null);
});

test("a misfiled card says what you called it, when that isn't the bank's shop — and doesn't call it a slip", async () => {
  const { strays } = await import("../src/calc/tidy.js");
  const L = [{ id: "gym", what: "Gym", classification: "Wants" }, { id: "cafe", what: "Cafés", classification: "Wants" }];
  const txs = [1, 2, 3, 4].map(i => ({ id: "g" + i, linkedExpenseId: "gym", date: "2026-10-0" + i, amount: 40, what: "FITCO 1234", bankWhat: "FITCO 1234" }))
    .concat([{ id: "c1", linkedExpenseId: "cafe", date: "2026-10-09", amount: 12, what: "The Bakery", bankWhat: "FITCO 1234" }]);
  const s = strays(txs, L, { today: "2026-11-01" });
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].typed, ["The Bakery"]);
  const card = inboxCards({ strays: s, lines: L })[0];
  assert.match(card.body, /You described it as “The Bakery” — check it's the same shop/);
  assert.doesNotMatch(card.body, /Probably a slip/);
});
