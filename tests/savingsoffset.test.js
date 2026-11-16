import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { savingsVsOffset, savingsOffsetLines } from "../src/calc/savingsoffset.js";
import { computePersonTax } from "../src/calc/tax.js";
import { state, defaultState, setState } from "../src/state.js";
import { recalcComputedItems } from "../src/calc/engine.js";

// #398: savings account vs offset. An invented household.
function household(){
  const s = defaultState();
  s.income = [{ id: "g1", person: "Alex", incomeType: "Gross", what: "Salary", amount: 150000, freq: "Yearly" }, { id: "g2", person: "Sam", incomeType: "Gross", what: "Salary", amount: 60000, freq: "Yearly" }];
  s.assets = [
    { what: "Joint saver", category: "Cash", amount: 20000, interestRate: 5 },
    { what: "Sam's saver", category: "Cash", amount: 10000, interestRate: 4, person: "Sam" },
    { what: "Everyday", category: "Cash", amount: 3000 },
    { what: "Fund", category: "Shares", amount: 5000, interestRate: 9 }
  ];
  s.properties = [
    { id: "home", what: "Home", kind: "PPOR", value: 800000, income: [], expenses: [], loans: [{ id: "hl", what: "Home loan", balance: 400000, rate: 6, termYears: 25, repaymentType: "PI", settlementDate: "2022-01-01" }] },
    { id: "ip", what: "1 Example St", kind: "IP", state: "NSW", pmFee: { percent: 0, flat: 0 }, value: 600000, ownership: { Alex: 100 }, income: [], expenses: [], loans: [
      { id: "il", what: "Investment loan", balance: 300000, rate: 6.5, termYears: 25, repaymentType: "IO", settlementDate: "2022-01-01" },
      { id: "done", what: "Paid off", balance: 0, rate: 7, termYears: 25, repaymentType: "PI", settlementDate: "2010-01-01" }] }
  ];
  return s;
}
const rateOf = n => Number(computePersonTax(n).marginalRate) + 0.02;

test("each account after its holder's tax; the household's split evenly; an account without a rate listed, not guessed", () => {
  const was = state; setState(household()); recalcComputedItems();
  try {
    const c = savingsVsOffset("2026-11-03");
    const joint = c.accounts.find(a => a.name === "Joint saver"), sams = c.accounts.find(a => a.name === "Sam's saver");
    const even = (rateOf("Alex") + rateOf("Sam")) / 2;
    assert.equal(joint.holder, "");
    assert.equal(joint.afterTax, Math.round(5 * (1 - even) * 100) / 100);
    assert.equal(sams.holder, "Sam");
    assert.equal(sams.afterTax, Math.round(4 * (1 - rateOf("Sam")) * 100) / 100);
    assert.equal(sams.yearly, Math.round(10000 * sams.afterTax) / 100);
    assert.deepEqual(c.missing, ["Everyday"]);
    assert.ok(!c.accounts.some(a => a.name === "Fund"), "only cash");
  } finally { setState(was); recalcComputedItems(); }
});

test("a home loan's offset saves its full rate; an investment loan's, its rate less the owners' tax; a paid-off loan isn't one", () => {
  const was = state; setState(household()); recalcComputedItems();
  try {
    const c = savingsVsOffset("2026-11-03");
    const home = c.offsets.find(o => o.name === "Home loan"), inv = c.offsets.find(o => o.name === "Investment loan");
    assert.equal(home.deductible, false); assert.equal(home.effective, 6);
    assert.equal(inv.deductible, true); assert.equal(inv.effective, Math.round(6.5 * (1 - rateOf("Alex")) * 100) / 100);
    assert.ok(!c.offsets.some(o => o.name === "Paid off"));
    assert.equal(c.best.name, "Home loan");
    const lines = savingsOffsetLines(c);
    const j = lines.find(l => l.name === "Joint saver");
    assert.equal(j.offsetYearly, 1200);
    assert.equal(j.gain, Math.round((1200 - j.savingsYearly) * 100) / 100);
    assert.ok(j.gain > 0, "the home loan's offset is worth more than a taxed savings rate");
  } finally { setState(was); recalcComputedItems(); }
});

test("no loan, nothing to compare; nothing non-finite", () => {
  const was = state; const s = household(); s.properties = []; setState(s); recalcComputedItems();
  try {
    const c = savingsVsOffset("2026-11-03");
    assert.equal(c.best, null);
    assert.deepEqual(savingsOffsetLines(c), []);
    JSON.stringify(c, (k, v) => { if(typeof v === "number") assert.ok(Number.isFinite(v), k); return v; });
  } finally { setState(was); recalcComputedItems(); }
});
