import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { isoDayNumber } from "../src/calc/ledger.js";
import { rolledBalance, rolledBalances } from "../src/calc/accounts.js";
import { billsForMonth } from "../src/calc/bills.js";

// v3.298 sped up three hot paths without changing a figure. These hold them to what they replaced.

test("isoDayNumber is Date.UTC's day count, for real dates and malformed ones", () => {
  const ref = s => { const p = String(s).split("-"); if(p.length !== 3) return NaN; return Math.round(Date.UTC(+p[0], p[1] - 1, +p[2]) / 86400000); };
  const xs = ["2026--05", "-01-05", "0099-01-01", "0100-03-01", "2026-01-", "2026-02-30", "2026-13-01", "2026-00-10", "x", "", "2026-1-5", "2024-02-29", "1900-02-29", "2000-02-29"];
  for(let t = Date.UTC(1890, 0, 1); t < Date.UTC(2110, 0, 1); t += 86400000 * 5) xs.push(new Date(t).toISOString().slice(0, 10));
  for(const s of xs){ const a = isoDayNumber(s), b = ref(s); assert.ok(a === b || (Number.isNaN(a) && Number.isNaN(b)), s + ": " + a + " vs " + b); }
  assert.equal(isoDayNumber("2026-03-01") - isoDayNumber("2026-02-28"), 1);
});

test("rolling many accounts in one pass gives each what rolling it alone does", () => {
  const keep = { accounts: state.accounts, assets: state.assets, debts: state.debts, properties: state.properties, transactions: state.transactions, incomeLog: state.incomeLog, transfers: state.transfers };
  try {
    state.assets = [{ id: "a1", what: "Everyday", category: "Cash", amount: 1000, history: [{ date: "2026-01-10", value: 1000 }] },
      { id: "a2", what: "Savings", category: "Cash", amount: 5000, history: [{ date: "2026-01-20", value: 5000 }] }];
    state.debts = [{ id: "d1", what: "Card", balance: 300, history: [{ date: "2026-01-15", value: 300 }] }];
    state.properties = [];
    state.accounts = [{ id: "x1", name: "Everyday", type: "everyday", link: "asset:a1" }, { id: "x2", name: "Savings", type: "savings", link: "asset:a2" },
      { id: "x3", name: "Card", type: "credit", link: "debt:d1" }, { id: "x4", name: "Savings", type: "savings", link: "asset:a2" }];
    state.transactions = [{ date: "2026-01-05", amount: 50, account: "Everyday" }, { date: "2026-01-12", amount: 20, account: "Everyday" },
      { date: "2026-01-21", amount: 40, account: "Card" }, { date: "2026-02-01", amount: 7, account: "Savings" }, { date: "2026-03-01", amount: 9, account: "Everyday" }];
    state.incomeLog = [{ date: "2026-01-25", amount: 2000, account: "Everyday" }, { date: "2026-01-11", amount: 100, account: "Savings" }];
    state.transfers = [{ date: "2026-01-26", amount: 500, from: "Everyday", to: "Savings" }, { date: "2026-01-27", amount: 40, from: "Everyday", to: "Card" },
      { date: "2026-01-28", amount: 10, from: "Savings", to: "Savings" }];
    const opts = { today: "2026-02-15" };
    const one = state.accounts.map(a => rolledBalance(a, opts));
    assert.deepEqual(rolledBalances(state.accounts, opts), one);
    assert.equal(one[0].balance, 1000 - 20 + 2000 - 500 - 40, "Everyday: after its recorded date and up to today only");
    assert.equal(one[1].count, 4, "Savings: the transfer in, the self-transfer both ways, the spend");
  } finally { Object.assign(state, keep); }
});

test("the bills calendar marks a date paid exactly when a payment is within six days of it", () => {
  const items = [{ id: "L1", what: "Power", amount: 90, freq: "Monthly" }];
  const txs = [];
  for(let m = 1; m <= 9; m++) txs.push({ linkedExpenseId: "L1", date: "2025-" + String(m).padStart(2, "0") + "-10", amount: 90 });
  txs.push({ linkedExpenseId: "L1", date: "2025-10-16", amount: 90 });   // six days late: paid
  const oct = billsForMonth(items, txs, "2025-10", "2025-10-31", {});
  const due = Object.values(oct.days || {}).flat().filter(b => b.id === "L1");
  assert.ok(due.length >= 1);
  assert.ok(due.every(b => b.paid), JSON.stringify(due));
  const late = txs.slice(0, 9).concat([{ linkedExpenseId: "L1", date: "2025-10-17", amount: 90 }]);   // seven days late: anchor moves, still one payment near it
  const nov = billsForMonth(items, late, "2025-11", "2025-11-30", {});
  assert.ok(Object.values(nov.days || {}).flat().filter(b => b.id === "L1").every(b => !b.paid), "next month's bill isn't paid by a payment a month earlier");
});

test("notifications are kept while the household is unchanged and worked out again once it's saved or replaced", async () => {
  const { getLocalNotifications } = await import("../src/lib/notifications.js");
  const { setState } = await import("../src/state.js");
  const keep = state.assets;
  try {
    state.assets = [];
    setState(state);
    const before = getLocalNotifications();
    assert.deepEqual(getLocalNotifications(), before, "unchanged: the same list");
    state.assets = [{ id: "s1", what: "Old shares", category: "Shares", amount: 100, priceUpdated: "2000-01-01" }];
    assert.deepEqual(getLocalNotifications().map(n => n.id), before.map(n => n.id), "changed in place, not saved: still the kept list");
    setState(state);   // what a save or a replacement does (persist() bumps the same version)
    assert.ok(getLocalNotifications().some(n => /share|price/i.test(n.type + n.id)), "saved: worked out again");
  } finally { state.assets = keep; setState(state); }
});
