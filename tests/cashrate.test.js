import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parseRbaCsv, rbaDate, cashRateFile, cashRateFromFile, cashRateMove, loansForMove, recordCashRateMove, applyCashRate } from "../src/calc/cashrate.js";
import { loanRateOn } from "../src/calc/property.js";
import { cashRatePanelHtml, cashRateLine } from "../src/components/cashrate.js";

// Item 249. A table shaped like the RBA's CSVs: a title row, rows describing each column, then a row per date.
const A2 = [
  "A2 MONETARY POLICY CHANGES,,",
  "Title,Change in the cash rate target,New Cash Rate Target",
  "Description,\"Change, percentage points\",\"Cash rate target, per cent\"",
  "Frequency,Irregular,Irregular",
  "Units,Percentage points,Per cent",
  "Series ID,ARBAMPCCCR,ARBAMPCNCRT",
  "03-Feb-2026,0.25,3.85",
  "18-Mar-2026,0.25,4.10",
  "06-May-2026,0.25,4.35",
  "30-Sep-2026,0.25,4.60",
  "04-Nov-2026,0.25,4.85"
].join("\r\n");

test("the RBA's file: the cash rate target's column, not the change; dates in its format", () => {
  assert.equal(rbaDate("04-Nov-2026"), "2026-11-04");
  assert.equal(rbaDate("4/11/2026"), "2026-11-04");
  assert.equal(rbaDate("Title"), null);
  const p = parseRbaCsv(A2);
  assert.equal(p.length, 5);
  assert.deepEqual(p[p.length - 1], { effective: "2026-11-04", rate: 4.85 });
  const daily = "Title,Cash Rate Target,Interbank Overnight Cash Rate\nSeries ID,FIRMMCRTD,FIRMMCRID\n03-Nov-2026,4.60,4.59\n04-Nov-2026,4.85,4.84\n05-Nov-2026,4.85,4.85\n";
  assert.deepEqual(parseRbaCsv(daily), [{ effective: "2026-11-03", rate: 4.6 }, { effective: "2026-11-04", rate: 4.85 }], "daily rows collapse to the changes");
  assert.throws(() => parseRbaCsv("Title,Something else\n04-Nov-2026,1"), /Cash Rate Target/, "a file that changed shape fails loudly");
  const f = cashRateFile(p, "2026-11-04");
  assert.deepEqual(f.current, { rate: 4.85, effective: "2026-11-04" });
  assert.deepEqual(f.previous, { rate: 4.6, effective: "2026-09-30" });
  assert.equal(f.decisions[f.decisions.length - 1].change, 0.25);
});

const FILE = { current: { rate: 4.85, effective: "2026-11-04" }, previous: { rate: 4.6, effective: "2026-09-30" } };
function household(){
  return { cashRate: null,
    properties: [{ id: "p1", what: "1 Example St", loans: [
      { id: "L1", what: "Loan A", rate: 6.2, balance: 400000, termYears: 25, settlementDate: "2022-03-01" },
      { id: "L2", what: "Loan B", rate: 5.9, balance: 50000, termYears: 25, settlementDate: "2022-03-01" }] }],
    purchase: { Buy: { rate: 6.9, ioRate: 7.2, rateFollowsCash: true, rateCashAt: 4.6 }, Other: { rate: 6.5, ioRate: 6.8 } },
    scenarioChanges: { Invest: [{ id: "c1", kind: "ip", rate: 6.6, rateFollowsCash: "1", rateCashAt: 4.6 }, { id: "c2", kind: "ip", rate: 6.4 }] } };
}

test("a move is news once: first read within six weeks, then until it's answered", () => {
  const st = household();
  st.cashRate = cashRateFromFile(FILE, null, "2026-11-05");
  assert.equal(st.cashRate.change, 0.25);
  assert.deepEqual(cashRateMove(st), { rate: 4.85, previous: 4.6, change: 0.25, effective: "2026-11-04" });
  assert.equal(cashRateFromFile(FILE, null, "2027-03-01").seen, "2026-11-04", "old news on a first read isn't news");
  const answered = Object.assign({}, st.cashRate, { seen: "2026-11-04" });
  assert.equal(cashRateMove({ cashRate: cashRateFromFile(FILE, answered, "2026-11-06") }), null, "answered stays answered");
});

test("recording the move puts it in each ticked loan's rate history from the date picked", () => {
  const st = household();
  st.cashRate = cashRateFromFile(FILE, null, "2026-11-05");
  const loans = loansForMove(st, 0.25, "2026-11-19");
  assert.deepEqual(loans.map(l => [l.what, l.from, l.to]), [["Loan A", 6.2, 6.45], ["Loan B", 5.9, 6.15]]);
  assert.equal(recordCashRateMove(st, ["p1:0"], "2026-11-19", "2026-11-20"), 1);
  const [a, b] = st.properties[0].loans;
  assert.equal(loanRateOn(a, "2026-11-18"), 6.2);
  assert.equal(loanRateOn(a, "2026-11-19"), 6.45);
  assert.equal(a.rate, 6.45);
  assert.equal(b.rate, 5.9, "an unticked (fixed) loan is left alone");
  assert.equal(cashRateMove(st), null);
});

test("a scenario rate that follows the cash rate moves by as much; one typed stays", () => {
  const st = household();
  st.cashRate = cashRateFromFile(FILE, null, "2026-11-05");
  assert.equal(applyCashRate(st), 2);
  assert.deepEqual([st.purchase.Buy.rate, st.purchase.Buy.ioRate, st.purchase.Buy.rateCashAt], [7.15, 7.45, 4.85]);
  assert.equal(st.purchase.Other.rate, 6.5);
  assert.equal(st.scenarioChanges.Invest[0].rate, 6.85);
  assert.equal(st.scenarioChanges.Invest[1].rate, 6.4);
  assert.equal(applyCashRate(st), 0, "the same rate again moves nothing");
  st.purchase.Other.rateFollowsCash = true;
  applyCashRate(st);
  assert.deepEqual([st.purchase.Other.rate, st.purchase.Other.rateCashAt], [6.5, 4.85], "following starts from the rate as it is");
});

test("the panel: the rate on its own, or the move with each loan and the date", () => {
  const st = household();
  assert.equal(cashRatePanelHtml(st, "2026-11-05"), "");
  st.cashRate = cashRateFromFile(FILE, null, "2026-11-05");
  const html = cashRatePanelHtml(st, "2026-11-05");
  assert.match(html, /raised the cash rate 0\.25% to 4\.85%/);
  assert.match(html, /data-cr-loan="p1:0" checked/);
  assert.match(html, /Loan A<\/span> <b>6\.2% → 6\.45%/);
  assert.match(html, /data-cr-date value="2026-11-05"/);
  st.cashRate.seen = st.cashRate.effective;
  assert.match(cashRatePanelHtml(st, "2026-11-05"), /RBA cash rate 4\.85% — up 0\.25% from/);
  assert.equal(cashRateLine(null), "");
});
