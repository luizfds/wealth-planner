import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { proposeBudget, applyBudgetProposals } from "../src/calc/budgetfromhistory.js";
import { budgetFromHistoryHtml } from "../src/components/budgethistory.js";

// v3.115.0: a budget from what was spent. Invented merchants and amounts.
function tx(){
  const out = []; let n = 0;
  for (const m of ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
    out.push({ id: "t" + (++n), date: m + "-06", what: "STREAMBOX 4029", amount: 18.99, account: "Card" });
    out.push({ id: "t" + (++n), date: m + "-10", what: "SQ *FERN CAFE 0099", amount: 20 + n, account: "Card", category: "Eating out" });
    out.push({ id: "t" + (++n), date: m + "-21", what: "HARBOUR NOODLES 77", amount: 18 + (n * 7) % 23, account: "Card", category: "Eating out" });
    out.push({ id: "t" + (++n), date: m + "-14", what: "WOOLWORTHS 1234", amount: 150 + n, account: "Everyday" });
    out.push({ id: "t" + (++n), date: m + "-15", what: "ACME HARDWARE 55", amount: 40 + n * 3, account: "Everyday" });
  }
  out.push({ id: "t99", date: "2026-07-02", what: "ODD THING 1", amount: 12, account: "Card" });
  out.push({ id: "t100", date: "2026-07-03", what: "Already planned", amount: 60, linkedExpenseId: "power" });
  return out;
}
const lines = [{ id: "power", what: "Power", category: "Utilities" }];

test("steady payees get their own line; everyday spending one per category; the rest left out", () => {
  const r = proposeBudget(tx(), lines, "2026-09-30");
  assert.equal(r.ready, true);
  const by = Object.fromEntries(r.proposals.map(p => [p.what, p]));
  assert.equal(by["Streambox"].kind, "steady");
  assert.deepEqual([by["Streambox"].amount, by["Streambox"].freq], [18.99, "Monthly"]);
  assert.equal(by["Eating out"].kind, "category", "two cafés become one Eating out line");
  assert.equal(by["Eating out"].count, 10);
  assert.equal(by["Groceries"].classification, "Needs", "a known supermarket, filed by its category");
  assert.equal(by["Acme Hardware"].kind, "merchant", "uncategorised but adds up");
  assert.ok(!by["Odd Thing"], "a small one-off");
  assert.equal(r.leftover.count, 1);
  assert.ok(!r.proposals.some(p => p.txIds.includes("t100")), "spending already on a line is left alone");
});

test("not before three months, and a category already budgeted is skipped", () => {
  assert.equal(proposeBudget(tx().filter(t => t.date >= "2026-08"), lines, "2026-09-30").ready, false);
  const r = proposeBudget(tx(), lines.concat([{ id: "eat", what: "Dining", category: "Eating out" }]), "2026-09-30");
  assert.ok(!r.proposals.some(p => p.what === "Eating out"));
});

test("applying adds the lines and links their transactions", () => {
  const st = { shared: [], transactions: tx() };
  const r = proposeBudget(st.transactions, [], "2026-09-30");
  const made = applyBudgetProposals(st, r.proposals, (() => { let i = 0; return () => "L" + (++i); })());
  assert.equal(st.shared.length, made.length);
  const sb = made.find(l => l.what === "Streambox");
  assert.equal(st.transactions.filter(t => t.linkedExpenseId === sb.id).length, 5);
  assert.match(budgetFromHistoryHtml(r), /Add \d+ lines/);
  assert.match(budgetFromHistoryHtml({ ready: false, proposals: [] }), /section-empty/);
});
