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
    Alex: { incomeStatements: [{ payer: "Employer A", gross: ***REMOVED***, allowances: 66, withheld: ***REMOVED*** }], interest: [{ account: "ATO interest", gross: 0.9 }], deductions: [{ label: "D10", what: "Tax agent", amount: 275 }], wfhHours: ***REMOVED*** },
    Sam: { incomeStatements: [{ payer: "Employer C", gross: ***REMOVED***, withheld: ***REMOVED*** }] }
  },
  rental: [{ match: "Example", lines: { rent: ***REMOVED***, interest: ***REMOVED*** }, ownership: { Alex: 70, Sam: 30 } }],
  holdings: [
    { symbol: "ETFB", person: "Alex", taxStatement: { c13: ***REMOVED***, q13: ***REMOVED*** } },
    { symbol: "XYZ", person: "Sam", taxStatement: { c13: 1 } },
    { symbol: "ABC", person: "Alex", name: "ABC Ltd", sales: [{ date: "2025-01-01", units: ***REMOVED***, proceeds: ***REMOVED***, costBase: ***REMOVED*** }] }
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
    state.assets = [{ category: "Shares", symbol: "ETFB", what: "iShares ETFB", person: "Alex Morgan", taxStatements: [{ fy: 2025, c13: 999 }] }];
    state.taxYears = {}; state.tax = { settings: {} };
    const r = mergeTaxYearFile(file, ["Alex Morgan", "Sam"]);
    assert.deepEqual(r.people, ["Alex → Alex Morgan", "Sam"]);
    assert.equal(personYear(2025, "Alex Morgan").incomeStatements[0].withheld, ***REMOVED***);
    assert.equal(state.tax.settings["Alex Morgan"].wfhHours[2025], ***REMOVED***);
    assert.equal(rentalSchedule(state.properties[0], 2025).lines.find(l => l.key === "rent").actual, ***REMOVED***);
    assert.deepEqual(state.properties[0].ownership, { "Alex Morgan": 70, Sam: 30 });
    assert.equal(state.assets[0].taxStatements.length, 1);
    assert.equal(state.assets[0].taxStatements[0].c13, ***REMOVED***);
    assert.deepEqual(r.addedHoldings, ["ABC (Alex Morgan)"]);
    assert.equal(state.assets[1].sales.length, 1);
    assert.match(r.skipped[0], /XYZ tax statement — no XYZ holding for Sam/);
    // Importing twice doesn't duplicate the sale.
    mergeTaxYearFile(file, ["Alex Morgan", "Sam"]);
    assert.equal(state.assets[1].sales.length, 1);
  });
  assert.throws(() => mergeTaxYearFile({ kind: "other" }, []), /Not a tax year file/);
});
