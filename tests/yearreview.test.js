import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewYear, reviewYearSpan, taxYearNote, yearReviewSections, yearHasData, WORTH_CHECKING } from "../src/calc/yearreview.js";
import { state, defaultState, setState } from "../src/state.js";

// #396: the guided Year in review. Invented figures.
test("the year to look back on follows the household's basis, or a finished header period", () => {
  const fin = reviewYear("2026-11-03", "financial");
  assert.deepEqual([fin.w.start, fin.w.end, fin.pw.start, fin.fy, fin.calendar], ["2025-07-01", "2026-06-30", "2024-07-01", 2025, false]);
  assert.equal(reviewYearSpan(fin), "1 July 2025 to 30 June 2026");
  assert.equal(taxYearNote(fin), "");
  const cal = reviewYear("2026-11-03", "calendar");
  assert.deepEqual([cal.w.start, cal.w.end, cal.w.label, cal.pw.start, cal.fy, cal.calendar], ["2025-01-01", "2025-12-31", "2025", "2024-01-01", 2024, true]);
  assert.equal(reviewYearSpan(cal), "1 January to 31 December 2025");
  assert.match(taxYearNote(cal), /financial year ending in 2025/);
  assert.equal(reviewYear("2026-11-03", "financial", { start: "2023-07-01", end: "2024-06-30" }).fy, 2023, "a finished header year is the one looked back on");
  assert.equal(reviewYear("2026-11-03", "financial", { start: "2026-07-01", end: "2027-06-30" }).fy, 2025, "an unfinished header year isn't");
  assert.equal(reviewYear("2026-11-03", "calendar", { start: "2022-01-01", end: "2022-12-31" }).w.label, "2022");
});

test("an empty household: every section says what fills it, none shows $0", () => {
  const was = state; setState(defaultState());
  try {
    const y = reviewYear("2026-11-03", "financial");
    const s = yearReviewSections(y, { tin: 0, tout: 0, pin: 0, pout: 0, start: { total: 0, partial: [] }, end: { total: 0, partial: ["Everyday"] } }, "2026-11-03");
    assert.deepEqual(s.map(x => x.key), ["money", "networth", "leaks", "emergency", "goals", "checking"]);
    s.filter(x => x.key !== "checking").forEach(x => { assert.equal(x.tone, "empty", x.key); assert.ok(x.empty && x.go && x.label, x.key + " says what fills it and where"); assert.ok(!/\$0\b/.test(x.empty)); });
    assert.match(s[1].empty, /\(Everyday\)/);
    assert.equal(s[5].links, WORTH_CHECKING);
    const zero = yearReviewSections(y, { tin: 0, tout: 0, pin: 0, pout: 0, start: { total: 0, partial: [] }, end: { total: 0, partial: [] } }, "2026-11-03");
    assert.equal(zero[1].tone, "empty", "nothing recorded at either end isn't a flat year");
    assert.match(zero[1].empty, /No balances were recorded/);
    assert.equal(yearHasData(y), false);
  } finally { setState(was); }
});

test("with figures: kept or overspent, net worth up or down", () => {
  const was = state; setState(defaultState());
  try {
    const y = reviewYear("2026-11-03", "financial");
    const s = yearReviewSections(y, { tin: 100000, tout: 80000, pin: 90000, pout: 85000, start: { total: 300000, partial: [] }, end: { total: 340000, partial: [] } }, "2026-11-03");
    assert.equal(s[0].tone, "good");
    assert.match(s[0].verdict, /\$100,000 came in and \$80,000 was spent: \$20,000 kept, 20% of it\./);
    assert.match(s[0].detail, /The year before: \$90,000 in, \$85,000 spent/);
    assert.equal(s[1].tone, "good");
    assert.match(s[1].verdict, /From \$300,000 to \$340,000 — up \$40,000/);
    const bad = yearReviewSections(y, { tin: 50000, tout: 60000, pin: 0, pout: 0, start: { total: 10, partial: [] }, end: { total: 5, partial: [] } }, "2026-11-03");
    assert.equal(bad[0].tone, "warn");
    assert.match(bad[0].verdict, /\$10,000 more went out than came in/);
    assert.equal(bad[1].tone, "warn");
    state.transactions = [{ date: "2026-01-10", amount: 20 }];
    assert.equal(yearHasData(y), true);
    assert.equal(yearHasData(reviewYear("2026-11-03", "calendar")), false, "a January 2026 transaction isn't in calendar 2025");
  } finally { setState(was); }
});
