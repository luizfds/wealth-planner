import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthSplit, potFor, pots, potTrips, budgetHints, kindOf, isSetAside, classWord } from "../src/calc/budgetsplit.js";

const LINES = [
  { id: "rent", what: "Rent", category: "Housing", classification: "Needs", amount: 3000, freq: "Monthly" },
  { id: "food", what: "Groceries", category: "Groceries", classification: "Needs", amount: 1000, freq: "Monthly" },
  { id: "out", what: "Eating out", category: "Eating out", classification: "Wants", amount: 400, freq: "Monthly" },
  { id: "trips", what: "Trips", category: "Travel", classification: "Wants", amount: 12000, freq: "Yearly", irregular: true, reserveYear: "calendar" },
  { id: "car", what: "Car upkeep", category: "Car", classification: "Needs", amount: 1200, freq: "Yearly", irregular: true },
  { id: "save", what: "Savings", classification: "Savings", amount: 500, freq: "Monthly" },
  { id: "old", what: "Old gym", category: "Fitness", classification: "Wants", amount: 100, freq: "Monthly", endDate: "2026-03-01" }
];
const tx = (line, date, amount, extra) => Object.assign({ id: line + date + amount, linkedExpenseId: line, date, amount }, extra || {});

test("words: Essential, Lifestyle; kinds and set aside", () => {
  assert.deepEqual(["Needs", "Wants", "Savings", "N/A", undefined].map(classWord), ["Essential", "Lifestyle", "Savings", "Other", "Other"]);
  assert.deepEqual(LINES.slice(0, 6).map(kindOf), ["essential", "essential", "lifestyle", "lifestyle", "essential", "other"]);
  assert.deepEqual(LINES.map(isSetAside), [false, false, false, true, true, false, false]);
});

test("monthSplit: every-month Essentials and Lifestyle, set aside apart, the purchase's own class, ended lines out", () => {
  const txs = [tx("rent", "2026-11-01", 3000), tx("food", "2026-11-05", 300), tx("food", "2026-11-09", 60, { classification: "Wants" }),
    tx("out", "2026-11-10", 120), tx("trips", "2026-11-12", 2500), tx("car", "2026-11-14", 400), { id: "u", date: "2026-11-15", amount: 50 },
    { id: "u2", date: "2026-11-16", amount: 30, classification: "Needs" }, tx("out", "2026-10-30", 999)];
  const s = monthSplit(LINES, txs, "2026-11");
  assert.deepEqual(s.essential, { planned: 4000, spent: 3330 });
  assert.deepEqual(s.lifestyle, { planned: 400, spent: 180 }, "the dinner and the groceries counted as Lifestyle");
  assert.equal(s.other.spent, 50, "a purchase on no line is other spending, unless it says");
  assert.deepEqual(s.setAside, { planned: 1100, essential: 100, lifestyle: 1000 });
  assert.equal(s.other.planned, 500);
  assert.equal(s.total, 6000, "the whole plan, the ended gym left out");
  assert.equal(s.lifestyleLeft, 220);
  assert.equal(monthSplit(LINES, txs, "2026-02").lifestyle.planned, 500, "the gym counted while it ran");
});

test("potFor: empty at the start of its year, a month's allowance each month, spending out; or from what it held", () => {
  const txs = [tx("trips", "2026-01-20", 5000), tx("trips", "2026-04-22", 2000), tx("trips", "2025-12-30", 999)];
  const p = potFor(LINES[3], txs, "2026-06-15");
  assert.equal(p.from, "2025-12-31");
  assert.deepEqual([p.months, p.putIn, p.spent, p.balance, p.short], [6, 6000, 7000, -1000, true]);
  const held = Object.assign({}, LINES[3], { potStart: 1900, potFrom: "2026-02-10" });
  const q = potFor(held, txs, "2026-06-15");
  assert.deepEqual([q.start, q.months, q.putIn, q.spent, q.balance, q.short], [1900, 4, 4000, 2000, 3900, false]);
  assert.equal(pots(LINES, txs, "2026-06-15").map(x => x.line.id).join(), "trips,car");
});

test("potTrips: the trips that spent from a line", () => {
  const txs = [tx("trips", "2026-01-20", 5000), tx("trips", "2026-01-22", 500), tx("out", "2026-01-21", 80)];
  const t = potTrips(LINES[3], [{ id: "a", name: "Summer", from: "2026-01-19", to: "2026-01-25", lineId: "trips" }, { id: "b", name: "Other", from: "2026-01-19", to: "2026-01-25", lineId: "out" }], txs);
  assert.deepEqual(t.map(x => [x.trip.name, x.spent]), [["Summer", 5500]]);
});

test("budgetHints: an Essential that reads as Lifestyle, the reverse, a set-aside line spent most months — each kept once said", () => {
  const lines = [
    { id: "a", what: "Takeaway", category: "Eating out", classification: "Needs", amount: 200, freq: "Monthly" },
    { id: "b", what: "Pharmacy", category: "Extras", classification: "Wants", amount: 50, freq: "Monthly" },
    { id: "c", what: "Cafés", category: "Eating out", classification: "Wants", amount: 250, freq: "Monthly", irregular: true },
    { id: "d", what: "Trips", category: "Travel", classification: "Wants", amount: 12000, freq: "Yearly", irregular: true },
    { id: "e", what: "Rent", category: "Housing", classification: "Needs", amount: 3000, freq: "Monthly" }
  ];
  const txs = [];
  for(let m = 1; m <= 12; m++){ const ym = (m <= 1 ? "2025-12" : "2026-" + String(m - 1).padStart(2, "0")); txs.push(tx("c", ym + "-10", 20)); }
  txs.push(tx("d", "2026-01-10", 4000), tx("d", "2026-04-10", 3000));
  const h = budgetHints(lines, txs, { today: "2026-11-20" });
  assert.deepEqual(h.map(x => [x.lineId, x.kind]), [["a", "essential-lifestyle"], ["b", "lifestyle-essential"], ["c", "setaside-monthly"]]);
  assert.deepEqual(h[0].fix.set, { classification: "Wants" });
  assert.deepEqual(h[2].fix.set, { irregular: false });
  assert.match(h[2].text, /12 of the last 12 months/);
  const ok = {}; ok[h[0].id] = true;
  assert.ok(!budgetHints(lines, txs, { today: "2026-11-20", ok }).some(x => x.lineId === "a"));
});
