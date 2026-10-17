import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
const { state } = await import("../src/state.js");
const { mergeTaxYearFile, matchPerson, personYear, rentalSchedule } = await import("../src/calc/taxyear.js");

function withState(fn){
  const keep = {}; ["income", "properties", "assets", "taxYears", "tax"].forEach(k => keep[k] = state[k]);
  try { return fn(); } finally { Object.assign(state, keep); }
}
const file = {
  kind: "wealth-planner-tax-year", version: 1, fy: 2025,
  people: {
    Alex: { incomeStatements: [{ payer: "Employer A", gross: 130687, allowances: 66, withheld: 37034 }], interest: [{ account: "ATO interest", gross: 0.9 }], deductions: [{ label: "D10", what: "Tax agent", amount: 275 }], wfhHours: 1712 },
    Sam: { incomeStatements: [{ payer: "Employer C", gross: 118861, withheld: 28860 }] }
  },
  rental: [{ match: "Example", lines: { rent: 32250, interest: 30508.53 }, ownership: { Alex: 70, Sam: 30 } }],
  holdings: [
    { symbol: "IHD", person: "Alex", taxStatement: { c13: 246.11, q13: 76.54 } },
    { symbol: "XYZ", person: "Sam", taxStatement: { c13: 1 } },
    { symbol: "DRO", person: "Alex", name: "DroneShield", sales: [{ date: "2025-10-07", units: 1315, proceeds: 8413, costBase: 1721.44 }] }
  ]
};

test("matchPerson: exact, case, and first name either way round", () => {
  assert.equal(matchPerson("alex", ["Alex Morgan", "Sam"]), "Alex Morgan");
  assert.equal(matchPerson("Sam Santos", ["Alex", "Sam"]), "Sam");
  assert.equal(matchPerson("Sam", ["Alex"]), null);
});
test("mergeTaxYearFile: merges one year into the plan and reports what went where", () => {
  withState(() => {
    state.income = [{ person: "Alex Morgan", incomeType: "Gross", amount: 1, freq: "Yearly" }, { person: "Sam", incomeType: "Gross", amount: 1, freq: "Yearly" }];
    state.properties = [{ id: "p1", kind: "IP", what: "1 Example Street", income: [], expenses: [], loans: [] }];
    state.assets = [{ category: "Shares", symbol: "IHD", what: "iShares IHD", person: "Alex Morgan", taxStatements: [{ fy: 2025, c13: 999 }] }];
    state.taxYears = {}; state.tax = { settings: {} };
    const r = mergeTaxYearFile(file, ["Alex Morgan", "Sam"]);
    assert.deepEqual(r.people, ["Alex → Alex Morgan", "Sam"]);
    assert.equal(personYear(2025, "Alex Morgan").incomeStatements[0].withheld, 37034);
    assert.equal(state.tax.settings["Alex Morgan"].wfhHours[2025], 1712);
    assert.equal(rentalSchedule(state.properties[0], 2025).lines.find(l => l.key === "rent").actual, 32250);
    assert.deepEqual(state.properties[0].ownership, { "Alex Morgan": 70, Sam: 30 });
    assert.equal(state.assets[0].taxStatements.length, 1);
    assert.equal(state.assets[0].taxStatements[0].c13, 246.11);
    assert.deepEqual(r.addedHoldings, ["DRO (Alex Morgan)"]);
    assert.equal(state.assets[1].sales.length, 1);
    assert.match(r.skipped[0], /XYZ tax statement — no XYZ holding for Sam/);
    // Importing twice doesn't duplicate the sale.
    mergeTaxYearFile(file, ["Alex Morgan", "Sam"]);
    assert.equal(state.assets[1].sales.length, 1);
  });
  assert.throws(() => mergeTaxYearFile({ kind: "other" }, []), /Not a tax year file/);
});
