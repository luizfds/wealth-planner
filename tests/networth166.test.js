import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { loggedSinceRecorded } from "../src/calc/accounts.js";
import { estimatesUplift } from "../src/calc/estimates.js";
import { netWorthList } from "../src/calc/networthlist.js";

// Invented: an everyday account recorded at $1,000 on 1 Oct, a card owing $200 on 1 Oct.
const st = () => ({
  assets: [{ id: "c1", what: "Everyday", category: "Cash", amount: 1000, history: [{ date: "2026-10-01", value: 1000 }] }],
  debts: [{ id: "d1", what: "Card One", balance: 200, history: [{ date: "2026-10-01", value: 200 }] }],
  properties: [],
  accounts: [{ id: "a1", name: "Everyday", type: "everyday", link: "asset:c1" }, { id: "a2", name: "Card One", type: "credit", link: "debt:d1" }],
  transactions: [{ date: "2026-10-05", amount: 50, account: "Everyday" }, { date: "2026-10-06", amount: 80, account: "Card One" }, { date: "2026-09-20", amount: 999, account: "Everyday" }],
  incomeLog: [{ date: "2026-10-10", amount: 3000, account: "Everyday" }],
  transfers: [{ date: "2026-10-12", amount: 150, from: "Everyday", to: "Card One" }]
});

const KEYS = ["assets", "debts", "properties", "accounts", "transactions", "incomeLog", "transfers"];
test("net worth moves with what's been logged on each account since its balance was recorded", (t) => {
  const keep = {}; KEYS.forEach(k => { keep[k] = state[k]; }); t.after(() => KEYS.forEach(k => { state[k] = keep[k]; }));
  const s = st(); KEYS.forEach(k => { state[k] = s[k]; });
  const r = loggedSinceRecorded("2026-10-27");
  // Everyday: −50 + 3000 − 150 = +2,800. Card: +80 spent, −150 repaid → owes 70 less → +70 to net worth.
  assert.deepEqual(r.byRecord, { "asset:c1": 2800, "debt:d1": 70 });
  assert.equal(r.total, 2870);
  const l = netWorthList(s, null, r.byRecord);
  assert.equal(l.groups.find(g => g.key === "cash").total, 3800);
  assert.equal(l.groups.find(g => g.key === "debts").total, -130);
  assert.equal(l.total, 3670);
  // Nothing logged since → nothing moves.
  assert.deepEqual(loggedSinceRecorded("2026-10-01"), { byRecord: {}, total: 0 });
});

test("estimates sit beside the headline: super a month past its figure, property ninety days past", (t) => {
  const keep = state.projection; t.after(() => { state.projection = keep; });
  state.projection = Object.assign({}, keep, { investReturnRate: 7, propertyAppreciationRate: 5 });
  const s = { assets: [{ what: "Super", category: "Super", amount: 100000, history: [{ date: "2026-04-27", value: 100000 }] },
      { what: "Fresh super", category: "Super", amount: 50000, history: [{ date: "2026-10-20", value: 50000 }] }],
    properties: [{ what: "1 Example St", value: 600000, history: [{ date: "2025-10-27", value: 600000 }] }] };
  const u = estimatesUplift(s, "2026-10-27");
  assert.deepEqual(u.items.map(i => i.name), ["Super", "1 Example St"]);
  assert.ok(u.items[0].estimate > 103000 && u.items[0].estimate < 104000, String(u.items[0].estimate));
  assert.equal(u.items[1].estimate, 630000);
  assert.equal(u.total, u.items[0].estimate - 100000 + 30000);
});
