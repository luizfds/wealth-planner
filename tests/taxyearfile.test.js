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
    Alex: { incomeStatements: [{ payer: "Employer A", gross: 98400, allowances: 120, withheld: 22900 }], interest: [{ account: "ATO interest", gross: 0.9 }], deductions: [{ label: "D10", what: "Tax agent", amount: 190 }], wfhHours: 900 },
    Sam: { incomeStatements: [{ payer: "Employer C", gross: 86200, withheld: 18700 }] }
  },
  rental: [{ match: "Example", lines: { rent: 26520, interest: 21840.25 }, ownership: { Alex: 60, Sam: 40 } }],
  holdings: [
    { symbol: "DIV", person: "Alex", taxStatement: { c13: 352.70, q13: 115.30 } },
    { symbol: "XYZ", person: "Sam", taxStatement: { c13: 1 } },
    { symbol: "ABC", person: "Alex", name: "ABC Ltd", sales: [{ date: "2025-09-12", units: 2000, proceeds: 6200, costBase: 3100 }] }
  ]
};

test("matchPerson: exact, case, and first name either way round", () => {
  assert.equal(matchPerson("alex", ["Alex Morgan", "Sam"]), "Alex Morgan");
  assert.equal(matchPerson("Sam Lee", ["Alex", "Sam"]), "Sam");
  assert.equal(matchPerson("Sam", ["Alex"]), null);
});
test("mergeTaxYearFile: merges one year into the plan and reports what went where", () => {
  withState(() => {
    state.income = [{ person: "Alex Morgan", incomeType: "Gross", amount: 1, freq: "Yearly" }, { person: "Sam", incomeType: "Gross", amount: 1, freq: "Yearly" }];
    state.properties = [{ id: "p1", kind: "IP", what: "1 Example Street", income: [], expenses: [], loans: [] }];
    state.assets = [{ category: "Shares", symbol: "DIV", what: "Dividend ETF", person: "Alex Morgan", taxStatements: [{ fy: 2025, c13: 999 }] }];
    state.taxYears = {}; state.tax = { settings: {} };
    const r = mergeTaxYearFile(file, ["Alex Morgan", "Sam"]);
    assert.deepEqual(r.people, ["Alex → Alex Morgan", "Sam"]);
    assert.equal(personYear(2025, "Alex Morgan").incomeStatements[0].withheld, 22900);
    assert.equal(state.tax.settings["Alex Morgan"].wfhHours[2025], 900);
    assert.equal(rentalSchedule(state.properties[0], 2025).lines.find(l => l.key === "rent").actual, 26520);
    assert.deepEqual(state.properties[0].ownership, { "Alex Morgan": 60, Sam: 40 });
    assert.equal(state.assets[0].taxStatements.length, 1);
    assert.equal(state.assets[0].taxStatements[0].c13, 352.70);
    assert.deepEqual(r.addedHoldings, ["ABC (Alex Morgan)"]);
    assert.equal(state.assets[1].sales.length, 1);
    assert.match(r.skipped[0], /XYZ tax statement — no XYZ holding for Sam/);
    // Importing twice doesn't duplicate the sale.
    mergeTaxYearFile(file, ["Alex Morgan", "Sam"]);
    assert.equal(state.assets[1].sales.length, 1);
  });
  assert.throws(() => mergeTaxYearFile({ kind: "other" }, []), /Not a tax year file/);
});
